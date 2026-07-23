import { createHash, randomUUID } from "node:crypto";
import {
  buildAiChatRedNotificationFingerprint,
  classifyDietitianChatRisk,
} from "dietitian-ai-assistant-architecture/risk";
import { validateDietitianChatRiskAssessmentResult } from "dietitian-ai-assistant-architecture";
import type { AppTenantContext } from "./auth-context";
import { hasCapability } from "./auth-context";
import { AppRequestError } from "./app-errors";
import { getFallbackState, saveFallbackState } from "./app-state-store";
import { upsertSystemNotificationInState } from "./phase-85-stage-4b-notifications";
import { ensureHumanControlSessionForRiskState } from "./phase-85-if-f-risk-reactivation";
import type {
  AiChatDraftTransferDto,
  AiChatHandoffLinkDto,
  AiChatRiskAssessmentDto,
  AiChatRiskLevel,
  AiChatRunDto,
  AiChatSafeDraftDto,
  AiChatScopeType,
} from "./phase-85-stage-4c-contracts";
import type { HandoffCaseRecord, ManuAppState, MessageRecord } from "./types";

export const STAGE_4C_RISK_BRIDGE_VERSION = "p85-stage-4c-risk-bridge-v1";

export type AiChatRiskBridgeRunContext = {
  tenantId: string;
  runId: string;
  conversationId: string;
  createdByUserId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  triggerBody: string;
  directAnswer: string | null;
  answerability: AiChatRunDto["answerability"];
  providerRiskLevel: AiChatRiskLevel | null;
  verifiedFactTexts: string[];
  attachmentExcerpts: string[];
  sourceExcerptTexts: string[];
  sourceRefIds: string[];
  sourceRevisionDigest: string;
};

export type InMemoryRiskBridgeState = {
  riskAssessments: AiChatRiskAssessmentDto[];
  draftTransfers: AiChatDraftTransferDto[];
  handoffLinks: AiChatHandoffLinkDto[];
  safeDrafts: Map<string, AiChatSafeDraftDto>;
};

export function createEmptyRiskBridgeState(): InMemoryRiskBridgeState {
  return {
    riskAssessments: [],
    draftTransfers: [],
    handoffLinks: [],
    safeDrafts: new Map(),
  };
}

export function buildSourceRevisionDigest(input: { revisionToken?: string | null; sourceRefIds: string[] }) {
  return createHash("sha256")
    .update(`${input.revisionToken ?? "none"}:${[...input.sourceRefIds].sort().join("|")}`)
    .digest("hex");
}

export function evaluateAiChatRunRisk(input: AiChatRiskBridgeRunContext) {
  const assessment = classifyDietitianChatRisk({
    triggerBody: input.triggerBody,
    directAnswer: input.directAnswer,
    verifiedFactTexts: input.verifiedFactTexts,
    attachmentExcerpts: input.attachmentExcerpts,
    sourceExcerptTexts: input.sourceExcerptTexts,
    scopeType: input.scopeType,
    answerability: input.answerability,
    providerRiskLevel: input.providerRiskLevel,
    sourceRefIds: input.sourceRefIds,
  });
  const validation = validateDietitianChatRiskAssessmentResult({
    riskAssessment: assessment,
    providerRiskLevel: input.providerRiskLevel,
  });
  if (!validation.ok) {
    throw new AppRequestError(409, `ai_chat_${validation.code ?? "risk_validation_failed"}`);
  }
  return assessment;
}

export function persistAiChatRiskAssessment(
  state: InMemoryRiskBridgeState,
  input: AiChatRiskBridgeRunContext & {
    assessment: ReturnType<typeof classifyDietitianChatRisk>;
    handoffConfirmationToken: string;
  },
): AiChatRiskAssessmentDto {
  const now = new Date().toISOString();
  for (const item of state.riskAssessments) {
    if (item.tenantId === input.tenantId && item.runId === input.runId && item.status === "active") {
      item.status = "superseded";
      item.supersededAt = now;
    }
  }
  const record: AiChatRiskAssessmentDto = {
    id: randomUUID(),
    tenantId: input.tenantId,
    runId: input.runId,
    conversationId: input.conversationId,
    createdByUserId: input.createdByUserId,
    clientId: input.clientId,
    riskLevel: input.assessment.riskLevel as AiChatRiskLevel,
    reasons: input.assessment.reasons,
    sourceRefIds: input.assessment.sourceRefIds,
    confidenceClass: input.assessment.confidenceClass,
    recommendedHumanAction: input.assessment.recommendedHumanAction,
    hypotheticalRed: input.assessment.hypotheticalRed,
    sourceRevisionDigest: input.sourceRevisionDigest,
    handoffConfirmationToken: input.handoffConfirmationToken,
    status: "active",
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state.riskAssessments.push(record);
  if (input.assessment.safeDraft?.body) {
    state.safeDrafts.set(input.runId, {
      body: input.assessment.safeDraft.body,
      riskLevel: (input.assessment.safeDraft.riskLevel as AiChatRiskLevel | null) ?? null,
      sourceRefIds: input.assessment.sourceRefIds,
    });
  } else {
    state.safeDrafts.delete(input.runId);
  }
  return record;
}

export function applyClientChatRedNotification(
  appState: ManuAppState,
  input: {
    tenantId: string;
    clientId: string;
    conversationId: string;
    runId: string;
    createdByUserId: string;
    reasons: string[];
    sourceRevisionDigest: string;
  },
) {
  const fingerprint = buildAiChatRedNotificationFingerprint({
    clientId: input.clientId,
    reasons: input.reasons,
    sourceRevisionDigest: input.sourceRevisionDigest,
  });
  const dedupeKey = `p85-4c:red:${input.tenantId}:${fingerprint}`;
  const next = upsertSystemNotificationInState(appState, {
    kind: "ai_chat_red_review_required",
    tenantId: input.tenantId,
    type: "system",
    entityType: "ai_chat_run",
    entityId: input.runId,
    title: "AI Chat red review required",
    body: "A client-scoped AI Chat run requires urgent dietitian review.",
    clientId: input.clientId,
    conversationId: input.conversationId,
    dedupeKey,
    targetPanel: "ai_chat",
  });
  return next;
}

export function listMessagingDestinationsForClient(
  appState: ManuAppState,
  tenantId: string,
  clientId: string,
  limit = 20,
) {
  return appState.conversations
    .filter((item) => item.tenantId === tenantId && item.clientId === clientId)
    .sort((left, right) => right.revision - left.revision)
    .slice(0, limit)
    .map((item) => ({
      conversationId: item.id,
      clientId: item.clientId,
      channel: item.channel,
      revision: item.revision,
    }));
}

export function createAiChatDraftTransfer(
  bridgeState: InMemoryRiskBridgeState,
  appState: ManuAppState,
  input: {
    tenantId: string;
    runId: string;
    sourceConversationId: string;
    destinationConversationId: string;
    createdByUserId: string;
    destinationRevision: number;
    clientContextRevision: number;
  },
): { transfer: AiChatDraftTransferDto; nextAppState: ManuAppState } {
  const assessment = bridgeState.riskAssessments.find(
    (item) => item.tenantId === input.tenantId && item.runId === input.runId && item.status === "active",
  );
  if (!assessment) {
    throw new AppRequestError(409, "ai_chat_risk_assessment_missing");
  }
  if (assessment.riskLevel === "red") {
    throw new AppRequestError(409, "ai_chat_red_draft_blocked");
  }
  const safeDraft = bridgeState.safeDrafts.get(input.runId);
  if (!safeDraft?.body?.trim()) {
    throw new AppRequestError(409, "ai_chat_safe_draft_missing");
  }
  const destination = appState.conversations.find(
    (item) => item.id === input.destinationConversationId && item.tenantId === input.tenantId,
  );
  if (!destination || destination.clientId !== assessment.clientId) {
    throw new AppRequestError(403, "ai_chat_destination_client_mismatch");
  }
  if (destination.revision !== input.destinationRevision) {
    throw new AppRequestError(409, "ai_chat_destination_revision_conflict");
  }
  const client = appState.clients.find((item) => item.id === destination.clientId);
  if (!client || client.contextRevision !== input.clientContextRevision) {
    throw new AppRequestError(409, "ai_chat_client_context_revision_conflict");
  }
  const now = new Date().toISOString();
  for (const item of bridgeState.draftTransfers) {
    if (
      item.tenantId === input.tenantId &&
      item.destinationConversationId === input.destinationConversationId &&
      item.status === "pending"
    ) {
      item.status = "superseded";
      item.supersededAt = now;
    }
  }
  const transfer: AiChatDraftTransferDto = {
    id: randomUUID(),
    tenantId: input.tenantId,
    runId: input.runId,
    sourceConversationId: input.sourceConversationId,
    destinationConversationId: input.destinationConversationId,
    destinationClientId: destination.clientId,
    createdByUserId: input.createdByUserId,
    riskLevel: assessment.riskLevel === "yellow" ? "yellow" : "green",
    reviewOrigin: "ai_chat",
    transferMode: assessment.riskLevel === "yellow" ? "yellow_review" : "composer_pending",
    draftBody: safeDraft.body,
    sourceRefIds: assessment.sourceRefIds,
    status: "pending",
    destinationRevision: destination.revision,
    clientContextRevision: client.contextRevision,
    consumedAt: null,
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
  };
  bridgeState.draftTransfers.push(transfer);
  let nextAppState = appState;
  if (transfer.transferMode === "yellow_review") {
    nextAppState = createYellowAiChatDraftInMessagingState(appState, {
      clientId: destination.clientId,
      conversationId: destination.id,
      draftBody: transfer.draftBody,
      riskLevel: "yellow",
      now,
    });
  }
  return { transfer, nextAppState };
}

function createYellowAiChatDraftInMessagingState(
  state: ManuAppState,
  input: { clientId: string; conversationId: string; draftBody: string; riskLevel: "yellow"; now: string },
): ManuAppState {
  const conversation = state.conversations.find((item) => item.id === input.conversationId);
  const client = state.clients.find((item) => item.id === input.clientId);
  if (!conversation || !client) return state;
  const draftId = randomUUID();
  const decisionId = randomUUID();
  const draftMessage: MessageRecord = {
    id: draftId,
    tenantId: state.tenant.id,
    conversationId: conversation.id,
    sender: "assistant",
    origin: "ai_generated",
    body: input.draftBody,
    status: "draft",
    risk: input.riskLevel,
    sourceMessageId: null,
    generatedByAiDecisionId: decisionId,
    createdAt: input.now,
    contentStatus: "available",
  };
  return {
    ...state,
    messages: [...state.messages, draftMessage],
    aiDecisions: [
      ...state.aiDecisions,
      {
        id: decisionId,
        tenantId: state.tenant.id,
        clientId: client.id,
        conversationId: conversation.id,
        mode: client.aiMode,
        aiStatus: client.aiStatus,
        personaId: "balanced_coach",
        risk: input.riskLevel,
        model: null,
        promptVersion: null,
        providerAttempted: false,
        providerId: null,
        providerStatus: "not_called",
        providerErrorCode: null,
        sendStatus: "draft_created",
        action: "draft_for_approval",
        blockedReason: null,
        qualityIssues: [],
        reasons: ["ai_chat_yellow_transfer"],
        createdAt: input.now,
      },
    ],
    clients: state.clients.map((item) =>
      item.id === client.id
        ? {
            ...item,
            aiStatus: "passive",
            aiMode: "paused",
            yellowRiskHold: {
              status: "active",
              startedAt: input.now,
              firstMessageId: draftId,
              latestMessageId: draftId,
              activeDraftMessageId: draftId,
              activeDecisionId: decisionId,
              messageIds: [draftId],
              reasons: ["ai_chat_yellow_transfer"],
              previousAiStatus: item.aiStatus,
              previousAiMode: item.aiMode,
              blockedByRedHandoffId: null,
            },
          }
        : item,
    ),
  };
}

export function consumeAiChatDraftTransfer(
  bridgeState: InMemoryRiskBridgeState,
  input: {
    tenantId: string;
    transferId: string;
    destinationConversationId: string;
    destinationClientId: string;
  },
) {
  const transfer = bridgeState.draftTransfers.find(
    (item) => item.id === input.transferId && item.tenantId === input.tenantId,
  );
  if (!transfer || transfer.status !== "pending") {
    throw new AppRequestError(409, "ai_chat_draft_transfer_unavailable");
  }
  if (
    transfer.destinationConversationId !== input.destinationConversationId ||
    transfer.destinationClientId !== input.destinationClientId
  ) {
    throw new AppRequestError(403, "ai_chat_destination_client_mismatch");
  }
  transfer.status = "consumed";
  transfer.consumedAt = new Date().toISOString();
  transfer.updatedAt = transfer.consumedAt;
  return transfer;
}

export function getPendingAiChatDraftTransfer(
  bridgeState: InMemoryRiskBridgeState,
  tenantId: string,
  destinationConversationId: string,
) {
  return (
    bridgeState.draftTransfers.find(
      (item) =>
        item.tenantId === tenantId &&
        item.destinationConversationId === destinationConversationId &&
        item.status === "pending" &&
        item.transferMode === "composer_pending",
    ) ?? null
  );
}

export function createExplicitAiChatHandoff(
  bridgeState: InMemoryRiskBridgeState,
  appState: ManuAppState,
  input: {
    tenantId: string;
    runId: string;
    conversationId: string;
    clientId: string;
    createdByUserId: string;
    dietitianId: string;
    confirmationToken: string;
    expectedClientContextRevision: number;
  },
): { handoff: HandoffCaseRecord; link: AiChatHandoffLinkDto; nextAppState: ManuAppState } {
  const assessment = bridgeState.riskAssessments.find(
    (item) =>
      item.tenantId === input.tenantId &&
      item.runId === input.runId &&
      item.status === "active" &&
      item.riskLevel === "red",
  );
  if (!assessment || assessment.handoffConfirmationToken !== input.confirmationToken) {
    throw new AppRequestError(403, "ai_chat_handoff_confirmation_invalid");
  }
  const client = appState.clients.find((item) => item.id === input.clientId);
  if (!client || client.contextRevision !== input.expectedClientContextRevision) {
    throw new AppRequestError(409, "ai_chat_client_context_revision_conflict");
  }
  const fingerprint = buildAiChatRedNotificationFingerprint({
    clientId: input.clientId,
    reasons: assessment.reasons,
    sourceRevisionDigest: assessment.sourceRevisionDigest,
  });
  const existing = bridgeState.handoffLinks.find(
    (item) => item.tenantId === input.tenantId && item.fingerprint === fingerprint && item.status === "active",
  );
  if (existing) {
    const handoff = appState.handoffCases.find((item) => item.id === existing.handoffId);
    if (!handoff) throw new AppRequestError(409, "ai_chat_handoff_missing");
    return { handoff, link: existing, nextAppState: appState };
  }
  const now = new Date().toISOString();
  const handoffId = randomUUID();
  const handoff: HandoffCaseRecord = {
    id: handoffId,
    tenantId: input.tenantId,
    dietitianId: input.dietitianId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    triggeringMessageId: null,
    risk: "red",
    reasons: assessment.reasons,
    status: "open",
    urgency: "urgent",
    safeAcknowledgement: "Internal urgent handoff queued from AI Chat.",
    recommendedAction: assessment.recommendedHumanAction,
    createdAt: now,
  };
  const link: AiChatHandoffLinkDto = {
    id: randomUUID(),
    tenantId: input.tenantId,
    runId: input.runId,
    conversationId: input.conversationId,
    clientId: input.clientId,
    createdByUserId: input.createdByUserId,
    handoffId,
    fingerprint,
    confirmationToken: input.confirmationToken,
    status: "active",
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
  };
  bridgeState.handoffLinks.push(link);
  let nextAppState: ManuAppState = {
    ...appState,
    handoffCases: [...appState.handoffCases, handoff],
    clients: appState.clients.map((item) =>
      item.id === input.clientId
        ? {
            ...item,
            aiStatus: "passive",
            aiMode: "manual",
            humanTakeoverLocked: true,
            redRiskLock: {
              status: "locked",
              handoffId,
              lockedAt: now,
              reasons: assessment.reasons,
              previousAiStatus: item.aiStatus,
              previousAiMode: item.aiMode,
            },
            contextRevision: item.contextRevision + 1,
          }
        : item,
    ),
  };
  nextAppState = ensureHumanControlSessionForRiskState(nextAppState, {
    clientId: input.clientId,
    conversationId: input.conversationId,
    reason: "red_risk_lock",
    previousAiStatus: client.aiStatus,
    previousAiMode: client.aiMode,
    linkedHandoffId: handoffId,
    openedAt: now,
  });
  return { handoff, link, nextAppState };
}

export function supersedeAiChatRiskArtifacts(
  bridgeState: InMemoryRiskBridgeState,
  appState: ManuAppState,
  input: { tenantId: string; conversationId: string; runId?: string | null },
) {
  const now = new Date().toISOString();
  for (const item of bridgeState.riskAssessments) {
    if (item.tenantId !== input.tenantId || item.conversationId !== input.conversationId) continue;
    if (input.runId && item.runId !== input.runId) continue;
    if (item.status === "active") {
      item.status = "superseded";
      item.supersededAt = now;
      item.updatedAt = now;
    }
  }
  for (const item of bridgeState.draftTransfers) {
    if (item.tenantId !== input.tenantId) continue;
    if (item.sourceConversationId !== input.conversationId && item.destinationConversationId !== input.conversationId) {
      continue;
    }
    if (item.status === "pending") {
      item.status = "superseded";
      item.supersededAt = now;
      item.updatedAt = now;
    }
  }
  let next = appState;
  for (const item of bridgeState.riskAssessments) {
    if (item.status !== "superseded" || item.riskLevel !== "red" || !item.clientId) continue;
    next = upsertSystemNotificationInState(next, {
      kind: "ai_chat_red_review_required",
      tenantId: item.tenantId,
      type: "system",
      entityType: "ai_chat_run",
      entityId: item.runId,
      title: "AI Chat red review required",
      body: "Prior AI Chat red review context was superseded. Re-run assessment before acting.",
      clientId: item.clientId,
      conversationId: item.conversationId,
      dedupeKey: `p85-4c:red:${item.tenantId}:${item.sourceRevisionDigest}:superseded`,
      resolvedAt: now,
      targetPanel: "ai_chat",
    });
  }
  return next;
}

export function getActiveRunRiskAssessment(bridgeState: InMemoryRiskBridgeState, tenantId: string, runId: string) {
  return (
    bridgeState.riskAssessments.find(
      (item) => item.tenantId === tenantId && item.runId === runId && item.status === "active",
    ) ?? null
  );
}

export function resolveFallbackMessagingState() {
  return getFallbackState();
}

export function commitFallbackMessagingState(state: ManuAppState) {
  saveFallbackState(state);
}

export function assertClientChatRiskBridgeAllowed(scopeType: AiChatScopeType) {
  if (scopeType === "general") {
    throw new AppRequestError(403, "ai_chat_general_scope_risk_bridge_blocked");
  }
}

export function requireHandoffCapability(context: AppTenantContext) {
  if (!hasCapability(context.role, "handoff_update")) {
    throw new AppRequestError(403, "handoff_update_required");
  }
}
