import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateProductIngredientVerification,
  PRODUCT_INGREDIENT_VERIFICATION_VERSION,
} from "../src/product-ingredient-verification.js";

const dairyRules = {
  ingredientAllergenKeywords: ["sut", "laktoz", "whey", "casein"],
  forbiddenFoodItems: [],
  forbiddenFoodGroups: ["Sut urunleri"],
  dietTypeRules: "Genel denge",
};

test("product ingredient verification blocks exact dairy keywords in label text", () => {
  const result = evaluateProductIngredientVerification({
    ingredientSourceType: "user_label_text",
    ingredientText: "milk, sugar, cocoa, whey, casein",
    ingredientConfidence: "exact",
    ...dairyRules,
  });

  assert.equal(result.version, PRODUCT_INGREDIENT_VERIFICATION_VERSION);
  assert.equal(result.decision, "product_blocked");
  assert.ok(result.matchedForbiddenKeywordIds.includes("keyword:milk") || result.matchedForbiddenKeywordIds.includes("keyword:whey"));
});

test("product ingredient verification requires review for low confidence labels", () => {
  const result = evaluateProductIngredientVerification({
    ingredientSourceType: "user_label_text",
    ingredientText: "milk, sugar",
    ingredientConfidence: "low",
    ...dairyRules,
  });

  assert.equal(result.decision, "requires_review");
  assert.ok(result.reasons.includes("product_ingredient_confidence_insufficient"));
});

test("product ingredient verification requires review for unknown source type", () => {
  const result = evaluateProductIngredientVerification({
    ingredientSourceType: "unknown",
    ingredientText: "milk, sugar",
    ingredientConfidence: "exact",
    ...dairyRules,
  });

  assert.equal(result.decision, "requires_review");
  assert.ok(result.reasons.includes("product_ingredient_source_untrusted"));
});

test("product ingredient verification blocks vegan diet conflict without explicit allergen keyword", () => {
  const result = evaluateProductIngredientVerification({
    ingredientSourceType: "user_label_text",
    ingredientText: "chicken broth, salt, starch",
    ingredientConfidence: "high",
    ingredientAllergenKeywords: ["fistik"],
    forbiddenFoodItems: ["peanut"],
    forbiddenFoodGroups: [],
    dietTypeRules: "Vegan",
  });

  assert.equal(result.decision, "product_blocked");
  assert.equal(result.dietTypeConflict, true);
  assert.equal(result.dietTypeConflictGroup, "Kirmizi et");
});
