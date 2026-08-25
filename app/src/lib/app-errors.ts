import { NextResponse } from "next/server";

export const API_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export const MAGIC_LINK_RETRY_AFTER_SECONDS = 60;

export class AppDomainError extends Error {
  status: 400 | 403 | 404 | 409 | 429;

  constructor(status: 400 | 403 | 404 | 409 | 429, message: string) {
    super(message);
    this.name = "AppDomainError";
    this.status = status;
  }
}

export class AppRequestError extends Error {
  status: number;
  code: string;
  field?: string;
  revision?: number;

  constructor(status: number, code: string, field?: string, revision?: number) {
    super(code);
    this.name = "AppRequestError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.revision = revision;
  }
}

export function createApiRequestId() {
  return crypto.randomUUID();
}

export function apiErrorBody(error: string, requestId = createApiRequestId()) {
  return { error, requestId };
}

export function apiErrorResponse(error: string, status: number, requestId = createApiRequestId()) {
  return NextResponse.json(apiErrorBody(error, requestId), {
    status,
    headers: API_NO_STORE_HEADERS,
  });
}

export function rateLimitErrorResponse(requestId = createApiRequestId()) {
  return NextResponse.json(apiErrorBody("rate_limit_exceeded", requestId), {
    status: 429,
    headers: {
      ...API_NO_STORE_HEADERS,
      "Retry-After": String(MAGIC_LINK_RETRY_AFTER_SECONDS),
    },
  });
}

export function domainErrorResponse(error: unknown) {
  if (error instanceof AppDomainError) {
    if (error.status === 429) {
      return rateLimitErrorResponse();
    }
    return apiErrorResponse(error.message, error.status);
  }

  throw error;
}
