import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION,
  AudioTranscriptionObservationValidationError,
  evaluateTranscriptQualityGate,
  mergeVoiceRiskOverlay,
  validateAudioTranscriptionObservationV1,
} from "../src/audio-transcription-observation-v1.js";

function buildSampleObservation(overrides = {}) {
  return {
    schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION,
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segments: [
      {
        startMs: 0,
        endMs: 2400,
        text: "Bugun ogle yemeginde mercimek corbasi yedim.",
        confidence: 0.97,
        uncertain: false,
      },
    ],
    uncertainSpanCount: 0,
    providerId: "mock-local-stt",
    providerVersion: "mock-v1",
    ...overrides,
  };
}

test("audio transcription observation v1 validates and round-trips", () => {
  const observation = buildSampleObservation();
  assert.deepEqual(validateAudioTranscriptionObservationV1(observation), observation);
  assert.throws(
    () => validateAudioTranscriptionObservationV1({ ...observation, extra: true }),
    AudioTranscriptionObservationValidationError,
  );
});

test("audio transcription quality gate is fail-closed", () => {
  const accepted = evaluateTranscriptQualityGate({
    observation: buildSampleObservation(),
    expectedLocale: "tr-TR",
  });
  assert.equal(accepted.accepted, true);

  const lowConfidence = evaluateTranscriptQualityGate({
    observation: buildSampleObservation({ overallConfidence: 0.8 }),
    expectedLocale: "tr-TR",
  });
  assert.equal(lowConfidence.accepted, false);
  assert.ok(lowConfidence.reasonCodes.includes("overall_confidence_low"));
});

test("voice risk overlay never downgrades", () => {
  assert.equal(mergeVoiceRiskOverlay("green", "yellow"), "yellow");
  assert.equal(mergeVoiceRiskOverlay("red", "yellow"), "red");
});

test("audio transcription observation version is locked", () => {
  assert.equal(AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION, "audio-transcription-observation-v1-v0.1.0");
});
