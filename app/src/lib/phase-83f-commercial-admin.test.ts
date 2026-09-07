import { describe, expect, it } from "vitest";
import {
  buildCommercialAdminInviteRecord,
  buildCommercialAdminStoreHealthReport,
  classifyCommercialAdminStoreError,
  deriveCommercialAdminEntitlementRevokePlan,
  deriveCommercialAdminInviteRevokePlan,
  deriveCommercialAdminManualEntitlementPlan,
  evaluateCommercialAdminGate,
  evaluateCommercialAdminInviteDuplicate,
  isCommercialAdminSameOriginRequest,
  projectCommercialAdminCustomer,
  resolveCommercialAdminStoreEnv,
  sanitizeBillingLedgerEntryForAdmin,
  sanitizeCommercialInviteForAdmin,
  summarizePhase83fCommercialAdmin,
  validateCommercialAdminInviteCreate,
  validateCommercialAdminInviteCustomerCommand,
  validateCommercialAdminEntitlementRevokeRequest,
  validateCommercialAdminManualEntitlementRequest,
} from "./phase-83f-commercial-admin";
import { buildCommercialInviteRecord } from "./phase-83b-commercial-entitlement-model.server";

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
        expectedRevision: 2,
      }),
    ).toEqual({
      valid: true,
      tenantId: "tenant-1",
      expectedRevision: 2,
      blockingReasons: [],
    });

    expect(
      validateCommercialAdminEntitlementRevokeRequest({
        tenantId: "tenant-1",
      }).blockingReasons,
    ).toContain("expected_revision_required");
  });

  it("validates manual bank-transfer entitlement requests", () => {
    const validation = validateCommercialAdminManualEntitlementRequest(
      {
        action: "activate",
        inviteId: "invite-123",
        paymentReference: "BANK-2026-0001",
        paidThrough: "2026-08-01T00:00:00.000Z",
        requestId: "manual-req-1",
        expectedRevision: null,
      },
      { now: "2026-07-01T00:00:00.000Z" },
    );

    expect(validation.valid).toBe(true);
    expect(validation.action).toBe("activate");

    expect(
      validateCommercialAdminManualEntitlementRequest(
        {
          action: "activate",
          inviteId: "invite-123",
          paymentReference: "BANK-2026-0001",
          paidThrough: "2026-07-01T00:00:00.000Z",
          requestId: "manual-req-1",
        },
        { now: "2026-07-01T00:00:00.000Z" },
      ).blockingReasons,
    ).toContain("paid_through_must_be_future");
  });

  it("derives manual activate and renewal plans without reactivating revoked entitlements", () => {
    expect(
      deriveCommercialAdminManualEntitlementPlan({
        action: "activate",
        inviteStatus: "active",
        inviteTenantId: null,
        entitlementStatus: null,
        requestedPaidThrough: "2026-08-01T00:00:00.000Z",
      }).allowed,
    ).toBe(true);

    expect(
      deriveCommercialAdminManualEntitlementPlan({
        action: "renew",
        inviteStatus: "consumed",
        inviteTenantId: "tenant-1",
        entitlementStatus: "active",
        currentPaidThrough: "2026-08-01T00:00:00.000Z",
        requestedPaidThrough: "2026-09-01T00:00:00.000Z",
      }).allowed,
    ).toBe(true);

    expect(
      deriveCommercialAdminManualEntitlementPlan({
        action: "renew",
        inviteStatus: "consumed",
        inviteTenantId: "tenant-1",
        entitlementStatus: "active",
        currentPaidThrough: "2026-08-01T00:00:00.000Z",
        requestedPaidThrough: "2026-08-01T00:00:00.000Z",
      }).blockingReasons,
    ).toContain("paid_through_must_advance");

    expect(
      deriveCommercialAdminManualEntitlementPlan({
        action: "activate",
        inviteStatus: "consumed",
        inviteTenantId: "tenant-1",
        entitlementStatus: "revoked",
        requestedPaidThrough: "2026-08-01T00:00:00.000Z",
      }).blockingReasons,
    ).toContain("revoked_entitlement_cannot_be_reactivated_manually");

    expect(
      deriveCommercialAdminManualEntitlementPlan({
        action: "reactivate",
        inviteStatus: "consumed",
        inviteTenantId: "tenant-1",
        entitlementStatus: "revoked",
        requestedPaidThrough: "2026-08-01T00:00:00.000Z",
      }).allowed,
    ).toBe(true);
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
    expect(summary.auditEventTypes).toContain("manual_entitlement_activated");
    expect(summary.auditEventTypes).toContain("manual_entitlement_reactivated");
    expect(summary.auditEventTypes).toContain("password_recovery_requested");
    expect(summary.serviceRoleOnlyTables).toContain("manual_entitlement_operations");
    expect(summary.auditEventTypes).not.toContain("mobile_install_entitlement_revoked");
    expect(summary.productionPilotGo).toBe(false);
    expect(summary.gateEnvFlags).toEqual([
      "MANU_ALLOW_COMMERCIAL_ADMIN",
      "MANU_COMMERCIAL_ADMIN_TOKEN",
    ]);
  });

  it("projects customer access labels and blocks ambiguous tenant matches", () => {
    const active = projectCommercialAdminCustomer({
      normalizedEmail: "clinic@example.com",
      tenantIds: ["tenant-1"],
      hasOwnerMembership: true,
      latestInvite: {
        id: "invite-1",
        status: "consumed",
        tenantId: "tenant-1",
        tenantName: "Demo Clinic",
        createdAt: NOW,
        updatedAt: NOW,
      },
      latestEntitlement: {
        tenantId: "tenant-1",
        status: "active",
        billingMethod: "manual_transfer",
        paidThrough: "2026-08-01T00:00:00.000Z",
        revision: 3,
        inviteId: "invite-1",
      },
      now: NOW,
    });
    expect(active.accessLabel).toBe("Aktif");
    expect(active.primaryAction).toBe("revoke");

    const expired = projectCommercialAdminCustomer({
      normalizedEmail: "clinic@example.com",
      tenantIds: ["tenant-1"],
      hasOwnerMembership: true,
      latestInvite: {
        id: "invite-1",
        status: "consumed",
        tenantId: "tenant-1",
        tenantName: "Demo Clinic",
        createdAt: NOW,
        updatedAt: NOW,
      },
      latestEntitlement: {
        tenantId: "tenant-1",
        status: "active",
        billingMethod: "manual_transfer",
        paidThrough: "2026-06-01T00:00:00.000Z",
        revision: 3,
        inviteId: "invite-1",
      },
      now: NOW,
    });
    expect(expired.accessLabel).toBe("Süresi dolmuş");
    expect(expired.primaryAction).toBe("renew");

    const revoked = projectCommercialAdminCustomer({
      normalizedEmail: "clinic@example.com",
      tenantIds: ["tenant-1"],
      hasOwnerMembership: true,
      latestInvite: {
        id: "invite-1",
        status: "consumed",
        tenantId: "tenant-1",
        tenantName: "Demo Clinic",
        createdAt: NOW,
        updatedAt: NOW,
      },
      latestEntitlement: {
        tenantId: "tenant-1",
        status: "revoked",
        billingMethod: "manual_transfer",
        paidThrough: "2026-08-01T00:00:00.000Z",
        revision: 4,
        inviteId: "invite-1",
      },
      now: NOW,
    });
    expect(revoked.accessLabel).toBe("Erişim kapalı");
    expect(revoked.primaryAction).toBe("reactivate");

    const pending = projectCommercialAdminCustomer({
      normalizedEmail: "new@example.com",
      tenantIds: [],
      hasOwnerMembership: false,
      latestInvite: {
        id: "invite-2",
        status: "active",
        tenantId: null,
        tenantName: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      latestEntitlement: null,
      now: NOW,
    });
    expect(pending.accessLabel).toBe("Kurulum bekliyor");
    expect(pending.primaryAction).toBeNull();

    const ambiguous = projectCommercialAdminCustomer({
      normalizedEmail: "multi@example.com",
      tenantIds: ["tenant-a", "tenant-b"],
      hasOwnerMembership: true,
      latestInvite: null,
      latestEntitlement: {
        tenantId: "tenant-a",
        status: "revoked",
        billingMethod: "manual_transfer",
        paidThrough: "2026-08-01T00:00:00.000Z",
        revision: 1,
        inviteId: "invite-a",
      },
      now: NOW,
    });
    expect(ambiguous.ambiguousTenantMatch).toBe(true);
    expect(ambiguous.primaryAction).toBeNull();
  });

  it("blocks duplicate invites and resumes setup email without creating a second row", () => {
    expect(
      evaluateCommercialAdminInviteDuplicate({
        normalizedEmail: "clinic@example.com",
        tenantIds: [],
        authUserId: null,
        openInvite: null,
        latestEntitlementStatus: null,
      }).canCreateInvite,
    ).toBe(true);

    const openInvite = evaluateCommercialAdminInviteDuplicate({
      normalizedEmail: "clinic@example.com",
      tenantIds: [],
      authUserId: null,
      openInvite: { id: "invite-1", status: "active", tenantId: null },
      latestEntitlementStatus: null,
    });
    expect(openInvite.canCreateInvite).toBe(false);
    expect(openInvite.shouldResendSetupEmail).toBe(true);
    expect(openInvite.blockingReasons).toContain("open_invite_exists");

    expect(
      evaluateCommercialAdminInviteDuplicate({
        normalizedEmail: "clinic@example.com",
        tenantIds: ["tenant-1"],
        authUserId: "auth-1",
        openInvite: { id: "invite-1", status: "consumed", tenantId: "tenant-1" },
        latestEntitlementStatus: "revoked",
        hasOwnerMembership: true,
      }).blockingReasons,
    ).toContain("existing_customer_use_reactivate");

    expect(
      evaluateCommercialAdminInviteDuplicate({
        normalizedEmail: "clinic@example.com",
        tenantIds: ["tenant-a", "tenant-b"],
        authUserId: "auth-1",
        openInvite: null,
        latestEntitlementStatus: "active",
      }).blockingReasons,
    ).toContain("ambiguous_tenant_match");
  });

  it("requires a future paid-through date for the single invite-customer command", () => {
    expect(
      validateCommercialAdminInviteCustomerCommand(
        { email: "clinic@example.com", paidThrough: "2026-08-01T00:00:00.000Z" },
        { now: NOW },
      ).valid,
    ).toBe(true);
    expect(
      validateCommercialAdminInviteCustomerCommand(
        { email: "clinic@example.com" },
        { now: NOW },
      ).blockingReasons,
    ).toContain("paid_through_required");
  });

  it("accepts reactivate in the manual entitlement validator and request hash payload", () => {
    const validation = validateCommercialAdminManualEntitlementRequest(
      {
        action: "reactivate",
        inviteId: "invite-123",
        paymentReference: "ADMIN-REACTIVATE-1",
        paidThrough: "2026-09-01T00:00:00.000Z",
        requestId: "reactivate-req-1",
        expectedRevision: 4,
      },
      { now: NOW },
    );
    expect(validation.valid).toBe(true);
    expect(validation.action).toBe("reactivate");
    expect(validation.expectedRevision).toBe(4);
  });

  it("requires same-origin host matching for admin mutations", () => {
    expect(isCommercialAdminSameOriginRequest({ origin: null, host: "admin.example.com" })).toBe(true);
    expect(
      isCommercialAdminSameOriginRequest({
        origin: "https://admin.example.com",
        host: "admin.example.com",
      }),
    ).toBe(true);
    expect(
      isCommercialAdminSameOriginRequest({
        origin: "https://evil.example",
        host: "admin.example.com",
      }),
    ).toBe(false);
  });
});
