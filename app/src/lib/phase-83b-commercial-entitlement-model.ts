export {
  isAllowedCommercialEmail,
  normalizeCommercialEmail,
  validateNormalizedCommercialEmail,
  type CommercialEmail,
} from "./commercial-email";

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

export const COMMERCIAL_BILLING_METHODS = ["stripe", "manual_transfer"] as const;

export type CommercialBillingMethod = (typeof COMMERCIAL_BILLING_METHODS)[number];

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
  billingMethod: CommercialBillingMethod;
  paidThrough: string | null;
  revision: number;
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
  billingMethod?: CommercialBillingMethod | null;
  paidThrough?: string | null;
  now?: string;
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
  const expiry = evaluateCommercialEntitlementExpiry({
    entitlementStatus: input.entitlementStatus,
    billingMethod: input.billingMethod ?? null,
    paidThrough: input.paidThrough ?? null,
    now: input.now,
  });
  blockingReasons.push(...expiry.blockingReasons);

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function evaluateCommercialEntitlementExpiry(input: {
  entitlementStatus: CommercialEntitlementStatus | null;
  billingMethod?: CommercialBillingMethod | null;
  paidThrough?: string | null;
  now?: string;
}) {
  const blockingReasons: string[] = [];

  if (input.entitlementStatus !== "active") {
    return { activeNow: false, blockingReasons };
  }

  if (input.billingMethod !== "manual_transfer") {
    return { activeNow: true, blockingReasons };
  }

  if (!input.paidThrough) {
    blockingReasons.push("manual transfer entitlement requires paidThrough");
    return { activeNow: false, blockingReasons };
  }

  const paidThroughMs = new Date(input.paidThrough).getTime();
  if (Number.isNaN(paidThroughMs)) {
    blockingReasons.push("manual transfer paidThrough is invalid");
    return { activeNow: false, blockingReasons };
  }

  const nowMs = input.now ? new Date(input.now).getTime() : Date.now();
  if (Number.isNaN(nowMs) || nowMs >= paidThroughMs) {
    blockingReasons.push("manual transfer entitlement has expired");
    return { activeNow: false, blockingReasons };
  }

  return { activeNow: true, blockingReasons };
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

export function summarizePhase83bCommercialEntitlementModel() {
  return {
    phase83bVersion: PHASE_83B_VERSION,
    entitlementStatuses: [...COMMERCIAL_ENTITLEMENT_STATUSES],
    billingMethods: [...COMMERCIAL_BILLING_METHODS],
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
