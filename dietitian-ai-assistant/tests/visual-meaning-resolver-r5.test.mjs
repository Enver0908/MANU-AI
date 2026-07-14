import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProductIngredientVerification } from "../src/product-ingredient-verification.js";
import { evaluateVisualAnswerability } from "../src/visual-answerability-v1.js";
import { resolveVisualMeaningV1 } from "../src/visual-meaning-resolver-v1.js";
import { VISUAL_OBSERVATION_V1_VERSION } from "../src/visual-observation-v1.js";

const activeMenu = {
  mealSlots: [
    {
      items: [
        {
          id: "menu-item-1",
          label: "Izgara tavuk",
          freeText: "izgara tavuk",
          catalogMatch: { catalogFoodName: "izgara tavuk" },
          recipe: { title: "Izgara tavuk", ingredients: ["tavuk"] },
        },
      ],
      alternatives: [],
    },
  ],
};

function mealObservation(entityLabel, overrides = {}) {
  return {
    schemaVersion: VISUAL_OBSERVATION_V1_VERSION,
    sceneType: "meal",
    sceneConfidence: 0.97,
    overallConfidence: 0.96,
    qualityFlags: [],
    entityCandidates: [
      {
        label: entityLabel,
        normalizedLabel: entityLabel,
        confidence: 0.96,
        candidateKind: "food",
      },
    ],
    ocrBlocks: [],
    labelIntegrity: {
      completePanel: false,
      ingredientsHeaderPresent: false,
      cropOrGlareSuspected: false,
    },
    sensitivitySignals: [],
    promptInjectionSignals: [],
    providerId: "mock-local-vision-v1",
    providerVersion: "p85-stage-4b3-mock-v1",
    ...overrides,
  };
}

test("R5 blocks pizza visual with conflicting grilled chicken caption", () => {
  const result = resolveVisualMeaningV1({
    envelope: {
      bundleId: "bundle-pizza-caption",
      textSegments: [],
      visualSegments: [
        {
          messageId: "msg-1",
          mediaAssetId: "asset-1",
          analysisId: "analysis-1",
          observation: mealObservation("pizza"),
          captionText: "izgara tavuk",
          observedAt: "2026-07-14T10:00:00.000Z",
        },
      ],
    },
    activeMenu,
    foodRules: {},
  });

  assert.equal(result.visualSegments[0].workflowState, "meal_ambiguous");
  assert.ok(result.visualSegments[0].reasonCodes.includes("caption_entity_contradiction"));
});

test("R5 product verification uses visual_label_ocr and never allows absence inference", () => {
  const blocked = evaluateProductIngredientVerification({
    ingredientSourceType: "visual_label_ocr",
    ingredientText: "milk, sugar, whey",
    ingredientConfidence: "high",
    ingredientAllergenKeywords: ["sut", "whey"],
    forbiddenFoodItems: [],
    forbiddenFoodGroups: ["Sut urunleri"],
    dietTypeRules: null,
  });
  assert.equal(blocked.decision, "product_blocked");

  const absence = evaluateProductIngredientVerification({
    ingredientSourceType: "visual_label_ocr",
    ingredientText: "oats, water, salt",
    ingredientConfidence: "high",
    ingredientAllergenKeywords: ["fistik"],
    forbiddenFoodItems: ["peanut"],
    forbiddenFoodGroups: [],
    dietTypeRules: null,
  });
  assert.equal(absence.decision, "requires_review");
  assert.ok(absence.reasons.includes("visual_label_ocr_absence_not_allowed"));
});

test("R5 screenshot answerability rejects analysisId fallback without approved source id", () => {
  const answerability = evaluateVisualAnswerability({
    canonicalIntent: {
      decision: "canonical_intent_resolved",
      intentFamily: "green_visual_screenshot_confirmation",
    },
    meaning: {
      visualSegments: [
        {
          analysisId: "analysis-1",
          workflowState: "screenshot_approved_source_hit",
          approvedSourceId: null,
          menuMatch: null,
        },
      ],
    },
    visualRiskOverlay: { allowlisted: true },
  });

  assert.equal(answerability.allowed, false);
  assert.equal(answerability.decision, "handoff_required");
});
