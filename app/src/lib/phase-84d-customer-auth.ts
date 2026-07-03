/**
 * Phase 84D customer auth foundation: magic-link validation and safe redirect logic.
 */

import {
  normalizeCommercialEmail,
  validateNormalizedCommercialEmail,
} from "./phase-83b-commercial-entitlement-model";
import { deriveDashboardAccessGate } from "./phase-83e3-app-shell";

export const PHASE_84D_VERSION = "phase84d-customer-auth-v1";

export const MAGIC_LINK_RATE_LIMIT = {
  limit: 6,
  windowMs: 60_000,
} as const;

export type CustomerAuthRedirectTarget =
  | "/login"
  | "/dashboard"
  | "/onboarding"
  | "/onboarding?state=support";

export type CustomerSessionFacts = {
  isAuthenticated: boolean;
  normalizedEmail: string | null;
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: import("./phase-83b-commercial-entitlement-model").CommercialEntitlementStatus | null;
  hasClaimablePaidWorkspace: boolean;
};

export function resolveAppBaseUrl(env: Record<string, string | undefined> = process.env) {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3000";
}

export function buildAuthCallbackUrl(baseUrl?: string, env: Record<string, string | undefined> = process.env) {
  return `${baseUrl ?? resolveAppBaseUrl(env)}/auth/callback`;
}

export function buildAuthCallbackUrlWithNext(
  nextPath?: string | null,
  baseUrl?: string,
  env: Record<string, string | undefined> = process.env,
) {
  const callbackUrl = buildAuthCallbackUrl(baseUrl, env);
  const safeNext = sanitizePostAuthRedirectPath(nextPath);
  if (!safeNext) {
    return callbackUrl;
  }
  return `${callbackUrl}?next=${encodeURIComponent(safeNext)}`;
}

export function validateMagicLinkRequest(input: { email?: string }) {
  const normalizedEmail = normalizeCommercialEmail(input.email ?? "");
  const validation = validateNormalizedCommercialEmail(normalizedEmail);
  return {
    valid: validation.valid,
    normalizedEmail,
    blockingReasons: validation.valid ? [] : ["email_invalid"],
  };
}

export function deriveCustomerAuthRedirect(facts: CustomerSessionFacts): CustomerAuthRedirectTarget {
  if (!facts.isAuthenticated) {
    return "/login";
  }

  if (facts.hasTenantMembership && facts.hasDietitianProfile) {
    const gate = deriveDashboardAccessGate({
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: facts.entitlementStatus,
    });
    if (gate === "ok") {
      return "/dashboard";
    }
    return "/dashboard";
  }

  if (facts.hasClaimablePaidWorkspace) {
    return "/onboarding";
  }

  return "/onboarding?state=support";
}

export function sanitizePostAuthRedirectPath(nextPath?: string | null) {
  const candidate = nextPath?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }
  if (candidate.startsWith("/api/") || candidate.startsWith("/auth/callback")) {
    return null;
  }
  return candidate;
}

export function summarizePhase84dCustomerAuth(env: Record<string, string | undefined> = process.env) {
  return {
    phase84dVersion: PHASE_84D_VERSION,
    loginPath: "/login",
    callbackPath: "/auth/callback",
    magicLinkEndpoint: "/api/auth/magic-link",
    callbackUrl: buildAuthCallbackUrl(undefined, env),
    rateLimit: MAGIC_LINK_RATE_LIMIT,
    productionPilotGo: false,
  };
}
