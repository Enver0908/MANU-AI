import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import { invalidatePendingDrafts } from "./simulator";
import type {
  VisualCorrectionReasonCode,
  VisualCorrectionRequest,
  VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState } from "./types";
import { AppDomainError } from "./app-errors";

export const STAGE_4B3_VISUAL_CORRECTIONS_VERSION = "p85-stage-4b3-visual-corrections-v1";

export type VisualCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string }
  | { ok: false; failureCode: string };

export function submitVisualCorrection(
  state: ManuAppState,
  request: VisualCorrectionRequest & { dietitianId: string },
): VisualCorrectionSubmitResult {
  const analysis = state.visualAnalysisRecords.find((entry) => entry.id === request.analysisId);
  if (!analysis) {
    return { ok: false, failureCode: "analysis_not_found" };
  }

  const conversation = state.conversations.find((entry) => entry.id === analysis.conversationId);
  if (!conversation) {
    return { ok: false, failureCode: "conversation_not_found" };
  }
  if (conversationRevisionOrDefault(conversation) !== request.expectedConversationRevision) {
    return { ok: false, failureCode: "stale_conversation_revision" };
  }
  if (analysis.analysisRevision !== request.expectedAnalysisRevision) {
    return { ok: false, failureCode: "stale_analysis_revision" };
  }

  const bundle =
    analysis.bundleId != null
      ? state.inboundMessageBundles.find((entry) => entry.id === analysis.bundleId)
      : null;
  const linkedDecision = bundle?.decisionId
    ? state.aiDecisions.find((entry) => entry.id === bundle.decisionId)
    : null;
  const linkedOutbound = linkedDecision
    ? state.messages.find(
        (message) =>
          message.generatedByAiDecisionId === linkedDecision.id &&
          message.origin === "ai_generated" &&
          message.status === "sent",
      )
    : null;
  const pendingDraft = linkedDecision
    ? state.messages.find(
        (message) =>
          message.generatedByAiDecisionId === linkedDecision.id &&
          message.origin === "ai_generated" &&
          message.status === "draft",
      )
    : null;

  const now = new Date().toISOString();
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
  let nextState: ManuAppState = {
    ...state,
    visualCorrections: [
      ...state.visualCorrections,
      {
        id: correctionId,
        tenantId: state.tenant.id,
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
    visualAnalysisRecords: state.visualAnalysisRecords.map((entry) =>
      entry.id === analysis.id
        ? {
            ...entry,
            status: "superseded" as const,
            supersededByAnalysisId: null,
            updatedAt: now,
          }
        : entry,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "visual_correction_submitted",
        entityType: "visual_correction",
        entityId: correctionId,
        metadata: {
          analysisId: analysis.id,
          resultAction,
          requestId: request.requestId,
        },
        createdAt: now,
      },
    ],
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
    const client = state.clients.find((entry) => entry.id === analysis.clientId);
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
            tenantId: state.tenant.id,
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
    }
  }

  return { ok: true, state: nextState, correctionId, resultAction };
}

export function validateVisualCorrectionRequest(request: VisualCorrectionRequest): void {
  if (!request.explanation.trim()) {
    throw new AppDomainError(400, "visual_correction_explanation_required");
  }
  if (!request.requestId.trim()) {
    throw new AppDomainError(400, "visual_correction_request_id_required");
  }
}

export function isVisualSceneCorrection(value: unknown): value is VisualSceneType {
  return typeof value === "string" && value.length > 0;
}

export function isVisualCorrectionReason(value: unknown): value is VisualCorrectionReasonCode {
  return typeof value === "string" && value.length > 0;
}
