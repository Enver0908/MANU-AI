import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { createInitialState, DEMO_DIETITIAN_ID, DEMO_TENANT_ID } from "./seed-data";
import { decodeConversationListCursor, decodeConversationMessageCursor } from "./phase-85-stage-4b2-api";
import {
  buildConversationDetailResponse,
  buildConversationDetailResponseFromAppState,
  buildConversationListResponse,
  buildConversationListResponseFromAppState,
  conversationActorFromContext,
  conversationProjectionSourceFromAppState,
  conversationProjectionSourceFromSnakeRows,
  countActorConversationUnreadTotal,
  createStage4B2MessagingScaleFixture,
  formatActorConversationUnreadBadge,
} from "./phase-85-stage-4b2-messaging";
import type { ConversationActorContext } from "./phase-85-stage-4b2-contracts";

function actor(role: ConversationActorContext["role"], dietitianId = DEMO_DIETITIAN_ID): ConversationActorContext {
  return {
    tenantId: DEMO_TENANT_ID,
    userId: `user-${role}`,
    dietitianId,
    role,
  };
}

describe("phase-85-stage-4b-2 messaging projection", () => {
  it("keeps fallback and snake-case adapter parity for list and detail projections", () => {
    const state = createInitialState();
    const context = {
      tenantId: state.tenant.id,
      userId: "user-owner",
      dietitianId: state.dietitian.id,
      role: "owner" as const,
    };
    const camelSource = conversationProjectionSourceFromAppState(state);
    const snakeSource = conversationProjectionSourceFromSnakeRows({
      conversations: state.conversations.map((conversation) => ({
        id: conversation.id,
        tenant_id: conversation.tenantId,
        dietitian_id: conversation.dietitianId,
        client_id: conversation.clientId,
        channel: conversation.channel,
        revision: conversation.revision,
      })),
      clients: state.clients.map((client) => ({
        id: client.id,
        tenant_id: client.tenantId,
        dietitian_id: client.dietitianId,
        lifecycle_status: client.lifecycleStatus,
        full_name: client.fullName,
        ai_status: client.aiStatus,
        human_takeover_locked: client.humanTakeoverLocked,
        red_risk_lock: client.redRiskLock,
        yellow_risk_hold: client.yellowRiskHold,
      })),
      messages: state.messages.map((message) => ({
        id: message.id,
        tenant_id: message.tenantId,
        conversation_id: message.conversationId,
        sender: message.sender,
        body: message.body,
        origin: message.origin,
        source_message_id: message.sourceMessageId,
        conversation_sequence: message.conversationSequence,
        content_status: message.contentStatus,
        status: message.status,
        created_at: message.createdAt,
      })),
      receipts: [],
    });

    const fallbackList = buildConversationListResponseFromAppState(state, context, [], {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    const camelList = buildConversationListResponse(camelSource, conversationActorFromContext(context), [], {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    const snakeList = buildConversationListResponse(snakeSource, conversationActorFromContext(context), [], {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(camelList).toEqual(fallbackList);
    expect(snakeList).toEqual(fallbackList);

    const conversationId = state.conversations[0]!.id;
    const fallbackDetail = buildConversationDetailResponseFromAppState(state, context, [], conversationId, {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    const camelDetail = buildConversationDetailResponse(camelSource, conversationActorFromContext(context), [], conversationId, {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    const snakeDetail = buildConversationDetailResponse(snakeSource, conversationActorFromContext(context), [], conversationId, {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(camelDetail).toEqual(fallbackDetail);
    expect(snakeDetail).toEqual(fallbackDetail);
  });

  it("bounds scale list output and preserves deterministic ordering for equal timestamps", () => {
    const source = createStage4B2MessagingScaleFixture(250, {
      tenantId: DEMO_TENANT_ID,
      dietitianId: DEMO_DIETITIAN_ID,
      messagesPerConversation: 1,
    });
    const response = buildConversationListResponse(source, actor("owner"), [], {
      limit: 100,
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(response.items).toHaveLength(100);
    expect(response.filteredTotal).toBe(250);
    expect(response.nextCursor).toBeTruthy();
    expect(JSON.stringify(response).length).toBeLessThan(250_000);

    const equalTimestampSource = {
      ...source,
      conversations: source.conversations.slice(0, 2),
      clients: source.clients.slice(0, 2),
      messages: [
        {
          ...source.messages[0]!,
          id: "equal-a",
          conversationId: source.conversations[0]!.id,
          createdAt: "2026-05-22T10:00:00.000Z",
        },
        {
          ...source.messages[1]!,
          id: "equal-b",
          conversationId: source.conversations[1]!.id,
          createdAt: "2026-05-22T10:00:00.000Z",
        },
      ],
    };
    const ordered = buildConversationListResponse(equalTimestampSource, actor("owner"), [], { limit: 10 });
    expect(ordered.items.map((item) => item.id)).toEqual([
      source.conversations[1]!.id,
      source.conversations[0]!.id,
    ]);
  });

  it("handles null legacy sequences, 99+ unread totals, revoked/redacted filtering, and invalid cursors", () => {
    const state = createInitialState();
    const conversationId = state.conversations[0]!.id;
    const base = state.messages[0]!;
    const unreadMessages = Array.from({ length: 101 }, (_, index) => ({
      ...base,
      id: `unread-${index}`,
      conversationId,
      origin: "client_inbound" as const,
      conversationSequence: index + 1,
      createdAt: `2026-05-22T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
    }));
    const source = {
      conversations: state.conversations.slice(0, 1),
      clients: state.clients.slice(0, 1),
      messages: [
        ...unreadMessages,
        {
          ...base,
          id: "legacy-null-sequence",
          conversationSequence: null,
          origin: "client_inbound" as const,
          createdAt: "2026-05-21T10:00:00.000Z",
        },
        {
          ...base,
          id: "revoked-inbound",
          origin: "client_inbound" as const,
          contentStatus: "revoked" as const,
          conversationSequence: 200,
          createdAt: "2026-05-22T11:00:00.000Z",
        },
        {
          ...base,
          id: "redacted-inbound",
          origin: "client_inbound" as const,
          contentStatus: "redacted" as const,
          conversationSequence: 201,
          createdAt: "2026-05-22T11:01:00.000Z",
        },
      ],
      receipts: [],
    };

    const unreadTotal = countActorConversationUnreadTotal(source, actor("dietitian"), []);
    expect(unreadTotal).toBe(101);
    expect(formatActorConversationUnreadBadge(unreadTotal)).toBe("99+");

    const detail = buildConversationDetailResponse(source, actor("dietitian"), [], conversationId, {
      anchorMessageId: "unread-50",
      generatedAt: "2026-05-22T12:00:00.000Z",
    });
    expect(detail.messages.some((message) => message.id === "unread-50")).toBe(true);
    expect(detail.messages.find((message) => message.id === "revoked-inbound")).toMatchObject({
      body: null,
      contentStatus: "revoked",
    });
    expect(detail.unreadCount).toBe(101);

    expect(() =>
      decodeConversationListCursor("not-a-valid-cursor", { status: "all", query: "" }),
    ).toThrow(AppDomainError);
    expect(() =>
      buildConversationDetailResponse(source, actor("dietitian"), [], conversationId, {
        cursor: "not-a-valid-cursor",
        direction: "older",
      }),
    ).toThrow(AppDomainError);
    expect(() =>
      decodeConversationMessageCursor("not-a-valid-cursor", {
        direction: "older",
        conversationId,
      }),
    ).toThrow(AppDomainError);
  });

  it("exposes fallback list/detail helpers over the seeded app state", () => {
    const state = createInitialState();
    const context = {
      tenantId: state.tenant.id,
      userId: "user-dietitian",
      dietitianId: state.dietitian.id,
      role: "dietitian" as const,
    };
    const list = listFallbackConversationsFromState(state, context, { limit: 5 });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items[0]?.clientFullName).toBeTruthy();

    const detail = getFallbackConversationDetailFromState(state, context, state.conversations[0]!.id);
    expect(detail.conversation.id).toBe(state.conversations[0]!.id);
  });
});

function listFallbackConversationsFromState(
  state: ReturnType<typeof createInitialState>,
  context: Parameters<typeof buildConversationListResponseFromAppState>[1],
  input: Parameters<typeof buildConversationListResponseFromAppState>[3],
) {
  return buildConversationListResponseFromAppState(state, context, [], input);
}

function getFallbackConversationDetailFromState(
  state: ReturnType<typeof createInitialState>,
  context: Parameters<typeof buildConversationDetailResponseFromAppState>[1],
  conversationId: string,
) {
  return buildConversationDetailResponseFromAppState(state, context, [], conversationId);
}
