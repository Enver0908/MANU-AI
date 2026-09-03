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
  resolveAuthRouteIpKey: vi.fn(() => "ip:test"),
  createMutableSupabaseServerClient: mocks.createMutableSupabaseServerClient,
}));

function request(body: unknown) {
  return new NextRequest("https://aiyaworkbase.com/api/auth/password-login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("password-login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("authenticates a known user with the correct password", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            session: { access_token: "access", refresh_token: "refresh" },
            user: { id: "user-1" },
          },
          error: null,
        })),
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      request({ email: "owner@example.com", password: "Aa1!abcdefgh", next: "/dashboard" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.next).toBe("/dashboard");
    expect(JSON.stringify(body)).not.toMatch(/Aa1!abcdefgh|password/i);
  });

  it("returns the same invalid_credentials error for a wrong password and an unknown user", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials" },
        })),
      },
    });

    const { POST } = await import("./route");
    const wrongPassword = await POST(
      request({ email: "owner@example.com", password: "WrongPass!1234" }),
    );
    const unknownUser = await POST(
      request({ email: "missing@example.com", password: "Aa1!abcdefgh" }),
    );
    const wrongBody = await wrongPassword.json();
    const unknownBody = await unknownUser.json();

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongBody).toEqual({ error: "invalid_credentials" });
    expect(unknownBody).toEqual({ error: "invalid_credentials" });
    expect(JSON.stringify(wrongBody)).not.toContain("WrongPass!1234");
  });

  it("accepts /app-install and rejects /install as a post-auth next path", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: {
            session: { access_token: "access", refresh_token: "refresh" },
            user: { id: "user-1" },
          },
          error: null,
        })),
      },
    });

    const { POST } = await import("./route");
    const allowed = await POST(
      request({ email: "owner@example.com", password: "Aa1!abcdefgh", next: "/app-install" }),
    );
    const rejected = await POST(
      request({ email: "owner@example.com", password: "Aa1!abcdefgh", next: "/install" }),
    );

    expect((await allowed.json()).next).toBe("/app-install");
    expect((await rejected.json()).next).toBe("/dashboard");
  });
});
