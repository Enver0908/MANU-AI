import {
  PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS,
  PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS,
} from "./phase-76d-food-rule-fields";
import type { ClientRecord } from "./types";

export type StructuredFoodRuleExchangeGroup = {
  groupId: string;
  items: string[];
};

export type StructuredFoodRuleManifest = {
  forbiddenFoodItems: string[];
  forbiddenFoodGroups: string[];
  allowedFoodItems: string[];
  allowedFoodGroups: string[];
  dietTypeRules: string | null;
  equivalentExchangeGroups: StructuredFoodRuleExchangeGroup[];
  mandatoryFoodsOrMeals: string[];
  optionalFoodsOrMeals: string[];
  skipToleranceRules: string | null;
  portionBoundaries: string | null;
  ingredientAllergenKeywords: string[];
  productLabelReviewPolicy: string | null;
  uncertaintyPolicy: string | null;
  populatedFieldIds: string[];
};

export function parseCommaList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseMultiselectList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  if (!text) return [];
  return parseCommaList(text);
}

export function parseEquivalentExchangeGroups(value: unknown): StructuredFoodRuleExchangeGroup[] {
  const text = String(value ?? "").trim();
  if (!text) return [];

  return text
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      if (!segment.includes(":")) return null;
      const [rawGroupId, rawItems] = segment.split(":");
      const groupId = rawGroupId.trim();
      const items = rawItems
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!groupId || items.length === 0) return null;
      return { groupId, items };
    })
    .filter((group): group is StructuredFoodRuleExchangeGroup => group !== null);
}

export function hasStructuredFoodRuleValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function buildStructuredFoodRuleManifest(answers: Record<string, unknown>): StructuredFoodRuleManifest {
  const forbiddenFoodItems = parseCommaList(answers.forbidden_food_items);
  const forbiddenFoodGroups = parseMultiselectList(answers.forbidden_food_groups);
  const allowedFoodItems = parseCommaList(answers.allowed_food_items);
  const allowedFoodGroups = parseMultiselectList(answers.allowed_food_groups);
  const equivalentExchangeGroups = parseEquivalentExchangeGroups(answers.equivalent_exchange_groups);
  const mandatoryFoodsOrMeals = parseCommaList(answers.mandatory_foods_or_meals);
  const optionalFoodsOrMeals = parseCommaList(answers.optional_foods_or_meals);
  const ingredientAllergenKeywords = parseMultiselectList(answers.ingredient_allergen_keywords);

  const populatedFieldIds = PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS.filter((fieldId) =>
    hasStructuredFoodRuleValue(answers[fieldId]),
  );

  return {
    forbiddenFoodItems,
    forbiddenFoodGroups,
    allowedFoodItems,
    allowedFoodGroups,
    dietTypeRules: String(answers.diet_type_rules || "").trim() || null,
    equivalentExchangeGroups,
    mandatoryFoodsOrMeals,
    optionalFoodsOrMeals,
    skipToleranceRules: String(answers.skip_tolerance_rules || "").trim() || null,
    portionBoundaries: String(answers.portion_boundaries || "").trim() || null,
    ingredientAllergenKeywords,
    productLabelReviewPolicy: String(answers.product_label_review_policy || "").trim() || null,
    uncertaintyPolicy: String(answers.uncertainty_policy || "").trim() || null,
    populatedFieldIds,
  };
}

export function evaluateStructuredFoodRuleCompleteness(answers: Record<string, unknown>) {
  const missing: string[] = [];

  for (const fieldId of PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS) {
    if (!hasStructuredFoodRuleValue(answers[fieldId])) {
      missing.push(`structured_food_rule_missing_${fieldId}`);
    }
  }

  const hasForbiddenSource =
    hasStructuredFoodRuleValue(answers.forbidden_food_items) ||
    hasStructuredFoodRuleValue(answers.forbidden_food_groups) ||
    hasStructuredFoodRuleValue(answers.restricted_foods_medical) ||
    hasStructuredFoodRuleValue(answers.allergies);
  if (!hasForbiddenSource) {
    missing.push("structured_food_rule_missing_forbidden_source");
  }

  const hasAllowedSource =
    hasStructuredFoodRuleValue(answers.allowed_food_items) ||
    hasStructuredFoodRuleValue(answers.allowed_food_groups) ||
    hasStructuredFoodRuleValue(answers.allowed_substitutions);
  if (!hasAllowedSource) {
    missing.push("structured_food_rule_missing_allowed_source");
  }

  const exchangeGroups = parseEquivalentExchangeGroups(answers.equivalent_exchange_groups);
  if (hasStructuredFoodRuleValue(answers.equivalent_exchange_groups) && exchangeGroups.length === 0) {
    missing.push("structured_food_rule_invalid_equivalent_exchange_groups");
  }

  return {
    complete: missing.length === 0,
    missing,
    manifest: buildStructuredFoodRuleManifest(answers),
  };
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function dedupeTokens(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const token = normalizeToken(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    result.push(value.trim());
  }
  return result;
}

export function syncClientRecordFromFoodRuleAnswers(
  client: ClientRecord,
  answers: Record<string, unknown>,
): ClientRecord {
  const manifest = buildStructuredFoodRuleManifest(answers);
  const allergySources = [...parseCommaList(answers.allergies), ...manifest.forbiddenFoodItems];
  const restrictedSources = [
    ...manifest.forbiddenFoodItems,
    ...manifest.forbiddenFoodGroups,
    ...parseCommaList(answers.restricted_foods_medical),
  ];

  return {
    ...client,
    allergies: dedupeTokens([...client.allergies, ...allergySources]),
    restrictedFoods: dedupeTokens([...client.restrictedFoods, ...restrictedSources]),
  };
}

export function buildStructuredFoodRuleFieldManifest(answers: Record<string, unknown>) {
  const manifest = buildStructuredFoodRuleManifest(answers);
  return PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS.map((fieldId) => ({
    fieldId,
    hasValue: hasStructuredFoodRuleValue(answers[fieldId]),
    registryVersion: "phase-76d-food-rule-registry-v1",
    segmentCount:
      fieldId === "equivalent_exchange_groups"
        ? manifest.equivalentExchangeGroups.length
        : fieldId.endsWith("_groups") || fieldId.endsWith("_keywords")
          ? parseMultiselectList(answers[fieldId]).length
          : fieldId.endsWith("_items") || fieldId.endsWith("_meals")
            ? parseCommaList(answers[fieldId]).length
            : hasStructuredFoodRuleValue(answers[fieldId])
              ? 1
              : 0,
  }));
}
