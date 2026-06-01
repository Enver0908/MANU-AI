export class AppDomainError extends Error {
  status: 400 | 404 | 409 | 429;

  constructor(status: 400 | 404 | 409 | 429, message: string) {
    super(message);
    this.name = "AppDomainError";
    this.status = status;
  }
}

export function domainErrorResponse(error: unknown) {
  if (error instanceof AppDomainError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
