"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppRequestError } from "./app-errors";
import { authenticatedMutationFetch } from "./phase-85-stage-5-shell-authenticated-mutation";
import { recordPhase55ClientEvent } from "./phase-55-polling-diagnostic";
import type { ClientFoodRuleProfileV2State } from "./phase-77e-client-food-rule-profile";
import type {
  ClientScopedMutationResponse,
  Stage6ContextUpdatePage,
  Stage6FormRead,
  Stage6MenuPlanPage,
  Stage6WorkspaceSummary,
} from "./phase-85-stage-6-dashboard-contracts";
import {
  buildStage6WorkspaceOwnerKey,
  isStage6RevisionConflict,
} from "./phase-85-stage-6-workspace-state";

export type Stage6WorkspaceRequestStatus = "idle" | "loading" | "success" | "empty" | "error" | "conflict";

export type Stage6WorkspaceDomain = "summary" | "forms" | "nutrition" | "menu" | "context" | "ai";

export type Stage6NutritionRead = {
  clientId: string;
  profile: ClientFoodRuleProfileV2State | null;
  revision: number;
};

export function isStage6EmptyNutritionResponse(
  domain: Stage6WorkspaceDomain,
  status: number,
  code: unknown,
) {
  return domain === "nutrition" && status === 404 && code === "client_food_rule_profile_not_found";
}

function domainPath(clientId: string, domain: Stage6WorkspaceDomain) {
  switch (domain) {
    case "forms":
      return `/api/clients/${clientId}/forms`;
    case "nutrition":
      return `/api/clients/${clientId}/food-rule-profile`;
    case "menu":
      return `/api/clients/${clientId}/menu-plans`;
    case "context":
      return `/api/clients/${clientId}/context-updates`;
    case "summary":
    case "ai":
    default:
      return `/api/clients/${clientId}`;
  }
}

function stage6DiagnosticRouteState() {
  if (typeof window === "undefined") {
    return {
      routePathname: null,
      routeSection: null,
      routeClientTask: null,
      routeHasClientId: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    routePathname: window.location.pathname,
    routeSection: params.get("section"),
    routeClientTask: params.get("clientTask") ?? params.get("tab"),
    routeHasClientId: params.has("clientId"),
  };
}

export function useStage6ClientWorkspace(options: {
  tenantId: string | null;
  clientId: string | null;
  domain: Stage6WorkspaceDomain;
  enabled?: boolean;
}) {
  const enabled = options.enabled !== false;
  const ownerKey = buildStage6WorkspaceOwnerKey(options.tenantId, options.clientId, options.domain);
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Stage6WorkspaceRequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stateOwnerKey, setStateOwnerKey] = useState(ownerKey);
  const [summary, setSummary] = useState<Stage6WorkspaceSummary | null>(null);
  const [forms, setForms] = useState<Stage6FormRead | null>(null);
  const [nutrition, setNutrition] = useState<Stage6NutritionRead | null>(null);
  const [menu, setMenu] = useState<Stage6MenuPlanPage | null>(null);
  const [context, setContext] = useState<Stage6ContextUpdatePage | null>(null);

  const resetDomainState = () => {
    setSummary(null);
    setForms(null);
    setNutrition(null);
    setMenu(null);
    setContext(null);
  };

  const load = useCallback(async () => {
    if (!enabled || !options.clientId) {
      setStateOwnerKey(ownerKey);
      setStatus("idle");
      setError(null);
      resetDomainState();
      return;
    }
    recordPhase55ClientEvent("stage6_workspace_load_abort_previous", {
      ...stage6DiagnosticRouteState(),
      domain: options.domain,
      hasPreviousController: abortRef.current != null,
      previousSequence: sequenceRef.current,
    });
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++sequenceRef.current;
    const key = ownerKey;
    recordPhase55ClientEvent("stage6_workspace_load_started", {
      ...stage6DiagnosticRouteState(),
      domain: options.domain,
      sequence,
    });
    setStateOwnerKey(key);
    resetDomainState();
    setStatus("loading");
    setError(null);
    try {
      const path = domainPath(options.clientId, options.domain);
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = body.error || `request_failed_${response.status}`;
        if (isStage6EmptyNutritionResponse(options.domain, response.status, code)) {
          if (sequence !== sequenceRef.current) return;
          setNutrition({ clientId: options.clientId, profile: null, revision: 0 });
          setError(null);
          setStatus("empty");
          return;
        }
        throw new AppRequestError(response.status, code);
      }
      const payload = await response.json();
      if (sequence !== sequenceRef.current) return;
      recordPhase55ClientEvent("stage6_workspace_load_succeeded", {
        ...stage6DiagnosticRouteState(),
        domain: options.domain,
        sequence,
        payloadPresent: payload != null,
      });
      if (options.domain === "forms") {
        setForms(payload as Stage6FormRead);
        setStatus((payload as Stage6FormRead).schema ? "success" : "empty");
        return;
      }
      if (options.domain === "nutrition") {
        setNutrition(payload as Stage6NutritionRead);
        setStatus((payload as Stage6NutritionRead).profile ? "success" : "empty");
        return;
      }
      if (options.domain === "menu") {
        setMenu(payload as Stage6MenuPlanPage);
        setStatus((payload as Stage6MenuPlanPage).plans?.length ? "success" : "empty");
        return;
      }
      if (options.domain === "context") {
        setContext(payload as Stage6ContextUpdatePage);
        setStatus("success");
        return;
      }
      setSummary(payload as Stage6WorkspaceSummary);
      setStatus(payload ? "success" : "empty");
    } catch (caught) {
      if (controller.signal.aborted) {
        recordPhase55ClientEvent("stage6_workspace_load_aborted", {
          ...stage6DiagnosticRouteState(),
          domain: options.domain,
          sequence,
        });
        return;
      }
      if (sequence !== sequenceRef.current) return;
      const code =
        caught instanceof AppRequestError
          ? caught.code
          : typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "request_failed";
      setError(code);
      setStatus(isStage6RevisionConflict(caught) ? "conflict" : "error");
      recordPhase55ClientEvent("stage6_workspace_load_failed", {
        ...stage6DiagnosticRouteState(),
        domain: options.domain,
        sequence,
        code,
      });
    }
  }, [enabled, options.clientId, options.domain, ownerKey]);

  useEffect(() => {
    recordPhase55ClientEvent("stage6_workspace_effect_setup", {
      ...stage6DiagnosticRouteState(),
      domain: options.domain,
      enabled,
      hasClientId: options.clientId != null,
    });
    void load();
    const cleanupSequence = sequenceRef.current;
    return () => {
      recordPhase55ClientEvent("stage6_workspace_effect_cleanup", {
        ...stage6DiagnosticRouteState(),
        domain: options.domain,
        sequence: cleanupSequence,
      });
      abortRef.current?.abort();
    };
  }, [enabled, load, options.clientId, options.domain, ownerKey]);

  const mutate = useCallback(
    async (url: string, init: RequestInit) => {
      if (!options.clientId) throw new AppRequestError(400, "client_id_required");
      const sequence = ++sequenceRef.current;
      const key = ownerKey;
      try {
        const response = await authenticatedMutationFetch(url, { ...init, mutationKind: "save" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new AppRequestError(response.status, body.error || `request_failed_${response.status}`);
        }
        const payload = (await response.json()) as ClientScopedMutationResponse<unknown>;
        if (sequence !== sequenceRef.current || payload.clientId !== options.clientId || key !== ownerKey) {
          return payload;
        }
        setError(null);
        setStatus("success");
        return payload;
      } catch (caught) {
        if (sequence === sequenceRef.current && key === ownerKey) {
          const code =
            caught instanceof AppRequestError
              ? caught.code
              : typeof navigator !== "undefined" && navigator.onLine === false
                ? "offline"
                : "request_failed";
          setError(code);
          setStatus(isStage6RevisionConflict(caught) ? "conflict" : "error");
        }
        throw caught;
      }
    },
    [options.clientId, ownerKey],
  );

  const ownsVisibleState = stateOwnerKey === ownerKey;
  return {
    status: ownsVisibleState ? status : "loading",
    error: ownsVisibleState ? error : null,
    summary: ownsVisibleState ? summary : null,
    forms: ownsVisibleState ? forms : null,
    nutrition: ownsVisibleState ? nutrition : null,
    menu: ownsVisibleState ? menu : null,
    context: ownsVisibleState ? context : null,
    reload: load,
    mutate,
    ownerKey,
  };
}
