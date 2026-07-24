import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AppAuthError } from "./auth-context";
import { AppDomainError, AppRequestError } from "./app-errors";
import {
  decodeClientReferenceCode,
  encodeClientReferenceCode,
  formatClientReferenceShort,
} from "./client-reference-code";
import {
  AI_CHAT_CLIENT_SEARCH_DEFAULT_LIMIT,
  AI_CHAT_CLIENT_SEARCH_MAX_LIMIT,
  AI_CHAT_CURSOR_VERSION,
  AI_CHAT_LIST_DEFAULT_LIMIT,
  AI_CHAT_LIST_MAX_LIMIT,
  AI_CHAT_LIST_SCOPE_FILTERS,
  AI_CHAT_MAX_QUERY_LENGTH,
  AI_CHAT_MESSAGE_LIST_DEFAULT_LIMIT,
  AI_CHAT_MESSAGE_LIST_MAX_LIMIT,
  AI_CHAT_SCOPE_TYPES,
  AI_CHAT_TITLE_MAX_LENGTH,
  type AiChatApiErrorBody,
  type AiChatApiErrorCode,
  type AiChatBranchDto,
  type AiChatConversationDetail,
  type AiChatConversationListItem,
  type AiChatConversationListResponse,
  type AiChatConversationSummary,
  type AiChatDeleteConversationInput,
  type AiChatDeleteMessageInput,
  type AiChatListScopeFilter,
  type AiChatMessageDto,
  type AiChatMessageVersionDto,
  type AiChatScopeType,
  type AiChatTitleSource,
} from "./phase-85-stage-4c-contracts";

export const STAGE_4C_CONTEXT_GATEWAY_VERSION = "p85-stage-4c-context-gateway-v1";
export { STAGE_4C_SOURCES_VERSION } from "./phase-85-stage-4c-sources";
export { STAGE_4C_ATTACHMENTS_VERSION } from "./phase-85-stage-4c-attachments";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AI_CHAT_API_CACHE_CONTROL = "no-store";

export type AiChatListQuery = {
  scope: AiChatListScopeFilter;
  query: string;
  cursor: string | null;
  limit: number;
};

export type AiChatLoadQuery = {
  messageLimit: number;
};

export type AiChatCreateInput = {
  requestId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  title: string;
};

export type AiChatRenameInput = {
  requestId: string;
  expectedRevision: number;
  title: string;
};

export type AiChatActivateBranchInput = {
  requestId: string;
  expectedRevision: number;
  branchId: string;
};

export type AiChatClientSearchQuery = {
  query: string;
  limit: number;
};

export type AiChatListCursorPayload = {
  v: number;
  scope: AiChatListScopeFilter;
  query: string;
  lastMessageAt: string | null;
  id: string;
};

function invalidInput(code: AiChatApiErrorCode | string, field?: string): never {
  throw new AppRequestError(400, code, field);
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function parsePositiveInteger(
  value: string | number | null | undefined,
  defaultValue: number,
  max: number,
  field = "limit",
) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return defaultValue;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    invalidInput("ai_chat_cursor_invalid", field);
  }
  return Math.min(parsed, max);
}

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidInput("invalid_request_body");
  }
  return value as Record<string, unknown>;
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      invalidInput("invalid_request_body", key);
    }
  }
}

function parseRequiredString(
  body: Record<string, unknown>,
  key: string,
  { trim = true, maxLength }: { trim?: boolean; maxLength?: number } = {},
) {
  const value = body[key];
  if (typeof value !== "string") invalidInput("invalid_request_body", key);
  const normalized = trim ? value.trim() : value;
  if (!normalized) invalidInput("invalid_request_body", key);
  if (maxLength != null && codePointLength(normalized) > maxLength) {
    invalidInput(key === "title" ? "ai_chat_title_too_long" : "invalid_request_body", key);
  }
  return normalized;
}

function parseOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "string") invalidInput("invalid_request_body", key);
  const normalized = value.trim();
  return normalized || null;
}

function parseScopeType(value: unknown): AiChatScopeType {
  if (typeof value !== "string" || !AI_CHAT_SCOPE_TYPES.includes(value as AiChatScopeType)) {
    invalidInput("invalid_request_body", "scopeType");
  }
  return value as AiChatScopeType;
}

function parseScopeFilter(value: string | null | undefined): AiChatListScopeFilter {
  const normalized = value?.trim() || "all";
  if (!AI_CHAT_LIST_SCOPE_FILTERS.includes(normalized as AiChatListScopeFilter)) {
    invalidInput("ai_chat_cursor_invalid", "scope");
  }
  return normalized as AiChatListScopeFilter;
}

function parseQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (codePointLength(normalized) > AI_CHAT_MAX_QUERY_LENGTH) {
    invalidInput("ai_chat_cursor_invalid", "query");
  }
  return normalized;
}

export function parseAiChatListQuery(input: {
  scope?: string | null;
  query?: string | null;
  cursor?: string | null;
  limit?: string | null;
}): AiChatListQuery {
  const scope = parseScopeFilter(input.scope);
  const query = parseQuery(input.query);
  const cursor = input.cursor?.trim() || null;
  if (cursor) decodeAiChatListCursor(cursor, { scope, query });
  return {
    scope,
    query,
    cursor,
    limit: parsePositiveInteger(input.limit, AI_CHAT_LIST_DEFAULT_LIMIT, AI_CHAT_LIST_MAX_LIMIT),
  };
}

export function parseAiChatLoadQuery(input: { limit?: string | null }): AiChatLoadQuery {
  return {
    messageLimit: parsePositiveInteger(
      input.limit,
      AI_CHAT_MESSAGE_LIST_DEFAULT_LIMIT,
      AI_CHAT_MESSAGE_LIST_MAX_LIMIT,
      "messageLimit",
    ),
  };
}

export function parseAiChatClientSearchQuery(input: {
  query?: string | null;
  limit?: string | null;
}): AiChatClientSearchQuery {
  return {
    query: parseQuery(input.query),
    limit: parsePositiveInteger(
      input.limit,
      AI_CHAT_CLIENT_SEARCH_DEFAULT_LIMIT,
      AI_CHAT_CLIENT_SEARCH_MAX_LIMIT,
    ),
  };
}

export function parseAiChatCreateBody(body: unknown): AiChatCreateInput {
  const record = assertPlainObject(body);
  rejectUnknownFields(record, ["requestId", "scopeType", "clientId", "title"]);
  const requestId = parseRequiredString(record, "requestId");
  const scopeType = parseScopeType(record.scopeType);
  const clientRef = parseOptionalString(record, "clientId");
  const title = parseRequiredString(record, "title", { maxLength: AI_CHAT_TITLE_MAX_LENGTH });
  if (!title) invalidInput("ai_chat_title_required", "title");

  let clientId: string | null = null;
  if (clientRef) {
    clientId = decodeClientReferenceCode(clientRef);
    if (!clientId) invalidInput("ai_chat_not_found", "clientId");
  }

  if (scopeType === "general" && clientId) invalidInput("ai_chat_scope_client_mismatch", "clientId");
  if (scopeType === "client" && !clientId) invalidInput("ai_chat_client_required", "clientId");

  return { requestId, scopeType, clientId, title };
}

export function parseAiChatRenameBody(body: unknown): AiChatRenameInput {
  const record = assertPlainObject(body);
  rejectUnknownFields(record, ["requestId", "expectedRevision", "title"]);
  const requestId = parseRequiredString(record, "requestId");
  const title = parseRequiredString(record, "title", { maxLength: AI_CHAT_TITLE_MAX_LENGTH });
  if (!title) invalidInput("ai_chat_title_required", "title");
  const expectedRevision = record.expectedRevision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    invalidInput("invalid_request_body", "expectedRevision");
  }
  return { requestId, expectedRevision, title };
}

export function parseAiChatActivateBranchBody(body: unknown): AiChatActivateBranchInput {
  const record = assertPlainObject(body);
  rejectUnknownFields(record, ["requestId", "expectedRevision", "branchId"]);
  const requestId = parseRequiredString(record, "requestId");
  const branchId = parseRequiredString(record, "branchId");
  if (!UUID_PATTERN.test(branchId)) invalidInput("invalid_request_body", "branchId");
  const expectedRevision = record.expectedRevision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    invalidInput("invalid_request_body", "expectedRevision");
  }
  return { requestId, expectedRevision, branchId };
}

export function parseAiChatDeleteConversationBody(body: unknown): AiChatDeleteConversationInput {
  const record = assertPlainObject(body);
  rejectUnknownFields(record, ["requestId", "expectedRevision"]);
  const requestId = parseRequiredString(record, "requestId");
  const expectedRevision = record.expectedRevision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    invalidInput("invalid_request_body", "expectedRevision");
  }
  return { requestId, expectedRevision };
}

export function parseAiChatDeleteMessageBody(body: unknown): AiChatDeleteMessageInput {
  const record = assertPlainObject(body);
  rejectUnknownFields(record, ["requestId", "expectedRevision"]);
  const requestId = parseRequiredString(record, "requestId");
  const expectedRevision = record.expectedRevision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    invalidInput("invalid_request_body", "expectedRevision");
  }
  return { requestId, expectedRevision };
}

export function assertAiChatId(value: string) {
  if (!UUID_PATTERN.test(value.trim())) {
    invalidInput("ai_chat_not_found");
  }
  return value.trim();
}

export function canonicalAiChatBodyHash(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function encodeCursor(payload: AiChatListCursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeAiChatListCursor(
  value: string,
  expected: { scope: AiChatListScopeFilter; query: string },
): AiChatListCursorPayload {
  if (codePointLength(value) > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    invalidInput("ai_chat_cursor_invalid", "cursor");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    invalidInput("ai_chat_cursor_invalid", "cursor");
  }

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    invalidInput("ai_chat_cursor_invalid", "cursor");
  }

  const payload = decoded as Partial<AiChatListCursorPayload>;
  if (
    payload.v !== AI_CHAT_CURSOR_VERSION ||
    payload.scope !== expected.scope ||
    payload.query !== expected.query ||
    typeof payload.id !== "string" ||
    !UUID_PATTERN.test(payload.id) ||
    (payload.lastMessageAt != null && typeof payload.lastMessageAt !== "string")
  ) {
    invalidInput("ai_chat_cursor_invalid", "cursor");
  }

  return {
    v: AI_CHAT_CURSOR_VERSION,
    scope: payload.scope!,
    query: payload.query!,
    lastMessageAt: payload.lastMessageAt ?? null,
    id: payload.id!,
  };
}

export function encodeAiChatListCursor(payload: AiChatListCursorPayload) {
  return encodeCursor(payload);
}

export function aiChatJsonResponse<T>(payload: T) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": AI_CHAT_API_CACHE_CONTROL,
    },
  });
}

export function aiChatErrorResponse(error: unknown, requestId: string | null = null) {
  if (error instanceof AppRequestError) {
    const body: AiChatApiErrorBody = {
      error: {
        code: error.code,
        retryable: error.status >= 500,
        field: error.field,
        revision: error.revision,
      },
      requestId,
    };
    return NextResponse.json(body, { status: error.status });
  }

  if (error instanceof AppAuthError) {
    const code =
      error.message === "dietitian_ai_chat_forbidden" || error.status === 403
        ? "dietitian_ai_chat_forbidden"
        : error.message;
    const body: AiChatApiErrorBody = {
      error: { code, retryable: false },
      requestId,
    };
    return NextResponse.json(body, { status: error.status });
  }

  if (error instanceof AppDomainError) {
    const body: AiChatApiErrorBody = {
      error: { code: error.message, retryable: false },
      requestId,
    };
    return NextResponse.json(body, { status: error.status });
  }

  throw error;
}

export function mapRpcError(error: { message?: string }, currentRevision?: number): never {
  const message = error.message ?? "ai_chat_store_unavailable";
  if (message.includes("ai_chat_revision_conflict")) {
    const revision = Number(message.split(":")[1]);
    throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, Number.isFinite(revision) ? revision : currentRevision);
  }
  if (message.includes("ai_chat_idempotency_conflict")) {
    throw new AppRequestError(409, "ai_chat_idempotency_conflict");
  }
  if (message.includes("ai_chat_not_found")) {
    throw new AppRequestError(404, "ai_chat_not_found");
  }
  if (message.includes("ai_chat_scope_client_mismatch")) {
    throw new AppRequestError(400, "ai_chat_scope_client_mismatch", "clientId");
  }
  if (message.includes("ai_chat_client_required")) {
    throw new AppRequestError(400, "ai_chat_client_required", "clientId");
  }
  if (message.includes("ai_chat_title_required")) {
    throw new AppRequestError(400, "ai_chat_title_required", "title");
  }
  if (message.includes("ai_chat_title_too_long")) {
    throw new AppRequestError(400, "ai_chat_title_too_long", "title");
  }
  if (message.includes("ai_chat_conversation_locked")) {
    throw new AppRequestError(409, "ai_chat_conversation_locked");
  }
  if (message.includes("ai_chat_legal_hold")) {
    throw new AppRequestError(423, "ai_chat_legal_hold");
  }
  if (message.includes("ai_chat_message_body_required")) {
    throw new AppRequestError(400, "ai_chat_message_body_required", "body");
  }
  if (message.includes("ai_chat_message_body_too_long")) {
    throw new AppRequestError(400, "ai_chat_message_body_too_long", "body");
  }
  if (message.includes("ai_chat_assistant_delete_forbidden")) {
    throw new AppRequestError(409, "ai_chat_assistant_delete_forbidden");
  }
  if (message.includes("ai_chat_message_not_latest_user")) {
    throw new AppRequestError(409, "ai_chat_message_not_latest_user");
  }
  if (message.includes("ai_chat_active_run_conflict")) {
    throw new AppRequestError(409, "ai_chat_active_run_conflict");
  }
  if (message.includes("ai_chat_user_run_limit")) {
    throw new AppRequestError(429, "ai_chat_user_run_limit");
  }
  if (message.includes("ai_chat_run_not_found")) {
    throw new AppRequestError(404, "ai_chat_run_not_found");
  }
  if (message.includes("ai_chat_run_already_terminal")) {
    throw new AppRequestError(409, "ai_chat_run_already_terminal");
  }
  if (message.includes("ai_chat_message_not_found")) {
    throw new AppRequestError(404, "ai_chat_message_not_found");
  }
  if (message.includes("ai_chat_regenerate_not_latest_assistant")) {
    throw new AppRequestError(409, "ai_chat_regenerate_not_latest_assistant");
  }
  if (message.includes("ai_chat_cursor_invalid")) {
    throw new AppRequestError(400, "ai_chat_cursor_invalid", "cursor");
  }
  throw new AppRequestError(503, "ai_chat_store_unavailable");
}

type ConversationRow = {
  id: string;
  tenant_id: string;
  created_by_user_id: string;
  created_by_dietitian_id: string;
  scope_type: AiChatScopeType;
  client_id: string | null;
  title: string;
  title_source: AiChatTitleSource;
  status: AiChatConversationSummary["status"];
  active_branch_id: string | null;
  revision: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  client_full_name?: string | null;
  preview?: string | null;
};

export function mapConversationSummary(row: ConversationRow): AiChatConversationSummary {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdByUserId: row.created_by_user_id,
    createdByDietitianId: row.created_by_dietitian_id,
    scopeType: row.scope_type,
    clientId: row.client_id,
    title: row.title,
    titleSource: row.title_source,
    status: row.status,
    activeBranchId: row.active_branch_id,
    revision: Number(row.revision),
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConversationListItem(row: ConversationRow): AiChatConversationListItem {
  const summary = mapConversationSummary(row);
  const clientReferenceCode = summary.clientId ? encodeClientReferenceCode(summary.clientId) : null;
  return {
    ...summary,
    preview: row.preview ?? null,
    clientFullName: row.client_full_name ?? null,
    clientReferenceCode,
    clientReferenceShort: clientReferenceCode ? formatClientReferenceShort(clientReferenceCode) : null,
  };
}

function mapMessageVersion(row: Record<string, unknown>): AiChatMessageVersionDto {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conversationId: String(row.conversation_id),
    messageId: String(row.message_id),
    branchId: String(row.branch_id),
    createdByUserId: String(row.created_by_user_id),
    body: String(row.body),
    bodySha256: String(row.body_sha256),
    parentVersionId: (row.parent_version_id as string | null) ?? null,
    supersedesVersionId: (row.supersedes_version_id as string | null) ?? null,
    runId: (row.run_id as string | null) ?? null,
    contentStatus: row.content_status as AiChatMessageVersionDto["contentStatus"],
    createdAt: String(row.created_at),
  };
}

function mapMessage(row: Record<string, unknown>): AiChatMessageDto {
  const versions = Array.isArray(row.versions)
    ? row.versions.map((item) => mapMessageVersion(item as Record<string, unknown>))
    : [];
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conversationId: String(row.conversation_id),
    createdByUserId: String(row.created_by_user_id),
    role: row.role as AiChatMessageDto["role"],
    authorUserId: (row.author_user_id as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    versions,
  };
}

function mapBranch(row: Record<string, unknown>): AiChatBranchDto {
  return {
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
  };
}

export function mapConversationDetail(payload: {
  conversation: ConversationRow;
  branches: Record<string, unknown>[];
  messages: Record<string, unknown>[];
}): AiChatConversationDetail {
  const summary = mapConversationSummary(payload.conversation);
  const clientReferenceCode = summary.clientId ? encodeClientReferenceCode(summary.clientId) : null;
  return {
    ...summary,
    preview: payload.conversation.preview ?? null,
    clientFullName: payload.conversation.client_full_name ?? null,
    clientReferenceCode,
    clientReferenceShort: clientReferenceCode ? formatClientReferenceShort(clientReferenceCode) : null,
    branches: payload.branches.map(mapBranch),
    messages: payload.messages.map(mapMessage),
  };
}

export function buildListResponse(
  items: AiChatConversationListItem[],
  next: { lastMessageAt: string | null; id: string } | null,
  scope: AiChatListScopeFilter,
  query: string,
): AiChatConversationListResponse {
  return {
    items,
    nextCursor: next
      ? encodeAiChatListCursor({
          v: AI_CHAT_CURSOR_VERSION,
          scope,
          query,
          lastMessageAt: next.lastMessageAt,
          id: next.id,
        })
      : null,
  };
}
