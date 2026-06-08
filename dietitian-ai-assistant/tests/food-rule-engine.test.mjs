import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFoodRuleDecision, FOOD_RULE_ENGINE_VERSION } from "../src/food-rule-engine.js";

const demoRules = {
  forbiddenFoodItems: ["peanut", "peanut butter", "fistik"],
  forbiddenFoodGroups: ["Kabuklu yemis"],
  allowedFoodItems: ["eggs", "chicken", "lor cheese", "greens", "almond", "walnut", "hazelnut"],
  allowedFoodGroups: ["Balik"],
  dietTypeRules: "Genel denge",
  equivalentExchangeGroups: [
    { groupId: "nut_swap", items: ["almond", "walnut", "hazelnut"] },
    { groupId: "dairy_alt", items: ["lor", "labne"] },
  ],
  mandatoryFoodsOrMeals: ["breakfast", "lunch protein"],
  optionalFoodsOrMeals: ["planned snack"],
  skipToleranceRules: "Haftada 1 kez esnek",
  ingredientAllergenKeywords: ["fistik", "sut", "laktoz", "whey"],
  uncertaintyPolicy: "Emin degilse yellow",
};

test("food rule engine rejects explicitly forbidden food", () => {
  const result = evaluateFoodRuleDecision({
    message: "Fistik yiyebilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.version, FOOD_RULE_ENGINE_VERSION);
  assert.equal(result.decision, "forbidden_food_rejection");
  assert.equal(result.queryType, "food_permission");
});

test("food rule engine confirms explicitly allowed food", () => {
  const result = evaluateFoodRuleDecision({
    message: "Tavuk yiyebilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "allowed_food_confirmation");
});

test("food rule engine allows approved equivalent substitution", () => {
  const result = evaluateFoodRuleDecision({
    message: "Walnut yerine almond yiyebilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "equivalent_substitution_allowed");
  assert.equal(result.exchangeGroupId, "nut_swap");
});

test("food rule engine fails closed for unapproved substitution", () => {
  const result = evaluateFoodRuleDecision({
    message: "Tavuk yerine elma yiyebilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "unknown_food_requires_review");
});

test("food rule engine allows optional skip when tolerance permits", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bugun planned snack ogununu atlayabilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "optional_skip_allowed");
});

test("food rule engine blocks mandatory skip", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bugun breakfast ogununu atlayabilir miyim?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "mandatory_skip_blocked");
});

test("food rule engine detects product ingredient conflict with trusted evidence", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bu cikolatanin icindekiler: sut, seker, kakao",
    structuredFoodRules: demoRules,
    productIngredientEvidence: {
      ingredientSourceType: "user_label_text",
      ingredientText: "sut, seker, kakao, whey, casein",
      ingredientConfidence: "exact",
    },
  });

  assert.equal(result.decision, "product_ingredient_conflict");
  assert.equal(result.verification?.decision, "product_blocked");
  assert.ok(result.matchedForbiddenKeywordIds?.includes("keyword:sut"));
});

test("food rule engine routes uncertain product evidence to review", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bu cikolatanin icindekiler: sut, seker, kakao",
    structuredFoodRules: demoRules,
    productIngredientEvidence: {
      ingredientSourceType: "user_label_text",
      ingredientText: "sut, seker, kakao",
      ingredientConfidence: "low",
    },
  });

  assert.equal(result.decision, "product_ingredient_unknown");
  assert.equal(result.verification?.decision, "requires_review");
});

test("food rule engine routes unknown product evidence to review", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bu cikolatanin icindekiler nedir?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "product_ingredient_unknown");
});

test("food rule engine maps vegan diet conflict on product label to diet_type_conflict", () => {
  const result = evaluateFoodRuleDecision({
    message: "Bu urunun icindekiler: chicken, salt",
    structuredFoodRules: {
      ...demoRules,
      dietTypeRules: "Vegan",
      ingredientAllergenKeywords: ["fistik"],
    },
    productIngredientEvidence: {
      ingredientSourceType: "user_label_text",
      ingredientText: "chicken, salt",
      ingredientConfidence: "exact",
    },
  });

  assert.equal(result.decision, "diet_type_conflict");
  assert.equal(result.verification?.dietTypeConflict, true);
});

test("food rule engine blocks mixed clinical intent", () => {
  const result = evaluateFoodRuleDecision({
    message: "Fistik yiyebilir miyim ve insulini artirayim mi?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "mixed_intent_blocked");
});

test("food rule engine returns not_applicable for non-food queries", () => {
  const result = evaluateFoodRuleDecision({
    message: "Randevu saatim kac?",
    structuredFoodRules: demoRules,
  });

  assert.equal(result.decision, "not_applicable");
});
