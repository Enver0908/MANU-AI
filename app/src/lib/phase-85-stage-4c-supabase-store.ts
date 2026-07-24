import { AppRequestError } from "./app-errors";
import { encodeClientReferenceCode, formatClientReferenceShort } from "./client-reference-code";
import { getSupabaseAdminClient } from "./supabase";
import type { AppTenantContext } from "./auth-context";
import type {
  AiChatBranchDto,
  AiChatClientSearchItem,
  AiChatClientRecordCategory,
  AiChatClientScopedExportSlice,
  AiChatConversationDetail,
  AiChatConversationListResponse,
  AiChatConversationSummary,
  AiChatAttachmentDto,
  AiChatDeleteConversationInput,
  AiChatDeleteConversationResult,
  AiChatDeleteMessageInput,
  AiChatDeleteMessageResult,
  AiChatJobRecord,
  AiChatMessageVersionRecord,
  AiChatMutationRunResult,
  AiChatRiskLevel,
  AiChatRunDto,
  AiChatRunEventDto,
  AiChatScopeType,
  AiChatSendMessageResult,
  AiChatStopRunResult,
  AiChatTitleSource,
  AiChatContextTool,
  AiChatConversationRecord,
} from "./phase-85-stage-4c-contracts";
import type {
  AiChatEditMessageInput,
  AiChatRegenerateMessageInput,
  AiChatSendMessageInput,
  AiChatStopRunInput,
} from "./phase-85-stage-4c-run-service";
import {
  buildListResponse,
  canonicalAiChatBodyHash,
  decodeAiChatListCursor,
  mapConversationDetail,
  mapConversationListItem,
  mapConversationSummary,
  mapRpcError,
  type AiChatActivateBranchInput,
  type AiChatClientSearchQuery,
  type AiChatCreateInput,
  type AiChatListQuery,
  type AiChatLoadQuery,
  type AiChatRenameInput,
} from "./phase-85-stage-4c-service";
import type {
  AccessibleClientIdentity,
  AiChatContextSnapshotInput,
  ContextGatewayAccessState,
  ContextToolExecutionResult,
  ContextToolExecutionStatus,
} from "./phase-85-stage-4c-context-gateway";
import { normalizeContextToolExecutionResult } from "./phase-85-stage-4c-context-gateway";
import { toAccessibleClientIdentity } from "./phase-85-stage-4c-context-fixtures";
import {
  supabaseAcceptAttachmentDerivativeCorrection,
  supabaseCompleteAttachmentUpload,
  supabaseCreateAttachmentUploadSession,
  supabaseDeleteAttachment,
  supabaseEnqueueAttachmentJob,
  supabaseGetAttachmentById,
  supabaseGetAttachmentObjectBytes,
  supabaseGetAttachmentRecordById,
  supabaseListConversationAttachments,
  supabaseListMessageAttachmentDerivatives,
  supabaseSaveAttachmentDerivative,
  supabaseTransferAttachmentToClientRecord,
  supabaseUpdateAttachmentStatus,
} from "./phase-85-stage-4c-supabase-attachments";
import {
  supabaseApplyRunRiskPipeline,
  supabaseConsumeComposerDraftTransfer,
  supabaseCreateRunHandoff,
  supabaseGetPendingComposerDraftTransfer,
  supabaseGetRunRiskSummary,
  supabaseListRunDraftDestinations,
  supabaseTransferRunDraft,
} from "./phase-85-stage-4c-supabase-risk";
import {
  supabaseBuildClientScopedExportSlice,
  supabaseDeleteConversation,
  supabaseDeleteMessage,
  supabaseEnqueueClientScopedDeletions,
  supabaseProcessLifecycleDeletionBatch,
  supabaseRunLifecycleRetentionSweeps,
} from "./phase-85-stage-4c-supabase-lifecycle";
import { requireHandoffCapability } from "./phase-85-stage-4c-risk-bridge";
import type { AiChatRunSourceClaimDto, AiChatRunSourcesResponse } from "./phase-85-stage-4c-sources";
import type { AiChatStore, BranchMessageChainItem } from "./phase-85-stage-4c-store";


function requireSupabaseAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppRequestError(503, "ai_chat_store_unavailable");
  }
  return supabase;
}


export const supabaseAiChatStore: AiChatStore = {
  async createConversation(context, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_create_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_scope_type: input.scopeType,
      p_client_id: input.clientId,
      p_title: input.title,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async listConversations(context, input) {
    const supabase = requireSupabaseAdmin();
    const cursor = input.cursor
      ? decodeAiChatListCursor(input.cursor, { scope: input.scope, query: input.query })
      : null;
    const { data, error } = await supabase.rpc("p85_stage_4c_list_conversations_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_scope_filter: input.scope,
      p_query: input.query,
      p_cursor_last_message_at: cursor?.lastMessageAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: input.limit,
    });
    if (error) mapRpcError(error);
    const payload = data as {
      items: never[];
      next_cursor: { last_message_at: string | null; id: string } | null;
    };
    const items = (payload.items ?? []).map((row) => mapConversationListItem(row));
    return buildListResponse(
      items,
      payload.next_cursor
        ? {
            lastMessageAt: payload.next_cursor.last_message_at,
            id: payload.next_cursor.id,
          }
        : null,
      input.scope,
      input.query,
    );
  },

  async loadConversation(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_load_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_message_limit: input.messageLimit,
    });
    if (error) mapRpcError(error);
    const payload = data as {
      conversation: never;
      branches: Record<string, unknown>[];
      messages: Record<string, unknown>[];
    };
    return mapConversationDetail(payload);
  },

  async renameConversation(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_rename_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_expected_revision: input.expectedRevision,
      p_title: input.title,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async listBranches(context, chatId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_branches_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
    });
    if (error) mapRpcError(error);
    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      conversationId: String(row.conversation_id),
      createdByUserId: String(row.created_by_user_id),
      parentBranchId: (row.parent_branch_id as string | null) ?? null,
      forkedFromMessageVersionId: (row.forked_from_message_version_id as string | null) ?? null,
      activeLeafVersionId: (row.active_leaf_version_id as string | null) ?? null,
      forkReason: (row.fork_reason as string | null) ?? null,
      status: (row.status as AiChatBranchDto["status"] | undefined) ?? "active",
      revision: Number(row.revision),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async activateBranch(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_activate_branch_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_branch_id: input.branchId,
      p_expected_revision: input.expectedRevision,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async searchAccessibleClients(context, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_search_accessible_clients_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_query: input.query,
      p_limit: input.limit,
    });
    if (error) mapRpcError(error);
    return (data as Array<{ id: string; full_name: string; primary_channel: string | null }>).map((row) => {
      const displayReference = encodeClientReferenceCode(row.id);
      return {
        id: row.id,
        fullName: row.full_name,
        displayReference,
        shortDisplay: formatClientReferenceShort(displayReference),
        channel: row.primary_channel,
      };
    });
  },

  async sendMessage(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_send_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_expected_revision: input.expectedRevision,
      p_body: input.body,
      p_branch_id: input.branchId,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
      p_attachment_ids: input.attachmentIds ?? [],
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      messageId: String(row.message_id),
      messageVersionId: String(row.message_version_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async editMessage(context, messageId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_edit_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_message_id: messageId,
      p_expected_revision: input.expectedRevision,
      p_body: input.body,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      branchId: String(row.branch_id),
      messageId: String(row.message_id),
      messageVersionId: String(row.message_version_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async regenerateMessage(context, messageId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_regenerate_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_message_id: messageId,
      p_expected_revision: input.expectedRevision,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      branchId: String(row.branch_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async stopRun(context, runId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_stop_run_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_run_id: runId,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    const row = data as Record<string, unknown>;
    return { runId, status: row.status as AiChatStopRunResult["status"] };
  },

  async listRunEvents(context, runId, afterSequence) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_run_events_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_run_id: runId,
      p_after_sequence: afterSequence,
    });
    if (error) mapRpcError(error);
    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      runId: String(row.run_id),
      conversationId: String(row.conversation_id),
      sequenceNumber: Number(row.sequence_number),
      eventType: String(row.event_type),
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    }));
  },

  async getRunById(tenantId, runId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", runId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      conversationId: String(data.conversation_id),
      createdByUserId: String(data.created_by_user_id),
      triggerMessageVersionId: String(data.trigger_message_version_id),
      status: data.status,
      answerability: data.answerability,
      riskLevel: data.risk_level,
      safetyOutcome: data.safety_outcome,
      cancelRequestedAt: data.cancel_requested_at,
      errorCode: data.error_code,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  },

  async getMessageVersionById(tenantId, versionId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_message_versions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", versionId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      conversationId: String(data.conversation_id),
      messageId: String(data.message_id),
      branchId: String(data.branch_id),
      createdByUserId: String(data.created_by_user_id),
      body: String(data.body),
      bodySha256: String(data.body_sha256),
      parentVersionId: data.parent_version_id,
      supersedesVersionId: data.supersedes_version_id,
      runId: data.run_id,
      contentStatus: data.content_status,
      createdAt: String(data.created_at),
    };
  },

  async getBranchMessageChain(tenantId, branchId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_get_branch_chain_v1", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
    });
    if (error) mapRpcError(error);
    return (data as Array<Record<string, unknown>>).map((row) => ({
      messageId: String(row.message_id),
      role: row.role as "user" | "assistant",
      activeBody: String(row.body),
      versionId: String(row.version_id),
    }));
  },

  async claimNextAiChatJob(workerId, leaseMs) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_claim_ai_chat_job_v1", {
      p_worker_id: workerId,
      p_lease_ms: leaseMs,
    });
    if (error) mapRpcError(error);
    const row = (data as Record<string, unknown>[])?.[0];
    if (!row) return null;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      jobType: row.job_type as AiChatJobRecord["jobType"],
      runId: (row.run_id as string | null) ?? null,
      conversationId: String(row.conversation_id),
      createdByUserId: String(row.created_by_user_id),
      status: row.status as AiChatJobRecord["status"],
      payload: (row.payload as Record<string, unknown>) ?? {},
      leaseOwner: (row.lease_owner as string | null) ?? null,
      leaseToken: (row.lease_token as string | null) ?? null,
      leaseExpiresAt: (row.lease_expires_at as string | null) ?? null,
      heartbeatAt: (row.heartbeat_at as string | null) ?? null,
      retryCount: Number(row.retry_count ?? 0),
      nextAttemptAt: String(row.next_attempt_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  },

  async completeAiChatJob(jobId, workerId, leaseToken) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_complete_ai_chat_job_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
    });
  },

  async failAiChatJob(jobId, workerId, leaseToken, errorCode) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_fail_ai_chat_job_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_error_code: errorCode,
    });
  },

  async renewJobLease(jobId, workerId, leaseToken, leaseMs) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_renew_ai_chat_job_lease_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_lease_ms: leaseMs,
    });
  },

  async shouldAbortRun(tenantId, runId) {
    const run = await supabaseAiChatStore.getRunById(tenantId, runId);
    if (!run) return true;
    return ["cancel_requested", "superseded", "stopped", "failed", "completed"].includes(run.status);
  },

  async updateRunStatus(tenantId, runId, status) {
    const supabase = requireSupabaseAdmin();
    await supabase
      .from("ai_chat_runs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", runId);
  },

  async appendRunEvent(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_append_run_event_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_event_type: input.eventType,
      p_payload: input.payload,
    });
    if (error) mapRpcError(error);
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      runId: String(row.run_id),
      conversationId: String(row.conversation_id),
      sequenceNumber: Number(row.sequence_number),
      eventType: String(row.event_type),
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    };
  },

  async finalizeRun(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_finalize_run_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_status: input.status,
      p_answerability: input.answerability ?? null,
      p_risk_level: input.riskLevel ?? null,
      p_error_code: input.errorCode ?? null,
    });
  },

  async commitAssistantMessage(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_commit_assistant_message_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_body: input.body,
      p_answerability: input.answerability,
      p_risk_level: input.riskLevel,
      p_completion_state: input.completionState ?? "complete",
    });
  },

  async enqueueTitleJob(tenantId, conversationId, userId) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_enqueue_title_job_v1", {
      p_tenant_id: tenantId,
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
  },

  async applyAutoTitleIfEligible(tenantId, conversationId, maxLength) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_apply_auto_title_v1", {
      p_tenant_id: tenantId,
      p_conversation_id: conversationId,
      p_max_length: maxLength,
    });
  },

  async getConversationRecord(tenantId, conversationId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_conversations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", conversationId)
      .maybeSingle();
    if (error) mapRpcError(error);
    if (!data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      createdByUserId: String(data.created_by_user_id),
      createdByDietitianId: String(data.created_by_dietitian_id),
      scopeType: data.scope_type as AiChatScopeType,
      clientId: (data.client_id as string | null) ?? null,
      title: String(data.title),
      titleSource: data.title_source as AiChatConversationRecord["titleSource"],
      status: data.status as AiChatConversationRecord["status"],
      activeBranchId: (data.active_branch_id as string | null) ?? null,
      revision: Number(data.revision),
      lastMessageAt: (data.last_message_at as string | null) ?? null,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  },

  async getContextGatewayAccess(input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_get_context_gateway_access_v1", {
      p_tenant_id: input.tenantId,
      p_user_id: input.userId,
      p_dietitian_id: input.dietitianId,
      p_role: input.role,
      p_scope_type: input.scopeType,
      p_client_id: input.clientId,
      p_conversation_revision: input.conversationRevision,
    });
    if (error) mapRpcError(error);
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      authorized: Boolean(row.authorized),
      clientId: (row.client_id as string | null) ?? null,
      revisionToken: String(row.revision_token ?? ""),
      checkedAt: String(row.checked_at ?? new Date().toISOString()),
    };
  },

  async listContextGatewayAccessibleClients(tenantId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_context_gateway_clients_v1", {
      p_tenant_id: tenantId,
    });
    if (error) mapRpcError(error);
    return ((data as Array<Record<string, unknown>>) ?? []).map((row) =>
      toAccessibleClientIdentity({
        id: String(row.id),
        fullName: String(row.full_name),
      }),
    );
  },

  async executeContextGatewayTool(input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_execute_context_tool_v1", {
      p_tenant_id: input.tenantId,
      p_client_id: input.clientId,
      p_tool_name: input.tool,
      p_args: input.args,
    });
    if (error) mapRpcError(error);
    const row = (data ?? {}) as Record<string, unknown>;
    const status = (row.status as ContextToolExecutionStatus | undefined) ?? undefined;
    return normalizeContextToolExecutionResult(input.tool, {
      status,
      ok: row.ok === undefined ? undefined : Boolean(row.ok),
      errorCode: (row.error_code as string | undefined) ?? undefined,
      rows: ((row.rows as Array<Record<string, unknown>>) ?? []).map((item) => ({
        sourceId: String(item.source_id),
        clientId: String(item.client_id ?? ""),
        sourceType: item.source_type as ContextToolExecutionResult["rows"][number]["sourceType"],
        locator: (item.locator as string | null) ?? null,
        excerpt: String(item.excerpt ?? ""),
        contentHash: (item.content_hash as string | null) ?? null,
        sourceDate: (item.source_date as string | null) ?? null,
        updatedAt: (item.updated_at as string | null) ?? null,
        occurredAt: (item.occurred_at as string | null) ?? null,
        lifecycleStatus: item.lifecycle_status as ContextToolExecutionResult["rows"][number]["lifecycleStatus"],
        retrievalEligible: Boolean(item.retrieval_eligible),
        authorityWeight: Number(item.authority_weight ?? 1),
      })),
      categoryFailed: row.category_failed === undefined ? undefined : Boolean(row.category_failed),
      categoryCritical: row.category_critical === undefined ? undefined : Boolean(row.category_critical),
    });
  },

  async saveContextSnapshot(input) {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.rpc("p85_stage_4c_save_context_snapshot_v1", {
      p_tenant_id: input.tenantId,
      p_run_id: input.runId,
      p_conversation_id: input.conversationId,
      p_created_by_user_id: input.createdByUserId,
      p_source_identity_refs: input.sourceIdentityRefs,
      p_freshness_metadata: input.freshnessMetadata,
      p_evidence_excerpts: input.evidenceExcerpts,
    });
    if (error) mapRpcError(error);
  },

  async searchApprovedClinicalSources(tenantId, query, limit = 5) {
    void tenantId;
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_search_approved_sources_v1", {
      p_query: query,
      p_limit: limit,
    });
    if (error) mapRpcError(error);
    return ((data as Array<Record<string, unknown>>) ?? []).map((item) => ({
      sourceRefId: String(item.source_ref_id),
      sourceType: "approved_clinical_source" as const,
      canonicalEntityId: String(item.canonical_entity_id),
      locator: String(item.locator),
      excerpt: String(item.excerpt ?? ""),
      title: String(item.title ?? ""),
      publisher: String(item.publisher ?? ""),
      sourceUrl: String(item.source_url ?? ""),
      sourceDate: (item.source_date as string | null) ?? null,
      contentHash: String(item.content_hash ?? ""),
    }));
  },

  async persistRunAnswerArtifacts(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    const { error: envelopeError } = await supabase.rpc("p85_stage_4c_save_answer_envelope_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_conversation_id: input.conversationId,
      p_created_by_user_id: input.createdByUserId,
      p_direct_answer: input.directAnswer,
      p_answerability: input.answerability,
      p_risk_level: input.riskLevel,
      p_claims: input.claims,
    });
    if (envelopeError) mapRpcError(envelopeError);
    if (input.sourceRefs.length > 0) {
      const { error: sourceError } = await supabase.rpc("p85_stage_4c_persist_run_source_refs_v1", {
        p_tenant_id: tenantId,
        p_run_id: runId,
        p_conversation_id: input.conversationId,
        p_created_by_user_id: input.createdByUserId,
        p_client_id: input.clientId,
        p_source_refs: input.sourceRefs.map((item) => ({
          sourceRefId: item.sourceRefId,
          sourceType: item.sourceType,
          canonicalEntityId: item.canonicalEntityId,
          locator: item.locator,
          sourceDate: item.sourceDate,
          contentHash: item.contentHash,
          claimId: item.claimId ?? null,
        })),
      });
      if (sourceError) mapRpcError(sourceError);
    }
  },

  async listRunSources(tenantId, runId, userId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_run_sources_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_user_id: userId,
    });
    if (error) mapRpcError(error);
    const row = (data ?? {}) as AiChatRunSourcesResponse;
    return {
      runId: String(row.runId ?? runId),
      claims: (row.claims as AiChatRunSourceClaimDto[]) ?? [],
      sources: (row.sources as AiChatRunSourcesResponse["sources"]) ?? [],
    };
  },

  async createAttachmentUploadSession(context, input) {
    return supabaseCreateAttachmentUploadSession(requireSupabaseAdmin(), context, input);
  },
  async completeAttachmentUpload(context, attachmentId, input) {
    return supabaseCompleteAttachmentUpload(requireSupabaseAdmin(), context, attachmentId, input);
  },
  async putAttachmentObjectBytes(_context, _attachmentId, _uploadToken, _bytes) {
    throw new AppRequestError(409, "ai_chat_attachment_direct_upload_unsupported");
  },
  async listConversationAttachments(context, conversationId) {
    return supabaseListConversationAttachments(requireSupabaseAdmin(), context, conversationId);
  },
  async getAttachmentById(context, attachmentId) {
    return supabaseGetAttachmentById(requireSupabaseAdmin(), context, attachmentId);
  },
  async getAttachmentRecordById(attachmentId) {
    return supabaseGetAttachmentRecordById(requireSupabaseAdmin(), attachmentId);
  },
  async deleteAttachment(context, attachmentId) {
    await supabaseDeleteAttachment(requireSupabaseAdmin(), context, attachmentId);
  },
  async updateAttachmentStatus(attachmentId, status, failureCode, meta) {
    const record = await supabaseGetAttachmentRecordById(requireSupabaseAdmin(), attachmentId);
    if (!record) return;
    await supabaseUpdateAttachmentStatus(
      requireSupabaseAdmin(),
      record.tenantId,
      attachmentId,
      record.status,
      status,
      failureCode,
      meta,
    );
  },
  async saveAttachmentDerivative(input) {
    const record = await supabaseGetAttachmentRecordById(requireSupabaseAdmin(), input.attachmentId);
    if (!record) return;
    await supabaseSaveAttachmentDerivative(requireSupabaseAdmin(), {
      tenantId: record.tenantId,
      ...input,
    });
  },
  async acceptAttachmentDerivativeCorrection(context, attachmentId, derivativeId, input) {
    return supabaseAcceptAttachmentDerivativeCorrection(
      requireSupabaseAdmin(),
      context,
      attachmentId,
      derivativeId,
      input.correctedText,
    );
  },
  async transferAttachmentToClientRecord(context, attachmentId, input) {
    return supabaseTransferAttachmentToClientRecord(requireSupabaseAdmin(), context, attachmentId, input);
  },
  async enqueueAttachmentScanJob(tenantId, conversationId, attachmentId, userId) {
    await supabaseEnqueueAttachmentJob(
      requireSupabaseAdmin(),
      tenantId,
      conversationId,
      attachmentId,
      userId,
      "attachment_scan",
    );
  },
  async enqueueAttachmentParseJob(tenantId, conversationId, attachmentId, userId) {
    await supabaseEnqueueAttachmentJob(
      requireSupabaseAdmin(),
      tenantId,
      conversationId,
      attachmentId,
      userId,
      "attachment_parse",
    );
  },
  async enqueueAttachmentCleanupJob(tenantId, conversationId, attachmentId, userId) {
    await supabaseEnqueueAttachmentJob(
      requireSupabaseAdmin(),
      tenantId,
      conversationId,
      attachmentId,
      userId ?? "system",
      "attachment_cleanup",
    );
  },
  async getAttachmentObjectBytes(objectKey) {
    return supabaseGetAttachmentObjectBytes(requireSupabaseAdmin(), objectKey);
  },
  async listMessageAttachmentDerivatives(tenantId, messageVersionId) {
    return supabaseListMessageAttachmentDerivatives(requireSupabaseAdmin(), tenantId, messageVersionId);
  },
  async getRunRiskSummary(tenantId, runId, userId) {
    const run = await supabaseAiChatStore.getRunById(tenantId, runId);
    if (!run || run.createdByUserId !== userId) return null;
    const conversation = await supabaseAiChatStore.getConversationRecord(tenantId, run.conversationId);
    if (!conversation) return null;
    const context: AppTenantContext = {
      tenantId,
      userId,
      dietitianId: conversation.createdByDietitianId,
      role: "dietitian",
    };
    const result = await supabaseGetRunRiskSummary(requireSupabaseAdmin(), context, runId);
    if (!result) return null;
    return {
      ...result.summary,
      clientContextRevision: result.clientContextRevision,
    };
  },
  async listRunDraftDestinations(context, runId) {
    return supabaseListRunDraftDestinations(requireSupabaseAdmin(), context, runId);
  },
  async transferRunDraft(context, runId, input) {
    return supabaseTransferRunDraft(requireSupabaseAdmin(), context, runId, input);
  },
  async createRunHandoff(context, runId, input) {
    requireHandoffCapability(context);
    return supabaseCreateRunHandoff(requireSupabaseAdmin(), context, runId, input);
  },
  async getPendingComposerDraftTransfer(tenantId, destinationConversationId) {
    const supabase = requireSupabaseAdmin();
    const { data } = await supabase
      .from("ai_chat_draft_transfers")
      .select("created_by_user_id")
      .eq("tenant_id", tenantId)
      .eq("destination_conversation_id", destinationConversationId)
      .eq("status", "pending")
      .eq("transfer_mode", "composer_pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.created_by_user_id) return null;
    return supabaseGetPendingComposerDraftTransfer(
      supabase,
      tenantId,
      String(data.created_by_user_id),
      destinationConversationId,
    );
  },
  async consumeComposerDraftTransfer(input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_draft_transfers")
      .select("created_by_user_id")
      .eq("tenant_id", input.tenantId)
      .eq("id", input.transferId)
      .maybeSingle();
    if (error || !data?.created_by_user_id) {
      throw new AppRequestError(409, "ai_chat_draft_transfer_unavailable");
    }
    await supabaseConsumeComposerDraftTransfer(supabase, {
      tenantId: input.tenantId,
      userId: String(data.created_by_user_id),
      transferId: input.transferId,
      destinationConversationId: input.destinationConversationId,
      destinationClientId: input.destinationClientId,
    });
  },
  async applyRunRiskPipeline(input) {
    const supabase = requireSupabaseAdmin();
    const conversation = await supabaseAiChatStore.getConversationRecord(input.tenantId, input.conversationId);
    if (!conversation) return;
    const context: AppTenantContext = {
      tenantId: input.tenantId,
      userId: input.createdByUserId,
      dietitianId: conversation.createdByDietitianId,
      role: "dietitian",
    };
    const assessment = await supabaseApplyRunRiskPipeline(supabase, context, input);
    await supabaseAiChatStore.appendRunEvent(input.tenantId, input.runId, {
      eventType: "risk.updated",
      payload: {
        riskLevel: assessment.riskLevel,
        reasons: assessment.reasons,
        confidenceClass: assessment.confidenceClass,
        hypotheticalRed: assessment.hypotheticalRed,
      },
    });
  },
  async deleteConversation(context, chatId, input) {
    return supabaseDeleteConversation(requireSupabaseAdmin(), context, chatId, input);
  },
  async deleteMessage(context, messageId, input) {
    return supabaseDeleteMessage(requireSupabaseAdmin(), context, messageId, input);
  },
  async processLifecycleDeletionBatch(limit = 4) {
    return supabaseProcessLifecycleDeletionBatch(requireSupabaseAdmin(), limit);
  },
  async runLifecycleRetentionSweeps() {
    await supabaseRunLifecycleRetentionSweeps(requireSupabaseAdmin());
  },
  async enqueueClientScopedDeletions(context, clientId, reason) {
    await supabaseEnqueueClientScopedDeletions(requireSupabaseAdmin(), context, clientId, reason);
  },
  async buildClientScopedExportSlice(clientId) {
    const supabase = requireSupabaseAdmin();
    const { data } = await supabase
      .from("ai_chat_conversations")
      .select("tenant_id, created_by_user_id, created_by_dietitian_id")
      .eq("client_id", clientId)
      .eq("scope_type", "client")
      .limit(1)
      .maybeSingle();
    if (!data?.tenant_id || !data.created_by_user_id) {
      return { conversations: [], messages: [], sourceManifest: [], clientRecordAssets: [] };
    }
    const context: AppTenantContext = {
      tenantId: String(data.tenant_id),
      userId: String(data.created_by_user_id),
      dietitianId: String(data.created_by_dietitian_id),
      role: "dietitian",
    };
    return supabaseBuildClientScopedExportSlice(supabase, context, clientId);
  },
};

let supabaseCoreContractReady = false;

export function assertSupabaseAiChatCoreContractReady() {
  if (supabaseCoreContractReady) return;
  const source = Function.prototype.toString.call(supabaseAiChatStore.sendMessage);
  const applyRiskSource = Function.prototype.toString.call(supabaseApplyRunRiskPipeline);
  const deleteConversationSource = Function.prototype.toString.call(supabaseDeleteConversation);
  const deleteMessageSource = Function.prototype.toString.call(supabaseDeleteMessage);
  if (!source.includes("p85_stage_4c_send_message_v1")) {
    throw new AppRequestError(503, "ai_chat_store_contract_incomplete");
  }
  if (!applyRiskSource.includes("p85_stage_4c_apply_run_risk_pipeline_v1")) {
    throw new AppRequestError(503, "ai_chat_store_contract_incomplete");
  }
  if (!deleteConversationSource.includes("p85_stage_4c_delete_conversation_v1")) {
    throw new AppRequestError(503, "ai_chat_store_contract_incomplete");
  }
  if (!deleteMessageSource.includes("p85_stage_4c_delete_message_v1")) {
    throw new AppRequestError(503, "ai_chat_store_contract_incomplete");
  }
  supabaseCoreContractReady = true;
}
