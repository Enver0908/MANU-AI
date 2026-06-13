import test from "node:test";
import assert from "node:assert/strict";
import { buildFoodDecisionV2PromptSegments } from "../src/food-decision-v2-prompt-segments.js";
import { compilePromptContext } from "../src/context-compiler.js";
import {
  detectFoodDecisionV2OutputViolations,
  guardProviderOutput,
} from "../src/response-quality-guard.js";
import {
  buildFoodDecisionV2SourceCategories,
  evaluateIntentSpecificAnswerability,
  resolveFoodDecisionV2IntentFamily,
} from "../src/intent-specific-answerability.js";
import { getPersona } from "../src/personas.js";
import { defaultVoiceProfile } from "../src/voice-profile.js";

const foodDecisionV2 = {
  version: "phase-77g-food-decision-engine-v2",
  decision: "forbid",
  reasonCodes: ["food_decision_v2_forbidden_food"],
  queryType: "food_permission",
  catalogMatches: [{ foodId: "fistik__id", foodName: "Fistik", confidence: "exact", path: "nuts" }],
  menuOnPlan: false,
  effectiveFlexibility: "restricted",
  evidenceManifest: {
    profileSummary: { forbiddenFoodCount: 2, forbiddenGroupCount: 1, allowedFoodCount: 3, dietType: "Genel" },
    menuSummary: { templateType: "weekly_meal_framework", status: "active", mealSlotCount: 4 },
    verification: {
      version: "product-ingredient-verification-v0.1.0",
      decision: "product_blocked",
      reasons: ["forbidden_keyword"],
      ingredientSourceType: "user_label_text",
      ingredientConfidence: "exact",
      matchedForbiddenKeywordIds: ["sut"],
      dietTypeConflict: false,
    },
    goalKey: "weight_loss",
    mealKey: "kahvalti",
  },
  sourceReferences: ["food_profile_v2", "master_food_catalog", "menu_plan_v1"],
  providerEligible: true,
  legacyFoodRuleDecision: "forbidden_food_rejection",
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

test("buildFoodDecisionV2PromptSegments omits raw label text and exposes typed segments", () => {
  const segments = buildFoodDecisionV2PromptSegments({ foodDecisionV2 });
  const types = segments.map((segment) => segment.type);

  assert.ok(types.includes("food_decision_v2"));
  assert.ok(types.includes("food_profile_summary"));
  assert.ok(types.includes("menu_authority"));
  assert.ok(types.includes("flexibility_modifier"));
  assert.ok(types.includes("ingredient_evidence_v2"));
  assert.ok(types.includes("food_source_manifest"));
  assert.equal(segments.some((segment) => segment.text.includes("sut, laktoz")), false);
  assert.ok(segments.find((segment) => segment.type === "ingredient_evidence_v2")?.text.includes("labelText: omitted_from_prompt"));
});

test("compiler prefers V2 segments and provider instruction when foodDecisionV2 is present", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: "Fistik yiyebilir miyim?",
    recentMessages: [],
    riskLevel: "green",
    foodDecisionV2,
  });

  const types = compiled.promptContext.segments.map((segment) => segment.type);
  assert.ok(types.includes("food_decision_v2"));
  assert.equal(types.includes("food_rule_decision"), false);
  assert.ok(
    compiled.promptContext.segments.some(
      (segment) =>
        segment.type === "system_instruction" && segment.text.includes("food_decision_v2 segment exactly"),
    ),
  );
});

test("intent-specific answerability accepts V2 forbid with profile and catalog sources", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: {
      segments: [
        { type: "current_message", text: "Fistik yiyebilir miyim?" },
        { type: "food_decision_v2", text: "decision: forbid", authority: "food_decision_engine_v2" },
        { type: "food_profile_summary", text: "forbiddenFoods: 2", authority: "food_rule_profile_v2" },
      ],
    },
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_plan_lookup", reasons: [] },
    foodRule: null,
    foodDecisionV2,
    structuredFoodRules: null,
  });

  assert.equal(result.decision, "source_backed_green");
  assert.equal(resolveFoodDecisionV2IntentFamily(foodDecisionV2), "green_forbidden_food_reminder");
  assert.ok(buildFoodDecisionV2SourceCategories(foodDecisionV2).some((source) => source.category === "food_rule_profile_v2"));
});

test("intent-specific answerability blocks needs_review V2 before provider", () => {
  const result = evaluateIntentSpecificAnswerability({
    promptContext: {
      segments: [{ type: "current_message", text: "Bilinmeyen sey yiyebilir miyim?" }],
    },
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_plan_lookup", reasons: [] },
    foodRule: null,
    foodDecisionV2: { ...foodDecisionV2, decision: "needs_review", providerEligible: false },
    structuredFoodRules: null,
  });

  assert.equal(result.decision, "handoff_required");
  assert.ok(result.reasons.includes("food_decision_v2_not_provider_eligible"));
});

test("food decision v2 output guard blocks forbidden and discourage strong approval", () => {
  const forbidIssues = detectFoodDecisionV2OutputViolations("Evet fistik yiyebilirsin.", {
    foodDecisionV2,
  });
  assert.ok(forbidIssues.includes("food_decision_v2_forbidden_food_approved"));

  const discourageIssues = detectFoodDecisionV2OutputViolations("Rahatca yiyebilirsin.", {
    foodDecisionV2: { ...foodDecisionV2, decision: "discourage" },
  });
  assert.ok(discourageIssues.includes("food_decision_v2_discourage_strong_approval"));
});

test("guardProviderOutput enforces V2 contradiction blocks with covenant intact", () => {
  const result = guardProviderOutput({
    output: "Evet fistik yiyebilirsin.",
    capsule,
    riskDecision: { level: "green" },
    foodRule: null,
    foodDecisionV2,
    structuredFoodRules: null,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.issues.some((issue) => issue.code === "food_decision_v2_forbidden_food_approved"));
});
