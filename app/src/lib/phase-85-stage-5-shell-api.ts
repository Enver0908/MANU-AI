import { NextResponse } from "next/server";
import { AppAuthError } from "./auth-context";
import { AppDomainError } from "./app-errors";
import {
  SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES,
  ShellApiError,
  type ShellSessionActivityDto,
} from "./phase-85-stage-5-shell-contracts";

export const SHELL_API_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export function shellJsonResponse<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: SHELL_API_NO_STORE_HEADERS,
  });
}

export function shellErrorResponse(error: unknown) {
  if (error instanceof ShellApiError) {
    return shellJsonResponse({ error: error.message }, error.status);
  }

  if (error instanceof AppAuthError) {
    return shellJsonResponse({ error: error.message }, error.status);
  }

  if (error instanceof AppDomainError) {
    return shellJsonResponse({ error: error.message }, error.status);
  }

  const requestId = crypto.randomUUID();
  console.error("stage5_shell_api_unhandled_error", { requestId, error });
  return shellJsonResponse({ error: "shell_service_unavailable", requestId }, 503);
}

export function shellBoundedJsonResponse<T>(body: T, options?: { maxBytes?: number }) {
  const maxBytes = options?.maxBytes ?? SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES;
  const payloadBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (payloadBytes > maxBytes) {
    return shellJsonResponse({ error: "shell_bootstrap_oversize" }, 503);
  }
  return shellJsonResponse(body);
}

export function toShellSessionActivityDto(input: {
  sessionId: string;
  locked: boolean;
  lastInteractiveAt: string;
  touched?: boolean;
}): ShellSessionActivityDto {
  return {
    contractVersion: "p85-stage-5-shell-session-v1",
    sessionId: input.sessionId,
    locked: input.locked,
    lastInteractiveAt: input.lastInteractiveAt,
    touched: input.touched,
  };
}
