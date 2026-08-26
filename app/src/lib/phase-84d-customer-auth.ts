/**
 * Phase 84D customer auth foundation: magic-link validation and safe redirect logic.
 */

import { normalizeCommercialEmail, validateNormalizedCommercialEmail } from "./commercial-email";
import { deriveDashboardAccessGate } from "./phase-83e3-app-shell";

export const PHASE_84D_VERSION = "phase84d-customer-auth-v1";

export const MAGIC_LINK_RATE_LIMIT = {
  limit: 1,
  windowMs: 60_000,
} as const;

export const POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/settings",
  "/install",
  "/ai-chat",
  "/more",
] as const;

export const MAGIC_LINK_SEND_RETRY_DELAYS_MS = [250, 750, 1500] as const;

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

export type MagicLinkSendResult = {
  error?: {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
  } | null;
};

export type MagicLinkSendAttempt = () => Promise<MagicLinkSendResult>;

export function resolveAppBaseUrl(env: Record<string, string | undefined> = process.env) {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return assertAllowedAuthBaseUrl(configured.replace(/\/$/, ""));
  }
  return "http://127.0.0.1:3000";
}

export function buildAuthCallbackUrl(baseUrl?: string, env: Record<string, string | undefined> = process.env) {
  return `${assertAllowedAuthBaseUrl(baseUrl ?? resolveAppBaseUrl(env))}/auth/callback`;
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

function readErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return `${error.name} ${error.message} ${readErrorText(error.cause)}`.trim();
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [
      record.name,
      record.code,
      record.status,
      record.message,
      readErrorText(record.cause),
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

export function isTransientMagicLinkSendFailure(error: unknown) {
  const text = readErrorText(error);
  if (/\b(500|502|503|504)\b/.test(text)) return true;
  return /fetch failed|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|UND_ERR|network/i.test(text);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function sendMagicLinkWithRetry(send: MagicLinkSendAttempt) {
  let lastTransientError: unknown = null;

  for (let attempt = 0; attempt <= MAGIC_LINK_SEND_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const result = await send();
      if (!result.error) return result;
      if (!isTransientMagicLinkSendFailure(result.error)) return result;
      lastTransientError = result.error;
    } catch (error) {
      if (!isTransientMagicLinkSendFailure(error)) {
        throw error;
      }
      lastTransientError = error;
    }

    const retryDelay = MAGIC_LINK_SEND_RETRY_DELAYS_MS[attempt];
    if (retryDelay === undefined) break;
    await sleep(retryDelay);
  }

  return {
    error: {
      code: "auth_provider_unavailable",
      message: readErrorText(lastTransientError) || "auth provider unavailable",
      status: 503,
    },
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
  const allowed = POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES.some(
    (prefix) =>
      candidate === prefix ||
      candidate.startsWith(`${prefix}/`) ||
      candidate.startsWith(`${prefix}?`),
  );
  return allowed ? candidate : null;
}

export function parseRetryAfterSeconds(response: Response, fallback = MAGIC_LINK_RATE_LIMIT.windowMs / 1000) {
  const header = response.headers.get("Retry-After");
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }
  return fallback;
}

export function assertAllowedAuthBaseUrl(baseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("unsafe_auth_redirect_base_url");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new Error("unsafe_auth_redirect_base_url");
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
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
