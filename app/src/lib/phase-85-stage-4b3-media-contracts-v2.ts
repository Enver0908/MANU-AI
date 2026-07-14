import {
  INBOUND_MESSAGE_BUNDLE_ITEM_TYPES,
  STAGE_4B3_MAX_ENTITY_CANDIDATES,
  STAGE_4B3_MAX_OCR_CODEPOINTS,
  VISUAL_CORRECTION_REASON_CODES,
  VISUAL_SCENE_TYPES,
  Stage4B3MediaContractError,
  type InboundMessageBundleItemRecord,
  type InboundMessageBundleItemType,
  type InboundMessageBundleRecord,
  type InboundMessageBundleStatus,
  type VisualCorrectionReasonCode,
  type VisualOcrBlock,
  type VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";

export const PHASE_85_STAGE_4B3_MEDIA_CONTRACT_V2_VERSION = "p85-stage-4b3-media-contracts-v2";

export const STAGE_4B3_MAX_RETRY_ATTEMPTS = 3;

export const INBOUND_MESSAGE_BUNDLE_STATUSES_V2 = [
  "open",
  "ready",
  "processing",
  "decided",
  "review_required",
  "superseded",
  "failed",
  "cancelled",
] as const;

export type InboundMessageBundleStatusV2 = (typeof INBOUND_MESSAGE_BUNDLE_STATUSES_V2)[number];

export const BUNDLE_ITEM_ACTOR_TYPES = ["client", "dietitian", "system"] as const;

export type BundleItemActorType = (typeof BUNDLE_ITEM_ACTOR_TYPES)[number];

export const VISUAL_EVIDENCE_SOURCE_TYPES = [
  "visual_label_ocr",
  "visual_menu_match",
  "visual_screenshot_query",
] as const;

export type VisualEvidenceSourceType = (typeof VISUAL_EVIDENCE_SOURCE_TYPES)[number];

export const VISUAL_EVIDENCE_AUTHORITIES = [
  "untrusted_visual",
  "limited_visual_label_conflict",
  "approved_menu_exact",
  "approved_source_only",
  "no_authority",
] as const;

export type VisualEvidenceAuthority = (typeof VISUAL_EVIDENCE_AUTHORITIES)[number];

export const VISUAL_EVIDENCE_ALLOWED_USES = [
  "forbidden_conflict_only",
  "menu_exact_match",
  "screenshot_query_untrusted",
  "approved_source_claim",
] as const;

export type VisualEvidenceAllowedUse = (typeof VISUAL_EVIDENCE_ALLOWED_USES)[number];

export const STAGE_4B3_NOTIFICATION_TYPES_V2 = [
  "visual_message_review",
  "visual_correction_follow_up",
] as const;

export type Stage4B3NotificationTypeV2 = (typeof STAGE_4B3_NOTIFICATION_TYPES_V2)[number];

export const VISUAL_CORRECTION_V2_LIMITS = {
  explanationMinCodepoints: 1,
  explanationMaxCodepoints: 2_000,
  correctedOcrMaxCodepoints: STAGE_4B3_MAX_OCR_CODEPOINTS,
  correctedEntityLabelMaxItems: STAGE_4B3_MAX_ENTITY_CANDIDATES,
  correctedEntityLabelMaxCodepointsPerItem: 160,
} as const;

export const FORBIDDEN_CLIENT_MEDIA_DTO_KEYS_V2 = [
  "objectKey",
  "object_key",
  "sanitizedFullObjectKey",
  "sanitized_full_object_key",
  "thumbnailObjectKey",
  "thumbnail_object_key",
  "providerMediaId",
  "provider_media_id",
  "providerMediaIdHash",
  "provider_media_id_hash",
  "contentSha256",
  "content_sha256",
  "ocrText",
  "ocr_text",
  "ocrBlocks",
  "ocr_blocks",
  "rawOcr",
  "raw_ocr",
  "ocrSummary",
  "ocr_summary",
  "confidence",
  "sceneConfidence",
  "scene_confidence",
  "overallConfidence",
  "overall_confidence",
  "modelName",
  "model_name",
  "providerId",
  "provider_id",
  "providerVersion",
  "provider_version",
  "promptText",
  "prompt_text",
  "rawBytes",
  "raw_bytes",
  "observation",
  "rawObservation",
  "raw_observation",
  "providerContext",
  "provider_context",
  "signedUrl",
  "signed_url",
  "storageObjectKey",
  "storage_object_key",
] as const;

export type InboundMessageBundleItemV2 = {
  id: string;
  tenantId: string;
  bundleId: string;
  actorType: BundleItemActorType;
  senderId: string;
  messageId: string;
  channelEventId: string | null;
  mediaAssetId: string | null;
  ordinal: number;
  itemType: InboundMessageBundleItemType;
  captionText: string | null;
  replyToProviderMessageId: string | null;
  replyToMessageId: string | null;
  observedAt: string;
  createdAt: string;
};

export type InboundMessageBundleRecordV2 = Omit<InboundMessageBundleRecord, "status"> & {
  status: InboundMessageBundleStatusV2;
};

export type VisualEvidenceRefV2 = {
  sourceType: VisualEvidenceSourceType;
  authority: VisualEvidenceAuthority;
  allowedUses: VisualEvidenceAllowedUse[];
  analysisId: string;
  approvedSourceId: string | null;
};

export type VisualCorrectionRequestV2 = {
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

export type RawVisualOcrEvidence = {
  readonly kind: "raw_visual_ocr";
  ocrBlocks: VisualOcrBlock[];
};

export type SourceGatedVisualSummary = {
  readonly kind: "source_gated_visual_summary";
  sourceType: VisualEvidenceSourceType;
  evidenceRef: VisualEvidenceRefV2;
  boundedTokens: string[];
};

export const BUNDLE_STATUS_TRANSITIONS_V2: Record<
  InboundMessageBundleStatusV2,
  readonly InboundMessageBundleStatusV2[]
> = {
  open: ["ready", "superseded", "cancelled", "failed"],
  ready: ["processing", "open", "superseded", "cancelled", "failed"],
  processing: ["decided", "review_required", "failed", "open", "ready", "superseded"],
  decided: ["superseded"],
  review_required: ["processing", "superseded", "cancelled", "failed", "open"],
  failed: ["ready", "open", "superseded", "cancelled"],
  superseded: [],
  cancelled: [],
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function countUnicodeCodepoints(value: string): number {
  return [...value].length;
}

export function isInboundMessageBundleStatusV2(value: unknown): value is InboundMessageBundleStatusV2 {
  return typeof value === "string" && (INBOUND_MESSAGE_BUNDLE_STATUSES_V2 as readonly string[]).includes(value);
}

export function isBundleItemActorType(value: unknown): value is BundleItemActorType {
  return typeof value === "string" && (BUNDLE_ITEM_ACTOR_TYPES as readonly string[]).includes(value);
}

export function isVisualEvidenceSourceType(value: unknown): value is VisualEvidenceSourceType {
  return typeof value === "string" && (VISUAL_EVIDENCE_SOURCE_TYPES as readonly string[]).includes(value);
}

export function assertVisualEvidenceSourceType(value: unknown): VisualEvidenceSourceType {
  if (value === "user_label_text") {
    throw new Stage4B3MediaContractError("visual_source_cannot_be_user_label_text");
  }
  if (!isVisualEvidenceSourceType(value)) {
    throw new Stage4B3MediaContractError("visual_source_type_invalid");
  }
  return value;
}

export function assertBundleStatusTransitionV2(
  from: InboundMessageBundleStatusV2,
  to: InboundMessageBundleStatusV2,
): void {
  if (from === to) {
    return;
  }
  const allowed = BUNDLE_STATUS_TRANSITIONS_V2[from];
  if (!allowed.includes(to)) {
    throw new Stage4B3MediaContractError(`bundle_status_transition_invalid:${from}->${to}`);
  }
}

export function assertBundleStatusExhaustiveV2(status: InboundMessageBundleStatusV2): InboundMessageBundleStatusV2 {
  switch (status) {
    case "open":
    case "ready":
    case "processing":
    case "decided":
    case "review_required":
    case "superseded":
    case "failed":
    case "cancelled":
      return status;
    default: {
      const unreachable: never = status;
      throw new Stage4B3MediaContractError(`unsupported_bundle_status_v2:${String(unreachable)}`);
    }
  }
}

export function mapBundleStatusV1ToV2(
  status: InboundMessageBundleStatus,
  decisionId: string | null,
): { status: InboundMessageBundleStatusV2; failureCode?: string } {
  if (status === "completed") {
    if (decisionId) {
      return { status: "decided" };
    }
    return { status: "failed", failureCode: "legacy_completed_without_decision" };
  }

  if (isInboundMessageBundleStatusV2(status)) {
    return { status };
  }

  return { status: "failed", failureCode: "legacy_contract_unknown" };
}

export function inferLegacyBundleItemActorType(
  item: Pick<InboundMessageBundleItemRecord, "itemType" | "captionText">,
): BundleItemActorType {
  if (item.itemType === "caption") {
    return "client";
  }
  return "client";
}

export function mapBundleItemV1ToV2(
  item: InboundMessageBundleItemRecord,
  actorType: BundleItemActorType = inferLegacyBundleItemActorType(item),
  senderId?: string,
): InboundMessageBundleItemV2 {
  if (!isBundleItemActorType(actorType)) {
    throw new Stage4B3MediaContractError("bundle_item_actor_type_invalid");
  }

  const resolvedSenderId = senderId?.trim() || item.tenantId;
  if (!resolvedSenderId) {
    throw new Stage4B3MediaContractError("bundle_item_sender_required");
  }

  return {
    id: item.id,
    tenantId: item.tenantId,
    bundleId: item.bundleId,
    actorType,
    senderId: resolvedSenderId,
    messageId: item.messageId,
    channelEventId: item.channelEventId,
    mediaAssetId: item.mediaAssetId,
    ordinal: item.ordinal,
    itemType: item.itemType,
    captionText: item.captionText,
    replyToProviderMessageId: item.replyToProviderMessageId,
    replyToMessageId: null,
    observedAt: item.observedAt,
    createdAt: item.createdAt,
  };
}

export function mapBundleRecordV1ToV2(bundle: InboundMessageBundleRecord): InboundMessageBundleRecordV2 {
  const mapped = mapBundleStatusV1ToV2(bundle.status, bundle.decisionId);
  return {
    ...bundle,
    status: mapped.status,
    failureCode: mapped.failureCode ?? bundle.failureCode,
  };
}

export function createInboundMessageBundleItemV2(input: {
  id: string;
  tenantId: string;
  bundleId: string;
  actorType: BundleItemActorType;
  senderId: string;
  messageId: string;
  itemType: InboundMessageBundleItemType;
  observedAt: string;
  channelEventId?: string | null;
  mediaAssetId?: string | null;
  ordinal: number;
  captionText?: string | null;
  replyToProviderMessageId?: string | null;
  replyToMessageId?: string | null;
  createdAt: string;
}): InboundMessageBundleItemV2 {
  if (!isBundleItemActorType(input.actorType)) {
    throw new Stage4B3MediaContractError("bundle_item_actor_type_invalid");
  }
  if (!input.senderId.trim()) {
    throw new Stage4B3MediaContractError("bundle_item_sender_required");
  }
  if (!(INBOUND_MESSAGE_BUNDLE_ITEM_TYPES as readonly string[]).includes(input.itemType)) {
    throw new Stage4B3MediaContractError("bundle_item_type_invalid");
  }

  return {
    id: input.id,
    tenantId: input.tenantId,
    bundleId: input.bundleId,
    actorType: input.actorType,
    senderId: input.senderId.trim(),
    messageId: input.messageId,
    channelEventId: input.channelEventId ?? null,
    mediaAssetId: input.mediaAssetId ?? null,
    ordinal: input.ordinal,
    itemType: input.itemType,
    captionText: input.captionText ?? null,
    replyToProviderMessageId: input.replyToProviderMessageId ?? null,
    replyToMessageId: input.replyToMessageId ?? null,
    observedAt: input.observedAt,
    createdAt: input.createdAt,
  };
}

export function parseVisualEvidenceRefV2(input: unknown): VisualEvidenceRefV2 {
  const record = assertPlainObject(input, "visual_evidence_ref");
  assertNoUnknownKeys(
    record,
    ["sourceType", "authority", "allowedUses", "analysisId", "approvedSourceId"],
    "visual_evidence_ref",
  );

  const sourceType = assertVisualEvidenceSourceType(record.sourceType);
  if (typeof record.authority !== "string" || !(VISUAL_EVIDENCE_AUTHORITIES as readonly string[]).includes(record.authority)) {
    throw new Stage4B3MediaContractError("visual_evidence_authority_invalid");
  }
  if (!Array.isArray(record.allowedUses) || record.allowedUses.length === 0) {
    throw new Stage4B3MediaContractError("visual_evidence_allowed_uses_required");
  }
  for (const [index, use] of record.allowedUses.entries()) {
    if (typeof use !== "string" || !(VISUAL_EVIDENCE_ALLOWED_USES as readonly string[]).includes(use)) {
      throw new Stage4B3MediaContractError(`visual_evidence_allowed_use_invalid_${index}`);
    }
  }
  if (typeof record.analysisId !== "string" || !UUID_RE.test(record.analysisId.trim())) {
    throw new Stage4B3MediaContractError("visual_evidence_analysis_id_invalid");
  }
  if (
    record.approvedSourceId !== null &&
    (typeof record.approvedSourceId !== "string" || !record.approvedSourceId.trim())
  ) {
    throw new Stage4B3MediaContractError("visual_evidence_approved_source_id_invalid");
  }
  if (sourceType === "visual_screenshot_query" && record.approvedSourceId === null) {
    throw new Stage4B3MediaContractError("visual_screenshot_query_requires_approved_source_id_key");
  }

  return {
    sourceType,
    authority: record.authority as VisualEvidenceAuthority,
    allowedUses: record.allowedUses as VisualEvidenceAllowedUse[],
    analysisId: record.analysisId.trim(),
    approvedSourceId:
      record.approvedSourceId === null ? null : String(record.approvedSourceId).trim() || null,
  };
}

function parseUuidField(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value.trim())) {
    throw new Stage4B3MediaContractError(code);
  }
  return value.trim();
}

function parseBoundedStringArray(
  value: unknown,
  label: string,
  maxItems: number,
  maxCodepointsPerItem: number,
): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Stage4B3MediaContractError(`${label}_must_be_array`);
  }
  if (value.length > maxItems) {
    throw new Stage4B3MediaContractError(`${label}_limit_exceeded`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Stage4B3MediaContractError(`${label}_entry_${index}_must_be_string`);
    }
    const normalized = entry.trim();
    if (!normalized) {
      throw new Stage4B3MediaContractError(`${label}_entry_${index}_empty`);
    }
    if (countUnicodeCodepoints(normalized) > maxCodepointsPerItem) {
      throw new Stage4B3MediaContractError(`${label}_entry_${index}_limit_exceeded`);
    }
    return normalized;
  });
}

export function parseVisualCorrectionRequestV2(input: unknown): VisualCorrectionRequestV2 {
  const record = assertPlainObject(input, "visual_correction_request");
  assertNoUnknownKeys(
    record,
    [
      "analysisId",
      "requestId",
      "expectedConversationRevision",
      "expectedAnalysisRevision",
      "reasonCode",
      "explanation",
      "correctedSceneType",
      "correctedOcrText",
      "correctedEntityLabels",
    ],
    "visual_correction_request",
  );

  const analysisId = parseUuidField(record.analysisId, "visual_correction_analysis_id_invalid");
  const requestId = parseUuidField(record.requestId, "visual_correction_request_id_invalid");

  if (
    typeof record.expectedConversationRevision !== "number" ||
    !Number.isInteger(record.expectedConversationRevision) ||
    record.expectedConversationRevision < 1
  ) {
    throw new Stage4B3MediaContractError("visual_correction_conversation_revision_invalid");
  }
  if (
    typeof record.expectedAnalysisRevision !== "number" ||
    !Number.isInteger(record.expectedAnalysisRevision) ||
    record.expectedAnalysisRevision < 1
  ) {
    throw new Stage4B3MediaContractError("visual_correction_analysis_revision_invalid");
  }

  if (typeof record.reasonCode !== "string" || !(VISUAL_CORRECTION_REASON_CODES as readonly string[]).includes(record.reasonCode)) {
    throw new Stage4B3MediaContractError("visual_correction_reason_invalid");
  }

  if (typeof record.explanation !== "string") {
    throw new Stage4B3MediaContractError("visual_correction_explanation_required");
  }
  const explanation = record.explanation.trim();
  const explanationLength = countUnicodeCodepoints(explanation);
  if (
    explanationLength < VISUAL_CORRECTION_V2_LIMITS.explanationMinCodepoints ||
    explanationLength > VISUAL_CORRECTION_V2_LIMITS.explanationMaxCodepoints
  ) {
    throw new Stage4B3MediaContractError("visual_correction_explanation_limit_exceeded");
  }

  let correctedSceneType: VisualSceneType | null | undefined;
  if (record.correctedSceneType !== undefined && record.correctedSceneType !== null) {
    if (typeof record.correctedSceneType !== "string" || !(VISUAL_SCENE_TYPES as readonly string[]).includes(record.correctedSceneType)) {
      throw new Stage4B3MediaContractError("visual_correction_scene_type_invalid");
    }
    correctedSceneType = record.correctedSceneType as VisualSceneType;
  } else if (record.correctedSceneType === null) {
    correctedSceneType = null;
  }

  let correctedOcrText: string | null | undefined;
  if (record.correctedOcrText !== undefined && record.correctedOcrText !== null) {
    if (typeof record.correctedOcrText !== "string") {
      throw new Stage4B3MediaContractError("visual_correction_ocr_text_invalid");
    }
    const normalized = record.correctedOcrText.trim();
    if (!normalized) {
      throw new Stage4B3MediaContractError("visual_correction_ocr_text_empty");
    }
    if (countUnicodeCodepoints(normalized) > VISUAL_CORRECTION_V2_LIMITS.correctedOcrMaxCodepoints) {
      throw new Stage4B3MediaContractError("visual_correction_ocr_text_limit_exceeded");
    }
    correctedOcrText = normalized;
  } else if (record.correctedOcrText === null) {
    correctedOcrText = null;
  }

  const correctedEntityLabels = parseBoundedStringArray(
    record.correctedEntityLabels,
    "visual_correction_entity_labels",
    VISUAL_CORRECTION_V2_LIMITS.correctedEntityLabelMaxItems,
    VISUAL_CORRECTION_V2_LIMITS.correctedEntityLabelMaxCodepointsPerItem,
  );

  return {
    analysisId,
    requestId,
    expectedConversationRevision: record.expectedConversationRevision,
    expectedAnalysisRevision: record.expectedAnalysisRevision,
    reasonCode: record.reasonCode as VisualCorrectionReasonCode,
    explanation,
    correctedSceneType,
    correctedOcrText,
    correctedEntityLabels,
  };
}

export function createRawVisualOcrEvidence(ocrBlocks: VisualOcrBlock[]): RawVisualOcrEvidence {
  if (!Array.isArray(ocrBlocks)) {
    throw new Stage4B3MediaContractError("raw_visual_ocr_blocks_must_be_array");
  }
  let totalCodepoints = 0;
  for (const block of ocrBlocks) {
    totalCodepoints += countUnicodeCodepoints(block.text);
    if (totalCodepoints > STAGE_4B3_MAX_OCR_CODEPOINTS) {
      throw new Stage4B3MediaContractError("raw_visual_ocr_limit_exceeded");
    }
  }
  return { kind: "raw_visual_ocr", ocrBlocks };
}

export function buildSourceGatedVisualSummary(input: {
  evidenceRef: VisualEvidenceRefV2;
  boundedTokens: string[];
}): SourceGatedVisualSummary {
  const evidenceRef = parseVisualEvidenceRefV2(input.evidenceRef);
  if (!Array.isArray(input.boundedTokens) || input.boundedTokens.length === 0) {
    throw new Stage4B3MediaContractError("source_gated_summary_tokens_required");
  }
  for (const [index, token] of input.boundedTokens.entries()) {
    if (typeof token !== "string" || !token.trim()) {
      throw new Stage4B3MediaContractError(`source_gated_summary_token_${index}_invalid`);
    }
  }

  return {
    kind: "source_gated_visual_summary",
    sourceType: evidenceRef.sourceType,
    evidenceRef,
    boundedTokens: input.boundedTokens.map((token) => token.trim()),
  };
}

export function assertClientSafeMediaPayloadV2(value: unknown, label = "client_media_payload_v2"): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertClientSafeMediaPayloadV2(entry, label);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_CLIENT_MEDIA_DTO_KEYS_V2 as readonly string[]).includes(key)) {
      throw new Stage4B3MediaContractError(`${label}_forbidden_key:${key}`);
    }
    assertClientSafeMediaPayloadV2(record[key], `${label}.${key}`);
  }
}

export function assertProviderContextExcludesRawOcr(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertProviderContextExcludesRawOcr(entry);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  if (record.kind === "raw_visual_ocr" || record.ocrBlocks !== undefined || record.ocr_blocks !== undefined) {
    throw new Stage4B3MediaContractError("provider_context_raw_ocr_forbidden");
  }
  for (const entry of Object.values(record)) {
    assertProviderContextExcludesRawOcr(entry);
  }
}

export function listExhaustiveBundleStatusTransitionsV2(): Array<{
  from: InboundMessageBundleStatusV2;
  to: InboundMessageBundleStatusV2;
  allowed: boolean;
}> {
  const pairs: Array<{ from: InboundMessageBundleStatusV2; to: InboundMessageBundleStatusV2; allowed: boolean }> = [];
  for (const from of INBOUND_MESSAGE_BUNDLE_STATUSES_V2) {
    for (const to of INBOUND_MESSAGE_BUNDLE_STATUSES_V2) {
      pairs.push({
        from,
        to,
        allowed: from === to || BUNDLE_STATUS_TRANSITIONS_V2[from].includes(to),
      });
    }
  }
  return pairs;
}
