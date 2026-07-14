import type { SupportedLanguageCode } from "./languages";
import { t } from "./i18n";
import type {
  VisualCorrectionReasonCode,
  VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";
import type { VisualReviewDto } from "./phase-85-stage-4b3-media-contracts";

const VISUAL_CORRECTION_REASON_KEYS: Record<VisualCorrectionReasonCode, string> = {
  wrong_scene: "visualCorrectionReasonWrongScene",
  wrong_food_candidate: "visualCorrectionReasonWrongFoodCandidate",
  wrong_ocr_reading: "visualCorrectionReasonWrongOcrReading",
  wrong_label_interpretation: "visualCorrectionReasonWrongLabelInterpretation",
  sensitive_content_missed: "visualCorrectionReasonSensitiveContentMissed",
  other_clinical_mismatch: "visualCorrectionReasonOtherClinicalMismatch",
};

const VISUAL_SCENE_TYPE_KEYS: Record<VisualSceneType, string> = {
  meal: "visualSceneTypeMeal",
  packaged_food_label: "visualSceneTypePackagedFoodLabel",
  supplement_or_medication: "visualSceneTypeSupplementOrMedication",
  screenshot_or_document: "visualSceneTypeScreenshotOrDocument",
  lab_or_medical_document: "visualSceneTypeLabOrMedicalDocument",
  body_or_symptom: "visualSceneTypeBodyOrSymptom",
  sensitive_identity_document: "visualSceneTypeSensitiveIdentityDocument",
  other: "visualSceneTypeOther",
  unknown: "visualSceneTypeUnknown",
};

const VISUAL_REVIEW_STATE_KEYS: Record<VisualReviewDto["reviewState"], string> = {
  pending: "visualReviewStatePending",
  required: "visualReviewStateRequired",
  corrected: "visualReviewStateCorrected",
  closed: "visualReviewStateClosed",
};

export function resolveVisualCorrectionReasonLabel(
  language: SupportedLanguageCode,
  reasonCode: VisualCorrectionReasonCode,
): string {
  return t(language, VISUAL_CORRECTION_REASON_KEYS[reasonCode] as never);
}

export function resolveVisualSceneTypeLabel(language: SupportedLanguageCode, sceneType: VisualSceneType): string {
  return t(language, VISUAL_SCENE_TYPE_KEYS[sceneType] as never);
}

export function resolveVisualReviewStateLabel(
  language: SupportedLanguageCode,
  reviewState: VisualReviewDto["reviewState"],
): string {
  return t(language, VISUAL_REVIEW_STATE_KEYS[reviewState] as never);
}

export function reasonRequiresCorrectedSceneType(reasonCode: VisualCorrectionReasonCode): boolean {
  return reasonCode === "wrong_scene";
}

export function reasonRequiresCorrectedEntityLabels(reasonCode: VisualCorrectionReasonCode): boolean {
  return reasonCode === "wrong_food_candidate";
}

export function reasonRequiresCorrectedOcrText(reasonCode: VisualCorrectionReasonCode): boolean {
  return reasonCode === "wrong_ocr_reading" || reasonCode === "wrong_label_interpretation";
}
