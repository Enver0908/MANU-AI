import {
  COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  assertClientExportMetadataSafe,
  assertStyleEditDoesNotMutateClinicalDecision,
  buildCopilotQualityReviewContext,
  detectClientExportMetadataLeaks,
  sanitizeClientScopedExportForClientFacing as sanitizeClientScopedExportCore,
} from "dietitian-ai-assistant-architecture";
import type { ClientScopedExport } from "./data-governance";
import type { AiDecisionRecord, ManuAppState, MessageRecord } from "./types";

export const PHASE_77V_COPILOT_QUALITY_WORKFLOW_VERSION = "phase-77v-copilot-quality-workflow-v1";

export {
  COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  assertClientExportMetadataSafe,
  assertStyleEditDoesNotMutateClinicalDecision,
  buildCopilotQualityReviewContext,
  detectClientExportMetadataLeaks,
};

export function sanitizeClientScopedExportForClientFacing(exportData: ClientScopedExport): ClientScopedExport {
  return sanitizeClientScopedExportCore(exportData) as ClientScopedExport;
}

export function evaluatePhase77vClientExportSafety(exportPayload: unknown) {
  const leaks = detectClientExportMetadataLeaks(exportPayload);
  return {
    status: leaks.length === 0 ? ("pass" as const) : ("fail" as const),
    workflowVersion: COPILOT_QUALITY_WORKFLOW_V1_VERSION,
    leakCount: leaks.length,
    leaks,
  };
}

export function findAiDecisionForDraftMessage(state: ManuAppState, messageId: string): AiDecisionRecord | null {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message?.generatedByAiDecisionId) return null;
  return state.aiDecisions.find((decision) => decision.id === message.generatedByAiDecisionId) || null;
}

export function buildDraftCopilotQualityReviewContext(
  state: ManuAppState,
  messageId: string,
  draftBody?: string | null,
) {
  const decision = findAiDecisionForDraftMessage(state, messageId);
  if (!decision) return null;
  const message = state.messages.find((item) => item.id === messageId);
  return buildCopilotQualityReviewContext({
    decision,
    draftBody: draftBody ?? message?.body ?? null,
  });
}

export function buildCopilotQualityReviewForPendingDraft(
  aiDecisions: AiDecisionRecord[],
  messages: MessageRecord[],
  draftEdits: Record<string, string> = {},
) {
  const pendingDraft = messages.find((message) => message.status === "draft" && message.origin === "ai_generated");
  if (!pendingDraft) return null;
  const decision = pendingDraft.generatedByAiDecisionId
    ? aiDecisions.find((item) => item.id === pendingDraft.generatedByAiDecisionId)
    : null;
  if (!decision) return null;
  return buildCopilotQualityReviewContext({
    decision,
    draftBody: draftEdits[pendingDraft.id] ?? pendingDraft.body,
  });
}
