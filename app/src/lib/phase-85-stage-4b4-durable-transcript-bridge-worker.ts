import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimTranscriptBridgeWorkV2,
  completeTranscriptBridgeV2,
  failTranscriptBridgeWorkV2,
  promoteVoiceBundleDeadlinesV2,
  STAGE_4B4_TRANSCRIPT_BRIDGE_SAGA_VERSION,
} from "./phase-85-stage-4b4-transcript-bridge-saga";

export const STAGE_4B4_DURABLE_TRANSCRIPT_BRIDGE_WORKER_VERSION =
  "p85-stage-4b4-durable-transcript-bridge-worker-v1";
export const STAGE_4B4_TRANSCRIPT_BRIDGE_WORKER_BATCH_LIMIT = 8;

export type Stage4B4DurableTranscriptBridgeWorkerSummary = {
  version: string;
  sagaVersion: string;
  generatedAt: string;
  tenantId: string;
  workerId: string;
  claimed: number;
  completed: number;
  bodyUpdated: number;
  failed: number;
  promoted: number;
  transcriptionTimeouts: number;
};

async function loadAcceptedTranscriptText(
  supabase: SupabaseClient,
  tenantId: string,
  transcriptionId: string,
  transcriptionRevision: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("audio_transcription_records")
    .select("transcript_text,status,transcription_revision")
    .eq("tenant_id", tenantId)
    .eq("id", transcriptionId)
    .eq("transcription_revision", transcriptionRevision)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data || data.status !== "accepted") {
    return null;
  }
  const transcriptText = typeof data.transcript_text === "string" ? data.transcript_text.trim() : "";
  return transcriptText.length > 0 ? transcriptText : null;
}

export async function runStage4B4DurableTranscriptBridgeWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  now?: string;
}): Promise<Stage4B4DurableTranscriptBridgeWorkerSummary> {
  const generatedAt = input.now ?? new Date().toISOString();
  const summary: Stage4B4DurableTranscriptBridgeWorkerSummary = {
    version: STAGE_4B4_DURABLE_TRANSCRIPT_BRIDGE_WORKER_VERSION,
    sagaVersion: STAGE_4B4_TRANSCRIPT_BRIDGE_SAGA_VERSION,
    generatedAt,
    tenantId: input.tenantId,
    workerId: input.workerId,
    claimed: 0,
    completed: 0,
    bodyUpdated: 0,
    failed: 0,
    promoted: 0,
    transcriptionTimeouts: 0,
  };

  const promotion = await promoteVoiceBundleDeadlinesV2(input.supabase, input.tenantId, generatedAt);
  summary.promoted = promotion.promoted;
  summary.transcriptionTimeouts = promotion.transcriptionTimeouts;

  for (let index = 0; index < STAGE_4B4_TRANSCRIPT_BRIDGE_WORKER_BATCH_LIMIT; index += 1) {
    const claimed = await claimTranscriptBridgeWorkV2(input.supabase, input.tenantId, input.workerId);
    if (!claimed) {
      break;
    }
    summary.claimed += 1;

    try {
      const transcriptText = await loadAcceptedTranscriptText(
        input.supabase,
        input.tenantId,
        claimed.transcription_id,
        claimed.transcription_revision,
      );
      if (!transcriptText) {
        await failTranscriptBridgeWorkV2({
          supabase: input.supabase,
          tenantId: input.tenantId,
          bridgeJobId: claimed.id,
          workerId: input.workerId,
          leaseToken: claimed.lease_token,
          failureCode: "transcript_not_accepted",
        });
        summary.failed += 1;
        continue;
      }

      const result = await completeTranscriptBridgeV2({
        supabase: input.supabase,
        tenantId: input.tenantId,
        bridgeJobId: claimed.id,
        workerId: input.workerId,
        leaseToken: claimed.lease_token,
        transcriptText,
      });
      summary.completed += 1;
      if (result.bodyUpdated) {
        summary.bodyUpdated += 1;
      }
    } catch {
      await failTranscriptBridgeWorkV2({
        supabase: input.supabase,
        tenantId: input.tenantId,
        bridgeJobId: claimed.id,
        workerId: input.workerId,
        leaseToken: claimed.lease_token,
        failureCode: "bridge_commit_failed",
      });
      summary.failed += 1;
    }
  }

  return summary;
}
