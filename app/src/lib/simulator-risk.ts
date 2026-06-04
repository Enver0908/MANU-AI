import {
  CLINICAL_SAFETY_CLASSIFIER_VERSION,
  classifyClinicalSafetyRisk,
} from "dietitian-ai-assistant-architecture";
import { applyScopeGuardToRiskDecision } from "./scope-guard-runtime";
import type { LaunchGateEvidenceRecord } from "./launch-gates";
import type { ClientRecord, ManuAppState, MessageRecord } from "./types";

export { CLINICAL_SAFETY_CLASSIFIER_VERSION as SAFETY_CLASSIFIER_VERSION };

export async function classifySimulationRisk(
  state: ManuAppState,
  client: ClientRecord,
  body: string,
  recentMessages: MessageRecord[] = [],
  options: {
    conversationId?: string | null;
    messageId?: string | null;
    approvedLaunchGateIds?: string[];
    launchGateEvidence?: LaunchGateEvidenceRecord[];
  } = {},
) {
  const baseDecision = classifyClinicalSafetyRisk({
    message: body,
    recentMessages,
    clientProfile: {
      highRisk: client.clinicalRiskNotes.length > 0,
      healthProfile: client.healthProfile,
      allergies: client.allergies,
      restrictedFoods: client.restrictedFoods,
    },
  });

  const scopeResult = await applyScopeGuardToRiskDecision({
    state,
    message: body,
    baseDecision,
    conversationId: options.conversationId ?? null,
    messageId: options.messageId ?? null,
    approvedLaunchGateIds: options.approvedLaunchGateIds,
    launchGateEvidence: options.launchGateEvidence,
  });

  return {
    riskDecision: scopeResult.decision,
    scopeGuardEvaluation: scopeResult.evaluationRecord,
    corpusActive: scopeResult.corpusActive,
  };
}
