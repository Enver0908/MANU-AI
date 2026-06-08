import { APPROVED_SOURCE_ANSWERABILITY_VERSION } from "./approved-source-answerability.js";

export const INTENT_SPECIFIC_ANSWERABILITY_VERSION = "intent-specific-answerability-v0.1.0";

const SEGMENT_SOURCE_RULES = {
  diet_plan_summary: "active_diet_plan",
  client_form_summary: "prompt_allowed_form_response",
  dietitian_context_update: "dietitian_context_update",
  pinned_note: "pinned_note",
  allergies: "allergies_restricted_foods",
  restricted_foods: "allergies_restricted_foods",
};

const sensitiveAnswerabilityPattern =
  /\b(?:ilac\w*|insulin\w*|metformin|antibiyotik|takviye|supplement|medication|medicine|lab|tahlil|kan sonucu|symptom|belirti|hamile|pregnan|minor|cocuk|ergen|kus|purge|bayil|nefes|gogus|acil|emergency)\b/i;

const INTENT_SOURCE_REQUIREMENTS = {
  green_forbidden_food_reminder: {
    sourceCategories: [
      "structured_forbidden_food",
      "allergies_restricted_foods",
      "structured_diet_type_rules",
    ],
    foodDecisions: ["forbidden_food_rejection", "diet_type_conflict"],
  },
  green_allowed_food_confirmation: {
    sourceCategories: ["structured_allowed_food", "structured_diet_type_rules"],
    foodDecisions: ["allowed_food_confirmation", "diet_type_compatible"],
  },
  green_allowed_substitution: {
    sourceCategories: [
      "structured_equivalent_exchange_groups",
      "structured_allowed_substitutions",
      "active_diet_plan",
      "dietitian_manual_message",
    ],
    foodDecisions: ["equivalent_substitution_allowed"],
    allowPlanFallbackWithoutEngine: true,
  },
  green_plan_lookup: {
    sourceCategories: [
      "active_diet_plan",
      "pinned_note",
      "prompt_allowed_form_response",
      "dietitian_manual_message",
    ],
  },
  green_optional_meal_skip: {
    sourceCategories: ["structured_skip_rules"],
    foodDecisions: ["optional_skip_allowed"],
  },
  green_product_ingredient_check: {
    sourceCategories: ["structured_ingredient_keywords", "trusted_product_evidence"],
    foodDecisions: ["product_ingredient_conflict", "allowed_food_confirmation"],
  },
  green_general_education: {
    sourceCategories: ["approved_official_corpus", "dietitian_manual_message"],
  },
  green_meal_reminder: {
    sourceCategories: ["active_diet_plan", "pinned_note", "dietitian_manual_message", "prompt_allowed_form_response"],
  },
  green_logistics: {
    sourceCategories: ["prompt_allowed_form_response", "dietitian_manual_message", "dietitian_context_update"],
  },
  green_behavior_support: {
    sourceCategories: ["prompt_allowed_form_response", "pinned_note", "dietitian_manual_message"],
  },
  green_progress_logging: {
    sourceCategories: ["active_diet_plan", "prompt_allowed_form_response", "dietitian_manual_message"],
  },
  green_context_recap: {
    sourceCategories: ["prompt_allowed_form_response", "dietitian_context_update", "dietitian_manual_message"],
  },
  green_low_risk_clarification: {
    sourceCategories: [
      "active_diet_plan",
      "prompt_allowed_form_response",
      "pinned_note",
      "dietitian_manual_message",
      "dietitian_context_update",
      "allergies_restricted_foods",
    ],
  },
};

const FOOD_REVIEW_DECISIONS = new Set([
  "unknown_food_requires_review",
  "product_ingredient_unknown",
  "mixed_intent_blocked",
  "mandatory_skip_blocked",
]);

export function evaluateAnswerabilityPrelude({ promptContext, riskDecision }) {
  if (riskDecision?.level !== "green") {
    return buildDecision("source_backed_green", ["non_green_risk_not_answerability_gated"], []);
  }

  if (!promptContext || !Array.isArray(promptContext.segments)) {
    return buildDecision("handoff_required", ["prompt_context_missing"], []);
  }

  const currentMessage = currentMessageText(promptContext);
  if (sensitiveAnswerabilityPattern.test(normalize(currentMessage))) {
    return buildDecision("handoff_required", ["mixed_or_sensitive_answerability_marker"], []);
  }

  const sources = approvedSourcesFromPrompt(promptContext);
  if (sources.length === 0) {
    return buildDecision("handoff_required", ["approved_source_missing"], []);
  }

  return buildDecision("source_backed_green", ["answerability_prelude_passed"], sources);
}

export function evaluateIntentSpecificAnswerability({
  promptContext,
  riskDecision,
  greenIntent,
  foodRule,
  structuredFoodRules,
  productIngredientEvidence,
}) {
  const prelude = evaluateAnswerabilityPrelude({ promptContext, riskDecision });
  if (!prelude.allowed) {
    return {
      ...prelude,
      version: INTENT_SPECIFIC_ANSWERABILITY_VERSION,
      baseVersion: APPROVED_SOURCE_ANSWERABILITY_VERSION,
      intentFamily: greenIntent?.intentFamily || null,
      foodRuleDecision: foodRule?.decision || null,
    };
  }

  if (riskDecision?.level !== "green") {
    return {
      ...prelude,
      version: INTENT_SPECIFIC_ANSWERABILITY_VERSION,
      baseVersion: APPROVED_SOURCE_ANSWERABILITY_VERSION,
      intentFamily: greenIntent?.intentFamily || null,
      foodRuleDecision: foodRule?.decision || null,
    };
  }

  if (greenIntent && greenIntent.allowed === false) {
    return buildDecision("handoff_required", [...(greenIntent.reasons || []), "green_intent_blocked"], [], {
      intentFamily: greenIntent.intentFamily,
      foodRuleDecision: foodRule?.decision || null,
    });
  }

  const promptSources = approvedSourcesFromPrompt(promptContext);
  const structuredSources = buildStructuredSourceCategories(structuredFoodRules, productIngredientEvidence);
  const sources = dedupeSources([...promptSources, ...structuredSources]);
  const sourceCategories = Array.from(new Set(sources.map((source) => source.category)));
  const effectiveIntentFamily = resolveEffectiveIntentFamily(greenIntent, foodRule);
  const requirements = INTENT_SOURCE_REQUIREMENTS[effectiveIntentFamily];

  if (!requirements) {
    return buildDecision("handoff_required", ["intent_specific_requirements_missing", effectiveIntentFamily], sources, {
      intentFamily: effectiveIntentFamily,
      foodRuleDecision: foodRule?.decision || null,
    });
  }

  const matchedCategories = requirements.sourceCategories.filter((category) => sourceCategories.includes(category));
  if (matchedCategories.length === 0) {
    return buildDecision(
      "handoff_required",
      ["intent_specific_source_missing", effectiveIntentFamily, ...requirements.sourceCategories],
      sources,
      {
        intentFamily: effectiveIntentFamily,
        foodRuleDecision: foodRule?.decision || null,
        requiredSourceCategories: requirements.sourceCategories,
      },
    );
  }

  if (canUseSubstitutionLegacyFallback(effectiveIntentFamily, requirements, foodRule, matchedCategories)) {
    return buildDecision(
      "source_backed_green",
      ["intent_specific_substitution_legacy_fallback", effectiveIntentFamily, ...matchedCategories],
      sources,
      {
        intentFamily: effectiveIntentFamily,
        foodRuleDecision: foodRule?.decision || null,
        matchedSourceCategories: matchedCategories,
      },
    );
  }

  if (foodRule && FOOD_REVIEW_DECISIONS.has(foodRule.decision)) {
    return buildDecision("handoff_required", ["food_rule_requires_review", foodRule.decision], sources, {
      intentFamily: effectiveIntentFamily,
      foodRuleDecision: foodRule.decision,
    });
  }

  if (requirements.foodDecisions?.length) {
    const foodDecision = foodRule?.decision || null;
    if (!foodDecision || foodDecision === "not_applicable") {
      if (
        requirements.allowPlanFallbackWithoutEngine &&
        (matchedCategories.includes("active_diet_plan") || matchedCategories.includes("dietitian_manual_message"))
      ) {
        return buildDecision(
          "source_backed_green",
          ["intent_specific_legacy_source_fallback_without_food_engine", effectiveIntentFamily],
          sources,
          {
            intentFamily: effectiveIntentFamily,
            foodRuleDecision: null,
            matchedSourceCategories: matchedCategories,
          },
        );
      }
      return buildDecision("handoff_required", ["intent_specific_food_rule_missing", effectiveIntentFamily], sources, {
        intentFamily: effectiveIntentFamily,
        foodRuleDecision: foodDecision,
        requiredSourceCategories: requirements.sourceCategories,
      });
    }

    if (!requirements.foodDecisions.includes(foodDecision)) {
      return buildDecision(
        "handoff_required",
        ["intent_specific_food_rule_mismatch", effectiveIntentFamily, foodDecision],
        sources,
        {
          intentFamily: effectiveIntentFamily,
          foodRuleDecision: foodDecision,
          requiredFoodDecisions: requirements.foodDecisions,
        },
      );
    }
  }

  if (effectiveIntentFamily === "green_general_education" && !matchedCategories.includes("approved_official_corpus")) {
    return buildDecision("handoff_required", ["intent_specific_official_corpus_missing"], sources, {
      intentFamily: effectiveIntentFamily,
      foodRuleDecision: foodRule?.decision || null,
    });
  }

  return buildDecision(
    "source_backed_green",
    ["intent_specific_source_backed_green", effectiveIntentFamily, ...matchedCategories],
    sources,
    {
      intentFamily: effectiveIntentFamily,
      foodRuleDecision: foodRule?.decision || null,
      matchedSourceCategories: matchedCategories,
    },
  );
}

export function resolveEffectiveIntentFamily(greenIntent, foodRule) {
  const foodIntent = resolveFoodIntentFamily(foodRule);
  if (foodIntent) return foodIntent;
  return greenIntent?.intentFamily || "green_low_risk_clarification";
}

export function resolveFoodIntentFamily(foodRule) {
  if (!foodRule || foodRule.decision === "not_applicable") return null;

  if (foodRule.queryType === "food_permission") {
    if (foodRule.decision === "forbidden_food_rejection" || foodRule.decision === "diet_type_conflict") {
      return "green_forbidden_food_reminder";
    }
    if (foodRule.decision === "allowed_food_confirmation" || foodRule.decision === "diet_type_compatible") {
      return "green_allowed_food_confirmation";
    }
  }

  if (foodRule.queryType === "food_substitution" && foodRule.decision === "equivalent_substitution_allowed") {
    return "green_allowed_substitution";
  }

  if (foodRule.queryType === "meal_skip" && foodRule.decision === "optional_skip_allowed") {
    return "green_optional_meal_skip";
  }

  if (
    foodRule.queryType === "product_ingredient" &&
    (foodRule.decision === "product_ingredient_conflict" || foodRule.decision === "allowed_food_confirmation")
  ) {
    return "green_product_ingredient_check";
  }

  return null;
}

export function buildStructuredSourceCategories(structuredFoodRules, productIngredientEvidence) {
  if (!structuredFoodRules || typeof structuredFoodRules !== "object") return [];

  const categories = [];
  const push = (category, fieldIds) => {
    categories.push({
      category,
      segmentType: "structured_food_rule",
      sourceId: fieldIds.join(","),
      authority: "dietitian_approved_context",
      origin: "structured_food_rule",
    });
  };

  if (hasValues(structuredFoodRules.forbiddenFoodItems) || hasValues(structuredFoodRules.forbiddenFoodGroups)) {
    push("structured_forbidden_food", ["forbidden_food_items", "forbidden_food_groups"]);
  }
  if (hasValues(structuredFoodRules.allowedFoodItems) || hasValues(structuredFoodRules.allowedFoodGroups)) {
    push("structured_allowed_food", ["allowed_food_items", "allowed_food_groups"]);
  }
  if (hasValues(structuredFoodRules.equivalentExchangeGroups)) {
    push("structured_equivalent_exchange_groups", ["equivalent_exchange_groups"]);
  }
  if (hasFormBackedSubstitutions(structuredFoodRules)) {
    push("structured_allowed_substitutions", ["allowed_substitutions"]);
  }
  if (hasValues(structuredFoodRules.optionalFoodsOrMeals) || structuredFoodRules.skipToleranceRules) {
    push("structured_skip_rules", ["optional_foods_or_meals", "skip_tolerance_rules"]);
  }
  if (hasValues(structuredFoodRules.ingredientAllergenKeywords)) {
    push("structured_ingredient_keywords", ["ingredient_allergen_keywords"]);
  }
  if (structuredFoodRules.dietTypeRules) {
    push("structured_diet_type_rules", ["diet_type_rules"]);
  }

  if (productIngredientEvidence?.ingredientText) {
    const confidence = String(productIngredientEvidence.ingredientConfidence || "unknown").toLowerCase();
    if (confidence === "exact" || confidence === "high") {
      push("trusted_product_evidence", ["product_ingredient_evidence"]);
    }
  }

  return categories;
}

function hasFormBackedSubstitutions(structuredFoodRules) {
  return Boolean(structuredFoodRules.allowedSubstitutionsSummary?.trim());
}

function hasValues(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(String(value || "").trim());
}

function canUseSubstitutionLegacyFallback(effectiveIntentFamily, requirements, foodRule, matchedCategories) {
  if (effectiveIntentFamily !== "green_allowed_substitution" || !requirements?.allowPlanFallbackWithoutEngine) {
    return false;
  }

  const hasLegacySource =
    matchedCategories.includes("active_diet_plan") || matchedCategories.includes("dietitian_manual_message");
  if (!hasLegacySource) return false;
  if (!foodRule || foodRule.decision === "not_applicable") return true;
  return foodRule.queryType === "food_substitution" && foodRule.decision === "unknown_food_requires_review";
}

function approvedSourcesFromPrompt(promptContext) {
  const sources = [];
  for (const segment of promptContext.segments || []) {
    const text = String(segment?.text || "").trim();
    if (!text) continue;
    const category = categoryForSegment(segment);
    if (!category) continue;
    sources.push({
      category,
      segmentType: segment.type,
      sourceId: segment.sourceId || null,
      authority: segment.authority || null,
      origin: segment.origin || null,
    });
  }
  return sources;
}

function categoryForSegment(segment) {
  if (segment.type === "recent_message") {
    if (segment.origin !== "dietitian_manual") return null;
    if (segment.authority !== "dietitian_authored" && segment.authority !== "newest_dietitian_authored") {
      return null;
    }
    return "dietitian_manual_message";
  }
  return SEGMENT_SOURCE_RULES[segment.type] || null;
}

function dedupeSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    const key = `${source.category}:${source.segmentType}:${source.sourceId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function currentMessageText(promptContext) {
  return (promptContext.segments || []).find((segment) => segment.type === "current_message")?.text || "";
}

function buildDecision(decision, reasons, sources, metadata = {}) {
  return {
    version: INTENT_SPECIFIC_ANSWERABILITY_VERSION,
    baseVersion: APPROVED_SOURCE_ANSWERABILITY_VERSION,
    decision,
    allowed: decision === "source_backed_green",
    reasons,
    sourceCategories: Array.from(new Set(sources.map((source) => source.category))),
    sources,
    ...metadata,
  };
}

function normalize(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}
