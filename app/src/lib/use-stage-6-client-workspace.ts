"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppRequestError } from "./app-errors";
import { authenticatedMutationFetch } from "./phase-85-stage-5-shell-authenticated-mutation";
import type { ClientScopedMutationResponse, Stage6FormRead, Stage6WorkspaceSummary } from "./phase-85-stage-6-dashboard-contracts";

export type Stage6WorkspaceRequestStatus = "idle" | "loading" | "success" | "empty" | "error" | "conflict";

type DomainKey = "summary" | "forms" | "nutrition" | "menu" | "context" | "ai";

export function useStage6ClientWorkspace(options: { clientId: string | null; domain: DomainKey; enabled?: boolean }) {
  const enabled = options.enabled !== false;
  const ownerKey = `${options.clientId ?? "none"}:${options.domain}`;
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Stage6WorkspaceRequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Stage6WorkspaceSummary | null>(null);
  const [forms, setForms] = useState<Stage6FormRead | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !options.clientId) {
      setStatus("idle");
      setSummary(null);
      setForms(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++sequenceRef.current;
    const key = `${options.clientId}:${options.domain}`;
    setStatus("loading");
    setError(null);
    try {
      const path =
        options.domain === "forms"
          ? `/api/clients/${options.clientId}/forms`
          : `/api/clients/${options.clientId}`;
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new AppRequestError(response.status, body.error || `request_failed_${response.status}`);
      }
      const payload = await response.json();
      if (sequence !== sequenceRef.current || key !== `${options.clientId}:${options.domain}`) return;
      if (options.domain === "forms") {
        setForms(payload as Stage6FormRead);
        setStatus((payload as Stage6FormRead).schema ? "success" : "empty");
      } else {
        setSummary(payload as Stage6WorkspaceSummary);
        setStatus(payload ? "success" : "empty");
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (sequence !== sequenceRef.current) return;
      const code = caught instanceof AppRequestError ? caught.code : "request_failed";
      setError(code);
      setStatus(code === "revision_conflict" ? "conflict" : "error");
    }
  }, [enabled, options.clientId, options.domain]);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load, ownerKey]);

  const mutate = useCallback(
    async (url: string, init: RequestInit) => {
      if (!options.clientId) throw new AppRequestError(400, "client_id_required");
      const sequence = ++sequenceRef.current;
      const key = `${options.clientId}:${options.domain}`;
      const response = await authenticatedMutationFetch(url, { ...init, mutationKind: "save" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = body.error || `request_failed_${response.status}`;
        if (code === "revision_conflict") setStatus("conflict");
        throw new AppRequestError(response.status, code);
      }
      const payload = (await response.json()) as ClientScopedMutationResponse<unknown>;
      if (sequence !== sequenceRef.current || payload.clientId !== options.clientId || key !== `${options.clientId}:${options.domain}`) {
        return payload;
      }
      setStatus("success");
      return payload;
    },
    [options.clientId, options.domain],
  );

  return { status, error, summary, forms, reload: load, mutate, ownerKey };
}
