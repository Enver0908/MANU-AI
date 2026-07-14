import type {
  VisualCorrectionReasonCode,
  VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";

export function isVisualSceneCorrection(value: unknown): value is VisualSceneType {
  return typeof value === "string" && value.length > 0;
}

export function isVisualCorrectionReason(value: unknown): value is VisualCorrectionReasonCode {
  return typeof value === "string" && value.length > 0;
}
