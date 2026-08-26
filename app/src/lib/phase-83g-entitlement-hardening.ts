import type { NextRequest } from "next/server";
import { headersFromGetter, resolveTrustedClientIp } from "./trusted-proxy";
import {
  COMMERCIAL_ENTITLEMENT_STATUSES,
  type CommercialEntitlementStatus,
  evaluateCommercialDashboardAccess,
} from "./phase-83b-commercial-entitlement-model";
import { shouldServiceWorkerCachePath } from "./phase-83d-pwa-install-gate";

export const PHASE_83G_VERSION = "phase83-entitlement-hardening-v1";

export const COMMERCIAL_ENTITLEMENT_BLOCKED_API_STATUSES = COMMERCIAL_ENTITLEMENT_STATUSES.filter(
  (status) => status !== "active",
);

export const COMMERCIAL_PUBLIC_RATE_LIMITS = {
  invite_status: { limit: 12, windowMs: 60_000 },
  checkout_create: { limit: 6, windowMs: 60_000 },
  contact_leads: { limit: 5, windowMs: 60_000 },
} as const;

export type CommercialPublicRateLimitRoute = keyof typeof COMMERCIAL_PUBLIC_RATE_LIMITS;

export type CommercialEntitlementApiAccessInput = {
  isAuthenticated: boolean;
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: CommercialEntitlementStatus | null;
  enforcementEnabled: boolean;
};

export type CommercialEntitlementApiAccessResult = {
  allowed: boolean;
  skipped: boolean;
  errorCode: string | null;
  blockingReasons: string[];
};

export function isCommercialEntitlementEnforcementEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.MANU_DEV_FALLBACK_STORE === "true") {
    return false;
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && serviceRoleKey);
}

export function evaluateCommercialEntitlementApiAccess(
  input: CommercialEntitlementApiAccessInput,
): CommercialEntitlementApiAccessResult {
  if (!input.enforcementEnabled) {
    return {
      allowed: true,
      skipped: true,
      errorCode: null,
      blockingReasons: [],
    };
  }

  const access = evaluateCommercialDashboardAccess({
    isAuthenticated: input.isAuthenticated,
    hasTenantMembership: input.hasTenantMembership,
    hasDietitianProfile: input.hasDietitianProfile,
    entitlementStatus: input.entitlementStatus,
  });

  if (access.allowed) {
    return {
      allowed: true,
      skipped: false,
      errorCode: null,
      blockingReasons: [],
    };
  }

  const errorCode = deriveCommercialEntitlementErrorCode(input.entitlementStatus, access.blockingReasons);

  return {
    allowed: false,
    skipped: false,
    errorCode,
    blockingReasons: access.blockingReasons,
  };
}

export function deriveCommercialEntitlementErrorCode(
  entitlementStatus: CommercialEntitlementStatus | null,
  blockingReasons: string[],
) {
  if (!entitlementStatus) {
    return "entitlement_required";
  }
  if (entitlementStatus === "revoked") {
    return "entitlement_revoked";
  }
  if (entitlementStatus === "past_due") {
    return "entitlement_past_due";
  }
  if (entitlementStatus === "canceled") {
    return "entitlement_canceled";
  }
  if (entitlementStatus === "checkout_started") {
    return "entitlement_checkout_incomplete";
  }
  if (entitlementStatus === "invited") {
    return "entitlement_invite_only";
  }
  if (blockingReasons.some((reason) => reason.includes("entitlement status must be active"))) {
    return "entitlement_inactive";
  }
  return "entitlement_inactive";
}

export function resolveCommercialPublicRateLimitKey(request: NextRequest, email?: string) {
  const decision = resolveTrustedClientIp(headersFromGetter((name) => request.headers.get(name)));
  const ip = decision.clientIp;
  const normalizedEmail = email ? email.trim().toLowerCase() : "";
  return normalizedEmail ? `${ip}:${normalizedEmail}` : ip;
}

export { shouldTreatAuthStateAsStaleForPwa } from "./phase-83g-pwa-session";

export function summarizePhase83gEntitlementHardening() {
  return {
    phase83gVersion: PHASE_83G_VERSION,
    enforcementFlag: "active_when_supabase_store_configured_and_not_dev_fallback",
    protectedApiPolicy: "resolveAppTenantContext_requires_active_entitlement",
    publicRateLimits: COMMERCIAL_PUBLIC_RATE_LIMITS,
    serviceWorkerApiCachePolicy: "network_only",
    blockedEntitlementStatuses: [...COMMERCIAL_ENTITLEMENT_BLOCKED_API_STATUSES],
    productionPilotGo: false,
  };
}

export function verifyServiceWorkerDoesNotCacheProtectedApiPaths() {
  return {
    appStateCached: shouldServiceWorkerCachePath("/api/app-state"),
    clientsCached: shouldServiceWorkerCachePath("/api/clients"),
    commercialCheckoutCached: shouldServiceWorkerCachePath("/api/commercial/checkout"),
  };
}
