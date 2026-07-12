import { createHash } from "node:crypto";
import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelEventRoutedOutcome } from "./phase-85-if-c-channel-event-routing";
import { resolveLegacyRetrievalEligibility } from "./phase-85-if-b-provenance-model";
import { invalidatePendingDrafts } from "./simulator";
import {
  buildStage4BDedupeKey,
  emitAiPausedByVerifiedHumanNotification,
  upsertSystemNotificationInState,
} from "./phase-85-stage-4b-notifications";
import type {
  AuditEventRecord,
  ChannelDeliveryStatus,
  ChannelMessageRevisionRecord,
  ClientRecord,
  HumanControlSessionReason,
  HumanControlSessionRecord,
  ManuAppState,
  MessageContentStatus,
  MessageOrigin,
  MessageRecord,
  RiskActivityEventRecord,
  SenderType,
} from "./types";

// Phase 85 Interstage Foundation - P85-IF-D complete transcript and human control.

export const PHASE_85_IF_D_TRANSCRIPT_VERSION = "p85-if-d-transcript-human-control-v1";

const UNSUPPORTED_MEDIA_BODY = "[unsupported media: not promptable clinical source]";

export type RoutedTranscriptContext = {
  candidate: RawChannelEventCandidate;
  routing: Extract<ChannelEventRoutedOutcome, { status: "routed" }>;
  channelEventId: string;
  observedAt: string;
};

export function applyRoutedTranscriptSideEffects(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  switch (context.routing.finalEventKind) {
    case "business_human_echo_text":
      return applyBusinessHumanEchoText(state, context);
    case "business_human_echo_media_unsupported":
      return applyBusinessHumanEchoMediaUnsupported(state, context);
    case "history_client_message":
    case "history_business_human_message":
      return applyHistoryMessage(state, context);
    case "client_message_media_unsupported":
      return applyClientMediaUnsupported(state, context);
    case "message_edit":
      return applyMessageEdit(state, context);
    case "message_revoke":
      return applyMessageRevoke(state, context);
    case "outbound_status":
      return applyOutboundStatusUpdate(state, context);
    default:
      return state;
  }
}

function applyBusinessHumanEchoText(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  const body = context.candidate.body?.trim();
  if (!body || !context.routing.clientId || !context.routing.conversationId) {
    return state;
  }

  const message = buildTranscriptMessage(state, {
    context,
    sender: "dietitian",
    origin: "dietitian_manual",
    body,
    contentStatus: "available",
    status: "sent",
    authorDietitianId: resolveAuthorDietitianId(state, context.routing),
  });

  return applyBusinessHumanSideEffects(state, context, message);
}

function applyBusinessHumanEchoMediaUnsupported(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId) {
    return state;
  }

  const message = buildTranscriptMessage(state, {
    context,
    sender: "dietitian",
    origin: "dietitian_manual",
    body: UNSUPPORTED_MEDIA_BODY,
    contentStatus: "content_unavailable",
    retrievalEligibility: "excluded_unavailable",
    status: "stored",
    authorDietitianId: resolveAuthorDietitianId(state, context.routing),
  });

  let next = applyBusinessHumanSideEffects(state, context, message);
  next = appendReviewNotification(next, context.routing.clientId!, context.routing.conversationId!, message.id, "Unsupported business-human media requires review.");
  return next;
}

function applyHistoryMessage(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId || !context.candidate.providerEventId) {
    return state;
  }

  const providerMessageId = context.candidate.providerMessageId ?? context.candidate.providerEventId;
  const existing = findMessageByProviderId(state, context.routing.accountBindingId, providerMessageId);
  if (existing) {
    return state;
  }

  const isBusiness = context.routing.finalEventKind === "history_business_human_message";
  const body = context.candidate.body?.trim() || (isBusiness ? "" : "[history message unavailable]");
  if (!isBusiness && !body.trim()) {
    return state;
  }

  const message = buildTranscriptMessage(state, {
    context,
    sender: isBusiness ? "dietitian" : "client",
    origin: isBusiness ? "dietitian_manual" : "client_inbound",
    body: body || UNSUPPORTED_MEDIA_BODY,
    contentStatus: body ? "available" : "content_unavailable",
    retrievalEligibility: body ? resolveLegacyRetrievalEligibility({
      origin: isBusiness ? "dietitian_manual" : "client_inbound",
      contentStatus: body ? "available" : "content_unavailable",
      status: "stored",
      actorType: context.routing.actorType,
    }) : "excluded_unavailable",
    status: "stored",
    authorDietitianId: isBusiness ? resolveAuthorDietitianId(state, context.routing) : null,
    createdAt: context.candidate.providerTime ?? context.observedAt,
  });

  return {
    ...state,
    messages: [...state.messages, message],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_history_message_reconciled", message.id, {
        eventKind: context.routing.finalEventKind,
        providerMessageId,
      }),
    ],
  };
}

function applyClientMediaUnsupported(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId) {
    return state;
  }

  const message = buildTranscriptMessage(state, {
    context,
    sender: "client",
    origin: "client_inbound",
    body: UNSUPPORTED_MEDIA_BODY,
    contentStatus: "content_unavailable",
    retrievalEligibility: "excluded_unavailable",
    status: "stored",
    authorDietitianId: null,
  });

  const client = findClient(state, context.routing.clientId);
  const pausedClient = pauseClientForReview(client);
  let next: ManuAppState = {
    ...state,
    clients: state.clients.map((item) => (item.id === client.id ? pausedClient : item)),
    messages: [...state.messages, message],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_unsupported_client_media", message.id, {
        eventKind: context.routing.finalEventKind,
      }),
    ],
  };
  next = appendReviewNotification(
    next,
    client.id,
    context.routing.conversationId!,
    message.id,
    `Unsupported inbound media for ${client.fullName} requires dietitian review.`,
  );
  return next;
}

function applyMessageEdit(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  const providerMessageId = context.candidate.providerMessageId;
  if (!providerMessageId || !context.routing.clientId) {
    return state;
  }

  const target = findMessageByProviderId(state, context.routing.accountBindingId, providerMessageId);
  if (!target) {
    return state;
  }

  const nextBody = context.candidate.body?.trim() || target.body;
  const priorContentStatus = target.contentStatus ?? "available";
  const revision = buildRevisionRecord(state, {
    messageId: target.id,
    channelEventId: context.channelEventId,
    providerEventId: context.candidate.providerEventId,
    revisionAction: "edit",
    priorContentStatus,
    currentContentStatus: "edited",
    priorBodyDigest: digestBody(target.body),
    currentBodyDigest: digestBody(nextBody),
    providerTime: context.candidate.providerTime,
    observedAt: context.observedAt,
  });

  const updatedMessage: MessageRecord = {
    ...target,
    body: nextBody,
    contentStatus: "edited",
    retrievalEligibility: resolveLegacyRetrievalEligibility({
      origin: target.origin,
      contentStatus: "edited",
      status: target.status ?? "stored",
      actorType: target.actorType ?? null,
    }),
    observedAt: context.observedAt,
  };

  let next: ManuAppState = {
    ...state,
    messages: state.messages.map((message) => (message.id === target.id ? updatedMessage : message)),
    channelMessageRevisions: [...state.channelMessageRevisions, revision],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_message_edited", target.id, { revisionId: revision.id }),
    ],
  };

  if (isPromptableTranscriptMessage(updatedMessage)) {
    next = bumpClientContextRevision(next, context.routing.clientId);
    next = invalidatePendingDrafts(next, context.observedAt, "source_message_edited");
    next = appendRiskActivity(next, context, {
      eventType: "draft_invalidated",
      sourceMessageId: target.id,
      metadata: { reason: "source_message_edited" },
    });
  }

  return next;
}

function applyMessageRevoke(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  const providerMessageId = context.candidate.providerMessageId;
  if (!providerMessageId || !context.routing.clientId) {
    return state;
  }

  const target = findMessageByProviderId(state, context.routing.accountBindingId, providerMessageId);
  if (!target) {
    return state;
  }

  const priorContentStatus = target.contentStatus ?? "available";
  const revision = buildRevisionRecord(state, {
    messageId: target.id,
    channelEventId: context.channelEventId,
    providerEventId: context.candidate.providerEventId,
    revisionAction: "revoke",
    priorContentStatus,
    currentContentStatus: "revoked",
    priorBodyDigest: digestBody(target.body),
    currentBodyDigest: null,
    providerTime: context.candidate.providerTime,
    observedAt: context.observedAt,
  });

  const updatedMessage: MessageRecord = {
    ...target,
    contentStatus: "revoked",
    retrievalEligibility: "excluded_revoked",
    observedAt: context.observedAt,
  };

  let next: ManuAppState = {
    ...state,
    messages: state.messages.map((message) => (message.id === target.id ? updatedMessage : message)),
    channelMessageRevisions: [...state.channelMessageRevisions, revision],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_message_revoked", target.id, { revisionId: revision.id }),
    ],
  };

  if (isPromptableTranscriptMessage(target)) {
    next = bumpClientContextRevision(next, context.routing.clientId);
    next = invalidatePendingDrafts(next, context.observedAt, "source_message_revoked");
    next = appendRiskActivity(next, context, {
      eventType: "draft_invalidated",
      sourceMessageId: target.id,
      metadata: { reason: "source_message_revoked" },
    });
  }

  return next;
}

function applyOutboundStatusUpdate(state: ManuAppState, context: RoutedTranscriptContext): ManuAppState {
  const providerMessageId = context.candidate.providerMessageId;
  if (!providerMessageId) {
    return state;
  }

  const deliveryStatus = mapOutboundStatus(context.candidate.messageType);
  if (!deliveryStatus) {
    return state;
  }

  const delivery = state.channelDeliveries.find(
    (item) =>
      item.tenantId === state.tenant.id &&
      item.mockProviderMessageId === providerMessageId,
  );
  if (!delivery) {
    return state;
  }

  return {
    ...state,
    channelDeliveries: state.channelDeliveries.map((item) =>
      item.id === delivery.id
        ? {
            ...item,
            deliveryStatus,
            failureCode: deliveryStatus === "failed" ? context.candidate.messageType ?? "provider_failed" : null,
            updatedAt: context.observedAt,
          }
        : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_outbound_status_updated", delivery.id, {
        providerMessageId,
        deliveryStatus,
      }),
    ],
  };
}

function applyBusinessHumanSideEffects(
  state: ManuAppState,
  context: RoutedTranscriptContext,
  message: MessageRecord,
): ManuAppState {
  const client = findClient(state, context.routing.clientId!);
  const wasAiActive = client.aiStatus === "active" && client.redRiskLock.status !== "locked";
  const activeSession = findActiveHumanControlSession(state, client.id);

  let next: ManuAppState = {
    ...state,
    messages: [...state.messages, message],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "channel_business_human_transcript_stored", message.id, {
        actorType: context.routing.actorType,
        wasAiActive,
      }),
    ],
  };

  if (wasAiActive) {
    const pausedClient: ClientRecord = {
      ...client,
      aiStatus: "passive",
      aiMode: "paused",
      humanTakeoverLocked: true,
      contextRevision: client.contextRevision + 1,
    };
    next = {
      ...next,
      clients: next.clients.map((item) => (item.id === client.id ? pausedClient : item)),
    };
    next = invalidatePendingDrafts(next, context.observedAt, "external_human_response");
  }

  const session = activeSession
    ? joinHumanControlSession(activeSession, message.id, context.observedAt)
    : openHumanControlSession(next, client, context, message.id, wasAiActive);

  next = {
    ...next,
    humanControlSessions: activeSession
      ? next.humanControlSessions.map((item) => (item.id === session.id ? session : item))
      : [...next.humanControlSessions, session],
  };

  next = appendRiskActivity(next, context, {
    eventType: "human_response_observed",
    sourceMessageId: message.id,
    humanControlSessionId: session.id,
    metadata: { joinedExistingSession: Boolean(activeSession) },
  });

  if (wasAiActive) {
    next = appendRiskActivity(next, context, {
      eventType: "ai_paused",
      sourceMessageId: message.id,
      humanControlSessionId: session.id,
      metadata: { reason: "external_human_response" },
    });
    next = appendRiskActivity(next, context, {
      eventType: "draft_invalidated",
      sourceMessageId: message.id,
      humanControlSessionId: session.id,
      metadata: { reason: "external_human_response" },
    });
    next = emitAiPausedByVerifiedHumanNotification(next, {
      clientId: client.id,
      conversationId: context.routing.conversationId!,
      messageId: message.id,
      clientName: client.fullName,
      now: context.observedAt,
    });
  }

  return next;
}

function openHumanControlSession(
  state: ManuAppState,
  client: ClientRecord,
  context: RoutedTranscriptContext,
  messageId: string,
  openedFromActiveAi: boolean,
): HumanControlSessionRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    conversationId: context.routing.conversationId!,
    reason: resolveSessionReason(client, openedFromActiveAi),
    status: "active",
    previousAiStatus: client.aiStatus,
    previousAiMode: client.aiMode,
    linkedHandoffId: client.redRiskLock.status === "locked" ? client.redRiskLock.handoffId : null,
    linkedYellowHoldMessageId:
      client.yellowRiskHold.status === "active" ? client.yellowRiskHold.latestMessageId : null,
    openedByMessageId: messageId,
    latestHumanMessageId: messageId,
    humanResponseObservedCount: 1,
    openedAt: context.observedAt,
    resolvedAt: null,
    reactivatedByDietitianId: null,
    reactivationReasonCode: null,
    restoredAiMode: null,
  };
}

function joinHumanControlSession(
  session: HumanControlSessionRecord,
  messageId: string,
  observedAt: string,
): HumanControlSessionRecord {
  return {
    ...session,
    latestHumanMessageId: messageId,
    humanResponseObservedCount: session.humanResponseObservedCount + 1,
    openedAt: session.openedAt || observedAt,
  };
}

function resolveSessionReason(client: ClientRecord, openedFromActiveAi: boolean): HumanControlSessionReason {
  if (client.redRiskLock.status === "locked") {
    return "red_risk_lock";
  }
  if (client.yellowRiskHold.status === "active") {
    return "yellow_risk_hold";
  }
  if (openedFromActiveAi) {
    return "external_human_active";
  }
  if (client.humanTakeoverLocked || client.aiStatus === "passive") {
    return "manual_takeover";
  }
  return "external_human_active";
}

function buildTranscriptMessage(
  state: ManuAppState,
  input: {
    context: RoutedTranscriptContext;
    sender: SenderType;
    origin: MessageOrigin;
    body: string;
    contentStatus: MessageContentStatus;
    retrievalEligibility?: MessageRecord["retrievalEligibility"];
    status: MessageRecord["status"];
    authorDietitianId: string | null;
    createdAt?: string;
  },
): MessageRecord {
  const { context, sender, origin, body, contentStatus, status, authorDietitianId } = input;
  const providerMessageId = context.candidate.providerMessageId ?? context.candidate.providerEventId;
  const createdAt = input.createdAt ?? context.observedAt;

  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: context.routing.conversationId!,
    sender,
    body,
    origin,
    providerAccountBindingId: context.routing.accountBindingId,
    providerEventId: context.candidate.providerEventId,
    providerMessageId,
    actorType: context.routing.actorType,
    actorBindingId: context.routing.actorBindingId,
    authorInterface: context.routing.authorInterface,
    actorResolutionBasis: context.routing.actorResolutionBasis,
    authorDietitianId,
    generatedByAiDecisionId: null,
    approvedByDietitianId: null,
    sourceMessageId: null,
    providerSentAt: context.candidate.providerTime,
    observedAt: context.observedAt,
    persistedAt: context.observedAt,
    conversationSequence: nextConversationSequence(state, context.routing.conversationId!),
    contentStatus,
    retrievalEligibility:
      input.retrievalEligibility ??
      resolveLegacyRetrievalEligibility({
        origin,
        contentStatus,
        status,
        actorType: context.routing.actorType,
      }),
    risk: null,
    status,
    createdAt,
  };
}

function buildRevisionRecord(
  state: ManuAppState,
  input: Omit<ChannelMessageRevisionRecord, "id" | "tenantId" | "revisionSequence">,
): ChannelMessageRevisionRecord {
  const existingCount = state.channelMessageRevisions.filter((revision) => revision.messageId === input.messageId).length;
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    revisionSequence: existingCount + 1,
    ...input,
  };
}

function nextConversationSequence(state: ManuAppState, conversationId: string) {
  const sequences = state.messages
    .filter((message) => message.conversationId === conversationId)
    .map((message) => message.conversationSequence ?? 0);
  return (sequences.length > 0 ? Math.max(...sequences) : 0) + 1;
}

function findMessageByProviderId(state: ManuAppState, accountBindingId: string, providerMessageId: string) {
  return state.messages.find(
    (message) =>
      message.tenantId === state.tenant.id &&
      message.providerAccountBindingId === accountBindingId &&
      message.providerMessageId === providerMessageId,
  );
}

function findActiveHumanControlSession(state: ManuAppState, clientId: string) {
  return state.humanControlSessions.find((session) => session.clientId === clientId && session.status === "active");
}

function findClient(state: ManuAppState, clientId: string): ClientRecord {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    throw new Error(`client_not_found:${clientId}`);
  }
  return client;
}

function resolveAuthorDietitianId(state: ManuAppState, routing: RoutedTranscriptContext["routing"]) {
  if (routing.actorType !== "exact_dietitian" || !routing.actorBindingId) {
    return null;
  }
  return state.channelActorBindings.find((binding) => binding.id === routing.actorBindingId)?.dietitianId ?? null;
}

function pauseClientForReview(client: ClientRecord): ClientRecord {
  return {
    ...client,
    aiStatus: "passive",
    aiMode: "paused",
    humanTakeoverLocked: true,
    contextRevision: client.contextRevision + 1,
  };
}

function bumpClientContextRevision(state: ManuAppState, clientId: string): ManuAppState {
  return {
    ...state,
    clients: state.clients.map((client) =>
      client.id === clientId ? { ...client, contextRevision: client.contextRevision + 1 } : client,
    ),
  };
}

function appendReviewNotification(
  state: ManuAppState,
  clientId: string,
  conversationId: string,
  messageId: string,
  body: string,
): ManuAppState {
  const client = findClient(state, clientId);
  return upsertSystemNotificationInState(
    state,
    {
      kind: "unsupported_media_review",
      tenantId: state.tenant.id,
      type: "system",
      entityType: "client",
      entityId: clientId,
      clientId,
      conversationId,
      messageId,
      sourceMessageId: messageId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "unsupported_media_review",
        scopeId: clientId,
        entityId: messageId,
        sourceId: "unsupported_media",
      }),
      title: `Channel review required: ${client.fullName}`,
      body,
      createdAt: new Date().toISOString(),
    },
    new Date().toISOString(),
  );
}

function appendRiskActivity(
  state: ManuAppState,
  context: RoutedTranscriptContext,
  input: {
    eventType: RiskActivityEventRecord["eventType"];
    sourceMessageId: string | null;
    humanControlSessionId?: string;
    metadata?: Record<string, unknown>;
  },
): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId) {
    return state;
  }

  const client = findClient(state, context.routing.clientId);
  const event: RiskActivityEventRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    conversationId: context.routing.conversationId,
    humanControlSessionId: input.humanControlSessionId ?? null,
    eventType: input.eventType,
    sourceMessageId: input.sourceMessageId,
    handoffId: client.redRiskLock.status === "locked" ? client.redRiskLock.handoffId : null,
    aiDecisionId: null,
    metadata: input.metadata ?? {},
    createdAt: context.observedAt,
  };

  return { ...state, riskActivityEvents: [...state.riskActivityEvents, event] };
}

function buildAudit(
  state: ManuAppState,
  eventType: string,
  entityId: string,
  metadata: Record<string, unknown>,
): AuditEventRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType: "channel_event",
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

function isPromptableTranscriptMessage(message: MessageRecord) {
  return (
    message.origin === "dietitian_manual" ||
    message.origin === "client_inbound" ||
    message.origin === "ai_generated"
  );
}

function digestBody(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

function mapOutboundStatus(rawStatus: string | null | undefined): ChannelDeliveryStatus | null {
  if (!rawStatus) return null;
  if (rawStatus === "sent" || rawStatus === "delivered" || rawStatus === "failed") {
    return rawStatus;
  }
  if (rawStatus === "read") {
    return "delivered";
  }
  return null;
}
