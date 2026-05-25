import {
  SAFETY_CLASSIFIER_VERSION,
  classifyDieteticRisk,
  handleInboundMessage,
} from "dietitian-ai-assistant-architecture";
import {
  MOCK_PROVIDER_ID,
  PROMPT_VERSION,
  generateMockProviderReply,
  getProviderErrorCode,
} from "./ai-provider";
import { getMissingSafetyChecklistItems, isSafetyChecklistComplete } from "./safety-checklist";
import { AppDomainError } from "./app-errors";
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
  promptVersion?: string | null;
  providerId?: string | null;
  providerStatus?: AiDecisionRecord["providerStatus"];
  providerErrorCode?: string | null;
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

  const client = findClient(state, request.clientId);
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
  const riskDecision = classifySimulationRisk(client, trimmedBody);
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

  const preflightBlock = getPreflightBlock(client);
  if (preflightBlock) {
    return appendBlockedSimulationResult({
      state: stateWithInboundAndRisk,
      client,
      conversation,
      inboundMessage,
      now,
      blockedReason: preflightBlock.blockedReason,
      reasons: preflightBlock.reasons,
      riskLevel: riskDecision.level,
    });
  }

  const coreResult = (await handleInboundMessage(
    {
      tenantId: state.tenant.id,
      dietitian: state.dietitian,
      client,
      conversation,
      message: { body: trimmedBody },
      recentMessages: state.messages.filter((message) => message.conversationId === conversation.id),
      memory: {
        rollingSummary: conversation.rollingSummary,
        durableFacts: {},
      },
      now,
    },
    {
      generateReply: async (payload: Record<string, unknown>) => {
        const riskDecision = payload.riskDecision as { level: string };
        return generateMockProviderReply(
          { client, risk: riskDecision.level as AiDecisionRecord["risk"] },
          { failureMode: request.mockProviderFailure },
        );
      },
    },
  ).catch((error: unknown) => {
    const errorCode = getProviderErrorCode(error);
    return {
      mode: client.aiMode,
      aiStatus: client.aiStatus,
      personaId: client.selectedPersonaId,
      risk: riskDecision.level,
      model: null,
      promptVersion: PROMPT_VERSION,
      providerId: MOCK_PROVIDER_ID,
      providerStatus: "failed",
      providerErrorCode: errorCode,
      reasons: [errorCode],
      action: "no_ai",
      draft: null,
      blockedReason: errorCode,
      qualityIssues: [],
    } satisfies CoreResult;
  })) as CoreResult;

  return appendCoreSimulationResult({
    state: stateWithInboundAndRisk,
    client,
    conversation,
    inboundMessage,
    coreResult,
    now,
  });
}

export function addClientToState(state: ManuAppState, client: ClientRecord): ManuAppState {
  const conversation: ConversationRecord = {
    id: `conversation-${client.id}`,
    tenantId: client.tenantId,
    dietitianId: client.dietitianId,
    clientId: client.id,
    channel: client.channel,
    rollingSummary: "Local simulator conversation. No real channel is connected.",
  };

  return {
    ...state,
    clients: [...state.clients, client],
    conversations: [...state.conversations, conversation],
  };
}

export function updateClientInState(
  state: ManuAppState,
  clientId: string,
  patch: Partial<ClientRecord>,
): ManuAppState {
  const existingClient = state.clients.find((c) => c.id === clientId);
  const auditEvents = [...state.auditEvents];

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

  return {
    ...state,
    clients: state.clients.map((client) => (client.id === clientId ? { ...client, ...patch } : client)),
    auditEvents,
  };
}

export function appendDietitianManualReply(
  state: ManuAppState,
  clientId: string,
  body: string,
): ManuAppState {
  const conversation = findConversation(state, clientId);
  const message = buildMessage({
    state,
    conversation,
    sender: "dietitian",
    origin: "dietitian_manual",
    body: body.trim(),
    status: "sent",
    authorDietitianId: state.dietitian.id,
  });

  return {
    ...state,
    messages: body.trim() ? [...state.messages, message] : state.messages,
  };
}

export function approveDraftMessageInState(
  state: ManuAppState,
  messageId: string,
  body?: string,
): ManuAppState {
  const draft = findDraftMessage(state, messageId);
  const finalBody = body?.trim() || draft.body;

  return {
    ...state,
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
        new Date().toISOString(),
      ),
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
          }
        : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, "human_takeover_released", "client", clientId, new Date().toISOString()),
    ],
  };
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
  const nextMessages = [...state.messages];
  const handoffCases = [...state.handoffCases];
  const auditEvents = [...state.auditEvents];

  if (coreResult.action === "sent" && coreResult.draft) {
    nextMessages.push(
      buildMessage({
        state,
        conversation,
        sender: "assistant",
        origin: "ai_generated",
        body: coreResult.draft,
        sourceMessageId: inboundMessage.id,
        generatedByAiDecisionId: decision.id,
        risk: coreResult.risk,
        status: "sent",
        createdAt: now,
      }),
    );
  }

  if (coreResult.action === "draft_for_approval" && coreResult.draft) {
    nextMessages.push(
      buildMessage({
        state,
        conversation,
        sender: "assistant",
        origin: "ai_generated",
        body: coreResult.draft,
        sourceMessageId: inboundMessage.id,
        generatedByAiDecisionId: decision.id,
        risk: coreResult.risk,
        status: "draft",
        createdAt: now,
      }),
    );
  }

  if (coreResult.action === "handoff" && coreResult.handoffCase) {
    const handoffCase: HandoffCaseRecord = {
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      dietitianId: state.dietitian.id,
      clientId: client.id,
      conversationId: conversation.id,
      triggeringMessageId: inboundMessage.id,
      risk: coreResult.handoffCase.risk,
      reasons: coreResult.handoffCase.reasons,
      status: "open",
      urgency: coreResult.handoffCase.urgency,
      safeAcknowledgement: coreResult.handoffCase.safeAcknowledgement,
      recommendedAction: coreResult.handoffCase.recommendedAction,
      createdAt: now,
    };
    handoffCases.push(handoffCase);
    auditEvents.push(buildAuditEvent(state, "handoff_notification_queued", "handoff_case", handoffCase.id, now));

    const notification: NotificationRecord = {
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
    };

    nextMessages.push(
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
    return {
      ...state,
      messages: nextMessages,
      aiDecisions: [...state.aiDecisions, decision],
      handoffCases,
      notifications: [...state.notifications, notification],
      auditEvents: [...auditEvents, buildAuditEvent(state, "simulation_processed", "ai_decision", decision.id, now)],
      lastSimulation: {
        action: coreResult.action,
        risk: coreResult.risk,
        model: coreResult.model,
        blockedReason: coreResult.blockedReason,
        reasons: coreResult.reasons,
        draft: coreResult.draft,
        decisionId: decision.id,
      },
    };
  }

  if (coreResult.action === "no_ai") {
    nextMessages.push(
      buildMessage({
        state,
        conversation,
        sender: "system",
        origin: "system_event",
        body: `No AI response: ${coreResult.blockedReason || "mode_or_activation_gate"}`,
        sourceMessageId: inboundMessage.id,
        risk: coreResult.risk,
        status: "blocked",
        createdAt: now,
      }),
    );
  }

  return {
    ...state,
    messages: nextMessages,
    aiDecisions: [...state.aiDecisions, decision],
    handoffCases,
    auditEvents: [...auditEvents, buildAuditEvent(state, "simulation_processed", "ai_decision", decision.id, now)],
    lastSimulation: {
      action: coreResult.action,
      risk: coreResult.risk,
      model: coreResult.model,
      blockedReason: coreResult.blockedReason,
      reasons: coreResult.reasons,
      draft: coreResult.draft,
      decisionId: decision.id,
    },
  };
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
    promptVersion: PROMPT_VERSION,
    providerId: MOCK_PROVIDER_ID,
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

function classifySimulationRisk(client: ClientRecord, body: string) {
  return classifyDieteticRisk(body, {
    highRisk: client.clinicalRiskNotes.length > 0,
  });
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
  if (client.channelPermission !== "ready") {
    return {
      blockedReason: `channel_permission_${client.channelPermission}`,
      reasons: [`permission_state_${client.channelPermission}`],
    };
  }

  if (!client.channelUserId || !client.channelUserId.trim()) {
    return {
      blockedReason: "identity_quarantine_no_channel_id",
      reasons: ["channel_user_id_missing_or_empty"],
    };
  }

  if (client.healthProfile.adultStatus === "unknown") {
    return {
      blockedReason: "identity_quarantine_adult_status_unknown",
      reasons: ["adult_status_not_confirmed"],
    };
  }

  if (client.humanTakeoverLocked) {
    return {
      blockedReason: "human_takeover_lock",
      reasons: ["dietitian_manual_takeover_active"],
    };
  }

  if (client.aiMode === "autopilot" && (!client.mandatorySafetyComplete || !isSafetyChecklistComplete(client))) {
    return {
      blockedReason: "mandatory_safety_fields_missing",
      reasons: ["autopilot_requires_completed_safety_profile", ...getMissingSafetyChecklistItems(client)],
    };
  }

  return null;
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
    promptVersion: result.promptVersion ?? (result.model ? PROMPT_VERSION : null),
    providerId: result.providerId ?? (result.model ? MOCK_PROVIDER_ID : null),
    providerStatus: result.providerStatus ?? (result.model ? "ok" : "not_called"),
    providerErrorCode: result.providerErrorCode ?? null,
    action: result.action,
    blockedReason: result.blockedReason,
    qualityIssues: result.qualityIssues,
    reasons: result.reasons,
    createdAt,
  };
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
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) {
    throw new AppDomainError(404, "message_not_found");
  }
  if (message.status !== "draft" || message.origin !== "ai_generated") {
    throw new AppDomainError(400, "message_not_ai_draft");
  }
  return message;
}
