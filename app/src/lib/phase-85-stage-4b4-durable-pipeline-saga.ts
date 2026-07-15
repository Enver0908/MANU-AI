import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stage4B4AudioAdmissionFailureCode } from "./phase-85-stage-4b4-audio-admission";
import type { Stage4B4CanonicalWavArtifacts } from "./phase-85-stage-4b4-audio-canonicalizer";
import { buildStage4B4AudioObjectKey, type Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import { buildTranscriptBridgeIdempotencyKey } from "./phase-85-stage-4b4-transcript-bridge";
import type {
  AudioTranscriptionObservationV1,
  AudioTranscriptionQualityDecision,
  AudioTranscriptionRecord,
  Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_DURABLE_PIPELINE_SAGA_VERSION = "p85-stage-4b4-durable-pipeline-saga-v1";

export const STAGE_4B4_ADMISSION_SECURITY_FAILURE_CODES = new Set<Stage4B4AudioAdmissionFailureCode>([
  "ingress_metadata_rejected",
  "missing_provider_media_id",
  "stream_too_large",
  "unsupported_mime",
  "mime_spoof",
  "hash_mismatch",
  "corrupt_ogg",
  "corrupt_ogg_page",
  "missing_opus_head",
  "invalid_opus_head",
  "non_opus_codec",
  "stereo_not_allowed",
  "duration_exceeded",
  "granule_duration_exceeded",
  "decode_sample_limit_exceeded",
  "decode_failed",
]);

export function classifyAudioAdmissionFailureTerminalClass(
  failureCode: Stage4B4AudioAdmissionFailureCode,
): "security" | "transient" {
  return STAGE_4B4_ADMISSION_SECURITY_FAILURE_CODES.has(failureCode) ? "security" : "transient";
}

export async function uploadCanonicalAudioObjectWithRollback(input: {
  storage: Stage4B4AudioStoragePort;
  supabase: SupabaseClient;
  tenantId: string;
  assetId: string;
  artifacts: Stage4B4CanonicalWavArtifacts;
}): Promise<string> {
  const objectKey = buildStage4B4AudioObjectKey(input.tenantId, input.assetId);
  try {
    await input.storage.uploadObject(objectKey, input.artifacts.wavBytes, "audio/wav");
  } catch (error) {
    try {
      await input.storage.deleteObject(objectKey);
    } catch {
      await input.supabase.rpc("p85_stage_4b3_enqueue_media_object_operation_v2", {
        p_tenant_id: input.tenantId,
        p_media_asset_id: input.assetId,
        p_object_key: objectKey,
        p_operation_kind: "delete_object",
        p_failure_code: "partial_upload_rollback_delete_failed",
      });
    }
    throw error;
  }
  return objectKey;
}

export async function commitCompleteAudioAdmissionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  assetId: string;
  workerId: string;
  leaseToken: string;
  transcriptionId: string;
  locale: Stage4B4SupportedLocale;
  artifacts: Stage4B4CanonicalWavArtifacts;
  objectKey: string;
  storedAt: string;
  expiresAt: string;
  bundleId?: string | null;
}): Promise<{ transcriptionId: string }> {
  const { data, error } = await input.supabase.rpc("p85_stage_4b4_complete_audio_admission_v2", {
    p_tenant_id: input.tenantId,
    p_asset_id: input.assetId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_payload: {
      transcriptionId: input.transcriptionId,
      locale: input.locale,
      bundleId: input.bundleId ?? null,
      detectedMimeType: "audio/wav",
      durationMs: input.artifacts.durationMs,
      audioCodec: input.artifacts.audioCodec,
      audioChannels: input.artifacts.audioChannels,
      sampleRateHz: input.artifacts.sampleRateHz,
      byteSize: input.artifacts.wavBytes.byteLength,
      contentSha256: input.artifacts.contentSha256,
      sanitizedAudioObjectKey: input.objectKey,
      storedAt: input.storedAt,
      expiresAt: input.expiresAt,
    },
  });

  if (error) {
    await input.supabase.rpc("p85_stage_4b3_enqueue_media_object_operation_v2", {
      p_tenant_id: input.tenantId,
      p_media_asset_id: input.assetId,
      p_object_key: input.objectKey,
      p_operation_kind: "delete_object",
      p_failure_code: "admission_commit_failed",
    });
    throw error;
  }

  return {
    transcriptionId: String(data?.transcriptionId ?? input.transcriptionId),
  };
}

export async function failAudioAdmissionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  assetId: string;
  workerId: string;
  leaseToken: string;
  failureCode: Stage4B4AudioAdmissionFailureCode;
}): Promise<void> {
  const { error } = await input.supabase.rpc("p85_stage_4b4_fail_audio_admission_v2", {
    p_tenant_id: input.tenantId,
    p_asset_id: input.assetId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_failure_code: input.failureCode,
    p_terminal_class: classifyAudioAdmissionFailureTerminalClass(input.failureCode),
  });
  if (error) {
    throw error;
  }
}

export async function completeTranscriptionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  transcriptionId: string;
  workerId: string;
  leaseToken: string;
  record: Pick<
    AudioTranscriptionRecord,
    "conversationId" | "mediaAssetId" | "messageId" | "bundleId" | "transcriptionRevision"
  >;
  observation: AudioTranscriptionObservationV1 | null;
  qualityDecision: AudioTranscriptionQualityDecision | null;
  rejectionReasons: string[];
  terminalStatus: "accepted" | "review_required" | "failed";
  lineage: {
    origin: string | null;
    transcriptText: string | null;
    detectedLocale: string | null;
    overallConfidence: number | null;
    minimumSegmentConfidence: number | null;
    uncertainSpanCount: number | null;
    segmentCount: number | null;
    speakerState: string | null;
  };
  failureCode?: string | null;
}): Promise<void> {
  const bridgeIdempotencyKey =
    input.terminalStatus === "accepted" && input.record.bundleId
      ? buildTranscriptBridgeIdempotencyKey({
          conversationId: input.record.conversationId,
          mediaAssetId: input.record.mediaAssetId,
          transcriptionId: input.transcriptionId,
          bundleId: input.record.bundleId,
        })
      : input.terminalStatus === "accepted"
        ? buildTranscriptBridgeIdempotencyKey({
            conversationId: input.record.conversationId,
            mediaAssetId: input.record.mediaAssetId,
            transcriptionId: input.transcriptionId,
            bundleId: input.record.bundleId ?? input.transcriptionId,
          })
        : null;

  const { error } = await input.supabase.rpc("p85_stage_4b4_complete_transcription_v2", {
    p_tenant_id: input.tenantId,
    p_transcription_id: input.transcriptionId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_payload: {
      observation: input.observation,
      qualityDecision: input.qualityDecision,
      rejectionReasons: input.rejectionReasons,
      terminalStatus: input.terminalStatus,
      retrievalEligible: input.terminalStatus === "accepted",
      transcriptText: input.lineage.transcriptText,
      detectedLocale: input.lineage.detectedLocale,
      overallConfidence: input.lineage.overallConfidence,
      minimumSegmentConfidence: input.lineage.minimumSegmentConfidence,
      uncertainSpanCount: input.lineage.uncertainSpanCount,
      segmentCount: input.lineage.segmentCount,
      speakerState: input.lineage.speakerState,
      origin: input.lineage.origin,
      mediaAssetStatus:
        input.terminalStatus === "accepted"
          ? "analysis_ready"
          : input.terminalStatus === "failed"
            ? "failed"
            : "analysis_pending",
      mediaFailureCode:
        input.terminalStatus === "accepted" ? null : input.rejectionReasons[0] ?? input.failureCode ?? null,
      failureCode: input.failureCode ?? null,
      bridgeIdempotencyKey,
    },
  });
  if (error) {
    throw error;
  }
}

export async function failTranscriptionWorkV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  transcriptionId: string;
  workerId: string;
  leaseToken: string;
  failureCode: string;
  terminalClass?: "security" | "transient" | "review_required";
  rejectionReasons?: string[];
}): Promise<void> {
  const { error } = await input.supabase.rpc("p85_stage_4b4_fail_transcription_work_v2", {
    p_tenant_id: input.tenantId,
    p_transcription_id: input.transcriptionId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_failure_code: input.failureCode,
    p_terminal_class: input.terminalClass ?? "transient",
    p_rejection_reasons: input.rejectionReasons ?? null,
  });
  if (error) {
    throw error;
  }
}
