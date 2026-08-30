import { describe, expect, it } from "vitest";
import {
  evaluateCommercialDashboardAccess,
  evaluateCommercialEntitlementExpiry,
  evaluateCommercialMobileInstallAccess,
  normalizeCommercialEmail,
  summarizePhase83bCommercialEntitlementModel,
  transitionCommercialEntitlement,
  validateNormalizedCommercialEmail,
} from "./phase-83b-commercial-entitlement-model";
import {
  buildCommercialInviteRecord,
  hashCommercialInviteToken,
  matchesCommercialInviteToken,
} from "./phase-83b-commercial-entitlement-model.server";

const PEPPER = "test-pepper-16chars";
const NOW = "2026-07-01T12:00:00.000Z";

describe("phase 83b commercial entitlement model", () => {
  it("normalizes commercial email addresses", () => {
    expect(normalizeCommercialEmail("  Dietitian@Example.COM ")).toBe("dietitian@example.com");
    expect(validateNormalizedCommercialEmail("dietitian@example.com").valid).toBe(true);
    expect(validateNormalizedCommercialEmail(" Dietitian@Example.COM ").valid).toBe(false);
    expect(validateNormalizedCommercialEmail("not-an-email").valid).toBe(false);
  });

  it("hashes invite tokens and never stores raw token material in summaries", () => {
    const hash = hashCommercialInviteToken("secret-token", PEPPER);
    expect(hash).toHaveLength(64);
    expect(JSON.stringify(summarizePhase83bCommercialEntitlementModel())).not.toContain("secret-token");
  });

  it("builds invite records with hashed tokens and optional tenant seed metadata", () => {
    const invite = buildCommercialInviteRecord({
      id: "invite-1",
      email: "dietitian@example.com",
      inviteToken: "abc123",
      tenantSeedMetadata: { tenantName: "Demo Clinic" },
      pepper: PEPPER,
      now: NOW,
    });

    expect(invite.normalizedEmail).toBe("dietitian@example.com");
    expect(invite.inviteTokenHash).toBe(hashCommercialInviteToken("abc123", PEPPER));
    expect(invite.tenantSeedMetadata).toEqual({ tenantName: "Demo Clinic" });
    expect(invite.status).toBe("active");
  });

  it("matches active unexpired invite tokens only", () => {
    const invite = buildCommercialInviteRecord({
      id: "invite-1",
      email: "dietitian@example.com",
      inviteToken: "abc123",
      pepper: PEPPER,
      now: NOW,
      expiresAt: "2026-08-01T00:00:00.000Z",
    });

    expect(
      matchesCommercialInviteToken({
        invite,
        inviteToken: "abc123",
        pepper: PEPPER,
        now: NOW,
      }).allowed,
    ).toBe(true);
    expect(
      matchesCommercialInviteToken({
        invite,
        inviteToken: "wrong",
        pepper: PEPPER,
        now: NOW,
      }).blockingReasons,
    ).toContain("invite token does not match");
    expect(
      matchesCommercialInviteToken({
        invite: { ...invite, status: "revoked" },
        inviteToken: "abc123",
        pepper: PEPPER,
        now: NOW,
      }).blockingReasons,
    ).toContain("invite status must be active (current: revoked)");
    expect(
      matchesCommercialInviteToken({
        invite: { ...invite, expiresAt: "2026-06-01T00:00:00.000Z" },
        inviteToken: "abc123",
        pepper: PEPPER,
        now: NOW,
      }).blockingReasons,
    ).toContain("invite has expired");
  });

  it("allows only defined entitlement transitions", () => {
    expect(
      transitionCommercialEntitlement({ fromStatus: "invited", toStatus: "checkout_started" }).allowed,
    ).toBe(true);
    expect(
      transitionCommercialEntitlement({ fromStatus: "checkout_started", toStatus: "active" }).allowed,
    ).toBe(true);
    expect(
      transitionCommercialEntitlement({ fromStatus: "active", toStatus: "past_due" }).allowed,
    ).toBe(true);
    expect(
      transitionCommercialEntitlement({ fromStatus: "past_due", toStatus: "active" }).allowed,
    ).toBe(true);
    expect(
      transitionCommercialEntitlement({ fromStatus: "invited", toStatus: "active" }).blockingReasons[0],
    ).toContain("transition not allowed");
    expect(
      transitionCommercialEntitlement({ fromStatus: "revoked", toStatus: "active" }).blockingReasons[0],
    ).toContain("transition not allowed");
    expect(
      transitionCommercialEntitlement({ fromStatus: "active", toStatus: "active" }).blockingReasons[0],
    ).toContain("entitlement status is unchanged");
  });

  it("requires auth, membership, dietitian profile, and active entitlement for dashboard access", () => {
    const blocked = evaluateCommercialDashboardAccess({
      isAuthenticated: false,
      hasTenantMembership: false,
      hasDietitianProfile: false,
      entitlementStatus: null,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockingReasons).toEqual([
      "authentication required",
      "tenant membership required",
      "dietitian profile required",
      "entitlement record required",
    ]);

    expect(
      evaluateCommercialDashboardAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "checkout_started",
      }).blockingReasons,
    ).toContain("entitlement status must be active (current: checkout_started)");

    expect(
      evaluateCommercialDashboardAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
      }).allowed,
    ).toBe(true);
  });

  it("requires future paidThrough for active manual transfer entitlement access", () => {
    expect(
      evaluateCommercialEntitlementExpiry({
        entitlementStatus: "active",
        billingMethod: "manual_transfer",
        paidThrough: "2026-08-01T00:00:00.000Z",
        now: "2026-07-01T00:00:00.000Z",
      }).activeNow,
    ).toBe(true);

    const expired = evaluateCommercialDashboardAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
      billingMethod: "manual_transfer",
      paidThrough: "2026-07-01T00:00:00.000Z",
      now: "2026-07-01T00:00:00.000Z",
    });
    expect(expired.allowed).toBe(false);
    expect(expired.blockingReasons).toContain("manual transfer entitlement has expired");

    expect(
      evaluateCommercialEntitlementExpiry({
        entitlementStatus: "active",
        billingMethod: "stripe",
        paidThrough: null,
        now: "2026-07-01T00:00:00.000Z",
      }).activeNow,
    ).toBe(true);
  });

  it("blocks mobile install unless dashboard access is already allowed", () => {
    const dashboard = evaluateCommercialDashboardAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
    });
    expect(
      evaluateCommercialMobileInstallAccess({
        dashboardAccess: dashboard,
        entitlementStatus: "active",
      }).allowed,
    ).toBe(true);

    const blockedDashboard = evaluateCommercialDashboardAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "past_due",
    });
    expect(
      evaluateCommercialMobileInstallAccess({
        dashboardAccess: blockedDashboard,
        entitlementStatus: "past_due",
      }).allowed,
    ).toBe(false);
  });

  it("documents commercial tables and service-role-only invite storage", () => {
    const summary = summarizePhase83bCommercialEntitlementModel();
    expect(summary.tables).toContain("commercial_invites");
    expect(summary.tables).toContain("tenant_entitlements");
    expect(summary.billingMethods).toEqual(["stripe", "manual_transfer"]);
    expect(summary.serviceRoleOnlyTables).toContain("commercial_invites");
    expect(summary.inviteTokenStorage).toBe("sha256_pepper_hash_only");
  });
});
