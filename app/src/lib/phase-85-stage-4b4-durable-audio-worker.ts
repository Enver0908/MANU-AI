import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateStage4B4VoiceTranscriptionProviderGate } from "./phase-85-stage-4b4-provider-gate";
import {
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
  type Stage4B4TranscriptionFixtureSceneId,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { createSupabaseStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import { applyTranscriptQualityGate } from "./phase-85-stage-4b4-transcript-quality";
import {
  buildTranscriptionLineageFieldsFromObservation,
  parseAudioTranscriptionObservationV1,
} from "./phase-85-stage-4b4-voice-contracts";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";
import {
  completeTranscriptionV2,
  failTranscriptionWorkV2,
  STAGE_4B4_DURABLE_PIPELINE_SAGA_VERSION,
} from "./phase-85-stage-4b4-durable-pipeline-saga";

export const STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION = "p85-stage-4b4-durable-audio-worker-v2";
export const STAGE_4B4_TRANSCRIPTION_WORKER_BATCH_LIMIT = 8;
export const STAGE_4B4_TRANSCRIPTION_WORKER_LEASE_RENEW_MS = 20_000;

type ClaimedTranscriptionRow = {
  id: string;
  tenant_id: string;
  media_asset_id: string;
  message_id: string;
  conversation_id: string;
  bundle_id: string | null;
  transcription_revision: number;
  locale: string;
  lease_token: string;
};

type MediaAssetRow = {
  id: string;
  content_sha256: string | null;
  sanitized_audio_object_key: string | null;
  status: string;
};

export type Stage4B4DurableTranscriptionWorkerSummary = {
  version: string;
  generatedAt: string;
  tenantId: string;
  workerId: string;
  claimed: number;
  accepted: number;
  reviewRequired: number;
  failed: number;
  retriesScheduled: number;
};

async function renewTranscriptionLease(
  supabase: SupabaseClient,
  tenantId: string,
  transcriptionId: string,
  workerId: string,
  leaseToken: string,
) {
  await supabase.rpc("p85_stage_4b4_renew_transcription_lease_v2", {
    p_tenant_id: tenantId,
    p_transcription_id: transcriptionId,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
  });
}

export async function runStage4B4DurableTranscriptionWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  env?: NodeJS.ProcessEnv;
  manifestSceneByHash?: Record<string, Stage4B4TranscriptionFixtureSceneId>;
  batchLimit?: number;
}): Promise<Stage4B4DurableTranscriptionWorkerSummary> {
  const env = input.env ?? process.env;
  const gate = evaluateStage4B4VoiceTranscriptionProviderGate(env);
  const workerId = input.workerId ?? "stage4b4-durable-transcription-worker";
  const summary: Stage4B4DurableTranscriptionWorkerSummary = {
    version: STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    claimed: 0,
    accepted: 0,
    reviewRequired: 0,
    failed: 0,
    retriesScheduled: 0,
  };

  if (!gate.mockVoiceTranscriptionAllowed) {
    return summary;
  }

  const storage = createSupabaseStage4B4AudioStorage(input.supabase);
  let manifest = createStage4B4TranscriptionFixtureManifest();
  for (const [hash, sceneId] of Object.entries(input.manifestSceneByHash ?? {})) {
    manifest = registerStage4B4TranscriptionFixtureHash(manifest, hash, sceneId);
  }
  const provider = createStage4B4MockTranscriptionProvider({ env, manifest });

  for (let index = 0; index < (input.batchLimit ?? STAGE_4B4_TRANSCRIPTION_WORKER_BATCH_LIMIT); index += 1) {
    const { data: claimedRows, error: claimError } = await input.supabase.rpc(
      "p85_stage_4b4_claim_transcription_work_v2",
      {
        p_tenant_id: input.tenantId,
        p_worker_id: workerId,
      },
    );
    if (claimError) {
      throw claimError;
    }

    const claimed = (claimedRows?.[0] ?? null) as ClaimedTranscriptionRow | null;
    if (!claimed?.id || !claimed.lease_token) {
      break;
    }
    summary.claimed += 1;

    const { data: assetRow, error: assetError } = await input.supabase
      .from("media_assets")
      .select("id, content_sha256, sanitized_audio_object_key, status")
      .eq("tenant_id", input.tenantId)
      .eq("id", claimed.media_asset_id)
      .maybeSingle();

    if (assetError || !assetRow) {
      await failTranscriptionWorkV2({
        supabase: input.supabase,
        tenantId: input.tenantId,
        transcriptionId: claimed.id,
        workerId,
        leaseToken: claimed.lease_token,
        failureCode: "missing_asset",
        terminalClass: "security",
      });
      summary.failed += 1;
      continue;
    }

    const asset = assetRow as MediaAssetRow;
    if (!asset.content_sha256 || !asset.sanitized_audio_object_key) {
      await failTranscriptionWorkV2({
        supabase: input.supabase,
        tenantId: input.tenantId,
        transcriptionId: claimed.id,
        workerId,
        leaseToken: claimed.lease_token,
        failureCode: "missing_content_sha256",
        terminalClass: "security",
      });
      summary.failed += 1;
      continue;
    }

    const stored = await storage.downloadObject(asset.sanitized_audio_object_key);
    if (!stored?.bytes?.byteLength) {
      const result = await input.supabase.rpc("p85_stage_4b4_fail_transcription_work_v2", {
        p_tenant_id: input.tenantId,
        p_transcription_id: claimed.id,
        p_worker_id: workerId,
        p_lease_token: claimed.lease_token,
        p_failure_code: "storage_upload_failed",
        p_terminal_class: "transient",
      });
      if (result.error) {
        throw result.error;
      }
      if (result.data?.status === "retry_scheduled") {
        summary.retriesScheduled += 1;
      } else {
        summary.failed += 1;
      }
      continue;
    }

    const renewTimer = setInterval(() => {
      void renewTranscriptionLease(
        input.supabase,
        input.tenantId,
        claimed.id,
        workerId,
        claimed.lease_token,
      ).catch(() => undefined);
    }, STAGE_4B4_TRANSCRIPTION_WORKER_LEASE_RENEW_MS);

    let providerResult;
    try {
      providerResult = await provider.transcribe({
        requestId: claimed.id,
        contentSha256: asset.content_sha256,
        locale: claimed.locale as never,
        wavBytes: stored.bytes,
      });
    } finally {
      clearInterval(renewTimer);
    }

    if (!providerResult.ok) {
      const result = await input.supabase.rpc("p85_stage_4b4_fail_transcription_work_v2", {
        p_tenant_id: input.tenantId,
        p_transcription_id: claimed.id,
        p_worker_id: workerId,
        p_lease_token: claimed.lease_token,
        p_failure_code: providerResult.failureCode,
        p_terminal_class: providerResult.retryable ? "transient" : "security",
      });
      if (result.error) {
        throw result.error;
      }
      if (result.data?.status === "retry_scheduled") {
        summary.retriesScheduled += 1;
      } else if (result.data?.status === "terminal_failure") {
        if (providerResult.retryable) {
          summary.failed += 1;
        } else {
          summary.reviewRequired += 1;
        }
      }
      continue;
    }

    let observation;
    try {
      observation = parseAudioTranscriptionObservationV1(providerResult.observation);
    } catch {
      await failTranscriptionWorkV2({
        supabase: input.supabase,
        tenantId: input.tenantId,
        transcriptionId: claimed.id,
        workerId,
        leaseToken: claimed.lease_token,
        failureCode: "observation_validation_failed",
        terminalClass: "security",
      });
      summary.reviewRequired += 1;
      continue;
    }

    const quality = applyTranscriptQualityGate({
      observation,
      expectedLocale: claimed.locale as never,
    });
    const lineage = buildTranscriptionLineageFieldsFromObservation({ observation });

    await completeTranscriptionV2({
      supabase: input.supabase,
      tenantId: input.tenantId,
      transcriptionId: claimed.id,
      workerId,
      leaseToken: claimed.lease_token,
      record: {
        conversationId: claimed.conversation_id,
        mediaAssetId: claimed.media_asset_id,
        messageId: claimed.message_id,
        bundleId: claimed.bundle_id,
        transcriptionRevision: claimed.transcription_revision,
      },
      observation,
      qualityDecision: quality.qualityDecision,
      rejectionReasons: quality.rejectionReasons,
      terminalStatus: quality.terminalStatus,
      lineage: {
        origin: lineage.origin ?? "mock_provider",
        transcriptText: lineage.transcriptText ?? null,
        detectedLocale: lineage.detectedLocale ?? null,
        overallConfidence: lineage.overallConfidence ?? null,
        minimumSegmentConfidence: lineage.minimumSegmentConfidence ?? null,
        uncertainSpanCount: lineage.uncertainSpanCount ?? null,
        segmentCount: lineage.segmentCount ?? null,
        speakerState: lineage.speakerState ?? null,
      },
    });

    if (quality.terminalStatus === "accepted") {
      summary.accepted += 1;
    } else {
      summary.reviewRequired += 1;
    }
  }

  return summary;
}

export { STAGE_4B4_DURABLE_PIPELINE_SAGA_VERSION };
