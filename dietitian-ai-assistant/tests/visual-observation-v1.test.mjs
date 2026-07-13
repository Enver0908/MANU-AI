import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUAL_OBSERVATION_V1_VERSION,
  VISUAL_SCENE_TYPES,
  assertVisualSceneExhaustive,
  isNonAutopilotVisualScene,
  mergeVisualRiskOverlay,
  validateVisualObservationV1,
} from "../src/visual-observation-v1.js";

const sampleObservation = {
  schemaVersion: VISUAL_OBSERVATION_V1_VERSION,
  sceneType: "packaged_food_label",
  sceneConfidence: 0.96,
  overallConfidence: 0.95,
  qualityFlags: [],
  entityCandidates: [
    {
      label: "Yulaf Ezmesi",
      normalizedLabel: "yulaf ezmesi",
      confidence: 0.96,
      candidateKind: "product",
    },
  ],
  ocrBlocks: [{ text: "Icindekiler: yulaf", confidence: 0.95, blockKind: "label" }],
  labelIntegrity: {
    completePanel: true,
    ingredientsHeaderPresent: true,
    cropOrGlareSuspected: false,
  },
  sensitivitySignals: [],
  promptInjectionSignals: [],
  providerId: "mock-local-vision",
  providerVersion: "mock-v1",
};

test("visual observation v1 validates schema version and scene vocabulary", () => {
  assert.equal(VISUAL_OBSERVATION_V1_VERSION, "visual-observation-v1-v0.1.0");
  assert.equal(VISUAL_SCENE_TYPES.length, 9);
  assert.deepEqual(validateVisualObservationV1(sampleObservation), sampleObservation);
});

test("visual observation v1 rejects unknown keys and invalid confidence", () => {
  assert.throws(() => validateVisualObservationV1({ ...sampleObservation, leakedModel: "gpt" }), /unknown_key/);
  assert.throws(() => validateVisualObservationV1({ ...sampleObservation, overallConfidence: 2 }), /overall_confidence_invalid/);
});

test("visual observation v1 keeps risk overlay monotonic", () => {
  assert.equal(mergeVisualRiskOverlay("green", "yellow"), "yellow");
  assert.equal(mergeVisualRiskOverlay("red", "yellow"), "red");
});

test("visual observation v1 classifies non-autopilot scenes", () => {
  assert.equal(isNonAutopilotVisualScene("meal"), false);
  assert.equal(isNonAutopilotVisualScene("body_or_symptom"), true);
  for (const sceneType of VISUAL_SCENE_TYPES) {
    assert.equal(assertVisualSceneExhaustive(sceneType), sceneType);
  }
});
