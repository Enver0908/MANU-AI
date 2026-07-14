import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelEventIngressResult } from "./phase-85-if-c-channel-event-ledger";
import type {
  InboundMessageBundleItemRecord,
  InboundMessageBundleRecord,
  MediaAssetRecord,
} from "./phase-85-stage-4b3-media-contracts";
import {
  findActiveInboundBundle,
  STAGE_4B3_ACTIVE_BUNDLE_STATUSES,
} from "./phase-85-stage-4b3-message-bundles";
import type { AuditEventRecord, ChannelEventRecord, ManuAppState, MessageRecord } from "./types";

export const STAGE_4B3_SUPABASE_CANONICAL_INGRESS_VERSION = "p85-stage-4b3-supabase-canonical-ingress-v1";

export type CanonicalInboundV2CommitResult =
  | { status: "committed"; channelEventId: string; messageId: string; mediaAssetId?: string | null; bundleId?: string | null }
  | { status: "duplicate_event" | "duplicate_content_hash" };

function serializeMessageForCanonicalRpc(message: MessageRecord) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    body: message.body,
    origin: message.origin,
    authorDietitianId: message.authorDietitianId,
    generatedByAiDecisionId: message.generatedByAiDecisionId,
    approvedByDietitianId: message.approvedByDietitianId,
    sourceMessageId: message.sourceMessageId,
    risk: message.risk,
    status: message.status || "stored",
    providerAccountBindingId: message.providerAccountBindingId,
    providerEventId: message.providerEventId,
    providerMessageId: message.providerMessageId,
    actorType: message.actorType,
    actorBindingId: message.actorBindingId,
    authorInterface: message.authorInterface,
    actorResolutionBasis: message.actorResolutionBasis,
    providerSentAt: message.providerSentAt,
    observedAt: message.observedAt,
    persistedAt: message.persistedAt,
    conversationSequence: message.conversationSequence,
    contentStatus: message.contentStatus ?? "available",
    retrievalEligibility: message.retrievalEligibility ?? "eligible",
    createdAt: message.createdAt,
  };
}

function serializeChannelEventForCanonicalRpc(event: ChannelEventRecord) {
  return {
    id: event.id,
    accountBindingId: event.accountBindingId,
    eventKind: event.eventKind,
    processingStatus: event.processingStatus,
    providerAccountId: event.providerAccountId,
    providerEventId: event.providerEventId,
    providerMessageId: event.providerMessageId,
    fromIdentity: event.fromIdentity,
    toIdentity: event.toIdentity,
    counterpartyIdentity: event.counterpartyIdentity,
    payloadDigest: event.payloadDigest,
    payloadSchemaVersion: event.payloadSchemaVersion,
    providerTime: event.providerTime,
    observedAt: event.observedAt,
    committedAt: event.committedAt,
    quarantineId: event.quarantineId,
    replayOfEventId: event.replayOfEventId,
    retryCount: event.retryCount,
  };
}

function serializeMediaAssetForCanonicalRpc(asset: MediaAssetRecord) {
  return {
    id: asset.id,
    clientId: asset.clientId,
    conversationId: asset.conversationId,
    messageId: asset.messageId,
    channelEventId: asset.channelEventId,
    position: asset.position,
    providerMediaId: asset.providerMediaId,
    providerMediaIdHash: asset.providerMediaIdHash,
    declaredMimeType: asset.declaredMimeType,
    detectedMimeType: asset.detectedMimeType,
    width: asset.dimensions?.width ?? null,
    height: asset.dimensions?.height ?? null,
    byteSize: asset.byteSize,
    contentSha256: asset.contentSha256,
    sanitizedFullObjectKey: asset.sanitizedFullObjectKey,
    thumbnailObjectKey: asset.thumbnailObjectKey,
    mediaKind: asset.mediaKind ?? "image",
    voiceMessage: asset.voiceMessage ?? null,
    durationMs: asset.durationMs ?? null,
    audioCodec: asset.audioCodec ?? null,
    audioChannels: asset.audioChannels ?? null,
    sampleRateHz: asset.sampleRateHz ?? null,
    sanitizedAudioObjectKey: asset.sanitizedAudioObjectKey ?? null,
    transcriptionId: asset.transcriptionId ?? null,
    status: asset.status,
    retryCount: asset.retryCount,
    nextAttemptAt: asset.nextAttemptAt,
    leaseExpiresAt: asset.leaseExpiresAt,
    leaseOwner: null,
    storedAt: asset.storedAt,
    expiresAt: asset.expiresAt,
    failureCode: asset.failureCode,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function serializeBundleForCanonicalRpc(bundle: InboundMessageBundleRecord) {
  return {
    id: bundle.id,
    clientId: bundle.clientId,
    conversationId: bundle.conversationId,
    anchorMessageId: bundle.anchorMessageId,
    status: bundle.status,
    openedAt: bundle.openedAt,
    lastEventAt: bundle.lastEventAt,
    readyAt: bundle.readyAt,
    bundleRevision: bundle.bundleRevision,
    conversationRevisionAtOpen: bundle.conversationRevisionAtOpen,
    itemCount: bundle.itemCount,
    imageCount: bundle.imageCount,
    audioCount: bundle.audioCount,
    audioDurationMs: bundle.audioDurationMs,
    unicodeCodepointCount: bundle.unicodeCodepointCount,
    retryCount: bundle.retryCount,
    createdAt: bundle.createdAt,
    updatedAt: bundle.updatedAt,
  };
}

function serializeBundleItemForCanonicalRpc(item: InboundMessageBundleItemRecord) {
  return {
    id: item.id,
    bundleId: item.bundleId,
    messageId: item.messageId,
    channelEventId: item.channelEventId,
    mediaAssetId: item.mediaAssetId,
    ordinal: item.ordinal,
    itemType: item.itemType,
    captionText: item.captionText,
    replyToProviderMessageId: item.replyToProviderMessageId,
    actorType: item.actorType ?? "client",
    senderId: item.senderId ?? null,
    observedAt: item.observedAt,
    transcriptionId: item.transcriptionId ?? null,
    createdAt: item.createdAt,
  };
}

function serializeAuditForCanonicalRpc(audit: AuditEventRecord) {
  return {
    id: audit.id,
    actorType: "system",
    actorId: "stage4b3-canonical-ingress",
    eventType: audit.eventType,
    entityType: audit.entityType,
    entityId: audit.entityId,
    metadata: audit.metadata,
    createdAt: audit.createdAt,
  };
}

export function extractImageIngressDelta(before: ManuAppState, after: ManuAppState) {
  return extractMediaIngressDelta(before, after, "client_message_image");
}

export function extractAudioIngressDelta(before: ManuAppState, after: ManuAppState) {
  return extractMediaIngressDelta(before, after, "client_message_audio");
}

function extractMediaIngressDelta(
  before: ManuAppState,
  after: ManuAppState,
  eventKind: "client_message_image" | "client_message_audio",
) {
  const newMessages = after.messages.filter((message) => !before.messages.some((item) => item.id === message.id));
  const newAssets = after.mediaAssets.filter((asset) => !before.mediaAssets.some((item) => item.id === asset.id));
  const newBundles = after.inboundMessageBundles.filter(
    (bundle) => !before.inboundMessageBundles.some((item) => item.id === bundle.id),
  );
  const newBundleItems = after.inboundMessageBundleItems.filter(
    (item) => !before.inboundMessageBundleItems.some((entry) => entry.id === item.id),
  );
  const newChannelEvents = after.channelEvents.filter((event) => !before.channelEvents.some((item) => item.id === event.id));
  const newAudits = after.auditEvents.filter((audit) => !before.auditEvents.some((item) => item.id === audit.id));

  const imageMessage = newMessages.find((message) => message.origin === "client_inbound") ?? null;
  const mediaAsset = newAssets[0] ?? null;
  const channelEvent =
    newChannelEvents.find((event) => event.eventKind === eventKind) ?? newChannelEvents[0] ?? null;
  const bundleItem = newBundleItems[0] ?? null;
  const openedBundle = newBundles[0] ?? null;
  const appendedBundle =
    openedBundle ??
    (bundleItem
      ? after.inboundMessageBundles.find((bundle) => bundle.id === bundleItem.bundleId) ?? null
      : imageMessage
        ? findActiveInboundBundle(after, imageMessage.conversationId)
        : null);

  if (!channelEvent || !imageMessage) {
    return null;
  }

  const bundleAction = openedBundle ? "open" : appendedBundle ? "append" : null;
  const audit = newAudits.find((event) => event.eventType === "channel_event_committed") ?? null;

  return {
    channelEvent,
    message: imageMessage,
    mediaAsset,
    bundle: appendedBundle,
    bundleItem,
    bundleAction,
    audit,
  };
}

export function ingressIncludesStage4B3ImageCommit(ingress: ChannelEventIngressResult): boolean {
  return ingress.ok && ingress.outcomes.some((outcome) => outcome.event.eventKind === "client_message_image");
}

export function ingressIncludesStage4B4AudioCommit(ingress: ChannelEventIngressResult): boolean {
  return ingress.ok && ingress.outcomes.some((outcome) => outcome.event.eventKind === "client_message_audio");
}

export async function commitStage4B4CanonicalInboundV3(
  supabase: SupabaseClient,
  tenantId: string,
  before: ManuAppState,
  after: ManuAppState,
): Promise<CanonicalInboundV2CommitResult> {
  const delta =
    extractAudioIngressDelta(before, after) ?? extractImageIngressDelta(before, after);
  if (!delta?.channelEvent || !delta.message) {
    throw new Error("canonical_inbound_media_delta_missing");
  }

  const payload = {
    bundleAction: delta.bundleAction,
    channelEvent: serializeChannelEventForCanonicalRpc(delta.channelEvent),
    message: serializeMessageForCanonicalRpc(delta.message),
    mediaAsset: delta.mediaAsset ? serializeMediaAssetForCanonicalRpc(delta.mediaAsset) : null,
    bundle: delta.bundle ? serializeBundleForCanonicalRpc(delta.bundle) : null,
    bundleItem: delta.bundleItem ? serializeBundleItemForCanonicalRpc(delta.bundleItem) : null,
    auditEvent: delta.audit ? serializeAuditForCanonicalRpc(delta.audit) : null,
  };

  const { data, error } = await supabase.rpc("p85_stage_4b4_commit_canonical_inbound_v3", {
    p_tenant_id: tenantId,
    p_payload: payload,
  });
  if (error) {
    throw error;
  }

  const status = typeof data?.status === "string" ? data.status : "committed";
  if (status === "duplicate_event" || status === "duplicate_content_hash") {
    return { status };
  }

  return {
    status: "committed",
    channelEventId: String(data?.channelEventId ?? delta.channelEvent.id),
    messageId: String(data?.messageId ?? delta.message.id),
    mediaAssetId: data?.mediaAssetId ? String(data.mediaAssetId) : delta.mediaAsset?.id ?? null,
    bundleId: data?.bundleId ? String(data.bundleId) : delta.bundle?.id ?? null,
  };
}

export async function commitStage4B3CanonicalInboundV2(
  supabase: SupabaseClient,
  tenantId: string,
  before: ManuAppState,
  after: ManuAppState,
): Promise<CanonicalInboundV2CommitResult> {
  const delta = extractImageIngressDelta(before, after);
  if (!delta?.channelEvent || !delta.message) {
    throw new Error("canonical_inbound_image_delta_missing");
  }

  const payload = {
    bundleAction: delta.bundleAction,
    channelEvent: serializeChannelEventForCanonicalRpc(delta.channelEvent),
    message: serializeMessageForCanonicalRpc(delta.message),
    mediaAsset: delta.mediaAsset ? serializeMediaAssetForCanonicalRpc(delta.mediaAsset) : null,
    bundle: delta.bundle ? serializeBundleForCanonicalRpc(delta.bundle) : null,
    bundleItem: delta.bundleItem ? serializeBundleItemForCanonicalRpc(delta.bundleItem) : null,
    auditEvent: delta.audit ? serializeAuditForCanonicalRpc(delta.audit) : null,
  };

  const { data, error } = await supabase.rpc("p85_stage_4b3_commit_canonical_inbound_v2", {
    p_tenant_id: tenantId,
    p_payload: payload,
  });
  if (error) {
    throw error;
  }

  const status = typeof data?.status === "string" ? data.status : "committed";
  if (status === "duplicate_event" || status === "duplicate_content_hash") {
    return { status };
  }

  return {
    status: "committed",
    channelEventId: String(data?.channelEventId ?? delta.channelEvent.id),
    messageId: String(data?.messageId ?? delta.message.id),
    mediaAssetId: data?.mediaAssetId ? String(data.mediaAssetId) : delta.mediaAsset?.id ?? null,
    bundleId: data?.bundleId ? String(data.bundleId) : delta.bundle?.id ?? null,
  };
}

export function hasActiveStage4B3Bundle(state: ManuAppState, conversationId: string): boolean {
  return state.inboundMessageBundles.some(
    (bundle) =>
      bundle.conversationId === conversationId &&
      STAGE_4B3_ACTIVE_BUNDLE_STATUSES.includes(bundle.status as (typeof STAGE_4B3_ACTIVE_BUNDLE_STATUSES)[number]),
  );
}
