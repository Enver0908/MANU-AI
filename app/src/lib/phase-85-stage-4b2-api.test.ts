import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { createInitialState } from "./seed-data";
import {
  buildConversationDetailResponse,
  buildConversationListResponse,
  canPerformConversationOperation,
  countConversationUnreadMessages,
  decodeConversationListCursor,
  decodeConversationMessageCursor,
  encodeConversationListCursor,
  normalizeConversationPreview,
  parseConversationDetailLimit,
  parseConversationListLimit,
  parseConversationListQuery,
  projectConversationMessage,
  resolveConversationPermissions,
  assertConversationOperationAllowed,
} from "./phase-85-stage-4b2-api";
import type {
  ConversationActorContext,
  ConversationAssignmentInput,
  ConversationProjectionSource,
} from "./phase-85-stage-4b2-contracts";
import { DEMO_DIETITIAN_ID, DEMO_TENANT_ID } from "./seed-data";

function actor(role: ConversationActorContext["role"], dietitianId = DEMO_DIETITIAN_ID): ConversationActorContext {
  return {
    tenantId: DEMO_TENANT_ID,
    userId: `user-${role}`,
    dietitianId,
    role,
  };
}

function assignment(
  clientId: string,
  dietitianId: string,
  accessLevel: "care_team" | "viewer",
): ConversationAssignmentInput {
  return {
    tenantId: DEMO_TENANT_ID,
    clientId,
    dietitianId,
    accessLevel,
  };
}

describe("phase-85-stage-4b-2 domain and api contracts", () => {
  it("locks the role and assignment permission matrix", () => {
    const state = createInitialState();
    const primaryConversation = state.conversations.find((item) => item.clientId === "client-mert")!;
    const primaryClient = state.clients.find((item) => item.id === "client-mert")!;
    const assignedConversation = state.conversations.find((item) => item.clientId === "client-elif")!;
    const assignedClient = state.clients.find((item) => item.id === "client-elif")!;
    const assignments = [
      assignment("client-elif", "dietitian-other", "care_team"),
      assignment("client-deniz", "dietitian-other", "viewer"),
    ];

    const owner = resolveConversationPermissions({
      actor: actor("owner"),
      conversation: primaryConversation,
      client: primaryClient,
      assignments,
    });
    expect(owner).toMatchObject({
      canRead: true,
      canMarkRead: true,
      canSendManualReply: true,
      canReviewDraft: true,
      canActivateAi: true,
      canConfigureAi: true,
      assignmentLevel: "tenant",
      scope: "tenant",
    });

    const primary = resolveConversationPermissions({
      actor: actor("dietitian"),
      conversation: primaryConversation,
      client: primaryClient,
      assignments,
    });
    expect(primary.assignmentLevel).toBe("primary");
    expect(primary.canMutateConversation).toBe(true);

    const careTeam = resolveConversationPermissions({
      actor: actor("dietitian", "dietitian-other"),
      conversation: assignedConversation,
      client: assignedClient,
      assignments,
    });
    expect(careTeam).toMatchObject({
      canRead: true,
      canSendManualReply: true,
      canReviewDraft: true,
      assignmentLevel: "care_team",
    });

    const viewerConversation = state.conversations.find((item) => item.clientId === "client-deniz")!;
    const viewerClient = state.clients.find((item) => item.id === "client-deniz")!;
    const viewer = resolveConversationPermissions({
      actor: actor("dietitian", "dietitian-other"),
      conversation: viewerConversation,
      client: viewerClient,
      assignments,
    });
    expect(viewer).toMatchObject({
      canRead: true,
      canMarkRead: true,
      canSendManualReply: false,
      canReviewDraft: false,
      canActivateAi: false,
      canConfigureAi: false,
      isReadOnly: true,
      assignmentLevel: "viewer",
    });

    const assistant = resolveConversationPermissions({
      actor: actor("assistant", "dietitian-other"),
      conversation: assignedConversation,
      client: assignedClient,
      assignments,
    });
    expect(assistant).toMatchObject({
      canRead: true,
      canMarkRead: true,
      canSendManualReply: false,
      canReviewDraft: false,
      canActivateAi: false,
      canConfigureAi: false,
      isReadOnly: true,
      scope: "assigned",
    });

    const auditor = resolveConversationPermissions({
      actor: actor("auditor"),
      conversation: primaryConversation,
      client: primaryClient,
      assignments,
    });
    expect(auditor.canRead).toBe(false);
    expect(auditor.canMarkRead).toBe(false);

    const redLocked = resolveConversationPermissions({
      actor: actor("dietitian"),
      conversation: primaryConversation,
      client: {
        ...primaryClient,
        redRiskLock: {
          ...primaryClient.redRiskLock,
          status: "locked",
        },
      },
      assignments,
    });
    expect(redLocked.canActivateAi).toBe(true);
    expect(redLocked.canConfigureAi).toBe(false);
  });

  it("keeps assignment normalization fallback-compatible and tenant-scoped", () => {
    const state = createInitialState();
    const conversation = state.conversations.find((item) => item.clientId === "client-elif")!;
    const client = state.clients.find((item) => item.id === "client-elif")!;
    const permissions = resolveConversationPermissions({
      actor: actor("dietitian", "dietitian-other"),
      conversation,
      client,
      assignments: [
        { client_id: client.id, dietitian_id: "dietitian-other" },
        { tenant_id: "foreign-tenant", client_id: client.id, dietitian_id: "dietitian-other", access_level: "care_team" },
      ],
    });
    expect(permissions.assignmentLevel).toBe("care_team");

    const foreign = resolveConversationPermissions({
      actor: actor("dietitian", "dietitian-other"),
      conversation,
      client,
      assignments: [
        { tenantId: "foreign-tenant", clientId: client.id, dietitianId: "dietitian-other", accessLevel: "care_team" },
      ],
    });
    expect(foreign.canRead).toBe(false);
  });

  it("parses bounded list/detail inputs and rejects malformed values", () => {
    expect(parseConversationListLimit(null)).toBe(30);
    expect(parseConversationListLimit("101")).toBe(100);
    expect(parseConversationDetailLimit("101")).toBe(100);
    expect(parseConversationListQuery({ status: "unread", query: "  Mert  " })).toMatchObject({
      status: "unread",
      query: "Mert",
      limit: 30,
    });
    expect(() => parseConversationListLimit("0")).toThrowError(AppDomainError);
    expect(() => parseConversationListQuery({ query: "x".repeat(81) })).toThrowError(AppDomainError);
    expect(() => parseConversationListQuery({ status: "history" })).toThrowError(AppDomainError);
  });

  it("uses a versioned cursor that cannot cross list filters", () => {
    const encoded = encodeConversationListCursor({
      status: "all",
      query: "Mert",
      lastActivityAt: "2026-05-22T09:11:00.000Z",
      conversationId: "conversation-client-mert",
    });
    expect(decodeConversationListCursor(encoded, { status: "all", query: "Mert" })).toMatchObject({
      mode: "conversation_list",
      status: "all",
      query: "Mert",
    });
    expect(() => decodeConversationListCursor(encoded, { status: "unread", query: "Mert" })).toThrowError(
      AppDomainError,
    );
    expect(() => decodeConversationListCursor("not-a-cursor")).toThrowError(AppDomainError);
    expect(() => decodeConversationListCursor("A".repeat(2049))).toThrowError(AppDomainError);
  });

  it("projects a bounded list with name-only search, deterministic order and actor unread state", () => {
    const state = createInitialState();
    const baseMert = state.messages[0]!;
    const baseElif = { ...baseMert, id: "inbound-elif", conversationId: "conversation-client-elif" };
    const source: ConversationProjectionSource = {
      conversations: state.conversations,
      clients: state.clients,
      messages: [
        { ...baseMert, id: "mert-older", conversationSequence: 1, createdAt: "2026-05-22T10:00:00.000Z" },
        { ...baseElif, conversationSequence: 1, createdAt: "2026-05-22T10:00:00.000Z" },
        {
          ...baseElif,
          id: "draft-elif",
          sender: "assistant",
          origin: "ai_generated",
          status: "draft",
          body: "A draft with clinical details that must not become the inbox preview.",
          conversationSequence: 2,
          createdAt: "2026-05-22T10:01:00.000Z",
        },
      ],
      receipts: [
        {
          tenantId: DEMO_TENANT_ID,
          conversationId: "conversation-client-mert",
          dietitianId: DEMO_DIETITIAN_ID,
          actorRole: "dietitian",
          lastReadSequence: 0,
          readAt: null,
          createdAt: "2026-05-22T09:00:00.000Z",
          updatedAt: "2026-05-22T09:00:00.000Z",
        },
      ],
    };
    const response = buildConversationListResponse(source, actor("dietitian"), [], {
      limit: 10,
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(response.items[0]?.id).toBe("conversation-client-elif");
    expect(response.items.find((item) => item.id === "conversation-client-elif")?.preview).toBe(
      "Taslak inceleme bekliyor",
    );
    expect(response.items.find((item) => item.id === "conversation-client-mert")?.unreadCount).toBe(1);
    expect(buildConversationListResponse(source, actor("dietitian"), [], { query: "clinical" }).filteredTotal).toBe(0);
    expect(buildConversationListResponse(source, actor("dietitian"), [], { query: "MERT" }).filteredTotal).toBe(1);
    expect(response.unreadConversationCount).toBe(2);
    expect(response.unreadMessageCount).toBe(2);

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("healthProfile");
    expect(serialized).not.toContain("primaryPhoneE164");
    expect(serialized).not.toContain("clinicalRiskNotes");
    expect(serialized).not.toContain("rollingSummary");
  });

  it("caps previews, redacts unavailable message bodies and counts unavailable inbound messages", () => {
    const state = createInitialState();
    const base = state.messages[0]!;
    const longMessage = {
      ...base,
      id: "long-message",
      body: "x".repeat(200),
      conversationSequence: 1,
    };
    const unavailable = {
      ...base,
      id: "unavailable-message",
      body: "hidden clinical text",
      contentStatus: "content_unavailable" as const,
      conversationSequence: 2,
    };
    expect(Array.from(normalizeConversationPreview(longMessage)).length).toBeLessThanOrEqual(120);
    expect(projectConversationMessage(unavailable)).toMatchObject({
      body: null,
      contentStatus: "content_unavailable",
    });
    expect(
      countConversationUnreadMessages([longMessage, unavailable], null),
    ).toBe(2);
    expect(
      countConversationUnreadMessages(
        [{ ...unavailable, contentStatus: "redacted" }, { ...longMessage, contentStatus: "revoked" }],
        null,
      ),
    ).toBe(0);
  });

  it("returns bounded chronological detail pages and handles empty transcripts", () => {
    const state = createInitialState();
    const seed = state.messages[0]!;
    const messages = Array.from({ length: 60 }, (_, index) => ({
      ...seed,
      id: `message-${index + 1}`,
      conversationSequence: index + 1,
      createdAt: `2026-05-22T09:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
      body: `message-${index + 1}`,
    }));
    const source: ConversationProjectionSource = {
      conversations: state.conversations,
      clients: state.clients,
      messages,
      receipts: [],
    };
    const first = buildConversationDetailResponse(source, actor("owner"), [], "conversation-client-mert", {
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(first.messages).toHaveLength(50);
    expect(first.messages[0]?.id).toBe("message-11");
    expect(first.pagination.hasOlder).toBe(true);
    expect(first.pagination.olderCursor).toBeTruthy();
    const older = buildConversationDetailResponse(source, actor("owner"), [], "conversation-client-mert", {
      direction: "older",
      cursor: first.pagination.olderCursor,
      limit: 10,
    });
    expect(older.messages.map((item) => item.id)).toEqual(
      expect.arrayContaining(["message-1", "message-10"]),
    );
    expect(decodeConversationMessageCursor(first.pagination.olderCursor, {
      direction: "older",
      conversationId: "conversation-client-mert",
    })?.messageId).toBe("message-11");

    const empty = buildConversationDetailResponse(
      { conversations: [state.conversations[2]!], clients: [state.clients[2]!], messages: [], receipts: [] },
      actor("owner"),
      [],
      state.conversations[2]!.id,
    );
    expect(empty.messages).toEqual([]);
    expect(empty.unreadCount).toBe(0);
    expect(empty.pagination.olderCursor).toBeNull();
    expect(empty.pagination.newerCursor).toBeNull();
  });

  it("fail-closes missing/auditor access and rejects viewer or assistant domain writes", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const client = state.clients[0]!;
    const assistantPermissions = resolveConversationPermissions({
      actor: actor("assistant", "dietitian-other"),
      conversation,
      client,
      assignments: [assignment(client.id, "dietitian-other", "care_team")],
    });
    expect(canPerformConversationOperation(assistantPermissions, "mark_read")).toBe(true);
    expect(canPerformConversationOperation(assistantPermissions, "manual_reply")).toBe(false);
    expect(() => assertConversationOperationAllowed(assistantPermissions, "manual_reply")).toThrowError(
      AppDomainError,
    );

    const viewerPermissions = resolveConversationPermissions({
      actor: actor("dietitian", "dietitian-other"),
      conversation: state.conversations[2]!,
      client: state.clients[2]!,
      assignments: [assignment(state.clients[2]!.id, "dietitian-other", "viewer")],
    });
    expect(() => assertConversationOperationAllowed(viewerPermissions, "draft_review")).toThrowError(
      AppDomainError,
    );

    const auditorPermissions = resolveConversationPermissions({
      actor: actor("auditor"),
      conversation,
      client,
      assignments: [],
    });
    expect(() => assertConversationOperationAllowed(auditorPermissions, "mark_read")).toThrowError(AppDomainError);
  });
});
