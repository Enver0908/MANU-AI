import { describe, expect, it } from "vitest";
import {
  deriveDefaultDietitianDisplayName,
  evaluateOnboardingClaim,
  summarizePhase84eCustomerOnboarding,
  validateOnboardingSessionId,
} from "./phase-84e-customer-onboarding";

describe("phase 84e customer onboarding", () => {
  it("validates checkout session ids", () => {
    expect(validateOnboardingSessionId("cs_test_123").valid).toBe(true);
    expect(validateOnboardingSessionId("bad").blockingReasons).toContain("checkout_session_id_invalid");
  });

  it("derives dietitian display name from invite metadata", () => {
    expect(
      deriveDefaultDietitianDisplayName({
        inviteEmail: "dietitian@example.com",
        tenantSeedMetadata: { tenantName: "Örnek Klinik" },
      }),
    ).toBe("Örnek Klinik");
  });

  it("allows claim when checkout session maps to consumed invite and active entitlement", () => {
    const result = evaluateOnboardingClaim({
      sessionId: "cs_test_123",
      isAuthenticated: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      invite: {
        id: "invite-1",
        normalizedEmail: "owner@example.com",
        status: "consumed",
        tenantId: "tenant-1",
        tenantSeedMetadata: { tenantName: "Klinik" },
      },
      entitlementStatus: "active",
      existingOwnerUserId: null,
      hasMembershipOnTenant: false,
      hasDietitianProfileOnTenant: false,
      dietitianTenantId: null,
    });

    expect(result.claimable).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks claim on email mismatch or foreign tenant ownership", () => {
    expect(
      evaluateOnboardingClaim({
        sessionId: "cs_test_123",
        isAuthenticated: true,
        userId: "user-1",
        userEmail: "other@example.com",
        invite: {
          id: "invite-1",
          normalizedEmail: "owner@example.com",
          status: "consumed",
          tenantId: "tenant-1",
          tenantSeedMetadata: {},
        },
        entitlementStatus: "active",
        existingOwnerUserId: null,
        hasMembershipOnTenant: false,
        hasDietitianProfileOnTenant: false,
        dietitianTenantId: null,
      }).blockingReasons,
    ).toContain("authenticated_email_mismatch");

    expect(
      evaluateOnboardingClaim({
        sessionId: "cs_test_123",
        isAuthenticated: true,
        userId: "user-2",
        userEmail: "owner@example.com",
        invite: {
          id: "invite-1",
          normalizedEmail: "owner@example.com",
          status: "consumed",
          tenantId: "tenant-1",
          tenantSeedMetadata: {},
        },
        entitlementStatus: "active",
        existingOwnerUserId: "user-1",
        hasMembershipOnTenant: false,
        hasDietitianProfileOnTenant: false,
        dietitianTenantId: null,
      }).blockingReasons,
    ).toContain("tenant_already_claimed");
  });

  it("marks repeat claim as already claimed", () => {
    const result = evaluateOnboardingClaim({
      sessionId: "cs_test_123",
      isAuthenticated: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      invite: {
        id: "invite-1",
        normalizedEmail: "owner@example.com",
        status: "consumed",
        tenantId: "tenant-1",
        tenantSeedMetadata: {},
      },
      entitlementStatus: "active",
      existingOwnerUserId: "user-1",
      hasMembershipOnTenant: true,
      hasDietitianProfileOnTenant: true,
      dietitianTenantId: "tenant-1",
    });

    expect(result.alreadyClaimed).toBe(true);
    expect(result.claimable).toBe(true);
    expect(JSON.stringify(summarizePhase84eCustomerOnboarding())).toContain(
      "/api/commercial/onboarding/claim",
    );
  });
});
