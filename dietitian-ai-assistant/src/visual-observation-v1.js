export const VISUAL_OBSERVATION_V1_VERSION = "visual-observation-v1-v0.1.0";

export const VISUAL_SCENE_TYPES = [
  "meal",
  "packaged_food_label",
  "supplement_or_medication",
  "screenshot_or_document",
  "lab_or_medical_document",
  "body_or_symptom",
  "sensitive_identity_document",
  "other",
  "unknown",
];

export const NON_AUTOPILOT_VISUAL_SCENES = [
  "supplement_or_medication",
  "body_or_symptom",
  "lab_or_medical_document",
  "sensitive_identity_document",
  "unknown",
  "other",
];

export const MAX_ENTITY_CANDIDATES = 32;
export const MAX_OCR_CODEPOINTS = 6000;

const ALLOWED_OBSERVATION_KEYS = new Set([
  "schemaVersion",
  "sceneType",
  "sceneConfidence",
  "overallConfidence",
  "qualityFlags",
  "entityCandidates",
  "ocrBlocks",
  "labelIntegrity",
  "sensitivitySignals",
  "promptInjectionSignals",
  "providerId",
  "providerVersion",
]);

export class VisualObservationValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = "VisualObservationValidationError";
    this.code = code;
  }
}

export function isVisualSceneType(value) {
  return typeof value === "string" && VISUAL_SCENE_TYPES.includes(value);
}

export function isUnitConfidence(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isNonAutopilotVisualScene(sceneType) {
  return NON_AUTOPILOT_VISUAL_SCENES.includes(sceneType);
}

export function mergeVisualRiskOverlay(baseRisk, visualRisk) {
  const rank = { green: 0, yellow: 1, red: 2 };
  return rank[visualRisk] > rank[baseRisk] ? visualRisk : baseRisk;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new VisualObservationValidationError(`${label}_must_be_object`);
  }
  return value;
}

function assertNoUnknownKeys(record, allowedKeys, label) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key) && !allowedKeys.includes?.(key)) {
      const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
      if (!allowed.has(key)) {
        throw new VisualObservationValidationError(`${label}_unknown_key:${key}`);
      }
    }
  }
}

function parseStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new VisualObservationValidationError(`${label}_must_be_array`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new VisualObservationValidationError(`${label}_entry_${index}_must_be_string`);
    }
    return entry;
  });
}

function parseEntityCandidates(value) {
  if (!Array.isArray(value)) {
    throw new VisualObservationValidationError("entity_candidates_must_be_array");
  }
  if (value.length > MAX_ENTITY_CANDIDATES) {
    throw new VisualObservationValidationError("entity_candidates_limit_exceeded");
  }

  return value.map((entry, index) => {
    const record = assertPlainObject(entry, `entity_candidate_${index}`);
    assertNoUnknownKeys(record, new Set(["label", "normalizedLabel", "confidence", "candidateKind"]), `entity_candidate_${index}`);
    if (typeof record.label !== "string" || !record.label.trim()) {
      throw new VisualObservationValidationError(`entity_candidate_${index}_label_required`);
    }
    if (typeof record.normalizedLabel !== "string" || !record.normalizedLabel.trim()) {
      throw new VisualObservationValidationError(`entity_candidate_${index}_normalized_label_required`);
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new VisualObservationValidationError(`entity_candidate_${index}_confidence_invalid`);
    }
    if (!["food", "product", "document_region", "other"].includes(record.candidateKind)) {
      throw new VisualObservationValidationError(`entity_candidate_${index}_candidate_kind_invalid`);
    }
    return {
      label: record.label,
      normalizedLabel: record.normalizedLabel,
      confidence: record.confidence,
      candidateKind: record.candidateKind,
    };
  });
}

function parseOcrBlocks(value) {
  if (!Array.isArray(value)) {
    throw new VisualObservationValidationError("ocr_blocks_must_be_array");
  }

  let totalCodepoints = 0;
  return value.map((entry, index) => {
    const record = assertPlainObject(entry, `ocr_block_${index}`);
    assertNoUnknownKeys(record, new Set(["text", "confidence", "blockKind"]), `ocr_block_${index}`);
    if (typeof record.text !== "string") {
      throw new VisualObservationValidationError(`ocr_block_${index}_text_required`);
    }
    totalCodepoints += [...record.text].length;
    if (totalCodepoints > MAX_OCR_CODEPOINTS) {
      throw new VisualObservationValidationError("ocr_blocks_limit_exceeded");
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new VisualObservationValidationError(`ocr_block_${index}_confidence_invalid`);
    }
    if (!["caption", "label", "screenshot", "other"].includes(record.blockKind)) {
      throw new VisualObservationValidationError(`ocr_block_${index}_block_kind_invalid`);
    }
    return {
      text: record.text,
      confidence: record.confidence,
      blockKind: record.blockKind,
    };
  });
}

export function validateVisualObservationV1(input) {
  const record = assertPlainObject(input, "visual_observation");
  assertNoUnknownKeys(record, ALLOWED_OBSERVATION_KEYS, "visual_observation");

  if (record.schemaVersion !== VISUAL_OBSERVATION_V1_VERSION) {
    throw new VisualObservationValidationError("visual_observation_schema_version_invalid");
  }
  if (!isVisualSceneType(record.sceneType)) {
    throw new VisualObservationValidationError("visual_observation_scene_type_invalid");
  }
  if (!isUnitConfidence(record.sceneConfidence)) {
    throw new VisualObservationValidationError("visual_observation_scene_confidence_invalid");
  }
  if (!isUnitConfidence(record.overallConfidence)) {
    throw new VisualObservationValidationError("visual_observation_overall_confidence_invalid");
  }
  if (typeof record.providerId !== "string" || !record.providerId.trim()) {
    throw new VisualObservationValidationError("visual_observation_provider_id_required");
  }
  if (typeof record.providerVersion !== "string" || !record.providerVersion.trim()) {
    throw new VisualObservationValidationError("visual_observation_provider_version_required");
  }

  const labelIntegrityRecord = assertPlainObject(record.labelIntegrity, "label_integrity");
  assertNoUnknownKeys(
    labelIntegrityRecord,
    new Set(["completePanel", "ingredientsHeaderPresent", "cropOrGlareSuspected"]),
    "label_integrity",
  );
  if (typeof labelIntegrityRecord.completePanel !== "boolean") {
    throw new VisualObservationValidationError("label_integrity_complete_panel_invalid");
  }
  if (typeof labelIntegrityRecord.ingredientsHeaderPresent !== "boolean") {
    throw new VisualObservationValidationError("label_integrity_ingredients_header_invalid");
  }
  if (typeof labelIntegrityRecord.cropOrGlareSuspected !== "boolean") {
    throw new VisualObservationValidationError("label_integrity_crop_or_glare_invalid");
  }

  return {
    schemaVersion: VISUAL_OBSERVATION_V1_VERSION,
    sceneType: record.sceneType,
    sceneConfidence: record.sceneConfidence,
    overallConfidence: record.overallConfidence,
    qualityFlags: parseStringArray(record.qualityFlags, "quality_flags"),
    entityCandidates: parseEntityCandidates(record.entityCandidates),
    ocrBlocks: parseOcrBlocks(record.ocrBlocks),
    labelIntegrity: {
      completePanel: labelIntegrityRecord.completePanel,
      ingredientsHeaderPresent: labelIntegrityRecord.ingredientsHeaderPresent,
      cropOrGlareSuspected: labelIntegrityRecord.cropOrGlareSuspected,
    },
    sensitivitySignals: parseStringArray(record.sensitivitySignals, "sensitivity_signals"),
    promptInjectionSignals: parseStringArray(record.promptInjectionSignals, "prompt_injection_signals"),
    providerId: record.providerId,
    providerVersion: record.providerVersion,
  };
}

export function assertVisualSceneExhaustive(sceneType) {
  switch (sceneType) {
    case "meal":
    case "packaged_food_label":
    case "supplement_or_medication":
    case "screenshot_or_document":
    case "lab_or_medical_document":
    case "body_or_symptom":
    case "sensitive_identity_document":
    case "other":
    case "unknown":
      return sceneType;
    default:
      throw new VisualObservationValidationError(`unsupported_scene:${String(sceneType)}`);
  }
}
