import { describe, expect, it } from "vitest";
import {
  buildOnboardingPathFromReference,
  canSetOnboardingPassword,
  deriveDefaultDietitianDisplayName,
  deriveOnboardingClaimPending,
  evaluateOnboardingClaim,
  selectInvitedEmailForStatus,
  summarizePhase84eCustomerOnboarding,
  validateOnboardingClaimReference,
  validateOnboardingSessionId,
} from "./phase-84e-customer-onboarding";

describe("phase 84e customer onboarding", () => {
  it("validates checkout session ids", () => {
    expect(validateOnboardingSessionId("cs_test_123").valid).toBe(true);
    expect(validateOnboardingSessionId("bad").blockingReasons).toContain("checkout_session_id_invalid");
    expect(validateOnboardingClaimReference({ inviteId: "invite-123" }).reference).toMatchObject({
      kind: "manual_invite",
      inviteId: "invite-123",
    });
    expect(
      validateOnboardingClaimReference({ sessionId: "cs_test_123", inviteId: "invite-123" }).blockingReasons,
    ).toContain("claim_reference_ambiguous");
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

  it("allows Stripe-less manual invite claim only while manual entitlement is active and unexpired", () => {
    const claim = evaluateOnboardingClaim({
      sessionId: "invite-123",
      isAuthenticated: true,
      userId: "user-1",
      userEmail: "owner@example.com",
      invite: {
        id: "invite-123",
        normalizedEmail: "owner@example.com",
        status: "consumed",
        tenantId: "tenant-1",
        tenantSeedMetadata: {},
      },
      entitlementStatus: "active",
      billingMethod: "manual_transfer",
      paidThrough: "2026-08-01T00:00:00.000Z",
      now: "2026-07-01T00:00:00.000Z",
      existingOwnerUserId: null,
      hasMembershipOnTenant: false,
      hasDietitianProfileOnTenant: false,
      dietitianTenantId: null,
    });

    expect(claim.claimable).toBe(true);
    expect(claim.blockingReasons).toEqual([]);

    expect(
      evaluateOnboardingClaim({
        ...claimFixture(),
        billingMethod: "manual_transfer",
        paidThrough: "2026-07-01T00:00:00.000Z",
        now: "2026-07-01T00:00:00.000Z",
      }).blockingReasons,
    ).toContain("entitlement_expired");
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

  it("blocks revoked, expired, and email-mismatched invites without leaking invited email", () => {
    expect(
      evaluateOnboardingClaim({
        ...claimFixture(),
        invite: { ...claimFixture().invite, status: "revoked" },
      }).blockingReasons,
    ).toContain("invite_revoked");

    expect(
      evaluateOnboardingClaim({
        ...claimFixture(),
        invite: { ...claimFixture().invite, expiresAt: "2026-06-01T00:00:00.000Z" },
        now: "2026-07-01T00:00:00.000Z",
      }).blockingReasons,
    ).toContain("invite_expired");

    expect(
      selectInvitedEmailForStatus({
        isAuthenticated: false,
        userEmail: "owner@example.com",
        inviteEmail: "owner@example.com",
      }),
    ).toBeNull();
    expect(
      selectInvitedEmailForStatus({
        isAuthenticated: true,
        userEmail: "other@example.com",
        inviteEmail: "owner@example.com",
      }),
    ).toBeNull();
    expect(
      selectInvitedEmailForStatus({
        isAuthenticated: true,
        userEmail: "Owner@example.com",
        inviteEmail: "owner@example.com",
      }),
    ).toBe("owner@example.com");
    expect(
      buildOnboardingPathFromReference({
        kind: "manual_invite",
        sessionId: null,
        inviteId: "invite-123",
      }),
    ).toBe("/onboarding?invite_id=invite-123");
    expect(canSetOnboardingPassword(evaluateOnboardingClaim(claimFixture()))).toBe(true);
    expect(
      canSetOnboardingPassword(
        evaluateOnboardingClaim({
          ...claimFixture(),
          hasMembershipOnTenant: true,
          hasDietitianProfileOnTenant: true,
          dietitianTenantId: "tenant-1",
          existingOwnerUserId: "user-1",
        }),
      ),
    ).toBe(false);
  });

  it("derives claim-pending recovery from durable events without a later claim_completed", () => {
    expect(
      deriveOnboardingClaimPending({
        claimable: true,
        alreadyClaimed: false,
        events: [
          { eventType: "claim_pending", createdAt: "2026-09-04T10:00:00.000Z" },
          { eventType: "magic_link_requested", createdAt: "2026-09-04T09:00:00.000Z" },
        ],
      }),
    ).toBe(true);
    expect(
      deriveOnboardingClaimPending({
        claimable: true,
        alreadyClaimed: false,
        events: [
          { eventType: "claim_completed", createdAt: "2026-09-04T11:00:00.000Z" },
          { eventType: "claim_pending", createdAt: "2026-09-04T10:00:00.000Z" },
        ],
      }),
    ).toBe(false);
    expect(
      deriveOnboardingClaimPending({
        claimable: false,
        alreadyClaimed: false,
        events: [{ eventType: "claim_pending", createdAt: "2026-09-04T10:00:00.000Z" }],
      }),
    ).toBe(false);
  });
});

function claimFixture() {
  return {
    sessionId: "invite-123",
    isAuthenticated: true,
    userId: "user-1",
    userEmail: "owner@example.com",
    invite: {
      id: "invite-123",
      normalizedEmail: "owner@example.com",
      status: "consumed" as const,
      tenantId: "tenant-1",
      tenantSeedMetadata: {},
    },
    entitlementStatus: "active" as const,
    existingOwnerUserId: null,
    hasMembershipOnTenant: false,
    hasDietitianProfileOnTenant: false,
    dietitianTenantId: null,
  };
}
