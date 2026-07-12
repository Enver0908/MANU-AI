import { AppDomainError } from "./app-errors";
import type {
  ClientAssignmentAccessLevel,
  MessageContentStatus,
} from "./types";
import type {
  ConversationActorContext,
  ConversationAssignmentAccess,
  ConversationAssignmentInput,
  ConversationAssignmentLevel,
  ConversationDetailQuery,
  ConversationListCursorPayload,
  ConversationListQuery,
  ConversationListStatus,
  ConversationMessageCursorPayload,
  ConversationMessageDirection,
  ConversationMessageDto,
  ConversationMutationOperation,
  ConversationPermissionInput,
  ConversationPermissions,
  ConversationProjectionClient,
  ConversationProjectionMessage,
  ConversationReadReceiptRecord,
} from "./phase-85-stage-4b2-contracts";
import {
  CONVERSATION_CURSOR_VERSION,
  CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE,
  CONVERSATION_DETAIL_MAX_PAGE_SIZE,
  CONVERSATION_DRAFT_PREVIEW,
  CONVERSATION_LIST_DEFAULT_PAGE_SIZE,
  CONVERSATION_LIST_MAX_PAGE_SIZE,
  CONVERSATION_MAX_MESSAGE_BODY_LENGTH,
  CONVERSATION_MAX_PREVIEW_LENGTH,
  CONVERSATION_MAX_QUERY_LENGTH,
  CONVERSATION_UNAVAILABLE_PREVIEW,
} from "./phase-85-stage-4b2-contracts";

const CONTENT_UNAVAILABLE_STATUSES = new Set<MessageContentStatus>([
  "revoked",
  "redacted",
  "content_unavailable",
]);

const ASSIGNMENT_PRIORITY: Record<ClientAssignmentAccessLevel, number> = {
  care_team: 0,
  viewer: 1,
};

type NormalizedAssignment = {
  tenantId: string | null;
  clientId: string;
  dietitianId: string;
  accessLevel: ClientAssignmentAccessLevel | null;
};

export type ConversationListQueryInput = {
  status?: string | null;
  query?: string | null;
  cursor?: string | null;
  limit?: string | null;
};

export type ConversationDetailQueryInput = {
  direction?: string | null;
  cursor?: string | null;
  anchorMessageId?: string | null;
  limit?: string | null;
};

export type ConversationListBuildInput = {
  status?: ConversationListStatus | string | null;
  query?: string | null;
  cursor?: string | null;
  limit?: number | string | null;
  generatedAt?: string;
};

export type ConversationDetailBuildInput = {
  direction?: ConversationMessageDirection | string | null;
  cursor?: string | null;
  anchorMessageId?: string | null;
  limit?: number | string | null;
  generatedAt?: string;
};

function invalidInput(message: string): never {
  throw new AppDomainError(400, message);
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function truncateCodePoints(value: string, maxLength: number) {
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLength) return value;
  return `${codePoints.slice(0, Math.max(0, maxLength - 3)).join("")}...`;
}

function parsePositiveInteger(value: string | number | null | undefined, defaultValue: number, max: number) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return defaultValue;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || !Number.isFinite(parsed)) {
    invalidInput("invalid_limit");
  }
  return Math.min(parsed, max);
}

export function parseConversationListStatus(value: string | null | undefined): ConversationListStatus {
  if (!value || value === "all") return "all";
  if (value === "unread") return "unread";
  invalidInput("invalid_status_filter");
}

export function parseConversationMessageDirection(
  value: string | null | undefined,
): ConversationMessageDirection {
  if (!value || value === "older") return "older";
  if (value === "newer") return "newer";
  invalidInput("invalid_direction");
}

export function parseConversationQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (codePointLength(normalized) > CONVERSATION_MAX_QUERY_LENGTH) {
    invalidInput("invalid_query");
  }
  return normalized;
}

export function parseConversationListLimit(value: string | number | null | undefined) {
  return parsePositiveInteger(value, CONVERSATION_LIST_DEFAULT_PAGE_SIZE, CONVERSATION_LIST_MAX_PAGE_SIZE);
}

export function parseConversationDetailLimit(value: string | number | null | undefined) {
  return parsePositiveInteger(value, CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE, CONVERSATION_DETAIL_MAX_PAGE_SIZE);
}

export function parseConversationAnchorMessageId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (codePointLength(normalized) > 128) invalidInput("invalid_anchor_message_id");
  return normalized;
}

export function parseConversationListQuery(input: ConversationListQueryInput): ConversationListQuery {
  const cursor = input.cursor?.trim() || null;
  return {
    status: parseConversationListStatus(input.status),
    query: parseConversationQuery(input.query),
    cursor,
    limit: parseConversationListLimit(input.limit),
  };
}

export function parseConversationDetailQuery(input: ConversationDetailQueryInput): ConversationDetailQuery {
  const cursor = input.cursor?.trim() || null;
  return {
    direction: parseConversationMessageDirection(input.direction),
    cursor,
    anchorMessageId: parseConversationAnchorMessageId(input.anchorMessageId),
    limit: parseConversationDetailLimit(input.limit),
  };
}

function encodeCursor(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string | null | undefined): Record<string, unknown> {
  if (!value) invalidInput("invalid_cursor");
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      invalidInput("invalid_cursor");
    }
    return decoded as Record<string, unknown>;
  } catch {
    invalidInput("invalid_cursor");
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}

export function encodeConversationListCursor(
  payload: Omit<ConversationListCursorPayload, "v" | "mode">,
) {
  return encodeCursor({
    v: CONVERSATION_CURSOR_VERSION,
    mode: "conversation_list",
    ...payload,
  });
}

export function decodeConversationListCursor(
  value: string | null | undefined,
  expected?: Pick<ConversationListCursorPayload, "status" | "query">,
): ConversationListCursorPayload | null {
  if (!value) return null;
  const decoded = decodeCursor(value);
  if (
    decoded.v !== CONVERSATION_CURSOR_VERSION ||
    decoded.mode !== "conversation_list" ||
    (decoded.status !== "all" && decoded.status !== "unread") ||
    typeof decoded.query !== "string" ||
    codePointLength(decoded.query) > CONVERSATION_MAX_QUERY_LENGTH ||
    !isNullableString(decoded.lastActivityAt) ||
    typeof decoded.conversationId !== "string" ||
    !decoded.conversationId
  ) {
    invalidInput("invalid_cursor");
  }
  if (expected && (decoded.status !== expected.status || decoded.query !== expected.query)) {
    invalidInput("invalid_cursor");
  }
  return decoded as unknown as ConversationListCursorPayload;
}

export function encodeConversationMessageCursor(
  payload: Omit<ConversationMessageCursorPayload, "v" | "mode">,
) {
  return encodeCursor({
    v: CONVERSATION_CURSOR_VERSION,
    mode: "conversation_messages",
    ...payload,
  });
}

export function decodeConversationMessageCursor(
  value: string | null | undefined,
  expected?: Partial<Pick<ConversationMessageCursorPayload, "direction" | "conversationId">>,
): ConversationMessageCursorPayload | null {
  if (!value) return null;
  const decoded = decodeCursor(value);
  if (
    decoded.v !== CONVERSATION_CURSOR_VERSION ||
    decoded.mode !== "conversation_messages" ||
    (decoded.direction !== "older" && decoded.direction !== "newer") ||
    typeof decoded.conversationId !== "string" ||
    !decoded.conversationId ||
    typeof decoded.messageId !== "string" ||
    !decoded.messageId ||
    !isNullableNonNegativeInteger(decoded.conversationSequence) ||
    typeof decoded.createdAt !== "string" ||
    !decoded.createdAt
  ) {
    invalidInput("invalid_cursor");
  }
  if (
    expected &&
    ((expected.direction && decoded.direction !== expected.direction) ||
      (expected.conversationId && decoded.conversationId !== expected.conversationId))
  ) {
    invalidInput("invalid_cursor");
  }
  return decoded as unknown as ConversationMessageCursorPayload;
}

function normalizeAccessLevel(value: unknown): ClientAssignmentAccessLevel | null {
  if (value == null) return "care_team";
  if (value === "care_team" || value === "viewer") return value;
  return null;
}

function normalizeAssignment(input: ConversationAssignmentInput): NormalizedAssignment {
  if ("clientId" in input) {
    return {
      tenantId: input.tenantId ?? null,
      clientId: input.clientId,
      dietitianId: input.dietitianId,
      accessLevel: normalizeAccessLevel(input.accessLevel),
    };
  }
  return {
    tenantId: input.tenant_id ?? null,
    clientId: input.client_id,
    dietitianId: input.dietitian_id,
    accessLevel: normalizeAccessLevel(input.access_level),
  };
}

export function resolveConversationAssignment(
  actor: ConversationActorContext,
  client: Pick<ConversationProjectionClient, "tenantId" | "id" | "dietitianId">,
  assignments: readonly ConversationAssignmentInput[],
): ConversationAssignmentAccess {
  if (client.tenantId !== actor.tenantId || client.id.length === 0) {
    return { level: null, isExplicit: false };
  }

  if (actor.role === "owner" || actor.role === "admin") {
    return { level: "tenant", isExplicit: false };
  }

  if (actor.role === "auditor") {
    return { level: null, isExplicit: false };
  }

  if (actor.role === "dietitian" && client.dietitianId === actor.dietitianId) {
    return { level: "primary", isExplicit: false };
  }

  const matching = assignments
    .map(normalizeAssignment)
    .filter(
      (assignment) =>
        (!assignment.tenantId || assignment.tenantId === actor.tenantId) &&
        assignment.clientId === client.id &&
        assignment.dietitianId === actor.dietitianId &&
        assignment.accessLevel !== null,
    )
    .sort(
      (left, right) =>
        ASSIGNMENT_PRIORITY[left.accessLevel as ClientAssignmentAccessLevel] -
        ASSIGNMENT_PRIORITY[right.accessLevel as ClientAssignmentAccessLevel],
    );

  return matching[0]
    ? { level: matching[0].accessLevel, isExplicit: true }
    : { level: null, isExplicit: false };
}

function deniedConversationPermissions(): ConversationPermissions {
  return {
    canRead: false,
    canViewTranscript: false,
    canMarkRead: false,
    canSendManualReply: false,
    canReviewDraft: false,
    canControlAi: false,
    canResolveRisk: false,
    canMutateConversation: false,
    isReadOnly: true,
    assignmentLevel: null,
    scope: "none",
  };
}

function buildConversationPermissions(
  canRead: boolean,
  canMutate: boolean,
  assignmentLevel: ConversationAssignmentLevel,
  scope: "tenant" | "assigned" | "none",
): ConversationPermissions {
  return {
    canRead,
    canViewTranscript: canRead,
    canMarkRead: canRead,
    canSendManualReply: canMutate,
    canReviewDraft: canMutate,
    canControlAi: canMutate,
    canResolveRisk: canMutate,
    canMutateConversation: canMutate,
    isReadOnly: canRead && !canMutate,
    assignmentLevel,
    scope,
  };
}

export function resolveConversationPermissions(input: ConversationPermissionInput): ConversationPermissions {
  const { actor, conversation, client } = input;
  if (
    actor.tenantId !== conversation.tenantId ||
    actor.tenantId !== client.tenantId ||
    conversation.clientId !== client.id
  ) {
    return deniedConversationPermissions();
  }

  const assignment = resolveConversationAssignment(actor, client, input.assignments);

  if (actor.role === "owner" || actor.role === "admin") {
    return buildConversationPermissions(true, true, "tenant", "tenant");
  }

  if (actor.role === "auditor" || !assignment.level) {
    return deniedConversationPermissions();
  }

  if (actor.role === "assistant") {
    return buildConversationPermissions(true, false, assignment.level, "assigned");
  }

  const canMutate = actor.role === "dietitian" && (assignment.level === "primary" || assignment.level === "care_team");
  return buildConversationPermissions(true, canMutate, assignment.level, "assigned");
}

export function canPerformConversationOperation(
  permissions: ConversationPermissions,
  operation: ConversationMutationOperation,
) {
  if (!permissions.canRead) return false;
  if (operation === "mark_read") return permissions.canMarkRead;
  if (operation === "manual_reply") return permissions.canSendManualReply;
  if (operation === "draft_review") return permissions.canReviewDraft;
  if (operation === "ai_control") return permissions.canControlAi;
  return permissions.canResolveRisk;
}

export function assertConversationReadable(permissions: ConversationPermissions) {
  if (!permissions.canRead) {
    throw new AppDomainError(404, "conversation_not_found");
  }
}

export function assertConversationOperationAllowed(
  permissions: ConversationPermissions,
  operation: ConversationMutationOperation,
) {
  assertConversationReadable(permissions);
  if (!canPerformConversationOperation(permissions, operation)) {
    throw new AppDomainError(403, `conversation_${operation}_forbidden`);
  }
}

function normalizeContentStatus(message: Pick<ConversationProjectionMessage, "contentStatus">): MessageContentStatus {
  return message.contentStatus ?? "available";
}

export function normalizeConversationMessageBody(value: string) {
  return truncateCodePoints(value, CONVERSATION_MAX_MESSAGE_BODY_LENGTH);
}

export function normalizeConversationPreview(message: ConversationProjectionMessage | null) {
  if (!message) return "";
  const status = normalizeContentStatus(message);
  if (message.origin === "ai_generated" && message.status === "draft") return CONVERSATION_DRAFT_PREVIEW;
  if (isContentUnavailable(status)) return CONVERSATION_UNAVAILABLE_PREVIEW;
  const compact = message.body.trim().replace(/\s+/g, " ");
  return truncateCodePoints(compact, CONVERSATION_MAX_PREVIEW_LENGTH);
}

export function projectConversationMessage(message: ConversationProjectionMessage): ConversationMessageDto {
  const contentStatus = normalizeContentStatus(message);
  const isDraft = message.origin === "ai_generated" && message.status === "draft";
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    origin: message.origin,
    body: isContentUnavailable(contentStatus) ? null : normalizeConversationMessageBody(message.body),
    contentStatus,
    status: message.status ?? "sent",
    isDraft,
    sourceMessageId: message.sourceMessageId ?? null,
    createdAt: message.createdAt,
    conversationSequence: message.conversationSequence ?? null,
  };
}

export function countConversationUnreadMessages(
  messages: readonly ConversationProjectionMessage[],
  receipt: ConversationReadReceiptRecord | null | undefined,
) {
  const lastReadSequence = receipt?.lastReadSequence ?? 0;
  return messages.filter((message) => {
    const sequence = message.conversationSequence;
    return (
      message.origin === "client_inbound" &&
      typeof sequence === "number" &&
      Number.isInteger(sequence) &&
      sequence > lastReadSequence &&
      isUnreadEligibleContent(normalizeContentStatus(message))
    );
  }).length;
}

function isContentUnavailable(status: MessageContentStatus) {
  return CONTENT_UNAVAILABLE_STATUSES.has(status);
}

function isUnreadEligibleContent(status: MessageContentStatus) {
  return status !== "revoked" && status !== "redacted";
}

export function assertConversationId(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) invalidInput("invalid_conversation_id");
  return normalized;
}

export {
  buildConversationDetailResponse,
  buildConversationDetailResponseFromAppState,
  buildConversationListResponse,
  buildConversationListResponseFromAppState,
  buildEmptyConversationProjectionSource,
  projectConversationInboxItemForActor,
} from "./phase-85-stage-4b2-messaging";
