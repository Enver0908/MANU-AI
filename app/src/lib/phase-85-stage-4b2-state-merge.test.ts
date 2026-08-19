import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  mergeConversationDetailResponseIntoAppState,
  mergeConversationMutationResponseIntoAppState,
  shouldRefreshAppStateAfterConversationMutation,
} from "./phase-85-stage-4b2-state-merge";
import type { ConversationDetailResponse, ConversationMutationResponse } from "./phase-85-stage-4b2-contracts";
import { PHASE_85_STAGE_4B_2_API_VERSION } from "./phase-85-stage-4b2-contracts";

describe("phase-85-stage-4b2-state-merge", () => {
  it("merges bounded detail messages and conversation revision into legacy state", () => {
    const state = createInitialState();
    const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
    const detail: ConversationDetailResponse = {
      version: PHASE_85_STAGE_4B_2_API_VERSION,
      generatedAt: "2026-05-22T10:00:00.000Z",
      conversation: {
        id: conversation.id,
        clientId: conversation.clientId,
        clientFullName: "Mert",
        channel: "whatsapp",
        revision: (conversation.revision ?? 1) + 1,
        lastActivityAt: "2026-05-22T10:00:00.000Z",
        safeStatus: "normal",
      },
      messages: [
        {
          id: "message-merge-1",
          conversationId: conversation.id,
          sender: "dietitian",
          origin: "dietitian_manual",
          body: "Elle yanit",
          contentStatus: "available",
          status: "sent",
          isDraft: false,
          sourceMessageId: null,
          createdAt: "2026-05-22T10:00:00.000Z",
          conversationSequence: 3,
        },
      ],
      pagination: {
        requestedDirection: "older",
        anchorMessageId: null,
        olderCursor: null,
        newerCursor: null,
        hasOlder: false,
        hasNewer: false,
      },
      receipt: null,
      unreadCount: 0,
      permissions: {
        canRead: true,
        canViewTranscript: true,
        canMarkRead: true,
        canSendManualReply: true,
        canReviewDraft: true,
        canActivateAi: true,
        canConfigureAi: true,
        canResolveRisk: true,
        canMutateConversation: true,
        isReadOnly: false,
        assignmentLevel: "primary",
        scope: "tenant",
      },
    };

    const merged = mergeConversationDetailResponseIntoAppState(state, detail);
    expect(merged.conversations.find((item) => item.id === conversation.id)?.revision).toBe(detail.conversation.revision);
    expect(merged.messages.some((item) => item.id === "message-merge-1")).toBe(true);
    expect((merged as { items?: unknown }).items).toBeUndefined();
  });

  it("merges manual reply mutation without leaking full app state", () => {
    const state = createInitialState();
    const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
    const mutation: ConversationMutationResponse = {
      version: PHASE_85_STAGE_4B_2_API_VERSION,
      generatedAt: "2026-05-22T10:01:00.000Z",
      operation: "manual_reply",
      conversationId: conversation.id,
      conversationRevision: (conversation.revision ?? 1) + 1,
      message: {
        id: "message-mutation-1",
        conversationId: conversation.id,
        sender: "dietitian",
        origin: "dietitian_manual",
        body: "Yanit",
        contentStatus: "available",
        status: "sent",
        isDraft: false,
        sourceMessageId: null,
        createdAt: "2026-05-22T10:01:00.000Z",
        conversationSequence: 4,
      },
      receipt: null,
      unreadCount: 0,
      permissions: {
        canRead: true,
        canViewTranscript: true,
        canMarkRead: true,
        canSendManualReply: true,
        canReviewDraft: true,
        canActivateAi: true,
        canConfigureAi: true,
        canResolveRisk: true,
        canMutateConversation: true,
        isReadOnly: false,
        assignmentLevel: "primary",
        scope: "tenant",
      },
    };

    const merged = mergeConversationMutationResponseIntoAppState(state, mutation);
    expect(merged.messages.find((item) => item.id === "message-mutation-1")?.body).toBe("Yanit");
    expect(merged.conversations.find((item) => item.id === conversation.id)?.revision).toBe(
      mutation.conversationRevision,
    );
  });

  it("does not request a broad app-state refresh after conversation mutations", () => {
    expect(shouldRefreshAppStateAfterConversationMutation("manual_reply")).toBe(false);
    expect(shouldRefreshAppStateAfterConversationMutation("draft_review")).toBe(false);
    expect(shouldRefreshAppStateAfterConversationMutation("mark_read")).toBe(false);
  });
});
