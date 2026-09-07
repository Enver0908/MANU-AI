/**
 * Client-side authenticated mutation helper for Stage 5 Faz 7.
 * Attaches build version and enforces required-update mutation gates.
 */

import { AppRequestError } from "./app-errors";
import {
  isShellMutationAllowed,
  resolveClientBuildVersion,
  SIRIUSAI_CLIENT_VERSION_HEADER,
  SIRIUSAI_MUTATION_KIND_HEADER,
  type ShellMutationKind,
  type ShellMutationUpdateGate,
} from "./phase-85-stage-5-shell-pwa";

let mutationGate: ShellMutationUpdateGate = "open";
let pendingReloadAfterSave = false;

export function setShellMutationUpdateGate(gate: ShellMutationUpdateGate) {
  mutationGate = gate;
}

export function getShellMutationUpdateGate() {
  return mutationGate;
}

export function markShellReloadRequiredAfterSuccessfulSave(required: boolean) {
  pendingReloadAfterSave = required;
}

export function consumeShellReloadRequiredAfterSuccessfulSave() {
  const value = pendingReloadAfterSave;
  pendingReloadAfterSave = false;
  return value;
}

export function getClientBuildVersion() {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="siriusai-app-version"]');
    const content = meta?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return resolveClientBuildVersion();
}

export function buildAuthenticatedMutationHeaders(
  initHeaders?: HeadersInit,
  options?: { mutationKind?: ShellMutationKind },
): Headers {
  const kind = options?.mutationKind ?? "other";
  if (!isShellMutationAllowed(mutationGate, kind)) {
    throw new AppRequestError(409, "client_update_required");
  }

  const headers = new Headers(initHeaders);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set(SIRIUSAI_CLIENT_VERSION_HEADER, getClientBuildVersion());
  headers.set(SIRIUSAI_MUTATION_KIND_HEADER, kind);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export async function authenticatedMutationFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { mutationKind?: ShellMutationKind },
) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AppRequestError(0, "offline_mutation_rejected");
  }

  const { mutationKind, ...requestInit } = init ?? {};
  const headers = buildAuthenticatedMutationHeaders(requestInit.headers, {
    mutationKind: mutationKind ?? "other",
  });
  if (requestInit.body instanceof FormData && !new Headers(requestInit.headers).has("content-type")) {
    headers.delete("content-type");
  }
  const response = await fetch(input, {
    ...requestInit,
    headers,
    cache: "no-store",
    credentials: requestInit.credentials ?? "same-origin",
  });

  if (
    response.ok &&
    (mutationKind ?? "other") === "save" &&
    consumeShellReloadRequiredAfterSuccessfulSave()
  ) {
    window.location.reload();
  }

  return response;
}
