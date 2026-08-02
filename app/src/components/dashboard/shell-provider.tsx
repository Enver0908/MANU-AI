"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildShellHref,
  dashboardSectionToShellDestination,
  parseDashboardSearchParams,
  resolveActiveDestination,
  resolveShellDestination,
  sanitizeShellDestination,
  type DashboardSection,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import type {
  ShellBootstrapDto,
  ShellDestinationId,
  ShellRuntimeState,
} from "@/lib/phase-85-stage-5-shell-contracts";
import {
  createFallbackShellBootstrap,
  createInitialShellProviderState,
  mapShellBootstrapHttpFailure,
  reduceShellProviderState,
  type ShellProviderMode,
  type ShellProviderState,
} from "@/lib/phase-85-stage-5-shell-provider-state";
import { normalizeLanguageCode, type SupportedLanguageCode } from "@/lib/languages";

export type ShellHeaderSlots = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

type ShellProviderContextValue = {
  state: ShellProviderState;
  runtime: ShellRuntimeState;
  bootstrap: ShellBootstrapDto | null;
  focusMode: boolean;
  activeDestination: ReturnType<typeof resolveActiveDestination>;
  shellDestination: ShellDestinationId;
  uiLanguage: SupportedLanguageCode;
  headerSlots: ShellHeaderSlots;
  setHeaderSlots: (slots: ShellHeaderSlots) => void;
  refreshBootstrap: () => void;
  navigateToDestination: (destination: ShellDestinationId) => void;
  navigateToSection: (section: DashboardSection) => void;
  setFocusMode: (focusMode: boolean) => void;
  /** Faz 8 dirty registry hook; always allows until that phase lands. */
  canNavigateAway: () => boolean;
};

const ShellProviderContext = createContext<ShellProviderContextValue | null>(null);

async function fetchShellBootstrap(activeClientId: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  if (activeClientId) params.set("activeClientId", activeClientId);
  const query = params.toString();
  const response = await fetch(query ? `/api/shell/bootstrap?${query}` : "/api/shell/bootstrap", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | ShellBootstrapDto
    | { error?: string }
    | null;
  if (!response.ok) {
    const errorCode =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error ?? "shell_bootstrap_unavailable")
        : "shell_bootstrap_unavailable";
    const error = new Error(errorCode) as Error & { status: number; errorCode: string };
    error.status = response.status;
    error.errorCode = errorCode;
    throw error;
  }
  return payload as ShellBootstrapDto;
}

export function ShellProvider({
  mode = "live",
  fallbackDisplayName,
  fallbackUiLanguage,
  children,
}: {
  mode?: ShellProviderMode;
  fallbackDisplayName?: string;
  fallbackUiLanguage?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(
    reduceShellProviderState,
    mode,
    createInitialShellProviderState,
  );
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [headerSlots, setHeaderSlotsState] = useReducer(
    (_prev: ShellHeaderSlots, next: ShellHeaderSlots) => next,
    {},
  );

  const shellDestination = resolveShellDestination(pathname, searchParams);
  const activeDestination = resolveActiveDestination(pathname, searchParams);
  const urlState = parseDashboardSearchParams(searchParams);
  const preferenceClientId = state.bootstrap?.preferences.activeClientId ?? null;
  const effectiveClientId = urlState.clientId ?? preferenceClientId;

  const runBootstrap = useCallback(
    (reason: "mount" | "route" | "foreground" | "explicit") => {
      void reason;
      if (mode === "fallback") {
        const sequence = sequenceRef.current + 1;
        sequenceRef.current = sequence;
        dispatch({ type: "bootstrap_started", sequence });
        dispatch({
          type: "bootstrap_succeeded",
          sequence,
          bootstrap: createFallbackShellBootstrap({
            displayName: fallbackDisplayName,
            uiLanguage: fallbackUiLanguage,
          }),
        });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      dispatch({ type: "bootstrap_started", sequence });

      void fetchShellBootstrap(urlState.clientId, controller.signal)
        .then((bootstrap) => {
          dispatch({ type: "bootstrap_succeeded", sequence, bootstrap });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const status =
            typeof error === "object" && error && "status" in error
              ? Number((error as { status?: number }).status ?? 503)
              : 503;
          const errorCode =
            typeof error === "object" && error && "errorCode" in error
              ? String((error as { errorCode?: string }).errorCode ?? "shell_bootstrap_unavailable")
              : error instanceof Error
                ? error.message
                : "shell_bootstrap_unavailable";
          const offline =
            typeof navigator !== "undefined" && navigator.onLine === false
              ? true
              : error instanceof TypeError;
          dispatch({
            type: "bootstrap_failed",
            sequence,
            runtime: mapShellBootstrapHttpFailure({ status, errorCode, offline }),
            error: errorCode,
          });
        });
    },
    [fallbackDisplayName, fallbackUiLanguage, mode, urlState.clientId],
  );

  const searchKey = searchParams.toString();

  useEffect(() => {
    runBootstrap("route");
    return () => {
      abortRef.current?.abort();
    };
  }, [pathname, searchKey, runBootstrap]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runBootstrap("foreground");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runBootstrap]);

  useEffect(() => {
    const focus = searchParams.get("focus") === "1";
    dispatch({ type: "set_focus_mode", focusMode: focus && shellDestination === "ai_chat" });
  }, [searchKey, searchParams, shellDestination]);

  const setHeaderSlots = useCallback((slots: ShellHeaderSlots) => {
    setHeaderSlotsState(slots);
  }, []);

  const canNavigateAway = useCallback(() => true, []);

  const navigateToDestination = useCallback(
    (destination: ShellDestinationId) => {
      if (!canNavigateAway()) return;
      const safe = sanitizeShellDestination(destination);
      const enabled = state.bootstrap?.navigation.find((item) => item.id === safe)?.enabled;
      if (state.bootstrap && enabled === false) return;
      const href = buildShellHref(safe, {
        current: urlState,
        clientId: shellDestinationAcceptsClientFromUrl(safe) ? effectiveClientId : null,
        focusMode: false,
      });
      router.push(href);
    },
    [canNavigateAway, effectiveClientId, router, state.bootstrap, urlState],
  );

  const navigateToSection = useCallback(
    (section: DashboardSection) => {
      navigateToDestination(dashboardSectionToShellDestination(section));
    },
    [navigateToDestination],
  );

  const setFocusMode = useCallback(
    (next: boolean) => {
      if (shellDestination !== "ai_chat") return;
      const href = buildShellHref("ai_chat", {
        chatId: extractAiChatId(pathname),
        focusMode: next,
      });
      router.push(href);
    },
    [pathname, router, shellDestination],
  );

  const uiLanguage = normalizeLanguageCode(
    state.bootstrap?.uiLanguage ?? fallbackUiLanguage ?? "tr",
  );

  const value = useMemo<ShellProviderContextValue>(
    () => ({
      state,
      runtime: state.runtime,
      bootstrap: state.bootstrap,
      focusMode: state.focusMode,
      activeDestination,
      shellDestination,
      uiLanguage,
      headerSlots,
      setHeaderSlots,
      refreshBootstrap: () => runBootstrap("explicit"),
      navigateToDestination,
      navigateToSection,
      setFocusMode,
      canNavigateAway,
    }),
    [
      activeDestination,
      canNavigateAway,
      headerSlots,
      navigateToDestination,
      navigateToSection,
      runBootstrap,
      setFocusMode,
      setHeaderSlots,
      shellDestination,
      state,
      uiLanguage,
    ],
  );

  return <ShellProviderContext.Provider value={value}>{children}</ShellProviderContext.Provider>;
}

function shellDestinationAcceptsClientFromUrl(destination: ShellDestinationId) {
  return (
    destination === "home" ||
    destination === "clients" ||
    destination === "messages" ||
    destination === "alerts" ||
    destination === "notifications" ||
    destination === "simulator" ||
    destination === "voice" ||
    destination === "forms"
  );
}

function extractAiChatId(pathname: string) {
  const match = pathname.match(/^\/dashboard\/ai-chat\/([^/]+)/);
  return match?.[1] ?? null;
}

export function useShellProvider() {
  const value = useContext(ShellProviderContext);
  if (!value) {
    throw new Error("shell_provider_missing");
  }
  return value;
}

export function useOptionalShellProvider() {
  return useContext(ShellProviderContext);
}
