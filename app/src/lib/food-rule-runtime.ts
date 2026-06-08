import { evaluateFoodRuleDecision } from "dietitian-ai-assistant-architecture";
import { buildStructuredFoodRuleManifest } from "./phase-76d-food-rule-model";
import { resolveProductIngredientEvidence } from "./product-ingredient-verification";
import type { ManuAppState } from "./types";

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

export function evaluateClientFoodRuleDecision(
  state: ManuAppState,
  clientId: string,
  message: string,
  options: {
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  } = {},
) {
  const structuredFoodRules = buildStructuredFoodRulesFromClientState(state, clientId);
  const productIngredientEvidence = resolveProductIngredientEvidence(
    message,
    options.productIngredientEvidence || null,
  );

  if (!structuredFoodRules) {
    return evaluateFoodRuleDecision({
      message,
      structuredFoodRules: null,
      mixedIntentBlocked: options.mixedIntentBlocked,
      productIngredientEvidence,
    });
  }

  return evaluateFoodRuleDecision({
    message,
    structuredFoodRules,
    mixedIntentBlocked: options.mixedIntentBlocked,
    productIngredientEvidence,
  });
}
