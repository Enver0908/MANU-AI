import { describe, expect, it } from "vitest";
import { AppAuthError } from "./auth-context";
import { AppDomainError } from "./app-errors";
import { shellErrorResponse, shellJsonResponse } from "./phase-85-stage-5-shell-api";
import { ShellApiError } from "./phase-85-stage-5-shell-contracts";
import { resetRateLimits } from "./rate-limit";
import {
  enforceShellBootstrapRateLimit,
  resolveShellReadAccountContext,
} from "./phase-85-stage-5-shell-route";

describe("phase-85-stage-5-shell-api", () => {
  it("returns stable shell error payloads", async () => {
    const response = shellErrorResponse(new ShellApiError(503, "shell_bootstrap_unavailable"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "shell_bootstrap_unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("maps auth and domain errors to no-store JSON responses", async () => {
    const authResponse = shellErrorResponse(new AppAuthError(403, "entitlement_inactive"));
    expect(authResponse.status).toBe(403);
    await expect(authResponse.json()).resolves.toEqual({ error: "entitlement_inactive" });

    const domainResponse = shellErrorResponse(new AppDomainError(429, "rate_limit_exceeded"));
    expect(domainResponse.status).toBe(429);
    await expect(domainResponse.json()).resolves.toEqual({ error: "rate_limit_exceeded" });
  });

  it("sets no-store headers on successful shell JSON responses", async () => {
    const response = shellJsonResponse({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("phase-85-stage-5-shell-route rate limits", () => {
  it("enforces bootstrap rate limits in memory when supabase fallback is active", async () => {
    resetRateLimits();
    const previousFallback = process.env.MANU_DEV_FALLBACK_STORE;
    process.env.MANU_DEV_FALLBACK_STORE = "true";

    try {
      await expect(
        enforceShellBootstrapRateLimit({
          tenantId: "tenant-a",
          dietitianId: "dietitian-a",
          userId: "user-a",
          role: "dietitian",
          sessionId: "00000000-0000-4000-8000-000000000010",
          supabase: {} as never,
        }),
      ).resolves.toBeUndefined();
    } finally {
      process.env.MANU_DEV_FALLBACK_STORE = previousFallback;
      resetRateLimits();
    }
  });

  it("does not expose resolveShellReadAccountContext without configured supabase store", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      await expect(resolveShellReadAccountContext()).rejects.toThrow(
        new ShellApiError(503, "shell_bootstrap_unavailable"),
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    }
  });
});
