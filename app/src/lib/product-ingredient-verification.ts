import {
  evaluateProductIngredientVerification,
  PRODUCT_INGREDIENT_VERIFICATION_VERSION,
} from "dietitian-ai-assistant-architecture";
import type { ProductIngredientEvidenceInput } from "./food-rule-runtime";

export {
  evaluateProductIngredientVerification,
  PRODUCT_INGREDIENT_VERIFICATION_VERSION,
};

export type ProductIngredientVerificationDecision =
  | "product_allowed"
  | "product_blocked"
  | "requires_review";

const LABEL_TEXT_PATTERNS = [
  /(?:icindekiler|içindekiler|ingredients?|etiket(?:te)?)\s*[:\-]\s*(.+)$/i,
  /(?:icerik(?:te)?|içerik(?:te)?)\s+(.+)$/i,
];

const PRODUCT_QUERY_PATTERN =
  /\b(?:icerik\w*|ingredient\w*|etiket\w*|label|icinde\w*|içinde\w*)\b/i;

export function isProductIngredientQuery(message: string) {
  return PRODUCT_QUERY_PATTERN.test(message);
}

export function extractUserLabelTextFromMessage(message: string) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return null;

  for (const pattern of LABEL_TEXT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

export function buildProductIngredientEvidenceFromMessage(
  message: string,
  options: {
    ingredientSourceType?: ProductIngredientEvidenceInput["ingredientSourceType"];
    ingredientConfidence?: ProductIngredientEvidenceInput["ingredientConfidence"];
  } = {},
): ProductIngredientEvidenceInput | null {
  if (!isProductIngredientQuery(message)) {
    return null;
  }

  const ingredientText = extractUserLabelTextFromMessage(message);
  if (!ingredientText) {
    return null;
  }

  return {
    ingredientSourceType: options.ingredientSourceType ?? "user_label_text",
    ingredientText,
    ingredientConfidence: options.ingredientConfidence ?? "exact",
  };
}

export function resolveProductIngredientEvidence(
  message: string,
  explicitEvidence?: ProductIngredientEvidenceInput | null,
) {
  if (explicitEvidence?.ingredientText?.trim()) {
    return explicitEvidence;
  }
  return buildProductIngredientEvidenceFromMessage(message);
}
