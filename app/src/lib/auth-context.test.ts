import { describe, expect, it } from "vitest";
import { AppAuthError, authErrorResponse } from "./auth-context";

describe("auth context error handling", () => {
  it("AppAuthError captures 401 status and error code", () => {
    const error = new AppAuthError(401, "unauthenticated");

    expect(error.status).toBe(401);
    expect(error.message).toBe("unauthenticated");
    expect(error.name).toBe("AppAuthError");
  });

  it("AppAuthError captures 403 status for no membership", () => {
    const error = new AppAuthError(403, "no_tenant_membership");

    expect(error.status).toBe(403);
    expect(error.message).toBe("no_tenant_membership");
  });

  it("AppAuthError captures 403 status for no dietitian profile", () => {
    const error = new AppAuthError(403, "no_dietitian_profile");

    expect(error.status).toBe(403);
    expect(error.message).toBe("no_dietitian_profile");
  });

  it("authErrorResponse returns JSON for AppAuthError with correct status", async () => {
    const error = new AppAuthError(401, "unauthenticated");
    const response = authErrorResponse(error);

    expect(response).toBeDefined();
    expect(response!.status).toBe(401);
    const body = await response!.json();
    expect(body.error).toBe("unauthenticated");
  });

  it("authErrorResponse returns JSON for 403 membership error", async () => {
    const error = new AppAuthError(403, "no_tenant_membership");
    const response = authErrorResponse(error);

    expect(response).toBeDefined();
    expect(response!.status).toBe(403);
    const body = await response!.json();
    expect(body.error).toBe("no_tenant_membership");
  });

  it("authErrorResponse re-throws non-auth errors", () => {
    const error = new Error("unexpected");

    expect(() => authErrorResponse(error)).toThrow("unexpected");
  });
});
