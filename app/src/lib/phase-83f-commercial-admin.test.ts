import { describe, expect, it } from "vitest";
import {
  buildCommercialAdminInviteRecord,
  buildCommercialAdminStoreHealthReport,
  classifyCommercialAdminStoreError,
  deriveCommercialAdminEntitlementRevokePlan,
  deriveCommercialAdminInviteRevokePlan,
  evaluateCommercialAdminGate,
  resolveCommercialAdminStoreEnv,
  sanitizeBillingLedgerEntryForAdmin,
  sanitizeCommercialInviteForAdmin,
  summarizePhase83fCommercialAdmin,
  validateCommercialAdminInviteCreate,
  validateCommercialAdminEntitlementRevokeRequest,
} from "./phase-83f-commercial-admin";
import { buildCommercialInviteRecord } from "./phase-83b-commercial-entitlement-model";

const ADMIN_TOKEN = "test-commercial-admin-token-32chars-min";
const PEPPER = "test-pepper-16chars";
const NOW = "2026-07-01T12:00:00.000Z";

describe("phase 83f commercial admin", () => {
  it("blocks admin access when gate or token is missing", () => {
    expect(
      evaluateCommercialAdminGate({
        allowCommercialAdmin: false,
        configuredToken: ADMIN_TOKEN,
        suppliedToken: ADMIN_TOKEN,
      }).blockingReasons,
    ).toContain("commercial admin is disabled (MANU_ALLOW_COMMERCIAL_ADMIN)");

    expect(
      evaluateCommercialAdminGate({
        allowCommercialAdmin: true,
        configuredToken: "short",
        suppliedToken: ADMIN_TOKEN,
      }).blockingReasons,
    ).toContain("commercial admin token is not configured");

    expect(
      evaluateCommercialAdminGate({
        allowCommercialAdmin: true,
        configuredToken: ADMIN_TOKEN,
        suppliedToken: "wrong-token",
      }).blockingReasons,
    ).toContain("commercial admin token is invalid");
  });

  it("allows admin access with matching configured token", () => {
    const result = evaluateCommercialAdminGate({
      allowCommercialAdmin: true,
      configuredToken: ADMIN_TOKEN,
      suppliedToken: ADMIN_TOKEN,
    });

    expect(result.allowed).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("validates invite create input and builds hashed invite records", () => {
    const validation = validateCommercialAdminInviteCreate({
      email: " Dietitian@Example.COM ",
      tenantName: "Demo Clinic",
      expiresAt: "2026-08-01T00:00:00.000Z",
    });

    expect(validation.valid).toBe(true);
    expect(validation.normalizedEmail).toBe("dietitian@example.com");
    expect(validation.inviteToken.length).toBeGreaterThanOrEqual(8);
    expect(validation.tenantSeedMetadata).toEqual({ tenantName: "Demo Clinic" });

    const invite = buildCommercialAdminInviteRecord({
      id: "invite-1",
      email: validation.normalizedEmail,
      inviteToken: validation.inviteToken,
      tenantSeedMetadata: validation.tenantSeedMetadata,
      pepper: PEPPER,
      now: NOW,
    });

    expect(invite.inviteTokenHash).toHaveLength(64);
    expect(JSON.stringify(summarizePhase83fCommercialAdmin())).not.toContain(validation.inviteToken);
  });

  it("derives invite revoke plan with entitlement revocation when needed", () => {
    const activePlan = deriveCommercialAdminInviteRevokePlan({
      inviteStatus: "active",
      entitlementStatus: "active",
    });
    expect(activePlan.canRevokeInvite).toBe(true);
    expect(activePlan.shouldRevokeEntitlement).toBe(true);
    expect(activePlan.entitlementTargetStatus).toBe("revoked");

    const revokedPlan = deriveCommercialAdminInviteRevokePlan({
      inviteStatus: "revoked",
      entitlementStatus: "active",
    });
    expect(revokedPlan.canRevokeInvite).toBe(false);
    expect(revokedPlan.blockingReasons).toContain("invite is already revoked");
  });

  it("derives entitlement revoke plan with transition guards", () => {
    expect(
      deriveCommercialAdminEntitlementRevokePlan({ entitlementStatus: null }).blockingReasons,
    ).toContain("entitlement record not found");

    expect(
      deriveCommercialAdminEntitlementRevokePlan({ entitlementStatus: "revoked" }).blockingReasons,
    ).toContain("entitlement is already revoked");

    expect(
      deriveCommercialAdminEntitlementRevokePlan({ entitlementStatus: "active" }).allowed,
    ).toBe(true);
  });

  it("rejects install-only entitlement revocation requests", () => {
    expect(
      validateCommercialAdminEntitlementRevokeRequest({
        tenantId: "tenant-1",
        mobileInstallOnly: true,
      }).blockingReasons,
    ).toContain("mobile_install_only_revoke_unsupported");

    expect(
      validateCommercialAdminEntitlementRevokeRequest({
        tenantId: "tenant-1",
      }),
    ).toEqual({
      valid: true,
      tenantId: "tenant-1",
      blockingReasons: [],
    });
  });

  it("diagnoses commercial admin Supabase store configuration", () => {
    expect(
      resolveCommercialAdminStoreEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }).blockingReasons,
    ).toEqual(["supabase_url_missing", "supabase_service_role_missing"]);

    expect(
      resolveCommercialAdminStoreEnv({
        NEXT_PUBLIC_SUPABASE_URL: "ftp://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }).blockingReasons,
    ).toEqual(["supabase_url_invalid"]);

    expect(
      resolveCommercialAdminStoreEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        MANU_DEV_FALLBACK_STORE: "true",
      }),
    ).toMatchObject({
      configured: true,
      devFallbackStore: true,
      supabaseUrlConfigured: true,
      serviceRoleConfigured: true,
      blockingReasons: [],
    });
  });

  it("classifies commercial admin store probe failures without exposing secrets", () => {
    expect(classifyCommercialAdminStoreError(new Error("fetch failed: getaddrinfo ENOTFOUND project"))).toBe(
      "supabase_project_unreachable",
    );
    expect(classifyCommercialAdminStoreError(new Error("commercial_admin_store_probe_timeout"))).toBe(
      "supabase_project_unreachable",
    );
    expect(classifyCommercialAdminStoreError(new Error('relation "commercial_invites" does not exist'))).toBe(
      "commercial_admin_migrations_pending",
    );
    expect(classifyCommercialAdminStoreError(new Error("Invalid API key"))).toBe(
      "supabase_service_role_invalid",
    );
    expect(classifyCommercialAdminStoreError(new Error("unexpected failure"))).toBe(
      "commercial_admin_store_probe_failed",
    );
  });

  it("builds a fail-closed commercial admin store health report", () => {
    const blocked = buildCommercialAdminStoreHealthReport({
      gateAllowed: true,
      storeConfigured: true,
      probeOk: false,
      probeBlockingReasons: ["commercial_invites:supabase_project_unreachable"],
    });

    expect(blocked).toMatchObject({
      healthy: false,
      status: "blocked",
      blockingReasons: ["commercial_invites:supabase_project_unreachable"],
    });

    expect(
      buildCommercialAdminStoreHealthReport({
        gateAllowed: true,
        storeConfigured: true,
        probeOk: true,
      }).healthy,
    ).toBe(true);
  });

  it("sanitizes admin list views without exposing invite token hashes", () => {
    const invite = buildCommercialInviteRecord({
      id: "invite-1",
      email: "dietitian@example.com",
      inviteToken: "secret-token",
      pepper: PEPPER,
      now: NOW,
    });

    const sanitized = sanitizeCommercialInviteForAdmin({
      ...invite,
      checkoutSessionId: "cs_test",
      checkoutStartedAt: NOW,
      tenantName: "Demo Clinic",
    });

    expect(sanitized.normalizedEmail).toBe("dietitian@example.com");
    expect(JSON.stringify(sanitized)).not.toContain("secret-token");
    expect(JSON.stringify(sanitized)).not.toContain(invite.inviteTokenHash);
  });

  it("sanitizes billing ledger entries for admin inspection", () => {
    const sanitized = sanitizeBillingLedgerEntryForAdmin({
      id: "ledger-1",
      stripeEventId: "evt_test_1",
      eventType: "checkout.session.completed",
      tenantId: "tenant-1",
      idempotencyKey: "evt_test_1",
      payloadSummary: { handled: true },
      processedAt: NOW,
      createdAt: NOW,
    });

    expect(sanitized.eventType).toBe("checkout.session.completed");
    expect(sanitized.payloadSummary).toEqual({ handled: true });
  });

  it("documents commercial admin gate and audit tables", () => {
    const summary = summarizePhase83fCommercialAdmin();
    expect(summary.auditEventTypes).toContain("invite_created");
    expect(summary.auditEventTypes).toContain("ledger_inspected");
    expect(summary.auditEventTypes).not.toContain("mobile_install_entitlement_revoked");
    expect(summary.productionPilotGo).toBe(false);
    expect(summary.gateEnvFlags).toEqual([
      "MANU_ALLOW_COMMERCIAL_ADMIN",
      "MANU_COMMERCIAL_ADMIN_TOKEN",
    ]);
  });
});
