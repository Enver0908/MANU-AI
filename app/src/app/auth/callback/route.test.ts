import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getSupabaseConfig: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  resolveCustomerSessionFacts: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: mocks.cookieSet,
  })),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getSupabaseConfig: mocks.getSupabaseConfig,
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock("@/lib/customer-auth-session", () => ({
  resolveCustomerSessionFacts: mocks.resolveCustomerSessionFacts,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://siriusai.store";
    process.env.MANU_ADMIN_HOST = "admin.siriusai.store";
    process.env.MANU_ADMIN_APP_URL = "https://admin.siriusai.store";
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.getSupabaseConfig.mockReturnValue({
      url: "https://project.supabase.co",
      anonKey: "anon",
    });
    mocks.resolveCustomerSessionFacts.mockResolvedValue({
      isAuthenticated: true,
      normalizedEmail: "owner@example.com",
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
      hasClaimablePaidWorkspace: false,
    });
  });

  it("preserves Supabase session cookies on the final success redirect", async () => {
    mocks.createSupabaseServerClient.mockImplementation(({ setAll }) => ({
      auth: {
        exchangeCodeForSession: vi.fn(async () => {
          setAll(
            [{ name: "sb-session", value: "token", options: { path: "/", httpOnly: true } }],
            { "x-supabase-auth": "exchanged" },
          );
          return { error: null };
        }),
      },
    }));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://siriusai.store/auth/callback?code=abc"));

    expect(response.headers.get("location")).toBe("https://siriusai.store/dashboard");
    expect(response.headers.get("set-cookie")).toContain("sb-session=token");
    expect(response.headers.get("x-supabase-auth")).toBe("exchanged");
  });

  it("verifies token-hash magic links and preserves Supabase session cookies", async () => {
    mocks.createSupabaseServerClient.mockImplementation(({ setAll }) => ({
      auth: {
        exchangeCodeForSession: vi.fn(),
        verifyOtp: vi.fn(async () => {
          setAll(
            [{ name: "sb-session", value: "otp-token", options: { path: "/", httpOnly: true } }],
            { "x-supabase-auth": "verified" },
          );
          return { error: null };
        }),
      },
    }));

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "https://siriusai.store/auth/callback?token_hash=hash&type=magiclink&next=/onboarding",
      ),
    );

    expect(response.headers.get("location")).toBe("https://siriusai.store/onboarding");
    expect(response.headers.get("set-cookie")).toContain("sb-session=otp-token");
    expect(response.headers.get("x-supabase-auth")).toBe("verified");
  });

  it("rejects unsupported token-hash callback types without creating a session", async () => {
    mocks.createSupabaseServerClient.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn(),
        verifyOtp: vi.fn(),
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "https://siriusai.store/auth/callback?token_hash=hash&type=sms&next=/onboarding",
      ),
    );

    expect(response.headers.get("location")).toBe("https://siriusai.store/login?error=auth_callback_failed");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("renders a fragment-session bridge for implicit magic-link callbacks", async () => {
    mocks.createSupabaseServerClient.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn(),
        verifyOtp: vi.fn(),
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "https://siriusai.store/auth/callback?next=/onboarding%3Fsession_id%3Dcs_test_123",
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("/api/auth/session-from-fragment");
    expect(body).toContain("access_token");
    expect(body).toContain("https://siriusai.store/onboarding?session_id=cs_test_123");
  });

  it("redirects callback errors without setting a success session", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://siriusai.store/auth/callback?error=access_denied&next=/admin"),
    );

    expect(response.headers.get("location")).toBe("https://admin.siriusai.store/admin?error=auth_callback_failed");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
