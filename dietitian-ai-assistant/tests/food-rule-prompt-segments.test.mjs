import test from "node:test";
import assert from "node:assert/strict";
import {
  BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS,
  FOOD_RULE_PROMPT_SEGMENT_TYPES,
  buildFoodRulePromptSegments,
} from "../src/food-rule-prompt-segments.js";
import { compilePromptContext } from "../src/context-compiler.js";
import {
  detectFoodRuleOutputViolations,
  guardProviderOutput,
} from "../src/response-quality-guard.js";
import { getPersona } from "../src/personas.js";
import { defaultVoiceProfile } from "../src/voice-profile.js";

const demoRules = {
  forbiddenFoodItems: ["peanut", "fistik"],
  forbiddenFoodGroups: ["Kabuklu yemis"],
  allowedFoodItems: ["eggs", "chicken"],
  allowedFoodGroups: ["Balik"],
  dietTypeRules: "Vegan",
  equivalentExchangeGroups: [{ groupId: "nut_swap", items: ["almond", "walnut", "hazelnut"] }],
  optionalFoodsOrMeals: ["planned snack"],
  skipToleranceRules: "Haftada 1 kez esnek",
  ingredientAllergenKeywords: ["sut", "laktoz"],
};

const capsule = {
  tenantId: "tenant-1",
  dietitian: { id: "dietitian-1", displayName: "Dyt. Ayse", timezone: "Europe/Istanbul" },
  client: {
    id: "client-1",
    fullName: "Mert Kaya",
    dietPlan: { summary: "Three meals and one snack." },
    allergies: ["peanut"],
    restrictedFoods: ["fried foods"],
    pinnedNotes: [],
    communicationLanguage: "tr",
    clientFormSummary: "Daily routine",
    contextUpdates: [],
    contextRevision: 1,
  },
  conversation: { id: "conversation-1", channel: "whatsapp" },
  persona: getPersona("balanced_coach"),
  voiceProfile: defaultVoiceProfile(),
  memory: { rollingSummary: "", memoryVersion: "memory-v1", memoryRevision: 1 },
};

test("buildFoodRulePromptSegments exposes bounded typed segments without raw label text", () => {
  const segments = buildFoodRulePromptSegments({
    structuredFoodRules: demoRules,
    foodRuleDecision: {
      decision: "forbidden_food_rejection",
      queryType: "food_permission",
      matchedFood: "fistik",
      reasons: ["food_rule_forbidden_item"],
    },
    productIngredientEvidence: {
      ingredientSourceType: "user_label_text",
      ingredientText: "sut, laktoz, seker",
      ingredientConfidence: "exact",
    },
  });

  assert.deepEqual(
    segments.map((segment) => segment.type),
    [
      "food_rule_decision",
      "allowed_food_rules",
      "forbidden_food_rules",
      "equivalent_exchange_rules",
      "diet_type_rules",
      "ingredient_verification",
    ],
  );
  assert.ok(segments.every((segment) => segment.text.length <= BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS));
  assert.equal(segments.some((segment) => segment.text.includes("sut, laktoz")), false);
  assert.ok(segments.find((segment) => segment.type === "food_rule_decision")?.text.includes("forbidden_food_rejection"));
});

test("compiler includes food-rule segments and provider instruction when structured rules exist", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: "Fistik yiyebilir miyim?",
    recentMessages: [],
    riskLevel: "green",
    structuredFoodRules: demoRules,
    foodRuleDecision: {
      decision: "forbidden_food_rejection",
      queryType: "food_permission",
      matchedFood: "fistik",
      reasons: ["food_rule_forbidden_item"],
    },
  });

  const types = compiled.promptContext.segments.map((segment) => segment.type);
  for (const segmentType of [
    "food_rule_decision",
    "allowed_food_rules",
    "forbidden_food_rules",
    "equivalent_exchange_rules",
    "diet_type_rules",
  ]) {
    assert.ok(types.includes(segmentType), `missing ${segmentType}`);
  }
  assert.ok(
    compiled.promptContext.segments.some(
      (segment) =>
        segment.type === "system_instruction" && segment.text.includes("food_rule_decision segment exactly"),
    ),
  );
});

test("compiler omits food-rule segments when no structured rules or decision are provided", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: "Bugun ne yiyebilirim?",
    recentMessages: [],
    riskLevel: "green",
  });

  const types = compiled.promptContext.segments.map((segment) => segment.type);
  assert.equal(types.some((type) => FOOD_RULE_PROMPT_SEGMENT_TYPES.includes(type)), false);
});

test("food-rule output guard blocks forbidden-food approval language", () => {
  const issues = detectFoodRuleOutputViolations("Evet fistik yiyebilirsin, sorun olmaz.", {
    foodRule: { decision: "forbidden_food_rejection", matchedFood: "fistik" },
    structuredFoodRules: demoRules,
  });

  assert.ok(issues.includes("food_rule_forbidden_food_approved"));
});

test("food-rule output guard blocks unauthorized skip relaxation", () => {
  const issues = detectFoodRuleOutputViolations("Bugunluk atlayabilirsin, sorun olmaz.", {
    foodRule: { decision: "allowed_food_confirmation" },
    structuredFoodRules: { ...demoRules, optionalFoodsOrMeals: [], skipToleranceRules: null },
  });

  assert.ok(issues.includes("food_rule_unauthorized_skip_relaxation"));
});

test("food-rule output guard blocks portion increase suggestions", () => {
  const issues = detectFoodRuleOutputViolations("Porsiyonunu artirabilirsin.", {
    foodRule: { decision: "allowed_food_confirmation" },
    structuredFoodRules: demoRules,
  });

  assert.ok(issues.includes("food_rule_portion_or_macro_change"));
});

test("persona policy is still enforced alongside food-rule guard", () => {
  const emojiCapsule = {
    ...capsule,
    persona: getPersona("disciplined_tracker"),
    voiceProfile: { ...defaultVoiceProfile(), averageMessageChars: 120 },
  };

  const result = guardProviderOutput({
    output: "Tamam 👍",
    capsule: emojiCapsule,
    riskDecision: { level: "green" },
    foodRule: { decision: "allowed_food_confirmation" },
    structuredFoodRules: demoRules,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.issues.some((issue) => issue.code === "persona_emoji_policy_violation"));
});
