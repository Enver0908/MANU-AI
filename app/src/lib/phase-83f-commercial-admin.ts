import type {
  BillingEventLedgerEntry,
  CommercialBillingMethod,
  CommercialEntitlementStatus,
  CommercialInvite,
  CommercialInviteStatus,
} from "./phase-83b-commercial-entitlement-model";
import {
  evaluateCommercialEntitlementExpiry,
  normalizeCommercialEmail,
  transitionCommercialEntitlement,
  validateNormalizedCommercialEmail,
} from "./phase-83b-commercial-entitlement-model";
import { buildCommercialInviteRecord } from "./phase-83b-commercial-entitlement-model.server";

export const PHASE_83F_VERSION = "phase83-commercial-admin-v1";

export const COMMERCIAL_ADMIN_AUDIT_EVENT_TYPES = [
  "invite_created",
  "invite_revoked",
  "entitlement_revoked",
  "ledger_inspected",
  "stripe_subscription_canceled",
  "lead_status_updated",
  "admin_operation_blocked",
  "manual_entitlement_activated",
  "manual_entitlement_renewed",
  "manual_entitlement_reactivated",
  "password_recovery_requested",
] as const;

export type CommercialAdminAuditEventType = (typeof COMMERCIAL_ADMIN_AUDIT_EVENT_TYPES)[number];

export const MIN_COMMERCIAL_ADMIN_TOKEN_LENGTH = 32;

export type CommercialAdminGateInput = {
  allowCommercialAdmin?: boolean | string | undefined;
  configuredToken?: string | undefined;
  suppliedToken?: string | null | undefined;
};

export type CommercialAdminGateResult = {
  allowed: boolean;
  blockingReasons: string[];
};

export type CommercialAdminCustomerAccessLabel =
  | "Aktif"
  | "Süresi dolmuş"
  | "Erişim kapalı"
  | "Kurulum bekliyor";

export type CommercialAdminCustomerAccessState = "active" | "expired" | "revoked" | "setup_pending";

export type CommercialAdminCustomerPrimaryAction = "revoke" | "renew" | "reactivate" | null;

export type CommercialAdminCustomerListItem = {
  email: string;
  tenantName: string | null;
  tenantId: string | null;
  inviteId: string | null;
  inviteStatus: CommercialInviteStatus | null;
  entitlementStatus: CommercialEntitlementStatus | null;
  billingMethod: CommercialBillingMethod | null;
  accessLabel: CommercialAdminCustomerAccessLabel;
  accessState: CommercialAdminCustomerAccessState;
  paidThrough: string | null;
  revision: number | null;
  primaryAction: CommercialAdminCustomerPrimaryAction;
  ambiguousTenantMatch: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CommercialAdminCustomerMatchInput = {
  normalizedEmail: string;
  tenantIds: string[];
  latestInvite: {
    id: string;
    status: CommercialInviteStatus;
    tenantId: string | null;
    tenantName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  latestEntitlement: {
    tenantId: string;
    status: CommercialEntitlementStatus;
    billingMethod: CommercialBillingMethod | null;
    paidThrough: string | null;
    revision: number | null;
    inviteId: string | null;
  } | null;
  hasOwnerMembership?: boolean;
  now?: string;
};

export type CommercialAdminInviteDuplicateInput = {
  normalizedEmail: string;
  tenantIds: string[];
  authUserId: string | null;
  openInvite: {
    id: string;
    status: CommercialInviteStatus;
    tenantId: string | null;
  } | null;
  latestEntitlementStatus: CommercialEntitlementStatus | null;
  hasOwnerMembership?: boolean;
};

export type CommercialAdminInviteDuplicateDecision = {
  canCreateInvite: boolean;
  shouldResendSetupEmail: boolean;
  shouldResumeProvisioning: boolean;
  blockingReasons: string[];
  existingInviteId: string | null;
  existingTenantId: string | null;
  ambiguousTenantMatch: boolean;
};

export type CommercialAdminInviteCustomerCommandInput = {
  email?: string | null;
  tenantName?: string | null;
  paidThrough?: string | null;
  expiresAt?: string | null;
};

export type CommercialAdminInviteCustomerCommandValidation = {
  valid: boolean;
  normalizedEmail: string;
  tenantName: string | null;
  paidThrough: string | null;
  expiresAt: string | null;
  blockingReasons: string[];
};

export type CommercialAdminInviteListItem = {
  id: string;
  normalizedEmail: string;
  status: CommercialInviteStatus;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  checkoutSessionId: string | null;
  checkoutStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialAdminSubscriptionSummary = {
  tenantId: string;
  normalizedEmail: string | null;
  inviteId: string | null;
  inviteStatus: CommercialInviteStatus | null;
  entitlementStatus: CommercialEntitlementStatus | null;
  billingMethod: CommercialBillingMethod | null;
  paidThrough: string | null;
  revision: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  statusChangedAt: string | null;
};

export type CommercialAdminManualEntitlementAction = "activate" | "renew" | "reactivate";

export type CommercialAdminManualEntitlementRequestInput = {
  action?: string | null;
  inviteId?: string | null;
  paymentReference?: string | null;
  paidThrough?: string | null;
  requestId?: string | null;
  expectedRevision?: number | null;
};

export type CommercialAdminManualEntitlementRequestValidation = {
  valid: boolean;
  action: CommercialAdminManualEntitlementAction | null;
  inviteId: string | null;
  paymentReference: string | null;
  paidThrough: string | null;
  requestId: string | null;
  expectedRevision: number | null;
  blockingReasons: string[];
};

export type CommercialAdminLedgerListItem = {
  id: string;
  stripeEventId: string;
  eventType: string;
  tenantId: string | null;
  processedAt: string;
  payloadSummary: Record<string, unknown>;
};

export type CommercialAdminInviteCreateInput = {
  email: string;
  inviteToken?: string;
  tenantName?: string;
  paidThrough?: string | null;
  expiresAt?: string | null;
};

export type CommercialAdminInviteCreateValidation = {
  valid: boolean;
  normalizedEmail: string;
  inviteToken: string;
  tenantSeedMetadata: Record<string, unknown>;
  blockingReasons: string[];
};

export type CommercialAdminInviteRevokePlan = {
  canRevokeInvite: boolean;
  shouldRevokeEntitlement: boolean;
  entitlementTargetStatus: CommercialEntitlementStatus | null;
  blockingReasons: string[];
};

export type CommercialAdminEntitlementRevokeRequestInput = {
  tenantId?: string | null;
  mobileInstallOnly?: boolean | null;
  expectedRevision?: number | null;
};

export type CommercialAdminEntitlementRevokeRequestValidation = {
  valid: boolean;
  tenantId: string | null;
  expectedRevision: number | null;
  blockingReasons: string[];
};

export type CommercialAdminStoreHealthCheck = {
  key: string;
  ok: boolean;
  message: string;
};

export type CommercialAdminStoreHealthReport = {
  healthy: boolean;
  status: "ready" | "blocked";
  checks: CommercialAdminStoreHealthCheck[];
  blockingReasons: string[];
};

export function resolveCommercialAdminAllowFlag(value: boolean | string | undefined) {
  return value === true || value === "true";
}

export function evaluateCommercialAdminGate(input: CommercialAdminGateInput): CommercialAdminGateResult {
  const blockingReasons: string[] = [];

  if (!resolveCommercialAdminAllowFlag(input.allowCommercialAdmin)) {
    blockingReasons.push("commercial admin is disabled (MANU_ALLOW_COMMERCIAL_ADMIN)");
  }

  const configuredToken = input.configuredToken?.trim() ?? "";
  if (configuredToken.length < MIN_COMMERCIAL_ADMIN_TOKEN_LENGTH) {
    blockingReasons.push("commercial admin token is not configured");
  }

  const suppliedToken = input.suppliedToken?.trim() ?? "";
  if (!suppliedToken) {
    blockingReasons.push("commercial admin token is required");
  } else if (configuredToken && suppliedToken !== configuredToken) {
    blockingReasons.push("commercial admin token is invalid");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function resolveCommercialAdminConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    enabled: resolveCommercialAdminAllowFlag(env.MANU_ALLOW_COMMERCIAL_ADMIN),
    tokenConfigured: (env.MANU_COMMERCIAL_ADMIN_TOKEN?.trim().length ?? 0) >= MIN_COMMERCIAL_ADMIN_TOKEN_LENGTH,
    blockingReasons: evaluateCommercialAdminGate({
      allowCommercialAdmin: env.MANU_ALLOW_COMMERCIAL_ADMIN,
      configuredToken: env.MANU_COMMERCIAL_ADMIN_TOKEN,
      suppliedToken: env.MANU_COMMERCIAL_ADMIN_TOKEN,
    }).blockingReasons.filter(
      (reason) => reason !== "commercial admin token is required",
    ),
  };
}

export function resolveCommercialAdminStoreEnv(env: NodeJS.ProcessEnv = process.env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const blockingReasons: string[] = [];

  if (!supabaseUrl) {
    blockingReasons.push("supabase_url_missing");
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        blockingReasons.push("supabase_url_invalid");
      }
    } catch {
      blockingReasons.push("supabase_url_invalid");
    }
  }

  if (!serviceRoleKey) {
    blockingReasons.push("supabase_service_role_missing");
  }

  return {
    configured: blockingReasons.length === 0,
    devFallbackStore: env.MANU_DEV_FALLBACK_STORE === "true",
    supabaseUrlConfigured: Boolean(supabaseUrl),
    serviceRoleConfigured: Boolean(serviceRoleKey),
    blockingReasons,
  };
}

export function classifyCommercialAdminStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("fetch failed") ||
    lower.includes("probe_timeout")
  ) {
    return "supabase_project_unreachable";
  }
  if (lower.includes("invalid api key") || lower.includes("jwt") || lower.includes("permission denied")) {
    return "supabase_service_role_invalid";
  }
  if (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("relation")) {
    return "commercial_admin_migrations_pending";
  }

  return "commercial_admin_store_probe_failed";
}

export function buildCommercialAdminStoreHealthReport(input: {
  gateAllowed: boolean;
  gateBlockingReasons?: string[];
  storeConfigured: boolean;
  storeBlockingReasons?: string[];
  probeOk: boolean;
  probeBlockingReasons?: string[];
}): CommercialAdminStoreHealthReport {
  const checks: CommercialAdminStoreHealthCheck[] = [
    {
      key: "commercial_admin_gate",
      ok: input.gateAllowed,
      message: input.gateAllowed ? "commercial_admin_gate_ready" : "commercial_admin_gate_blocked",
    },
    {
      key: "supabase_admin_env",
      ok: input.storeConfigured,
      message: input.storeConfigured ? "supabase_admin_env_ready" : "supabase_admin_env_blocked",
    },
    {
      key: "commercial_admin_tables",
      ok: input.probeOk,
      message: input.probeOk ? "commercial_admin_tables_ready" : "commercial_admin_tables_blocked",
    },
  ];
  const blockingReasons = [
    ...(input.gateBlockingReasons ?? []),
    ...(input.storeBlockingReasons ?? []),
    ...(input.probeBlockingReasons ?? []),
  ];

  return {
    healthy: checks.every((check) => check.ok),
    status: checks.every((check) => check.ok) ? "ready" : "blocked",
    checks,
    blockingReasons,
  };
}

export function generateCommercialInviteToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function validateCommercialAdminInviteCreate(
  input: CommercialAdminInviteCreateInput,
): CommercialAdminInviteCreateValidation {
  const normalizedEmail = normalizeCommercialEmail(input.email);
  const validation = validateNormalizedCommercialEmail(normalizedEmail);
  const blockingReasons = [...validation.blockingReasons];

  const inviteToken = input.inviteToken?.trim() || generateCommercialInviteToken();
  if (inviteToken.length < 8) {
    blockingReasons.push("invite token must be at least 8 characters");
  }

  if (input.expiresAt) {
    const expiresMs = new Date(input.expiresAt).getTime();
    if (Number.isNaN(expiresMs)) {
      blockingReasons.push("expiresAt must be a valid ISO timestamp");
    }
  }

  const tenantSeedMetadata: Record<string, unknown> = {};
  if (input.tenantName?.trim()) {
    tenantSeedMetadata.tenantName = input.tenantName.trim();
  }
  if (input.paidThrough?.trim()) {
    tenantSeedMetadata.paidThrough = input.paidThrough.trim();
  }

  return {
    valid: blockingReasons.length === 0,
    normalizedEmail,
    inviteToken,
    tenantSeedMetadata,
    blockingReasons,
  };
}

export function buildCommercialAdminInviteRecord(input: {
  id: string;
  email: string;
  inviteToken: string;
  tenantSeedMetadata?: Record<string, unknown>;
  expiresAt?: string | null;
  now?: string;
  pepper?: string;
}) {
  return buildCommercialInviteRecord({
    id: input.id,
    email: input.email,
    inviteToken: input.inviteToken,
    tenantSeedMetadata: input.tenantSeedMetadata,
    expiresAt: input.expiresAt ?? null,
    now: input.now,
    pepper: input.pepper,
  });
}

export function deriveCommercialAdminInviteRevokePlan(input: {
  inviteStatus: CommercialInviteStatus;
  entitlementStatus: CommercialEntitlementStatus | null;
}): CommercialAdminInviteRevokePlan {
  const blockingReasons: string[] = [];

  if (input.inviteStatus === "revoked") {
    blockingReasons.push("invite is already revoked");
  }

  const shouldRevokeEntitlement =
    input.entitlementStatus !== null &&
    input.entitlementStatus !== "revoked" &&
    input.entitlementStatus !== "canceled";

  if (shouldRevokeEntitlement && input.entitlementStatus) {
    const transition = transitionCommercialEntitlement({
      fromStatus: input.entitlementStatus,
      toStatus: "revoked",
    });
    if (!transition.allowed) {
      blockingReasons.push(...transition.blockingReasons);
    }
  }

  return {
    canRevokeInvite: input.inviteStatus !== "revoked",
    shouldRevokeEntitlement,
    entitlementTargetStatus: shouldRevokeEntitlement ? "revoked" : null,
    blockingReasons,
  };
}

export function deriveCommercialAdminEntitlementRevokePlan(input: {
  entitlementStatus: CommercialEntitlementStatus | null;
}) {
  const blockingReasons: string[] = [];
  if (!input.entitlementStatus) {
    blockingReasons.push("entitlement record not found");
    return { allowed: false, blockingReasons };
  }
  if (input.entitlementStatus === "revoked") {
    blockingReasons.push("entitlement is already revoked");
    return { allowed: false, blockingReasons };
  }

  const transition = transitionCommercialEntitlement({
    fromStatus: input.entitlementStatus,
    toStatus: "revoked",
  });
  if (!transition.allowed) {
    blockingReasons.push(...transition.blockingReasons);
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function validateCommercialAdminEntitlementRevokeRequest(
  input: CommercialAdminEntitlementRevokeRequestInput,
): CommercialAdminEntitlementRevokeRequestValidation {
  const tenantId = input.tenantId?.trim() ?? "";
  const blockingReasons: string[] = [];
  const expectedRevision = input.expectedRevision ?? null;

  if (!tenantId) {
    blockingReasons.push("tenant_id_required");
  }

  if (expectedRevision === null) {
    blockingReasons.push("expected_revision_required");
  } else if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    blockingReasons.push("expected_revision_invalid");
  }

  if (input.mobileInstallOnly === true) {
    blockingReasons.push("mobile_install_only_revoke_unsupported");
  }

  return {
    valid: blockingReasons.length === 0,
    tenantId: tenantId || null,
    expectedRevision,
    blockingReasons,
  };
}

export function validateCommercialAdminManualEntitlementRequest(
  input: CommercialAdminManualEntitlementRequestInput,
  options: { now?: string } = {},
): CommercialAdminManualEntitlementRequestValidation {
  const blockingReasons: string[] = [];
  const action =
    input.action === "activate" || input.action === "renew" || input.action === "reactivate"
      ? input.action
      : null;
  const inviteId = input.inviteId?.trim() ?? "";
  const paymentReference = input.paymentReference?.trim() ?? "";
  const paidThrough = input.paidThrough?.trim() ?? "";
  const requestId = input.requestId?.trim() ?? "";
  const expectedRevision = input.expectedRevision ?? null;

  if (!action) blockingReasons.push("manual_entitlement_action_invalid");
  if (!inviteId) blockingReasons.push("invite_id_required");
  if (!paymentReference) {
    blockingReasons.push("payment_reference_required");
  } else if (paymentReference.length < 6 || paymentReference.length > 120) {
    blockingReasons.push("payment_reference_length_invalid");
  }
  if (!requestId) {
    blockingReasons.push("request_id_required");
  } else if (requestId.length < 8 || requestId.length > 120) {
    blockingReasons.push("request_id_length_invalid");
  }

  const paidThroughMs = paidThrough ? new Date(paidThrough).getTime() : Number.NaN;
  const nowMs = options.now ? new Date(options.now).getTime() : Date.now();
  if (!paidThrough) {
    blockingReasons.push("paid_through_required");
  } else if (Number.isNaN(paidThroughMs)) {
    blockingReasons.push("paid_through_invalid");
  } else if (!Number.isNaN(nowMs) && paidThroughMs <= nowMs) {
    blockingReasons.push("paid_through_must_be_future");
  }

  if (
    expectedRevision !== null &&
    (!Number.isInteger(expectedRevision) || expectedRevision < 0)
  ) {
    blockingReasons.push("expected_revision_invalid");
  }

  return {
    valid: blockingReasons.length === 0,
    action,
    inviteId: inviteId || null,
    paymentReference: paymentReference || null,
    paidThrough: paidThrough || null,
    requestId: requestId || null,
    expectedRevision,
    blockingReasons,
  };
}

export function deriveCommercialAdminManualEntitlementPlan(input: {
  action: CommercialAdminManualEntitlementAction;
  inviteStatus: CommercialInviteStatus;
  inviteTenantId: string | null;
  entitlementStatus: CommercialEntitlementStatus | null;
  currentPaidThrough?: string | null;
  requestedPaidThrough: string;
}) {
  const blockingReasons: string[] = [];
  const currentPaidThroughMs = input.currentPaidThrough
    ? new Date(input.currentPaidThrough).getTime()
    : Number.NaN;
  const requestedPaidThroughMs = new Date(input.requestedPaidThrough).getTime();

  if (input.inviteStatus === "revoked") {
    blockingReasons.push("invite_revoked");
  }

  if (input.entitlementStatus === "revoked" && input.action !== "reactivate") {
    blockingReasons.push("revoked_entitlement_cannot_be_reactivated_manually");
  }

  if (input.action === "activate") {
    if (input.inviteStatus !== "active" && input.inviteStatus !== "consumed") {
      blockingReasons.push(`invite_status_invalid_for_manual_activation:${input.inviteStatus}`);
    }
    if (
      input.entitlementStatus &&
      input.entitlementStatus !== "invited" &&
      input.entitlementStatus !== "checkout_started"
    ) {
      blockingReasons.push(`entitlement_status_invalid_for_manual_activation:${input.entitlementStatus}`);
    }
  }

  if (input.action === "renew") {
    if (!input.inviteTenantId) {
      blockingReasons.push("tenant_not_provisioned");
    }
    if (input.entitlementStatus !== "active" && input.entitlementStatus !== "past_due") {
      blockingReasons.push(
        `entitlement_status_invalid_for_manual_renewal:${input.entitlementStatus ?? "missing"}`,
      );
    }
    if (!Number.isNaN(currentPaidThroughMs) && requestedPaidThroughMs <= currentPaidThroughMs) {
      blockingReasons.push("paid_through_must_advance");
    }
  }

  if (input.action === "reactivate") {
    if (!input.inviteTenantId) {
      blockingReasons.push("tenant_not_provisioned");
    }
    if (input.entitlementStatus !== "revoked") {
      blockingReasons.push(
        `entitlement_status_invalid_for_manual_reactivation:${input.entitlementStatus ?? "missing"}`,
      );
    }
  }

  return {
    allowed: blockingReasons.length === 0,
    nextStatus: "active" as const,
    shouldConsumeInvite: input.action === "activate",
    blockingReasons,
  };
}

export function sanitizeCommercialInviteForAdmin(
  invite: CommercialInvite & {
    checkoutSessionId?: string | null;
    checkoutStartedAt?: string | null;
    tenantName?: string | null;
  },
): CommercialAdminInviteListItem {
  return {
    id: invite.id,
    normalizedEmail: invite.normalizedEmail,
    status: invite.status,
    tenantId: invite.tenantId,
    tenantName: invite.tenantName ?? null,
    expiresAt: invite.expiresAt,
    revokedAt: invite.revokedAt,
    checkoutSessionId: invite.checkoutSessionId ?? null,
    checkoutStartedAt: invite.checkoutStartedAt ?? null,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
  };
}

export function sanitizeBillingLedgerEntryForAdmin(
  entry: BillingEventLedgerEntry,
): CommercialAdminLedgerListItem {
  return {
    id: entry.id,
    stripeEventId: entry.stripeEventId,
    eventType: entry.eventType,
    tenantId: entry.tenantId,
    processedAt: entry.processedAt,
    payloadSummary: entry.payloadSummary ?? {},
  };
}

export function isCommercialAdminSameOriginRequest(input: {
  origin?: string | null;
  host?: string | null;
}) {
  const origin = input.origin?.trim() ?? "";
  if (!origin) {
    return true;
  }
  const host = input.host?.trim() ?? "";
  if (!host) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function validateCommercialAdminInviteCustomerCommand(
  input: CommercialAdminInviteCustomerCommandInput,
  options: { now?: string } = {},
): CommercialAdminInviteCustomerCommandValidation {
  const normalizedEmail = normalizeCommercialEmail(input.email ?? "");
  const emailValidation = validateNormalizedCommercialEmail(normalizedEmail);
  const blockingReasons = [...emailValidation.blockingReasons];
  const paidThrough = input.paidThrough?.trim() ?? "";
  const expiresAt = input.expiresAt?.trim() || null;
  const nowMs = options.now ? new Date(options.now).getTime() : Date.now();
  const paidThroughMs = paidThrough ? new Date(paidThrough).getTime() : Number.NaN;

  if (!paidThrough) {
    blockingReasons.push("paid_through_required");
  } else if (Number.isNaN(paidThroughMs)) {
    blockingReasons.push("paid_through_invalid");
  } else if (!Number.isNaN(nowMs) && paidThroughMs <= nowMs) {
    blockingReasons.push("paid_through_must_be_future");
  }

  if (expiresAt) {
    const expiresMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresMs)) {
      blockingReasons.push("expiresAt must be a valid ISO timestamp");
    }
  }

  return {
    valid: blockingReasons.length === 0,
    normalizedEmail,
    tenantName: input.tenantName?.trim() || null,
    paidThrough: paidThrough || null,
    expiresAt,
    blockingReasons,
  };
}

export function evaluateCommercialAdminInviteDuplicate(
  input: CommercialAdminInviteDuplicateInput,
): CommercialAdminInviteDuplicateDecision {
  const uniqueTenantIds = [...new Set(input.tenantIds.filter(Boolean))];
  const ambiguousTenantMatch = uniqueTenantIds.length > 1;
  const existingTenantId = uniqueTenantIds.length === 1 ? uniqueTenantIds[0] : null;
  const existingInviteId = input.openInvite?.id ?? null;
  const blockingReasons: string[] = [];

  if (ambiguousTenantMatch) {
    blockingReasons.push("ambiguous_tenant_match");
    return {
      canCreateInvite: false,
      shouldResendSetupEmail: false,
      shouldResumeProvisioning: false,
      blockingReasons,
      existingInviteId,
      existingTenantId: null,
      ambiguousTenantMatch,
    };
  }

  const hasOpenInvite = input.openInvite?.status === "active";
  const hasTenant = Boolean(existingTenantId);
  const hasAuthUser = Boolean(input.authUserId);
  const setupPending =
    Boolean(existingInviteId || hasTenant) &&
    input.latestEntitlementStatus !== "revoked" &&
    input.hasOwnerMembership !== true &&
    (input.latestEntitlementStatus === null ||
      input.latestEntitlementStatus === "invited" ||
      input.latestEntitlementStatus === "checkout_started" ||
      input.latestEntitlementStatus === "active");

  if (hasTenant || hasAuthUser || hasOpenInvite || existingInviteId) {
    if (input.latestEntitlementStatus === "revoked") {
      blockingReasons.push("existing_customer_use_reactivate");
    } else if (input.latestEntitlementStatus === "past_due") {
      blockingReasons.push("existing_customer_use_renew");
    } else if (hasTenant && input.hasOwnerMembership === true && input.latestEntitlementStatus === "active") {
      blockingReasons.push("existing_account");
    } else if (hasAuthUser && !existingInviteId && !hasTenant) {
      blockingReasons.push("existing_auth_user");
    } else if (hasOpenInvite || setupPending) {
      blockingReasons.push("open_invite_exists");
    } else {
      blockingReasons.push("duplicate_customer_match");
    }

    const shouldResendSetupEmail =
      !ambiguousTenantMatch &&
      input.latestEntitlementStatus !== "revoked" &&
      blockingReasons.includes("open_invite_exists");
    const shouldResumeProvisioning =
      shouldResendSetupEmail && Boolean(existingInviteId) && !hasTenant;

    return {
      canCreateInvite: false,
      shouldResendSetupEmail,
      shouldResumeProvisioning,
      blockingReasons,
      existingInviteId,
      existingTenantId,
      ambiguousTenantMatch,
    };
  }

  return {
    canCreateInvite: true,
    shouldResendSetupEmail: false,
    shouldResumeProvisioning: false,
    blockingReasons: [],
    existingInviteId: null,
    existingTenantId: null,
    ambiguousTenantMatch: false,
  };
}

export function projectCommercialAdminCustomer(
  input: CommercialAdminCustomerMatchInput,
): CommercialAdminCustomerListItem {
  const uniqueTenantIds = [...new Set(input.tenantIds.filter(Boolean))];
  const ambiguousTenantMatch = uniqueTenantIds.length > 1;
  const tenantId = uniqueTenantIds.length === 1 ? uniqueTenantIds[0] : null;
  const invite = input.latestInvite;
  const entitlement = input.latestEntitlement;
  const hasOwnerMembership = input.hasOwnerMembership === true;
  let accessState: CommercialAdminCustomerAccessState = "setup_pending";
  let accessLabel: CommercialAdminCustomerAccessLabel = "Kurulum bekliyor";
  let primaryAction: CommercialAdminCustomerPrimaryAction = null;

  if (!ambiguousTenantMatch && entitlement?.status === "revoked") {
    accessState = "revoked";
    accessLabel = "Erişim kapalı";
    primaryAction = "reactivate";
  } else if (!ambiguousTenantMatch && entitlement) {
    const expiry = evaluateCommercialEntitlementExpiry({
      entitlementStatus: entitlement.status,
      billingMethod: entitlement.billingMethod,
      paidThrough: entitlement.paidThrough,
      now: input.now,
    });
    if (
      (entitlement.status === "active" || entitlement.status === "past_due") &&
      !expiry.activeNow
    ) {
      accessState = "expired";
      accessLabel = "Süresi dolmuş";
      primaryAction = "renew";
    } else if (entitlement.status === "active" && expiry.activeNow && hasOwnerMembership) {
      accessState = "active";
      accessLabel = "Aktif";
      primaryAction = "revoke";
    } else {
      accessState = "setup_pending";
      accessLabel = "Kurulum bekliyor";
    }
  }

  if (ambiguousTenantMatch) {
    primaryAction = null;
  }

  return {
    email: input.normalizedEmail,
    tenantName: invite?.tenantName ?? null,
    tenantId: entitlement?.tenantId ?? tenantId,
    inviteId: entitlement?.inviteId ?? invite?.id ?? null,
    inviteStatus: invite?.status ?? null,
    entitlementStatus: entitlement?.status ?? null,
    billingMethod: entitlement?.billingMethod ?? null,
    accessLabel,
    accessState,
    paidThrough: entitlement?.paidThrough ?? null,
    revision: entitlement?.revision ?? null,
    primaryAction,
    ambiguousTenantMatch,
    createdAt: invite?.createdAt ?? null,
    updatedAt: invite?.updatedAt ?? null,
  };
}

export function summarizePhase83fCommercialAdmin() {
  return {
    phase83fVersion: PHASE_83F_VERSION,
    auditEventTypes: [...COMMERCIAL_ADMIN_AUDIT_EVENT_TYPES],
    adminTables: ["commercial_admin_audit_events"],
    gateEnvFlags: ["MANU_ALLOW_COMMERCIAL_ADMIN", "MANU_COMMERCIAL_ADMIN_TOKEN"],
    serviceRoleOnlyTables: [
      "commercial_invites",
      "billing_event_ledger",
      "commercial_admin_audit_events",
      "commercial_leads",
      "commercial_onboarding_events",
      "manual_entitlement_operations",
    ],
    healthEndpoint: "/api/commercial/admin/health",
    productionPilotGo: false,
  };
}
