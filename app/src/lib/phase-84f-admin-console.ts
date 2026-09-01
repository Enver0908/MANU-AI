/**
 * Phase 84F professional admin console: allowlist auth and host routing helpers.
 */

import { normalizeCommercialEmail } from "./phase-83b-commercial-entitlement-model";
import { buildAuthCallbackUrlWithNext, resolveAppBaseUrl } from "./phase-84d-customer-auth";

export const PHASE_84F_VERSION = "phase84f-admin-console-v1";

export const DEFAULT_ADMIN_ALLOWLIST_EMAIL = "olkuenver@gmail.com";

export const DEFAULT_ADMIN_HOST = "admin.aiyaworkspace.com";

export type AdminAllowlistEvaluation = {
  allowed: boolean;
  normalizedEmail: string;
  blockingReasons: string[];
};

export function resolveAdminEmailAllowlist(env: Record<string, string | undefined> = process.env) {
  const raw = env.MANU_ADMIN_EMAIL_ALLOWLIST?.trim() || DEFAULT_ADMIN_ALLOWLIST_EMAIL;
  return raw
    .split(",")
    .map((entry) => normalizeCommercialEmail(entry))
    .filter(Boolean);
}

export function resolveAdminHost(env: Record<string, string | undefined> = process.env) {
  return env.MANU_ADMIN_HOST?.trim() || DEFAULT_ADMIN_HOST;
}

export function resolveAdminAppBaseUrl(env: Record<string, string | undefined> = process.env) {
  const configured = env.MANU_ADMIN_APP_URL?.trim();
  if (configured) {
    const normalizedConfigured = configured.replace(/\/$/, "");
    const normalizedPublicUrl = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
    if (normalizedPublicUrl) {
      try {
        const configuredUrl = new URL(normalizedConfigured);
        const publicUrl = new URL(normalizedPublicUrl);
        const configuredIsLocalhost =
          configuredUrl.hostname === "localhost" ||
          configuredUrl.hostname === "127.0.0.1" ||
          configuredUrl.hostname === "::1";
        if (configuredIsLocalhost || configuredUrl.hostname !== publicUrl.hostname) {
          return normalizedConfigured;
        }
      } catch {
        return normalizedConfigured;
      }
    } else {
      return normalizedConfigured;
    }
  }
  const publicAppUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  const normalizedPublicUrl = publicAppUrl?.replace(/\/$/, "");
  if (normalizedPublicUrl && /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(normalizedPublicUrl)) {
    return resolveAppBaseUrl(env);
  }
  return `https://${resolveAdminHost(env)}`;
}

export function buildAdminAuthCallbackUrlWithNext(
  nextPath = "/admin",
  env: Record<string, string | undefined> = process.env,
) {
  return buildAuthCallbackUrlWithNext(nextPath, resolveAdminAppBaseUrl(env), env);
}

export function isAdminHost(hostname: string, env: Record<string, string | undefined> = process.env) {
  const normalized = hostname.trim().toLowerCase();
  const configured = resolveAdminHost(env).toLowerCase();
  return normalized === configured;
}

export function evaluateAdminAllowlistAccess(
  email: string | null | undefined,
  allowlist: string[] = resolveAdminEmailAllowlist(),
): AdminAllowlistEvaluation {
  const normalizedEmail = normalizeCommercialEmail(email ?? "");
  const blockingReasons: string[] = [];

  if (!normalizedEmail) {
    blockingReasons.push("admin_email_required");
  } else if (!allowlist.includes(normalizedEmail)) {
    blockingReasons.push("admin_email_not_allowlisted");
  }

  return {
    allowed: blockingReasons.length === 0,
    normalizedEmail,
    blockingReasons,
  };
}

export function shouldRewriteAdminHostPath(pathname: string) {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/")
  ) {
    return false;
  }
  return !pathname.startsWith("/admin");
}

export function resolveAdminHostInternalPath(pathname: string) {
  return pathname.startsWith("/admin") ? pathname : "/admin";
}

export function summarizePhase84fAdminConsole(env: Record<string, string | undefined> = process.env) {
  return {
    phase84fVersion: PHASE_84F_VERSION,
    adminPath: "/admin",
    emergencyTokenPath: "/commercial-admin/emergency",
    adminHost: resolveAdminHost(env),
    adminCallbackUrl: buildAdminAuthCallbackUrlWithNext("/admin", env),
    allowlist: resolveAdminEmailAllowlist(env),
    productionPilotGo: false,
  };
}
