import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseConfig: vi.fn(),
  assertRateLimit: vi.fn(),
  insertAccountSecurityEvent: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseConfig: mocks.getSupabaseConfig,
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: mocks.assertRateLimit,
}));

vi.mock("@/lib/account-security-store", () => ({
  insertAccountSecurityEvent: mocks.insertAccountSecurityEvent,
}));

vi.mock("@/lib/phase-85-stage-4d-auth-server", () => ({
  resolveAuthRouteIpKey: vi.fn(() => "ip:admin-reset"),
}));

function request(body: unknown) {
  return new NextRequest("https://admin.aiyaworkspace.com/api/admin/auth/password-reset", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("admin password-reset route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MANU_ADMIN_EMAIL_ALLOWLIST", "olkuenver@gmail.com,contact@aiyaworkspace.com");
    mocks.getSupabaseConfig.mockReturnValue({
      url: "https://project.supabase.co",
      anonKey: "anon",
    });
    mocks.assertRateLimit.mockResolvedValue(undefined);
    mocks.insertAccountSecurityEvent.mockResolvedValue({ persisted: true });
  });

  it("accepts password reset for allowlisted admins", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    mocks.createClient.mockReturnValue({
      auth: { resetPasswordForEmail },
    });

    const { POST } = await import("./route");
    const response = await POST(request({ email: "contact@aiyaworkspace.com" }));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.accepted).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "contact@aiyaworkspace.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") }),
    );
  });

  it("blocks non-allowlisted emails before sending reset email", async () => {
    const resetPasswordForEmail = vi.fn();
    mocks.createClient.mockReturnValue({
      auth: { resetPasswordForEmail },
    });

    const { POST } = await import("./route");
    const response = await POST(request({ email: "other@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("admin_access_denied");
    expect(body.blockingReasons).toContain("admin_email_not_allowlisted");
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
