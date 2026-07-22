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

export function domainErrorResponse(error: unknown) {
  if (error instanceof AppDomainError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
