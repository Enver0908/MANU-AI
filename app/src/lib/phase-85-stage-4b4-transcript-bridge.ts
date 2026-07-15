import {
  countUnicodeCodepoints,
  detectBundleOverflow,
} from "./phase-85-stage-4b3-message-bundles";
import type { InboundMessageBundleRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY,
  type AudioTranscriptionRecord,
} from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState, MessageRecord } from "./types";

export const STAGE_4B4_TRANSCRIPT_BRIDGE_VERSION = "p85-stage-4b4-transcript-bridge-v1";

export type BundleDerivationReadiness =
  | { status: "ready" }
  | { status: "pending" }
  | { status: "failed"; failureCode: string };

export function buildTranscriptBridgeIdempotencyKey(input: {
  conversationId: string;
  mediaAssetId: string;
  transcriptionId: string;
  bundleId: string;
}): string {
  return `voice-bridge:${input.conversationId}:${input.bundleId}:${input.mediaAssetId}:${input.transcriptionId}`;
}

export function isVoiceMessageBridged(message: MessageRecord): boolean {
  return message.body.trim() !== STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY;
}

export function evaluateInboundBundleDerivationReadiness(
  state: ManuAppState,
  bundle: InboundMessageBundleRecord,
): BundleDerivationReadiness {
  const items = state.inboundMessageBundleItems.filter(
    (item) => item.tenantId === state.tenant.id && item.bundleId === bundle.id,
  );

  for (const item of items) {
    if (item.itemType === "voice") {
      const readiness = evaluateVoiceDerivationReadiness(state, item);
      if (readiness.status !== "ready") {
        return readiness;
      }
    }
  }

  return { status: "ready" };
}

export function applyAcceptedTranscriptionBridge(
  state: ManuAppState,
  transcriptionId: string,
  now?: string,
): ManuAppState {
  const record = state.audioTranscriptionRecords.find(
    (entry) => entry.id === transcriptionId && entry.tenantId === state.tenant.id,
  );
  if (!record || record.status !== "accepted" || !record.observation?.transcriptText.trim()) {
    return state;
  }

  const message = state.messages.find(
    (entry) => entry.id === record.messageId && entry.tenantId === state.tenant.id,
  );
  const asset = state.mediaAssets.find(
    (entry) => entry.id === record.mediaAssetId && entry.tenantId === state.tenant.id,
  );
  if (!message || !asset) {
    return state;
  }

  const bundleItem = state.inboundMessageBundleItems.find(
    (entry) =>
      entry.tenantId === state.tenant.id &&
      entry.messageId === record.messageId &&
      entry.itemType === "voice",
  );
  const bundleId = bundleItem?.bundleId ?? record.bundleId;
  if (!bundleId) {
    return state;
  }

  const idempotencyKey = buildTranscriptBridgeIdempotencyKey({
    conversationId: record.conversationId,
    mediaAssetId: record.mediaAssetId,
    transcriptionId: record.id,
    bundleId,
  });
  if (state.processedTranscriptBridgeKeys.includes(idempotencyKey) || isVoiceMessageBridged(message)) {
    return state;
  }

  const observedAt = now ?? new Date().toISOString();
  const transcriptText = record.observation.transcriptText.trim();
  const bridgedMessage: MessageRecord = {
    ...message,
    body: transcriptText,
    contentStatus: "available",
    retrievalEligibility: "eligible",
  };

  let nextState: ManuAppState = {
    ...state,
    messages: state.messages.map((entry) => (entry.id === message.id ? bridgedMessage : entry)),
    inboundMessageBundleItems: state.inboundMessageBundleItems.map((entry) =>
      entry.id === bundleItem?.id
        ? {
            ...entry,
            transcriptionId: record.id,
          }
        : entry,
    ),
    processedTranscriptBridgeKeys: [...state.processedTranscriptBridgeKeys, idempotencyKey],
  };

  nextState = applyBundleUnicodeAfterVoiceBridge(nextState, bundleId, transcriptText, observedAt);
  return nextState;
}

export function processStage4B4AcceptedTranscriptionBridges(
  state: ManuAppState,
  now?: string,
): ManuAppState {
  const observedAt = now ?? new Date().toISOString();
  let workingState = state;
  for (const record of state.audioTranscriptionRecords) {
    if (record.tenantId !== state.tenant.id || record.status !== "accepted") {
      continue;
    }
    workingState = applyAcceptedTranscriptionBridge(workingState, record.id, observedAt);
  }
  return workingState;
}

export function reconcileBundleForVoiceTranscriptionOutcome(
  state: ManuAppState,
  transcriptionId: string,
  now?: string,
): ManuAppState {
  const record = state.audioTranscriptionRecords.find(
    (entry) => entry.id === transcriptionId && entry.tenantId === state.tenant.id,
  );
  if (!record || (record.status !== "failed" && record.status !== "review_required")) {
    return state;
  }

  const bundleId = resolveVoiceBundleId(state, record);
  if (!bundleId) {
    return state;
  }

  const observedAt = now ?? new Date().toISOString();
  const failureCode =
    record.status === "review_required"
      ? record.rejectionReasons[0] ?? "voice_transcription_review_required"
      : record.failureCode ?? "voice_transcription_failed";

  return markBundleReviewRequired(state, bundleId, failureCode, observedAt);
}

function evaluateVoiceDerivationReadiness(
  state: ManuAppState,
  item: { messageId: string; mediaAssetId: string | null; transcriptionId?: string | null },
): BundleDerivationReadiness {
  const asset = state.mediaAssets.find(
    (entry) =>
      entry.tenantId === state.tenant.id &&
      entry.messageId === item.messageId &&
      (item.mediaAssetId ? entry.id === item.mediaAssetId : entry.mediaKind === "audio"),
  );
  if (!asset) {
    return { status: "failed", failureCode: "media_asset_not_found" };
  }
  if (asset.status === "failed" || asset.status === "expired" || asset.status === "revoked") {
    return { status: "failed", failureCode: asset.failureCode ?? "voice_transcription_failed" };
  }

  const transcription =
    state.audioTranscriptionRecords.find(
      (entry) =>
        entry.tenantId === state.tenant.id &&
        (entry.id === item.transcriptionId ||
          entry.id === asset.transcriptionId ||
          entry.mediaAssetId === asset.id),
    ) ?? null;

  if (!transcription) {
    if (asset.status === "download_pending" || asset.status === "analysis_pending") {
      return { status: "pending" };
    }
    return { status: "failed", failureCode: "voice_transcription_missing" };
  }

  if (transcription.status === "pending" || transcription.status === "processing") {
    return { status: "pending" };
  }
  if (transcription.status === "review_required") {
    return {
      status: "failed",
      failureCode: transcription.rejectionReasons[0] ?? "voice_transcription_review_required",
    };
  }
  if (transcription.status === "failed") {
    return {
      status: "failed",
      failureCode: transcription.failureCode ?? "voice_transcription_failed",
    };
  }
  if (transcription.status !== "accepted") {
    return { status: "pending" };
  }

  const message = state.messages.find(
    (entry) => entry.id === item.messageId && entry.tenantId === state.tenant.id,
  );
  if (!message || !isVoiceMessageBridged(message)) {
    return { status: "pending" };
  }

  return { status: "ready" };
}

function resolveVoiceBundleId(state: ManuAppState, record: AudioTranscriptionRecord): string | null {
  if (record.bundleId) {
    return record.bundleId;
  }
  const bundleItem = state.inboundMessageBundleItems.find(
    (entry) =>
      entry.tenantId === state.tenant.id &&
      entry.messageId === record.messageId &&
      entry.itemType === "voice",
  );
  return bundleItem?.bundleId ?? null;
}

function markBundleReviewRequired(
  state: ManuAppState,
  bundleId: string,
  failureCode: string,
  observedAt: string,
): ManuAppState {
  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((bundle) =>
      bundle.id === bundleId &&
      bundle.tenantId === state.tenant.id &&
      (bundle.status === "open" || bundle.status === "ready" || bundle.status === "processing")
        ? {
            ...bundle,
            status: "review_required",
            failureCode,
            leaseExpiresAt: null,
            updatedAt: observedAt,
          }
        : bundle,
    ),
  };
}

function applyBundleUnicodeAfterVoiceBridge(
  state: ManuAppState,
  bundleId: string,
  transcriptText: string,
  observedAt: string,
): ManuAppState {
  const bundle = state.inboundMessageBundles.find(
    (entry) => entry.id === bundleId && entry.tenantId === state.tenant.id,
  );
  if (!bundle) {
    return state;
  }

  const increment = countUnicodeCodepoints(transcriptText);
  const nextCounts = {
    itemCount: bundle.itemCount,
    imageCount: bundle.imageCount,
    audioCount: bundle.audioCount,
    audioDurationMs: bundle.audioDurationMs,
    unicodeCodepointCount: bundle.unicodeCodepointCount + increment,
  };
  const overflow = detectBundleOverflow(bundle, nextCounts);

  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((entry) =>
      entry.id === bundleId
        ? {
            ...entry,
            unicodeCodepointCount: nextCounts.unicodeCodepointCount,
            status: overflow ? "review_required" : entry.status,
            failureCode: overflow ?? entry.failureCode,
            updatedAt: observedAt,
          }
        : entry,
    ),
  };
}
