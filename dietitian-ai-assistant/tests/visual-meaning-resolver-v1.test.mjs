import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUAL_MEANING_RESOLVER_V1_VERSION,
  evaluateScreenshotApprovedSourceHit,
  findExactMenuItemMatch,
  hasHighIntegrityLabel,
  resolveTextBinding,
  resolveVisualMeaningV1,
} from "../src/visual-meaning-resolver-v1.js";
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
          recipe: { title: "Izgara tavuk", ingredients: ["tavuk", "zeytinyagi"] },
        },
      ],
      alternatives: [],
    },
  ],
};

function mealObservation(overrides = {}) {
  return {
    schemaVersion: VISUAL_OBSERVATION_V1_VERSION,
    sceneType: "meal",
    sceneConfidence: 0.97,
    overallConfidence: 0.96,
    qualityFlags: [],
    entityCandidates: [
      {
        label: "Izgara tavuk",
        normalizedLabel: "izgara tavuk",
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

function labelObservation(overrides = {}) {
  return {
    schemaVersion: VISUAL_OBSERVATION_V1_VERSION,
    sceneType: "packaged_food_label",
    sceneConfidence: 0.98,
    overallConfidence: 0.97,
    qualityFlags: [],
    entityCandidates: [],
    ocrBlocks: [{ text: "Icindekiler: sut, seker", confidence: 0.96, blockKind: "label" }],
    labelIntegrity: {
      completePanel: true,
      ingredientsHeaderPresent: true,
      cropOrGlareSuspected: false,
    },
    sensitivitySignals: [],
    promptInjectionSignals: [],
    providerId: "mock-local-vision-v1",
    providerVersion: "p85-stage-4b3-mock-v1",
    ...overrides,
  };
}

test("visual meaning resolver exact menu match uses approved menu authority", () => {
  const envelope = {
    bundleId: "bundle-1",
    textSegments: [],
    visualSegments: [
      {
        messageId: "msg-1",
        mediaAssetId: "asset-1",
        analysisId: "analysis-1",
        observation: mealObservation(),
        captionText: null,
        observedAt: "2026-07-14T10:00:00.000Z",
      },
    ],
  };

  const result = resolveVisualMeaningV1({ envelope, activeMenu, foodRules: {} });
  assert.equal(result.schemaVersion, VISUAL_MEANING_RESOLVER_V1_VERSION);
  assert.equal(result.visualSegments[0].workflowState, "meal_exact_menu");
  assert.equal(result.visualSegments[0].sourceAuthority, "approved_menu_exact");
  assert.equal(result.absenceOfEvidenceAllowedCount, 0);
});

test("visual meaning resolver blocks product allowed inference from label absence", () => {
  const envelope = {
    bundleId: "bundle-2",
    textSegments: [],
    visualSegments: [
      {
        messageId: "msg-2",
        mediaAssetId: "asset-2",
        analysisId: "analysis-2",
        observation: labelObservation({ ocrBlocks: [{ text: "Icindekiler: yulaf", confidence: 0.96, blockKind: "label" }] }),
        captionText: null,
        observedAt: "2026-07-14T10:00:00.000Z",
      },
    ],
  };

  const result = resolveVisualMeaningV1({
    envelope,
    activeMenu,
    foodRules: {
      forbiddenFoodItems: ["fistik"],
      forbiddenFoodGroups: [],
      ingredientAllergenKeywords: [],
      dietTypeRules: null,
    },
  });

  assert.equal(result.visualSegments[0].workflowState, "label_absence_not_allowed");
  assert.equal(result.visualSegments[0].productDecision, "requires_review");
  assert.equal(result.absenceOfEvidenceAllowedCount, 0);
});

test("visual meaning resolver treats cropped labels as incomplete", () => {
  const observation = labelObservation({
    labelIntegrity: {
      completePanel: false,
      ingredientsHeaderPresent: true,
      cropOrGlareSuspected: true,
    },
  });
  assert.equal(hasHighIntegrityLabel(observation), false);
});

test("visual meaning resolver prioritizes caption binding over sequential text", () => {
  const envelope = {
    bundleId: "bundle-3",
    textSegments: [{ messageId: "t1", body: "devam metni", observedAt: "2026-07-14T10:01:00.000Z", replyToProviderMessageId: null }],
    visualSegments: [
      {
        messageId: "msg-3",
        mediaAssetId: "asset-3",
        analysisId: "analysis-3",
        observation: mealObservation({ entityCandidates: [] }),
        captionText: "izgara tavuk",
        observedAt: "2026-07-14T10:00:00.000Z",
      },
    ],
  };

  const binding = resolveTextBinding(envelope, {});
  assert.equal(binding.primaryBinding, "caption");
  assert.equal(binding.captionText, "izgara tavuk");
});

test("visual meaning resolver uses screenshot query only as untrusted retrieval input", () => {
  const envelope = {
    bundleId: "bundle-4",
    textSegments: [],
    visualSegments: [
      {
        messageId: "msg-4",
        mediaAssetId: "asset-4",
        analysisId: "analysis-4",
        observation: {
          ...mealObservation({ sceneType: "screenshot_or_document", entityCandidates: [] }),
          ocrBlocks: [{ text: "Bugun ne yemeliyim?", confidence: 0.92, blockKind: "screenshot" }],
        },
        captionText: null,
        observedAt: "2026-07-14T10:00:00.000Z",
      },
    ],
  };

  const miss = resolveVisualMeaningV1({ envelope, activeMenu, foodRules: {} });
  assert.equal(miss.visualSegments[0].workflowState, "screenshot_no_approved_source");
  assert.equal(miss.visualSegments[0].sourceAuthority, "untrusted_visual");

  const hitEnvelope = {
    ...envelope,
    visualSegments: [
      {
        ...envelope.visualSegments[0],
        observation: {
          ...envelope.visualSegments[0].observation,
          ocrBlocks: [{ text: "izgara tavuk uygun mu?", confidence: 0.92, blockKind: "screenshot" }],
        },
      },
    ],
  };
  assert.equal(evaluateScreenshotApprovedSourceHit("izgara tavuk uygun mu?", activeMenu), true);
  const hit = resolveVisualMeaningV1({ envelope: hitEnvelope, activeMenu, foodRules: {} });
  assert.equal(hit.visualSegments[0].workflowState, "screenshot_approved_source_hit");
  assert.equal(hit.visualSegments[0].sourceAuthority, "approved_source_only");
});

test("visual meaning resolver finds exact menu item matches only for normalized equality", () => {
  assert.equal(findExactMenuItemMatch(activeMenu, "Izgara tavuk")?.menuItemId, "menu-item-1");
  assert.equal(findExactMenuItemMatch(activeMenu, "pizza"), null);
});
