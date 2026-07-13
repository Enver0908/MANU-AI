import { describe, expect, it } from "vitest";
import { VISUAL_OBSERVATION_SCHEMA_VERSION } from "./phase-85-stage-4b3-media-contracts";
import {
  assertProviderObservationHasNoForbiddenClinicalKeys,
  Stage4B3VisualObservationValidationError,
  validateProviderVisualObservation,
} from "./phase-85-stage-4b3-visual-observation-validator";

const validObservation = {
  schemaVersion: VISUAL_OBSERVATION_SCHEMA_VERSION,
  sceneType: "meal",
  sceneConfidence: 0.96,
  overallConfidence: 0.95,
  qualityFlags: [],
  entityCandidates: [
    {
      label: "Salata",
      normalizedLabel: "salata",
      confidence: 0.95,
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
};

describe("phase-85-stage-4b3-visual-observation-validator", () => {
  it("accepts schema-valid provider output", () => {
    expect(validateProviderVisualObservation(validObservation)).toEqual(validObservation);
  });

  it("rejects unknown keys and forbidden clinical advice fields", () => {
    expect(() => validateProviderVisualObservation({ ...validObservation, leakedModel: "gpt" })).toThrow(
      Stage4B3VisualObservationValidationError,
    );
    expect(() =>
      assertProviderObservationHasNoForbiddenClinicalKeys({ ...validObservation, clinicalAdvice: "eat sugar" }),
    ).toThrow(/forbidden_key:clinicalAdvice/);
  });

  it("rejects OCR blocks above the 6000 codepoint cap", () => {
    const longText = "a".repeat(6_001);
    expect(() =>
      validateProviderVisualObservation({
        ...validObservation,
        ocrBlocks: [{ text: longText, confidence: 0.9, blockKind: "label" }],
      }),
    ).toThrow(/ocr_blocks_limit_exceeded/);
  });
});
