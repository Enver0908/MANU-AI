import {
  evaluateTranscriptQualityGate,
  type AudioQualityCode,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionQualityDecision,
  type AudioTranscriptionStatus,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_TRANSCRIPT_QUALITY_VERSION = "p85-stage-4b4-transcript-quality-v1";

export function resolveTranscriptionTerminalStatus(
  qualityDecision: AudioTranscriptionQualityDecision,
): Extract<AudioTranscriptionStatus, "accepted" | "review_required"> {
  return qualityDecision.accepted ? "accepted" : "review_required";
}

export function applyTranscriptQualityGate(input: {
  observation: AudioTranscriptionObservationV1;
  expectedLocale: Stage4B4SupportedLocale;
}): {
  qualityDecision: AudioTranscriptionQualityDecision;
  terminalStatus: Extract<AudioTranscriptionStatus, "accepted" | "review_required">;
  rejectionReasons: AudioQualityCode[];
} {
  const qualityDecision = evaluateTranscriptQualityGate(input);
  return {
    qualityDecision,
    terminalStatus: resolveTranscriptionTerminalStatus(qualityDecision),
    rejectionReasons: qualityDecision.reasonCodes,
  };
}
