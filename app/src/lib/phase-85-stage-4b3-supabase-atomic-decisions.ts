import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapBundleDecisionOutcomeToRpcPayload,
  type BundleDecisionOutcomeV2,
} from "./phase-85-stage-4b3-atomic-outcomes";

export async function commitSupabaseBundleDecisionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  idempotencyKey: string;
  outcome: BundleDecisionOutcomeV2;
  responseJson: Record<string, unknown>;
}) {
  const { data, error } = await input.supabase.rpc("p85_stage_4b3_commit_bundle_decision_v2", {
    p_tenant_id: input.tenantId,
    p_idempotency_key: input.idempotencyKey,
    p_outcome: mapBundleDecisionOutcomeToRpcPayload(input.outcome),
    p_response_json: input.responseJson,
  });
  if (error) throw error;
  return data;
}

export async function commitSupabaseVisualCorrectionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  idempotencyKey: string;
  outcome: Record<string, unknown>;
  responseJson: Record<string, unknown>;
}) {
  const { data, error } = await input.supabase.rpc("p85_stage_4b3_commit_visual_correction_v2", {
    p_tenant_id: input.tenantId,
    p_idempotency_key: input.idempotencyKey,
    p_outcome: input.outcome,
    p_response_json: input.responseJson,
  });
  if (error) throw error;
  return data;
}

export async function commitSupabaseTranscriptCorrectionV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  idempotencyKey: string;
  outcome: Record<string, unknown>;
  responseJson: Record<string, unknown>;
}) {
  const { data, error } = await input.supabase.rpc("p85_stage_4b4_commit_transcript_correction_v2", {
    p_tenant_id: input.tenantId,
    p_idempotency_key: input.idempotencyKey,
    p_outcome: input.outcome,
    p_response_json: input.responseJson,
  });
  if (error) throw error;
  return data;
}
