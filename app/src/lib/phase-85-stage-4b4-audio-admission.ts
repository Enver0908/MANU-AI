import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import { hashProviderMediaId } from "./phase-85-stage-4b3-media-transport";
import type { Stage4B3ImageIngressContext } from "./phase-85-stage-4b3-media-admission";
import {
  COMMUNICATION_LANGUAGE_TO_LOCALE,
  evaluateAudioIngressMetadata,
  STAGE_4B4_MEDIA_RETENTION_DAYS,
  STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY,
  STAGE_4B4_VOICE_RETRIEVAL_EXCLUSIONS,
  type AudioTranscriptionRecord,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";
import type { Stage4B4AudioTransportFailureCode } from "./phase-85-stage-4b4-audio-transport";
import { canonicalizeOggOpusVoiceBytes, type Stage4B4AudioCanonicalizationFailureCode } from "./phase-85-stage-4b4-audio-canonicalizer";
import { buildStage4B4AudioObjectKey, type Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import type { Stage4B4AudioTransportPort } from "./phase-85-stage-4b4-audio-transport";
import type { ManuAppState, MessageRecord } from "./types";

export const STAGE_4B4_AUDIO_ADMISSION_VERSION = "p85-stage-4b4-audio-admission-v1";

export type Stage4B4AudioIngressContext = Stage4B3ImageIngressContext;

export type Stage4B4AudioAdmissionFailureCode =
  | Stage4B4AudioCanonicalizationFailureCode
  | Stage4B4AudioTransportFailureCode
  | "storage_upload_failed"
  | "ingress_metadata_rejected";

function computeMediaExpiresAt(now: Date = new Date()): string {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + STAGE_4B4_MEDIA_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function resolveClientLocale(state: ManuAppState, clientId: string): Stage4B4SupportedLocale {
  const client = state.clients.find((entry) => entry.id === clientId);
  if (!client?.communicationLanguage) {
    return "tr-TR";
  }
  return COMMUNICATION_LANGUAGE_TO_LOCALE[client.communicationLanguage] ?? "tr-TR";
}

export function stageClientAudioIngressMetadata(state: ManuAppState, context: Stage4B4AudioIngressContext): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId || !context.candidate.providerEventId) {
    return state;
  }

  const evaluation = evaluateAudioIngressMetadata({
    messageType: context.candidate.messageType,
    voiceFlag: context.candidate.voiceFlag === true,
    mimeType: context.candidate.declaredMimeType,
    providerMediaId: context.candidate.providerMediaId,
    fromIdentity: context.candidate.fromIdentity,
    isGroupContext: false,
    isForwarded: false,
    isBusinessEcho: false,
    isTrustedDirectClient: true,
    byteSize: context.candidate.byteSize,
    durationMs: context.candidate.durationMs,
    isDuplicateMedia: state.mediaAssets.some(
      (asset) =>
        asset.tenantId === state.tenant.id &&
        asset.providerMediaIdHash === hashProviderMediaId(context.candidate.providerMediaId ?? "") &&
        asset.status !== "failed" &&
        asset.status !== "revoked" &&
        asset.status !== "expired",
    ),
  });

  if (evaluation.decision !== "admitted") {
    return markFailedClientAudioIngress(state, context, "ingress_metadata_rejected");
  }

  const providerMediaId = context.candidate.providerMediaId?.trim() || null;
  if (!providerMediaId) {
    return markFailedClientAudioIngress(state, context, "missing_provider_media_id");
  }

  const declaredMimeType = context.candidate.declaredMimeType;
  if (!declaredMimeType) {
    return markFailedClientAudioIngress(state, context, "ingress_metadata_rejected");
  }

  const message = buildClientVoiceMessage(state, context);
  const asset = buildPendingAudioAsset(state, context, message.id, providerMediaId, declaredMimeType);

  return {
    ...state,
    messages: [...state.messages, message],
    mediaAssets: [...state.mediaAssets, asset],
  };
}

export async function processStage4B4PendingAudioAssets(
  state: ManuAppState,
  options: {
    transport: Stage4B4AudioTransportPort;
    storage: Stage4B4AudioStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  let workingState = state;
  const pendingAssets = workingState.mediaAssets.filter(
    (asset) =>
      asset.tenantId === workingState.tenant.id &&
      asset.mediaKind === "audio" &&
      asset.status === "download_pending",
  );

  for (const asset of pendingAssets) {
    workingState = await admitSinglePendingAudioAsset(workingState, asset.id, options);
  }

  return workingState;
}

export async function admitSinglePendingAudioAsset(
  state: ManuAppState,
  assetId: string,
  options: {
    transport: Stage4B4AudioTransportPort;
    storage: Stage4B4AudioStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  const asset = state.mediaAssets.find((item) => item.id === assetId && item.tenantId === state.tenant.id);
  if (!asset || asset.mediaKind !== "audio" || asset.status !== "download_pending") {
    return state;
  }

  const providerMediaId = asset.providerMediaId;
  if (!providerMediaId) {
    return finalizeFailedAudioAdmission(state, asset.id, "missing_provider_media_id");
  }

  const fetched = await options.transport.fetchProviderMedia(providerMediaId);
  if (!fetched.ok) {
    return finalizeFailedAudioAdmission(state, asset.id, fetched.failureCode);
  }

  const canonical = await canonicalizeOggOpusVoiceBytes({
    bytes: fetched.bytes,
    declaredMimeType: asset.declaredMimeType,
    expectedSha256: asset.contentSha256,
    declaredDurationMs: asset.durationMs,
  });
  if (!canonical.ok) {
    return finalizeFailedAudioAdmission(state, asset.id, canonical.failureCode);
  }

  const objectKey = buildStage4B4AudioObjectKey(asset.tenantId, asset.id);
  try {
    await options.storage.uploadObject(objectKey, canonical.artifacts.wavBytes, "audio/wav");
  } catch {
    return finalizeFailedAudioAdmission(state, asset.id, "storage_upload_failed");
  }

  const storedAt = options.now ?? new Date().toISOString();
  const nextAsset: MediaAssetRecord = {
    ...asset,
    providerMediaId: null,
    providerMediaIdHash: asset.providerMediaIdHash ?? hashProviderMediaId(providerMediaId),
    detectedMimeType: "audio/wav",
    durationMs: canonical.artifacts.durationMs,
    audioCodec: canonical.artifacts.audioCodec,
    audioChannels: canonical.artifacts.audioChannels,
    sampleRateHz: canonical.artifacts.sampleRateHz,
    byteSize: canonical.artifacts.wavBytes.byteLength,
    contentSha256: canonical.artifacts.contentSha256,
    sanitizedAudioObjectKey: objectKey,
    status: "analysis_pending",
    failureCode: null,
    storedAt,
    expiresAt: computeMediaExpiresAt(options.now ? new Date(options.now) : undefined),
    updatedAt: storedAt,
  };

  let nextState = updateMediaAsset(state, asset.id, nextAsset);
  nextState = appendPendingTranscriptionRecord(nextState, nextAsset, storedAt);
  return nextState;
}

function appendPendingTranscriptionRecord(
  state: ManuAppState,
  asset: MediaAssetRecord,
  observedAt: string,
): ManuAppState {
  const bundleItem = state.inboundMessageBundleItems.find(
    (item) => item.tenantId === asset.tenantId && item.mediaAssetId === asset.id,
  );
  const record: AudioTranscriptionRecord = {
    id: crypto.randomUUID(),
    tenantId: asset.tenantId,
    clientId: asset.clientId,
    conversationId: asset.conversationId,
    messageId: asset.messageId,
    mediaAssetId: asset.id,
    bundleId: bundleItem?.bundleId ?? null,
    transcriptionRevision: 1,
    status: "pending",
    locale: resolveClientLocale(state, asset.clientId),
    observation: null,
    qualityDecision: null,
    rejectionReasons: [],
    sourceModality: "voice_transcript",
    providerMode: "mock",
    retrievalEligible: false,
    evidenceExpiresAt: asset.expiresAt ?? null,
    retryCount: 0,
    nextAttemptAt: null,
    failureCode: null,
    createdAt: observedAt,
    updatedAt: observedAt,
  };

  return {
    ...state,
    audioTranscriptionRecords: [...state.audioTranscriptionRecords, record],
    mediaAssets: state.mediaAssets.map((entry) =>
      entry.id === asset.id ? { ...entry, transcriptionId: record.id, updatedAt: observedAt } : entry,
    ),
  };
}

function buildClientVoiceMessage(state: ManuAppState, context: Stage4B4AudioIngressContext): MessageRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: context.routing.conversationId!,
    sender: "client",
    origin: "client_inbound",
    body: STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY,
    status: "stored",
    contentStatus: "available",
    retrievalEligibility: STAGE_4B4_VOICE_RETRIEVAL_EXCLUSIONS[0],
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

function buildPendingAudioAsset(
  state: ManuAppState,
  context: Stage4B4AudioIngressContext,
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
    mediaKind: "audio",
    voiceMessage: true,
    durationMs: context.candidate.durationMs,
    audioCodec: null,
    audioChannels: null,
    sampleRateHz: null,
    sanitizedAudioObjectKey: null,
    transcriptionId: null,
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

function markFailedClientAudioIngress(
  state: ManuAppState,
  context: Stage4B4AudioIngressContext,
  failureCode: Stage4B4AudioAdmissionFailureCode,
): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId || !context.candidate.providerEventId) {
    return state;
  }

  const message = buildClientVoiceMessage(state, context);
  const failedMessage: MessageRecord = {
    ...message,
    contentStatus: "content_unavailable",
    retrievalEligibility: "excluded_unavailable",
  };
  const asset: MediaAssetRecord = {
    ...buildPendingAudioAsset(
      state,
      context,
      message.id,
      context.candidate.providerMediaId?.trim() || "missing",
      context.candidate.declaredMimeType || "audio/ogg; codecs=opus",
    ),
    status: "failed",
    failureCode,
    providerMediaId: null,
  };

  return {
    ...state,
    messages: [...state.messages, failedMessage],
    mediaAssets: [...state.mediaAssets, asset],
  };
}

function finalizeFailedAudioAdmission(
  state: ManuAppState,
  assetId: string,
  failureCode: Stage4B4AudioAdmissionFailureCode,
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
