import { describe, expect, it } from "vitest";
import { AppAuthError, authErrorResponse, hasCapability, requireCapability, type AppTenantContext } from "./auth-context";

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

  it("allows owner, admin, and dietitian roles to use existing production capabilities", () => {
    expect(hasCapability("owner", "anonymize_client")).toBe(true);
    expect(hasCapability("admin", "reset_app_state")).toBe(true);
    expect(hasCapability("dietitian", "draft_review")).toBe(true);
    expect(hasCapability("owner", "internal_copilot_chat")).toBe(true);
    expect(hasCapability("admin", "internal_copilot_chat")).toBe(true);
    expect(hasCapability("dietitian", "internal_copilot_chat")).toBe(true);
    expect(hasCapability("owner", "dietitian_ai_chat")).toBe(true);
    expect(hasCapability("admin", "dietitian_ai_chat")).toBe(true);
    expect(hasCapability("dietitian", "dietitian_ai_chat")).toBe(true);
  });

  it("keeps assistant and auditor roles fail-closed beyond read-only app state", () => {
    expect(hasCapability("assistant", "read_app_state")).toBe(true);
    expect(hasCapability("assistant", "manual_reply")).toBe(false);
    expect(hasCapability("assistant", "internal_copilot_chat")).toBe(false);
    expect(hasCapability("assistant", "dietitian_ai_chat")).toBe(false);
    expect(hasCapability("auditor", "read_app_state")).toBe(true);
    expect(hasCapability("auditor", "export_client")).toBe(false);
    expect(hasCapability("auditor", "internal_copilot_chat")).toBe(false);
    expect(hasCapability("auditor", "dietitian_ai_chat")).toBe(false);
  });

  it("requireCapability returns a controlled 403 for forbidden role actions", () => {
    const context: AppTenantContext = {
      tenantId: "tenant-demo",
      dietitianId: "dietitian-demo",
      userId: "user-demo",
      role: "assistant",
    };

    expect(() => requireCapability(context, "create_client")).toThrow(
      new AppAuthError(403, "rbac_forbidden_create_client"),
    );
  });

  it("returns the Phase 26 controlled error for blocked copilot roles", () => {
    const context: AppTenantContext = {
      tenantId: "tenant-demo",
      dietitianId: "dietitian-demo",
      userId: "user-demo",
      role: "assistant",
    };

    expect(() => requireCapability(context, "internal_copilot_chat")).toThrow(
      new AppAuthError(403, "internal_copilot_forbidden"),
    );
  });

  it("returns the Stage 4C controlled error for blocked AI chat roles", () => {
    const context: AppTenantContext = {
      tenantId: "tenant-demo",
      dietitianId: "dietitian-demo",
      userId: "user-demo",
      role: "assistant",
    };

    expect(() => requireCapability(context, "dietitian_ai_chat")).toThrow(
      new AppAuthError(403, "dietitian_ai_chat_forbidden"),
    );
  });

  it("allows all active tenant roles to update their own profile only", () => {
    for (const role of ["owner", "admin", "dietitian", "assistant", "auditor"] as const) {
      expect(hasCapability(role, "update_own_profile")).toBe(true);
    }
    expect(hasCapability("assistant", "update_client")).toBe(false);
    expect(hasCapability("auditor", "manual_reply")).toBe(false);
  });
});
