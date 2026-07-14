import type { ChannelEventKind, MessageRetrievalEligibility, RiskLevel, TenantRole } from "./types";

export const PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION = "p85-stage-4b3-media-contracts-v1";
export const VISUAL_OBSERVATION_SCHEMA_VERSION = "visual-observation-v1-v0.1.0";

export const STAGE_4B3_BUNDLE_SILENCE_SECONDS = 120;
export const STAGE_4B3_BUNDLE_MAX_MESSAGES = 20;
export const STAGE_4B3_BUNDLE_MAX_IMAGES = 4;
export const STAGE_4B3_BUNDLE_MAX_UNICODE_CODEPOINTS = 16_000;
export const STAGE_4B3_MEDIA_RETENTION_DAYS = 30;
export const STAGE_4B3_MAX_OCR_CODEPOINTS = 6_000;
export const STAGE_4B3_MAX_ENTITY_CANDIDATES = 32;

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
] as const;

export type VisualSceneType = (typeof VISUAL_SCENE_TYPES)[number];

export const MEDIA_ASSET_STATUSES = [
  "admitted",
  "download_pending",
  "sanitized",
  "analysis_pending",
  "analysis_ready",
  "failed",
  "expired",
  "revoked",
] as const;

export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const INBOUND_MESSAGE_BUNDLE_STATUSES = [
  "open",
  "ready",
  "processing",
  "decided",
  "completed",
  "review_required",
  "failed",
  "superseded",
  "cancelled",
] as const;

export type InboundMessageBundleStatus = (typeof INBOUND_MESSAGE_BUNDLE_STATUSES)[number];

export const VISUAL_CORRECTION_STATUSES = [
  "submitted",
  "applied_to_pending",
  "manual_follow_up_required",
  "closed",
] as const;

export type VisualCorrectionStatus = (typeof VISUAL_CORRECTION_STATUSES)[number];

export const INBOUND_MESSAGE_BUNDLE_ITEM_TYPES = ["text", "image", "caption"] as const;

export type InboundMessageBundleItemType = (typeof INBOUND_MESSAGE_BUNDLE_ITEM_TYPES)[number];

export const VISUAL_CORRECTION_REASON_CODES = [
  "wrong_scene",
  "wrong_food_candidate",
  "wrong_ocr_reading",
  "wrong_label_interpretation",
  "sensitive_content_missed",
  "other_clinical_mismatch",
] as const;

export type VisualCorrectionReasonCode = (typeof VISUAL_CORRECTION_REASON_CODES)[number];

export const VISUAL_AUTOPILOT_INELIGIBILITY_REASONS = [
  "scene_not_allowlisted",
  "low_scene_confidence",
  "low_overall_confidence",
  "multiple_scene_candidates",
  "mixed_dish_or_portion",
  "supplement_or_medication",
  "body_or_symptom",
  "lab_or_medical_document",
  "sensitive_identity_document",
  "prompt_injection_signal",
  "label_incomplete",
  "context_unresolved",
  "bundle_overflow",
  "analysis_failed",
  "asset_not_ready",
  "correction_pending",
] as const;

export type VisualAutopilotIneligibilityReason = (typeof VISUAL_AUTOPILOT_INELIGIBILITY_REASONS)[number];

export const STAGE_4B3_IMAGE_CHANNEL_EVENT_KIND = "client_message_image" as const satisfies ChannelEventKind;

export const STAGE_4B3_MEDIA_RETRIEVAL_EXCLUSIONS = [
  "excluded_media_pending",
  "excluded_media_only",
  "excluded_media_expired",
] as const satisfies readonly MessageRetrievalEligibility[];

export const NON_AUTOPILOT_VISUAL_SCENES: readonly VisualSceneType[] = [
  "supplement_or_medication",
  "body_or_symptom",
  "lab_or_medical_document",
  "sensitive_identity_document",
  "unknown",
  "other",
];

export const FORBIDDEN_CLIENT_MEDIA_DTO_KEYS = [
  "objectKey",
  "object_key",
  "sanitizedFullObjectKey",
  "thumbnailObjectKey",
  "providerMediaId",
  "provider_media_id",
  "providerMediaIdHash",
  "contentSha256",
  "ocrText",
  "ocr_text",
  "ocrBlocks",
  "confidence",
  "sceneConfidence",
  "overallConfidence",
  "modelName",
  "model_name",
  "providerId",
  "providerVersion",
  "promptText",
  "rawBytes",
] as const;

export type MediaAssetDimensions = {
  width: number;
  height: number;
};

export type MediaAssetRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  messageId: string;
  channelEventId: string;
  position: number;
  providerMediaId: string | null;
  providerMediaIdHash: string | null;
  declaredMimeType: string;
  detectedMimeType: string | null;
  dimensions: MediaAssetDimensions | null;
  byteSize: number | null;
  contentSha256: string | null;
  sanitizedFullObjectKey: string | null;
  thumbnailObjectKey: string | null;
  status: MediaAssetStatus;
  retryCount: number;
  nextAttemptAt: string | null;
  leaseExpiresAt: string | null;
  storedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisualEntityCandidate = {
  label: string;
  normalizedLabel: string;
  confidence: number;
  candidateKind: "food" | "product" | "document_region" | "other";
};

export type VisualOcrBlock = {
  text: string;
  confidence: number;
  blockKind: "caption" | "label" | "screenshot" | "other";
};

export type VisualObservationV1 = {
  schemaVersion: typeof VISUAL_OBSERVATION_SCHEMA_VERSION;
  sceneType: VisualSceneType;
  sceneConfidence: number;
  overallConfidence: number;
  qualityFlags: string[];
  entityCandidates: VisualEntityCandidate[];
  ocrBlocks: VisualOcrBlock[];
  labelIntegrity: {
    completePanel: boolean;
    ingredientsHeaderPresent: boolean;
    cropOrGlareSuspected: boolean;
  };
  sensitivitySignals: string[];
  promptInjectionSignals: string[];
  providerId: string;
  providerVersion: string;
};

export type VisualAnalysisRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  mediaAssetId: string;
  messageId: string;
  bundleId: string | null;
  analysisRevision: number;
  status: "pending" | "ready" | "failed" | "superseded";
  observation: VisualObservationV1 | null;
  supersededByAnalysisId: string | null;
  failureCode: string | null;
  retrievalEligible?: boolean;
  evidenceExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboundMessageBundleRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  anchorMessageId: string;
  status: InboundMessageBundleStatus;
  openedAt: string;
  lastEventAt: string;
  readyAt: string;
  bundleRevision: number;
  conversationRevisionAtOpen: number;
  itemCount: number;
  imageCount: number;
  unicodeCodepointCount: number;
  retryCount: number;
  nextAttemptAt: string | null;
  leaseExpiresAt: string | null;
  decisionId: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboundMessageBundleItemRecord = {
  id: string;
  tenantId: string;
  bundleId: string;
  messageId: string;
  channelEventId: string | null;
  mediaAssetId: string | null;
  ordinal: number;
  itemType: InboundMessageBundleItemType;
  captionText: string | null;
  replyToProviderMessageId: string | null;
  actorType?: "client" | "dietitian" | "system";
  senderId?: string;
  replyToMessageId?: string | null;
  observedAt: string;
  createdAt: string;
};

export type VisualCorrectionRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  analysisId: string;
  dietitianId: string;
  status: VisualCorrectionStatus;
  reasonCode: VisualCorrectionReasonCode;
  explanation: string;
  correctedSceneType: VisualSceneType | null;
  correctedOcrText: string | null;
  correctedEntityLabels: string[];
  conversationRevisionAtSubmit: number;
  analysisRevisionAtSubmit: number;
  resultAction: "supersede_rerun" | "invalidate_pending" | "manual_follow_up" | "closed_without_send";
  createdAt: string;
  updatedAt: string;
};

export type MultimodalTextSegment = {
  messageId: string;
  body: string;
  observedAt: string;
  replyToProviderMessageId: string | null;
};

export type MultimodalVisualSegment = {
  messageId: string;
  mediaAssetId: string;
  analysisId: string;
  observation: VisualObservationV1;
  captionText: string | null;
  observedAt: string;
};

export type MultimodalMessageEnvelope = {
  schemaVersion: typeof PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION;
  bundleId: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  bundleRevision: number;
  conversationRevision: number;
  textSegments: MultimodalTextSegment[];
  visualSegments: MultimodalVisualSegment[];
  primaryQuestionText: string | null;
  confidenceBand: "high" | "medium" | "low" | "insufficient";
  sourceAuthorityState: "unresolved" | "partial" | "approved_only";
};

export type VisualAutopilotEligibility = {
  eligible: boolean;
  sceneType: VisualSceneType;
  reasonCodes: VisualAutopilotIneligibilityReason[];
  requiredGates: Array<
    | "scene_allowlisted"
    | "confidence_threshold"
    | "label_integrity"
    | "context_exact_match"
    | "no_prompt_injection"
    | "narrow_autopilot_v2"
    | "output_guard"
  >;
  passedGates: string[];
};

export type ConversationMediaDto = {
  assetId: string;
  messageId: string;
  status: MediaAssetStatus;
  declaredMimeType: string;
  detectedMimeType: string | null;
  dimensions: MediaAssetDimensions | null;
  expiresAt: string | null;
  hasThumbnail: boolean;
  reviewState: "none" | "pending" | "required" | "failed" | "expired";
};

export type VisualReviewDto = {
  analysisId: string;
  analysisRevision: number;
  mediaAssetId: string;
  messageId: string;
  bundleId: string | null;
  sceneType: VisualSceneType;
  reviewState: "pending" | "required" | "corrected" | "closed";
  entitySummary: string[];
  labelIntegritySummary: string[];
  correctionAllowed: boolean;
  latestCorrectionId: string | null;
};

export type VisualCorrectionRequest = {
  analysisId: string;
  requestId: string;
  expectedConversationRevision: number;
  expectedAnalysisRevision: number;
  reasonCode: VisualCorrectionReasonCode;
  explanation: string;
  correctedSceneType?: VisualSceneType | null;
  correctedOcrText?: string | null;
  correctedEntityLabels?: string[];
};

export type BundleDecisionIdempotencyReplay = {
  decisionId: string;
  bundleId: string;
  bundleRevision: number;
  conversationRevision: number;
};

export type VisualCorrectionIdempotencyReplay = {
  correctionId: string;
  resultAction: string;
};

export type Stage4B3MediaStateSlice = {
  mediaAssets: MediaAssetRecord[];
  visualAnalysisRecords: VisualAnalysisRecord[];
  inboundMessageBundles: InboundMessageBundleRecord[];
  inboundMessageBundleItems: InboundMessageBundleItemRecord[];
  visualCorrections: VisualCorrectionRecord[];
  processedBundleDecisionKeys: string[];
  bundleDecisionReplayByKey: Record<string, BundleDecisionIdempotencyReplay>;
  processedVisualCorrectionRequestIds: string[];
  visualCorrectionReplayByRequestId: Record<string, VisualCorrectionIdempotencyReplay>;
};

const RISK_RANK: Record<RiskLevel, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

export function createEmptyStage4B3MediaCollections(): Stage4B3MediaStateSlice {
  return {
    mediaAssets: [],
    visualAnalysisRecords: [],
    inboundMessageBundles: [],
    inboundMessageBundleItems: [],
    visualCorrections: [],
    processedBundleDecisionKeys: [],
    bundleDecisionReplayByKey: {},
    processedVisualCorrectionRequestIds: [],
    visualCorrectionReplayByRequestId: {},
  };
}

export function isVisualSceneType(value: unknown): value is VisualSceneType {
  return typeof value === "string" && (VISUAL_SCENE_TYPES as readonly string[]).includes(value);
}

export function isMediaAssetStatus(value: unknown): value is MediaAssetStatus {
  return typeof value === "string" && (MEDIA_ASSET_STATUSES as readonly string[]).includes(value);
}

export function isInboundMessageBundleStatus(value: unknown): value is InboundMessageBundleStatus {
  return typeof value === "string" && (INBOUND_MESSAGE_BUNDLE_STATUSES as readonly string[]).includes(value);
}

export function isVisualCorrectionStatus(value: unknown): value is VisualCorrectionStatus {
  return typeof value === "string" && (VISUAL_CORRECTION_STATUSES as readonly string[]).includes(value);
}

export function isUnitConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Stage4B3MediaContractError(`${label}_must_be_object`);
  }
  return value as Record<string, unknown>;
}

function assertNoUnknownKeys(record: Record<string, unknown>, allowedKeys: readonly string[], label: string) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      throw new Stage4B3MediaContractError(`${label}_unknown_key:${key}`);
    }
  }
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Stage4B3MediaContractError(`${label}_must_be_array`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Stage4B3MediaContractError(`${label}_entry_${index}_must_be_string`);
    }
    return entry;
  });
}

function parseEntityCandidates(value: unknown): VisualEntityCandidate[] {
  if (!Array.isArray(value)) {
    throw new Stage4B3MediaContractError("entity_candidates_must_be_array");
  }
  if (value.length > STAGE_4B3_MAX_ENTITY_CANDIDATES) {
    throw new Stage4B3MediaContractError("entity_candidates_limit_exceeded");
  }

  return value.map((entry, index) => {
    const record = assertPlainObject(entry, `entity_candidate_${index}`);
    assertNoUnknownKeys(record, ["label", "normalizedLabel", "confidence", "candidateKind"], `entity_candidate_${index}`);
    if (typeof record.label !== "string" || !record.label.trim()) {
      throw new Stage4B3MediaContractError(`entity_candidate_${index}_label_required`);
    }
    if (typeof record.normalizedLabel !== "string" || !record.normalizedLabel.trim()) {
      throw new Stage4B3MediaContractError(`entity_candidate_${index}_normalized_label_required`);
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new Stage4B3MediaContractError(`entity_candidate_${index}_confidence_invalid`);
    }
    if (
      record.candidateKind !== "food" &&
      record.candidateKind !== "product" &&
      record.candidateKind !== "document_region" &&
      record.candidateKind !== "other"
    ) {
      throw new Stage4B3MediaContractError(`entity_candidate_${index}_candidate_kind_invalid`);
    }
    return {
      label: record.label,
      normalizedLabel: record.normalizedLabel,
      confidence: record.confidence,
      candidateKind: record.candidateKind as VisualEntityCandidate["candidateKind"],
    };
  });
}

function parseOcrBlocks(value: unknown): VisualOcrBlock[] {
  if (!Array.isArray(value)) {
    throw new Stage4B3MediaContractError("ocr_blocks_must_be_array");
  }

  let totalCodepoints = 0;
  const blocks = value.map((entry, index) => {
    const record = assertPlainObject(entry, `ocr_block_${index}`);
    assertNoUnknownKeys(record, ["text", "confidence", "blockKind"], `ocr_block_${index}`);
    if (typeof record.text !== "string") {
      throw new Stage4B3MediaContractError(`ocr_block_${index}_text_required`);
    }
    totalCodepoints += [...record.text].length;
    if (totalCodepoints > STAGE_4B3_MAX_OCR_CODEPOINTS) {
      throw new Stage4B3MediaContractError("ocr_blocks_limit_exceeded");
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new Stage4B3MediaContractError(`ocr_block_${index}_confidence_invalid`);
    }
    if (
      record.blockKind !== "caption" &&
      record.blockKind !== "label" &&
      record.blockKind !== "screenshot" &&
      record.blockKind !== "other"
    ) {
      throw new Stage4B3MediaContractError(`ocr_block_${index}_block_kind_invalid`);
    }
    return {
      text: record.text,
      confidence: record.confidence,
      blockKind: record.blockKind as VisualOcrBlock["blockKind"],
    };
  });

  return blocks;
}

export class Stage4B3MediaContractError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Stage4B3MediaContractError";
    this.code = code;
  }
}

export function parseVisualObservationV1(input: unknown): VisualObservationV1 {
  const record = assertPlainObject(input, "visual_observation");
  assertNoUnknownKeys(
    record,
    [
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
    ],
    "visual_observation",
  );

  if (record.schemaVersion !== VISUAL_OBSERVATION_SCHEMA_VERSION) {
    throw new Stage4B3MediaContractError("visual_observation_schema_version_invalid");
  }
  if (!isVisualSceneType(record.sceneType)) {
    throw new Stage4B3MediaContractError("visual_observation_scene_type_invalid");
  }
  if (!isUnitConfidence(record.sceneConfidence)) {
    throw new Stage4B3MediaContractError("visual_observation_scene_confidence_invalid");
  }
  if (!isUnitConfidence(record.overallConfidence)) {
    throw new Stage4B3MediaContractError("visual_observation_overall_confidence_invalid");
  }
  if (typeof record.providerId !== "string" || !record.providerId.trim()) {
    throw new Stage4B3MediaContractError("visual_observation_provider_id_required");
  }
  if (typeof record.providerVersion !== "string" || !record.providerVersion.trim()) {
    throw new Stage4B3MediaContractError("visual_observation_provider_version_required");
  }

  const labelIntegrityRecord = assertPlainObject(record.labelIntegrity, "label_integrity");
  assertNoUnknownKeys(
    labelIntegrityRecord,
    ["completePanel", "ingredientsHeaderPresent", "cropOrGlareSuspected"],
    "label_integrity",
  );
  if (typeof labelIntegrityRecord.completePanel !== "boolean") {
    throw new Stage4B3MediaContractError("label_integrity_complete_panel_invalid");
  }
  if (typeof labelIntegrityRecord.ingredientsHeaderPresent !== "boolean") {
    throw new Stage4B3MediaContractError("label_integrity_ingredients_header_invalid");
  }
  if (typeof labelIntegrityRecord.cropOrGlareSuspected !== "boolean") {
    throw new Stage4B3MediaContractError("label_integrity_crop_or_glare_invalid");
  }

  return {
    schemaVersion: VISUAL_OBSERVATION_SCHEMA_VERSION,
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

export function mergeVisualRiskOverlay(baseRisk: RiskLevel, visualRisk: RiskLevel): RiskLevel {
  return RISK_RANK[visualRisk] > RISK_RANK[baseRisk] ? visualRisk : baseRisk;
}

export function isNonAutopilotVisualScene(sceneType: VisualSceneType): boolean {
  return (NON_AUTOPILOT_VISUAL_SCENES as readonly string[]).includes(sceneType);
}

export function resolveVisualReviewState(input: {
  assetStatus: MediaAssetStatus;
  analysisStatus: VisualAnalysisRecord["status"] | null;
  bundleStatus: InboundMessageBundleStatus | null;
}): ConversationMediaDto["reviewState"] {
  if (input.assetStatus === "expired" || input.assetStatus === "revoked") {
    return "expired";
  }
  if (input.assetStatus === "failed" || input.analysisStatus === "failed") {
    return "failed";
  }
  if (input.bundleStatus === "review_required") {
    return "required";
  }
  if (input.assetStatus === "analysis_pending" || input.analysisStatus === "pending") {
    return "pending";
  }
  return "none";
}

export function buildConversationMediaDto(
  asset: Pick<
    MediaAssetRecord,
    | "id"
    | "messageId"
    | "status"
    | "declaredMimeType"
    | "detectedMimeType"
    | "dimensions"
    | "expiresAt"
    | "thumbnailObjectKey"
  >,
  reviewState: ConversationMediaDto["reviewState"],
): ConversationMediaDto {
  return {
    assetId: asset.id,
    messageId: asset.messageId,
    status: asset.status,
    declaredMimeType: asset.declaredMimeType,
    detectedMimeType: asset.detectedMimeType,
    dimensions: asset.dimensions,
    expiresAt: asset.expiresAt,
    hasThumbnail: Boolean(asset.thumbnailObjectKey),
    reviewState,
  };
}

export function canAccessVisualReview(role: TenantRole): boolean {
  return role === "owner" || role === "admin" || role === "dietitian";
}

export function buildVisualReviewDto(input: {
  role: TenantRole;
  analysis: Pick<
    VisualAnalysisRecord,
    "id" | "analysisRevision" | "mediaAssetId" | "messageId" | "bundleId" | "observation"
  >;
  reviewState: VisualReviewDto["reviewState"];
  latestCorrectionId: string | null;
}): VisualReviewDto | null {
  if (!canAccessVisualReview(input.role) || !input.analysis.observation) {
    return null;
  }

  const observation = input.analysis.observation;
  const isBoundedProjection = observation.providerId === "bounded_projection";
  return {
    analysisId: input.analysis.id,
    analysisRevision: input.analysis.analysisRevision,
    mediaAssetId: input.analysis.mediaAssetId,
    messageId: input.analysis.messageId,
    bundleId: input.analysis.bundleId,
    sceneType: observation.sceneType,
    reviewState: input.reviewState,
    entitySummary: isBoundedProjection
      ? []
      : observation.entityCandidates.slice(0, 5).map((candidate) => candidate.normalizedLabel),
    labelIntegritySummary: isBoundedProjection
      ? []
      : [
          observation.labelIntegrity.completePanel ? "complete_panel" : "incomplete_panel",
          observation.labelIntegrity.ingredientsHeaderPresent
            ? "ingredients_header_present"
            : "ingredients_header_missing",
          observation.labelIntegrity.cropOrGlareSuspected ? "crop_or_glare_suspected" : "crop_or_glare_clear",
        ],
    correctionAllowed: input.role === "owner" || input.role === "admin" || input.role === "dietitian",
    latestCorrectionId: input.latestCorrectionId,
  };
}

export function assertClientSafeMediaPayload(value: unknown, label = "client_media_payload"): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertClientSafeMediaPayload(entry, label);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_CLIENT_MEDIA_DTO_KEYS as readonly string[]).includes(key)) {
      throw new Stage4B3MediaContractError(`${label}_forbidden_key:${key}`);
    }
    assertClientSafeMediaPayload(record[key], `${label}.${key}`);
  }
}

export function evaluateVisualAutopilotEligibility(input: {
  observation: VisualObservationV1;
  bundleOverflow: boolean;
  assetReady: boolean;
  correctionPending: boolean;
}): VisualAutopilotEligibility {
  const reasonCodes: VisualAutopilotIneligibilityReason[] = [];
  const passedGates: string[] = [];

  if (!input.assetReady) {
    reasonCodes.push("asset_not_ready");
  } else {
    passedGates.push("asset_ready");
  }

  if (input.correctionPending) {
    reasonCodes.push("correction_pending");
  }

  if (input.bundleOverflow) {
    reasonCodes.push("bundle_overflow");
  }

  if (isNonAutopilotVisualScene(input.observation.sceneType)) {
    reasonCodes.push("scene_not_allowlisted");
  } else {
    passedGates.push("scene_allowlisted");
  }

  if (input.observation.sceneConfidence < 0.95) {
    reasonCodes.push("low_scene_confidence");
  } else {
    passedGates.push("confidence_threshold");
  }

  if (input.observation.overallConfidence < 0.95) {
    reasonCodes.push("low_overall_confidence");
  }

  if (input.observation.entityCandidates.length > 1) {
    reasonCodes.push("multiple_scene_candidates");
  }

  if (input.observation.promptInjectionSignals.length > 0) {
    reasonCodes.push("prompt_injection_signal");
  }

  if (
    input.observation.sceneType === "packaged_food_label" &&
    (!input.observation.labelIntegrity.completePanel || input.observation.labelIntegrity.cropOrGlareSuspected)
  ) {
    reasonCodes.push("label_incomplete");
  }

  return {
    eligible: reasonCodes.length === 0,
    sceneType: input.observation.sceneType,
    reasonCodes,
    requiredGates: [
      "scene_allowlisted",
      "confidence_threshold",
      "label_integrity",
      "context_exact_match",
      "no_prompt_injection",
      "narrow_autopilot_v2",
      "output_guard",
    ],
    passedGates,
  };
}

export function assertVisualSceneExhaustive(sceneType: VisualSceneType): string {
  switch (sceneType) {
    case "meal":
      return "meal";
    case "packaged_food_label":
      return "packaged_food_label";
    case "supplement_or_medication":
      return "supplement_or_medication";
    case "screenshot_or_document":
      return "screenshot_or_document";
    case "lab_or_medical_document":
      return "lab_or_medical_document";
    case "body_or_symptom":
      return "body_or_symptom";
    case "sensitive_identity_document":
      return "sensitive_identity_document";
    case "other":
      return "other";
    case "unknown":
      return "unknown";
    default: {
      const unreachable: never = sceneType;
      throw new Stage4B3MediaContractError(`unsupported_scene:${String(unreachable)}`);
    }
  }
}
