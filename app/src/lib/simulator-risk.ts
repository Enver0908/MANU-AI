import {
  CLINICAL_SAFETY_CLASSIFIER_VERSION,
  classifyClinicalSafetyRisk,
  type RiskDecision,
} from "dietitian-ai-assistant-architecture";
import { applyPermissionGraphToRiskDecision } from "./phase-76l-permission-graph-runtime";
import { applyScopeGuardToRiskDecision } from "./scope-guard-runtime";
import { evaluateClientFoodDecisionV2FromState, evaluateClientFoodRuleDecision } from "./food-rule-runtime";
import { shouldUseFoodDecisionV2Result } from "./phase-77g-food-decision-engine-v2";
import { resolveProductIngredientEvidence } from "./product-ingredient-verification";
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
  const productIngredientEvidence = resolveProductIngredientEvidence(body);
  const foodRuleDecision = evaluateClientFoodRuleDecision(state, client.id, body, {
    riskLevel: "green",
    productIngredientEvidence,
  });
  const foodDecisionV2Candidate = evaluateClientFoodDecisionV2FromState(state, client.id, body, {
    riskLevel: "green",
    productIngredientEvidence,
  });
  const foodDecisionV2 = shouldUseFoodDecisionV2Result(foodDecisionV2Candidate)
    ? foodDecisionV2Candidate
    : null;

  const baseDecision = classifyClinicalSafetyRisk({
    message: body,
    recentMessages,
    clientProfile: {
      highRisk: client.clinicalRiskNotes.length > 0,
      healthProfile: client.healthProfile,
      allergies: client.allergies,
      restrictedFoods: client.restrictedFoods,
    },
    foodRuleDecision,
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

  const permissionGraphResult = applyPermissionGraphToRiskDecision({
    state,
    client,
    message: body,
    baseDecision: {
      ...scopeResult.decision,
      foodRuleDecision: foodRuleDecision
        ? {
            decision: foodRuleDecision.decision,
            reasons: foodRuleDecision.reasons,
            queryType: foodRuleDecision.queryType,
          }
        : null,
      foodDecisionV2: foodDecisionV2
        ? {
            decision: foodDecisionV2.decision,
            queryType: foodDecisionV2.queryType,
            providerEligible: foodDecisionV2.providerEligible,
            reasonCodes: foodDecisionV2.reasonCodes,
          }
        : undefined,
    },
    conversationId: options.conversationId ?? null,
    messageId: options.messageId ?? null,
    launchGateEvidence: options.launchGateEvidence,
    activePlanAvailable: Boolean(client.dietPlan.summary?.trim()),
  });

  const scopedDecision = scopeResult.decision as RiskDecision;
  const routedDecision = permissionGraphResult.decision;
  const riskDecision: RiskDecision = {
    level: routedDecision.level,
    reasons: routedDecision.reasons,
    classifierVersion: routedDecision.classifierVersion,
    shouldHandoff: routedDecision.shouldHandoff ?? scopedDecision.shouldHandoff,
    pauseAutopilot: routedDecision.pauseAutopilot ?? scopedDecision.pauseAutopilot,
    ...(scopedDecision.layers ? { layers: scopedDecision.layers } : {}),
  };

  return {
    riskDecision,
    permissionGraph: permissionGraphResult.decision.permissionGraph,
    scopeGuardEvaluation: scopeResult.evaluationRecord,
    permissionGraphEvaluation: permissionGraphResult.evaluationRecord,
    corpusActive: scopeResult.corpusActive,
  };
}
