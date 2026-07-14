import type { AuditEventRecord, ChannelEventKind, ChannelEventRecord, ManuAppState } from "./types";
import {
  normalizeChannelEventBatch,
  type ChannelEventBatchNormalizationResult,
  type RawChannelEventCandidate,
} from "./phase-85-if-c-channel-event-normalizer";
import { routeChannelEvent } from "./phase-85-if-c-channel-event-routing";
import { applyRoutedTranscriptSideEffects } from "./phase-85-if-d-transcript-human-control";
import { processMockChannelInbound } from "./channel-adapters";
import {
  applyBundledClientTextIngress,
  hasActiveInboundBundle,
  integrateClientImageIntoBundle,
  integrateClientVoiceIntoBundle,
  integrateDietitianMessageIntoBundle,
} from "./phase-85-stage-4b3-message-bundles";
import {
  processStage4B3PendingMediaAssets,
  stageClientImageIngressMetadata,
} from "./phase-85-stage-4b3-media-admission";
import { processStage4B4PendingAudioAssets, stageClientAudioIngressMetadata } from "./phase-85-stage-4b4-audio-admission";
import { createStage4B4DurableAudioTransport, type Stage4B4AudioTransportPort } from "./phase-85-stage-4b4-audio-transport";
import { createInMemoryStage4B4AudioStorage, type Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import type { Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";
import type { Stage4B3MediaTransportPort } from "./phase-85-stage-4b3-media-transport";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { processStage4B3PendingVisionAnalysis } from "./phase-85-stage-4b3-vision-analysis";
import type { Stage4B3VisionProviderPort } from "./phase-85-stage-4b3-vision-provider";

// Phase 85 Interstage Foundation - P85-IF-C ledger, secure gate, quarantine, and replay.
//
// Scope note: this module implements the ingress/ledger/routing/quarantine engine only. It
// does not replace the existing `/api/whatsapp/webhook` route (`whatsapp-mock-webhook.ts`),
// which keeps its current single-message behavior unchanged for backward compatibility. Only
// `client_message_text` events that fully resolve through the new routing pipeline are
// delegated to the existing, unmodified `processMockChannelInbound` orchestrator path so
// current client-facing behavior does not change. All other event kinds (business-human
// echoes, statuses, history, edit/revoke, media, quarantine cases) are ledger-recorded only.
// P85-IF-D implements business-human transcript storage, human-control coordination, and
// edit/revoke/media/history lifecycle side effects for routed non-client-text events.

export const PHASE_85_IF_C_LEDGER_VERSION = "p85-if-c-channel-event-ledger-v1";
export const CHANNEL_EVENT_PAYLOAD_SCHEMA_VERSION = "p85-if-c-v1";
export const MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS = 7;

const TRANSCRIPT_SIDE_EFFECT_EVENT_KINDS: ReadonlySet<ChannelEventKind> = new Set([
  "business_human_echo_text",
  "business_human_echo_media_unsupported",
  "history_client_message",
  "history_business_human_message",
  "client_message_media_unsupported",
  "message_edit",
  "message_revoke",
  "outbound_status",
]);

async function applyRoutedTranscriptEffectsIfNeeded(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
  routing: Extract<ReturnType<typeof routeChannelEvent>, { status: "routed" }>,
  channelEventId: string,
  observedAt: string,
): Promise<ManuAppState> {
  if (!TRANSCRIPT_SIDE_EFFECT_EVENT_KINDS.has(routing.finalEventKind)) {
    return state;
  }

  return applyRoutedTranscriptSideEffects(state, {
    candidate,
    routing,
    channelEventId,
    observedAt,
  });
}

const NEW_MESSAGE_EVENT_KINDS: ReadonlySet<ChannelEventKind> = new Set([
  "client_message_text",
  "client_message_image",
  "client_message_audio",
  "client_message_media_unsupported",
  "business_human_echo_text",
  "business_human_echo_media_unsupported",
  "history_client_message",
  "history_business_human_message",
]);

export type Stage4B3AdmissionRuntime = {
  transport: Stage4B3MediaTransportPort;
  storage: Stage4B3MediaStoragePort;
  audioTransport?: Stage4B4AudioTransportPort;
  audioStorage?: Stage4B4AudioStoragePort;
  visionProvider?: Stage4B3VisionProviderPort;
  autoProcessPending?: boolean;
  autoProcessAudioPending?: boolean;
  autoProcessVision?: boolean;
  autoProcessBundles?: boolean;
  workerId?: string;
};

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
  options: {
    providedSecret?: string | null;
    env?: NodeJS.ProcessEnv;
    stage4b3Admission?: Stage4B3AdmissionRuntime;
    now?: string;
  } = {},
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
    const { state: nextState, outcome } = await ingestSingleCandidate(workingState, candidate, options);
    workingState = nextState;
    outcomes.push(outcome);
  }

  return { state: workingState, result: { ok: true, outcomes } };
}

async function ingestSingleCandidate(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
  options: { env?: NodeJS.ProcessEnv; stage4b3Admission?: Stage4B3AdmissionRuntime; now?: string } = {},
): Promise<{ state: ManuAppState; outcome: ChannelEventIngressOutcome }> {
  if (candidate.providerEventId) {
    const existingEvent = state.channelEvents.find(
      (event) => event.tenantId === state.tenant.id && event.providerEventId === candidate.providerEventId,
    );
    if (existingEvent) {
      const digestMatches = existingEvent.payloadDigest === candidate.payloadDigest;
      return {
        state: appendAudit(
          state,
          digestMatches ? "channel_event_duplicate" : "channel_event_duplicate_conflict",
          candidate,
          existingEvent.id,
          [digestMatches ? "duplicate_event" : "provider_event_payload_digest_mismatch"],
        ),
        outcome: { candidate, event: existingEvent },
      };
    }
  }

  const routing = routeChannelEvent(state, candidate);

  if (routing.status === "routed" && NEW_MESSAGE_EVENT_KINDS.has(candidate.eventKind) && candidate.providerEventId) {
    const providerMessageId = candidate.providerMessageId ?? candidate.providerEventId;
    const duplicateMessage = state.messages.find(
      (message) =>
        message.tenantId === state.tenant.id &&
        message.providerAccountBindingId === routing.accountBindingId &&
        message.providerMessageId === providerMessageId,
    );
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

  if (routing.status === "quarantined") {
    const record = buildLedgerRecord(state, candidate, {
      processingStatus: "quarantined",
      eventKindOverride: routing.finalEventKind,
      accountBindingId: routing.accountBindingId,
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
    observedAt: options.now,
  });
  let nextState = pushChannelEvent(state, record);
  const ingressContext = {
    candidate,
    routing,
    channelEventId: record.id,
    observedAt: record.observedAt,
  };

  if (routing.finalEventKind === "client_message_text") {
    if (routing.conversationId && hasActiveInboundBundle(nextState, routing.conversationId)) {
      nextState = applyBundledClientTextIngress(nextState, ingressContext);
    } else {
      nextState = await applyRoutedClientInbound(nextState, candidate, routing, record.observedAt);
    }
  } else if (routing.finalEventKind === "client_message_image") {
    nextState = stageClientImageIngressMetadata(nextState, ingressContext);
    const message = nextState.messages[nextState.messages.length - 1];
    const asset = nextState.mediaAssets[nextState.mediaAssets.length - 1];
    if (message && asset) {
      nextState = integrateClientImageIntoBundle(nextState, ingressContext, message.id, asset.id);
    }
    if (options.stage4b3Admission?.autoProcessPending !== false && options.stage4b3Admission) {
      nextState = await processStage4B3PendingMediaAssets(nextState, {
        transport: options.stage4b3Admission.transport,
        storage: options.stage4b3Admission.storage,
        now: record.observedAt,
      });
    }
    if (
      options.stage4b3Admission?.autoProcessVision !== false &&
      options.stage4b3Admission?.visionProvider
    ) {
      nextState = await processStage4B3PendingVisionAnalysis(nextState, {
        env: options.env ?? process.env,
        provider: options.stage4b3Admission.visionProvider,
        now: record.observedAt,
      });
    }
    if (options.stage4b3Admission?.autoProcessBundles !== false && options.stage4b3Admission) {
      const worker = await processStage4B3DueInboundBundles(nextState, {
        workerId: options.stage4b3Admission.workerId ?? "stage4b3-ledger-worker",
        now: record.observedAt,
        finalizeClaims: false,
      });
      nextState = worker.state;
    }
  } else if (routing.finalEventKind === "client_message_audio") {
    nextState = stageClientAudioIngressMetadata(nextState, ingressContext);
    const message = nextState.messages[nextState.messages.length - 1];
    const asset = nextState.mediaAssets[nextState.mediaAssets.length - 1];
    if (message && asset) {
      nextState = integrateClientVoiceIntoBundle(nextState, ingressContext, message.id, asset.id);
    }
    const audioTransport = options.stage4b3Admission?.audioTransport ?? createStage4B4DurableAudioTransport();
    const audioStorage = options.stage4b3Admission?.audioStorage ?? createInMemoryStage4B4AudioStorage();
    if (options.stage4b3Admission?.autoProcessAudioPending !== false) {
      nextState = await processStage4B4PendingAudioAssets(nextState, {
        transport: audioTransport,
        storage: audioStorage,
        now: record.observedAt,
      });
    }
    if (options.stage4b3Admission?.autoProcessBundles !== false && options.stage4b3Admission) {
      const worker = await processStage4B3DueInboundBundles(nextState, {
        workerId: options.stage4b3Admission.workerId ?? "stage4b3-ledger-worker",
        now: record.observedAt,
        finalizeClaims: false,
      });
      nextState = worker.state;
    }
  } else if (routing.finalEventKind === "business_human_echo_text" && routing.conversationId) {
    nextState = await applyRoutedTranscriptEffectsIfNeeded(
      nextState,
      candidate,
      routing,
      record.id,
      record.observedAt,
    );
    const dietitianMessage = nextState.messages[nextState.messages.length - 1];
    if (dietitianMessage && dietitianMessage.origin === "dietitian_manual") {
      nextState = integrateDietitianMessageIntoBundle(nextState, {
        conversationId: routing.conversationId,
        messageId: dietitianMessage.id,
        observedAt: record.observedAt,
        bodyText: dietitianMessage.body,
        senderId: dietitianMessage.authorDietitianId ?? dietitianMessage.actorBindingId ?? routing.clientId ?? "business_human",
        channelEventId: record.id,
      });
    }
  } else {
    nextState = await applyRoutedTranscriptEffectsIfNeeded(
      nextState,
      candidate,
      routing,
      record.id,
      record.observedAt,
    );
  }

  nextState = appendAudit(nextState, "channel_event_committed", candidate, record.id, ["routing_complete"]);
  return { state: nextState, outcome: { candidate, event: record } };
}

async function applyRoutedClientInbound(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
  routing: Extract<ReturnType<typeof routeChannelEvent>, { status: "routed" }>,
  observedAt: string,
) {
  if (!routing.clientId || !routing.conversationId || !candidate.providerEventId || !candidate.counterpartyIdentity) {
    return state;
  }

  const existingMessageIds = new Set(state.messages.map((message) => message.id));
  const processed = await processMockChannelInbound(state, {
    channel: "whatsapp",
    providerEventId: candidate.providerEventId,
    channelUserId: candidate.counterpartyIdentity,
    body: candidate.body ?? "",
    receivedAt: candidate.providerTime ?? undefined,
    sourceConversationType: "direct",
    sourceMessageId: candidate.providerEventId,
    messageType: "text",
  });

  return {
    ...processed,
    messages: processed.messages.map((message) =>
      !existingMessageIds.has(message.id) &&
      message.tenantId === state.tenant.id &&
      message.conversationId === routing.conversationId &&
      message.sender === "client"
        ? {
            ...message,
            providerAccountBindingId: routing.accountBindingId,
            providerEventId: candidate.providerEventId,
            providerMessageId: candidate.providerMessageId ?? candidate.providerEventId,
            actorType: routing.actorType,
            actorBindingId: routing.actorBindingId,
            authorInterface: routing.authorInterface,
            actorResolutionBasis: routing.actorResolutionBasis,
            providerSentAt: candidate.providerTime,
            observedAt,
            persistedAt: observedAt,
            contentStatus: message.contentStatus ?? "available",
            retrievalEligibility: message.retrievalEligibility ?? "eligible",
          }
        : message,
    ),
  };
}

function buildLedgerRecord(
  state: ManuAppState,
  candidate: RawChannelEventCandidate,
  options: {
    processingStatus: ChannelEventRecord["processingStatus"];
    eventKindOverride: ChannelEventKind;
    accountBindingId: string | null;
    observedAt?: string;
  },
): ChannelEventRecord {
  const now = options.observedAt ?? new Date().toISOString();
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
      providerTimeInvalid: candidate.providerTimeInvalid,
    },
    createdAt: new Date().toISOString(),
  };

  return { ...state, auditEvents: [...state.auditEvents, auditEvent] };
}

export type ChannelEventReplayResult =
  | { ok: false; code: "event_not_found" }
  | { ok: false; code: "not_quarantined" }
  | { ok: false; code: "replay_not_authorized" }
  | { ok: false; code: "candidate_mismatch" }
  | { ok: false; code: "cross_tenant_event" }
  | { ok: false; code: "replay_expired" }
  | { ok: true; event: ChannelEventRecord };

export async function replayQuarantinedChannelEvent(
  state: ManuAppState,
  channelEventId: string,
  candidate: RawChannelEventCandidate,
  options: { authorized: boolean; now?: string },
): Promise<{ state: ManuAppState; result: ChannelEventReplayResult }> {
  const existing = state.channelEvents.find((event) => event.id === channelEventId);
  if (!existing) {
    return { state, result: { ok: false, code: "event_not_found" } };
  }
  if (existing.processingStatus !== "quarantined") {
    return { state, result: { ok: false, code: "not_quarantined" } };
  }
  if (!options.authorized) {
    return { state, result: { ok: false, code: "replay_not_authorized" } };
  }
  if (existing.tenantId !== state.tenant.id) {
    return { state, result: { ok: false, code: "cross_tenant_event" } };
  }
  if (
    (existing.providerEventId && candidate.providerEventId !== existing.providerEventId) ||
    existing.payloadDigest !== candidate.payloadDigest
  ) {
    return { state, result: { ok: false, code: "candidate_mismatch" } };
  }

  const now = options.now ?? new Date().toISOString();
  const nowMs = new Date(now).getTime();
  const observedAtMs = new Date(existing.observedAt).getTime();
  const ageMs = nowMs - observedAtMs;
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedAtMs) || ageMs < 0 || ageMs > MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    const expired: ChannelEventRecord = { ...existing, processingStatus: "expired" };
    const expiredState = appendReplayAudit(replaceChannelEvent(state, expired), "channel_event_replay_expired", expired, ["replay_window_expired_or_invalid"]);
    return { state: expiredState, result: { ok: false, code: "replay_expired" } };
  }

  const routing = routeChannelEvent(state, candidate);
  const retryCount = existing.retryCount + 1;

  if (routing.status === "quarantined") {
    const stillQuarantined: ChannelEventRecord = {
      ...existing,
      eventKind: routing.finalEventKind,
      accountBindingId: routing.accountBindingId,
      retryCount,
    };
    const replayState = appendReplayAudit(
      replaceChannelEvent(state, stillQuarantined),
      "channel_event_replay_quarantined",
      stillQuarantined,
      routing.quarantineReasons,
    );
    return { state: replayState, result: { ok: true, event: stillQuarantined } };
  }

  const replayed: ChannelEventRecord = {
    ...existing,
    eventKind: routing.finalEventKind,
    accountBindingId: routing.accountBindingId,
    processingStatus: "replayed",
    committedAt: now,
    retryCount,
  };
  let replayState = replaceChannelEvent(state, replayed);
  if (routing.finalEventKind === "client_message_text") {
    replayState = await applyRoutedClientInbound(replayState, candidate, routing, now);
  } else if (routing.finalEventKind === "client_message_image") {
    replayState = stageClientImageIngressMetadata(replayState, {
      candidate,
      routing,
      channelEventId: replayed.id,
      observedAt: now,
    });
  } else if (routing.finalEventKind === "client_message_audio") {
    replayState = stageClientAudioIngressMetadata(replayState, {
      candidate,
      routing,
      channelEventId: replayed.id,
      observedAt: now,
    });
  } else {
    replayState = await applyRoutedTranscriptEffectsIfNeeded(
      replayState,
      candidate,
      routing,
      replayed.id,
      now,
    );
  }
  replayState = appendReplayAudit(replayState, "channel_event_replayed", replayed, ["authorized_replay_committed"]);
  return { state: replayState, result: { ok: true, event: replayed } };
}

function appendReplayAudit(
  state: ManuAppState,
  eventType: string,
  event: ChannelEventRecord,
  reasons: string[],
) {
  const auditEvent: AuditEventRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType: "channel_event",
    entityId: event.id,
    metadata: { eventKind: event.eventKind, reasons, retryCount: event.retryCount },
    createdAt: new Date().toISOString(),
  };
  return { ...state, auditEvents: [...state.auditEvents, auditEvent] };
}

export function expireStaleQuarantinedChannelEvents(
  state: ManuAppState,
  now: string = new Date().toISOString(),
): ManuAppState {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return state;
  const cutoffMs = nowMs - MOCK_QUARANTINE_REPLAY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return {
    ...state,
    channelEvents: state.channelEvents.map((event) =>
      event.processingStatus === "quarantined" &&
      (!Number.isFinite(new Date(event.observedAt).getTime()) || new Date(event.observedAt).getTime() < cutoffMs)
        ? { ...event, processingStatus: "expired" }
        : event,
    ),
  };
}
