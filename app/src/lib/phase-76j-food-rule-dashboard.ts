import { AppDomainError } from "./app-errors";
import { getActiveFormSchema, saveClientFormResponseInState } from "./client-forms";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import {
  PHASE_76D_DIET_TYPE_OPTIONS,
  PHASE_76D_FOOD_GROUP_OPTIONS,
  PHASE_76D_INGREDIENT_KEYWORD_OPTIONS,
  PHASE_76D_PRODUCT_LABEL_REVIEW_OPTIONS,
  PHASE_76D_SKIP_TOLERANCE_OPTIONS,
  PHASE_76D_UNCERTAINTY_POLICY_OPTIONS,
} from "./phase-76d-food-rule-fields";
import {
  parseCommaList,
  parseEquivalentExchangeGroups,
  parseMultiselectList,
  type StructuredFoodRuleExchangeGroup,
} from "./phase-76d-food-rule-model";
import type { ManuAppState } from "./types";

export const PHASE_76J_FOOD_RULE_DASHBOARD_VERSION = "phase-76j-food-rule-dashboard-v1";

export const FOOD_RULE_DASHBOARD_WARNINGS = {
  clinicalReview:
    "Bu kural degisikligi klinik inceleme gerektirebilir. Uretim aktivasyonu icin dis onayli klinik taxonomy kaniti gerekir.",
  productionActivation:
    "Yerel prototipte kaydedilir; uretim pilotu aktivasyonu dis hukuki/gizlilik ve klinik launch gate onaylari olmadan acilmaz.",
} as const;

export type FoodRuleDashboardState = {
  forbiddenFoodItems: string[];
  forbiddenFoodGroups: string[];
  allowedFoodItems: string[];
  allowedFoodGroups: string[];
  dietTypeRules: string;
  equivalentExchangeGroups: string;
  mandatoryFoodsOrMeals: string[];
  optionalFoodsOrMeals: string[];
  skipToleranceRules: string;
  portionBoundaries: string;
  ingredientAllergenKeywords: string[];
  productLabelReviewPolicy: string;
  uncertaintyPolicy: string;
};

export function createDefaultFoodRuleDashboardState(): FoodRuleDashboardState {
  return {
    forbiddenFoodItems: [],
    forbiddenFoodGroups: [],
    allowedFoodItems: [],
    allowedFoodGroups: [],
    dietTypeRules: PHASE_76D_DIET_TYPE_OPTIONS[0],
    equivalentExchangeGroups: "",
    mandatoryFoodsOrMeals: [],
    optionalFoodsOrMeals: [],
    skipToleranceRules: PHASE_76D_SKIP_TOLERANCE_OPTIONS[0],
    portionBoundaries: "",
    ingredientAllergenKeywords: [],
    productLabelReviewPolicy: PHASE_76D_PRODUCT_LABEL_REVIEW_OPTIONS[0],
    uncertaintyPolicy: PHASE_76D_UNCERTAINTY_POLICY_OPTIONS[0],
  };
}

export function loadFoodRuleDashboardState(answers: Record<string, unknown> | null | undefined): FoodRuleDashboardState {
  const defaults = createDefaultFoodRuleDashboardState();
  if (!answers) return defaults;

  return {
    forbiddenFoodItems: parseCommaList(answers.forbidden_food_items),
    forbiddenFoodGroups: parseMultiselectList(answers.forbidden_food_groups),
    allowedFoodItems: parseCommaList(answers.allowed_food_items),
    allowedFoodGroups: parseMultiselectList(answers.allowed_food_groups),
    dietTypeRules: String(answers.diet_type_rules || defaults.dietTypeRules).trim() || defaults.dietTypeRules,
    equivalentExchangeGroups: serializeEquivalentExchangeGroups(parseEquivalentExchangeGroups(answers.equivalent_exchange_groups)),
    mandatoryFoodsOrMeals: parseCommaList(answers.mandatory_foods_or_meals),
    optionalFoodsOrMeals: parseCommaList(answers.optional_foods_or_meals),
    skipToleranceRules:
      String(answers.skip_tolerance_rules || defaults.skipToleranceRules).trim() || defaults.skipToleranceRules,
    portionBoundaries: String(answers.portion_boundaries || "").trim(),
    ingredientAllergenKeywords: parseMultiselectList(answers.ingredient_allergen_keywords),
    productLabelReviewPolicy:
      String(answers.product_label_review_policy || defaults.productLabelReviewPolicy).trim() ||
      defaults.productLabelReviewPolicy,
    uncertaintyPolicy:
      String(answers.uncertainty_policy || defaults.uncertaintyPolicy).trim() || defaults.uncertaintyPolicy,
  };
}

export function serializeEquivalentExchangeGroups(groups: StructuredFoodRuleExchangeGroup[]) {
  return groups
    .map((group) => `${group.groupId}: ${group.items.join("|")}`)
    .join("; ")
    .trim();
}

export function buildFoodRuleAnswersFromDashboardState(state: FoodRuleDashboardState): Record<string, unknown> {
  return {
    forbidden_food_items: state.forbiddenFoodItems.join(", "),
    forbidden_food_groups: state.forbiddenFoodGroups,
    allowed_food_items: state.allowedFoodItems.join(", "),
    allowed_food_groups: state.allowedFoodGroups,
    diet_type_rules: state.dietTypeRules,
    equivalent_exchange_groups: state.equivalentExchangeGroups.trim(),
    mandatory_foods_or_meals: state.mandatoryFoodsOrMeals.join(", "),
    optional_foods_or_meals: state.optionalFoodsOrMeals.join(", "),
    skip_tolerance_rules: state.skipToleranceRules,
    portion_boundaries: state.portionBoundaries.trim(),
    ingredient_allergen_keywords: state.ingredientAllergenKeywords,
    product_label_review_policy: state.productLabelReviewPolicy,
    uncertainty_policy: state.uncertaintyPolicy,
  };
}

export function mergeFoodRuleDashboardIntoAnswers(
  existingAnswers: Record<string, unknown> | null | undefined,
  foodRuleState: FoodRuleDashboardState,
) {
  const base = existingAnswers ? { ...existingAnswers } : { ...buildPhase70QualifiedClientAnswers() };
  return {
    ...base,
    ...buildFoodRuleAnswersFromDashboardState(foodRuleState),
  };
}

export function getClientFoodRuleDashboardState(state: ManuAppState, clientId: string) {
  const schema = getActiveFormSchema(state);
  if (!schema) return createDefaultFoodRuleDashboardState();

  const response = state.clientFormResponses.find(
    (item) => item.clientId === clientId && item.schemaId === schema.id,
  );
  return loadFoodRuleDashboardState(response?.answers || buildPhase70QualifiedClientAnswers());
}

export function saveClientFoodRulesInState(
  state: ManuAppState,
  clientId: string,
  foodRuleState: FoodRuleDashboardState,
  createdAt = new Date().toISOString(),
) {
  const schema = getActiveFormSchema(state);
  if (!schema) throw new AppDomainError(404, "published_form_schema_not_found");

  const existing = state.clientFormResponses.find(
    (item) => item.clientId === clientId && item.schemaId === schema.id,
  );
  const mergedAnswers = mergeFoodRuleDashboardIntoAnswers(existing?.answers, foodRuleState);
  const nextState = saveClientFormResponseInState(state, clientId, schema.id, mergedAnswers, createdAt);

  return {
    ...nextState,
    auditEvents: [
      ...nextState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_food_rules_updated",
        entityType: "client",
        entityId: clientId,
        metadata: {
          source: "food_rules_dashboard",
          dashboardVersion: PHASE_76J_FOOD_RULE_DASHBOARD_VERSION,
          populatedFieldCount: Object.keys(buildFoodRuleAnswersFromDashboardState(foodRuleState)).length,
        },
        createdAt,
      },
    ],
  };
}

export const FOOD_RULE_DASHBOARD_GROUP_OPTIONS = [...PHASE_76D_FOOD_GROUP_OPTIONS];
export const FOOD_RULE_DASHBOARD_DIET_TYPE_OPTIONS = [...PHASE_76D_DIET_TYPE_OPTIONS];
export const FOOD_RULE_DASHBOARD_SKIP_TOLERANCE_OPTIONS = [...PHASE_76D_SKIP_TOLERANCE_OPTIONS];
export const FOOD_RULE_DASHBOARD_INGREDIENT_KEYWORD_OPTIONS = [...PHASE_76D_INGREDIENT_KEYWORD_OPTIONS];
export const FOOD_RULE_DASHBOARD_PRODUCT_LABEL_REVIEW_OPTIONS = [...PHASE_76D_PRODUCT_LABEL_REVIEW_OPTIONS];
export const FOOD_RULE_DASHBOARD_UNCERTAINTY_POLICY_OPTIONS = [...PHASE_76D_UNCERTAINTY_POLICY_OPTIONS];
