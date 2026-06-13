import { evaluateFoodRuleDecision } from "dietitian-ai-assistant-architecture";
import { buildStructuredFoodRuleManifest } from "./phase-76d-food-rule-model";
import {
  evaluateClientFoodDecisionV2,
  foodDecisionV2ToLegacyFoodRuleResult,
  shouldUseFoodDecisionV2Result,
} from "./phase-77g-food-decision-engine-v2";
import { resolveProductIngredientEvidence } from "./product-ingredient-verification";
import type { ManuAppState } from "./types";
import type { RiskLevel } from "./types";

export type ProductIngredientEvidenceInput = {
  ingredientSourceType: "user_label_text" | "barcode_database" | "approved_product_catalog" | "dietitian_product_note" | "unknown";
  ingredientText: string;
  ingredientConfidence: "exact" | "high" | "low" | "unknown";
};

export function getLatestClientFormAnswers(state: ManuAppState, clientId: string) {
  const response =
    [...state.clientFormResponses]
      .filter((item) => item.clientId === clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  return response?.answers || null;
}

export function buildStructuredFoodRulesFromClientState(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client || client.lifecycleStatus === "removed_anonymized") return null;

  const answers = getLatestClientFormAnswers(state, clientId);
  if (!answers) return null;
  const manifest = buildStructuredFoodRuleManifest(answers);
  return {
    ...manifest,
    allowedSubstitutionsSummary: String(answers.allowed_substitutions || "").trim(),
  };
}

export function evaluateClientFoodDecisionV2FromState(
  state: ManuAppState,
  clientId: string,
  message: string,
  options: {
    riskLevel?: RiskLevel;
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  } = {},
) {
  const productIngredientEvidence = resolveProductIngredientEvidence(
    message,
    options.productIngredientEvidence || null,
  );
  return evaluateClientFoodDecisionV2(state, clientId, message, {
    ...options,
    productIngredientEvidence,
  });
}

export function evaluateClientFoodRuleDecision(
  state: ManuAppState,
  clientId: string,
  message: string,
  options: {
    riskLevel?: RiskLevel;
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  } = {},
) {
  const productIngredientEvidence = resolveProductIngredientEvidence(
    message,
    options.productIngredientEvidence || null,
  );
  const foodDecisionV2 = evaluateClientFoodDecisionV2(state, clientId, message, {
    ...options,
    productIngredientEvidence,
  });

  if (shouldUseFoodDecisionV2Result(foodDecisionV2)) {
    return foodDecisionV2ToLegacyFoodRuleResult(foodDecisionV2);
  }

  const structuredFoodRules = buildStructuredFoodRulesFromClientState(state, clientId);
  return evaluateFoodRuleDecision({
    message,
    structuredFoodRules,
    mixedIntentBlocked: options.mixedIntentBlocked,
    productIngredientEvidence,
  });
}
