import { afterEach, describe, expect, it } from "vitest";
import {
  COMMERCIAL_ENTITLEMENT_BLOCKED_API_STATUSES,
  evaluateCommercialEntitlementApiAccess,
  isCommercialEntitlementEnforcementEnabled,
  resolveCommercialPublicRateLimitKey,
  shouldTreatAuthStateAsStaleForPwa,
  summarizePhase83gEntitlementHardening,
  verifyServiceWorkerDoesNotCacheProtectedApiPaths,
} from "./phase-83g-entitlement-hardening";

describe("phase 83g entitlement hardening", () => {
  afterEach(() => {
    delete process.env.MANU_TRUST_PROXY_HEADERS;
  });

  it("skips API entitlement enforcement in dev fallback mode", () => {
    expect(
      isCommercialEntitlementEnforcementEnabled({
        MANU_DEV_FALLBACK_STORE: "true",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      } as NodeJS.ProcessEnv),
    ).toBe(false);

    const skipped = evaluateCommercialEntitlementApiAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "revoked",
      enforcementEnabled: false,
    });
    expect(skipped.skipped).toBe(true);
    expect(skipped.allowed).toBe(true);
  });

  it("blocks every non-active entitlement status on protected APIs", () => {
    for (const status of COMMERCIAL_ENTITLEMENT_BLOCKED_API_STATUSES) {
      const result = evaluateCommercialEntitlementApiAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: status,
        enforcementEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBeTruthy();
    }

    const active = evaluateCommercialEntitlementApiAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
      enforcementEnabled: true,
    });
    expect(active.allowed).toBe(true);
    expect(active.errorCode).toBeNull();
  });

  it("maps revoked and missing entitlement to distinct API error codes", () => {
    expect(
      evaluateCommercialEntitlementApiAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: null,
        enforcementEnabled: true,
      }).errorCode,
    ).toBe("entitlement_required");

    expect(
      evaluateCommercialEntitlementApiAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "revoked",
        enforcementEnabled: true,
      }).errorCode,
    ).toBe("entitlement_revoked");
  });

  it("builds public rate-limit keys from trusted IP identity only", () => {
    const untrusted = {
      headers: {
        get(name: string) {
          if (name === "x-forwarded-for") return "203.0.113.10, 198.51.100.2";
          return null;
        },
      },
    } as unknown as import("next/server").NextRequest;

    expect(resolveCommercialPublicRateLimitKey(untrusted, " Dietitian@Example.COM ")).toBe(
      "anonymous:dietitian@example.com",
    );

    const previousTrust = process.env.MANU_TRUST_PROXY_HEADERS;
    process.env.MANU_TRUST_PROXY_HEADERS = "true";
    try {
      const trusted = {
        headers: {
          get(name: string) {
            if (name === "x-forwarded-for") return "203.0.113.10, 10.0.0.1";
            if (name === "x-real-ip") return "10.0.0.1";
            if (name === "x-manu-trusted-proxy") return "nginx";
            return null;
          },
        },
      } as unknown as import("next/server").NextRequest;
      expect(resolveCommercialPublicRateLimitKey(trusted, " Dietitian@Example.COM ")).toBe(
        "203.0.113.10:dietitian@example.com",
      );
    } finally {
      if (previousTrust === undefined) {
        delete process.env.MANU_TRUST_PROXY_HEADERS;
      } else {
        process.env.MANU_TRUST_PROXY_HEADERS = previousTrust;
      }
    }
  });

  it("treats inactive entitlement as stale for installed PWA session checks", () => {
    expect(
      shouldTreatAuthStateAsStaleForPwa({
        status: "authenticated",
        entitlementStatus: "active",
        enforcementEnabled: true,
      }),
    ).toBe(false);

    expect(
      shouldTreatAuthStateAsStaleForPwa({
        status: "authenticated",
        entitlementStatus: "revoked",
        enforcementEnabled: true,
      }),
    ).toBe(true);

    expect(
      shouldTreatAuthStateAsStaleForPwa({
        status: "authenticated",
        entitlementStatus: "revoked",
        enforcementEnabled: false,
      }),
    ).toBe(false);
  });

  it("documents network-only API cache policy for service worker hardening", () => {
    const cacheCheck = verifyServiceWorkerDoesNotCacheProtectedApiPaths();
    expect(cacheCheck.appStateCached).toBe(false);
    expect(cacheCheck.clientsCached).toBe(false);
    expect(cacheCheck.commercialCheckoutCached).toBe(false);
    expect(summarizePhase83gEntitlementHardening().productionPilotGo).toBe(false);
  });
});
