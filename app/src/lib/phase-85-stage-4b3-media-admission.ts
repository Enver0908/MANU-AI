import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelEventRoutedOutcome } from "./phase-85-if-c-channel-event-routing";
import {
  STAGE_4B3_MEDIA_RETRIEVAL_EXCLUSIONS,
  type MediaAssetRecord,
} from "./phase-85-stage-4b3-media-contracts";
import {
  buildStage4B3MediaObjectKeys,
  validateAndSanitizeImageBytes,
  validateCaptionLength,
  type Stage4B3MediaAdmissionFailureCode,
} from "./phase-85-stage-4b3-image-admission";
import type { Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";
import { uploadSanitizedMediaObjectsWithRollback } from "./phase-85-stage-4b3-durable-media-admission";
import { hashProviderMediaId, type Stage4B3MediaTransportPort } from "./phase-85-stage-4b3-media-transport";
import type { ManuAppState, MessageRecord } from "./types";

export const STAGE_4B3_MEDIA_ADMISSION_VERSION = "p85-stage-4b3-media-admission-v1";
export const STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER = "[client image]";

export type Stage4B3ImageIngressContext = {
  candidate: RawChannelEventCandidate;
  routing: Extract<ChannelEventRoutedOutcome, { status: "routed" }>;
  channelEventId: string;
  observedAt: string;
};

export function stageClientImageIngressMetadata(
  state: ManuAppState,
  context: Stage4B3ImageIngressContext,
): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId || !context.candidate.providerEventId) {
    return state;
  }

  const captionFailure = validateCaptionLength(context.candidate.caption);
  if (captionFailure) {
    return markFailedClientImageIngress(state, context, captionFailure.failureCode);
  }

  const providerMediaId = context.candidate.providerMediaId?.trim() || null;
  if (!providerMediaId) {
    return markFailedClientImageIngress(state, context, "missing_provider_media_id");
  }

  const declaredMimeType = context.candidate.declaredMimeType;
  if (!declaredMimeType) {
    return markFailedClientImageIngress(state, context, "unsupported_mime");
  }

  const message = buildClientImageMessage(state, context);
  const asset = buildPendingMediaAsset(state, context, message.id, providerMediaId, declaredMimeType);

  return {
    ...state,
    messages: [...state.messages, message],
    mediaAssets: [...state.mediaAssets, asset],
  };
}

export async function processStage4B3PendingMediaAssets(
  state: ManuAppState,
  options: {
    transport: Stage4B3MediaTransportPort;
    storage: Stage4B3MediaStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  let workingState = state;
  const pendingAssets = workingState.mediaAssets.filter(
    (asset) => asset.tenantId === workingState.tenant.id && asset.status === "download_pending",
  );

  for (const asset of pendingAssets) {
    workingState = await admitSinglePendingMediaAsset(workingState, asset.id, options);
  }

  return workingState;
}

export async function admitSinglePendingMediaAsset(
  state: ManuAppState,
  assetId: string,
  options: {
    transport: Stage4B3MediaTransportPort;
    storage: Stage4B3MediaStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  const asset = state.mediaAssets.find((item) => item.id === assetId && item.tenantId === state.tenant.id);
  if (!asset || asset.status !== "download_pending") {
    return state;
  }

  const providerMediaId = asset.providerMediaId;
  if (!providerMediaId) {
    return updateMediaAsset(state, asset.id, {
      status: "failed",
      failureCode: "missing_provider_media_id",
    });
  }

  const fetched = await options.transport.fetchProviderMedia(providerMediaId);
  if (!fetched.ok) {
    return finalizeFailedAdmission(state, asset.id, fetched.failureCode);
  }

  const sanitized = await validateAndSanitizeImageBytes({
    bytes: fetched.bytes,
    declaredMimeType: asset.declaredMimeType,
    expectedSha256: asset.contentSha256,
    now: options.now ? new Date(options.now) : undefined,
  });
  if (!sanitized.ok) {
    return finalizeFailedAdmission(state, asset.id, sanitized.failureCode);
  }

  const objectKeys = buildStage4B3MediaObjectKeys(asset.tenantId, asset.id);
  try {
    await uploadSanitizedMediaObjectsWithRollback({
      storage: options.storage,
      tenantId: asset.tenantId,
      assetId: asset.id,
      artifacts: sanitized.artifacts,
    });
  } catch {
    return finalizeFailedAdmission(state, asset.id, "storage_upload_failed");
  }

  const storedAt = options.now ?? new Date().toISOString();
  const nextAsset: MediaAssetRecord = {
    ...asset,
    providerMediaId: null,
    providerMediaIdHash: asset.providerMediaIdHash ?? hashProviderMediaId(providerMediaId),
    detectedMimeType: sanitized.artifacts.detectedMimeType,
    dimensions: sanitized.artifacts.dimensions,
    byteSize: sanitized.artifacts.sanitizedFullBytes.byteLength,
    contentSha256: sanitized.artifacts.contentSha256,
    sanitizedFullObjectKey: objectKeys.sanitizedFullObjectKey,
    thumbnailObjectKey: objectKeys.thumbnailObjectKey,
    status: "sanitized",
    failureCode: null,
    storedAt,
    expiresAt: sanitized.artifacts.expiresAt,
    updatedAt: storedAt,
  };

  return updateMediaAsset(state, asset.id, nextAsset);
}

function buildClientImageMessage(state: ManuAppState, context: Stage4B3ImageIngressContext): MessageRecord {
  const body = context.candidate.caption?.trim() || STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER;
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: context.routing.conversationId!,
    sender: "client",
    origin: "client_inbound",
    body,
    status: "stored",
    contentStatus: "available",
    retrievalEligibility: STAGE_4B3_MEDIA_RETRIEVAL_EXCLUSIONS[0],
    providerAccountBindingId: context.routing.accountBindingId,
    providerEventId: context.candidate.providerEventId,
    providerMessageId: context.candidate.providerMessageId ?? context.candidate.providerEventId,
    actorType: "client",
    actorBindingId: null,
    authorInterface: "client_channel",
    actorResolutionBasis: "provider_counterparty",
    providerSentAt: context.candidate.providerTime,
    observedAt: context.observedAt,
    persistedAt: context.observedAt,
    createdAt: context.observedAt,
  };
}

function buildPendingMediaAsset(
  state: ManuAppState,
  context: Stage4B3ImageIngressContext,
  messageId: string,
  providerMediaId: string,
  declaredMimeType: string,
): MediaAssetRecord {
  const now = context.observedAt;
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: context.routing.clientId!,
    conversationId: context.routing.conversationId!,
    messageId,
    channelEventId: context.channelEventId,
    position: 1,
    providerMediaId,
    providerMediaIdHash: hashProviderMediaId(providerMediaId),
    declaredMimeType,
    detectedMimeType: null,
    dimensions: null,
    byteSize: context.candidate.byteSize,
    contentSha256: context.candidate.payloadSha256,
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: null,
    status: "download_pending",
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: null,
    expiresAt: null,
    deletedAt: null,
    failureCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

function markFailedClientImageIngress(
  state: ManuAppState,
  context: Stage4B3ImageIngressContext,
  failureCode: Stage4B3MediaAdmissionFailureCode,
): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId || !context.candidate.providerEventId) {
    return state;
  }

  const message = buildClientImageMessage(state, context);
  const failedMessage: MessageRecord = {
    ...message,
    contentStatus: "content_unavailable",
    retrievalEligibility: "excluded_unavailable",
  };
  const asset = {
    ...buildPendingMediaAsset(
      state,
      context,
      message.id,
      context.candidate.providerMediaId?.trim() || "missing",
      context.candidate.declaredMimeType || "image/jpeg",
    ),
    status: "failed" as const,
    failureCode,
    providerMediaId: null,
  };

  return {
    ...state,
    messages: [...state.messages, failedMessage],
    mediaAssets: [...state.mediaAssets, asset],
  };
}

function finalizeFailedAdmission(
  state: ManuAppState,
  assetId: string,
  failureCode: Stage4B3MediaAdmissionFailureCode,
): ManuAppState {
  const asset = state.mediaAssets.find((item) => item.id === assetId);
  if (!asset) {
    return state;
  }

  let nextState = updateMediaAsset(state, assetId, {
    status: "failed",
    failureCode,
    providerMediaId: null,
  });

  nextState = {
    ...nextState,
    messages: nextState.messages.map((message) =>
      message.id === asset.messageId
        ? {
            ...message,
            contentStatus: "content_unavailable",
            retrievalEligibility: "excluded_unavailable",
          }
        : message,
    ),
  };

  return nextState;
}

function updateMediaAsset(
  state: ManuAppState,
  assetId: string,
  patch: Partial<MediaAssetRecord> | MediaAssetRecord,
): ManuAppState {
  return {
    ...state,
    mediaAssets: state.mediaAssets.map((asset) =>
      asset.id === assetId
        ? {
            ...asset,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : asset,
    ),
  };
}
