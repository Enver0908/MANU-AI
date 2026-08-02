import { NextResponse } from "next/server";
import { AppAuthError } from "./auth-context";
import { AppDomainError } from "./app-errors";
import {
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

  throw error;
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
