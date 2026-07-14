import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateStage4B4VoiceTranscriptionProviderGate } from "./phase-85-stage-4b4-provider-gate";
import {
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
  type Stage4B4TranscriptionFixtureSceneId,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { createSupabaseStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import { applyTranscriptQualityGate } from "./phase-85-stage-4b4-transcript-quality";
import { parseAudioTranscriptionObservationV1 } from "./phase-85-stage-4b4-voice-contracts";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";

export const STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION = "p85-stage-4b4-durable-audio-worker-v1";

type ClaimedTranscriptionRow = {
  id: string;
  tenant_id: string;
  media_asset_id: string;
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
};

export async function runStage4B4DurableTranscriptionWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  env?: NodeJS.ProcessEnv;
  manifestSceneByHash?: Record<string, Stage4B4TranscriptionFixtureSceneId>;
}): Promise<Stage4B4DurableTranscriptionWorkerSummary> {
  const env = input.env ?? process.env;
  const gate = evaluateStage4B4VoiceTranscriptionProviderGate(env);
  const workerId = input.workerId ?? "stage4b4-durable-audio-worker";
  const summary: Stage4B4DurableTranscriptionWorkerSummary = {
    version: STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    claimed: 0,
    accepted: 0,
    reviewRequired: 0,
    failed: 0,
  };

  if (!gate.mockVoiceTranscriptionAllowed) {
    return summary;
  }

  const { data: claimedRows, error: claimError } = await input.supabase.rpc(
    "p85_stage_4b4_claim_transcription_work_v1",
    {
      p_tenant_id: input.tenantId,
      p_worker_id: workerId,
    },
  );
  if (claimError) {
    throw claimError;
  }

  const storage = createSupabaseStage4B4AudioStorage(input.supabase);
  let manifest = createStage4B4TranscriptionFixtureManifest();
  for (const [hash, sceneId] of Object.entries(input.manifestSceneByHash ?? {})) {
    manifest = registerStage4B4TranscriptionFixtureHash(manifest, hash, sceneId);
  }
  const provider = createStage4B4MockTranscriptionProvider({ env, manifest });

  for (const claimed of (claimedRows ?? []) as ClaimedTranscriptionRow[]) {
    summary.claimed += 1;
    const { data: assetRow, error: assetError } = await input.supabase
      .from("media_assets")
      .select("id, content_sha256, sanitized_audio_object_key, status")
      .eq("tenant_id", input.tenantId)
      .eq("id", claimed.media_asset_id)
      .maybeSingle();
    if (assetError || !assetRow) {
      await releaseTranscription(input.supabase, input.tenantId, claimed, workerId, false, "failed", "missing_asset");
      summary.failed += 1;
      continue;
    }

    const asset = assetRow as MediaAssetRow;
    if (!asset.content_sha256 || !asset.sanitized_audio_object_key) {
      await releaseTranscription(input.supabase, input.tenantId, claimed, workerId, false, "failed", "missing_content_sha256");
      summary.failed += 1;
      continue;
    }

    const stored = await storage.downloadObject(asset.sanitized_audio_object_key);
    if (!stored?.bytes?.byteLength) {
      await releaseTranscription(input.supabase, input.tenantId, claimed, workerId, false, "failed", "storage_upload_failed");
      summary.failed += 1;
      continue;
    }

    const providerResult = await provider.transcribe({
      requestId: claimed.id,
      contentSha256: asset.content_sha256,
      locale: claimed.locale as never,
      wavBytes: stored.bytes,
    });

    if (!providerResult.ok) {
      await releaseTranscription(
        input.supabase,
        input.tenantId,
        claimed,
        workerId,
        false,
        "failed",
        providerResult.failureCode,
      );
      summary.failed += 1;
      continue;
    }

    let observation;
    try {
      observation = parseAudioTranscriptionObservationV1(providerResult.observation);
    } catch {
      await releaseTranscription(
        input.supabase,
        input.tenantId,
        claimed,
        workerId,
        false,
        "failed",
        "observation_validation_failed",
      );
      summary.failed += 1;
      continue;
    }

    const quality = applyTranscriptQualityGate({
      observation,
      expectedLocale: claimed.locale as never,
    });

    await input.supabase
      .from("audio_transcription_records")
      .update({
        observation,
        quality_decision: quality.qualityDecision,
        rejection_reasons: quality.rejectionReasons,
        retrieval_eligible: quality.terminalStatus === "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", claimed.id);

    await input.supabase
      .from("media_assets")
      .update({
        status: quality.terminalStatus === "accepted" ? "analysis_ready" : "analysis_pending",
        failure_code: quality.terminalStatus === "accepted" ? null : quality.rejectionReasons[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", asset.id);

    await releaseTranscription(
      input.supabase,
      input.tenantId,
      claimed,
      workerId,
      true,
      quality.terminalStatus,
      null,
    );

    if (quality.terminalStatus === "accepted") {
      summary.accepted += 1;
    } else {
      summary.reviewRequired += 1;
    }
  }

  return summary;
}

async function releaseTranscription(
  supabase: SupabaseClient,
  tenantId: string,
  claimed: ClaimedTranscriptionRow,
  workerId: string,
  success: boolean,
  terminalStatus: string,
  failureCode: string | null,
) {
  const { error } = await supabase.rpc("p85_stage_4b4_release_transcription_work_v1", {
    p_tenant_id: tenantId,
    p_transcription_id: claimed.id,
    p_worker_id: workerId,
    p_lease_token: claimed.lease_token,
    p_success: success,
    p_terminal_status: terminalStatus,
    p_failure_code: failureCode,
  });
  if (error) {
    throw error;
  }
}
