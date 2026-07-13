import assert from "node:assert/strict";
import test from "node:test";
import { renderDeterministicTemplate } from "../src/deterministic-template-library-v1.js";
import { detectVisualMetadataLeaks } from "../src/response-quality-guard.js";
import { evaluateVisualRiskOverlay } from "../src/visual-risk-overlay-v1.js";
import { resolveVisualCanonicalIntent } from "../src/visual-intent-bridge-v1.js";
import { evaluateMultimodalVisualSafetyChainV1 } from "../src/visual-multimodal-safety-v1.js";
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

function buildMeaning(workflowState, extra = {}) {
  return {
    visualSegments: [
      {
        analysisId: "analysis-1",
        mediaAssetId: "asset-1",
        sceneType: "meal",
        workflowState,
        sourceAuthority: "approved_menu_exact",
        reasonCodes: [],
        menuMatch: { status: "exact", menuItemId: "menu-item-1", matchedLabel: "izgara tavuk", confidence: 0.96 },
        ...extra,
      },
    ],
    sourceAuthorityState: "approved_only",
    textBinding: { primaryBinding: "none" },
    absenceOfEvidenceAllowedCount: 0,
  };
}

function buildEnvelope(observation) {
  return {
    bundleId: "bundle-1",
    textSegments: [],
    visualSegments: [
      {
        messageId: "msg-1",
        mediaAssetId: "asset-1",
        analysisId: "analysis-1",
        observation,
        captionText: null,
        observedAt: "2026-07-14T10:00:00.000Z",
      },
    ],
    primaryQuestionText: null,
  };
}

test("visual risk overlay never downgrades base risk", () => {
  const overlay = evaluateVisualRiskOverlay({
    baseRiskDecision: { level: "yellow", reasons: ["base_yellow"] },
    meaning: buildMeaning("meal_exact_menu"),
    envelope: buildEnvelope(mealObservation()),
  });
  assert.equal(overlay.mergedRiskLevel, "yellow");
  assert.equal(overlay.riskEscalated, false);
});

test("visual risk overlay escalates supplement scenes to yellow", () => {
  const overlay = evaluateVisualRiskOverlay({
    baseRiskDecision: { level: "green", reasons: [] },
    meaning: buildMeaning("supplement_review", { sceneType: "supplement_or_medication", sourceAuthority: "untrusted_visual" }),
    envelope: buildEnvelope({ ...mealObservation(), sceneType: "supplement_or_medication" }),
  });
  assert.equal(overlay.visualRiskLevel, "yellow");
  assert.ok(overlay.ineligibilityReasons.includes("visual_scene_not_allowlisted"));
});

test("visual canonical intent maps exact menu progress acknowledgement", () => {
  const intent = resolveVisualCanonicalIntent({
    meaning: buildMeaning("meal_exact_menu"),
    envelope: buildEnvelope(mealObservation()),
    mergedRiskDecision: { level: "green" },
  });
  assert.equal(intent.intentFamily, "green_visual_progress_acknowledgement");
});

test("multimodal visual safety chain blocks client send for yellow visual risk", () => {
  const chain = evaluateMultimodalVisualSafetyChainV1({
    baseRiskDecision: { level: "green", reasons: [] },
    meaning: buildMeaning("supplement_review", { sceneType: "supplement_or_medication", sourceAuthority: "untrusted_visual" }),
    envelope: buildEnvelope({ ...mealObservation(), sceneType: "supplement_or_medication" }),
  });
  assert.equal(chain.mergedRiskDecision.level, "yellow");
  assert.equal(chain.clientSendEligible, false);
  assert.equal(chain.providerAttempted, false);
  assert.notEqual(chain.modeDecision.action, "auto_send");
});

test("multimodal visual safety chain allows narrow autopilot only for exact menu allowlist", () => {
  const chain = evaluateMultimodalVisualSafetyChainV1({
    baseRiskDecision: { level: "green", reasons: [] },
    meaning: buildMeaning("meal_exact_menu"),
    envelope: buildEnvelope(mealObservation()),
  });
  assert.equal(chain.mergedRiskDecision.level, "green");
  assert.equal(chain.visualRiskOverlay.allowlisted, true);
  assert.equal(chain.clientSendEligible, true);
  assert.equal(chain.responsePlan.templateId, "visual_progress_ack_v1");
});

test("visual metadata leak detector blocks OCR and confidence wording", () => {
  assert.deepEqual(detectVisualMetadataLeaks("OCR ile okudum, guven skoru yuksek."), [
    "visual_ocr_leak",
    "visual_confidence_leak",
  ]);
  const safe = renderDeterministicTemplate({ templateId: "visual_progress_ack_v1", language: "tr" });
  assert.equal(detectVisualMetadataLeaks(safe).length, 0);
});
