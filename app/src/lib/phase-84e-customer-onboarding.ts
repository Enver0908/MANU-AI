/**
 * Phase 84E post-payment customer onboarding: validation, claim planning, and copy.
 */

import {
  normalizeCommercialEmail,
  type CommercialBillingMethod,
  type CommercialEntitlementStatus,
  type CommercialInviteStatus,
  evaluateCommercialEntitlementExpiry,
} from "./phase-83b-commercial-entitlement-model";

export const PHASE_84E_VERSION = "phase84e-customer-onboarding-v1";

export const COMMERCIAL_ONBOARDING_EVENT_TYPES = [
  "magic_link_requested",
  "claim_completed",
  "claim_blocked",
] as const;

export type CommercialOnboardingEventType = (typeof COMMERCIAL_ONBOARDING_EVENT_TYPES)[number];

export type OnboardingInviteSnapshot = {
  id: string;
  normalizedEmail: string;
  status: CommercialInviteStatus;
  tenantId: string | null;
  tenantSeedMetadata: Record<string, unknown>;
};

export type OnboardingClaimEvaluation = {
  claimable: boolean;
  alreadyClaimed: boolean;
  blockingReasons: string[];
  tenantId: string | null;
  commercialInviteId: string | null;
  normalizedInviteEmail: string | null;
};

export type OnboardingClaimReference =
  | { kind: "checkout_session"; sessionId: string; inviteId: null }
  | { kind: "manual_invite"; sessionId: null; inviteId: string };

export function validateOnboardingSessionId(sessionId?: string | null) {
  const value = sessionId?.trim() ?? "";
  const blockingReasons: string[] = [];
  if (!value) {
    blockingReasons.push("checkout_session_id_required");
  } else if (!value.startsWith("cs_")) {
    blockingReasons.push("checkout_session_id_invalid");
  }
  return {
    valid: blockingReasons.length === 0,
    sessionId: value,
    blockingReasons,
  };
}

export function validateOnboardingClaimReference(input: {
  sessionId?: string | null;
  inviteId?: string | null;
}) {
  const sessionId = input.sessionId?.trim() ?? "";
  const inviteId = input.inviteId?.trim() ?? "";
  const blockingReasons: string[] = [];

  if (sessionId && inviteId) {
    blockingReasons.push("claim_reference_ambiguous");
  }
  if (!sessionId && !inviteId) {
    blockingReasons.push("claim_reference_required");
  }

  if (sessionId) {
    const sessionValidation = validateOnboardingSessionId(sessionId);
    blockingReasons.push(...sessionValidation.blockingReasons);
    return {
      valid: blockingReasons.length === 0,
      reference: blockingReasons.length === 0
        ? ({ kind: "checkout_session", sessionId: sessionValidation.sessionId, inviteId: null } as const)
        : null,
      blockingReasons,
    };
  }

  if (inviteId.length > 0 && inviteId.length < 8) {
    blockingReasons.push("invite_id_invalid");
  }

  return {
    valid: blockingReasons.length === 0,
    reference: blockingReasons.length === 0
      ? ({ kind: "manual_invite", sessionId: null, inviteId } as const)
      : null,
    blockingReasons,
  };
}

export function deriveDefaultDietitianDisplayName(input: {
  inviteEmail: string;
  tenantSeedMetadata?: Record<string, unknown>;
}) {
  const tenantName = input.tenantSeedMetadata?.tenantName;
  if (typeof tenantName === "string" && tenantName.trim()) {
    return tenantName.trim();
  }
  const localPart = input.inviteEmail.split("@")[0]?.trim();
  if (localPart) {
    return localPart;
  }
  return "Diyetisyen";
}

export function evaluateOnboardingClaim(input: {
  sessionId: string;
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  invite: OnboardingInviteSnapshot | null;
  entitlementStatus: CommercialEntitlementStatus | null;
  billingMethod?: CommercialBillingMethod | null;
  paidThrough?: string | null;
  now?: string;
  existingOwnerUserId: string | null;
  hasMembershipOnTenant: boolean;
  hasDietitianProfileOnTenant: boolean;
  dietitianTenantId: string | null;
}): OnboardingClaimEvaluation {
  const blockingReasons: string[] = [];

  if (!input.isAuthenticated || !input.userId) {
    blockingReasons.push("authentication_required");
  }

  if (!input.invite) {
    blockingReasons.push("checkout_session_not_found");
  } else {
    if (input.invite.status !== "consumed") {
      blockingReasons.push("invite_not_consumed");
    }
    if (!input.invite.tenantId) {
      blockingReasons.push("tenant_not_provisioned");
    }
  }

  if (input.entitlementStatus !== "active") {
    blockingReasons.push("entitlement_not_active");
  }
  const expiry = evaluateCommercialEntitlementExpiry({
    entitlementStatus: input.entitlementStatus,
    billingMethod: input.billingMethod ?? null,
    paidThrough: input.paidThrough ?? null,
    now: input.now,
  });
  if (!expiry.activeNow && expiry.blockingReasons.length > 0) {
    blockingReasons.push("entitlement_expired");
  }

  const normalizedInviteEmail = input.invite?.normalizedEmail ?? null;
  const normalizedUserEmail = input.userEmail ? normalizeCommercialEmail(input.userEmail) : null;
  if (normalizedInviteEmail && normalizedUserEmail && normalizedInviteEmail !== normalizedUserEmail) {
    blockingReasons.push("authenticated_email_mismatch");
  }

  if (input.existingOwnerUserId && input.userId && input.existingOwnerUserId !== input.userId) {
    blockingReasons.push("tenant_already_claimed");
  }

  if (
    input.dietitianTenantId &&
    input.invite?.tenantId &&
    input.dietitianTenantId !== input.invite.tenantId
  ) {
    blockingReasons.push("dietitian_profile_bound_elsewhere");
  }

  const alreadyClaimed = Boolean(
    input.hasMembershipOnTenant && input.hasDietitianProfileOnTenant && input.userId,
  );

  const claimable =
    !alreadyClaimed &&
    blockingReasons.length === 0 &&
    Boolean(input.invite?.tenantId) &&
    input.entitlementStatus === "active";

  return {
    claimable: alreadyClaimed || claimable,
    alreadyClaimed,
    blockingReasons,
    tenantId: input.invite?.tenantId ?? null,
    commercialInviteId: input.invite?.id ?? null,
    normalizedInviteEmail,
  };
}

export function summarizePhase84eCustomerOnboarding() {
  return {
    phase84eVersion: PHASE_84E_VERSION,
    statusEndpoint: "/api/commercial/onboarding/status",
    claimEndpoint: "/api/commercial/onboarding/claim",
    auditTable: "commercial_onboarding_events",
    productionPilotGo: false,
  };
}
