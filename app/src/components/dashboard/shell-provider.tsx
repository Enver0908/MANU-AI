"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
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
  shellDestinationAcceptsClientId,
  type DashboardSection,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import type {
  ShellBootstrapDto,
  ShellDestinationId,
  ShellRuntimeState,
} from "@/lib/phase-85-stage-5-shell-contracts";
import {
  buildShellClientSwitchConfirmMessage,
  resolveEffectiveShellActiveClientId,
  shouldShowShellActiveClientControl,
  shellDestinationViewStateRegistry,
  type ShellDestinationViewSnapshot,
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
import {
  getClientBuildVersion,
  markShellReloadRequiredAfterSuccessfulSave,
  setShellMutationUpdateGate,
} from "@/lib/phase-85-stage-5-shell-authenticated-mutation";
import {
  buildShellReconnectHomeHref,
  resolveClientBuildVersion,
  resolveShellMutationUpdateGate,
  SHELL_ACTIVITY_MIN_INTERVAL_MS,
  SHELL_SW_SKIP_WAITING_MESSAGE,
  SIRIUSAI_CLIENT_VERSION_HEADER,
  SIRIUSAI_MUTATION_KIND_HEADER,
  shouldBlockOptionalPwaReload,
} from "@/lib/phase-85-stage-5-shell-pwa";
import type { ShellVersionDto } from "@/lib/phase-85-stage-5-shell-contracts";
import {
  shellDirtyRegistry,
  type ShellDirtySnapshot,
} from "@/lib/phase-85-stage-5-shell-dirty-registry";
import { ShellDirtyNavigationDialog } from "@/components/dashboard/shell-dirty-navigation-dialog";
import { ShellWebVitalsReporter } from "@/components/dashboard/shell-web-vitals-reporter";
import { ShellPreferenceCoordinator } from "@/lib/phase-85-stage-5-shell-preference-coordinator";

export type ShellHeaderSlots = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

type ActiveClientSelection = {
  id: string;
  fullName: string;
  referenceShort: string;
};

type ScopedAiChatClient = {
  id: string;
  fullName: string;
  referenceShort: string;
} | null;

type PendingNavigation =
  | { kind: "destination"; destination: ShellDestinationId }
  | { kind: "logout" }
  | { kind: "focus"; next: boolean }
  | { kind: "href"; href: string }
  | { kind: "client-switch"; client: ActiveClientSelection; proceed: () => Promise<boolean> }
  | { kind: "clear-client" }
  | { kind: "sw-update" };

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
  requestHrefNavigation: (href: string) => void;
  setFocusMode: (focusMode: boolean) => void;
  canNavigateAway: () => boolean;
  /** Legacy/test helper — prefer useShellDirtyRegistration. */
  setNavigationDirty: (dirty: boolean) => void;
  selectActiveClient: (client: ActiveClientSelection) => Promise<boolean>;
  clearActiveClient: () => Promise<boolean>;
  requestDirtyNavigationConfirm: (client: ActiveClientSelection) => string;
  effectiveActiveClientId: string | null;
  showActiveClientControl: boolean;
  saveDestinationViewState: (destinationId: ShellDestinationId, snapshot: ShellDestinationViewSnapshot) => void;
  restoreDestinationViewState: (destinationId: ShellDestinationId) => ShellDestinationViewSnapshot | null;
  updateWaiting: boolean;
  updateRequired: boolean;
  applyWaitingServiceWorkerUpdate: () => void;
  dismissOptionalUpdate: () => void;
  requestLogout: () => void;
  dirtySnapshot: ShellDirtySnapshot;
  scopedAiChatClient: ScopedAiChatClient;
  setScopedAiChatClient: (client: ScopedAiChatClient) => void;
  hideCompactNavigation: boolean;
  setHideCompactNavigation: (hidden: boolean) => void;
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

function createPreferenceRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `shell-pref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ShellProvider({
  mode = "live",
  fallbackDisplayName,
  fallbackUiLanguage,
  fallbackAiChatEnabled,
  registerServiceWorker = false,
  children,
}: {
  mode?: ShellProviderMode;
  fallbackDisplayName?: string;
  fallbackUiLanguage?: string;
  fallbackAiChatEnabled?: boolean;
  registerServiceWorker?: boolean;
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
  const activityPendingRef = useRef(false);
  const lastActivitySentAtRef = useRef(0);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const reconnectingRef = useRef(false);
  const bootstrapRetryRef = useRef(0);
  const preferenceRevisionRef = useRef<number | null>(null);
  const bootstrapRefreshRef = useRef<() => void>(() => undefined);
  const preferenceCoordinatorRef = useRef<ShellPreferenceCoordinator | null>(null);
  const currentBrowserHrefRef = useRef("");
  const [dirtySnapshot, setDirtySnapshot] = useReducer(
    (_prev: ShellDirtySnapshot, next: ShellDirtySnapshot) => next,
    shellDirtyRegistry.snapshot(),
  );
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [scopedAiChatClient, setScopedAiChatClient] = useState<ScopedAiChatClient>(null);
  const [hideCompactNavigation, setHideCompactNavigation] = useState(false);
  const [headerSlots, setHeaderSlotsState] = useReducer(
    (_prev: ShellHeaderSlots, next: ShellHeaderSlots) => next,
    {},
  );

  const shellDestination = resolveShellDestination(pathname, searchParams);
  const activeDestination = resolveActiveDestination(pathname, searchParams);
  const urlState = parseDashboardSearchParams(searchParams);
  const preferenceClientId = state.bootstrap?.preferences.activeClientId ?? null;
  const effectiveActiveClientId = resolveEffectiveShellActiveClientId({
    urlClientId: urlState.clientId,
    preferenceClientId,
  });
  const showActiveClientControl = shouldShowShellActiveClientControl(shellDestination);

  if (!preferenceCoordinatorRef.current) {
    preferenceCoordinatorRef.current = new ShellPreferenceCoordinator({
      getRevision: () => preferenceRevisionRef.current,
      createRequestId: createPreferenceRequestId,
      getClientBuildVersion,
      refreshBootstrap: () => bootstrapRefreshRef.current(),
    });
  }

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
            aiChatEnabled: fallbackAiChatEnabled,
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

      // General AI Chat must not bind global client context into the request.
      const bootstrapClientId = shellDestination === "ai_chat" ? null : urlState.clientId;

      void fetchShellBootstrap(bootstrapClientId, controller.signal)
        .then((bootstrap) => {
          bootstrapRetryRef.current = 0;
          const nextBootstrap =
            shellDestination === "ai_chat"
              ? { ...bootstrap, activeClient: null }
              : bootstrap;
          dispatch({ type: "bootstrap_succeeded", sequence, bootstrap: nextBootstrap });
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
          // navigator.onLine can be true while network still fails — one short retry then unavailable.
          if (!offline && bootstrapRetryRef.current < 1 && status >= 500) {
            bootstrapRetryRef.current += 1;
            window.setTimeout(() => runBootstrap("explicit"), 400);
            return;
          }
          bootstrapRetryRef.current = 0;
          dispatch({
            type: "bootstrap_failed",
            sequence,
            runtime: mapShellBootstrapHttpFailure({ status, errorCode, offline }),
            error: errorCode,
          });
        });
    },
    [fallbackAiChatEnabled, fallbackDisplayName, fallbackUiLanguage, mode, shellDestination, urlState.clientId],
  );

  useEffect(() => {
    bootstrapRefreshRef.current = () => runBootstrap("explicit");
  }, [runBootstrap]);

  useEffect(() => {
    preferenceRevisionRef.current = state.bootstrap?.preferences.revision ?? null;
  }, [state.bootstrap?.preferences.revision]);

  const searchKey = searchParams.toString();

  useEffect(() => {
    currentBrowserHrefRef.current = `${pathname}${searchKey ? `?${searchKey}` : ""}`;
  }, [pathname, searchKey]);

  useEffect(() => {
    runBootstrap("route");
    return () => {
      abortRef.current?.abort();
    };
  }, [pathname, searchKey, runBootstrap]);

  const touchSessionActivity = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (state.runtime === "offline" || state.runtime === "session_locked") return;
    if (!activityPendingRef.current) return;

    const now = Date.now();
    if (now - lastActivitySentAtRef.current < SHELL_ACTIVITY_MIN_INTERVAL_MS) return;

    activityPendingRef.current = false;
    lastActivitySentAtRef.current = now;

    try {
      const response = await fetch("/api/session/activity", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          [SIRIUSAI_CLIENT_VERSION_HEADER]: getClientBuildVersion(),
          [SIRIUSAI_MUTATION_KIND_HEADER]: "other",
        },
        body: "{}",
      });
      if (response.status === 401) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (payload?.error === "session_inactive") {
          shellDestinationViewStateRegistry.clear();
          dispatch({ type: "session_locked", error: "session_inactive" });
        }
      }
    } catch {
      // Heartbeat failures do not surface stale clinical data.
    }
  }, [state.runtime]);
  const markActivity = useCallback(() => {
    activityPendingRef.current = true;
    void touchSessionActivity();
  }, [touchSessionActivity]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Bootstrap/session validation before heartbeat.
      runBootstrap("foreground");
      window.setTimeout(() => {
        void touchSessionActivity();
      }, 0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runBootstrap, touchSessionActivity]);

  useEffect(() => {
    const onOffline = () => {
      shellDestinationViewStateRegistry.clear();
      abortRef.current?.abort();
      dispatch({ type: "go_offline" });
    };

    const onOnline = () => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      // Reconnect lands on safe home first; prior client workflow is not auto-opened.
      router.replace(buildShellReconnectHomeHref());
      window.setTimeout(() => {
        runBootstrap("explicit");
        reconnectingRef.current = false;
      }, 0);
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onOffline();
    }

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [router, runBootstrap]);

  useEffect(() => {
    const onPointer = () => markActivity();
    const onKey = () => markActivity();
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [markActivity]);

  useEffect(() => {
    // Successful shell navigation counts as activity.
    markActivity();
  }, [pathname, searchKey, markActivity]);

  useEffect(() => {
    const gate = resolveShellMutationUpdateGate({
      updateRequired: state.updateRequired || state.runtime === "update_required",
      optionalUpdateWaiting: state.updateWaiting,
    });
    setShellMutationUpdateGate(gate);
    markShellReloadRequiredAfterSuccessfulSave(gate === "save_only");
  }, [state.runtime, state.updateRequired, state.updateWaiting]);

  useEffect(() => {
    if (mode === "fallback" || !registerServiceWorker) return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const trackWorker = (worker: ServiceWorker | null) => {
      if (!worker || worker.state === "activated") return;
      waitingWorkerRef.current = worker;
      dispatch({ type: "set_update_waiting", waiting: true });
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = worker;
          dispatch({ type: "set_update_waiting", waiting: true });
        }
      });
    };

    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        trackWorker(reg.waiting);
        reg.addEventListener("updatefound", () => {
          trackWorker(reg.installing);
        });
      })
      .catch(() => undefined);

    const onControllerChange = () => {
      shellDestinationViewStateRegistry.clear();
      runBootstrap("explicit");
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      void registration;
    };
  }, [mode, registerServiceWorker, runBootstrap]);

  useEffect(() => {
    if (mode === "fallback") return;
    let cancelled = false;
    const clientVersion = resolveClientBuildVersion();
    void fetch(`/api/shell/version?clientVersion=${encodeURIComponent(clientVersion)}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Cache-Control": "no-store" },
    })
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as ShellVersionDto;
        if (payload.updateRequired) {
          dispatch({ type: "set_update_required", required: true });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    const focus = searchParams.get("focus") === "1";
    dispatch({ type: "set_focus_mode", focusMode: focus && shellDestination === "ai_chat" });
  }, [searchKey, searchParams, shellDestination]);

  const setHeaderSlots = useCallback((slots: ShellHeaderSlots) => {
    setHeaderSlotsState(slots);
  }, []);

  useEffect(() => shellDirtyRegistry.subscribe(() => setDirtySnapshot(shellDirtyRegistry.snapshot())), []);

  useEffect(() => {
    if (!state.bootstrap?.warnings.includes("client_context_unavailable")) return;
    shellDestinationViewStateRegistry.clear();
    void preferenceCoordinatorRef.current?.update({ activeClientId: null }).then((preferences) => {
      if (preferences) preferenceRevisionRef.current = preferences.revision;
    });
    if (urlState.clientId || urlState.conversationId || urlState.messageId) {
      router.replace(buildShellHref("home"));
    }
  }, [
    router,
    state.bootstrap?.warnings,
    urlState.clientId,
    urlState.conversationId,
    urlState.messageId,
  ]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const snap = shellDirtyRegistry.snapshot();
      if (!snap.isDirty && !snap.isSaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const canNavigateAway = useCallback(() => {
    const snap = shellDirtyRegistry.snapshot();
    return !snap.isDirty && !snap.isSaving && !snap.hasError;
  }, []);

  const setNavigationDirty = useCallback((dirty: boolean) => {
    if (dirty) {
      shellDirtyRegistry.register({
        id: "shell-test-dirty",
        label: "Kaydedilmemiş çalışma",
        state: "dirty",
        canSave: false,
      });
      return;
    }
    shellDirtyRegistry.unregister("shell-test-dirty");
  }, []);

  const requestDirtyNavigationConfirm = useCallback((client: ActiveClientSelection) => {
    return buildShellClientSwitchConfirmMessage(client);
  }, []);

  const runPendingNavigation = useCallback(
    async (pending: PendingNavigation) => {
      switch (pending.kind) {
        case "destination": {
          const safe = sanitizeShellDestination(pending.destination);
          const enabled = state.bootstrap?.navigation.find((item) => item.id === safe)?.enabled;
          if (state.bootstrap && enabled === false) return;
          const href = buildShellHref(safe, {
            current: urlState,
            clientId: shellDestinationAcceptsClientId(safe) ? effectiveActiveClientId : null,
            focusMode: false,
          });
          router.push(href);
          void preferenceCoordinatorRef.current?.update({ lastDestinationId: safe }).then((preferences) => {
            if (preferences) preferenceRevisionRef.current = preferences.revision;
          });
          markActivity();
          return;
        }
        case "href":
          router.push(pending.href);
          return;
        case "logout": {
          const form = document.createElement("form");
          form.method = "post";
          form.action = "/api/demo-logout";
          document.body.appendChild(form);
          form.submit();
          return;
        }
        case "focus": {
          if (shellDestination !== "ai_chat") return;
          const href = buildShellHref("ai_chat", {
            chatId: extractAiChatId(pathname),
            focusMode: pending.next,
          });
          router.push(href);
          return;
        }
        case "client-switch":
          await pending.proceed();
          return;
        case "clear-client": {
          const preferences = await preferenceCoordinatorRef.current?.update({ activeClientId: null });
          if (!preferences) return;
          preferenceRevisionRef.current = preferences.revision;
          const href = buildShellHref(shellDestination, {
            current: urlState,
            clientId: null,
            chatId: extractAiChatId(pathname),
            focusMode: state.focusMode,
          });
          router.replace(href);
          window.setTimeout(() => runBootstrap("explicit"), 0);
          return;
        }
        case "sw-update": {
          const worker = waitingWorkerRef.current;
          if (!worker) return;
          worker.postMessage({ type: SHELL_SW_SKIP_WAITING_MESSAGE });
          return;
        }
        default:
          return;
      }
    },
    [effectiveActiveClientId, markActivity, pathname, router, runBootstrap, shellDestination, state.bootstrap, state.focusMode, urlState],
  );

  const openDirtyConfirm = useCallback((pending: PendingNavigation) => {
    if (shellDirtyRegistry.snapshot().isSaving) return;
    setPendingNavigation(pending);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextHref = `${window.location.pathname}${window.location.search}`;
      if (canNavigateAway()) {
        currentBrowserHrefRef.current = nextHref;
        return;
      }
      const currentHref = currentBrowserHrefRef.current || nextHref;
      window.history.pushState(null, "", currentHref);
      openDirtyConfirm({ kind: "href", href: nextHref });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [canNavigateAway, openDirtyConfirm]);

  const selectActiveClient = useCallback(
    async (client: ActiveClientSelection) => {
      const bootstrap = state.bootstrap;
      if (!bootstrap) return false;

      const proceed = async () => {
        const previousClientId = bootstrap.activeClient?.id ?? bootstrap.preferences.activeClientId;
        const previousHref = buildShellHref(shellDestination, {
          current: urlState,
          clientId: shellDestinationAcceptsClientId(shellDestination) ? previousClientId : null,
          chatId: extractAiChatId(pathname),
          focusMode: state.focusMode,
        });

        try {
          const preferences = await preferenceCoordinatorRef.current?.update({
            activeClientId: client.id,
          });
          if (!preferences || typeof preferences.revision !== "number") {
            return false;
          }
          preferenceRevisionRef.current = preferences.revision;

          const nextHref = buildShellHref(shellDestination, {
            current: urlState,
            clientId: shellDestinationAcceptsClientId(shellDestination) ? client.id : null,
            chatId: extractAiChatId(pathname),
            focusMode: state.focusMode,
          });

          if (nextHref === previousHref && shellDestinationAcceptsClientId(shellDestination) === false) {
            runBootstrap("explicit");
            return true;
          }

          router.push(nextHref);
          return true;
        } catch {
          return false;
        }
      };

      if (!canNavigateAway()) {
        openDirtyConfirm({ kind: "client-switch", client, proceed });
        return false;
      }

      return proceed();
    },
    [
      canNavigateAway,
      openDirtyConfirm,
      pathname,
      router,
      runBootstrap,
      shellDestination,
      state.bootstrap,
      state.focusMode,
      urlState,
    ],
  );

  const clearActiveClient = useCallback(async () => {
    if (shellDirtyRegistry.snapshot().isSaving) return false;
    if (!canNavigateAway()) {
      openDirtyConfirm({ kind: "clear-client" });
      return false;
    }
    await runPendingNavigation({ kind: "clear-client" });
    return true;
  }, [canNavigateAway, openDirtyConfirm, runPendingNavigation]);

  const navigateToDestination = useCallback(
    (destination: ShellDestinationId) => {
      if (shellDirtyRegistry.snapshot().isSaving) return;
      if (!canNavigateAway()) {
        openDirtyConfirm({ kind: "destination", destination });
        return;
      }
      void runPendingNavigation({ kind: "destination", destination });
    },
    [canNavigateAway, openDirtyConfirm, runPendingNavigation],
  );

  const navigateToSection = useCallback(
    (section: DashboardSection) => {
      navigateToDestination(dashboardSectionToShellDestination(section));
    },
    [navigateToDestination],
  );

  const requestHrefNavigation = useCallback(
    (href: string) => {
      if (shellDirtyRegistry.snapshot().isSaving) return;
      if (!canNavigateAway()) {
        openDirtyConfirm({ kind: "href", href });
        return;
      }
      void runPendingNavigation({ kind: "href", href });
    },
    [canNavigateAway, openDirtyConfirm, runPendingNavigation],
  );

  const setFocusMode = useCallback(
    (next: boolean) => {
      if (shellDestination !== "ai_chat") return;
      if (!canNavigateAway()) {
        openDirtyConfirm({ kind: "focus", next });
        return;
      }
      void runPendingNavigation({ kind: "focus", next });
    },
    [canNavigateAway, openDirtyConfirm, runPendingNavigation, shellDestination],
  );

  const saveDestinationViewState = useCallback(
    (destinationId: ShellDestinationId, snapshot: ShellDestinationViewSnapshot) => {
      shellDestinationViewStateRegistry.save(destinationId, snapshot);
    },
    [],
  );

  const restoreDestinationViewState = useCallback((destinationId: ShellDestinationId) => {
    return shellDestinationViewStateRegistry.restore(destinationId);
  }, []);

  const applyWaitingServiceWorkerUpdate = useCallback(() => {
    if (
      shouldBlockOptionalPwaReload({
        dirty: !canNavigateAway(),
        updateRequired: state.updateRequired || state.runtime === "update_required",
      })
    ) {
      openDirtyConfirm({ kind: "sw-update" });
      return;
    }
    void runPendingNavigation({ kind: "sw-update" });
  }, [canNavigateAway, openDirtyConfirm, runPendingNavigation, state.runtime, state.updateRequired]);

  const dismissOptionalUpdate = useCallback(() => {
    if (state.updateRequired || state.runtime === "update_required") return;
    dispatch({ type: "set_update_waiting", waiting: false });
  }, [state.runtime, state.updateRequired]);

  const requestLogout = useCallback(() => {
    if (shellDirtyRegistry.snapshot().isSaving) return;
    if (!canNavigateAway()) {
      openDirtyConfirm({ kind: "logout" });
      return;
    }
    void runPendingNavigation({ kind: "logout" });
  }, [canNavigateAway, openDirtyConfirm, runPendingNavigation]);

  const resolveDirtyConfirm = useCallback(
    async (action: "stay" | "discard" | "save") => {
      if (!pendingNavigation) return;
      if (action === "stay") {
        setPendingNavigation(null);
        return;
      }
      if (action === "discard") {
        shellDirtyRegistry.discardAll();
        const pending = pendingNavigation;
        setPendingNavigation(null);
        await runPendingNavigation(pending);
        return;
      }
      setConfirmBusy(true);
      const result = await shellDirtyRegistry.saveAll();
      setConfirmBusy(false);
      if (!result.ok) {
        return;
      }
      const pending = pendingNavigation;
      setPendingNavigation(null);
      await runPendingNavigation(pending);
    },
    [pendingNavigation, runPendingNavigation],
  );

  const uiLanguage = normalizeLanguageCode(
    state.bootstrap?.uiLanguage ?? fallbackUiLanguage ?? "tr",
  );

  const contextualBootstrap = useMemo(() => {
    if (!state.bootstrap) return null;
    if (shellDestination !== "ai_chat") return state.bootstrap;
    return { ...state.bootstrap, activeClient: null };
  }, [shellDestination, state.bootstrap]);

  const value = useMemo<ShellProviderContextValue>(
    () => ({
      state,
      runtime: state.runtime,
      bootstrap: contextualBootstrap,
      focusMode: state.focusMode,
      activeDestination,
      shellDestination,
      uiLanguage,
      headerSlots,
      setHeaderSlots,
      refreshBootstrap: () => runBootstrap("explicit"),
      navigateToDestination,
      navigateToSection,
      requestHrefNavigation,
      setFocusMode,
      canNavigateAway,
      setNavigationDirty,
      selectActiveClient,
      clearActiveClient,
      requestDirtyNavigationConfirm,
      effectiveActiveClientId: shellDestination === "ai_chat" ? null : effectiveActiveClientId,
      showActiveClientControl,
      saveDestinationViewState,
      restoreDestinationViewState,
      updateWaiting: state.updateWaiting,
      updateRequired: state.updateRequired || state.runtime === "update_required",
      applyWaitingServiceWorkerUpdate,
      dismissOptionalUpdate,
      requestLogout,
      dirtySnapshot,
      scopedAiChatClient,
      setScopedAiChatClient,
      hideCompactNavigation: hideCompactNavigation || state.focusMode,
      setHideCompactNavigation,
    }),
    [
      activeDestination,
      applyWaitingServiceWorkerUpdate,
      canNavigateAway,
      clearActiveClient,
      contextualBootstrap,
      dirtySnapshot,
      dismissOptionalUpdate,
      effectiveActiveClientId,
      headerSlots,
      hideCompactNavigation,
      navigateToDestination,
      navigateToSection,
      requestHrefNavigation,
      requestDirtyNavigationConfirm,
      requestLogout,
      restoreDestinationViewState,
      runBootstrap,
      saveDestinationViewState,
      scopedAiChatClient,
      selectActiveClient,
      setFocusMode,
      setHeaderSlots,
      setNavigationDirty,
      shellDestination,
      showActiveClientControl,
      state,
      uiLanguage,
    ],
  );

  const canSaveAndContinue =
    dirtySnapshot.entries
      .filter((entry) => entry.state === "dirty" || entry.state === "error")
      .every((entry) => entry.canSave && Boolean(entry.save)) &&
    dirtySnapshot.entries.some((entry) => entry.state === "dirty" || entry.state === "error");

  return (
    <ShellProviderContext.Provider value={value}>
      <ShellWebVitalsReporter />
      {children}
      {pendingNavigation ? (
        <ShellDirtyNavigationDialog
          busy={confirmBusy || dirtySnapshot.isSaving}
          uiLanguage={uiLanguage}
          request={{
            snapshot: dirtySnapshot,
            canSaveAndContinue,
            onStay: () => void resolveDirtyConfirm("stay"),
            onDiscard: () => void resolveDirtyConfirm("discard"),
            onSaveAndContinue: canSaveAndContinue
              ? () => void resolveDirtyConfirm("save")
              : undefined,
            onFocusError: dirtySnapshot.hasError
              ? () => {
                  const errored = dirtySnapshot.entries.find((entry) => entry.state === "error");
                  errored?.focus?.();
                  setPendingNavigation(null);
                }
              : undefined,
          }}
        />
      ) : null}
    </ShellProviderContext.Provider>
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
