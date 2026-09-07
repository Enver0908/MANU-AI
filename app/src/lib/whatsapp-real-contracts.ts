import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelDeliveryStatus } from "./types";
import { normalizeChannelEventBatch, type RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";

export const WHATSAPP_REAL_CONTRACT_VERSION = "production-readiness-stage-1-phase-3-whatsapp-real-v1";

export type WhatsAppWebhookChallengeInput = {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
};

export type WhatsAppWebhookChallengeResult =
  | { ok: true; challenge: string }
  | { ok: false; status: 400 | 403; code: "missing_challenge" | "invalid_challenge_token" };

export type WhatsAppWebhookSignatureResult =
  | { ok: true }
  | { ok: false; code: "missing_app_secret" | "missing_signature" | "invalid_signature_format" | "invalid_signature" };

export type WhatsAppRealEventAdmission =
  | {
      ok: true;
      candidates: RawChannelEventCandidate[];
      payloadDigest: string;
      schemaVersion: typeof WHATSAPP_REAL_CONTRACT_VERSION;
    }
  | { ok: false; code: "malformed_payload"; reason: string };

export type WhatsAppOutboundExecutionState =
  | "queued"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";

export type WhatsAppSendFailureClass = "definite_temporary" | "definite_permanent" | "ambiguous_network";

export type WhatsAppRetryDecision =
  | { retry: true; nextAttemptAt: string; reason: "temporary_provider_failure" }
  | { retry: false; reason: "retry_budget_exhausted" | "permanent_failure" | "ambiguous_transport_unknown" };

const SIGNATURE_PREFIX = "sha256=";
const MAX_DEFINITE_TEMPORARY_RETRIES = 3;

const DELIVERY_STATUS_ORDER: Record<Exclude<ChannelDeliveryStatus, "failed">, number> = {
  unknown: -1,
  accepted: 1,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function isRealWhatsAppWebhookEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED === "true";
}

export function evaluateWhatsAppWebhookChallenge(
  input: WhatsAppWebhookChallengeInput,
  configuredVerifyToken: string | undefined,
): WhatsAppWebhookChallengeResult {
  if (!input.challenge || input.mode !== "subscribe") {
    return { ok: false, status: 400, code: "missing_challenge" };
  }

  if (!configuredVerifyToken || input.verifyToken !== configuredVerifyToken) {
    return { ok: false, status: 403, code: "invalid_challenge_token" };
  }

  return { ok: true, challenge: input.challenge };
}

export function verifyWhatsAppWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string | undefined;
}): WhatsAppWebhookSignatureResult {
  if (!input.appSecret) {
    return { ok: false, code: "missing_app_secret" };
  }
  if (!input.signatureHeader) {
    return { ok: false, code: "missing_signature" };
  }
  if (!input.signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, code: "invalid_signature_format" };
  }

  const providedHex = input.signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(providedHex)) {
    return { ok: false, code: "invalid_signature_format" };
  }

  const expected = createHmac("sha256", input.appSecret).update(input.rawBody, "utf8").digest();
  const provided = Buffer.from(providedHex, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, code: "invalid_signature" };
  }

  return { ok: true };
}

export function buildWhatsAppWebhookSignature(rawBody: string, appSecret: string): string {
  return `${SIGNATURE_PREFIX}${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

export function buildWhatsAppRealEventAdmission(payload: unknown): WhatsAppRealEventAdmission {
  const normalized = normalizeChannelEventBatch(payload);
  if (!normalized.ok) {
    return { ok: false, code: "malformed_payload", reason: normalized.reason };
  }

  return {
    ok: true,
    candidates: normalized.candidates,
    payloadDigest: digestJson(payload),
    schemaVersion: WHATSAPP_REAL_CONTRACT_VERSION,
  };
}

export function hasWhatsAppAccountSelector(candidate: RawChannelEventCandidate): boolean {
  return Boolean(candidate.wabaId || candidate.businessPhoneNumberId || candidate.providerAccountId);
}

export function shouldApplyWhatsAppDeliveryTransition(input: {
  current: WhatsAppOutboundExecutionState | ChannelDeliveryStatus;
  next: WhatsAppOutboundExecutionState | ChannelDeliveryStatus;
}): boolean {
  if (input.current === "unknown") return false;
  if (input.current === "failed") return false;
  if (input.next === "unknown") return true;
  if (input.next === "failed") return true;

  const currentRank = input.current === "queued" ? 0 : input.current === "sending" ? 0 : input.current === "accepted" ? 1 : DELIVERY_STATUS_ORDER[input.current as keyof typeof DELIVERY_STATUS_ORDER] ?? 0;
  const nextRank = input.next === "queued" ? 0 : input.next === "sending" ? 0 : input.next === "accepted" ? 1 : DELIVERY_STATUS_ORDER[input.next as keyof typeof DELIVERY_STATUS_ORDER] ?? 0;
  return nextRank >= currentRank;
}

export function decideWhatsAppSendRetry(input: {
  failureClass: WhatsAppSendFailureClass;
  retryCount: number;
  now: string;
  retryAfterSeconds?: number | null;
}): WhatsAppRetryDecision {
  if (input.failureClass === "ambiguous_network") {
    return { retry: false, reason: "ambiguous_transport_unknown" };
  }
  if (input.failureClass === "definite_permanent") {
    return { retry: false, reason: "permanent_failure" };
  }
  if (input.retryCount >= MAX_DEFINITE_TEMPORARY_RETRIES) {
    return { retry: false, reason: "retry_budget_exhausted" };
  }

  const delaySeconds = Math.max(1, input.retryAfterSeconds ?? 60);
  const nextAttemptAt = new Date(new Date(input.now).getTime() + delaySeconds * 1000).toISOString();
  return { retry: true, nextAttemptAt, reason: "temporary_provider_failure" };
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
