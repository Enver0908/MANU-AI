import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createMutableSupabaseServerClient: vi.fn(),
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
  resolveAuthRouteIpKey: vi.fn(() => "ip:admin"),
  createMutableSupabaseServerClient: mocks.createMutableSupabaseServerClient,
}));

function request(body: unknown) {
  return new NextRequest("https://admin.aiyaworkspace.com/api/admin/auth/password-login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("admin password-login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MANU_ADMIN_EMAIL_ALLOWLIST", "olkuenver@gmail.com,contact@aiyaworkspace.com");
    mocks.getSupabaseConfig.mockReturnValue({
      url: "https://project.supabase.co",
      anonKey: "anon",
    });
    mocks.assertRateLimit.mockResolvedValue(undefined);
    mocks.insertAccountSecurityEvent.mockResolvedValue({ persisted: true });
    mocks.createMutableSupabaseServerClient.mockResolvedValue({
      supabase: {
        auth: {
          setSession: vi.fn(async () => ({ error: null })),
        },
      },
      applyAuthMutations: (response: Response) => response,
    });
  });

  it("authenticates an allowlisted admin with password and returns /admin", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            session: { access_token: "access", refresh_token: "refresh" },
            user: { id: "admin-user-1" },
          },
          error: null,
        })),
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      request({ email: " OlkuEnver@gmail.com ", password: "Aa1!abcdefgh" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: true, next: "/admin" });
    expect(JSON.stringify(body)).not.toMatch(/Aa1!abcdefgh|password/i);
  });

  it("blocks non-allowlisted emails before password authentication", async () => {
    const signInWithPassword = vi.fn();
    mocks.createClient.mockReturnValue({
      auth: { signInWithPassword },
    });

    const { POST } = await import("./route");
    const response = await POST(
      request({ email: "other@example.com", password: "Aa1!abcdefgh" }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("admin_access_denied");
    expect(body.blockingReasons).toContain("admin_email_not_allowlisted");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("keeps invalid password responses generic for allowlisted admins", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials" },
        })),
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      request({ email: "contact@aiyaworkspace.com", password: "WrongPass!1234" }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "invalid_credentials" });
    expect(JSON.stringify(body)).not.toContain("WrongPass!1234");
  });
});
