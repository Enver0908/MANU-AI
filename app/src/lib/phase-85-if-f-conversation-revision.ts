import type { ConversationRecord, ManuAppState } from "./types";

export const PHASE_85_IF_F_CONVERSATION_REVISION_VERSION = "p85-if-f-conversation-revision-v1";

export function conversationRevisionOrDefault(conversation: ConversationRecord): number {
  return conversation.revision ?? 1;
}

export function incrementConversationRevision(
  state: ManuAppState,
  conversationId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  return {
    ...state,
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, revision: conversationRevisionOrDefault(conversation) + 1 }
        : conversation,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "conversation_revision_incremented",
        entityType: "conversation",
        entityId: conversationId,
        metadata: {},
        createdAt,
      },
    ],
  };
}
