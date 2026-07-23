import { randomUUID } from "node:crypto";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import {
  AI_CHAT_ATTACHMENT_UPLOAD_TTL_SECONDS,
  buildAiChatAttachmentObjectKey,
  computeAttachmentRetryDelayMs,
  hashAttachmentBytes,
  isRejectedAttachmentFileName,
  resolveAttachmentKindFromMime,
  validateAttachmentLimits,
} from "./phase-85-stage-4c-attachments";
import type {
  AiChatAttachmentDerivativeDto,
  AiChatAttachmentDto,
  AiChatAttachmentKind,
  AiChatAttachmentStatus,
  AiChatClientRecordCategory,
  AiChatJobRecord,
  AiChatScopeType,
} from "./phase-85-stage-4c-contracts";

export type InMemoryAttachmentRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  kind: AiChatAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentSha256: string;
  objectKey: string;
  status: AiChatAttachmentStatus;
  failureCode: string | null;
  pageCount: number | null;
  durationSec: number | null;
  uploadExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InMemoryAttachmentDerivativeRecord = {
  id: string;
  attachmentId: string;
  kind: AiChatAttachmentDerivativeDto["kind"];
  status: AiChatAttachmentDerivativeDto["status"];
  contentSha256: string | null;
  excerpt: string | null;
  locator: Record<string, unknown>;
  confidence: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type InMemoryClientRecordAsset = {
  id: string;
  tenantId: string;
  clientId: string;
  category: AiChatClientRecordCategory;
  title: string;
  sourceAttachmentId: string;
  objectKey: string;
  createdAt: string;
};

export type InMemoryAttachmentState = {
  attachments: InMemoryAttachmentRecord[];
  derivatives: InMemoryAttachmentDerivativeRecord[];
  objects: Map<string, Buffer>;
  signedUploadUrls: Map<string, { attachmentId: string; expiresAt: string }>;
  clientRecordAssets: InMemoryClientRecordAsset[];
  transfers: Array<{
    id: string;
    attachmentId: string;
    clientRecordAssetId: string;
    status: "completed" | "failed";
    createdAt: string;
  }>;
};

export function createEmptyAttachmentState(): InMemoryAttachmentState {
  return {
    attachments: [],
    derivatives: [],
    objects: new Map(),
    signedUploadUrls: new Map(),
    clientRecordAssets: [],
    transfers: [],
  };
}

function mapDerivative(record: InMemoryAttachmentDerivativeRecord): AiChatAttachmentDerivativeDto {
  const locator =
    typeof record.payload.citation === "string"
      ? record.payload.citation
      : record.locator.section
        ? String(record.locator.section)
        : null;
  return {
    id: record.id,
    attachmentId: record.attachmentId,
    kind: record.kind,
    status: record.status,
    excerpt: record.excerpt,
    locator,
    confidence: record.confidence,
    createdAt: record.createdAt,
  };
}

export function mapAttachmentDto(
  attachment: InMemoryAttachmentRecord,
  derivatives: InMemoryAttachmentDerivativeRecord[],
): AiChatAttachmentDto {
  return {
    id: attachment.id,
    tenantId: attachment.tenantId,
    conversationId: attachment.conversationId,
    createdByUserId: attachment.createdByUserId,
    scopeType: attachment.scopeType,
    clientId: attachment.clientId,
    kind: attachment.kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    contentSha256: attachment.contentSha256,
    status: attachment.status,
    failureCode: attachment.failureCode,
    pageCount: attachment.pageCount,
    durationSec: attachment.durationSec,
    derivatives: derivatives
      .filter((item) => item.attachmentId === attachment.id && item.status !== "superseded")
      .map(mapDerivative),
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

export function createAttachmentUploadSessionInMemory(
  state: InMemoryAttachmentState,
  context: AppTenantContext,
  input: {
    conversationId: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    fileName: string;
    mimeType: string;
    byteSize: number;
    contentSha256: string;
    existing: Array<{ kind: AiChatAttachmentKind; byteSize: number; pageCount?: number; durationSec?: number }>;
  },
) {
  if (isRejectedAttachmentFileName(input.fileName)) {
    throw new AppRequestError(400, "ai_chat_attachment_rejected_extension");
  }
  const kind = resolveAttachmentKindFromMime(input.mimeType);
  if (!kind) {
    throw new AppRequestError(400, "ai_chat_attachment_unsupported_mime");
  }
  const limits = validateAttachmentLimits({ kind, byteSize: input.byteSize, existing: input.existing });
  if (!limits.ok) {
    throw new AppRequestError(400, `ai_chat_attachment_${limits.code}`);
  }
  const now = new Date();
  const attachmentId = randomUUID();
  const objectKey = buildAiChatAttachmentObjectKey(context.tenantId, input.conversationId, attachmentId);
  const uploadExpiresAt = new Date(now.getTime() + AI_CHAT_ATTACHMENT_UPLOAD_TTL_SECONDS * 1000).toISOString();
  const record: InMemoryAttachmentRecord = {
    id: attachmentId,
    tenantId: context.tenantId,
    conversationId: input.conversationId,
    createdByUserId: context.userId,
    scopeType: input.scopeType,
    clientId: input.clientId,
    kind,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    contentSha256: input.contentSha256,
    objectKey,
    status: "upload_pending",
    failureCode: null,
    pageCount: null,
    durationSec: null,
    uploadExpiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  state.attachments.push(record);
  const signedToken = randomUUID();
  state.signedUploadUrls.set(signedToken, { attachmentId, expiresAt: uploadExpiresAt });
  return {
    attachment: mapAttachmentDto(record, []),
    uploadUrl: `/api/ai-chat/attachments/${attachmentId}/upload?token=${signedToken}`,
    uploadToken: signedToken,
    expiresAt: uploadExpiresAt,
    objectKey,
  };
}

export function completeAttachmentUploadInMemory(
  state: InMemoryAttachmentState,
  context: AppTenantContext,
  attachmentId: string,
  input: { bytes: Buffer; contentSha256: string },
) {
  const attachment = state.attachments.find(
    (item) => item.id === attachmentId && item.tenantId === context.tenantId && item.createdByUserId === context.userId,
  );
  if (!attachment) throw new AppRequestError(404, "ai_chat_attachment_not_found");
  if (attachment.status !== "upload_pending" && attachment.status !== "uploaded") {
    throw new AppRequestError(409, "ai_chat_attachment_invalid_state");
  }
  if (attachment.uploadExpiresAt && new Date(attachment.uploadExpiresAt).getTime() < Date.now()) {
    throw new AppRequestError(409, "ai_chat_attachment_upload_expired");
  }
  const actualHash = hashAttachmentBytes(input.bytes);
  if (actualHash !== input.contentSha256 || actualHash !== attachment.contentSha256) {
    state.objects.delete(attachment.objectKey);
    attachment.status = "failed";
    attachment.failureCode = "hash_mismatch";
    attachment.updatedAt = new Date().toISOString();
    throw new AppRequestError(400, "ai_chat_attachment_hash_mismatch");
  }
  if (input.bytes.byteLength !== attachment.byteSize) {
    throw new AppRequestError(400, "ai_chat_attachment_size_mismatch");
  }
  state.objects.set(attachment.objectKey, input.bytes);
  attachment.status = "scanning";
  attachment.updatedAt = new Date().toISOString();
  return mapAttachmentDto(
    attachment,
    state.derivatives.filter((item) => item.attachmentId === attachment.id),
  );
}

export function listConversationAttachmentsInMemory(
  state: InMemoryAttachmentState,
  tenantId: string,
  conversationId: string,
  userId: string,
) {
  return state.attachments
    .filter(
      (item) =>
        item.tenantId === tenantId &&
        item.conversationId === conversationId &&
        item.createdByUserId === userId &&
        item.status !== "deleted",
    )
    .map((item) => mapAttachmentDto(item, state.derivatives));
}

export function getAttachmentRecordInMemory(state: InMemoryAttachmentState, attachmentId: string) {
  return state.attachments.find((item) => item.id === attachmentId) ?? null;
}

export function deleteAttachmentInMemory(state: InMemoryAttachmentState, context: AppTenantContext, attachmentId: string) {
  const attachment = state.attachments.find(
    (item) => item.id === attachmentId && item.tenantId === context.tenantId && item.createdByUserId === context.userId,
  );
  if (!attachment) throw new AppRequestError(404, "ai_chat_attachment_not_found");
  attachment.status = "deleting";
  attachment.updatedAt = new Date().toISOString();
  state.objects.delete(attachment.objectKey);
  attachment.status = "deleted";
  attachment.updatedAt = new Date().toISOString();
}

export function saveAttachmentDerivativeInMemory(
  state: InMemoryAttachmentState,
  input: {
    attachmentId: string;
    kind: InMemoryAttachmentDerivativeRecord["kind"];
    status: InMemoryAttachmentDerivativeRecord["status"];
    contentSha256: string | null;
    excerpt: string | null;
    locator: Record<string, unknown>;
    confidence: number | null;
    payload?: Record<string, unknown>;
  },
) {
  const now = new Date().toISOString();
  state.derivatives
    .filter((item) => item.attachmentId === input.attachmentId && item.kind === input.kind && item.status !== "superseded")
    .forEach((item) => {
      item.status = "superseded";
    });
  state.derivatives.push({
    id: randomUUID(),
    attachmentId: input.attachmentId,
    kind: input.kind,
    status: input.status,
    contentSha256: input.contentSha256,
    excerpt: input.excerpt,
    locator: input.locator,
    confidence: input.confidence,
    payload: input.payload ?? {},
    createdAt: now,
  });
}

export function acceptAttachmentDerivativeCorrectionInMemory(
  state: InMemoryAttachmentState,
  context: AppTenantContext,
  attachmentId: string,
  derivativeId: string,
  input: { correctedText: string },
) {
  const attachment = state.attachments.find(
    (item) => item.id === attachmentId && item.tenantId === context.tenantId && item.createdByUserId === context.userId,
  );
  if (!attachment) throw new AppRequestError(404, "ai_chat_attachment_not_found");
  const current = state.derivatives.find(
    (item) => item.id === derivativeId && item.attachmentId === attachmentId && item.status !== "superseded",
  );
  if (!current) throw new AppRequestError(409, "ai_chat_attachment_derivative_missing");
  saveAttachmentDerivativeInMemory(state, {
    attachmentId,
    kind: current.kind,
    status: "accepted",
    contentSha256: null,
    excerpt: input.correctedText,
    locator: current.locator,
    confidence: 1,
    payload: { ...current.payload, correctedByUserId: context.userId },
  });
  attachment.status = "ready";
  attachment.updatedAt = new Date().toISOString();
  return mapAttachmentDto(attachment, state.derivatives);
}

export function transferAttachmentToClientRecordInMemory(
  state: InMemoryAttachmentState,
  context: AppTenantContext,
  attachmentId: string,
  input: { clientId: string; category: AiChatClientRecordCategory; title: string; previewAccepted: boolean },
) {
  if (!input.previewAccepted) {
    throw new AppRequestError(400, "ai_chat_attachment_transfer_preview_required");
  }
  const attachment = state.attachments.find(
    (item) => item.id === attachmentId && item.tenantId === context.tenantId && item.createdByUserId === context.userId,
  );
  if (!attachment) throw new AppRequestError(404, "ai_chat_attachment_not_found");
  if (attachment.scopeType !== "client" || attachment.clientId !== input.clientId) {
    throw new AppRequestError(403, "ai_chat_attachment_transfer_scope_mismatch");
  }
  const bytes = state.objects.get(attachment.objectKey);
  if (!bytes) throw new AppRequestError(409, "ai_chat_attachment_object_missing");
  const assetId = randomUUID();
  const objectKey = `${context.tenantId}/${input.clientId}/${assetId}`;
  state.objects.set(objectKey, Buffer.from(bytes));
  const asset: InMemoryClientRecordAsset = {
    id: assetId,
    tenantId: context.tenantId,
    clientId: input.clientId,
    category: input.category,
    title: input.title,
    sourceAttachmentId: attachment.id,
    objectKey,
    createdAt: new Date().toISOString(),
  };
  state.clientRecordAssets.push(asset);
  state.transfers.push({
    id: randomUUID(),
    attachmentId: attachment.id,
    clientRecordAssetId: asset.id,
    status: "completed",
    createdAt: new Date().toISOString(),
  });
  return { assetId: asset.id, objectKey };
}

export function enqueueAttachmentJobInMemory(
  jobs: AiChatJobRecord[],
  input: {
    tenantId: string;
    conversationId: string;
    createdByUserId: string;
    jobType: "attachment_scan" | "attachment_parse" | "attachment_cleanup";
    attachmentId: string;
    retryCount?: number;
  },
) {
  const now = new Date().toISOString();
  jobs.push({
    id: randomUUID(),
    tenantId: input.tenantId,
    jobType: input.jobType,
    runId: null,
    conversationId: input.conversationId,
    createdByUserId: input.createdByUserId,
    status: "queued",
    payload: { attachmentId: input.attachmentId },
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    retryCount: input.retryCount ?? 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export function scheduleAttachmentJobRetryInMemory(
  job: { retryCount: number; nextAttemptAt: string; status: string; updatedAt: string },
  errorCode: string,
) {
  job.retryCount += 1;
  job.status = job.retryCount >= 3 ? "permanently_failed" : "retryable_failed";
  job.nextAttemptAt = new Date(Date.now() + computeAttachmentRetryDelayMs(job.retryCount)).toISOString();
  job.updatedAt = new Date().toISOString();
  void errorCode;
}
