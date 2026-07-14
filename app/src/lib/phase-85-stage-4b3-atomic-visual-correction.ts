import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import { STAGE_4B3_VISUAL_CORRECTION_OUTCOME_VERSION } from "./phase-85-stage-4b3-atomic-outcomes";
import { applyStage4B3CorrectionFollowUpNotification } from "./phase-85-stage-4b3-bundle-notifications";
import type { VisualCorrectionRequest, VisualObservationV1 } from "./phase-85-stage-4b3-media-contracts";
import { invalidatePendingDrafts } from "./simulator";
import type { ManuAppState, VisualAnalysisRecord } from "./types";

export const STAGE_4B3_ATOMIC_VISUAL_CORRECTION_VERSION = "p85-stage-4b3-atomic-visual-correction-v2";

export type AtomicVisualCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string; replay: boolean }
  | { ok: false; failureCode: string; state: ManuAppState };

function buildCorrectedAnalysisRecord(input: {
  state: ManuAppState;
  source: VisualAnalysisRecord;
  request: VisualCorrectionRequest;
  correctedAnalysisId: string;
  now: string;
}): VisualAnalysisRecord | null {
  const sourceObservation = input.source.observation;
  if (!sourceObservation) return null;
  if (
    !requestHasCorrectedObservationFields(input.request) &&
    input.request.reasonCode !== "wrong_scene" &&
    input.request.reasonCode !== "wrong_food_candidate"
  ) {
    return null;
  }

  const observation: VisualObservationV1 = {
    ...sourceObservation,
    sceneType: input.request.correctedSceneType ?? sourceObservation.sceneType,
    entityCandidates:
      input.request.correctedEntityLabels && input.request.correctedEntityLabels.length > 0
        ? input.request.correctedEntityLabels.map((label) => ({
            label,
            normalizedLabel: label,
            confidence: 0.96,
            candidateKind: "food" as const,
          }))
        : sourceObservation.entityCandidates,
    ocrBlocks:
      input.request.correctedOcrText && input.request.correctedOcrText.trim()
        ? [{ text: input.request.correctedOcrText, confidence: 0.96, blockKind: "label" as const }]
        : sourceObservation.ocrBlocks,
  };

  return {
    id: input.correctedAnalysisId,
    tenantId: input.source.tenantId,
    clientId: input.source.clientId,
    conversationId: input.source.conversationId,
    mediaAssetId: input.source.mediaAssetId,
    messageId: input.source.messageId,
    bundleId: input.source.bundleId,
    analysisRevision: input.source.analysisRevision + 1,
    status: "ready",
    observation,
    supersededByAnalysisId: null,
    failureCode: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function requestHasCorrectedObservationFields(request: VisualCorrectionRequest): boolean {
  return Boolean(
    request.correctedSceneType ||
      (request.correctedEntityLabels && request.correctedEntityLabels.length > 0) ||
      (request.correctedOcrText && request.correctedOcrText.trim()),
  );
}

export function commitAtomicVisualCorrectionV2(
  baseState: ManuAppState,
  request: VisualCorrectionRequest & { dietitianId: string },
): AtomicVisualCorrectionSubmitResult {
  const now = new Date().toISOString();
  const requestId = request.requestId.trim();

  if (baseState.processedVisualCorrectionRequestIds.includes(requestId)) {
    const correction = baseState.visualCorrections.find(
      (entry) => entry.id === baseState.visualCorrectionReplayByRequestId[requestId]?.correctionId,
    );
    if (correction) {
      return {
        ok: true,
        state: baseState,
        correctionId: correction.id,
        resultAction: correction.resultAction,
        replay: true,
      };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state: baseState };
  }

  const analysis = baseState.visualAnalysisRecords.find((entry) => entry.id === request.analysisId);
  if (!analysis) {
    return { ok: false, failureCode: "analysis_not_found", state: baseState };
  }

  const conversation = baseState.conversations.find((entry) => entry.id === analysis.conversationId);
  if (!conversation) {
    return { ok: false, failureCode: "conversation_not_found", state: baseState };
  }
  if (conversationRevisionOrDefault(conversation) !== request.expectedConversationRevision) {
    return { ok: false, failureCode: "stale_conversation_revision", state: baseState };
  }
  if (analysis.analysisRevision !== request.expectedAnalysisRevision) {
    return { ok: false, failureCode: "stale_analysis_revision", state: baseState };
  }

  const bundle =
    analysis.bundleId != null
      ? baseState.inboundMessageBundles.find((entry) => entry.id === analysis.bundleId)
      : null;
  const linkedDecision = bundle?.decisionId
    ? baseState.aiDecisions.find((entry) => entry.id === bundle.decisionId)
    : null;
  const linkedOutbound = linkedDecision
    ? baseState.messages.find(
        (message) =>
          message.generatedByAiDecisionId === linkedDecision.id &&
          message.origin === "ai_generated" &&
          message.status === "sent",
      )
    : null;
  const pendingDraft = linkedDecision
    ? baseState.messages.find(
        (message) =>
          message.generatedByAiDecisionId === linkedDecision.id &&
          message.origin === "ai_generated" &&
          message.status === "draft",
      )
    : null;

  let resultAction: "supersede_rerun" | "invalidate_pending" | "manual_follow_up" | "closed_without_send";
  let status: "submitted" | "applied_to_pending" | "manual_follow_up_required" | "closed";

  if (linkedOutbound) {
    resultAction = "manual_follow_up";
    status = "manual_follow_up_required";
  } else if (pendingDraft || (bundle && !bundle.decisionId)) {
    resultAction = pendingDraft ? "invalidate_pending" : "supersede_rerun";
    status = "applied_to_pending";
  } else if (bundle?.decisionId) {
    resultAction = "invalidate_pending";
    status = "applied_to_pending";
  } else {
    resultAction = "supersede_rerun";
    status = "submitted";
  }

  const correctionId = crypto.randomUUID();
  const correctedAnalysisId = crypto.randomUUID();
  const correctedAnalysis = buildCorrectedAnalysisRecord({
    state: baseState,
    source: analysis,
    request,
    correctedAnalysisId,
    now,
  });

  const sentBefore = baseState.messages.filter(
    (message) => message.origin === "ai_generated" && message.status === "sent",
  ).length;

  let nextState: ManuAppState = {
    ...baseState,
    visualCorrections: [
      ...baseState.visualCorrections,
      {
        id: correctionId,
        tenantId: baseState.tenant.id,
        clientId: analysis.clientId,
        conversationId: analysis.conversationId,
        analysisId: analysis.id,
        dietitianId: request.dietitianId,
        status,
        reasonCode: request.reasonCode,
        explanation: request.explanation.trim(),
        correctedSceneType: request.correctedSceneType ?? null,
        correctedOcrText: request.correctedOcrText ?? null,
        correctedEntityLabels: request.correctedEntityLabels ?? [],
        conversationRevisionAtSubmit: request.expectedConversationRevision,
        analysisRevisionAtSubmit: request.expectedAnalysisRevision,
        resultAction,
        createdAt: now,
        updatedAt: now,
      },
    ],
    visualAnalysisRecords: [
      ...baseState.visualAnalysisRecords.map((entry) =>
        entry.id === analysis.id
          ? {
              ...entry,
              status: "superseded" as const,
              supersededByAnalysisId: correctedAnalysis?.id ?? null,
              updatedAt: now,
            }
          : entry,
      ),
      ...(correctedAnalysis ? [correctedAnalysis] : []),
    ],
    auditEvents: [
      ...baseState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: baseState.tenant.id,
        eventType: "visual_correction_submitted_atomic_v2",
        entityType: "visual_correction",
        entityId: correctionId,
        metadata: {
          analysisId: analysis.id,
          resultAction,
          requestId,
          version: STAGE_4B3_VISUAL_CORRECTION_OUTCOME_VERSION,
        },
        createdAt: now,
      },
    ],
    processedVisualCorrectionRequestIds: [...baseState.processedVisualCorrectionRequestIds, requestId],
    visualCorrectionReplayByRequestId: {
      ...baseState.visualCorrectionReplayByRequestId,
      [requestId]: { correctionId, resultAction },
    },
  };

  if (resultAction === "invalidate_pending" || resultAction === "supersede_rerun") {
    nextState = invalidatePendingDrafts(nextState, now, "visual_correction_submitted");
    if (bundle) {
      nextState = {
        ...nextState,
        inboundMessageBundles: nextState.inboundMessageBundles.map((entry) =>
          entry.id === bundle.id
            ? {
                ...entry,
                status: entry.status === "decided" || entry.status === "completed" ? "ready" : entry.status,
                decisionId: null,
                leaseExpiresAt: null,
                bundleRevision: entry.bundleRevision + 1,
                updatedAt: now,
              }
            : entry,
        ),
      };
    }
  }

  if (resultAction === "manual_follow_up") {
    const client = baseState.clients.find((entry) => entry.id === analysis.clientId);
    if (client) {
      nextState = {
        ...nextState,
        clients: nextState.clients.map((entry) =>
          entry.id === client.id
            ? {
                ...entry,
                aiStatus: "passive" as const,
                aiMode: "manual" as const,
                humanTakeoverLocked: true,
                contextRevision: entry.contextRevision + 1,
              }
            : entry,
        ),
        auditEvents: [
          ...nextState.auditEvents,
          {
            id: crypto.randomUUID(),
            tenantId: baseState.tenant.id,
            eventType: "visual_correction_manual_follow_up_required",
            entityType: "client",
            entityId: client.id,
            metadata: {
              correctionId,
              priorDecisionId: bundle?.decisionId ?? null,
              priorOutboundMessageId: linkedOutbound?.id ?? null,
            },
            createdAt: now,
          },
        ],
      };
      nextState = applyStage4B3CorrectionFollowUpNotification(nextState, {
        correctionId,
        clientId: client.id,
        conversationId: analysis.conversationId,
        analysisId: analysis.id,
        clientName: client.fullName,
        now,
      });
    }
  }

  const sentAfter = nextState.messages.filter(
    (message) => message.origin === "ai_generated" && message.status === "sent",
  ).length;
  if (resultAction === "manual_follow_up" && sentAfter !== sentBefore) {
    return { ok: false, failureCode: "sent_correction_auto_message_forbidden", state: baseState };
  }

  return { ok: true, state: nextState, correctionId, resultAction, replay: false };
}

export function buildVisualCorrectionRpcOutcome(input: {
  state: ManuAppState;
  baseState: ManuAppState;
  correctionId: string;
  resultAction: string;
  request: VisualCorrectionRequest & { dietitianId: string };
}): Record<string, unknown> {
  const correction = input.state.visualCorrections.find((entry) => entry.id === input.correctionId);
  if (!correction) {
    throw new Error("visual_correction_missing");
  }

  const sourceAnalysis = input.state.visualAnalysisRecords.find((entry) => entry.id === correction.analysisId);
  const correctedAnalysis =
    sourceAnalysis?.supersededByAnalysisId != null
      ? (input.state.visualAnalysisRecords.find((entry) => entry.id === sourceAnalysis.supersededByAnalysisId) ?? null)
      : null;

  const bundle =
    sourceAnalysis?.bundleId != null
      ? (input.state.inboundMessageBundles.find((entry) => entry.id === sourceAnalysis.bundleId) ?? null)
      : null;

  const baseDraftIds = new Set(
    input.baseState.messages.filter((message) => message.status === "draft").map((message) => message.id),
  );
  const draftInvalidations = input.state.messages.filter(
    (message) => baseDraftIds.has(message.id) && message.status !== "draft",
  );

  const baseClient = input.baseState.clients.find((entry) => entry.id === correction.clientId);
  const nextClient = input.state.clients.find((entry) => entry.id === correction.clientId);

  return {
    version: STAGE_4B3_VISUAL_CORRECTION_OUTCOME_VERSION,
    correctionId: correction.id,
    analysisId: correction.analysisId,
    expectedConversationRevision: correction.conversationRevisionAtSubmit,
    expectedAnalysisRevision: correction.analysisRevisionAtSubmit,
    resultAction: input.resultAction,
    correction,
    correctedAnalysisId: correctedAnalysis?.id ?? null,
    correctedAnalysis: correctedAnalysis ?? null,
    bundleUpdate: bundle
      ? {
          status: bundle.status,
          decisionId: bundle.decisionId,
          bundleRevision: bundle.bundleRevision,
        }
      : null,
    draftInvalidations,
    outboundMessages: [],
    notifications: input.state.notifications.filter(
      (notification) => !input.baseState.notifications.some((entry) => entry.id === notification.id),
    ),
    auditEvents: input.state.auditEvents.filter(
      (audit) => !input.baseState.auditEvents.some((entry) => entry.id === audit.id),
    ),
    clientUpdate:
      baseClient && nextClient && baseClient !== nextClient
        ? {
            aiStatus: nextClient.aiStatus,
            aiMode: nextClient.aiMode,
            humanTakeoverLocked: nextClient.humanTakeoverLocked,
            contextRevision: nextClient.contextRevision,
          }
        : null,
  };
}
