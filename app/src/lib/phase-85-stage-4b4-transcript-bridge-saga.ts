import type { SupabaseClient } from "@supabase/supabase-js";
import { countUnicodeCodepoints } from "./phase-85-stage-4b3-message-bundles";
import { STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY } from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_TRANSCRIPT_BRIDGE_SAGA_VERSION = "p85-stage-4b4-transcript-bridge-saga-v1";

export type Stage4B4TranscriptBridgeJobRow = {
  id: string;
  tenant_id: string;
  transcription_id: string;
  transcription_revision: number;
  conversation_id: string;
  media_asset_id: string;
  message_id: string;
  bundle_id: string | null;
  lease_token: string;
};

export async function claimTranscriptBridgeWorkV2(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string,
): Promise<Stage4B4TranscriptBridgeJobRow | null> {
  const { data, error } = await supabase.rpc("p85_stage_4b4_claim_transcript_bridge_work_v2", {
    p_tenant_id: tenantId,
    p_worker_id: workerId,
  });
  if (error) {
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return null;
  }
  return row as Stage4B4TranscriptBridgeJobRow;
}

export async function completeTranscriptBridgeV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  bridgeJobId: string;
  workerId: string;
  leaseToken: string;
  transcriptText: string;
}): Promise<{ bodyUpdated: boolean }> {
  const unicodeIncrement = countUnicodeCodepoints(input.transcriptText.trim());
  const { data, error } = await input.supabase.rpc("p85_stage_4b4_complete_transcript_bridge_v2", {
    p_tenant_id: input.tenantId,
    p_bridge_job_id: input.bridgeJobId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_payload: {
      placeholderBody: STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY,
      transcriptText: input.transcriptText.trim(),
      unicodeIncrement,
    },
  });
  if (error) {
    throw error;
  }
  return {
    bodyUpdated: Boolean(data?.bodyUpdated),
  };
}

export async function failTranscriptBridgeWorkV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  bridgeJobId: string;
  workerId: string;
  leaseToken: string;
  failureCode?: string;
}): Promise<void> {
  const { error } = await input.supabase.rpc("p85_stage_4b4_fail_transcript_bridge_work_v2", {
    p_tenant_id: input.tenantId,
    p_bridge_job_id: input.bridgeJobId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_failure_code: input.failureCode ?? "bridge_failed",
  });
  if (error) {
    throw error;
  }
}

export async function promoteVoiceBundleDeadlinesV2(
  supabase: SupabaseClient,
  tenantId: string,
  now?: string,
): Promise<{ promoted: number; transcriptionTimeouts: number }> {
  const { data, error } = await supabase.rpc("p85_stage_4b4_promote_voice_bundle_deadlines_v2", {
    p_tenant_id: tenantId,
    p_now: now ?? new Date().toISOString(),
  });
  if (error) {
    throw error;
  }
  return {
    promoted: Number(data?.promoted ?? 0),
    transcriptionTimeouts: Number(data?.transcriptionTimeouts ?? 0),
  };
}
