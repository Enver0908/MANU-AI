import type { AppTenantContext } from "./auth-context";
import { AppDomainError } from "./app-errors";
import type { ManuAppState, TenantRole } from "./types";
import type {
  ConversationActorContext,
  ConversationAssignmentInput,
  ConversationDetailQuery,
  ConversationDetailResponse,
  ConversationInboxItem,
  ConversationListCursorPayload,
  ConversationListResponse,
  ConversationMessageDirection,
  ConversationProjectionClient,
  ConversationProjectionConversation,
  ConversationProjectionMessage,
  ConversationProjectionSource,
  ConversationReadReceiptRecord,
  ConversationSafeStatus,
  ConversationSummaryDto,
} from "./phase-85-stage-4b2-contracts";
import {
  CONVERSATION_ANCHOR_AFTER_COUNT,
  CONVERSATION_ANCHOR_BEFORE_COUNT,
  CONVERSATION_LIST_MAX_PAGE_SIZE,
  PHASE_85_STAGE_4B_2_API_VERSION,
} from "./phase-85-stage-4b2-contracts";
import {
  assertConversationReadable,
  countConversationUnreadMessages,
  decodeConversationListCursor,
  decodeConversationMessageCursor,
  encodeConversationListCursor,
  encodeConversationMessageCursor,
  normalizeConversationPreview,
  parseConversationDetailQuery,
  parseConversationListQuery,
  projectConversationMessage,
  resolveConversationPermissions,
  type ConversationDetailBuildInput,
  type ConversationListBuildInput,
} from "./phase-85-stage-4b2-api";
import {
  buildStage4B3MediaProjectionSourceFromState,
  filterStage4B3MediaProjectionForConversation,
  projectConversationMessageWithMedia,
} from "./phase-85-stage-4b3-bounded-media";

export const STAGE_4B2_INBOX_UNREAD_DISPLAY_CAP = 99;
export const STAGE_4B2_MESSAGING_PROJECTION_VERSION = "p85-stage-4b2-messaging-v1";

export type ConversationProjectionSnakeClient = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  lifecycle_status: "active" | "removed_anonymized";
  full_name: string;
  ai_status: "active" | "passive";
  human_takeover_locked: boolean;
  red_risk_lock: ConversationProjectionClient["redRiskLock"];
  yellow_risk_hold: ConversationProjectionClient["yellowRiskHold"];
};

export type ConversationProjectionSnakeConversation = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  client_id: string;
  channel: ConversationProjectionConversation["channel"];
  revision: number;
};

export type ConversationProjectionSnakeMessage = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  sender: ConversationProjectionMessage["sender"];
  body: string;
  origin: ConversationProjectionMessage["origin"];
  source_message_id?: string | null;
  conversation_sequence?: number | null;
  content_status?: ConversationProjectionMessage["contentStatus"];
  retrieval_eligibility?: ConversationProjectionMessage["retrievalEligibility"];
  status?: ConversationProjectionMessage["status"];
  created_at: string;
};

export type ConversationProjectionSnakeReceipt = {
  tenant_id: string;
  conversation_id: string;
  dietitian_id: string;
  actor_role: TenantRole;
  last_read_sequence: number;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationProjectionSnakeRows = {
  conversations: readonly ConversationProjectionSnakeConversation[];
  clients: readonly ConversationProjectionSnakeClient[];
  messages: readonly ConversationProjectionSnakeMessage[];
  receipts?: readonly ConversationProjectionSnakeReceipt[];
};

export type Stage4B2MessagingScaleFixtureOptions = {
  tenantId?: string;
  dietitianId?: string;
  messagesPerConversation?: number;
};

export function conversationActorFromContext(context: AppTenantContext): ConversationActorContext {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    dietitianId: context.dietitianId,
    role: context.role,
  };
}

export function conversationProjectionSourceFromAppState(state: ManuAppState): ConversationProjectionSource {
  return {
    conversations: state.conversations.map((conversation) => ({
      id: conversation.id,
      tenantId: conversation.tenantId,
      dietitianId: conversation.dietitianId,
      clientId: conversation.clientId,
      channel: conversation.channel,
      revision: conversation.revision,
    })),
    clients: state.clients.map((client) => ({
      id: client.id,
      tenantId: client.tenantId,
      dietitianId: client.dietitianId,
      lifecycleStatus: client.lifecycleStatus,
      fullName: client.fullName,
      aiStatus: client.aiStatus,
      humanTakeoverLocked: client.humanTakeoverLocked,
      redRiskLock: client.redRiskLock,
      yellowRiskHold: client.yellowRiskHold,
    })),
    messages: state.messages.map((message) => ({
      id: message.id,
      tenantId: message.tenantId,
      conversationId: message.conversationId,
      sender: message.sender,
      body: message.body,
      origin: message.origin,
      sourceMessageId: message.sourceMessageId,
      conversationSequence: message.conversationSequence,
      contentStatus: message.contentStatus,
      retrievalEligibility: message.retrievalEligibility ?? "eligible",
      status: message.status,
      createdAt: message.createdAt,
    })),
    receipts: state.conversationReadReceipts,
    media: buildStage4B3MediaProjectionSourceFromState(state),
  };
}

export function conversationProjectionSourceFromSnakeRows(
  rows: ConversationProjectionSnakeRows,
): ConversationProjectionSource {
  return {
    conversations: rows.conversations.map((conversation) => ({
      id: conversation.id,
      tenantId: conversation.tenant_id,
      dietitianId: conversation.dietitian_id,
      clientId: conversation.client_id,
      channel: conversation.channel,
      revision: conversation.revision,
    })),
    clients: rows.clients.map((client) => ({
      id: client.id,
      tenantId: client.tenant_id,
      dietitianId: client.dietitian_id,
      lifecycleStatus: client.lifecycle_status,
      fullName: client.full_name,
      aiStatus: client.ai_status,
      humanTakeoverLocked: client.human_takeover_locked,
      redRiskLock: client.red_risk_lock,
      yellowRiskHold: client.yellow_risk_hold,
    })),
    messages: rows.messages.map((message) => ({
      id: message.id,
      tenantId: message.tenant_id,
      conversationId: message.conversation_id,
      sender: message.sender,
      body: message.body,
      origin: message.origin,
      sourceMessageId: message.source_message_id ?? null,
      conversationSequence: message.conversation_sequence ?? null,
      contentStatus: message.content_status,
      retrievalEligibility: message.retrieval_eligibility ?? "eligible",
      status: message.status,
      createdAt: message.created_at,
    })),
    receipts: (rows.receipts ?? []).map((receipt) => ({
      tenantId: receipt.tenant_id,
      conversationId: receipt.conversation_id,
      dietitianId: receipt.dietitian_id,
      actorRole: receipt.actor_role,
      lastReadSequence: Number(receipt.last_read_sequence),
      readAt: receipt.read_at,
      createdAt: receipt.created_at,
      updatedAt: receipt.updated_at,
    })),
  };
}

export function createStage4B2MessagingScaleFixture(
  conversationCount: number,
  options: Stage4B2MessagingScaleFixtureOptions = {},
): ConversationProjectionSource {
  const tenantId = options.tenantId ?? "tenant-scale-4b2";
  const dietitianId = options.dietitianId ?? "dietitian-scale-4b2";
  const messagesPerConversation = options.messagesPerConversation ?? 2;

  const clients = Array.from({ length: conversationCount }, (_, index) => ({
    id: `scale-client-${index}`,
    tenantId,
    dietitianId,
    lifecycleStatus: "active" as const,
    fullName: `Scale Client ${String(index).padStart(4, "0")}`,
    aiStatus: "active" as const,
    humanTakeoverLocked: false,
    redRiskLock: { status: "none" as const },
    yellowRiskHold: { status: "none" as const },
  }));

  const conversations = clients.map((client, index) => ({
    id: `scale-conversation-${index}`,
    tenantId,
    dietitianId,
    clientId: client.id,
    channel: "whatsapp" as const,
    revision: 1,
  }));

  const messages = conversations.flatMap((conversation, conversationIndex) =>
    Array.from({ length: messagesPerConversation }, (_, messageIndex) => ({
      id: `scale-message-${conversationIndex}-${messageIndex}`,
      tenantId,
      conversationId: conversation.id,
      sender: "client" as const,
      body: `scale inbound ${conversationIndex}-${messageIndex}`,
      origin: "client_inbound" as const,
      sourceMessageId: null,
      conversationSequence: messageIndex + 1,
      contentStatus: "available" as const,
      status: "sent" as const,
      createdAt: `2026-05-22T${String(conversationIndex % 24).padStart(2, "0")}:${String(messageIndex).padStart(2, "0")}:00.000Z`,
    })),
  );

  return { conversations, clients, messages, receipts: [] };
}

function timestampValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareTimestampAscending(left: string | null, right: string | null) {
  const leftValue = timestampValue(left);
  const rightValue = timestampValue(right);
  if (leftValue === rightValue) return 0;
  if (leftValue === Number.NEGATIVE_INFINITY) return -1;
  if (rightValue === Number.NEGATIVE_INFINITY) return 1;
  return leftValue - rightValue;
}

function compareMessageChronologically(left: ConversationProjectionMessage, right: ConversationProjectionMessage) {
  const byTime = compareTimestampAscending(left.createdAt, right.createdAt);
  if (byTime !== 0) return byTime;

  const leftSequence = left.conversationSequence;
  const rightSequence = right.conversationSequence;
  if (leftSequence !== rightSequence) {
    if (leftSequence == null) return 1;
    if (rightSequence == null) return -1;
    return leftSequence - rightSequence;
  }

  return left.id.localeCompare(right.id);
}

function sortedConversationMessages(
  source: ConversationProjectionSource,
  conversationId: string,
  tenantId: string,
) {
  return source.messages
    .filter((message) => message.tenantId === tenantId && message.conversationId === conversationId)
    .slice()
    .sort(compareMessageChronologically);
}

function latestTranscriptMessage(messages: readonly ConversationProjectionMessage[]) {
  return messages.length ? messages[messages.length - 1] : null;
}

function getActorReceipt(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  conversationId: string,
): ConversationReadReceiptRecord | null {
  return (
    source.receipts?.find(
      (receipt) =>
        receipt.tenantId === actor.tenantId &&
        receipt.conversationId === conversationId &&
        receipt.dietitianId === actor.dietitianId,
    ) ?? null
  );
}

function safeStatusForClient(client: ConversationProjectionClient): ConversationSafeStatus {
  if (
    client.humanTakeoverLocked ||
    client.redRiskLock.status === "locked" ||
    client.yellowRiskHold.status === "active"
  ) {
    return "attention";
  }
  return client.aiStatus === "passive" ? "ai_passive" : "normal";
}

function projectConversationSummary(
  conversation: ConversationProjectionConversation,
  client: ConversationProjectionClient,
  messages: readonly ConversationProjectionMessage[],
): ConversationSummaryDto {
  const latest = latestTranscriptMessage(messages);
  return {
    id: conversation.id,
    clientId: client.id,
    clientFullName: client.fullName,
    channel: conversation.channel,
    revision: conversation.revision,
    lastActivityAt: latest?.createdAt ?? null,
    safeStatus: safeStatusForClient(client),
  };
}

function compareInboxItems(
  left: Pick<ConversationInboxItem, "id" | "lastActivityAt">,
  right: Pick<ConversationInboxItem, "id" | "lastActivityAt">,
) {
  const byActivity = compareTimestampAscending(right.lastActivityAt, left.lastActivityAt);
  if (byActivity !== 0) return byActivity;
  return right.id.localeCompare(left.id);
}

function isAfterListCursor(item: ConversationInboxItem, cursor: ConversationListCursorPayload) {
  const byActivity = compareTimestampAscending(cursor.lastActivityAt, item.lastActivityAt);
  if (byActivity !== 0) return byActivity > 0;
  return item.id.localeCompare(cursor.conversationId) < 0;
}

function projectInboxItem(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  conversation: ConversationProjectionConversation,
  client: ConversationProjectionClient,
): ConversationInboxItem {
  const messages = sortedConversationMessages(source, conversation.id, actor.tenantId);
  const receipt = getActorReceipt(source, actor, conversation.id);
  const unreadCount =
    source.unreadCounts?.find((item) => item.conversationId === conversation.id)?.unreadCount ??
    countConversationUnreadMessages(messages, receipt);
  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  const latest = latestTranscriptMessage(messages);

  return {
    id: conversation.id,
    clientId: client.id,
    clientFullName: client.fullName,
    channel: conversation.channel,
    preview: normalizeConversationPreview(latest, source.media),
    lastActivityAt: latest?.createdAt ?? null,
    lastMessageId: latest?.id ?? null,
    unreadCount,
    hasUnread: unreadCount > 0,
    safeStatus: safeStatusForClient(client),
    permissions,
  };
}

function matchesClientName(clientFullName: string, query: string) {
  if (!query) return true;
  return clientFullName.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"));
}

function findConversationPageStart(
  items: readonly ConversationInboxItem[],
  cursor: ConversationListCursorPayload | null,
) {
  if (!cursor) return 0;
  const cursorIndex = items.findIndex((item) => item.id === cursor.conversationId);
  if (cursorIndex >= 0) return cursorIndex + 1;
  return items.findIndex((item) => isAfterListCursor(item, cursor));
}

export function buildConversationListResponse(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  input: ConversationListBuildInput = {},
): ConversationListResponse {
  const query = parseConversationListQuery({
    status: input.status == null ? null : String(input.status),
    query: input.query,
    cursor: input.cursor,
    limit: input.limit == null ? null : String(input.limit),
  });
  const clientsById = new Map(
    source.clients
      .filter((client) => client.tenantId === actor.tenantId)
      .map((client) => [client.id, client]),
  );

  const visibleProjected = source.conversations
    .filter((conversation) => conversation.tenantId === actor.tenantId)
    .map((conversation) => {
      const client = clientsById.get(conversation.clientId);
      if (!client || client.lifecycleStatus !== "active") return null;
      const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
      if (!permissions.canRead) return null;
      return projectInboxItem(source, actor, assignments, conversation, client);
    })
    .filter((item): item is ConversationInboxItem => item !== null);

  const projected = visibleProjected
    .filter((item) => matchesClientName(item.clientFullName, query.query))
    .filter((item) => query.status === "all" || item.hasUnread)
    .sort(compareInboxItems);

  const cursor = decodeConversationListCursor(query.cursor, {
    status: query.status,
    query: query.query,
  });
  const start = findConversationPageStart(projected, cursor);
  const safeStart = start < 0 ? projected.length : start;
  const items = projected.slice(safeStart, safeStart + query.limit);
  const lastItem = items[items.length - 1];
  const nextCursor =
    lastItem && safeStart + items.length < projected.length
      ? encodeConversationListCursor({
          status: query.status,
          query: query.query,
          lastActivityAt: lastItem.lastActivityAt,
          conversationId: lastItem.id,
        })
      : null;

  return {
    version: PHASE_85_STAGE_4B_2_API_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    items,
    nextCursor,
    filteredTotal: projected.length,
    unreadConversationCount: visibleProjected.filter((item) => item.hasUnread).length,
    unreadMessageCount: visibleProjected.reduce((total, item) => total + item.unreadCount, 0),
  };
}

function findMessageIndex(messages: readonly ConversationProjectionMessage[], messageId: string) {
  return messages.findIndex((message) => message.id === messageId);
}

function cursorForMessage(
  conversationId: string,
  direction: ConversationMessageDirection,
  message: ConversationProjectionMessage,
) {
  return encodeConversationMessageCursor({
    direction,
    conversationId,
    messageId: message.id,
    conversationSequence: message.conversationSequence ?? null,
    createdAt: message.createdAt,
  });
}

function resolveDetailWindow(
  messages: readonly ConversationProjectionMessage[],
  conversationId: string,
  query: ConversationDetailQuery,
) {
  if (query.anchorMessageId) {
    const anchorIndex = findMessageIndex(messages, query.anchorMessageId);
    if (anchorIndex < 0) throw new AppDomainError(404, "message_not_found");
    return {
      start: Math.max(0, anchorIndex - CONVERSATION_ANCHOR_BEFORE_COUNT),
      end: Math.min(messages.length, anchorIndex + CONVERSATION_ANCHOR_AFTER_COUNT + 1),
    };
  }

  if (!query.cursor) {
    return {
      start: Math.max(0, messages.length - query.limit),
      end: messages.length,
    };
  }

  const cursor = decodeConversationMessageCursor(query.cursor, {
    direction: query.direction,
    conversationId,
  });
  if (!cursor) throw new AppDomainError(400, "invalid_cursor");
  const boundaryIndex = findMessageIndex(messages, cursor.messageId);
  if (boundaryIndex < 0) throw new AppDomainError(400, "invalid_cursor");

  if (query.direction === "older") {
    return {
      start: Math.max(0, boundaryIndex - query.limit),
      end: boundaryIndex,
    };
  }

  return {
    start: boundaryIndex + 1,
    end: Math.min(messages.length, boundaryIndex + 1 + query.limit),
  };
}

export function buildConversationDetailResponse(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  conversationId: string,
  input: ConversationDetailBuildInput = {},
): ConversationDetailResponse {
  const query = parseConversationDetailQuery({
    direction: input.direction == null ? null : String(input.direction),
    cursor: input.cursor,
    anchorMessageId: input.anchorMessageId,
    limit: input.limit == null ? null : String(input.limit),
  });
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

  if (!conversation || !client) throw new AppDomainError(404, "conversation_not_found");
  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  assertConversationReadable(permissions);

  const messages = sortedConversationMessages(source, conversation.id, actor.tenantId);
  const window = resolveDetailWindow(messages, conversation.id, query);
  const visibleMessages = messages.slice(window.start, window.end);
  const firstVisible = visibleMessages[0];
  const lastVisible = visibleMessages[visibleMessages.length - 1];
  const receipt = getActorReceipt(source, actor, conversation.id);

  const conversationMedia = source.media
    ? filterStage4B3MediaProjectionForConversation(source.media, actor.tenantId, conversation.id)
    : undefined;

  return {
    version: PHASE_85_STAGE_4B_2_API_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    conversation: projectConversationSummary(conversation, client, messages),
    messages: visibleMessages.map((message) =>
      projectConversationMessageWithMedia(
        message,
        actor,
        conversationMedia,
        projectConversationMessage(message),
      ),
    ),
    pagination: {
      requestedDirection: query.direction,
      anchorMessageId: query.anchorMessageId,
      olderCursor:
        window.start > 0 && firstVisible
          ? cursorForMessage(conversation.id, "older", firstVisible)
          : null,
      newerCursor:
        window.end < messages.length && lastVisible
          ? cursorForMessage(conversation.id, "newer", lastVisible)
          : null,
      hasOlder: window.start > 0,
      hasNewer: window.end < messages.length,
    },
    receipt,
    unreadCount:
      source.unreadCounts?.find((item) => item.conversationId === conversationId)?.unreadCount ??
      countConversationUnreadMessages(messages, receipt),
    permissions,
  };
}

export function buildConversationListResponseFromAppState(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: readonly ConversationAssignmentInput[],
  input: ConversationListBuildInput = {},
) {
  return buildConversationListResponse(
    conversationProjectionSourceFromAppState(state),
    conversationActorFromContext(context),
    assignments,
    input,
  );
}

export function buildConversationDetailResponseFromAppState(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: readonly ConversationAssignmentInput[],
  conversationId: string,
  input: ConversationDetailBuildInput = {},
) {
  return buildConversationDetailResponse(
    conversationProjectionSourceFromAppState(state),
    conversationActorFromContext(context),
    assignments,
    conversationId,
    input,
  );
}

export function projectConversationInboxItemForActor(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  conversationId: string,
): ConversationInboxItem {
  const conversation = source.conversations.find(
    (item) => item.tenantId === actor.tenantId && item.id === conversationId,
  );
  const client = conversation
    ? source.clients.find((item) => item.tenantId === actor.tenantId && item.id === conversation.clientId)
    : undefined;
  if (!conversation || !client || client.lifecycleStatus !== "active") {
    throw new AppDomainError(404, "conversation_not_found");
  }
  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  assertConversationReadable(permissions);
  return projectInboxItem(source, actor, assignments, conversation, client);
}

export function buildEmptyConversationProjectionSource(): ConversationProjectionSource {
  return { conversations: [], clients: [], messages: [], receipts: [] };
}

export function countActorConversationUnreadTotal(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
) {
  const list = buildConversationListResponse(source, actor, assignments, {
    status: "all",
    limit: CONVERSATION_LIST_MAX_PAGE_SIZE,
  });
  return list.unreadMessageCount;
}

export function formatActorConversationUnreadBadge(unreadTotal: number) {
  if (unreadTotal > STAGE_4B2_INBOX_UNREAD_DISPLAY_CAP) return "99+";
  return String(unreadTotal);
}

export type {
  ConversationDetailBuildInput,
  ConversationListBuildInput,
} from "./phase-85-stage-4b2-api";
