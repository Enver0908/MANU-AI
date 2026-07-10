import type { AuditEventRecord, ChannelEventKind, ChannelEventRecord, ManuAppState } from "./types";
import {
  normalizeChannelEventBatch,
  type ChannelEventBatchNormalizationResult,
  type RawChannelEventCandidate,
} from "./phase-85-if-c-channel-event-normalizer";
import { routeChannelEvent } from "./phase-85-if-c-channel-event-routing";
import { processMockChannelInbound } from "./channel-adapters";

// Phase 85 Interstage Foundation - P85-IF-C ledger, secure gate, quarantine, and replay.
//
// Scope note: this module implements the ingress/ledger/routing/quarantine engine only. It
// does not replace the existing `/api/whatsapp/webhook` route (`whatsapp-mock-webhook.ts`),
// which keeps its current single-message behavior unchanged for backward compatibility. Only
// `client_message_text` events that fully resolve through the new routing pipeline are
// delegated to the existing, unmodified `processMockChannelInbound` orchestrator path so
// current client-facing behavior does not change. All other event kinds (business-human
// echoes, statuses, history, edit/revoke, media, quarantine cases) are ledger-recorded only.
// Storing business-human echoes as verified `dietitian_manual` messages, auto-pausing AI, and
// opening human-control sessions are P85-IF-D scope, not P85-IF-C.

export const PHASE_85_IF_C_LEDGER_VERSION = "p85-if-c-channel-event-ledger-v1";
export const CHANNEL_EVENT_PAYLOAD_SCHEMA_VERSION = "p85-if-c-v1";
export const MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS = 7;

const NEW_MESSAGE_EVENT_KINDS: ReadonlySet<ChannelEventKind> = new Set([
  "client_message_text",
  "client_message_media_unsupported",
  "business_human_echo_text",
  "business_human_echo_media_unsupported",
  "history_client_message",
  "history_business_human_message",
]);

export type SecureChannelIngressGateResult = {
  enabled: boolean;
  blockingReasons: string[];
};

export function resolveSecureChannelIngressGate(
  env: NodeJS.ProcessEnv,
  providedSecret: string | null | undefined,
): SecureChannelIngressGateResult {
  const blockingReasons: string[] = [];

  if (env.NODE_ENV === "production") {
    blockingReasons.push("production_execution_refused");
  }
  if (env.MANU_HOSTED_SANDBOX_ACTIVE === "true") {
    blockingReasons.push("hosted_sandbox_refused");
  }
  if (env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK !== "true") {
    blockingReasons.push("mock_webhook_feature_gate_disabled");
  }

  const requiredSecret = env.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET?.trim() || null;
  if (!requiredSecret) {
    blockingReasons.push("mock_webhook_secret_not_configured");
  }

  if (!providedSecret || !requiredSecret || !secretsMatch(providedSecret, requiredSecret)) {
    blockingReasons.push("mock_webhook_secret_mismatch");
  }

  return { enabled: blockingReasons.length === 0, blockingReasons };
}

function secretsMatch(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export type ChannelEventIngressOutcome = {
  candidate: RawChannelEventCandidate;
  event: ChannelEventRecord;
};

export type ChannelEventIngressResult =
  | { ok: false; code: "secure_ingress_gate_disabled"; blockingReasons: string[] }
  | { ok: false; code: "malformed_payload"; reason: string }
  | { ok: true; outcomes: ChannelEventIngressOutcome[] };

export async function processInboundWhatsAppChannelBatch(
  state: ManuAppState,
  payload: unknown,
  options: { providedSecret?: string | null; env?: NodeJS.ProcessEnv } = {},
): Promise<{ state: ManuAppState; result: ChannelEventIngressResult }> {
  const gate = resolveSecureChannelIngressGate(options.env ?? process.env, options.providedSecret ?? null);
  if (!gate.enabled) {
    return { state, result: { ok: false, code: "secure_ingress_gate_disabled", blockingReasons: gate.blockingReasons } };
  }

  const normalized: ChannelEventBatchNormalizationResult = normalizeChannelEventBatch(payload);
  if (!normalized.ok) {
    return { state, result: { ok: false, code: normalized.code, reason: normalized.reason } };
  }

  let workingState = state;
  const outcomes: ChannelEventIngressOutcome[] = [];

  for (const candidate of normalized.candidates) {
    const { state: nextState, outcome } = await ingestSingleCandidate(workingState, candidate);
    workingState = nextState;
    outcomes.push(outcome);
  }

  return { state: workingState, result: { ok: true, outcomes } };
}

async function ingestSingleCandidate(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
): Promise<{ state: ManuAppState; outcome: ChannelEventIngressOutcome }> {
  if (candidate.providerEventId) {
    const existingEvent = state.channelEvents.find((event) => event.providerEventId === candidate.providerEventId);
    if (existingEvent) {
      return {
        state: appendAudit(state, "channel_event_duplicate", candidate, existingEvent.id, ["duplicate_event"]),
        outcome: { candidate, event: existingEvent },
      };
    }
  }

  if (NEW_MESSAGE_EVENT_KINDS.has(candidate.eventKind) && candidate.providerEventId) {
    const duplicateMessage = state.messages.find((message) => message.providerMessageId === candidate.providerEventId);
    if (duplicateMessage) {
      const record = buildLedgerRecord(state, candidate, {
        processingStatus: "duplicate",
        eventKindOverride: "duplicate_message",
        accountBindingId: duplicateMessage.providerAccountBindingId ?? null,
      });
      const withEvent = pushChannelEvent(state, record);
      return {
        state: appendAudit(withEvent, "channel_event_duplicate_message", candidate, record.id, ["duplicate_message"]),
        outcome: { candidate, event: record },
      };
    }
  }

  const routing = routeChannelEvent(state, candidate);

  if (routing.status === "quarantined") {
    const record = buildLedgerRecord(state, candidate, {
      processingStatus: "quarantined",
      eventKindOverride: routing.finalEventKind,
      accountBindingId: null,
    });
    const withEvent = pushChannelEvent(state, record);
    return {
      state: appendAudit(withEvent, "channel_event_quarantined", candidate, record.id, routing.quarantineReasons),
      outcome: { candidate, event: record },
    };
  }

  const record = buildLedgerRecord(state, candidate, {
    processingStatus: "committed",
    eventKindOverride: routing.finalEventKind,
    accountBindingId: routing.accountBindingId,
  });
  let nextState = pushChannelEvent(state, record);

  if (routing.finalEventKind === "client_message_text" && routing.clientId && candidate.providerEventId && candidate.counterpartyIdentity) {
    nextState = await processMockChannelInbound(nextState, {
      channel: "whatsapp",
      providerEventId: candidate.providerEventId,
      channelUserId: candidate.counterpartyIdentity,
      body: candidate.body ?? "",
      receivedAt: candidate.providerTime ?? undefined,
      sourceConversationType: "direct",
      sourceMessageId: candidate.providerEventId,
      messageType: "text",
    });
  }

  return { state: nextState, outcome: { candidate, event: record } };
}

function buildLedgerRecord(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
  options: {
    processingStatus: ChannelEventRecord["processingStatus"];
    eventKindOverride: ChannelEventKind;
    accountBindingId: string | null;
  },
): ChannelEventRecord {
  const now = new Date().toISOString();
  const isNewMessage = NEW_MESSAGE_EVENT_KINDS.has(options.eventKindOverride);

  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    accountBindingId: options.accountBindingId,
    eventKind: options.eventKindOverride,
    processingStatus: options.processingStatus,
    providerAccountId: candidate.providerAccountId,
    providerEventId: candidate.providerEventId,
    providerMessageId: candidate.providerMessageId ?? (isNewMessage ? candidate.providerEventId : null),
    fromIdentity: candidate.fromIdentity,
    toIdentity: candidate.toIdentity,
    counterpartyIdentity: candidate.counterpartyIdentity,
    payloadDigest: candidate.payloadDigest,
    payloadSchemaVersion: CHANNEL_EVENT_PAYLOAD_SCHEMA_VERSION,
    providerTime: candidate.providerTime,
    observedAt: now,
    committedAt: options.processingStatus === "committed" ? now : null,
    quarantineId: null,
    replayOfEventId: null,
    retryCount: 0,
    internalSequence: state.channelEvents.length + 1,
  };
}

function pushChannelEvent(state: ManuAppState, event: ChannelEventRecord): ManuAppState {
  return { ...state, channelEvents: [...state.channelEvents, event] };
}

function replaceChannelEvent(state: ManuAppState, updated: ChannelEventRecord): ManuAppState {
  return {
    ...state,
    channelEvents: state.channelEvents.map((event) => (event.id === updated.id ? updated : event)),
  };
}

function appendAudit(
  state: ManuAppState,
  eventType: string,
  candidate: RawChannelEventCandidate,
  entityId: string,
  reasons: string[],
): ManuAppState {
  const auditEvent: AuditEventRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType: "channel_event",
    entityId,
    metadata: {
      eventKind: candidate.eventKind,
      reasons,
      providerEventIdPresent: Boolean(candidate.providerEventId),
    },
    createdAt: new Date().toISOString(),
  };

  return { ...state, auditEvents: [...state.auditEvents, auditEvent] };
}

export type ChannelEventReplayResult =
  | { ok: false; code: "event_not_found" }
  | { ok: false; code: "not_quarantined" }
  | { ok: false; code: "replay_expired" }
  | { ok: true; event: ChannelEventRecord };

export function replayQuarantinedChannelEvent(
  state: ManuAppState,
  channelEventId: string,
  candidate: RawChannelEventCandidate,
  now: string = new Date().toISOString(),
): { state: ManuAppState; result: ChannelEventReplayResult } {
  const existing = state.channelEvents.find((event) => event.id === channelEventId);
  if (!existing) {
    return { state, result: { ok: false, code: "event_not_found" } };
  }
  if (existing.processingStatus !== "quarantined") {
    return { state, result: { ok: false, code: "not_quarantined" } };
  }

  const ageMs = new Date(now).getTime() - new Date(existing.observedAt).getTime();
  if (ageMs > MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    const expired: ChannelEventRecord = { ...existing, processingStatus: "expired" };
    return { state: replaceChannelEvent(state, expired), result: { ok: false, code: "replay_expired" } };
  }

  const routing = routeChannelEvent(state, candidate);
  const retryCount = existing.retryCount + 1;

  if (routing.status === "quarantined") {
    const stillQuarantined: ChannelEventRecord = {
      ...existing,
      eventKind: routing.finalEventKind,
      retryCount,
    };
    return { state: replaceChannelEvent(state, stillQuarantined), result: { ok: true, event: stillQuarantined } };
  }

  const replayed: ChannelEventRecord = {
    ...existing,
    eventKind: routing.finalEventKind,
    accountBindingId: routing.accountBindingId,
    processingStatus: "replayed",
    committedAt: now,
    retryCount,
  };
  return { state: replaceChannelEvent(state, replayed), result: { ok: true, event: replayed } };
}

export function expireStaleQuarantinedChannelEvents(
  state: ManuAppState,
  now: string = new Date().toISOString(),
): ManuAppState {
  const cutoffMs = new Date(now).getTime() - MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return {
    ...state,
    channelEvents: state.channelEvents.map((event) =>
      event.processingStatus === "quarantined" && new Date(event.observedAt).getTime() < cutoffMs
        ? { ...event, processingStatus: "expired" }
        : event,
    ),
  };
}
