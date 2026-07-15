import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppTenantContext } from "./auth-context";
import { conversationActorFromContext } from "./phase-85-stage-4b2-messaging";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  createPendingTranscriptionLineageDefaults,
  type AudioTranscriptCorrectionRecord,
  type AudioTranscriptionRecord,
} from "./phase-85-stage-4b4-voice-contracts";
import type { Stage4B4ConversationVoiceProjectionSource } from "./phase-85-stage-4b4-bounded-audio";

export const STAGE_4B4_BOUNDED_AUDIO_RPC_VERSION = "p85-stage-4b4-bounded-audio-rpc-v1";

type BoundedAudioRpcAsset = {
  id: string;
  message_id: string;
  status: MediaAssetRecord["status"];
  declared_mime_type: string;
  detected_mime_type: string | null;
  duration_ms: number | null;
  expires_at: string | null;
  media_kind: string | null;
  voice_message: boolean | null;
  has_audio: boolean;
};

type BoundedAudioRpcTranscription = {
  id: string;
  media_asset_id: string;
  message_id: string;
  transcription_revision: number;
  status: AudioTranscriptionRecord["status"];
  transcript_status: string;
};

type BoundedAudioRpcCorrection = {
  id: string;
  transcription_id: string;
  status: AudioTranscriptCorrectionRecord["status"];
  corrected_transcript: string;
  created_at: string;
};

export function mapBoundedAudioRpcPayload(input: {
  tenantId: string;
  conversationId: string;
  clientId: string;
  payload: {
    media_assets?: BoundedAudioRpcAsset[];
    audio_transcription_records?: BoundedAudioRpcTranscription[];
    audio_transcript_corrections?: BoundedAudioRpcCorrection[];
  };
}): Stage4B4ConversationVoiceProjectionSource {
  const now = new Date().toISOString();
  const mediaAssets: MediaAssetRecord[] = (input.payload.media_assets ?? []).map((row) => ({
    id: row.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    messageId: row.message_id,
    channelEventId: "",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: null,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    dimensions: null,
    byteSize: null,
    contentSha256: null,
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: null,
    mediaKind: row.media_kind === "audio" ? "audio" : row.has_audio ? "audio" : "image",
    voiceMessage: row.voice_message ?? row.media_kind === "audio",
    durationMs: row.duration_ms,
    audioCodec: row.has_audio ? "pcm_s16le" : null,
    audioChannels: row.has_audio ? 1 : null,
    sampleRateHz: row.has_audio ? 16_000 : null,
    sanitizedAudioObjectKey: row.has_audio ? "__bounded_has_audio__" : null,
    transcriptionId: null,
    status: row.status,
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: now,
    expiresAt: row.expires_at,
    deletedAt: null,
    failureCode: null,
    createdAt: now,
    updatedAt: now,
  }));

  const audioTranscriptionRecords: AudioTranscriptionRecord[] = (input.payload.audio_transcription_records ?? []).map(
    (row) => ({
      id: row.id,
      tenantId: input.tenantId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      messageId: row.message_id,
      mediaAssetId: row.media_asset_id,
      bundleId: null,
      transcriptionRevision: row.transcription_revision,
      status: row.status,
      locale: "tr-TR",
      observation: null,
      qualityDecision: {
        accepted: row.transcript_status === "accepted" || row.transcript_status === "corrected",
        reasonCodes: [],
      },
      rejectionReasons: [],
      failureCode: null,
      retryCount: 0,
      nextAttemptAt: null,
      leaseExpiresAt: null,
      sourceModality: "voice_transcript",
      providerMode: "mock",
      ...createPendingTranscriptionLineageDefaults(),
      createdAt: now,
      updatedAt: now,
    }),
  );

  const audioTranscriptCorrections: AudioTranscriptCorrectionRecord[] = (
    input.payload.audio_transcript_corrections ?? []
  ).map((row) => ({
    id: row.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    transcriptionId: row.transcription_id,
    sourceTranscriptionId: row.transcription_id,
    correctedTranscriptionId: null,
    targetMessageId: "",
    supersededDecisionId: null,
    rerunDecisionId: null,
    dietitianId: "",
    status: row.status,
    reasonCode: "other_clinical_mismatch",
    explanation: "",
    correctedTranscript: row.corrected_transcript,
    conversationRevisionAtSubmit: 1,
    transcriptionRevisionAtSubmit: 1,
    resultAction: "manual_follow_up",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  }));

  return {
    mediaAssets,
    audioTranscriptionRecords,
    audioTranscriptCorrections,
  };
}

export async function loadBoundedVoiceProjectionFromSupabaseV1(input: {
  supabase: SupabaseClient;
  context: AppTenantContext;
  conversationId: string;
  clientId: string;
  messageIds: string[];
}): Promise<Stage4B4ConversationVoiceProjectionSource> {
  const actor = conversationActorFromContext(input.context);
  const { data, error } = await input.supabase.rpc("p85_stage_4b4_load_bounded_voice_v1", {
    p_tenant_id: actor.tenantId,
    p_user_id: actor.userId,
    p_dietitian_id: actor.dietitianId,
    p_role: actor.role,
    p_conversation_id: input.conversationId,
    p_message_ids: input.messageIds,
  });
  if (error) {
    throw error;
  }

  return mapBoundedAudioRpcPayload({
    tenantId: actor.tenantId,
    conversationId: input.conversationId,
    clientId: input.clientId,
    payload: (data ?? {}) as {
      media_assets?: BoundedAudioRpcAsset[];
      audio_transcription_records?: BoundedAudioRpcTranscription[];
      audio_transcript_corrections?: BoundedAudioRpcCorrection[];
    },
  });
}
