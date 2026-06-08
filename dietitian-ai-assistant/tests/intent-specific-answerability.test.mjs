import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStructuredSourceCategories,
  evaluateIntentSpecificAnswerability,
  resolveEffectiveIntentFamily,
} from "../src/intent-specific-answerability.js";

const demoRules = {
  forbiddenFoodItems: ["peanut"],
  forbiddenFoodGroups: ["Kabuklu yemis"],
  allowedFoodItems: ["chicken"],
  allowedFoodGroups: ["Balik"],
  dietTypeRules: "Genel denge",
  equivalentExchangeGroups: [{ groupId: "nut_swap", items: ["almond", "walnut"] }],
  optionalFoodsOrMeals: ["planned snack"],
  skipToleranceRules: "Haftada 1 kez esnek",
  ingredientAllergenKeywords: ["sut"],
  allowedSubstitutionsSummary: "Egg swaps to lor cheese when needed.",
};

const promptContextWithPlan = {
  segments: [
    { type: "current_message", text: "Bugun kahvaltida yumurta yerine ne yiyebilirim?" },
    { type: "diet_plan_summary", text: "Breakfast: eggs and greens" },
    { type: "client_form_summary", text: "Primary goal: fat loss" },
  ],
};

test("intent-specific answerability allows substitution with plan fallback when food engine is absent", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: promptContextWithPlan,
    riskDecision: { level: "green" },
    greenIntent: {
      allowed: true,
      intentFamily: "green_allowed_substitution",
      reasons: ["green_intent_taxonomy_allowed"],
    },
    foodRule: null,
    structuredFoodRules: null,
  });

  assert.equal(result.decision, "source_backed_green");
  assert.equal(result.intentFamily, "green_allowed_substitution");
  assert.ok(result.matchedSourceCategories.includes("active_diet_plan"));
});

test("intent-specific answerability blocks forbidden food without structured sources", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: {
      segments: [
        { type: "current_message", text: "Fistik yiyebilir miyim?" },
        { type: "diet_plan_summary", text: "Breakfast: eggs" },
      ],
    },
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_plan_lookup", reasons: [] },
    foodRule: {
      decision: "forbidden_food_rejection",
      queryType: "food_permission",
    },
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "source_backed_green");
  assert.equal(result.intentFamily, "green_forbidden_food_reminder");
});

test("intent-specific answerability allows substitution legacy fallback when engine is unknown but plan source exists", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: promptContextWithPlan,
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_allowed_substitution", reasons: [] },
    foodRule: {
      decision: "unknown_food_requires_review",
      queryType: "food_substitution",
    },
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "source_backed_green");
  assert.ok(result.reasons.includes("intent_specific_substitution_legacy_fallback"));
  assert.ok(result.matchedSourceCategories.includes("active_diet_plan"));
});

test("intent-specific answerability blocks unknown substitution without legacy plan or manual source", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: {
      segments: [
        { type: "current_message", text: "Bugun kahvaltida yumurta yerine ne yiyebilirim?" },
        { type: "client_form_summary", text: "Primary goal: fat loss" },
      ],
    },
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_allowed_substitution", reasons: [] },
    foodRule: {
      decision: "unknown_food_requires_review",
      queryType: "food_substitution",
    },
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "handoff_required");
  assert.ok(result.reasons.includes("food_rule_requires_review"));
});

test("intent-specific answerability allows equivalent substitution with structured sources and engine match", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: promptContextWithPlan,
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_allowed_substitution", reasons: [] },
    foodRule: {
      decision: "equivalent_substitution_allowed",
      queryType: "food_substitution",
    },
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "source_backed_green");
  assert.ok(result.matchedSourceCategories.includes("structured_equivalent_exchange_groups"));
});

test("buildStructuredSourceCategories includes trusted product evidence", () => {
  const categories = buildStructuredSourceCategories(demoRules, {
    ingredientText: "sut, seker",
    ingredientConfidence: "exact",
  });

  assert.ok(categories.some((item) => item.category === "trusted_product_evidence"));
});

test("resolveEffectiveIntentFamily prefers food-rule intent mapping", () => {
  const family = resolveEffectiveIntentFamily(
    { intentFamily: "green_plan_lookup" },
    { decision: "forbidden_food_rejection", queryType: "food_permission" },
  );

  assert.equal(family, "green_forbidden_food_reminder");
});
