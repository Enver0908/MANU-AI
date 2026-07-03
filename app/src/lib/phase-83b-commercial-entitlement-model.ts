import { createHash } from "node:crypto";

export const PHASE_83B_VERSION = "phase83-commercial-entitlement-model-v1";

export const COMMERCIAL_ENTITLEMENT_STATUSES = [
  "invited",
  "checkout_started",
  "active",
  "past_due",
  "canceled",
  "revoked",
] as const;

export type CommercialEntitlementStatus = (typeof COMMERCIAL_ENTITLEMENT_STATUSES)[number];

export const COMMERCIAL_INVITE_STATUSES = ["active", "revoked", "consumed"] as const;

export type CommercialInviteStatus = (typeof COMMERCIAL_INVITE_STATUSES)[number];

export const DASHBOARD_ACCESS_ENTITLEMENT_STATUSES: CommercialEntitlementStatus[] = ["active"];

export const MOBILE_INSTALL_ACCESS_ENTITLEMENT_STATUSES: CommercialEntitlementStatus[] = ["active"];

export type CommercialInvite = {
  id: string;
  normalizedEmail: string;
  inviteTokenHash: string;
  status: CommercialInviteStatus;
  tenantSeedMetadata: Record<string, unknown>;
  tenantId: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantEntitlement = {
  id: string;
  tenantId: string;
  commercialInviteId: string | null;
  status: CommercialEntitlementStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  checkoutSessionId: string | null;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingCustomer = {
  id: string;
  tenantId: string;
  commercialInviteId: string | null;
  normalizedEmail: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingEventLedgerEntry = {
  id: string;
  stripeEventId: string;
  eventType: string;
  tenantId: string | null;
  idempotencyKey: string;
  payloadSummary: Record<string, unknown>;
  processedAt: string;
  createdAt: string;
};

export type MobileInstallAuditEvent = {
  id: string;
  tenantId: string;
  dietitianId: string | null;
  authUserId: string | null;
  eventType:
    | "install_prompt_shown"
    | "install_accepted"
    | "install_dismissed"
    | "ios_instructions_viewed"
    | "offline_banner_shown"
    | "stale_session_detected";
  userAgentSummary: string;
  createdAt: string;
};

export type CommercialDashboardAccessInput = {
  isAuthenticated: boolean;
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: CommercialEntitlementStatus | null;
};

export type CommercialDashboardAccessResult = {
  allowed: boolean;
  blockingReasons: string[];
};

export type CommercialEntitlementTransitionResult = {
  allowed: boolean;
  fromStatus: CommercialEntitlementStatus;
  toStatus: CommercialEntitlementStatus;
  blockingReasons: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COMMERCIAL_ENTITLEMENT_TRANSITIONS: Record<
  CommercialEntitlementStatus,
  readonly CommercialEntitlementStatus[]
> = {
  invited: ["checkout_started", "revoked"],
  checkout_started: ["active", "invited", "canceled", "revoked"],
  active: ["past_due", "canceled", "revoked"],
  past_due: ["active", "canceled", "revoked"],
  canceled: ["invited", "revoked"],
  revoked: [],
};

const DEFAULT_INVITE_PEPPER = "manu-local-invite-pepper-v1";

export function normalizeCommercialEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateNormalizedCommercialEmail(normalizedEmail: string) {
  const blockingReasons: string[] = [];
  if (!normalizedEmail) {
    blockingReasons.push("email is required");
  } else if (normalizedEmail !== normalizeCommercialEmail(normalizedEmail)) {
    blockingReasons.push("email must already be normalized");
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    blockingReasons.push("email format is invalid");
  }
  return {
    valid: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function resolveCommercialInvitePepper(pepper = process.env.MANU_COMMERCIAL_INVITE_PEPPER) {
  return pepper && pepper.trim().length >= 16 ? pepper.trim() : DEFAULT_INVITE_PEPPER;
}

export function hashCommercialInviteToken(token: string, pepper = resolveCommercialInvitePepper()) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("invite_token_required");
  }
  return createHash("sha256").update(`${pepper}:${normalizedToken}`).digest("hex");
}

export function isCommercialEntitlementTransitionAllowed(
  fromStatus: CommercialEntitlementStatus,
  toStatus: CommercialEntitlementStatus,
) {
  return COMMERCIAL_ENTITLEMENT_TRANSITIONS[fromStatus].includes(toStatus);
}

export function transitionCommercialEntitlement(input: {
  fromStatus: CommercialEntitlementStatus;
  toStatus: CommercialEntitlementStatus;
}) {
  const blockingReasons: string[] = [];
  if (input.fromStatus === input.toStatus) {
    blockingReasons.push("entitlement status is unchanged");
  } else if (!isCommercialEntitlementTransitionAllowed(input.fromStatus, input.toStatus)) {
    blockingReasons.push(`transition not allowed: ${input.fromStatus} -> ${input.toStatus}`);
  }

  return {
    allowed: blockingReasons.length === 0,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    blockingReasons,
  } satisfies CommercialEntitlementTransitionResult;
}

export function evaluateCommercialDashboardAccess(
  input: CommercialDashboardAccessInput,
): CommercialDashboardAccessResult {
  const blockingReasons: string[] = [];

  if (!input.isAuthenticated) {
    blockingReasons.push("authentication required");
  }
  if (!input.hasTenantMembership) {
    blockingReasons.push("tenant membership required");
  }
  if (!input.hasDietitianProfile) {
    blockingReasons.push("dietitian profile required");
  }
  if (!input.entitlementStatus) {
    blockingReasons.push("entitlement record required");
  } else if (!DASHBOARD_ACCESS_ENTITLEMENT_STATUSES.includes(input.entitlementStatus)) {
    blockingReasons.push(`entitlement status must be active (current: ${input.entitlementStatus})`);
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function evaluateCommercialMobileInstallAccess(input: {
  dashboardAccess: CommercialDashboardAccessResult;
  entitlementStatus: CommercialEntitlementStatus | null;
}) {
  const blockingReasons = [...input.dashboardAccess.blockingReasons];
  if (
    input.entitlementStatus &&
    !MOBILE_INSTALL_ACCESS_ENTITLEMENT_STATUSES.includes(input.entitlementStatus)
  ) {
    blockingReasons.push(`mobile install requires active entitlement (current: ${input.entitlementStatus})`);
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function buildCommercialInviteRecord(input: {
  id: string;
  email: string;
  inviteToken: string;
  tenantSeedMetadata?: Record<string, unknown>;
  tenantId?: string | null;
  status?: CommercialInviteStatus;
  expiresAt?: string | null;
  now?: string;
  pepper?: string;
}): CommercialInvite {
  const normalizedEmail = normalizeCommercialEmail(input.email);
  const validation = validateNormalizedCommercialEmail(normalizedEmail);
  if (!validation.valid) {
    throw new Error(validation.blockingReasons[0] ?? "invalid_email");
  }

  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    normalizedEmail,
    inviteTokenHash: hashCommercialInviteToken(input.inviteToken, input.pepper),
    status: input.status ?? "active",
    tenantSeedMetadata: input.tenantSeedMetadata ?? {},
    tenantId: input.tenantId ?? null,
    revokedAt: null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function matchesCommercialInviteToken(input: {
  invite: Pick<CommercialInvite, "inviteTokenHash" | "status" | "expiresAt">;
  inviteToken: string;
  pepper?: string;
  now?: string;
}) {
  const blockingReasons: string[] = [];
  if (input.invite.status !== "active") {
    blockingReasons.push(`invite status must be active (current: ${input.invite.status})`);
  }
  if (input.invite.expiresAt) {
    const now = input.now ?? new Date().toISOString();
    if (new Date(input.invite.expiresAt).getTime() <= new Date(now).getTime()) {
      blockingReasons.push("invite has expired");
    }
  }

  const candidateHash = hashCommercialInviteToken(input.inviteToken, input.pepper);
  if (candidateHash !== input.invite.inviteTokenHash) {
    blockingReasons.push("invite token does not match");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function summarizePhase83bCommercialEntitlementModel() {
  return {
    phase83bVersion: PHASE_83B_VERSION,
    entitlementStatuses: [...COMMERCIAL_ENTITLEMENT_STATUSES],
    dashboardAccessStatuses: [...DASHBOARD_ACCESS_ENTITLEMENT_STATUSES],
    tables: [
      "commercial_invites",
      "tenant_entitlements",
      "billing_customers",
      "billing_event_ledger",
      "mobile_install_audit_events",
    ],
    inviteTokenStorage: "sha256_pepper_hash_only",
    userWritableTables: [],
    tenantReadableTables: ["tenant_entitlements", "billing_customers", "mobile_install_audit_events"],
    serviceRoleOnlyTables: ["commercial_invites", "billing_event_ledger"],
  };
}
