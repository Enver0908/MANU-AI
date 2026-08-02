import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  normalizeCommercialEmail,
  validateNormalizedCommercialEmail,
} from "./phase-83b-commercial-entitlement-model";
import { buildAuthCallbackUrlWithNext } from "./phase-84d-customer-auth";

export const PHASE_85_STAGE_4D_ACCOUNT_SECURITY_VERSION = "p85-stage-4d-account-security-v1";
export const ACCOUNT_RECOVERY_FLOW_COOKIE_NAME = "manu_account_recovery_flow";
export const ACCOUNT_RECOVERY_FLOW_TTL_SECONDS = 10 * 60;

export const ACCOUNT_SECURITY_EVENT_TYPES = [
  "password_login",
  "reauthenticate_requested",
  "password_updated",
  "password_reset_requested",
  "email_change_requested",
  "logout_local",
  "recovery_password_set",
  "session_locked",
  "session_started",
] as const;

export type AccountSecurityEventType = (typeof ACCOUNT_SECURITY_EVENT_TYPES)[number];

export type AccountSecurityOutcome = "success" | "failure" | "accepted";

export const ACCOUNT_SECURITY_RATE_LIMITS = {
  passwordLogin: { scope: "auth_password_login" as const, limit: 8, windowMs: 60_000 },
  passwordReset: { scope: "auth_password_reset" as const, limit: 6, windowMs: 60_000 },
  reauthenticate: { scope: "auth_reauthenticate" as const, limit: 6, windowMs: 60_000 },
  passwordUpdate: { scope: "auth_password_update" as const, limit: 8, windowMs: 60_000 },
  emailChange: { scope: "auth_email_change" as const, limit: 4, windowMs: 60_000 },
};

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[A-Za-z\d\S]{12,128}$/;

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export class AccountSecurityValidationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "AccountSecurityValidationError";
    this.code = code;
  }
}

export function isAccountSecurityEventType(value: string): value is AccountSecurityEventType {
  return (ACCOUNT_SECURITY_EVENT_TYPES as readonly string[]).includes(value);
}

export function validateAccountEmail(value: unknown): string {
  const normalized = normalizeCommercialEmail(String(value ?? ""));
  const validation = validateNormalizedCommercialEmail(normalized);
  if (!validation.valid) {
    throw new AccountSecurityValidationError("invalid_email");
  }
  return normalized;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new AccountSecurityValidationError("invalid_password");
  }
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 128) {
    throw new AccountSecurityValidationError("invalid_password");
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new AccountSecurityValidationError("invalid_password");
  }
  if (!PASSWORD_COMPLEXITY.test(trimmed)) {
    throw new AccountSecurityValidationError("weak_password");
  }
  return trimmed;
}

export function validatePasswordPair(password: unknown, passwordConfirmation: unknown): string {
  const normalizedPassword = validatePassword(password);
  if (typeof passwordConfirmation !== "string" || passwordConfirmation.trim() !== normalizedPassword) {
    throw new AccountSecurityValidationError("password_mismatch");
  }
  return normalizedPassword;
}

export function validateNonce(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 512) {
    throw new AccountSecurityValidationError("invalid_nonce");
  }
  return value.trim();
}

export function buildAccountRecoveryCallbackUrl(env: Record<string, string | undefined> = process.env) {
  return buildAuthCallbackUrlWithNext("/account/recovery", undefined, env);
}

export function buildEmailChangeCallbackUrl(env: Record<string, string | undefined> = process.env) {
  return buildAuthCallbackUrlWithNext("/dashboard/settings?tab=security", undefined, env);
}

export function buildAccountRecoveryFlowCookieValue(input: {
  authUserId: string;
  nowMs?: number;
  env?: Record<string, string | undefined>;
}) {
  const issuedAtMs = input.nowMs ?? Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      sub: input.authUserId,
      iat: issuedAtMs,
    }),
  ).toString("base64url");
  const signature = signRecoveryCookiePayload(payload, input.env);
  return `${payload}.${signature}`;
}

export function verifyAccountRecoveryFlowCookie(input: {
  value: string | undefined | null;
  authUserId: string;
  nowMs?: number;
  env?: Record<string, string | undefined>;
}) {
  if (!input.value || !input.value.includes(".")) {
    return false;
  }
  const [payload, signature] = input.value.split(".", 2);
  const expected = signRecoveryCookiePayload(payload, input.env);
  if (!safeEqual(signature, expected)) {
    return false;
  }

  let decoded: { sub?: unknown; iat?: unknown };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; iat?: unknown };
  } catch {
    return false;
  }
  if (decoded.sub !== input.authUserId || typeof decoded.iat !== "number") {
    return false;
  }
  const ageMs = (input.nowMs ?? Date.now()) - decoded.iat;
  return ageMs >= 0 && ageMs <= ACCOUNT_RECOVERY_FLOW_TTL_SECONDS * 1000;
}

export function buildAccountSecurityIdempotencyKey(
  eventType: AccountSecurityEventType,
  authUserId: string,
  suffix?: string,
) {
  const material = `${eventType}:${authUserId}:${suffix ?? randomUUID()}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 64);
}

export function minimizeAccountSecurityMetadata(input?: Record<string, unknown>) {
  if (!input) {
    return { minimized: true };
  }
  const allowedKeys = new Set(["minimized", "providerCode", "auditPersistFailed"]);
  const metadata: Record<string, unknown> = { minimized: true };
  for (const [key, value] of Object.entries(input)) {
    if (!allowedKeys.has(key)) continue;
    if (key === "providerCode" && typeof value === "string" && value.length <= 64) {
      metadata.providerCode = value;
    }
    if (key === "auditPersistFailed" && value === true) {
      metadata.auditPersistFailed = true;
    }
  }
  return metadata;
}

export function mapSupabaseAuthErrorMessage(message: string | undefined): string {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid_credentials")) {
    return "invalid_credentials";
  }
  if (normalized.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (normalized.includes("same password")) {
    return "same_password";
  }
  if (normalized.includes("weak password") || normalized.includes("password should be")) {
    return "weak_password";
  }
  if (normalized.includes("nonce") && (normalized.includes("expired") || normalized.includes("invalid"))) {
    return "invalid_or_expired_nonce";
  }
  if (normalized.includes("email address is already registered") || normalized.includes("already been registered")) {
    return "email_already_registered";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "rate_limit_exceeded";
  }
  if (normalized.includes("recovery") && normalized.includes("expired")) {
    return "recovery_expired";
  }
  return "auth_provider_error";
}

export function genericMagicLinkAcceptedResponse() {
  return { sent: true, message: "If an account exists, a sign-in link was sent." };
}

function signRecoveryCookiePayload(payload: string, env: Record<string, string | undefined> = process.env) {
  const secret =
    env.MANU_ACCOUNT_RECOVERY_COOKIE_SECRET ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.MANU_RATE_LIMIT_KEY_SECRET ||
    "local-development-account-recovery-cookie-key";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
