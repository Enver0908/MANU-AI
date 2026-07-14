import { commitAtomicVisualCorrectionV2 } from "./phase-85-stage-4b3-atomic-visual-correction";
import type { VisualCorrectionRequest } from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState } from "./types";
import { AppDomainError } from "./app-errors";

export const STAGE_4B3_VISUAL_CORRECTIONS_VERSION = "p85-stage-4b3-visual-corrections-v2";

export type VisualCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string }
  | { ok: false; failureCode: string };

export function submitVisualCorrection(
  state: ManuAppState,
  request: VisualCorrectionRequest & { dietitianId: string },
): VisualCorrectionSubmitResult {
  const result = commitAtomicVisualCorrectionV2(state, request);
  if (!result.ok) {
    return { ok: false, failureCode: result.failureCode };
  }
  return {
    ok: true,
    state: result.state,
    correctionId: result.correctionId,
    resultAction: result.resultAction,
  };
}

export function validateVisualCorrectionRequest(request: VisualCorrectionRequest): void {
  if (!request.explanation.trim()) {
    throw new AppDomainError(400, "visual_correction_explanation_required");
  }
  if (!request.requestId.trim()) {
    throw new AppDomainError(400, "visual_correction_request_id_required");
  }
}

export { isVisualSceneCorrection, isVisualCorrectionReason } from "./phase-85-stage-4b3-visual-corrections-helpers";
