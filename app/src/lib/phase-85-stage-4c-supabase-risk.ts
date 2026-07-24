import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppTenantContext } from "./auth-context";
import type {
  AiChatDraftTransferDto,
  AiChatRiskLevel,
  AiChatRunDto,
  AiChatRunRiskSummaryDto,
  AiChatScopeType,
} from "./phase-85-stage-4c-contracts";
import {
  buildSourceRevisionDigest,
  evaluateAiChatRunRisk,
  type AiChatRiskBridgeRunContext,
} from "./phase-85-stage-4c-risk-bridge";
import { mapRpcError } from "./phase-85-stage-4c-service";

export const STAGE_4C_SUPABASE_RISK_VERSION = "p85-stage-4c-supabase-risk-v1";

function buildAssessmentFingerprint(input: {
  runId: string;
  sourceRevisionDigest: string;
  riskLevel: string;
  reasons: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        runId: input.runId,
        sourceRevisionDigest: input.sourceRevisionDigest,
        riskLevel: input.riskLevel,
        reasons: [...input.reasons].sort(),
      }),
    )
    .digest("hex");
}

function mapSafeDraftFromRpc(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const body = typeof row.body === "string" ? row.body : "";
  if (!body.trim()) return null;
  return {
    body,
    riskLevel: (row.risk_level ?? row.riskLevel ?? null) as AiChatRiskLevel | null,
    sourceRefIds: Array.isArray(row.source_ref_ids)
      ? (row.source_ref_ids as string[])
      : Array.isArray(row.sourceRefIds)
        ? (row.sourceRefIds as string[])
        : [],
  };
}

export function mapRiskSummaryFromRpc(row: Record<string, unknown>): AiChatRunRiskSummaryDto {
  return {
    runId: String(row.run_id ?? row.runId),
    riskLevel: (row.risk_level ?? row.riskLevel) as AiChatRiskLevel,
    reasons: Array.isArray(row.reasons) ? (row.reasons as string[]) : [],
    confidenceClass: String(row.confidence_class ?? row.confidenceClass ?? ""),
    recommendedHumanAction: String(row.recommended_human_action ?? row.recommendedHumanAction ?? ""),
    hypotheticalRed: Boolean(row.hypothetical_red ?? row.hypotheticalRed),
    safeDraft: mapSafeDraftFromRpc(row.safe_draft ?? row.safeDraft),
    handoffConfirmationToken:
      (row.handoff_confirmation_token as string | null) ?? (row.handoffConfirmationToken as string | null) ?? null,
    canTransferDraft: Boolean(row.can_transfer_draft ?? row.canTransferDraft),
    canCreateHandoff: Boolean(row.can_create_handoff ?? row.canCreateHandoff),
  };
}

export function mapDraftTransferFromRpc(row: Record<string, unknown>): AiChatDraftTransferDto {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    runId: String(row.run_id ?? row.runId),
    sourceConversationId: String(row.source_conversation_id ?? row.sourceConversationId),
    destinationConversationId: String(row.destination_conversation_id ?? row.destinationConversationId),
    destinationClientId: String(row.destination_client_id ?? row.destinationClientId),
    createdByUserId: String(row.created_by_user_id ?? row.createdByUserId),
    riskLevel: (row.risk_level ?? row.riskLevel) as "green" | "yellow",
    reviewOrigin: "ai_chat",
    transferMode: (row.transfer_mode ?? row.transferMode) as "composer_pending" | "yellow_review",
    draftBody: String(row.draft_body ?? row.draftBody),
    sourceRefIds: Array.isArray(row.source_ref_ids)
      ? (row.source_ref_ids as string[])
      : Array.isArray(row.sourceRefIds)
        ? (row.sourceRefIds as string[])
        : [],
    status: (row.status as AiChatDraftTransferDto["status"]) ?? "pending",
    destinationRevision: Number(row.destination_revision ?? row.destinationRevision),
    clientContextRevision: Number(row.client_context_revision ?? row.clientContextRevision),
    consumedAt: (row.consumed_at as string | null) ?? (row.consumedAt as string | null) ?? null,
    supersededAt: (row.superseded_at as string | null) ?? (row.supersededAt as string | null) ?? null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export async function supabaseApplyRunRiskPipeline(
  supabase: SupabaseClient,
  context: AppTenantContext,
  input: Omit<AiChatRiskBridgeRunContext, "sourceRevisionDigest"> & { revisionToken?: string | null },
) {
  const sourceRevisionDigest = buildSourceRevisionDigest({
    revisionToken: input.revisionToken ?? null,
    sourceRefIds: input.sourceRefIds,
  });
  const assessment = evaluateAiChatRunRisk({ ...input, sourceRevisionDigest });
  const assessmentFingerprint = buildAssessmentFingerprint({
    runId: input.runId,
    sourceRevisionDigest,
    riskLevel: assessment.riskLevel,
    reasons: assessment.reasons,
  });
  const safeDraft =
    assessment.riskLevel === "red" || !assessment.safeDraft?.body
      ? null
      : {
          body: assessment.safeDraft.body,
          risk_level: assessment.safeDraft.riskLevel ?? assessment.riskLevel,
          source_ref_ids: assessment.sourceRefIds,
        };

  const { error } = await supabase.rpc("p85_stage_4c_apply_run_risk_pipeline_v1", {
    p_tenant_id: input.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_run_id: input.runId,
    p_revision_token: input.revisionToken ?? "",
    p_source_revision_digest: sourceRevisionDigest,
    p_assessment_fingerprint: assessmentFingerprint,
    p_risk_level: assessment.riskLevel,
    p_reasons: assessment.reasons,
    p_source_ref_ids: assessment.sourceRefIds,
    p_confidence_class: assessment.confidenceClass,
    p_recommended_human_action: assessment.recommendedHumanAction,
    p_hypothetical_red: assessment.hypotheticalRed,
    p_safe_draft: safeDraft,
    p_handoff_confirmation_token: randomUUID(),
  });
  if (error) mapRpcError(error);
  return assessment;
}

export async function supabaseGetRunRiskSummary(
  supabase: SupabaseClient,
  context: AppTenantContext,
  runId: string,
): Promise<{ summary: AiChatRunRiskSummaryDto; clientContextRevision: number | null } | null> {
  const { data, error } = await supabase.rpc("p85_stage_4c_get_run_risk_summary_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_run_id: runId,
  });
  if (error) mapRpcError(error);
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    summary: mapRiskSummaryFromRpc(row),
    clientContextRevision:
      row.client_context_revision == null ? null : Number(row.client_context_revision),
  };
}

export async function supabaseListRunDraftDestinations(
  supabase: SupabaseClient,
  context: AppTenantContext,
  runId: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_list_run_draft_destinations_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_run_id: runId,
  });
  if (error) mapRpcError(error);
  return ((data as Array<Record<string, unknown>>) ?? []).map((item) => ({
    conversationId: String(item.conversation_id ?? item.conversationId),
    clientId: String(item.client_id ?? item.clientId),
    channel: String(item.channel ?? ""),
    revision: Number(item.revision),
  }));
}

export async function supabaseTransferRunDraft(
  supabase: SupabaseClient,
  context: AppTenantContext,
  runId: string,
  input: {
    sourceConversationId: string;
    destinationConversationId: string;
    destinationRevision: number;
    clientContextRevision: number;
  },
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_transfer_run_draft_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_run_id: runId,
    p_source_conversation_id: input.sourceConversationId,
    p_destination_conversation_id: input.destinationConversationId,
    p_destination_revision: input.destinationRevision,
    p_client_context_revision: input.clientContextRevision,
  });
  if (error) mapRpcError(error);
  return mapDraftTransferFromRpc((data ?? {}) as Record<string, unknown>);
}

export async function supabaseCreateRunHandoff(
  supabase: SupabaseClient,
  context: AppTenantContext,
  runId: string,
  input: {
    conversationId: string;
    clientId: string;
    confirmationToken: string;
    expectedClientContextRevision: number;
  },
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_create_run_handoff_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_run_id: runId,
    p_conversation_id: input.conversationId,
    p_client_id: input.clientId,
    p_confirmation_token: input.confirmationToken,
    p_expected_client_context_revision: input.expectedClientContextRevision,
  });
  if (error) mapRpcError(error);
  const row = (data ?? {}) as Record<string, unknown>;
  return { handoffId: String(row.handoff_id ?? row.handoffId) };
}

export async function supabaseGetPendingComposerDraftTransfer(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  destinationConversationId: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_get_pending_composer_draft_transfer_v1", {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_destination_conversation_id: destinationConversationId,
  });
  if (error) mapRpcError(error);
  if (!data || typeof data !== "object") return null;
  return mapDraftTransferFromRpc(data as Record<string, unknown>);
}

export async function supabaseConsumeComposerDraftTransfer(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    userId: string;
    transferId: string;
    destinationConversationId: string;
    destinationClientId: string;
  },
) {
  const { error } = await supabase.rpc("p85_stage_4c_consume_composer_draft_transfer_v1", {
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_transfer_id: input.transferId,
    p_destination_conversation_id: input.destinationConversationId,
    p_destination_client_id: input.destinationClientId,
  });
  if (error) mapRpcError(error);
}

export type SupabaseRunRiskPipelineInput = {
  tenantId: string;
  runId: string;
  conversationId: string;
  createdByUserId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  triggerBody: string;
  directAnswer: string | null;
  answerability: AiChatRunDto["answerability"];
  providerRiskLevel: AiChatRiskLevel | null;
  verifiedFactTexts: string[];
  attachmentExcerpts: string[];
  sourceExcerptTexts: string[];
  sourceRefIds: string[];
  revisionToken?: string | null;
};
