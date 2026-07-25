import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import {
  AI_CHAT_ATTACHMENT_BUCKET,
  buildClientRecordObjectKey,
  hashAttachmentBytes,
} from "./phase-85-stage-4c-attachments";
import type { AiChatAttachmentDto } from "./phase-85-stage-4c-contracts";
import { mapRpcError } from "./phase-85-stage-4c-service";

export const STAGE_4C_SUPABASE_ATTACHMENTS_VERSION = "p85-stage-4c-supabase-attachments-v1";

const CLIENT_RECORD_BUCKET = "p85-stage-4c-client-records";

export function mapAttachmentDtoFromRpc(row: Record<string, unknown>): AiChatAttachmentDto {
  const derivatives = ((row.derivatives as Array<Record<string, unknown>>) ?? []).map((item) => ({
    id: String(item.id),
    attachmentId: String(item.attachment_id ?? item.attachmentId ?? row.id),
    kind: item.kind as AiChatAttachmentDto["derivatives"][number]["kind"],
    status: item.status as AiChatAttachmentDto["derivatives"][number]["status"],
    excerpt: (item.excerpt as string | null) ?? null,
    locator: (item.locator as string | null) ?? null,
    confidence: item.confidence == null ? null : Number(item.confidence),
    createdAt: String(item.created_at ?? item.createdAt),
  }));
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    conversationId: String(row.conversation_id ?? row.conversationId),
    createdByUserId: String(row.created_by_user_id ?? row.createdByUserId),
    scopeType: (row.scope_type ?? row.scopeType) as AiChatAttachmentDto["scopeType"],
    clientId: (row.client_id as string | null) ?? (row.clientId as string | null) ?? null,
    kind: row.kind as AiChatAttachmentDto["kind"],
    fileName: String(row.file_name ?? row.fileName),
    mimeType: String(row.mime_type ?? row.mimeType),
    byteSize: Number(row.byte_size ?? row.byteSize),
    contentSha256: String(row.content_sha256 ?? row.contentSha256),
    status: row.status as AiChatAttachmentDto["status"],
    failureCode: (row.failure_code as string | null) ?? null,
    pageCount: row.page_count == null ? null : Number(row.page_count),
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    derivatives,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

async function verifyStorageObjectBytes(
  supabase: SupabaseClient,
  bucket: string,
  objectKey: string,
  expectedSize: number,
  expectedSha256: string,
) {
  const { data, error } = await supabase.storage.from(bucket).download(objectKey);
  if (error || !data) {
    throw new AppRequestError(409, "ai_chat_attachment_object_missing");
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength !== expectedSize) {
    throw new AppRequestError(400, "ai_chat_attachment_size_mismatch");
  }
  if (hashAttachmentBytes(bytes) !== expectedSha256) {
    throw new AppRequestError(400, "ai_chat_attachment_hash_mismatch");
  }
}

export async function supabaseCreateAttachmentUploadSession(
  supabase: SupabaseClient,
  context: AppTenantContext,
  input: {
    conversationId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    contentSha256: string;
  },
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_create_attachment_upload_session_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_conversation_id: input.conversationId,
    p_file_name: input.fileName,
    p_mime_type: input.mimeType,
    p_byte_size: input.byteSize,
    p_content_sha256: input.contentSha256,
  });
  if (error) mapRpcError(error);
  const payload = (data ?? {}) as Record<string, unknown>;
  const attachment = mapAttachmentDtoFromRpc((payload.attachment ?? {}) as Record<string, unknown>);
  const objectKey = String(payload.object_key ?? attachment.id);
  const uploadToken = String(payload.upload_token ?? "");
  const expiresAt = String(payload.upload_expires_at ?? "");
  const { data: signed, error: signedError } = await supabase.storage
    .from(AI_CHAT_ATTACHMENT_BUCKET)
    .createSignedUploadUrl(objectKey);
  if (signedError || !signed?.signedUrl) {
    throw new AppRequestError(503, "ai_chat_attachment_store_unavailable");
  }
  return {
    attachment,
    uploadUrl: signed.signedUrl,
    uploadToken,
    expiresAt,
    objectKey,
  };
}

export async function supabaseCompleteAttachmentUpload(
  supabase: SupabaseClient,
  context: AppTenantContext,
  attachmentId: string,
  input: { contentSha256: string; uploadToken?: string },
) {
  const record = await supabaseGetAttachmentRecordById(supabase, attachmentId);
  if (!record || record.createdByUserId !== context.userId || record.tenantId !== context.tenantId) {
    throw new AppRequestError(404, "ai_chat_attachment_not_found");
  }
  if (record.contentSha256 !== input.contentSha256) {
    throw new AppRequestError(400, "ai_chat_attachment_hash_mismatch");
  }
  await verifyStorageObjectBytes(
    supabase,
    AI_CHAT_ATTACHMENT_BUCKET,
    record.objectKey,
    record.byteSize,
    record.contentSha256,
  );

  const { data, error } = await supabase.rpc("p85_stage_4c_complete_attachment_upload_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_attachment_id: attachmentId,
    p_upload_token: input.uploadToken ?? null,
  });
  if (error) mapRpcError(error);
  const attachment = mapAttachmentDtoFromRpc((data ?? {}) as Record<string, unknown>);
  await supabaseEnqueueAttachmentJob(
    supabase,
    context.tenantId,
    attachment.conversationId,
    attachmentId,
    context.userId,
    "attachment_scan",
  );
  return attachment;
}

export async function supabaseGetAttachmentById(
  supabase: SupabaseClient,
  context: AppTenantContext,
  attachmentId: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_get_attachment_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_attachment_id: attachmentId,
  });
  if (error) mapRpcError(error);
  return mapAttachmentDtoFromRpc((data ?? {}) as Record<string, unknown>);
}

export async function supabaseListConversationAttachments(
  supabase: SupabaseClient,
  context: AppTenantContext,
  conversationId: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_list_conversation_attachments_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_conversation_id: conversationId,
  });
  if (error) mapRpcError(error);
  return ((data as Array<Record<string, unknown>>) ?? []).map((row) => mapAttachmentDtoFromRpc(row));
}

export async function supabaseDeleteAttachment(
  supabase: SupabaseClient,
  context: AppTenantContext,
  attachmentId: string,
) {
  const { error } = await supabase.rpc("p85_stage_4c_delete_attachment_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_attachment_id: attachmentId,
  });
  if (error) mapRpcError(error);
}

export async function supabaseUpdateAttachmentStatus(
  supabase: SupabaseClient,
  tenantId: string,
  attachmentId: string,
  expectedStatus: string,
  newStatus: string,
  failureCode?: string | null,
  meta?: { pageCount?: number | null; durationSec?: number | null },
) {
  const { error } = await supabase.rpc("p85_stage_4c_update_attachment_status_v1", {
    p_tenant_id: tenantId,
    p_attachment_id: attachmentId,
    p_expected_status: expectedStatus,
    p_new_status: newStatus,
    p_failure_code: failureCode ?? null,
    p_page_count: meta?.pageCount ?? null,
    p_duration_sec: meta?.durationSec ?? null,
  });
  if (error) mapRpcError(error);
}

export async function supabaseSaveAttachmentDerivative(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    attachmentId: string;
    kind: string;
    status: string;
    contentSha256: string | null;
    excerpt: string | null;
    locator: Record<string, unknown>;
    confidence: number | null;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.rpc("p85_stage_4c_save_attachment_derivative_v1", {
    p_tenant_id: input.tenantId,
    p_attachment_id: input.attachmentId,
    p_kind: input.kind,
    p_status: input.status,
    p_content_sha256: input.contentSha256,
    p_excerpt: input.excerpt,
    p_locator: input.locator,
    p_confidence: input.confidence,
    p_payload: input.payload ?? {},
  });
  if (error) mapRpcError(error);
}

export async function supabaseAcceptAttachmentDerivativeCorrection(
  supabase: SupabaseClient,
  context: AppTenantContext,
  attachmentId: string,
  derivativeId: string,
  correctedText: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_accept_attachment_derivative_correction_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_attachment_id: attachmentId,
    p_derivative_id: derivativeId,
    p_corrected_text: correctedText,
  });
  if (error) mapRpcError(error);
  return mapAttachmentDtoFromRpc((data ?? {}) as Record<string, unknown>);
}

export async function supabaseTransferAttachmentToClientRecord(
  supabase: SupabaseClient,
  context: AppTenantContext,
  attachmentId: string,
  input: { clientId: string; category: string; title: string; previewAccepted: boolean },
) {
  const record = await supabaseGetAttachmentRecordById(supabase, attachmentId);
  if (!record) throw new AppRequestError(404, "ai_chat_attachment_not_found");
  const sourceBytes = await supabaseGetAttachmentObjectBytes(supabase, record.objectKey);
  if (!sourceBytes) throw new AppRequestError(409, "ai_chat_attachment_object_missing");

  const { data, error } = await supabase.rpc("p85_stage_4c_transfer_attachment_to_client_record_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_attachment_id: attachmentId,
    p_client_id: input.clientId,
    p_category: input.category,
    p_title: input.title,
    p_preview_accepted: input.previewAccepted,
  });
  if (error) mapRpcError(error);
  const payload = (data ?? {}) as Record<string, unknown>;
  const assetId = String(payload.asset_id ?? payload.assetId ?? "");
  const destKey = buildClientRecordObjectKey(context.tenantId, input.clientId, assetId);
  const { error: uploadError } = await supabase.storage
    .from(CLIENT_RECORD_BUCKET)
    .upload(destKey, sourceBytes, { upsert: false, contentType: record.mimeType });
  if (uploadError) {
    throw new AppRequestError(503, "ai_chat_attachment_store_unavailable");
  }
  return {
    assetId,
    objectKey: destKey,
  };
}

export async function supabaseEnqueueAttachmentJob(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
  attachmentId: string,
  userId: string,
  jobType: "attachment_scan" | "attachment_parse" | "attachment_cleanup",
) {
  const { error } = await supabase.rpc("p85_stage_4c_enqueue_attachment_job_v1", {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_conversation_id: conversationId,
    p_job_type: jobType,
    p_attachment_id: attachmentId,
  });
  if (error) mapRpcError(error);
}

export async function supabaseGetAttachmentRecordById(supabase: SupabaseClient, attachmentId: string) {
  const { data, error } = await supabase
    .from("ai_chat_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    tenantId: String(data.tenant_id),
    conversationId: String(data.conversation_id),
    createdByUserId: String(data.created_by_user_id),
    scopeType: data.scope_type as "general" | "client",
    clientId: (data.client_id as string | null) ?? null,
    kind: data.kind as "image" | "document" | "audio",
    mimeType: String(data.mime_type),
    fileName: String(data.file_name),
    byteSize: Number(data.byte_size),
    contentSha256: String(data.content_sha256),
    objectKey: String(data.object_key),
    status: data.status as AiChatAttachmentDto["status"],
    pageCount: data.page_count == null ? null : Number(data.page_count),
    durationSec: data.duration_sec == null ? null : Number(data.duration_sec),
  };
}

export async function supabaseGetAttachmentObjectBytes(supabase: SupabaseClient, objectKey: string) {
  const { data, error } = await supabase.storage.from(AI_CHAT_ATTACHMENT_BUCKET).download(objectKey);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function supabaseListMessageAttachmentDerivatives(
  supabase: SupabaseClient,
  tenantId: string,
  messageVersionId: string,
) {
  const { data, error } = await supabase.rpc("p85_stage_4c_list_message_attachment_derivatives_v1", {
    p_tenant_id: tenantId,
    p_message_version_id: messageVersionId,
  });
  if (error) mapRpcError(error);
  return ((data as Array<Record<string, unknown>>) ?? []).map((item) => ({
    derivativeId: String(item.id),
    attachmentId: String(item.attachment_id),
    excerpt: String(item.excerpt ?? ""),
    contentHash: (item.content_sha256 as string | null) ?? null,
    locator: (item.locator as string | null) ?? null,
    kind: String(item.kind),
  }));
}
