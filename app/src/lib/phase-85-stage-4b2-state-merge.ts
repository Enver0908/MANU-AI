import type {
  ConversationDetailResponse,
  ConversationMessageDto,
  ConversationMutationResponse,
  ConversationReadReceiptRecord,
} from "./phase-85-stage-4b2-contracts";
import type { ManuAppState, MessageRecord } from "./types";

export function conversationMessageDtoToRecord(
  dto: ConversationMessageDto,
  tenantId: string,
  existing?: MessageRecord,
): MessageRecord {
  const status = dto.isDraft
    ? "draft"
    : dto.status === "sent"
      ? "sent"
      : (dto.status as MessageRecord["status"]);
  return {
    id: dto.id,
    tenantId,
    conversationId: dto.conversationId,
    sender: dto.sender,
    body: dto.body ?? "",
    origin: dto.origin,
    sourceMessageId: dto.sourceMessageId,
    authorDietitianId: existing?.authorDietitianId ?? null,
    generatedByAiDecisionId: existing?.generatedByAiDecisionId ?? null,
    approvedByDietitianId: existing?.approvedByDietitianId ?? null,
    risk: existing?.risk ?? null,
    status,
    contentStatus: dto.contentStatus,
    conversationSequence: dto.conversationSequence,
    createdAt: dto.createdAt,
  };
}

function upsertReceipt(
  receipts: ConversationReadReceiptRecord[],
  nextReceipt: ConversationReadReceiptRecord,
) {
  const index = receipts.findIndex(
    (item) =>
      item.tenantId === nextReceipt.tenantId &&
      item.conversationId === nextReceipt.conversationId &&
      item.dietitianId === nextReceipt.dietitianId,
  );
  if (index < 0) return [...receipts, nextReceipt];
  const receiptsCopy = [...receipts];
  receiptsCopy[index] = nextReceipt;
  return receiptsCopy;
}

function upsertMessagesForConversation(
  messages: MessageRecord[],
  conversationId: string,
  incoming: MessageRecord[],
) {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const preserved = messages.filter((item) => item.conversationId !== conversationId);
  const mergedExisting = messages
    .filter((item) => item.conversationId === conversationId)
    .map((item) => incomingById.get(item.id) ?? item);
  const mergedIds = new Set(mergedExisting.map((item) => item.id));
  const appended = incoming.filter((item) => !mergedIds.has(item.id));
  return [...preserved, ...mergedExisting, ...appended].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function mergeConversationDetailResponseIntoAppState(
  state: ManuAppState,
  detail: ConversationDetailResponse,
): ManuAppState {
  const tenantId = state.tenant.id;
  const incomingMessages = detail.messages.map((message) =>
    conversationMessageDtoToRecord(
      message,
      tenantId,
      state.messages.find((item) => item.id === message.id),
    ),
  );
  const conversations = state.conversations.map((conversation) =>
    conversation.id === detail.conversation.id
      ? {
          ...conversation,
          revision: detail.conversation.revision,
        }
      : conversation,
  );

  return {
    ...state,
    conversations,
    messages: upsertMessagesForConversation(state.messages, detail.conversation.id, incomingMessages),
    conversationReadReceipts: detail.receipt
      ? upsertReceipt(state.conversationReadReceipts, detail.receipt)
      : state.conversationReadReceipts,
  };
}

export function mergeConversationMutationResponseIntoAppState(
  state: ManuAppState,
  mutation: ConversationMutationResponse,
): ManuAppState {
  const next = {
    ...state,
    conversations: state.conversations.map((conversation) =>
      conversation.id === mutation.conversationId
        ? { ...conversation, revision: mutation.conversationRevision }
        : conversation,
    ),
    conversationReadReceipts: mutation.receipt
      ? upsertReceipt(state.conversationReadReceipts, mutation.receipt)
      : state.conversationReadReceipts,
  };

  if (!mutation.message) {
    return next;
  }

  const existing = state.messages.find((item) => item.id === mutation.message!.id);
  const record = conversationMessageDtoToRecord(mutation.message, state.tenant.id, existing);
  return {
    ...next,
    messages: upsertMessagesForConversation(next.messages, mutation.conversationId, [record]),
  };
}

export function shouldRefreshAppStateAfterConversationMutation(
  operation: ConversationMutationResponse["operation"],
) {
  return operation === "manual_reply" || operation === "draft_review";
}
