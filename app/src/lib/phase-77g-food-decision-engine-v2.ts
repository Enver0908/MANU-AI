import {
  evaluateProductIngredientVerification,
  evaluateFoodRuleDecision,
  type FoodRuleDecision,
  type FoodRuleDecisionValue,
  type ProductIngredientVerificationResult,
  type RiskLevel,
} from "dietitian-ai-assistant-architecture";
import { getLatestClientFormAnswers } from "./food-rule-runtime";
import type { ProductIngredientEvidenceInput } from "./food-rule-runtime";
import { buildStructuredFoodRulesFromClientState } from "./food-rule-runtime";
import {
  findPhase77DFoodsByName,
  getPhase77DFoodById,
} from "./phase-77d-master-food-catalog";
import {
  getClientFoodRuleProfileV2Record,
  resolveClientFoodRuleProfileFlexibility,
  searchPhase77DCatalogFoods,
} from "./phase-77e-client-food-rule-profile";
import { getActiveClientMenuPlanV1Record } from "./phase-77f-client-menu-plan";
import type {
  ClientFoodRuleProfileV2Record,
  ClientMenuPlanV1Record,
  ManuAppState,
  Phase77EFlexibilityLevel,
} from "./types";

export const PHASE_77G_FOOD_DECISION_ENGINE_V2_VERSION = "phase-77g-food-decision-engine-v2";

export const FOOD_DECISION_V2_DECISIONS = [
  "allow",
  "discourage",
  "forbid",
  "needs_label",
  "needs_review",
  "not_applicable",
] as const;

export type FoodDecisionV2Decision = (typeof FOOD_DECISION_V2_DECISIONS)[number];

export type FoodDecisionV2CatalogMatch = {
  foodId: string;
  foodName: string;
  confidence: "exact" | "partial" | "keyword";
  path: string;
};

export type FoodDecisionV2Input = {
  message: string;
  riskLevel: RiskLevel;
  mixedIntentBlocked?: boolean;
  personalForm?: {
    goalType?: string;
    goalKey?: string | null;
  };
  foodProfile: ClientFoodRuleProfileV2Record | null;
  activeMenu: ClientMenuPlanV1Record | null;
  productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  legacyStructuredFoodRules?: ReturnType<typeof buildStructuredFoodRulesFromClientState>;
};

export type FoodDecisionV2Result = {
  version: string;
  decision: FoodDecisionV2Decision;
  reasonCodes: string[];
  queryType: string | null;
  catalogMatches: FoodDecisionV2CatalogMatch[];
  menuOnPlan: boolean | null;
  effectiveFlexibility: Phase77EFlexibilityLevel | null;
  evidenceManifest: Record<string, unknown>;
  sourceReferences: string[];
  providerEligible: boolean;
  legacyFoodRuleDecision: string;
};

const MIXED_INTENT_PATTERN =
  /\b(?:ilac\w*|insulin\w*|metformin|takviye|supplement|medication|dose|doz|tahlil|lab|kan sonucu|belirti|symptom|hamile|pregnan|nefes|gogus|acil|emergency|kalori hedef|makro hedef|porsiyon.*artir|portion.*increase|plan.*degistir)\b/i;

const CLINICAL_ESCALATION_PATTERN =
  /\b(?:hamile|gebe|emzir|cocuk|ergen|diyabet|diabetes|kus|purge|intihar|nefes|gogus|acil|emergency)\b/i;

const PRODUCT_QUERY_PATTERN =
  /\b(?:icerik\w*|ingredient\w*|etiket\w*|label|icinde\w*|içinde\w*|cikolata|chocolate|biskuvi|bisküvi|gofret)\b/i;

const MEAL_KEY_PATTERNS: Array<{ mealKey: string; pattern: RegExp }> = [
  { mealKey: "kahvalti", pattern: /\b(?:kahvalti|breakfast)\b/i },
  { mealKey: "ogle", pattern: /\b(?:ogle|öğle|lunch)\b/i },
  { mealKey: "aksam", pattern: /\b(?:aksam|akşam|dinner)\b/i },
  { mealKey: "ara_ogun", pattern: /\b(?:ara ogun|snack|atistirmalik)\b/i },
];

const GOAL_TYPE_TO_KEY: Record<string, string> = {
  "kilo verme": "kilo_verme",
  "kilo alma": "kilo_alma",
  koruma: "koruma",
  klinik: "klinik",
  performans: "performans",
};

const FOOD_GROUP_KEYWORDS: Record<string, string[]> = {
  "Sut urunleri": ["sut", "milk", "peynir", "cheese", "yogurt", "lor", "labne", "whey", "casein", "laktoz", "dairy"],
  Gluten: ["gluten", "bugday", "ekmek", "bread", "pasta", "un"],
  "Kabuklu yemis": ["findik", "badem", "ceviz", "fistik", "peanut", "hazelnut", "walnut", "almond", "nut"],
  "Kirmizi et": ["et", "kirmizi et", "beef", "red meat", "kuzu", "hamburger"],
  "Islenmis seker": ["seker", "cikolata", "chocolate", "candy", "sugar", "gofret"],
  Yumurta: ["yumurta", "egg"],
  Balik: ["balik", "fish", "somon", "salmon"],
  Soya: ["soya", "soy"],
  Laktoz: ["laktoz", "lactose"],
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00e7/g, "c")
    .trim();
}

function buildResult(
  decision: FoodDecisionV2Decision,
  reasonCodes: string[],
  patch: Partial<FoodDecisionV2Result> = {},
): FoodDecisionV2Result {
  return {
    version: PHASE_77G_FOOD_DECISION_ENGINE_V2_VERSION,
    decision,
    reasonCodes,
    queryType: patch.queryType ?? null,
    catalogMatches: patch.catalogMatches ?? [],
    menuOnPlan: patch.menuOnPlan ?? null,
    effectiveFlexibility: patch.effectiveFlexibility ?? null,
    evidenceManifest: patch.evidenceManifest ?? {},
    sourceReferences: patch.sourceReferences ?? [],
    providerEligible:
      patch.providerEligible ?? (decision !== "needs_review" && decision !== "not_applicable"),
    legacyFoodRuleDecision: patch.legacyFoodRuleDecision ?? mapFoodDecisionV2ToLegacyFoodRule(decision, patch.queryType ?? null),
  };
}

const LEGACY_FALLBACK_REASON_CODES = new Set([
  "food_decision_v2_catalog_match_missing",
  "food_decision_v2_food_target_missing",
  "food_decision_v2_query_not_detected",
  "food_decision_v2_profile_missing",
  "food_decision_v2_empty_message",
  "food_decision_v2_non_green_risk",
]);

export function shouldUseFoodDecisionV2Result(result: FoodDecisionV2Result) {
  if (result.decision === "not_applicable") return false;
  if (result.decision === "needs_review") {
    return result.reasonCodes.some((code) => !LEGACY_FALLBACK_REASON_CODES.has(code));
  }
  if (result.decision === "allow" || result.decision === "discourage") {
    return result.catalogMatches.some((match) => match.confidence === "exact") || result.menuOnPlan === true;
  }
  return true;
}

export function mapFoodDecisionV2ToLegacyFoodRule(
  decision: FoodDecisionV2Decision,
  queryType: string | null,
): string {
  switch (decision) {
    case "allow":
      return queryType === "food_substitution" ? "equivalent_substitution_allowed" : "allowed_food_confirmation";
    case "discourage":
      return "equivalent_substitution_allowed";
    case "forbid":
      return "forbidden_food_rejection";
    case "needs_label":
      return "product_ingredient_unknown";
    case "needs_review":
      return "unknown_food_requires_review";
    default:
      return "not_applicable";
  }
}

function detectMealKey(message: string) {
  const normalized = normalizeText(message);
  return MEAL_KEY_PATTERNS.find((item) => item.pattern.test(normalized))?.mealKey || null;
}

function mapGoalTypeToKey(goalType?: string) {
  if (!goalType) return null;
  return GOAL_TYPE_TO_KEY[normalizeText(goalType)] || null;
}

function detectQueryType(message: string) {
  const normalized = normalizeText(message);
  if (PRODUCT_QUERY_PATTERN.test(normalized)) return "product_ingredient";
  if (
    /\b(?:atlayabilir|atlamak|skip|atla)\b/i.test(normalized) &&
    /\b(?:ogun\w*|meal|kahvalti|ogle|aksam|snack|ara|breakfast|lunch|dinner)\b/i.test(normalized)
  ) {
    return "meal_skip";
  }
  if (/\b(?:yerine|instead of|alternatif|swap|degistir)\b/i.test(normalized)) return "food_substitution";
  if (/\b(?:yiyebilir|yerim|can i eat|eat)\b/i.test(normalized)) return "food_permission";
  return null;
}

function cleanFoodPhrase(value: string) {
  return value
    .replace(/\b(?:bir|one|tane|bugun|bugün|simdi|şimdi|kahvaltida|kahvaltıda|ogle|öğle|aksam|akşam)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFoodTarget(message: string) {
  const normalized = normalizeText(message);
  const substitution =
    normalized.match(/(.+?)\s+(?:yerine|instead of|swap for|degistir(?:ebilir)?)\s+(.+?)(?:\?|$)/i) ||
    normalized.match(/(?:yerine|instead of|swap for)\s+(.+?)\s+(?:kullan|yiyebilir|olur mu)\s+(.+?)(?:\?|$)/i);
  if (substitution) {
    return cleanFoodPhrase(substitution[2] || substitution[1]);
  }

  const patterns = [
    /^(?:can i eat|eat)\s+(.+?)(?:\?|$)/i,
    /^(.+?)\s+(?:yiyebilir miyim|yerim mi|yiyebilir mi|yiyebilir miyiz)(?:\?|$)/i,
    /(?:yiyebilir miyim|yerim mi|can i eat)\s+(.+?)(?:\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return cleanFoodPhrase(match[1]);
  }
  return "";
}

function inferFoodGroups(phrase: string) {
  const normalized = normalizeText(phrase);
  return Object.entries(FOOD_GROUP_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
    .map(([group]) => group);
}

export function matchCatalogFoodCandidates(phrase: string): FoodDecisionV2CatalogMatch[] {
  const cleaned = cleanFoodPhrase(phrase);
  if (!cleaned) return [];

  const exactMatches = findPhase77DFoodsByName(cleaned);
  if (exactMatches.length > 0) {
    return exactMatches.map((match) => ({
      foodId: match.food.id,
      foodName: match.food.name,
      confidence: "exact" as const,
      path: `${match.main.name} / ${match.subcategory.name}`,
    }));
  }

  const partialMatches = searchPhase77DCatalogFoods(cleaned, 12).map((match) => ({
    foodId: match.id,
    foodName: match.name,
    confidence: "partial" as const,
    path: match.path,
  }));
  if (partialMatches.length === 1) return partialMatches;

  const keywordMatches = searchPhase77DCatalogFoods(cleaned.split(/\s+/)[0] || cleaned, 3).map((match) => ({
    foodId: match.id,
    foodName: match.name,
    confidence: "keyword" as const,
    path: match.path,
  }));
  return partialMatches.length > 0 ? partialMatches : keywordMatches;
}

function isFoodOnActiveMenu(
  catalogMatches: FoodDecisionV2CatalogMatch[],
  menu: ClientMenuPlanV1Record | null,
) {
  if (!menu) return null;
  const candidateIds = new Set(catalogMatches.map((match) => match.foodId));
  const candidateNames = catalogMatches.map((match) => normalizeText(match.foodName));

  for (const slot of menu.mealSlots) {
    for (const item of [...slot.items, ...slot.alternatives]) {
      if (item.catalogFoodIds.some((foodId) => candidateIds.has(foodId))) return true;
      if (item.catalogMatch?.catalogFoodId && candidateIds.has(item.catalogMatch.catalogFoodId)) return true;
      const text = normalizeText(item.freeText || item.catalogMatch?.catalogFoodName || item.label);
      if (
        text &&
        candidateNames.some(
          (name) => text.includes(name) || name.includes(text) || text.split(/\s+/).some((token) => name.includes(token)),
        )
      ) {
        return true;
      }
    }
  }

  return menu.preferredFoods.some((item) => {
    const preferred = normalizeText(item);
    return candidateNames.some((name) => preferred.includes(name) || name.includes(preferred));
  });
}

function isForbiddenByProfile(
  profile: ClientFoodRuleProfileV2Record,
  foodId: string,
  foodName: string,
  foodGroups: string[],
) {
  if (profile.forbiddenCatalogFoodIds.includes(foodId)) {
    return { forbidden: true, reason: "forbidden_catalog_food" };
  }
  const located = getPhase77DFoodById(foodId);
  if (located) {
    if (profile.forbiddenCatalogMainCategoryIds.includes(located.main.id)) {
      return { forbidden: true, reason: "forbidden_main_category" };
    }
    if (profile.forbiddenCatalogSubCategoryIds.includes(located.subcategory.id)) {
      return { forbidden: true, reason: "forbidden_sub_category" };
    }
  }
  const normalizedName = normalizeText(foodName);
  for (const forbidden of profile.freeTextForbiddenFoods) {
    if (normalizedName.includes(normalizeText(forbidden))) {
      return { forbidden: true, reason: "forbidden_free_text" };
    }
  }
  for (const keyword of profile.forbiddenIngredientKeywords) {
    if (normalizedName.includes(normalizeText(keyword))) {
      return { forbidden: true, reason: "forbidden_ingredient_keyword" };
    }
  }
  for (const group of foodGroups) {
    if (profile.forbiddenFoodGroups.includes(group)) {
      return { forbidden: true, reason: "forbidden_food_group" };
    }
  }
  for (const dietType of profile.dietTypeRestrictions) {
    const conflictGroups =
      dietType === "Vegan"
        ? ["Sut urunleri", "Yumurta", "Balik", "Kirmizi et"]
        : dietType === "Vejetaryen"
          ? ["Balik", "Kirmizi et"]
          : dietType === "Glutensiz"
            ? ["Gluten"]
            : [];
    if (foodGroups.some((group) => conflictGroups.includes(group))) {
      return { forbidden: true, reason: "diet_type_conflict" };
    }
  }
  return { forbidden: false, reason: null };
}

function resolveFlexibility(
  profile: ClientFoodRuleProfileV2Record,
  options: { mealKey: string | null; goalKey: string | null; foodGroups: string[] },
) {
  const groupFlex = options.foodGroups
    .map((group) => profile.flexibilityByFoodGroup[group])
    .filter(Boolean);
  return resolveClientFoodRuleProfileFlexibility(
    [
      options.mealKey ? profile.flexibilityByMeal[options.mealKey] : null,
      options.goalKey ? profile.flexibilityByGoal[options.goalKey] : null,
      ...groupFlex,
      profile.flexibilityGlobal,
    ],
    profile.flexibilityGlobal,
  );
}

function evaluateOffMenuDecision(
  flexibility: Phase77EFlexibilityLevel,
  goalKey: string | null,
  foodGroups: string[],
) {
  if (flexibility === "flexible") {
    return buildResult("allow", ["food_decision_v2_off_menu_flexible"]);
  }
  if (flexibility === "moderate") {
    return buildResult("discourage", ["food_decision_v2_off_menu_moderate"]);
  }
  if (goalKey === "kilo_verme" && foodGroups.includes("Islenmis seker")) {
    return buildResult("discourage", ["food_decision_v2_weight_loss_treat"]);
  }
  return buildResult("discourage", ["food_decision_v2_off_menu_restricted"]);
}

function evaluateProductPath(
  input: FoodDecisionV2Input,
  profile: ClientFoodRuleProfileV2Record,
  queryType: string,
) {
  const evidence = input.productIngredientEvidence;
  if (!evidence?.ingredientText?.trim()) {
    return buildResult("needs_label", ["food_decision_v2_product_label_required"], {
      queryType,
      sourceReferences: ["food_profile_v2", "product_ingredient_verification"],
      evidenceManifest: { ingredientTextPresent: false },
    });
  }

  const verification = evaluateProductIngredientVerification({
    ingredientText: evidence.ingredientText,
    ingredientSourceType: evidence.ingredientSourceType,
    ingredientConfidence: evidence.ingredientConfidence,
    ingredientAllergenKeywords: profile.forbiddenIngredientKeywords,
    forbiddenFoodItems: profile.freeTextForbiddenFoods,
    forbiddenFoodGroups: profile.forbiddenFoodGroups,
    dietTypeRules: profile.dietTypeRestrictions[0] || null,
  });

  if (verification.decision === "requires_review") {
    return buildResult("needs_review", verification.reasons, {
      queryType,
      evidenceManifest: { verification },
      sourceReferences: ["food_profile_v2", "product_ingredient_verification"],
    });
  }
  if (verification.decision === "product_blocked") {
    return buildResult("forbid", verification.reasons, {
      queryType,
      evidenceManifest: { verification },
      sourceReferences: ["food_profile_v2", "product_ingredient_verification"],
    });
  }
  return buildResult("allow", verification.reasons, {
    queryType,
    evidenceManifest: { verification },
    sourceReferences: ["food_profile_v2", "product_ingredient_verification"],
  });
}

function enrichFoodDecisionV2PromptEvidence(
  result: FoodDecisionV2Result,
  input: FoodDecisionV2Input,
): FoodDecisionV2Result {
  const profile = input.foodProfile;
  const menu = input.activeMenu;
  const evidence: Record<string, unknown> = { ...result.evidenceManifest };

  if (profile) {
    evidence.profileSummary = {
      forbiddenFoodCount:
        profile.forbiddenCatalogFoodIds.length +
        profile.forbiddenCatalogSubCategoryIds.length +
        profile.forbiddenCatalogMainCategoryIds.length +
        profile.freeTextForbiddenFoods.length,
      forbiddenGroupCount: profile.forbiddenFoodGroups.length,
      allowedFoodCount:
        profile.allowedCatalogFoodIds.length +
        profile.allowedCatalogSubCategoryIds.length +
        profile.allowedCatalogMainCategoryIds.length +
        profile.freeTextAllowedFoods.length,
      dietType: profile.dietTypeRestrictions[0] || null,
    };
  }

  if (menu) {
    evidence.menuSummary = {
      templateType: menu.templateType,
      status: menu.status,
      mealSlotCount: menu.mealSlots.length,
    };
  }

  if (input.personalForm?.goalKey && evidence.goalKey == null) {
    evidence.goalKey = input.personalForm.goalKey;
  }

  return { ...result, evidenceManifest: evidence };
}

export function evaluateFoodDecisionEngineV2(input: FoodDecisionV2Input): FoodDecisionV2Result {
  const message = String(input.message || "").trim();
  if (!message) {
    return buildResult("not_applicable", ["food_decision_v2_empty_message"]);
  }

  if (input.riskLevel !== "green") {
    return buildResult("not_applicable", ["food_decision_v2_non_green_risk"]);
  }

  if (input.mixedIntentBlocked || MIXED_INTENT_PATTERN.test(normalizeText(message))) {
    return buildResult("needs_review", ["food_decision_v2_mixed_intent"], {
      queryType: "mixed",
      sourceReferences: input.foodProfile ? ["food_profile_v2"] : [],
    });
  }

  if (CLINICAL_ESCALATION_PATTERN.test(normalizeText(message))) {
    return buildResult("needs_review", ["food_decision_v2_clinical_context"], {
      queryType: "clinical",
      sourceReferences: input.foodProfile ? ["food_profile_v2"] : [],
    });
  }

  const queryType = detectQueryType(message);
  if (!queryType) {
    return buildResult("not_applicable", ["food_decision_v2_query_not_detected"]);
  }

  if (!input.foodProfile) {
    if (input.legacyStructuredFoodRules) {
      const legacy = evaluateFoodRuleDecision({
        message,
        structuredFoodRules: input.legacyStructuredFoodRules,
        mixedIntentBlocked: false,
        productIngredientEvidence: input.productIngredientEvidence || null,
      });
      return buildResult(mapLegacyDecisionToV2(legacy.decision), legacy.reasons, {
        queryType: legacy.queryType,
        legacyFoodRuleDecision: legacy.decision,
        evidenceManifest: { legacyBridge: true },
        sourceReferences: ["structured_food_rules_v1"],
      });
    }
    return buildResult("not_applicable", ["food_decision_v2_profile_missing"]);
  }

  const profile = input.foodProfile;
  if (queryType === "product_ingredient") {
    return evaluateProductPath(input, profile, queryType);
  }

  if (queryType === "meal_skip") {
    return buildResult("needs_review", ["food_decision_v2_meal_skip_deferred"], { queryType });
  }

  if (queryType === "food_substitution" && input.legacyStructuredFoodRules) {
    const legacy = evaluateFoodRuleDecision({
      message,
      structuredFoodRules: input.legacyStructuredFoodRules,
      mixedIntentBlocked: false,
      productIngredientEvidence: input.productIngredientEvidence || null,
    });
    if (legacy.decision !== "not_applicable" && legacy.decision !== "unknown_food_requires_review") {
      return buildResult(mapLegacyDecisionToV2(legacy.decision), legacy.reasons, {
        queryType,
        legacyFoodRuleDecision: legacy.decision,
        evidenceManifest: { legacyBridge: true, exchangeGroupId: legacy.exchangeGroupId ?? null },
        sourceReferences: ["structured_food_rules_v1", "food_profile_v2"],
      });
    }
  }

  const foodPhrase = extractFoodTarget(message);
  if (!foodPhrase) {
    return buildResult("needs_review", ["food_decision_v2_food_target_missing"], { queryType });
  }

  const phraseGroups = inferFoodGroups(foodPhrase);
  for (const group of phraseGroups) {
    if (profile.forbiddenFoodGroups.includes(group)) {
      return buildResult("forbid", ["food_decision_v2_forbidden_food_group"], {
        queryType,
        sourceReferences: ["food_profile_v2"],
        evidenceManifest: { foodPhrase, foodGroups: phraseGroups },
      });
    }
  }
  for (const forbidden of profile.freeTextForbiddenFoods) {
    if (normalizeText(foodPhrase).includes(normalizeText(forbidden))) {
      return buildResult("forbid", ["food_decision_v2_forbidden_free_text"], {
        queryType,
        sourceReferences: ["food_profile_v2"],
        evidenceManifest: { foodPhrase },
      });
    }
  }

  const catalogMatches = matchCatalogFoodCandidates(foodPhrase);
  if (catalogMatches.length === 0) {
    return buildResult("needs_review", ["food_decision_v2_catalog_match_missing"], {
      queryType,
      catalogMatches,
      sourceReferences: ["master_food_catalog"],
    });
  }
  if (catalogMatches.filter((match) => match.confidence === "exact").length > 1) {
    return buildResult("needs_review", ["food_decision_v2_catalog_match_ambiguous"], {
      queryType,
      catalogMatches,
      sourceReferences: ["master_food_catalog"],
    });
  }

  const primary = catalogMatches.find((match) => match.confidence === "exact") || catalogMatches[0];
  const foodGroups = inferFoodGroups(`${foodPhrase} ${primary.foodName}`);
  const forbidden = isForbiddenByProfile(profile, primary.foodId, primary.foodName, foodGroups);
  if (forbidden.forbidden) {
    return buildResult("forbid", [`food_decision_v2_${forbidden.reason}`], {
      queryType,
      catalogMatches: [primary],
      sourceReferences: ["food_profile_v2", "master_food_catalog"],
      evidenceManifest: { foodId: primary.foodId, foodName: primary.foodName },
    });
  }

  const mealKey = detectMealKey(message);
  const goalKey = input.personalForm?.goalKey || null;
  const flexibility = resolveFlexibility(profile, { mealKey, goalKey, foodGroups });
  const menuOnPlan = isFoodOnActiveMenu(catalogMatches, input.activeMenu);
  const sourceReferences = ["food_profile_v2", "master_food_catalog"];
  if (input.activeMenu) sourceReferences.push("menu_plan_v1");

  if (menuOnPlan === true) {
    return buildResult("allow", ["food_decision_v2_on_menu"], {
      queryType,
      catalogMatches: [primary],
      menuOnPlan,
      effectiveFlexibility: flexibility,
      sourceReferences,
      evidenceManifest: { foodId: primary.foodId, mealKey, goalKey },
    });
  }

  const offMenu = evaluateOffMenuDecision(flexibility, goalKey, foodGroups);
  return {
    ...offMenu,
    queryType,
    catalogMatches: [primary],
    menuOnPlan,
    effectiveFlexibility: flexibility,
    sourceReferences,
    evidenceManifest: { foodId: primary.foodId, mealKey, goalKey, flexibility },
  };
}

function mapLegacyDecisionToV2(decision: string): FoodDecisionV2Decision {
  switch (decision) {
    case "allowed_food_confirmation":
    case "equivalent_substitution_allowed":
    case "diet_type_compatible":
    case "optional_skip_allowed":
      return "allow";
    case "forbidden_food_rejection":
    case "diet_type_conflict":
    case "mandatory_skip_blocked":
    case "product_ingredient_conflict":
      return "forbid";
    case "product_ingredient_unknown":
      return "needs_label";
    case "unknown_food_requires_review":
    case "mixed_intent_blocked":
      return "needs_review";
    default:
      return "not_applicable";
  }
}

export function buildFoodDecisionV2InputFromState(
  state: ManuAppState,
  clientId: string,
  message: string,
  options: {
    riskLevel?: RiskLevel;
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  } = {},
): FoodDecisionV2Input {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client || client.lifecycleStatus === "removed_anonymized") {
    return {
      message,
      riskLevel: options.riskLevel || "green",
      mixedIntentBlocked: options.mixedIntentBlocked,
      personalForm: undefined,
      foodProfile: null,
      activeMenu: null,
      productIngredientEvidence: options.productIngredientEvidence || null,
      legacyStructuredFoodRules: null,
    };
  }

  const answers = getLatestClientFormAnswers(state, clientId);
  const goalType = typeof answers?.goal_type === "string" ? answers.goal_type : undefined;
  return {
    message,
    riskLevel: options.riskLevel || "green",
    mixedIntentBlocked: options.mixedIntentBlocked,
    personalForm: {
      goalType,
      goalKey: mapGoalTypeToKey(goalType),
    },
    foodProfile: getClientFoodRuleProfileV2Record(state, clientId),
    activeMenu: getActiveClientMenuPlanV1Record(state, clientId),
    productIngredientEvidence: options.productIngredientEvidence || null,
    legacyStructuredFoodRules: buildStructuredFoodRulesFromClientState(state, clientId),
  };
}

export function evaluateClientFoodDecisionV2(
  state: ManuAppState,
  clientId: string,
  message: string,
  options: {
    riskLevel?: RiskLevel;
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  } = {},
) {
  const input = buildFoodDecisionV2InputFromState(state, clientId, message, options);
  return enrichFoodDecisionV2PromptEvidence(evaluateFoodDecisionEngineV2(input), input);
}

export function foodDecisionV2ToLegacyFoodRuleResult(result: FoodDecisionV2Result): FoodRuleDecision {
  let decision = result.legacyFoodRuleDecision as FoodRuleDecisionValue;
  if (result.queryType === "product_ingredient" && result.decision === "forbid") {
    decision = "product_ingredient_conflict";
  }
  if (result.queryType === "product_ingredient" && result.decision === "needs_label") {
    decision = "product_ingredient_unknown";
  }
  const verification = result.evidenceManifest.verification as ProductIngredientVerificationResult | undefined;
  const blockedDecisions = new Set([
    "unknown_food_requires_review",
    "product_ingredient_unknown",
    "mixed_intent_blocked",
    "not_applicable",
  ]);
  return {
    version: result.version,
    decision,
    allowed: !blockedDecisions.has(decision),
    reasons: result.reasonCodes,
    queryType: result.queryType,
    ...(verification ? { verification } : {}),
  };
}
