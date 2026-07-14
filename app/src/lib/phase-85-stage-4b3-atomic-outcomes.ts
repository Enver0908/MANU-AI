import type {
  AiDecisionRecord,
  AuditEventRecord,
  HandoffCaseRecord,
  MessageRecord,
  NotificationRecord,
  RiskLevel,
} from "./types";

export const STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION = "p85-stage-4b3-bundle-decision-outcome-v2";
export const STAGE_4B3_VISUAL_CORRECTION_OUTCOME_VERSION = "p85-stage-4b3-visual-correction-outcome-v2";

export type BundleDecisionAction = "sent" | "draft_for_approval" | "handoff" | "no_ai";

export type BundleDecisionOutcomeV2 = {
  version: typeof STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION;
  bundleId: string;
  decisionId: string;
  expectedBundleRevision: number;
  expectedConversationRevision: number;
  action: BundleDecisionAction;
  risk: RiskLevel;
  aiDecision: AiDecisionRecord;
  messages: MessageRecord[];
  handoffCases: HandoffCaseRecord[];
  notifications: NotificationRecord[];
  auditEvents: AuditEventRecord[];
  clientUpdate?: {
    aiStatus?: string;
    aiMode?: string;
    humanTakeoverLocked?: boolean;
    contextRevision?: number;
  } | null;
  conversationRevision?: number | null;
};

export type VisualCorrectionOutcomeV2 = {
  version: typeof STAGE_4B3_VISUAL_CORRECTION_OUTCOME_VERSION;
  correctionId: string;
  analysisId: string;
  expectedConversationRevision: number;
  expectedAnalysisRevision: number;
  resultAction: "supersede_rerun" | "invalidate_pending" | "manual_follow_up" | "closed_without_send";
  correction: Record<string, unknown>;
  correctedAnalysis?: Record<string, unknown> | null;
  correctedAnalysisId?: string | null;
  bundleUpdate?: Record<string, unknown> | null;
  draftInvalidations: MessageRecord[];
  outboundMessages: MessageRecord[];
  notifications: NotificationRecord[];
  auditEvents: AuditEventRecord[];
  clientUpdate?: Record<string, unknown> | null;
};

export function validateBundleDecisionOutcome(
  outcome: BundleDecisionOutcomeV2,
): { ok: true } | { ok: false; code: string } {
  if (outcome.version !== STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION) {
    return { ok: false, code: "bundle_decision_outcome_version_invalid" };
  }

  const sentOutbound = outcome.messages.filter(
    (message) => message.origin === "ai_generated" && message.status === "sent",
  );
  const draftOutbound = outcome.messages.filter(
    (message) => message.origin === "ai_generated" && message.status === "draft",
  );

  if (outcome.action === "sent") {
    if (outcome.risk !== "green") return { ok: false, code: "green_send_requires_green_risk" };
    if (sentOutbound.length !== 1) return { ok: false, code: "outcome_sent_message_invalid" };
    if (draftOutbound.length > 0) return { ok: false, code: "outcome_sent_with_draft_invalid" };
    if (outcome.handoffCases.length > 0) return { ok: false, code: "outcome_sent_with_handoff_invalid" };
  }

  if (outcome.action === "draft_for_approval") {
    if (sentOutbound.length > 0) return { ok: false, code: "outcome_draft_with_sent_invalid" };
    if (draftOutbound.length !== 1) return { ok: false, code: "outcome_draft_message_invalid" };
  }

  if (outcome.action === "handoff" && sentOutbound.length > 0) {
    return { ok: false, code: "non_green_boundary_response_forbidden" };
  }

  if ((outcome.risk === "yellow" || outcome.risk === "red") && sentOutbound.length > 0) {
    return { ok: false, code: "non_green_boundary_response_forbidden" };
  }

  if (outcome.action === "no_ai" && sentOutbound.length > 0) {
    return { ok: false, code: "non_green_boundary_response_forbidden" };
  }

  return { ok: true };
}

export function extractBundleDecisionOutcome(input: {
  baseState: {
    messages: MessageRecord[];
    aiDecisions: AiDecisionRecord[];
    handoffCases: HandoffCaseRecord[];
    notifications: NotificationRecord[];
    auditEvents: AuditEventRecord[];
    clients: Array<{ id: string; aiStatus: string; aiMode: string; humanTakeoverLocked: boolean; contextRevision: number }>;
    conversations: Array<{ id: string; revision?: number }>;
  };
  candidateState: {
    messages: MessageRecord[];
    aiDecisions: AiDecisionRecord[];
    handoffCases: HandoffCaseRecord[];
    notifications: NotificationRecord[];
    auditEvents: AuditEventRecord[];
    clients: Array<{ id: string; aiStatus: string; aiMode: string; humanTakeoverLocked: boolean; contextRevision: number }>;
    conversations: Array<{ id: string; revision?: number }>;
  };
  bundleId: string;
  decisionId: string;
  expectedBundleRevision: number;
  expectedConversationRevision: number;
  action: BundleDecisionAction;
  risk: RiskLevel;
  clientId: string;
  conversationId: string;
}): BundleDecisionOutcomeV2 {
  const baseMessageIds = new Set(input.baseState.messages.map((entry) => entry.id));
  const baseHandoffIds = new Set(input.baseState.handoffCases.map((entry) => entry.id));
  const baseNotificationIds = new Set(input.baseState.notifications.map((entry) => entry.id));
  const baseAuditIds = new Set(input.baseState.auditEvents.map((entry) => entry.id));

  const aiDecision = input.candidateState.aiDecisions.find((entry) => entry.id === input.decisionId);
  if (!aiDecision) {
    throw new Error("bundle_decision_missing");
  }

  const baseClient = input.baseState.clients.find((entry) => entry.id === input.clientId);
  const candidateClient = input.candidateState.clients.find((entry) => entry.id === input.clientId);
  const baseConversation = input.baseState.conversations.find((entry) => entry.id === input.conversationId);
  const candidateConversation = input.candidateState.conversations.find((entry) => entry.id === input.conversationId);

  let clientUpdate: BundleDecisionOutcomeV2["clientUpdate"] = null;
  if (baseClient && candidateClient && baseClient !== candidateClient) {
    clientUpdate = {
      aiStatus: candidateClient.aiStatus,
      aiMode: candidateClient.aiMode,
      humanTakeoverLocked: candidateClient.humanTakeoverLocked,
      contextRevision: candidateClient.contextRevision,
    };
  }

  let conversationRevision: number | null = null;
  if (
    baseConversation &&
    candidateConversation &&
    (candidateConversation.revision ?? 1) !== (baseConversation.revision ?? 1)
  ) {
    conversationRevision = candidateConversation.revision ?? 1;
  }

  return {
    version: STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION,
    bundleId: input.bundleId,
    decisionId: input.decisionId,
    expectedBundleRevision: input.expectedBundleRevision,
    expectedConversationRevision: input.expectedConversationRevision,
    action: input.action,
    risk: input.risk,
    aiDecision,
    messages: input.candidateState.messages.filter((entry) => !baseMessageIds.has(entry.id)),
    handoffCases: input.candidateState.handoffCases.filter((entry) => !baseHandoffIds.has(entry.id)),
    notifications: input.candidateState.notifications.filter((entry) => !baseNotificationIds.has(entry.id)),
    auditEvents: input.candidateState.auditEvents.filter((entry) => !baseAuditIds.has(entry.id)),
    clientUpdate,
    conversationRevision,
  };
}

export function mapBundleDecisionOutcomeToRpcPayload(outcome: BundleDecisionOutcomeV2): Record<string, unknown> {
  return {
    ...outcome,
    aiDecision: {
      ...outcome.aiDecision,
      blockedReason: outcome.aiDecision.blockedReason,
      providerStatus: outcome.aiDecision.providerStatus,
      providerAttempted: outcome.aiDecision.providerAttempted,
      providerId: outcome.aiDecision.providerId,
      providerErrorCode: outcome.aiDecision.providerErrorCode,
      sendStatus: outcome.aiDecision.sendStatus,
      promptVersion: outcome.aiDecision.promptVersion,
      contextManifest: outcome.aiDecision.contextManifest ?? {},
      conversationId: outcome.aiDecision.conversationId,
      clientId: outcome.aiDecision.clientId,
    },
    messages: outcome.messages.map((message) => ({
      ...message,
      conversationId: message.conversationId,
      generatedByAiDecisionId: message.generatedByAiDecisionId,
      sourceMessageId: message.sourceMessageId,
      providerMessageId: message.providerMessageId,
      providerEventId: message.providerEventId,
      actorType: message.actorType,
      actorBindingId: message.actorBindingId,
      authorInterface: message.authorInterface,
      actorResolutionBasis: message.actorResolutionBasis,
      retrievalEligibility: message.retrievalEligibility,
      contentStatus: message.contentStatus,
    })),
    handoffCases: outcome.handoffCases.map((handoff) => ({
      ...handoff,
      triggeringMessageId: handoff.triggeringMessageId,
      safeAcknowledgement: handoff.safeAcknowledgement,
      recommendedAction: handoff.recommendedAction,
    })),
    notifications: outcome.notifications.map((notification) => ({
      ...notification,
      dedupeKey: notification.dedupeKey,
      entityType: notification.entityType,
      entityId: notification.entityId,
      clientId: notification.clientId,
      conversationId: notification.conversationId,
      messageId: notification.messageId,
      occurrenceCount: notification.occurrenceCount,
      lastOccurredAt: notification.lastOccurredAt,
    })),
  };
}
