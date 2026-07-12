import { AppDomainError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import type { ManuAppState, MessageRecord } from "./types";
import type {
  ConversationActorContext,
  ConversationAssignmentInput,
  ConversationDraftAction,
  ConversationDraftMutationRequest,
  ConversationManualReplyRequest,
  ConversationMutationOperation,
  ConversationMutationResponse,
  ConversationProjectionSource,
} from "./phase-85-stage-4b2-contracts";
import {
  CONVERSATION_MAX_MESSAGE_BODY_LENGTH,
  PHASE_85_STAGE_4B_2_API_VERSION,
} from "./phase-85-stage-4b2-contracts";
import {
  assertConversationOperationAllowed,
  countConversationUnreadMessages,
  projectConversationMessage,
  resolveConversationPermissions,
} from "./phase-85-stage-4b2-api";
import { conversationProjectionSourceFromAppState } from "./phase-85-stage-4b2-messaging";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fallbackIdempotencyStore = new Map<string, ConversationMutationResponse>();

export function resetFallbackConversationMutationIdempotency() {
  fallbackIdempotencyStore.clear();
}

function fallbackIdempotencyKey(tenantId: string, requestId: string) {
  return `${tenantId}:${requestId}`;
}

export function getFallbackConversationMutationIdempotency(
  tenantId: string,
  requestId: string,
): ConversationMutationResponse | null {
  return fallbackIdempotencyStore.get(fallbackIdempotencyKey(tenantId, requestId)) ?? null;
}

export function storeFallbackConversationMutationIdempotency(
  tenantId: string,
  requestId: string,
  response: ConversationMutationResponse,
) {
  fallbackIdempotencyStore.set(fallbackIdempotencyKey(tenantId, requestId), response);
}

function parseUuid(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new AppDomainError(400, errorCode);
  }
  return value.trim();
}

function parseExpectedConversationRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AppDomainError(400, "expected_conversation_revision_invalid");
  }
  return value;
}

function parseOptionalExpectedClientContextRevision(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AppDomainError(400, "expected_client_context_revision_invalid");
  }
  return value;
}

export function assertValidManualMessageBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new AppDomainError(400, "invalid_message_body");
  }
  if (Array.from(trimmed).length > CONVERSATION_MAX_MESSAGE_BODY_LENGTH) {
    throw new AppDomainError(400, "invalid_message_body");
  }
  return trimmed;
}

export function resolveConversationIdFromManualRequest(
  state: ManuAppState,
  body: Record<string, unknown>,
): string {
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (conversationId) return conversationId;

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    throw new AppDomainError(400, "conversation_id_required");
  }

  const conversation = state.conversations.find((item) => item.clientId === clientId);
  if (!conversation) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  return conversation.id;
}

export function parseConversationManualReplyRequest(
  body: unknown,
  resolveConversationId: (raw: Record<string, unknown>) => string,
): ConversationManualReplyRequest {
  if (!body || typeof body !== "object") {
    throw new AppDomainError(400, "invalid_request_body");
  }
  const raw = body as Record<string, unknown>;
  const messageBody = typeof raw.body === "string" ? raw.body : "";
  return {
    conversationId: resolveConversationId(raw),
    body: assertValidManualMessageBody(messageBody),
    requestId: parseUuid(raw.requestId, "request_id_invalid"),
    expectedConversationRevision: parseExpectedConversationRevision(raw.expectedConversationRevision),
  };
}

export function parseConversationDraftMutationRequest(body: unknown): ConversationDraftMutationRequest {
  if (!body || typeof body !== "object") {
    throw new AppDomainError(400, "invalid_request_body");
  }
  const raw = body as Record<string, unknown>;
  const action = raw.action;
  if (
    action !== "approve" &&
    action !== "edit_send" &&
    action !== "dismiss" &&
    action !== "review_send_manual"
  ) {
    throw new AppDomainError(400, "action_required");
  }
  if (action === "edit_send") {
    assertValidManualMessageBody(typeof raw.body === "string" ? raw.body : "");
  }
  if (action === "review_send_manual" && raw.body != null && typeof raw.body === "string" && raw.body.trim()) {
    assertValidManualMessageBody(raw.body);
  }
  const expectedClientContextRevision = parseOptionalExpectedClientContextRevision(raw.expectedClientContextRevision);
  if (action === "review_send_manual" && expectedClientContextRevision == null) {
    throw new AppDomainError(400, "expected_client_context_revision_required");
  }
  return {
    action,
    body: typeof raw.body === "string" ? raw.body : undefined,
    requestId: parseUuid(raw.requestId, "request_id_invalid"),
    expectedConversationRevision: parseExpectedConversationRevision(raw.expectedConversationRevision),
    expectedClientContextRevision,
  };
}

export function assertConversationMutationAllowed(
  actor: ConversationActorContext,
  source: ConversationProjectionSource,
  assignments: readonly ConversationAssignmentInput[],
  conversationId: string,
  operation: ConversationMutationOperation,
) {
  const conversation = source.conversations.find(
    (item) => item.tenantId === actor.tenantId && item.id === conversationId,
  );
  const client = conversation
    ? source.clients.find(
        (item) =>
          item.tenantId === actor.tenantId &&
          item.id === conversation.clientId &&
          item.lifecycleStatus === "active",
      )
    : undefined;
  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  assertConversationOperationAllowed(permissions, operation);
  return { conversation, client, permissions };
}

export function buildConversationMutationResponse(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  operation: ConversationMutationOperation,
  conversationId: string,
  message: MessageRecord | null,
  generatedAt = new Date().toISOString(),
): ConversationMutationResponse {
  const conversation = source.conversations.find(
    (item) => item.tenantId === actor.tenantId && item.id === conversationId,
  );
  const client = conversation
    ? source.clients.find(
        (item) =>
          item.tenantId === actor.tenantId &&
          item.id === conversation.clientId &&
          item.lifecycleStatus === "active",
      )
    : undefined;
  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }

  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  const receipt =
    source.receipts?.find(
      (item) =>
        item.tenantId === actor.tenantId &&
        item.conversationId === conversationId &&
        item.dietitianId === actor.dietitianId,
    ) ?? null;
  const messages = source.messages.filter(
    (item) => item.tenantId === actor.tenantId && item.conversationId === conversationId,
  );
  const projectedMessage =
    message == null
      ? null
      : projectConversationMessage(
          messages.find((item) => item.id === message.id) ?? {
            ...message,
            tenantId: actor.tenantId,
            conversationId,
            contentStatus: message.contentStatus ?? "available",
          },
        );

  return {
    version: PHASE_85_STAGE_4B_2_API_VERSION,
    generatedAt,
    operation,
    conversationId,
    conversationRevision: conversation.revision,
    message: projectedMessage,
    receipt,
    unreadCount: countConversationUnreadMessages(messages, receipt),
    permissions,
  };
}

export function buildConversationMutationResponseFromState(
  state: ManuAppState,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  operation: ConversationMutationOperation,
  conversationId: string,
  message: MessageRecord | null,
  generatedAt = new Date().toISOString(),
) {
  return buildConversationMutationResponse(
    conversationProjectionSourceFromAppState(state),
    actor,
    assignments,
    operation,
    conversationId,
    message,
    generatedAt,
  );
}

export function conversationActorFromTenantContext(context: AppTenantContext): ConversationActorContext {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    dietitianId: context.dietitianId,
    role: context.role,
  };
}

export function resolveDraftMutationResultMessage(
  action: ConversationDraftAction,
  before: MessageRecord,
  after: MessageRecord | null,
): MessageRecord | null {
  if (action === "dismiss") return null;
  if (action === "review_send_manual") {
    return after?.origin === "dietitian_manual" && after.status === "sent" ? after : null;
  }
  if (!after || after.status !== "sent") return null;
  return after;
}

export function readConversationRevisionFromState(state: ManuAppState, conversationId: string) {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  return conversationRevisionOrDefault(conversation);
}
