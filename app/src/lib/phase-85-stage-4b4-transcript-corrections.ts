import { commitAtomicTranscriptCorrectionV2 } from "./phase-85-stage-4b4-atomic-transcript-correction";
import type { TranscriptCorrectionRequest } from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B4_TRANSCRIPT_CORRECTIONS_VERSION = "p85-stage-4b4-transcript-corrections-v1";

export type TranscriptCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string }
  | { ok: false; failureCode: string; state: ManuAppState };

export function submitTranscriptCorrection(
  state: ManuAppState,
  request: TranscriptCorrectionRequest & { dietitianId: string },
): TranscriptCorrectionSubmitResult {
  const result = commitAtomicTranscriptCorrectionV2(state, request);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    state: result.state,
    correctionId: result.correctionId,
    resultAction: result.resultAction,
  };
}
