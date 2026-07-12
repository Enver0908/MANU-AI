import { describe, expect, it } from "vitest";
import type { ConversationInboxItem } from "./phase-85-stage-4b2-contracts";
import {
  buildConversationStatusSegmentLabel,
  canOpenConversationInboxItem,
  formatConversationLastActivityAt,
  resolveConversationClientDisplayName,
  resolveConversationRowUnreadCount,
  resolveMessagingEmptyStateKeys,
} from "./messaging-panel-helpers";

function buildInboxItem(overrides: Partial<ConversationInboxItem> = {}): ConversationInboxItem {
  return {
    id: "conversation-1",
    clientId: "client-1",
    clientFullName: "Mert Kaya",
    channel: "whatsapp",
    preview: "Merhaba",
    lastActivityAt: "2026-07-12T10:00:00.000Z",
    lastMessageId: "message-1",
    unreadCount: 2,
    hasUnread: true,
    safeStatus: "normal",
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
      scope: "assigned",
    },
    ...overrides,
  };
}

describe("messaging-panel-helpers", () => {
  it("formats conversation activity timestamps", () => {
    expect(formatConversationLastActivityAt(null)).toBeNull();
    expect(formatConversationLastActivityAt("invalid")).toBeNull();
    expect(formatConversationLastActivityAt("2026-07-12T10:00:00.000Z")).toMatch(/\d/);
  });

  it("resolves client display names and unread counts", () => {
    expect(resolveConversationClientDisplayName("  Mert Kaya  ", "Fallback")).toBe("Mert Kaya");
    expect(resolveConversationClientDisplayName("   ", "Fallback")).toBe("Fallback");
    expect(resolveConversationRowUnreadCount(buildInboxItem({ unreadCount: -1 }))).toBe(0);
  });

  it("builds status segment labels and empty states", () => {
    const labels = { all: "All", unread: "Unread" } as const;
    expect(buildConversationStatusSegmentLabel("all", { all: 4, unread: 1 }, labels)).toBe("All (4)");
    expect(resolveMessagingEmptyStateKeys("all", "  ")).toEqual({
      titleKey: "messagingListEmpty",
      messageKey: "messagingListEmptyHint",
    });
    expect(resolveMessagingEmptyStateKeys("unread", "")).toEqual({
      titleKey: "messagingListEmptyUnreadTitle",
      messageKey: "messagingListEmptyUnreadMessage",
    });
    expect(resolveMessagingEmptyStateKeys("all", "mert")).toEqual({
      titleKey: "messagingListEmptySearchTitle",
      messageKey: "messagingListEmptySearchMessage",
    });
  });

  it("guards conversation row navigation", () => {
    expect(canOpenConversationInboxItem(buildInboxItem())).toBe(true);
    expect(
      canOpenConversationInboxItem(
        buildInboxItem({
          permissions: {
            ...buildInboxItem().permissions,
            canRead: false,
          },
        }),
      ),
    ).toBe(false);
  });
});
