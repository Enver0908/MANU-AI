import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppTenantContext } from "./auth-context";
import {
  AI_CHAT_DELETION_DB_BATCH_SIZE,
  AI_CHAT_DELETION_STORAGE_BATCH_SIZE,
} from "./phase-85-stage-4c-contracts";
import { AI_CHAT_ATTACHMENT_BUCKET } from "./phase-85-stage-4c-attachments";
import {
  resolveAiChatDeletionHmacSecret,
} from "./phase-85-stage-4c-lifecycle";
import type {
  AiChatClientScopedExportSlice,
  AiChatDeleteConversationInput,
  AiChatDeleteConversationResult,
  AiChatDeleteMessageInput,
  AiChatDeleteMessageResult,
} from "./phase-85-stage-4c-contracts";
import { canonicalAiChatBodyHash, mapRpcError } from "./phase-85-stage-4c-service";

export const STAGE_4C_SUPABASE_LIFECYCLE_VERSION = "p85-stage-4c-supabase-lifecycle-v1";

function mapDeleteConversationResult(row: Record<string, unknown>): AiChatDeleteConversationResult {
  return {
    chatId: String(row.chat_id ?? row.chatId),
    deletionJobId: String(row.deletion_job_id ?? row.deletionJobId),
    status: "deleting",
    conversationRevision: Number(row.conversation_revision ?? row.conversationRevision),
  };
}

function mapDeleteMessageResult(row: Record<string, unknown>): AiChatDeleteMessageResult {
  return {
    messageId: String(row.message_id ?? row.messageId),
    deletionJobId: String(row.deletion_job_id ?? row.deletionJobId),
    conversationId: String(row.conversation_id ?? row.conversationId),
    conversationRevision: Number(row.conversation_revision ?? row.conversationRevision),
  };
}

function mapClientScopedExportSlice(row: Record<string, unknown>): AiChatClientScopedExportSlice {
  const conversations = Array.isArray(row.conversations) ? row.conversations : [];
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const sourceManifest = Array.isArray(row.sourceManifest) ? row.sourceManifest : [];
  const clientRecordAssets = Array.isArray(row.clientRecordAssets) ? row.clientRecordAssets : [];
  return {
    conversations: conversations.map((item) => {
      const rowItem = item as Record<string, unknown>;
      return {
        id: String(rowItem.id),
        title: String(rowItem.title ?? ""),
        scopeType: (rowItem.scopeType ?? rowItem.scope_type) as AiChatClientScopedExportSlice["conversations"][number]["scopeType"],
        clientId: (rowItem.clientId as string | null) ?? (rowItem.client_id as string | null) ?? null,
        lastMessageAt: (rowItem.lastMessageAt as string | null) ?? (rowItem.last_message_at as string | null) ?? null,
        createdAt: String(rowItem.createdAt ?? rowItem.created_at ?? ""),
      };
    }),
    messages: messages.map((item) => {
      const rowItem = item as Record<string, unknown>;
      return {
        id: String(rowItem.id),
        conversationId: String(rowItem.conversationId ?? rowItem.conversation_id),
        role: (rowItem.role) as AiChatClientScopedExportSlice["messages"][number]["role"],
        body: String(rowItem.body ?? ""),
        createdAt: String(rowItem.createdAt ?? rowItem.created_at ?? ""),
      };
    }),
    sourceManifest: sourceManifest.map((item) => {
      const rowItem = item as Record<string, unknown>;
      return {
        sourceRefId: String(rowItem.sourceRefId ?? rowItem.source_ref_id ?? rowItem.id),
        sourceType: (rowItem.sourceType ?? rowItem.source_type) as AiChatClientScopedExportSlice["sourceManifest"][number]["sourceType"],
        locator: (rowItem.locator as string | null) ?? null,
        sourceDate: (rowItem.sourceDate as string | null) ?? (rowItem.source_date as string | null) ?? null,
      };
    }),
    clientRecordAssets: clientRecordAssets.map((item) => {
      const rowItem = item as Record<string, unknown>;
      return {
        id: String(rowItem.id),
        category: String(rowItem.category ?? ""),
        title: String(rowItem.title ?? ""),
        sourceChatIdHash:
          (rowItem.sourceChatIdHash as string | null) ??
          (rowItem.source_chat_id_hash as string | null) ??
          null,
        createdAt: String(rowItem.createdAt ?? rowItem.created_at ?? ""),
      };
    }),
  };
}

function parseStorageKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return [];
}

export async function supabaseDeleteConversation(
  supabase: SupabaseClient,
  context: AppTenantContext,
  chatId: string,
  input: AiChatDeleteConversationInput,
): Promise<AiChatDeleteConversationResult> {
  const { data, error } = await supabase.rpc("p85_stage_4c_delete_conversation_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_chat_id: chatId,
    p_expected_revision: input.expectedRevision,
    p_request_id: input.requestId,
    p_body_hash: canonicalAiChatBodyHash(input),
    p_hmac_secret: resolveAiChatDeletionHmacSecret(),
  });
  if (error) mapRpcError(error, input.expectedRevision);
  return mapDeleteConversationResult((data ?? {}) as Record<string, unknown>);
}

export async function supabaseDeleteMessage(
  supabase: SupabaseClient,
  context: AppTenantContext,
  messageId: string,
  input: AiChatDeleteMessageInput,
): Promise<AiChatDeleteMessageResult> {
  const { data, error } = await supabase.rpc("p85_stage_4c_delete_message_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_message_id: messageId,
    p_expected_revision: input.expectedRevision,
    p_request_id: input.requestId,
    p_body_hash: canonicalAiChatBodyHash(input),
    p_hmac_secret: resolveAiChatDeletionHmacSecret(),
  });
  if (error) mapRpcError(error, input.expectedRevision);
  return mapDeleteMessageResult((data ?? {}) as Record<string, unknown>);
}

async function deleteStorageBatch(
  supabase: SupabaseClient,
  bucket: string,
  objectKeys: string[],
) {
  if (objectKeys.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(objectKeys);
  if (error) {
    throw error;
  }
}

export async function supabaseProcessLifecycleDeletionBatch(
  supabase: SupabaseClient,
  limit = 4,
): Promise<number> {
  const hmacSecret = resolveAiChatDeletionHmacSecret();
  let processed = 0;

  for (let index = 0; index < limit; index += 1) {
    const { data: claimed, error: claimError } = await supabase.rpc("p85_stage_4c_claim_deletion_job_v1", {
      p_tenant_id: null,
    });
    if (claimError) {
      mapRpcError(claimError);
    }
    if (!claimed || typeof claimed !== "object") {
      break;
    }

    const jobId = String((claimed as Record<string, unknown>).id);
    const { data: step, error: stepError } = await supabase.rpc("p85_stage_4c_process_deletion_job_step_v1", {
      p_job_id: jobId,
      p_hmac_secret: hmacSecret,
      p_db_batch_size: AI_CHAT_DELETION_DB_BATCH_SIZE,
      p_storage_batch_size: AI_CHAT_DELETION_STORAGE_BATCH_SIZE,
    });

    if (stepError) {
      await supabase.rpc("p85_stage_4c_fail_deletion_job_v1", {
        p_job_id: jobId,
        p_error_message: stepError.message ?? "ai_chat_deletion_step_failed",
      });
      processed += 1;
      continue;
    }

    const stepRow = (step ?? {}) as Record<string, unknown>;
    const storageKeys = parseStorageKeys(stepRow.storage_keys);
    const bucket = String(stepRow.storage_bucket ?? AI_CHAT_ATTACHMENT_BUCKET);

    if (storageKeys.length > 0) {
      try {
        await deleteStorageBatch(supabase, bucket, storageKeys);
      } catch (error) {
        await supabase.rpc("p85_stage_4c_fail_deletion_job_v1", {
          p_job_id: jobId,
          p_error_message: error instanceof Error ? error.message : "ai_chat_storage_delete_failed",
        });
        processed += 1;
        continue;
      }
    }

    if (stepRow.completed === true) {
      const { error: completeError } = await supabase.rpc("p85_stage_4c_complete_deletion_job_v1", {
        p_job_id: jobId,
        p_hmac_secret: hmacSecret,
      });
      if (completeError) {
        mapRpcError(completeError);
      }
    }

    if (stepRow.processed === true) {
      processed += 1;
    } else {
      break;
    }
  }

  return processed;
}

export async function supabaseRunLifecycleRetentionSweeps(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("p85_stage_4c_run_lifecycle_retention_sweep_v1", {
    p_tenant_id: null,
  });
  if (error) {
    mapRpcError(error);
  }
}

export async function supabaseEnqueueClientScopedDeletions(
  supabase: SupabaseClient,
  context: AppTenantContext,
  clientId: string,
  reason: "client_anonymization" | "client_removal",
) {
  const { error } = await supabase.rpc("p85_stage_4c_enqueue_client_scoped_deletions_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_client_id: clientId,
    p_reason: reason,
  });
  if (error) {
    mapRpcError(error);
  }
}

export async function supabaseBuildClientScopedExportSlice(
  supabase: SupabaseClient,
  context: AppTenantContext,
  clientId: string,
): Promise<AiChatClientScopedExportSlice> {
  const { data, error } = await supabase.rpc("p85_stage_4c_build_client_scoped_export_v1", {
    p_tenant_id: context.tenantId,
    p_client_id: clientId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_hmac_secret: resolveAiChatDeletionHmacSecret(),
  });
  if (error) {
    mapRpcError(error);
  }
  return mapClientScopedExportSlice((data ?? {}) as Record<string, unknown>);
}
