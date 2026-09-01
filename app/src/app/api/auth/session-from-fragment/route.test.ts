import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

function request(body: unknown) {
  return new NextRequest("https://aiyaworkspace.com/api/auth/session-from-fragment", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("session-from-fragment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
  });

  it("sets Supabase session cookies from fragment tokens", async () => {
    mocks.createSupabaseServerClient.mockImplementation(({ setAll }) => ({
      auth: {
        setSession: vi.fn(async () => {
          setAll(
            [{ name: "sb-session", value: "token", options: { path: "/", httpOnly: true } }],
            { "x-supabase-auth": "fragment" },
          );
          return { error: null };
        }),
      },
    }));

    const { POST } = await import("./route");
    const response = await POST(
      request({
        accessToken: "access-token-value-long-enough",
        refreshToken: "short-ok",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: true });
    expect(response.headers.get("set-cookie")).toContain("sb-session=token");
    expect(response.headers.get("x-supabase-auth")).toBe("fragment");
  });

  it("rejects missing or short access tokens", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        accessToken: "short",
        refreshToken: "short-ok",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
