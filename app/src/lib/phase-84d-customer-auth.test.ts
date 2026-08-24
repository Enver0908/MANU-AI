import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  deriveCustomerAuthRedirect,
  isTransientMagicLinkSendFailure,
  sanitizePostAuthRedirectPath,
  sendMagicLinkWithRetry,
  summarizePhase84dCustomerAuth,
  validateMagicLinkRequest,
} from "./phase-84d-customer-auth";

describe("phase 84d customer auth", () => {
  it("validates magic-link email input", () => {
    expect(validateMagicLinkRequest({ email: " User@Example.COM " }).valid).toBe(true);
    expect(validateMagicLinkRequest({ email: "bad" }).blockingReasons).toContain("email_invalid");
  });

  it("builds callback url from NEXT_PUBLIC_APP_URL", () => {
    expect(
      buildAuthCallbackUrl(undefined, { NEXT_PUBLIC_APP_URL: "https://siriusai.store/" }),
    ).toBe("https://siriusai.store/auth/callback");
    expect(
      buildAuthCallbackUrl(undefined, { NEXT_PUBLIC_APP_URL: "http://localhost:3000/" }),
    ).toBe("http://localhost:3000/auth/callback");
    expect(() =>
      buildAuthCallbackUrl(undefined, { NEXT_PUBLIC_APP_URL: "http://evil.example/" }),
    ).toThrow("unsafe_auth_redirect_base_url");
  });

  it("redirects unauthenticated users to login", () => {
    expect(
      deriveCustomerAuthRedirect({
        isAuthenticated: false,
        normalizedEmail: null,
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: null,
        hasClaimablePaidWorkspace: false,
      }),
    ).toBe("/login");
  });

  it("redirects fully provisioned customers to dashboard", () => {
    expect(
      deriveCustomerAuthRedirect({
        isAuthenticated: true,
        normalizedEmail: "user@example.com",
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
        hasClaimablePaidWorkspace: false,
      }),
    ).toBe("/dashboard");
  });

  it("redirects paid-but-unclaimed users to onboarding", () => {
    expect(
      deriveCustomerAuthRedirect({
        isAuthenticated: true,
        normalizedEmail: "user@example.com",
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: null,
        hasClaimablePaidWorkspace: true,
      }),
    ).toBe("/onboarding");
  });

  it("redirects authenticated users without access to support onboarding state", () => {
    expect(
      deriveCustomerAuthRedirect({
        isAuthenticated: true,
        normalizedEmail: "user@example.com",
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: null,
        hasClaimablePaidWorkspace: false,
      }),
    ).toBe("/onboarding?state=support");
  });

  it("rejects unsafe post-auth redirect paths", () => {
    expect(sanitizePostAuthRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizePostAuthRedirectPath("//evil.example")).toBeNull();
    expect(sanitizePostAuthRedirectPath("/api/auth/magic-link")).toBeNull();
    expect(summarizePhase84dCustomerAuth({ NEXT_PUBLIC_APP_URL: "https://siriusai.store" }).callbackUrl).toBe(
      "https://siriusai.store/auth/callback",
    );
  });

  it("classifies transient provider and DNS failures for magic-link retry", () => {
    expect(isTransientMagicLinkSendFailure(new Error("fetch failed getaddrinfo ENOTFOUND example.supabase.co"))).toBe(
      true,
    );
    expect(isTransientMagicLinkSendFailure({ status: 429, message: "over_email_send_rate_limit" })).toBe(false);
    expect(isTransientMagicLinkSendFailure({ status: 503, message: "service unavailable" })).toBe(true);
    expect(isTransientMagicLinkSendFailure({ status: 400, message: "redirect URL not allowed" })).toBe(false);
  });

  it("retries transient magic-link send failures before succeeding", async () => {
    let attempts = 0;
    const result = await sendMagicLinkWithRetry(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("fetch failed getaddrinfo ENOTFOUND pxyjocahjutcojltcalj.supabase.co");
      }
      return { error: null };
    });

    expect(result.error).toBeFalsy();
    expect(attempts).toBe(2);
  });
});
