import { AppRequestError } from "./app-errors";
import { AI_CHAT_CLIENT_RECORD_CATEGORIES } from "./phase-85-stage-4c-contracts";
import { evaluateProductionFileUploadAdmission } from "./production-file-security-contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function parseAttachmentCreateBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const conversationId = typeof record.conversationId === "string" ? record.conversationId.trim() : "";
  const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
  const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim().toLowerCase() : "";
  const byteSize = Number(record.byteSize);
  const contentSha256 = typeof record.contentSha256 === "string" ? record.contentSha256.trim().toLowerCase() : "";
  if (!requestId || !conversationId || !fileName || !mimeType || !Number.isFinite(byteSize) || byteSize <= 0) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  if (!UUID_PATTERN.test(conversationId) || !SHA256_PATTERN.test(contentSha256)) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  const admission = evaluateProductionFileUploadAdmission({
    declaredMimeType: mimeType,
    declaredByteSize: byteSize,
    actualByteSize: byteSize,
    contentSha256,
  });
  if (!admission.ok) {
    throw new AppRequestError(400, `ai_chat_attachment_${admission.code}`);
  }
  return { requestId, conversationId, fileName, mimeType, byteSize, contentSha256 };
}

export function parseAttachmentCompleteBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const contentSha256 = typeof record.contentSha256 === "string" ? record.contentSha256.trim().toLowerCase() : "";
  const uploadToken =
    typeof record.uploadToken === "string" && record.uploadToken.trim() ? record.uploadToken.trim() : undefined;
  if (!requestId || !SHA256_PATTERN.test(contentSha256)) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  return { requestId, contentSha256, uploadToken };
}

export function parseAttachmentCorrectionBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const correctedText = typeof record.correctedText === "string" ? record.correctedText.trim() : "";
  if (!requestId || !correctedText) throw new AppRequestError(400, "ai_chat_invalid_body");
  return { requestId, correctedText };
}

export function parseAttachmentTransferBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const clientId = typeof record.clientId === "string" ? record.clientId.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const previewAccepted = record.previewAccepted === true;
  if (!requestId || !UUID_PATTERN.test(clientId) || !title) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  if (!AI_CHAT_CLIENT_RECORD_CATEGORIES.includes(category as (typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number])) {
    throw new AppRequestError(400, "ai_chat_attachment_transfer_category_invalid");
  }
  return {
    requestId,
    clientId,
    category: category as (typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number],
    title,
    previewAccepted,
  };
}
