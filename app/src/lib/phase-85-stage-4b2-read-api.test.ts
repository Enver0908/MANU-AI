import { describe, expect, it } from "vitest";
import { AppAuthError } from "./auth-context";
import { AppDomainError } from "./app-errors";
import {
  getFallbackConversationDetail,
  listFallbackConversations,
  markFallbackConversationRead,
  resetFallbackState,
} from "./app-state-store";
import {
  CONVERSATION_API_CACHE_CONTROL,
  conversationApiJsonResponse,
  requireConversationApiActor,
} from "./phase-85-stage-4b2-read-api";
import { createInitialState } from "./seed-data";

describe("phase-85-stage-4b-2 read api", () => {
  it("returns bounded fallback list and detail payloads without full-state helpers", () => {
    resetFallbackState();
    const list = listFallbackConversations({ limit: 5 });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.length).toBeLessThanOrEqual(5);
    expect(list.version).toBe("p85-stage-4b-2-api-v3");

    const conversationId = list.items[0]!.id;
    const detail = getFallbackConversationDetail(conversationId, { limit: 50 });
    expect(detail.conversation.id).toBe(conversationId);
    expect(detail.messages.length).toBeLessThanOrEqual(50);
    expect(detail.permissions.canRead).toBe(true);

    const serialized = JSON.stringify({ list, detail });
    expect(serialized).not.toContain("healthProfile");
    expect(serialized).not.toContain("handoffCases");
    expect(serialized).not.toContain("aiDecisions");
  });

  it("marks fallback conversation reads monotonically and returns bounded mutation DTO", () => {
    resetFallbackState();
    const conversationId = listFallbackConversations({ limit: 1 }).items[0]!.id;
    const detail = getFallbackConversationDetail(conversationId);
    const maxSequence = detail.messages.reduce(
      (max, message) => Math.max(max, message.conversationSequence ?? 0),
      0,
    );
    if (maxSequence < 1) {
      expect(() => markFallbackConversationRead(conversationId, 1)).toThrowError(AppDomainError);
      return;
    }

    const first = markFallbackConversationRead(conversationId, 1);
    expect(first.operation).toBe("mark_read");
    expect(first.receipt?.lastReadSequence).toBe(1);
    expect(first.unreadCount).toBeGreaterThanOrEqual(0);

    const backward = markFallbackConversationRead(conversationId, 1);
    expect(backward.receipt?.lastReadSequence).toBe(1);

    const full = markFallbackConversationRead(conversationId, maxSequence);
    expect(full.receipt?.lastReadSequence).toBe(maxSequence);
    expect(full.unreadCount).toBe(0);
  });

  it("rejects invalid mark-read input and hidden conversations fail closed", () => {
    resetFallbackState();
    expect(() => markFallbackConversationRead("missing-conversation", 1)).toThrowError(AppDomainError);
    expect(() => markFallbackConversationRead(listFallbackConversations().items[0]!.id, 0)).toThrowError(
      AppDomainError,
    );
  });

  it("blocks auditor actors and attaches no-store cache headers", () => {
    expect(() =>
      requireConversationApiActor({
        tenantId: "tenant-1",
        userId: "user-auditor",
        dietitianId: "dietitian-auditor",
        role: "auditor",
      }),
    ).toThrowError(AppAuthError);

    const response = conversationApiJsonResponse({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe(CONVERSATION_API_CACHE_CONTROL);
  });

  it("keeps stale anchor lookups fail-closed in fallback detail responses", () => {
    const state = createInitialState();
    resetFallbackState();
    const conversationId = state.conversations[0]!.id;
    expect(() =>
      getFallbackConversationDetail(conversationId, { anchorMessageId: "missing-anchor" }),
    ).toThrowError(AppDomainError);
  });
});
