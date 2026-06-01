import { emptySafetyChecklist } from "./safety-checklist";
import { redactClientContextUpdatesForAnonymization } from "./client-context-updates";
import { AppDomainError } from "./app-errors";
import type {
  AiDecisionRecord,
  AuditEventRecord,
  ClientContextUpdateRecord,
  ClientRecord,
  ConversationRecord,
  DataRequestRecord,
  HandoffCaseRecord,
  ManuAppState,
  MessageRecord,
  NotificationRecord,
  RiskAssessmentRecord,
} from "./types";

export type RetentionPolicyPlaceholder = {
  table: string;
  dataCategory: string;
  promptable: boolean;
  retentionDecision: "legal_review_required";
  deletionBehavior: string;
};

export type ClientScopedExport = {
  tenantId: string;
  clientId: string;
  generatedAt: string;
  client: ClientRecord;
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  clientContextUpdates: ClientContextUpdateRecord[];
  aiDecisions: AiDecisionRecord[];
  riskAssessments: RiskAssessmentRecord[];
  handoffCases: HandoffCaseRecord[];
  notifications: NotificationRecord[];
  dataRequests: DataRequestRecord[];
  auditEvents: AuditEventRecord[];
};

export const RETENTION_POLICY_PLACEHOLDERS: RetentionPolicyPlaceholder[] = [
  {
    table: "clients",
    dataCategory: "client_profile_health_context",
    promptable: true,
    retentionDecision: "legal_review_required",
    deletionBehavior: "anonymize profile fields and block future AI use",
  },
  {
    table: "client_channels",
    dataCategory: "channel_identifier",
    promptable: true,
    retentionDecision: "legal_review_required",
    deletionBehavior: "remove channel identifiers and deactivate channel mapping",
  },
  {
    table: "conversation_memories",
    dataCategory: "rolling_memory",
    promptable: true,
    retentionDecision: "legal_review_required",
    deletionBehavior: "clear rolling summary and durable facts",
  },
  {
    table: "messages",
    dataCategory: "conversation_messages",
    promptable: true,
    retentionDecision: "legal_review_required",
    deletionBehavior: "redact message bodies from promptable context",
  },
  {
    table: "ai_decisions",
    dataCategory: "model_decision_metadata",
    promptable: false,
    retentionDecision: "legal_review_required",
    deletionBehavior: "retain minimized audit metadata when legally required",
  },
  {
    table: "audit_events",
    dataCategory: "audit_metadata",
    promptable: false,
    retentionDecision: "legal_review_required",
    deletionBehavior: "retain minimized legal/audit record only",
  },
];

export function buildClientScopedExport(state: ManuAppState, clientId: string): ClientScopedExport {
  const client = findClient(state, clientId);
  const conversations = state.conversations.filter((conversation) => conversation.clientId === client.id);
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = state.messages.filter((message) => conversationIds.has(message.conversationId));
  const messageIds = new Set(messages.map((message) => message.id));
  const decisions = state.aiDecisions.filter((decision) => decision.clientId === client.id);
  const handoffs = state.handoffCases.filter((handoff) => handoff.clientId === client.id);
  const handoffIds = new Set(handoffs.map((handoff) => handoff.id));

  return {
    tenantId: state.tenant.id,
    clientId: client.id,
    generatedAt: new Date().toISOString(),
    client,
    conversations,
    messages,
    clientContextUpdates: state.clientContextUpdates.filter((update) => update.clientId === client.id),
    aiDecisions: decisions,
    riskAssessments: state.riskAssessments.filter(
      (assessment) => conversationIds.has(assessment.conversationId) || messageIds.has(assessment.messageId),
    ),
    handoffCases: handoffs,
    notifications: state.notifications.filter(
      (notification) => notification.entityType === "handoff_case" && handoffIds.has(notification.entityId),
    ),
    dataRequests: state.dataRequests.filter((request) => request.clientId === client.id),
    auditEvents: state.auditEvents.filter(
      (event) =>
        event.entityId === client.id ||
        conversationIds.has(event.entityId) ||
        messageIds.has(event.entityId) ||
        handoffIds.has(event.entityId) ||
        decisions.some((decision) => decision.id === event.entityId),
    ),
  };
}

export function anonymizeClientInState(state: ManuAppState, clientId: string): ManuAppState {
  const client = findClient(state, clientId);
  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === client.id).map((conversation) => conversation.id),
  );
  const messageIds = new Set(
    state.messages.filter((message) => conversationIds.has(message.conversationId)).map((message) => message.id),
  );
  const decisionIds = new Set(
    state.aiDecisions.filter((decision) => decision.clientId === client.id).map((decision) => decision.id),
  );
  const now = new Date().toISOString();
  const dataRequest = buildDataRequest(state, client.id, "anonymization", "completed", now);

  const anonymizedBase: ManuAppState = {
    ...state,
    clients: state.clients.map((item) => (item.id === client.id ? anonymizeClient(item) : item)),
    conversations: state.conversations.map((conversation) =>
      conversationIds.has(conversation.id) ? { ...conversation, rollingSummary: "" } : conversation,
    ),
    messages: state.messages.map((message) =>
      conversationIds.has(message.conversationId)
        ? {
            ...message,
            body: "[client data anonymized]",
            sourceMessageId: null,
            generatedByAiDecisionId: null,
            approvedByDietitianId: null,
            authorDietitianId: null,
          }
        : message,
    ),
    aiDecisions: state.aiDecisions.map((decision) =>
      decision.clientId === client.id
        ? {
            ...decision,
            model: null,
            providerAttempted: false,
            providerStatus: "not_called" as const,
            providerErrorCode: null,
            blockedReason: "client_data_anonymized",
            qualityIssues: [],
            reasons: ["client_data_anonymized"],
          }
        : decision,
    ),
    riskAssessments: state.riskAssessments.map((assessment) =>
      conversationIds.has(assessment.conversationId) || messageIds.has(assessment.messageId)
        ? { ...assessment, reasons: ["client_data_anonymized"] }
        : assessment,
    ),
    handoffCases: state.handoffCases.map((handoff) =>
      handoff.clientId === client.id
        ? {
            ...handoff,
            reasons: ["client_data_anonymized"],
            safeAcknowledgement: "[client data anonymized]",
            recommendedAction: "[client data anonymized]",
          }
        : handoff,
    ),
    notifications: state.notifications.map((notification) =>
      state.handoffCases.some((handoff) => handoff.clientId === client.id && handoff.id === notification.entityId)
        ? { ...notification, title: "Handoff: anonymized client", body: "Client data anonymized; review audit record." }
        : notification,
    ),
    auditEvents: [
      ...state.auditEvents.map((event) =>
        event.entityId === client.id || conversationIds.has(event.entityId) || messageIds.has(event.entityId) || decisionIds.has(event.entityId)
          ? { ...event, metadata: { minimized: true, reason: "client_data_anonymized" } }
          : event,
      ),
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_data_anonymized",
        entityType: "client",
        entityId: client.id,
        metadata: { source: "data_governance", legalReviewRequired: true },
        createdAt: now,
      },
    ],
    dataRequests: [...state.dataRequests, dataRequest],
  };

  return redactClientContextUpdatesForAnonymization(anonymizedBase, client.id);
}

export function recordClientExportInState(state: ManuAppState, clientId: string): ManuAppState {
  const client = findClient(state, clientId);
  const now = new Date().toISOString();
  const dataRequest = buildDataRequest(state, client.id, "export", "completed", now);

  return {
    ...state,
    dataRequests: [...state.dataRequests, dataRequest],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_data_exported",
        entityType: "client",
        entityId: client.id,
        metadata: { source: "data_governance", dataRequestId: dataRequest.id, minimized: true },
        createdAt: now,
      },
    ],
  };
}

function buildDataRequest(
  state: ManuAppState,
  clientId: string,
  requestType: DataRequestRecord["requestType"],
  status: DataRequestRecord["status"],
  now: string,
): DataRequestRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId,
    requestType,
    status,
    requestedByDietitianId: state.dietitian.id,
    completedAt: status === "completed" ? now : null,
    createdAt: now,
  };
}

function anonymizeClient(client: ClientRecord): ClientRecord {
  return {
    ...client,
    fullName: "Anonymized Client",
    primaryPhoneE164: null,
    communicationLanguage: "tr",
    selectedPersonaId: "balanced_coach",
    aiStatus: "passive",
    aiMode: "manual",
    aiActiveFrom: null,
    aiActiveUntil: null,
    healthProfile: {
      goal: "",
      preferredLanguage: "",
      adultStatus: "unknown",
      diagnosedConditionFlag: false,
      medicationOrSupplementFlag: false,
      pregnancyOrBreastfeedingFlag: false,
      eatingDisorderRiskFlag: false,
    },
    dietPlan: { summary: "" },
    allergies: [],
    restrictedFoods: [],
    clinicalRiskNotes: [],
    pinnedNotes: [],
    channelUserId: "",
    channelPermission: "blocked",
    mandatorySafetyComplete: false,
    safetyChecklist: emptySafetyChecklist(),
    humanTakeoverLocked: false,
    redRiskLock: { status: "none" },
  };
}

function findClient(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }
  return client;
}
