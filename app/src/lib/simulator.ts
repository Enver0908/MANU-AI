import {
  evaluateInboundPreflight,
  handleInboundMessage,
} from "dietitian-ai-assistant-architecture";
import {
  MOCK_PROVIDER_ID,
  PROMPT_VERSION,
  buildMockProviderInput,
  generateMockProviderReply,
} from "./ai-provider";
import { buildClientContextUpdateSummary } from "./client-context-updates";
import { buildClientFormSummary } from "./client-forms";
import { getActiveVoiceProfile } from "./voice-profile-workflow";
import { getMissingSafetyChecklistItems, isSafetyChecklistComplete } from "./safety-checklist";
import { AppDomainError } from "./app-errors";
import { SAFETY_CLASSIFIER_VERSION, classifySimulationRisk, modelForRisk } from "./simulator-risk";
import type {
  AiDecisionRecord,
  AuditEventRecord,
  ClientRecord,
  ConversationRecord,
  HandoffCaseRecord,
  ManuAppState,
  MessageRecord,
  RiskAssessmentRecord,
  SimulationRequest,
  NotificationRecord,
} from "./types";

type CoreResult = {
  mode: AiDecisionRecord["mode"];
  aiStatus: AiDecisionRecord["aiStatus"];
  personaId: string;
  risk: AiDecisionRecord["risk"];
  model: string | null;
  providerAttempted?: boolean;
  promptVersion?: string | null;
  providerId?: string | null;
  providerStatus?: AiDecisionRecord["providerStatus"];
  providerErrorCode?: string | null;
  sendStatus?: AiDecisionRecord["sendStatus"];
  contextManifest?: Record<string, unknown> | null;
  providerOutputSafety?: Record<string, unknown> | null;
  tokenBudget?: Record<string, unknown> | null;
  reasons: string[];
  action: AiDecisionRecord["action"];
  draft: string | null;
  handoffCase?: {
    risk: AiDecisionRecord["risk"];
    reasons: string[];
    urgency: string;
    safeAcknowledgement: string;
    recommendedAction: string;
  } | null;
  blockedReason: string | null;
  qualityIssues: string[];
};

export async function runInboundSimulation(
  state: ManuAppState,
  request: SimulationRequest,
): Promise<ManuAppState> {
  const trimmedBody = request.body.trim();
  const idempotencyKey = request.idempotencyKey.trim() || `sim-${Date.now()}`;

  if (!trimmedBody) {
    return state;
  }

  if (state.processedSimulationKeys.includes(idempotencyKey)) {
    return {
      ...state,
      lastSimulation: {
        action: "duplicate_ignored",
        risk: null,
        model: null,
        blockedReason: "duplicate_simulation_event",
        reasons: ["idempotency_key_already_processed"],
        draft: null,
        decisionId: null,
      },
    };
  }

  if (request.sourceConversationType === "group") {
    return quarantineGroupInbound(state, request, idempotencyKey);
  }

  if (!request.clientId) {
    throw new AppDomainError(400, "client_id_required");
  }

  const client = findClient(state, request.clientId);
  if (client.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(409, "client_removed_anonymized");
  }
  const conversation = findConversation(state, client.id);
  const now = request.now || new Date().toISOString();
  const inboundMessage = buildMessage({
    state,
    conversation,
    sender: "client",
    origin: "client_inbound",
    body: trimmedBody,
    status: "stored",
    createdAt: now,
  });

  const stateWithInbound: ManuAppState = {
    ...state,
    processedSimulationKeys: [...state.processedSimulationKeys, idempotencyKey],
    messages: [...state.messages, inboundMessage],
  };
  const priorConversationMessages = state.messages.filter((message) => message.conversationId === conversation.id);
  const yellowHoldAtInbound = client.yellowRiskHold.status === "active" ? client.yellowRiskHold : null;
  const baseRiskDecision = classifySimulationRisk(client, trimmedBody, priorConversationMessages);
  const riskDecision =
    yellowHoldAtInbound && baseRiskDecision.level !== "red"
      ? {
          ...baseRiskDecision,
          level: "yellow" as const,
          reasons: Array.from(new Set([...baseRiskDecision.reasons, "yellow_hold_pending_context"])),
        }
      : baseRiskDecision;
  const riskAssessment = buildRiskAssessment({
    state,
    conversation,
    inboundMessage,
    riskDecision,
    createdAt: now,
  });
  const stateWithInboundAndRisk: ManuAppState = {
    ...stateWithInbound,
    riskAssessments: [...stateWithInbound.riskAssessments, riskAssessment],
  };
  const stateAfterInboundInvalidation = invalidatePendingDrafts(
    stateWithInboundAndRisk,
    now,
    "new_inbound_message",
    yellowHoldAtInbound?.activeDraftMessageId ? [yellowHoldAtInbound.activeDraftMessageId] : [],
  );

  const preflightBlock = getPreflightBlock(client);
  if (preflightBlock) {
    return appendBlockedSimulationResult({
      state: stateAfterInboundInvalidation,
      client,
      conversation,
      inboundMessage,
      now,
      blockedReason: preflightBlock.blockedReason,
      reasons: preflightBlock.reasons,
      riskLevel: riskDecision.level,
    });
  }

  const promptClient = withPromptContext(
    yellowHoldAtInbound
      ? {
          ...client,
          aiStatus: yellowHoldAtInbound.previousAiStatus,
          aiMode: yellowHoldAtInbound.previousAiMode,
        }
      : client,
    state,
  );

  const coreResult = (await handleInboundMessage(
    {
      tenantId: state.tenant.id,
      dietitian: state.dietitian,
      client: promptClient,
      conversation,
      message: { id: inboundMessage.id, body: trimmedBody },
      recentMessages: priorConversationMessages,
      memory: {
        rollingSummary: conversation.rollingSummary,
        memoryVersion: conversation.memoryVersion,
        memoryRevision: conversation.memoryRevision,
        durableFacts: {},
      },
      voiceProfile: getActiveVoiceProfile(state) || undefined,
      promptVersion: PROMPT_VERSION,
      providerId: MOCK_PROVIDER_ID,
      now,
      riskDecisionOverride: riskDecision,
    },
    {
      generateReply: async (payload: Record<string, unknown>) => {
        const riskDecision = payload.riskDecision as { level: string };
        const promptContext = payload.promptContext as { segments: Array<{ type: string; text: string }> };
        return generateMockProviderReply(
          buildMockProviderInput(promptContext, riskDecision.level as AiDecisionRecord["risk"]),
          {
            failureMode: request.mockProviderFailure,
            forceMissingHistoricalContext: request.mockProviderOutput === "missing_historical_context",
          },
        );
      },
    },
  )) as CoreResult;

  return appendCoreSimulationResult({
    state: stateAfterInboundInvalidation,
    client,
    conversation,
    inboundMessage,
    coreResult,
    now,
  });
}

function quarantineGroupInbound(
  state: ManuAppState,
  request: SimulationRequest,
  idempotencyKey: string,
): ManuAppState {
  const now = request.now || new Date().toISOString();
  const channel = request.channel || "whatsapp";
  const quarantine = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    channel,
    sourceConversationType: "group" as const,
    sourceConversationId: request.sourceConversationId || null,
    sourceMessageId: request.sourceMessageId || null,
    senderChannelUserId: request.senderChannelUserId || null,
    reason: "whatsapp_group_unsupported" as const,
    createdAt: now,
  };

  return {
    ...state,
    inboundQuarantines: [...state.inboundQuarantines, quarantine],
    processedSimulationKeys: [...state.processedSimulationKeys, idempotencyKey],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "inbound_group_message_quarantined",
        entityType: "inbound_quarantine",
        entityId: quarantine.id,
        metadata: {
          channel,
          sourceConversationType: quarantine.sourceConversationType,
          sourceConversationIdPresent: Boolean(quarantine.sourceConversationId),
          sourceMessageIdPresent: Boolean(quarantine.sourceMessageId),
          senderChannelUserIdPresent: Boolean(quarantine.senderChannelUserId),
          rawBodyStored: false,
        },
        createdAt: now,
      },
    ],
    lastSimulation: {
      action: "no_ai",
      risk: null,
      model: null,
      blockedReason: "whatsapp_group_unsupported",
      reasons: ["group_conversation_unsupported", "no_client_identity", "privacy_quarantine"],
      draft: null,
      decisionId: null,
    },
  };
}

export function addClientToState(state: ManuAppState, client: ClientRecord): ManuAppState {
  const conversation: ConversationRecord = {
    id: `conversation-${client.id}`,
    tenantId: client.tenantId,
    dietitianId: client.dietitianId,
    clientId: client.id,
    channel: client.channel,
    rollingSummary: "Local simulator conversation. No real channel is connected.",
    memoryVersion: "memory-v1",
    memoryRevision: 1,
    memoryStale: false,
  };

  return {
    ...state,
    clients: [...state.clients, client],
    conversations: [...state.conversations, conversation],
  };
}

function withPromptContext(client: ClientRecord, state: ManuAppState) {
  return {
    ...client,
    clientFormSummary: buildClientFormSummary(state, client.id),
    contextUpdates: buildClientContextUpdateSummary(state, client.id),
  };
}

export function updateClientInState(
  state: ManuAppState,
  clientId: string,
  patch: Partial<ClientRecord>,
): ManuAppState {
  const existingClient = state.clients.find((c) => c.id === clientId);
  if (existingClient?.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(409, "client_removed_anonymized");
  }
  assertPatchAllowedByRedRiskLock(existingClient, patch);
  const auditEvents = [...state.auditEvents];
  const promptAffecting = isPromptAffectingClientPatch(patch);
  const now = new Date().toISOString();

  if (existingClient && patch.channelPermission && patch.channelPermission !== existingClient.channelPermission) {
    auditEvents.push({
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      eventType: patch.channelPermission === "opted_out" ? "channel_permission_opted_out" : "channel_permission_changed",
      entityType: "client",
      entityId: clientId,
      metadata: {
        source: "local_simulator",
        previousPermission: existingClient.channelPermission,
        newPermission: patch.channelPermission,
      },
      createdAt: new Date().toISOString(),
    });
  }

  const nextState = {
    ...state,
    clients: state.clients.map((client) =>
      client.id === clientId
        ? {
            ...client,
            ...patch,
            contextRevision: promptAffecting ? client.contextRevision + 1 : client.contextRevision,
          }
        : client,
    ),
    auditEvents,
  };

  return promptAffecting ? invalidatePendingDrafts(nextState, now, "client_context_changed") : nextState;
}

export function appendDietitianManualReply(
  state: ManuAppState,
  clientId: string,
  body: string,
): ManuAppState {
  const client = findClient(state, clientId);
  if (client.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(409, "client_removed_anonymized");
  }
  const conversation = findConversation(state, clientId);
  const now = new Date().toISOString();
  const message = buildMessage({
    state,
    conversation,
    sender: "dietitian",
    origin: "dietitian_manual",
    body: body.trim(),
    status: "sent",
    authorDietitianId: state.dietitian.id,
  });

  const nextState = {
    ...state,
    messages: body.trim() ? [...state.messages, message] : state.messages,
  };

  return body.trim() ? invalidatePendingDrafts(nextState, now, "dietitian_manual_reply") : nextState;
}

export function approveDraftMessageInState(
  state: ManuAppState,
  messageId: string,
  body?: string,
): ManuAppState {
  const draft = findAiDraftCandidate(state, messageId);
  const decision = state.aiDecisions.find((item) => item.id === draft.generatedByAiDecisionId);

  if (decision?.sendStatus === "legacy_draft_unverified") {
    throw new AppDomainError(409, "draft_recompile_required");
  }

  if (decision?.sendStatus === "draft_invalidated") {
    throw new AppDomainError(409, "draft_context_invalidated");
  }

  if (draft.status !== "draft") {
    throw new AppDomainError(400, "message_not_ai_draft");
  }

  const revalidationFailure = revalidateDraftBeforeSend(state, draft, decision);
  if (revalidationFailure) {
    return blockDraftForRevalidationFailure(state, draft, decision, revalidationFailure);
  }

  const finalBody = body?.trim() || draft.body;
  const conversation = state.conversations.find((item) => item.id === draft.conversationId);
  const client = conversation ? state.clients.find((item) => item.id === conversation.clientId) : undefined;
  const resolvesYellowHold =
    client?.yellowRiskHold.status === "active" && client.yellowRiskHold.activeDraftMessageId === draft.id;
  const now = new Date().toISOString();

  return {
    ...state,
    clients: resolvesYellowHold
      ? state.clients.map((item) =>
          item.id === client.id && item.yellowRiskHold.status === "active"
            ? {
                ...item,
                aiStatus: item.redRiskLock.status === "locked" ? item.aiStatus : item.yellowRiskHold.previousAiStatus,
                aiMode: item.redRiskLock.status === "locked" ? item.aiMode : item.yellowRiskHold.previousAiMode,
                yellowRiskHold: { status: "none" as const },
              }
            : item,
        )
      : state.clients,
    messages: state.messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            body: finalBody,
            status: "sent",
            approvedByDietitianId: state.dietitian.id,
          }
        : message,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(
        state,
        body?.trim() && body.trim() !== draft.body ? "draft_edited_and_sent" : "draft_approved",
        "message",
        messageId,
        now,
      ),
      ...(resolvesYellowHold
        ? [buildAuditEvent(state, "yellow_risk_hold_resolved", "client", client.id, now)]
        : []),
    ],
  };
}

function revalidateDraftBeforeSend(
  state: ManuAppState,
  draft: MessageRecord,
  decision: AiDecisionRecord | undefined,
) {
  if (!decision) return "revalidation_query_failed";

  const conversation = state.conversations.find((item) => item.id === draft.conversationId);
  const client = conversation ? state.clients.find((item) => item.id === conversation.clientId) : undefined;
  const manifest = decision.contextManifest || null;

  if (!conversation || !client || !manifest) return "revalidation_query_failed";
  if (client.lifecycleStatus === "removed_anonymized") return "client_removed_anonymized";
  const activeYellowHoldDraft =
    client.yellowRiskHold.status === "active" &&
    client.yellowRiskHold.activeDraftMessageId === draft.id &&
    client.yellowRiskHold.activeDecisionId === decision.id;
  const redLockSupersedesYellowHold =
    activeYellowHoldDraft &&
    client.redRiskLock.status === "locked" &&
    client.yellowRiskHold.status === "active" &&
    client.yellowRiskHold.blockedByRedHandoffId === client.redRiskLock.handoffId;
  if (Number(manifest.clientContextRevision) !== client.contextRevision && !redLockSupersedesYellowHold) {
    return "context_changed_before_send";
  }
  if (client.channelPermission !== "ready") return "context_changed_before_send";
  if (client.humanTakeoverLocked && !activeYellowHoldDraft) return "context_changed_before_send";
  if (client.aiStatus !== "active" || client.aiMode === "manual" || client.aiMode === "paused") {
    if (!activeYellowHoldDraft) return "context_changed_before_send";
    if (client.redRiskLock.status !== "locked" && (client.aiStatus !== "passive" || client.aiMode !== "paused")) {
      return "context_changed_before_send";
    }
  }

  const latestPromptableId = latestPromptableMessageIdForConversation(state, conversation.id, draft.id);
  const expectedLatestId =
    typeof manifest.currentMessageId === "string" && manifest.currentMessageId
      ? manifest.currentMessageId
      : typeof manifest.lastPromptableMessageId === "string"
        ? manifest.lastPromptableMessageId
        : null;
  if (!redLockSupersedesYellowHold && (latestPromptableId || null) !== (expectedLatestId || null)) {
    return "context_changed_before_send";
  }

  if (manifest.memoryIncluded === true) {
    if (conversation.memoryStale) return "context_changed_before_send";
    if (typeof manifest.memoryVersion === "string" && manifest.memoryVersion !== conversation.memoryVersion) {
      return "context_changed_before_send";
    }
    if (Number(manifest.memoryRevision || 1) !== conversation.memoryRevision) {
      return "context_changed_before_send";
    }
  }

  return null;
}

function latestPromptableMessageIdForConversation(
  state: ManuAppState,
  conversationId: string,
  draftMessageId: string,
) {
  return state.messages
    .filter((message) => message.conversationId === conversationId)
    .filter((message) => message.id !== draftMessageId)
    .filter(isPromptableForRevalidation)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1)?.id || null;
}

function isPromptableForRevalidation(message: MessageRecord) {
  if (message.origin === "client_inbound" || message.origin === "dietitian_manual") return true;
  return message.origin === "ai_generated" && message.status === "sent";
}

function blockDraftForRevalidationFailure(
  state: ManuAppState,
  draft: MessageRecord,
  decision: AiDecisionRecord | undefined,
  reason: string,
): ManuAppState {
  const now = new Date().toISOString();
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === draft.id ? { ...message, status: "blocked" as const } : message,
    ),
    aiDecisions: state.aiDecisions.map((item) =>
      decision && item.id === decision.id
        ? {
            ...item,
            sendStatus: "send_blocked" as const,
            blockedReason: reason,
            reasons: Array.from(new Set([...item.reasons, reason])),
          }
        : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, "draft_send_revalidation_blocked", "message", draft.id, now),
    ],
  };
}

export function dismissDraftMessageInState(state: ManuAppState, messageId: string): ManuAppState {
  findDraftMessage(state, messageId);

  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            status: "blocked",
          }
        : message,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, "draft_dismissed", "message", messageId, new Date().toISOString()),
    ],
  };
}

export function releaseHumanTakeoverLockInState(state: ManuAppState, clientId: string): ManuAppState {
  const client = findClient(state, clientId);

  if (client.redRiskLock.status === "locked") {
    throw new AppDomainError(409, "red_risk_reactivation_required");
  }

  if (!client.humanTakeoverLocked) {
    return state;
  }

  return {
    ...state,
    clients: state.clients.map((item) =>
      item.id === clientId
        ? {
            ...item,
            humanTakeoverLocked: false,
            contextRevision: item.contextRevision + 1,
          }
        : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, "human_takeover_released", "client", clientId, new Date().toISOString()),
    ],
  };
}

export function resolveAndReactivateRedRiskInState(
  state: ManuAppState,
  handoffId: string,
  input: { reactivationReason?: string; aiMode?: "copilot" | "autopilot" },
): ManuAppState {
  const handoff = state.handoffCases.find((item) => item.id === handoffId);
  if (!handoff) throw new AppDomainError(404, "handoff_not_found");
  if (handoff.status !== "open" && handoff.status !== "assigned") {
    throw new AppDomainError(409, "handoff_not_open");
  }

  const client = findClient(state, handoff.clientId);
  if (client.redRiskLock.status !== "locked" || client.redRiskLock.handoffId !== handoffId) {
    throw new AppDomainError(409, "red_risk_lock_not_active_for_handoff");
  }

  const reactivationReason = input.reactivationReason?.trim() || "";
  if (!reactivationReason) throw new AppDomainError(400, "reactivation_reason_required");

  const aiMode = input.aiMode || "copilot";
  if (aiMode !== "copilot" && aiMode !== "autopilot") {
    throw new AppDomainError(400, "reactivation_ai_mode_invalid");
  }
  if (aiMode === "autopilot" && (!client.mandatorySafetyComplete || !isSafetyChecklistComplete(client))) {
    throw new AppDomainError(409, "autopilot_reactivation_requires_completed_safety_profile");
  }

  const now = new Date().toISOString();
  const reactivatedLock: ClientRecord["redRiskLock"] = {
    ...client.redRiskLock,
    status: "reactivated",
    reactivatedAt: now,
    reactivatedByDietitianId: state.dietitian.id,
    reactivationReason,
    reactivatedAiMode: aiMode,
  };

  return {
    ...state,
    clients: state.clients.map((item) =>
      item.id === client.id
        ? {
            ...item,
            aiStatus: "active",
            aiMode,
            humanTakeoverLocked: false,
            redRiskLock: reactivatedLock,
            contextRevision: item.contextRevision + 1,
          }
        : item,
    ),
    handoffCases: state.handoffCases.map((item) =>
      item.id === handoffId ? { ...item, status: "resolved" as const } : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "red_risk_resolved_and_reactivated",
        entityType: "handoff_case",
        entityId: handoffId,
        metadata: {
          clientId: client.id,
          reactivatedByDietitianId: state.dietitian.id,
          aiMode,
          reasonPresent: true,
        },
        createdAt: now,
      },
    ],
  };
}

export function invalidatePendingDrafts(
  state: ManuAppState,
  createdAt: string,
  reason: string,
  preserveDraftIds: string[] = [],
): ManuAppState {
  const preserved = new Set(preserveDraftIds);
  const pendingDraftIds = new Set(
    state.messages
      .filter(
        (message) =>
          message.status === "draft" &&
          message.origin === "ai_generated" &&
          !preserved.has(message.id),
      )
      .map((message) => message.id),
  );

  if (pendingDraftIds.size === 0) return state;

  const changedDecisionIds = new Set<string>();
  const messages = state.messages.map((message) => {
    if (!pendingDraftIds.has(message.id)) return message;
    if (message.generatedByAiDecisionId) changedDecisionIds.add(message.generatedByAiDecisionId);
    return { ...message, status: "blocked" as const };
  });
  const aiDecisions = state.aiDecisions.map((decision) =>
    changedDecisionIds.has(decision.id) && decision.sendStatus !== "draft_invalidated"
      ? { ...decision, sendStatus: "draft_invalidated" as const, blockedReason: reason }
      : decision,
  );

  if (changedDecisionIds.size === 0) {
    return { ...state, messages, aiDecisions };
  }

  return {
    ...state,
    messages,
    aiDecisions,
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, "draft_context_invalidated", "ai_decision", [...changedDecisionIds].join(","), createdAt),
    ],
  };
}

function isPromptAffectingClientPatch(patch: Partial<ClientRecord>) {
  return [
    "selectedPersonaId",
    "communicationLanguage",
    "aiStatus",
    "aiMode",
    "aiActiveFrom",
    "aiActiveUntil",
    "healthProfile",
    "dietPlan",
    "allergies",
    "restrictedFoods",
    "clinicalRiskNotes",
    "pinnedNotes",
    "channelPermission",
    "mandatorySafetyComplete",
    "safetyChecklist",
    "humanTakeoverLocked",
    "redRiskLock",
    "yellowRiskHold",
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

function assertPatchAllowedByRedRiskLock(existingClient: ClientRecord | undefined, patch: Partial<ClientRecord>) {
  if (!existingClient || existingClient.redRiskLock.status !== "locked") return;

  const triesToReactivate =
    patch.aiStatus === "active" ||
    (Object.prototype.hasOwnProperty.call(patch, "aiMode") &&
      patch.aiMode !== "manual" &&
      patch.aiMode !== "paused") ||
    patch.humanTakeoverLocked === false;

  if (triesToReactivate) {
    throw new AppDomainError(409, "red_risk_reactivation_required");
  }
}

export function markNotificationReadInState(state: ManuAppState, notificationId: string): ManuAppState {
  return {
    ...state,
    notifications: state.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
  };
}

export function acknowledgeNotificationInState(state: ManuAppState, notificationId: string): ManuAppState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, acknowledgedAt: new Date().toISOString() } : n,
    ),
  };
}

type SimulationAppendContext = {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  coreResult: CoreResult;
  decision: AiDecisionRecord;
  now: string;
  nextMessages: MessageRecord[];
  handoffCases: HandoffCaseRecord[];
  auditEvents: AuditEventRecord[];
  notifications: NotificationRecord[];
  nextClients: ClientRecord[];
  nextAiDecisions: AiDecisionRecord[];
};

function createSimulationAppendContext(input: {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  coreResult: CoreResult;
  decision: AiDecisionRecord;
  now: string;
}): SimulationAppendContext {
  return {
    ...input,
    nextMessages: [...input.state.messages],
    handoffCases: [...input.state.handoffCases],
    auditEvents: [...input.state.auditEvents],
    notifications: [...input.state.notifications],
    nextClients: input.state.clients,
    nextAiDecisions: input.state.aiDecisions,
  };
}

function applyExpiredActivationSideEffects(ctx: SimulationAppendContext) {
  if (ctx.coreResult.blockedReason !== "client_ai_window_expired") return;

  ctx.nextClients = ctx.state.clients.map((item) =>
    item.id === ctx.client.id
      ? {
          ...item,
          aiStatus: "passive" as const,
          aiActiveUntil: null,
          contextRevision: item.contextRevision + 1,
        }
      : item,
  );
  ctx.auditEvents.push(
    buildAuditEvent(ctx.state, "client_ai_window_expired", "client", ctx.client.id, ctx.now),
  );
  ctx.notifications.push({
    id: crypto.randomUUID(),
    tenantId: ctx.state.tenant.id,
    type: "system",
    entityType: "client",
    entityId: ctx.client.id,
    title: `AI window expired: ${ctx.client.fullName}`,
    body: `AI was passivated for ${ctx.client.fullName} because the activation window ended.`,
    read: false,
    acknowledgedAt: null,
    createdAt: ctx.now,
  });
}

function appendSentSimulationResult(ctx: SimulationAppendContext) {
  if (ctx.coreResult.action !== "sent" || !ctx.coreResult.draft) return;

  ctx.nextMessages.push(
    buildMessage({
      state: ctx.state,
      conversation: ctx.conversation,
      sender: "assistant",
      origin: "ai_generated",
      body: ctx.coreResult.draft,
      sourceMessageId: ctx.inboundMessage.id,
      generatedByAiDecisionId: ctx.decision.id,
      risk: ctx.coreResult.risk,
      status: "sent",
      createdAt: ctx.now,
    }),
  );
}

function appendDraftSimulationResult(ctx: SimulationAppendContext) {
  const draftBody = ctx.coreResult.draft;
  if (ctx.coreResult.action !== "draft_for_approval" || !draftBody) return;

  const { state, client, conversation, inboundMessage, coreResult, decision, now } = ctx;
  const activeHold =
    client.yellowRiskHold.status === "active" && client.yellowRiskHold.activeDraftMessageId
      ? client.yellowRiskHold
      : null;
  const existingDraftIndex = activeHold
    ? ctx.nextMessages.findIndex(
        (message) => message.id === activeHold.activeDraftMessageId && message.status === "draft",
      )
    : -1;
  const draftMessage =
    existingDraftIndex >= 0
      ? {
          ...ctx.nextMessages[existingDraftIndex],
          body: draftBody,
          sourceMessageId: inboundMessage.id,
          generatedByAiDecisionId: decision.id,
          risk: coreResult.risk,
          status: "draft" as const,
          createdAt: now,
        }
      : buildMessage({
          state,
          conversation,
          sender: "assistant",
          origin: "ai_generated",
          body: draftBody,
          sourceMessageId: inboundMessage.id,
          generatedByAiDecisionId: decision.id,
          risk: coreResult.risk,
          status: "draft",
          createdAt: now,
        });

  if (existingDraftIndex >= 0) {
    ctx.nextMessages[existingDraftIndex] = draftMessage;
  } else {
    ctx.nextMessages.push(draftMessage);
  }

  ctx.nextClients = ctx.nextClients.map((item) => {
    if (item.id !== client.id) return item;
    const previousHold = item.yellowRiskHold.status === "active" ? item.yellowRiskHold : null;
    return {
      ...item,
      aiStatus: "passive",
      aiMode: "paused",
      yellowRiskHold: {
        status: "active",
        startedAt: previousHold?.startedAt || now,
        firstMessageId: previousHold?.firstMessageId || inboundMessage.id,
        latestMessageId: inboundMessage.id,
        activeDraftMessageId: draftMessage.id,
        activeDecisionId: decision.id,
        messageIds: Array.from(new Set([...(previousHold?.messageIds || []), inboundMessage.id])),
        reasons: Array.from(new Set([...(previousHold?.reasons || []), ...coreResult.reasons])),
        previousAiStatus: previousHold?.previousAiStatus || item.aiStatus,
        previousAiMode: previousHold?.previousAiMode || item.aiMode,
        blockedByRedHandoffId: previousHold?.blockedByRedHandoffId || null,
      },
    };
  });

  if (activeHold?.activeDecisionId) {
    const previousDecisionIndex = ctx.nextAiDecisions.findIndex((item) => item.id === activeHold.activeDecisionId);
    if (
      previousDecisionIndex >= 0 &&
      ctx.nextAiDecisions[previousDecisionIndex].sendStatus !== "draft_invalidated"
    ) {
      ctx.nextAiDecisions = ctx.nextAiDecisions.map((item) =>
        item.id === activeHold.activeDecisionId
          ? {
              ...item,
              sendStatus: "draft_invalidated",
              blockedReason: "yellow_hold_draft_superseded",
              reasons: Array.from(new Set([...item.reasons, "yellow_hold_draft_superseded"])),
            }
          : item,
      );
      ctx.auditEvents.push(
        buildAuditEvent(state, "yellow_risk_hold_draft_refreshed", "message", draftMessage.id, now),
      );
    }
  } else {
    ctx.auditEvents.push(buildAuditEvent(state, "yellow_risk_hold_created", "client", client.id, now));
  }
}

function appendHandoffSimulationResult(ctx: SimulationAppendContext): ManuAppState | null {
  const handoffPayload = ctx.coreResult.handoffCase;
  if (ctx.coreResult.action !== "handoff" || !handoffPayload) return null;

  const { state, client, conversation, inboundMessage, coreResult, now } = ctx;
  let redRiskLockAudit: AuditEventRecord | null = null;
  let redRiskHandoffId: string | null = null;

  if (coreResult.risk === "red") {
    const lockHandoffId = crypto.randomUUID();
    redRiskHandoffId = lockHandoffId;
    ctx.nextClients = state.clients.map((item) =>
      item.id === client.id
        ? {
            ...item,
            aiStatus: "passive",
            aiMode: "manual",
            humanTakeoverLocked: true,
            redRiskLock: {
              status: "locked",
              handoffId: lockHandoffId,
              lockedAt: now,
              reasons: handoffPayload.reasons || coreResult.reasons,
              previousAiStatus:
                item.yellowRiskHold.status === "active" ? item.yellowRiskHold.previousAiStatus : item.aiStatus,
              previousAiMode:
                item.yellowRiskHold.status === "active" ? item.yellowRiskHold.previousAiMode : item.aiMode,
            },
            yellowRiskHold:
              item.yellowRiskHold.status === "active"
                ? { ...item.yellowRiskHold, blockedByRedHandoffId: lockHandoffId }
                : item.yellowRiskHold,
            contextRevision: item.contextRevision + 1,
          }
        : item,
    );
    redRiskLockAudit = {
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      eventType: "red_risk_lock_created",
      entityType: "client",
      entityId: client.id,
      metadata: {
        handoffId: redRiskHandoffId,
        previousAiStatus: client.aiStatus,
        previousAiMode: client.aiMode,
        reasons: handoffPayload.reasons,
      },
      createdAt: now,
    };
  } else if (coreResult.blockedReason === "missing_historical_context") {
    ctx.nextClients = state.clients.map((item) =>
      item.id === client.id ? { ...item, humanTakeoverLocked: true, contextRevision: item.contextRevision + 1 } : item,
    );
  }

  const handoffCase: HandoffCaseRecord = {
    id: redRiskHandoffId || crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    clientId: client.id,
    conversationId: conversation.id,
    triggeringMessageId: inboundMessage.id,
    risk: handoffPayload.risk,
    reasons: handoffPayload.reasons,
    status: "open",
    urgency: handoffPayload.urgency,
    safeAcknowledgement: handoffPayload.safeAcknowledgement,
    recommendedAction: handoffPayload.recommendedAction,
    createdAt: now,
  };
  ctx.handoffCases.push(handoffCase);
  if (redRiskLockAudit) ctx.auditEvents.push(redRiskLockAudit);
  ctx.auditEvents.push(buildAuditEvent(state, "handoff_notification_queued", "handoff_case", handoffCase.id, now));

  ctx.notifications.push({
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    type: handoffCase.urgency === "urgent" ? "handoff_urgent" : "handoff_standard",
    entityType: "handoff_case",
    entityId: handoffCase.id,
    title: `Handoff: ${client.fullName}`,
    body: `Urgent handoff for ${client.fullName} — review required.`,
    read: false,
    acknowledgedAt: null,
    createdAt: now,
  });

  ctx.nextMessages.push(
    buildMessage({
      state,
      conversation,
      sender: "system",
      origin: "system_event",
      body: `Handoff opened: ${handoffCase.reasons.join(", ") || handoffCase.risk}`,
      sourceMessageId: inboundMessage.id,
      risk: coreResult.risk,
      status: "handoff",
      createdAt: now,
    }),
  );

  return finalizeSimulationAppendContext(ctx);
}

function appendNoAiSimulationResult(ctx: SimulationAppendContext) {
  if (ctx.coreResult.action !== "no_ai") return;

  ctx.nextMessages.push(
    buildMessage({
      state: ctx.state,
      conversation: ctx.conversation,
      sender: "system",
      origin: "system_event",
      body: `No AI response: ${ctx.coreResult.blockedReason || "mode_or_activation_gate"}`,
      sourceMessageId: ctx.inboundMessage.id,
      risk: ctx.coreResult.risk,
      status: "blocked",
      createdAt: ctx.now,
    }),
  );
}

function finalizeSimulationAppendContext(ctx: SimulationAppendContext): ManuAppState {
  return {
    ...ctx.state,
    clients: ctx.nextClients,
    messages: ctx.nextMessages,
    aiDecisions: [...ctx.nextAiDecisions, ctx.decision],
    handoffCases: ctx.handoffCases,
    notifications: ctx.notifications,
    auditEvents: [
      ...ctx.auditEvents,
      buildAuditEvent(ctx.state, "simulation_processed", "ai_decision", ctx.decision.id, ctx.now),
    ],
    lastSimulation: {
      action: ctx.coreResult.action,
      risk: ctx.coreResult.risk,
      model: ctx.coreResult.model,
      blockedReason: ctx.coreResult.blockedReason,
      reasons: ctx.coreResult.reasons,
      draft: ctx.coreResult.draft,
      decisionId: ctx.decision.id,
    },
  };
}

function appendCoreSimulationResult({
  state,
  client,
  conversation,
  inboundMessage,
  coreResult,
  now,
}: {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  coreResult: CoreResult;
  now: string;
}): ManuAppState {
  const decision = buildDecision({ state, client, conversation, result: coreResult, createdAt: now });
  const ctx = createSimulationAppendContext({
    state,
    client,
    conversation,
    inboundMessage,
    coreResult,
    decision,
    now,
  });

  applyExpiredActivationSideEffects(ctx);
  appendSentSimulationResult(ctx);
  appendDraftSimulationResult(ctx);

  const handoffState = appendHandoffSimulationResult(ctx);
  if (handoffState) return handoffState;

  appendNoAiSimulationResult(ctx);
  return finalizeSimulationAppendContext(ctx);
}

function appendBlockedSimulationResult({
  state,
  client,
  conversation,
  inboundMessage,
  now,
  blockedReason,
  reasons,
  riskLevel,
}: {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  now: string;
  blockedReason: string;
  reasons: string[];
  riskLevel: CoreResult["risk"];
}): ManuAppState {
  const result: CoreResult = {
    mode: client.aiMode,
    aiStatus: client.aiStatus,
    personaId: client.selectedPersonaId,
    risk: riskLevel,
    model: null,
    providerAttempted: false,
    promptVersion: null,
    providerId: null,
    providerStatus: "not_called",
    providerErrorCode: null,
    reasons,
    action: "no_ai",
    draft: null,
    blockedReason,
    qualityIssues: [],
  };
  const decision = buildDecision({ state, client, conversation, result, createdAt: now });
  const systemMessage = buildMessage({
    state,
    conversation,
    sender: "system",
    origin: "system_event",
    body: `No AI response: ${blockedReason}`,
    sourceMessageId: inboundMessage.id,
    risk: null,
    status: "blocked",
    createdAt: now,
  });

  return {
    ...state,
    messages: [...state.messages, systemMessage],
    aiDecisions: [...state.aiDecisions, decision],
    auditEvents: [...state.auditEvents, buildAuditEvent(state, "simulation_blocked", "ai_decision", decision.id, now)],
    lastSimulation: {
      action: "no_ai",
      risk: riskLevel,
      model: null,
      blockedReason,
      reasons,
      draft: null,
      decisionId: decision.id,
    },
  };
}

function buildRiskAssessment({
  state,
  conversation,
  inboundMessage,
  riskDecision,
  createdAt,
}: {
  state: ManuAppState;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  riskDecision: ReturnType<typeof classifySimulationRisk>;
  createdAt: string;
}): RiskAssessmentRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: conversation.id,
    messageId: inboundMessage.id,
    level: riskDecision.level,
    reasons: riskDecision.reasons,
    classifierVersion: riskDecision.classifierVersion || SAFETY_CLASSIFIER_VERSION,
    createdAt,
  };
}

function getPreflightBlock(client: ClientRecord): { blockedReason: string; reasons: string[] } | null {
  return evaluateInboundPreflight(client, {
    safetyChecklistComplete: client.mandatorySafetyComplete && isSafetyChecklistComplete(client),
    missingSafetyChecklistItems: getMissingSafetyChecklistItems(client),
  });
}

function buildDecision({
  state,
  client,
  conversation,
  result,
  createdAt,
}: {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  result: CoreResult;
  createdAt: string;
}): AiDecisionRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: conversation.id,
    clientId: client.id,
    mode: result.mode,
    aiStatus: result.aiStatus,
    personaId: result.personaId,
    risk: result.risk,
    model: result.model,
    promptVersion: result.promptVersion ?? (result.providerAttempted ? PROMPT_VERSION : null),
    providerAttempted: result.providerAttempted ?? false,
    providerId: result.providerId ?? (result.providerAttempted ? MOCK_PROVIDER_ID : null),
    providerStatus: result.providerStatus ?? (result.providerAttempted ? "ok" : "not_called"),
    providerErrorCode: result.providerErrorCode ?? null,
    sendStatus: result.sendStatus ?? defaultSendStatus(result),
    contextManifest: result.contextManifest ?? null,
    providerOutputSafety:
      result.providerOutputSafety ??
      (result.qualityIssues.length > 0
        ? {
            allowed: false,
            issues: result.qualityIssues.map((issue) => ({
              code: issue,
              severity: "block",
              category: issue === "missing_historical_context" ? "context" : "clinical",
              evidence: issue === "missing_historical_context" ? "context_mismatch" : "pattern",
            })),
          }
        : null),
    tokenBudget:
      result.tokenBudget ??
      ((result.contextManifest?.tokenBudget as Record<string, unknown> | undefined) || null),
    action: result.action,
    blockedReason: result.blockedReason,
    qualityIssues: result.qualityIssues,
    reasons: result.reasons,
    createdAt,
  };
}

function defaultSendStatus(result: CoreResult): AiDecisionRecord["sendStatus"] {
  if (result.action === "sent") return "sent";
  if (result.action === "draft_for_approval") return "draft_created";
  if (result.action === "handoff") return result.blockedReason ? "send_blocked" : "not_applicable";
  if (result.action === "no_ai") return result.blockedReason ? "send_blocked" : "not_called";
  return "not_called";
}

function buildAuditEvent(
  state: ManuAppState,
  eventType: string,
  entityType: string,
  entityId: string,
  createdAt: string,
): AuditEventRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType,
    entityId,
    metadata: { source: "local_simulator" },
    createdAt,
  };
}

function buildMessage({
  state,
  conversation,
  sender,
  origin,
  body,
  sourceMessageId = null,
  authorDietitianId = null,
  generatedByAiDecisionId = null,
  risk = null,
  status = "stored",
  createdAt = new Date().toISOString(),
}: {
  state: ManuAppState;
  conversation: ConversationRecord;
  sender: MessageRecord["sender"];
  origin: MessageRecord["origin"];
  body: string;
  sourceMessageId?: string | null;
  authorDietitianId?: string | null;
  generatedByAiDecisionId?: string | null;
  risk?: MessageRecord["risk"];
  status?: MessageRecord["status"];
  createdAt?: string;
}): MessageRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: conversation.id,
    sender,
    origin,
    body,
    sourceMessageId,
    authorDietitianId,
    generatedByAiDecisionId,
    risk,
    status,
    createdAt,
  };
}

function findClient(state: ManuAppState, clientId: string): ClientRecord {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }
  return client;
}

function findConversation(state: ManuAppState, clientId: string): ConversationRecord {
  const conversation = state.conversations.find((item) => item.clientId === clientId);
  if (!conversation) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  return conversation;
}

function findDraftMessage(state: ManuAppState, messageId: string): MessageRecord {
  const message = findAiDraftCandidate(state, messageId);
  if (message.status !== "draft") {
    throw new AppDomainError(400, "message_not_ai_draft");
  }
  return message;
}

function findAiDraftCandidate(state: ManuAppState, messageId: string): MessageRecord {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) {
    throw new AppDomainError(404, "message_not_found");
  }
  if (message.origin !== "ai_generated") {
    throw new AppDomainError(400, "message_not_ai_draft");
  }
  return message;
}
