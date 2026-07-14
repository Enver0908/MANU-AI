import { AppDomainError } from "./app-errors";
import type {
  ConversationActorContext,
  ConversationMessageDto,
  ConversationPermissions,
  ConversationProjectionMessage,
} from "./phase-85-stage-4b2-contracts";
import { CONVERSATION_UNAVAILABLE_PREVIEW } from "./phase-85-stage-4b2-contracts";
import {
  assertClientSafeMediaPayload,
  buildConversationMediaDto,
  buildVisualReviewDto,
  resolveVisualReviewState,
  STAGE_4B3_MEDIA_RETRIEVAL_EXCLUSIONS,
  type ConversationMediaDto,
  type InboundMessageBundleRecord,
  type MediaAssetRecord,
  type Stage4B3MediaStateSlice,
  type VisualAnalysisRecord,
  type VisualCorrectionRecord,
  type VisualCorrectionRequest,
  type VisualReviewDto,
} from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState, MessageRetrievalEligibility, TenantRole } from "./types";

export const STAGE_4B3_BOUNDED_MEDIA_VERSION = "p85-stage-4b3-bounded-media-v2";
export const STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL = "Görsel";
export const STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL = "private, no-store";
export const STAGE_4B3_MEDIA_STREAM_FILENAME = "image.jpg";

export type Stage4B3ConversationMediaProjectionSource = Pick<
  Stage4B3MediaStateSlice,
  "mediaAssets" | "visualAnalysisRecords" | "inboundMessageBundles" | "visualCorrections"
>;

export type ConversationMediaStreamVariant = "thumbnail" | "full";

const MEDIA_RETRIEVAL_EXCLUSION_SET = new Set<string>(STAGE_4B3_MEDIA_RETRIEVAL_EXCLUSIONS);

export function buildStage4B3MediaProjectionSourceFromState(
  state: ManuAppState,
): Stage4B3ConversationMediaProjectionSource {
  return {
    mediaAssets: state.mediaAssets,
    visualAnalysisRecords: state.visualAnalysisRecords,
    inboundMessageBundles: state.inboundMessageBundles,
    visualCorrections: state.visualCorrections,
  };
}

export function filterStage4B3MediaProjectionForConversation(
  source: Stage4B3ConversationMediaProjectionSource,
  tenantId: string,
  conversationId: string,
): Stage4B3ConversationMediaProjectionSource {
  return {
    mediaAssets: source.mediaAssets.filter(
      (asset) => asset.tenantId === tenantId && asset.conversationId === conversationId,
    ),
    visualAnalysisRecords: source.visualAnalysisRecords.filter(
      (record) => record.tenantId === tenantId && record.conversationId === conversationId,
    ),
    inboundMessageBundles: source.inboundMessageBundles.filter(
      (bundle) => bundle.tenantId === tenantId && bundle.conversationId === conversationId,
    ),
    visualCorrections: source.visualCorrections.filter(
      (correction) => correction.tenantId === tenantId && correction.conversationId === conversationId,
    ),
  };
}

export function isMediaExcludedRetrievalEligibility(
  value: MessageRetrievalEligibility | null | undefined,
): boolean {
  return value != null && MEDIA_RETRIEVAL_EXCLUSION_SET.has(value);
}

export function isMediaOnlyConversationMessage(
  message: Pick<ConversationProjectionMessage, "body" | "retrievalEligibility">,
): boolean {
  if (isMediaExcludedRetrievalEligibility(message.retrievalEligibility)) {
    return true;
  }
  const compact = message.body.trim();
  return compact === "[client image]" || compact === "[gorsel]";
}

export function resolveConversationListMediaPreview(
  message: ConversationProjectionMessage | null,
  media?: Stage4B3ConversationMediaProjectionSource,
): string {
  if (!message) return "";
  if (isMediaOnlyConversationMessage(message)) {
    return STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL;
  }
  if (media?.mediaAssets.some((asset) => asset.messageId === message.id)) {
    return STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL;
  }
  return "";
}

export function resolveVisualReviewDtoState(input: {
  asset: MediaAssetRecord;
  analysis: VisualAnalysisRecord | null;
  bundle: InboundMessageBundleRecord | null;
  latestCorrection: VisualCorrectionRecord | null;
}): VisualReviewDto["reviewState"] {
  if (input.latestCorrection?.status === "manual_follow_up_required") {
    return "corrected";
  }
  if (input.latestCorrection?.status === "closed") {
    return "closed";
  }
  if (input.latestCorrection) {
    return "corrected";
  }
  if (input.bundle?.status === "review_required") {
    return "required";
  }
  if (
    input.asset.status === "analysis_pending" ||
    input.analysis?.status === "pending" ||
    input.bundle?.status === "processing" ||
    input.bundle?.status === "ready"
  ) {
    return "pending";
  }
  if (input.asset.status === "failed" || input.analysis?.status === "failed") {
    return "required";
  }
  return "closed";
}

function findBundleForMessage(
  bundles: readonly InboundMessageBundleRecord[],
  messageId: string,
): InboundMessageBundleRecord | null {
  return (
    bundles.find((bundle) => bundle.anchorMessageId === messageId) ??
    bundles.find((bundle) =>
      bundle.status !== "superseded" && bundle.status !== "decided" && bundle.status !== "completed"
        ? bundle.anchorMessageId === messageId
        : false,
    ) ??
    null
  );
}

function findLatestAnalysisForAsset(
  analyses: readonly VisualAnalysisRecord[],
  assetId: string,
): VisualAnalysisRecord | null {
  const matches = analyses
    .filter((record) => record.mediaAssetId === assetId && record.status !== "superseded")
    .sort((left, right) => right.analysisRevision - left.analysisRevision);
  return matches[0] ?? null;
}

function findLatestCorrectionForAnalysis(
  corrections: readonly VisualCorrectionRecord[],
  analysisId: string,
): VisualCorrectionRecord | null {
  const matches = corrections
    .filter((correction) => correction.analysisId === analysisId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return matches[0] ?? null;
}

export function projectMessageMediaDto(
  messageId: string,
  media: Stage4B3ConversationMediaProjectionSource | undefined,
): ConversationMediaDto[] {
  if (!media) return [];
  const assets = media.mediaAssets.filter((asset) => asset.messageId === messageId);
  return assets.map((asset) => {
    const analysis = findLatestAnalysisForAsset(media.visualAnalysisRecords, asset.id);
    const bundle =
      analysis?.bundleId != null
        ? media.inboundMessageBundles.find((entry) => entry.id === analysis.bundleId) ?? null
        : findBundleForMessage(media.inboundMessageBundles, messageId);
    const reviewState = resolveVisualReviewState({
      assetStatus: asset.status,
      analysisStatus: analysis?.status ?? null,
      bundleStatus: bundle?.status ?? null,
    });
    return buildConversationMediaDto(asset, reviewState);
  });
}

export function projectMessageVisualReview(
  messageId: string,
  actor: ConversationActorContext,
  media: Stage4B3ConversationMediaProjectionSource | undefined,
): VisualReviewDto | null {
  if (!media) return null;
  const asset = media.mediaAssets.find((entry) => entry.messageId === messageId);
  if (!asset) return null;
  const analysis = findLatestAnalysisForAsset(media.visualAnalysisRecords, asset.id);
  if (!analysis?.observation) return null;
  const bundle =
    analysis.bundleId != null
      ? media.inboundMessageBundles.find((entry) => entry.id === analysis.bundleId) ?? null
      : findBundleForMessage(media.inboundMessageBundles, messageId);
  const latestCorrection = findLatestCorrectionForAnalysis(media.visualCorrections, analysis.id);
  return buildVisualReviewDto({
    role: actor.role,
    analysis,
    reviewState: resolveVisualReviewDtoState({ asset, analysis, bundle, latestCorrection }),
    latestCorrectionId: latestCorrection?.id ?? null,
  });
}

export function projectConversationMessageWithMedia(
  message: ConversationProjectionMessage,
  actor: ConversationActorContext,
  media: Stage4B3ConversationMediaProjectionSource | undefined,
  base: ConversationMessageDto,
): ConversationMessageDto {
  const mediaItems = projectMessageMediaDto(message.id, media);
  const visualReview = projectMessageVisualReview(message.id, actor, media);
  const dto: ConversationMessageDto = {
    ...base,
    media: mediaItems,
    visualReview,
  };
  assertClientSafeMediaPayload(dto);
  return dto;
}

export function canSubmitVisualCorrection(role: TenantRole): boolean {
  return role === "owner" || role === "admin" || role === "dietitian";
}

export function assertVisualCorrectionAllowed(permissions: ConversationPermissions, role: TenantRole) {
  if (!permissions.canRead || !permissions.canMutateConversation) {
    throw new AppDomainError(403, "visual_correction_forbidden");
  }
  if (!canSubmitVisualCorrection(role)) {
    throw new AppDomainError(403, "visual_correction_forbidden");
  }
}

export function parseVisualCorrectionMutationBody(body: unknown): VisualCorrectionRequest {
  if (!body || typeof body !== "object") {
    throw new AppDomainError(400, "invalid_request_body");
  }
  const record = body as Record<string, unknown>;
  const analysisId = typeof record.analysisId === "string" ? record.analysisId.trim() : "";
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const reasonCode = typeof record.reasonCode === "string" ? record.reasonCode.trim() : "";
  const explanation = typeof record.explanation === "string" ? record.explanation.trim() : "";
  const expectedConversationRevision = record.expectedConversationRevision;
  const expectedAnalysisRevision = record.expectedAnalysisRevision;

  if (!analysisId) throw new AppDomainError(400, "visual_correction_analysis_id_required");
  if (!requestId) throw new AppDomainError(400, "visual_correction_request_id_required");
  if (!reasonCode) throw new AppDomainError(400, "visual_correction_reason_required");
  if (!explanation) throw new AppDomainError(400, "visual_correction_explanation_required");
  if (
    typeof expectedConversationRevision !== "number" ||
    !Number.isInteger(expectedConversationRevision) ||
    expectedConversationRevision < 1
  ) {
    throw new AppDomainError(400, "visual_correction_conversation_revision_invalid");
  }
  if (
    typeof expectedAnalysisRevision !== "number" ||
    !Number.isInteger(expectedAnalysisRevision) ||
    expectedAnalysisRevision < 1
  ) {
    throw new AppDomainError(400, "visual_correction_analysis_revision_invalid");
  }

  return {
    analysisId,
    requestId,
    expectedConversationRevision,
    expectedAnalysisRevision,
    reasonCode: reasonCode as VisualCorrectionRequest["reasonCode"],
    explanation,
    correctedSceneType:
      typeof record.correctedSceneType === "string"
        ? (record.correctedSceneType as VisualCorrectionRequest["correctedSceneType"])
        : null,
    correctedOcrText: typeof record.correctedOcrText === "string" ? record.correctedOcrText : null,
    correctedEntityLabels: Array.isArray(record.correctedEntityLabels)
      ? record.correctedEntityLabels.filter((entry): entry is string => typeof entry === "string")
      : undefined,
  };
}

export function parseConversationMediaStreamVariant(
  value: string | null | undefined,
): ConversationMediaStreamVariant {
  if (value === "full") return "full";
  return "thumbnail";
}

export function assertConversationMediaReadable(
  permissions: ConversationPermissions,
  asset: Pick<MediaAssetRecord, "conversationId">,
  conversationId: string,
) {
  if (!permissions.canRead || !permissions.canViewTranscript) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  if (asset.conversationId !== conversationId) {
    throw new AppDomainError(404, "media_asset_not_found");
  }
}

export function resolveMediaStreamHttpStatus(
  asset: Pick<
    MediaAssetRecord,
    "status" | "thumbnailObjectKey" | "sanitizedFullObjectKey" | "deletedAt"
  >,
  variant: ConversationMediaStreamVariant,
): 200 | 404 | 410 {
  if (asset.deletedAt) {
    return 410;
  }
  if (asset.status === "expired" || asset.status === "revoked") {
    return 410;
  }
  const objectKey = resolveMediaStreamObjectKey(asset, variant);
  if (!objectKey) {
    return 410;
  }
  return 200;
}

export function resolveMediaStreamObjectKey(
  asset: Pick<
    MediaAssetRecord,
    "thumbnailObjectKey" | "sanitizedFullObjectKey" | "status" | "deletedAt"
  >,
  variant: ConversationMediaStreamVariant,
): string | null {
  if (asset.deletedAt || asset.status === "expired" || asset.status === "revoked") {
    return null;
  }
  if (variant === "thumbnail") {
    return asset.thumbnailObjectKey ?? asset.sanitizedFullObjectKey;
  }
  return asset.sanitizedFullObjectKey ?? asset.thumbnailObjectKey;
}

export function resolveMediaStreamContentType(
  asset: Pick<MediaAssetRecord, "detectedMimeType" | "declaredMimeType">,
  variant: ConversationMediaStreamVariant,
): string {
  if (variant === "thumbnail") {
    return "image/jpeg";
  }
  return asset.detectedMimeType ?? asset.declaredMimeType ?? "image/jpeg";
}

export function buildConversationMediaStreamHeaders(contentType: string) {
  return {
    "Cache-Control": STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${STAGE_4B3_MEDIA_STREAM_FILENAME}"`,
  };
}

export function resolveConversationMessageBodyWithMedia(message: ConversationMessageDto): string {
  if (message.media.length > 0 && (!message.body || message.body.trim() === "[client image]")) {
    return STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL;
  }
  if (!message.body?.trim()) {
    return CONVERSATION_UNAVAILABLE_PREVIEW;
  }
  return message.body;
}
