import { parseVisualObservationV1, type VisualObservationV1 } from "./phase-85-stage-4b3-media-contracts";
import type {
  InboundMessageBundleItemRecord,
  InboundMessageBundleRecord,
  MediaAssetRecord,
  VisualAnalysisRecord,
  VisualCorrectionRecord,
} from "./types";

export type DbMediaAsset = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  message_id: string;
  channel_event_id: string | null;
  position: number;
  provider_media_id: string | null;
  provider_media_id_hash: string | null;
  declared_mime_type: string;
  detected_mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  content_sha256: string | null;
  sanitized_full_object_key: string | null;
  thumbnail_object_key: string | null;
  media_kind?: "image" | "audio" | null;
  voice_message?: boolean | null;
  duration_ms?: number | null;
  audio_codec?: string | null;
  audio_channels?: number | null;
  sample_rate_hz?: number | null;
  sanitized_audio_object_key?: string | null;
  transcription_id?: string | null;
  status: MediaAssetRecord["status"];
  retry_count: number;
  next_attempt_at: string | null;
  lease_expires_at: string | null;
  lease_owner: string | null;
  stored_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};

export type DbVisualAnalysisRecord = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  media_asset_id: string;
  message_id: string;
  bundle_id: string | null;
  analysis_revision: number;
  status: VisualAnalysisRecord["status"];
  observation: VisualObservationV1 | null;
  superseded_by_analysis_id: string | null;
  failure_code: string | null;
  retrieval_eligible?: boolean | null;
  evidence_expires_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DbInboundMessageBundle = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  anchor_message_id: string;
  status: InboundMessageBundleRecord["status"];
  opened_at: string;
  last_event_at: string;
  ready_at: string;
  bundle_revision: number;
  conversation_revision_at_open: number;
  item_count: number;
  image_count: number;
  audio_count?: number | null;
  audio_duration_ms?: number | null;
  unicode_codepoint_count: number;
  retry_count: number;
  next_attempt_at: string | null;
  lease_expires_at: string | null;
  lease_owner: string | null;
  decision_id: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};

export type DbInboundMessageBundleItem = {
  id: string;
  tenant_id: string;
  bundle_id: string;
  message_id: string;
  channel_event_id: string | null;
  media_asset_id: string | null;
  transcription_id?: string | null;
  ordinal: number;
  item_type: InboundMessageBundleItemRecord["itemType"];
  caption_text: string | null;
  reply_to_provider_message_id: string | null;
  actor_type?: string | null;
  sender_id?: string | null;
  reply_to_message_id?: string | null;
  observed_at: string;
  created_at: string;
};

export type DbVisualCorrection = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  analysis_id: string;
  dietitian_id: string;
  status: VisualCorrectionRecord["status"];
  reason_code: VisualCorrectionRecord["reasonCode"];
  explanation: string;
  corrected_scene_type: VisualCorrectionRecord["correctedSceneType"];
  corrected_ocr_text: string | null;
  corrected_entity_labels: string[];
  conversation_revision_at_submit: number;
  analysis_revision_at_submit: number;
  result_action: VisualCorrectionRecord["resultAction"];
  created_at: string;
  updated_at: string;
};

function parseObservation(value: unknown): VisualObservationV1 | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  try {
    return parseVisualObservationV1(value);
  } catch {
    return null;
  }
}

export function mapMediaAsset(row: DbMediaAsset): MediaAssetRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    channelEventId: row.channel_event_id ?? "",
    position: row.position,
    providerMediaId: row.provider_media_id,
    providerMediaIdHash: row.provider_media_id_hash,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    dimensions:
      row.width !== null && row.height !== null ? { width: row.width, height: row.height } : null,
    byteSize: row.byte_size,
    contentSha256: row.content_sha256,
    sanitizedFullObjectKey: row.sanitized_full_object_key,
    thumbnailObjectKey: row.thumbnail_object_key,
    mediaKind: row.media_kind ?? "image",
    voiceMessage: row.voice_message ?? null,
    durationMs: row.duration_ms ?? null,
    audioCodec: row.audio_codec ?? null,
    audioChannels: row.audio_channels ?? null,
    sampleRateHz: row.sample_rate_hz ?? null,
    sanitizedAudioObjectKey: row.sanitized_audio_object_key ?? null,
    transcriptionId: row.transcription_id ?? null,
    status: row.status,
    retryCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    leaseExpiresAt: row.lease_expires_at,
    storedAt: row.stored_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVisualAnalysisRecord(row: DbVisualAnalysisRecord): VisualAnalysisRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    mediaAssetId: row.media_asset_id,
    messageId: row.message_id,
    bundleId: row.bundle_id,
    analysisRevision: row.analysis_revision,
    status: row.status,
    observation: parseObservation(row.observation),
    supersededByAnalysisId: row.superseded_by_analysis_id,
    failureCode: row.failure_code,
    retrievalEligible: row.retrieval_eligible ?? true,
    evidenceExpiresAt: row.evidence_expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInboundMessageBundle(row: DbInboundMessageBundle): InboundMessageBundleRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    anchorMessageId: row.anchor_message_id,
    status: row.status,
    openedAt: row.opened_at,
    lastEventAt: row.last_event_at,
    readyAt: row.ready_at,
    bundleRevision: row.bundle_revision,
    conversationRevisionAtOpen: row.conversation_revision_at_open,
    itemCount: row.item_count,
    imageCount: row.image_count,
    audioCount: row.audio_count ?? 0,
    audioDurationMs: row.audio_duration_ms ?? 0,
    unicodeCodepointCount: row.unicode_codepoint_count,
    retryCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    leaseExpiresAt: row.lease_expires_at,
    decisionId: row.decision_id,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInboundMessageBundleItem(row: DbInboundMessageBundleItem): InboundMessageBundleItemRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bundleId: row.bundle_id,
    messageId: row.message_id,
    channelEventId: row.channel_event_id,
    mediaAssetId: row.media_asset_id,
    transcriptionId: row.transcription_id ?? null,
    ordinal: row.ordinal,
    itemType: row.item_type,
    captionText: row.caption_text,
    replyToProviderMessageId: row.reply_to_provider_message_id,
    actorType:
      row.actor_type === "client" || row.actor_type === "dietitian" || row.actor_type === "system"
        ? row.actor_type
        : undefined,
    senderId: row.sender_id ?? undefined,
    replyToMessageId: row.reply_to_message_id ?? null,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
}

export function mapVisualCorrection(row: DbVisualCorrection): VisualCorrectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    analysisId: row.analysis_id,
    dietitianId: row.dietitian_id,
    status: row.status,
    reasonCode: row.reason_code,
    explanation: row.explanation,
    correctedSceneType: row.corrected_scene_type,
    correctedOcrText: row.corrected_ocr_text,
    correctedEntityLabels: row.corrected_entity_labels,
    conversationRevisionAtSubmit: row.conversation_revision_at_submit,
    analysisRevisionAtSubmit: row.analysis_revision_at_submit,
    resultAction: row.result_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
