import {
  CLINICAL_SAFETY_CLASSIFIER_VERSION,
  classifyClinicalSafetyRisk,
} from "dietitian-ai-assistant-architecture";
import { applyScopeGuardToRiskDecision } from "./scope-guard-runtime";
import type { AiDecisionRecord, ClientRecord, ManuAppState, MessageRecord } from "./types";

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
  });

  return {
    riskDecision: scopeResult.decision,
    scopeGuardEvaluation: scopeResult.evaluationRecord,
    corpusActive: scopeResult.corpusActive,
  };
}

export function modelForRisk(risk: AiDecisionRecord["risk"]) {
  if (risk === "green") return "gemini-1.5-flash";
  if (risk === "yellow") return "gemini-3";
  return null;
}
