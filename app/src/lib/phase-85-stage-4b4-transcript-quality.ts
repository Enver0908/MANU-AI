import {
  computeTranscriptionDerivedMetrics,
  evaluateAudioTranscriptionQuality,
  evaluateTranscriptQualityGate,
  type AudioQualityCode,
  type AudioTranscriptionDerivedMetrics,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionQualityDecision,
  type AudioTranscriptionStatus,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_TRANSCRIPT_QUALITY_VERSION = "p85-stage-4b4-transcript-quality-v2";

export type AudioTranscriptionQualitySnapshot = {
  qualityDecision: AudioTranscriptionQualityDecision;
  derivedMetrics: AudioTranscriptionDerivedMetrics;
  terminalStatus: Extract<AudioTranscriptionStatus, "accepted" | "review_required">;
  rejectionReasons: AudioQualityCode[];
};

export function resolveTranscriptionTerminalStatus(
  qualityDecision: AudioTranscriptionQualityDecision,
): Extract<AudioTranscriptionStatus, "accepted" | "review_required"> {
  return qualityDecision.accepted ? "accepted" : "review_required";
}

export function buildAudioTranscriptionQualitySnapshot(input: {
  observation: AudioTranscriptionObservationV1;
  expectedLocale: Stage4B4SupportedLocale;
}): AudioTranscriptionQualitySnapshot {
  const qualityDecision = evaluateAudioTranscriptionQuality(input);
  return {
    qualityDecision,
    derivedMetrics: computeTranscriptionDerivedMetrics(input.observation),
    terminalStatus: resolveTranscriptionTerminalStatus(qualityDecision),
    rejectionReasons: qualityDecision.reasonCodes,
  };
}

export function applyTranscriptQualityGate(input: {
  observation: AudioTranscriptionObservationV1;
  expectedLocale: Stage4B4SupportedLocale;
}): AudioTranscriptionQualitySnapshot {
  return buildAudioTranscriptionQualitySnapshot(input);
}

export { evaluateAudioTranscriptionQuality, evaluateTranscriptQualityGate };
