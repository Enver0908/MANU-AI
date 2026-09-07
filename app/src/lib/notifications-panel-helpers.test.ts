import { describe, expect, it } from "vitest";
import type { SystemNotificationListItem } from "./phase-85-stage-4b-contracts";
import {
  applyStage4BNotificationReadAllToItems,
  buildNotificationStatusSegmentLabel,
  canActorMutateNotificationReceipts,
  canNavigateToNotificationTarget,
  mergeStage4BNotificationMutationIntoItems,
  resolveNotificationEmptyStateKeys,
  resolveNotificationReceiptStatus,
  shouldShowUnsupportedMediaReviewComplete,
} from "./notifications-panel-helpers";

function buildNotification(overrides: Partial<SystemNotificationListItem> = {}): SystemNotificationListItem {
  return {
    id: "notification-1",
    kind: "unsupported_media_review",
    priority: "review_required",
    category: "conversation_review",
    clientId: "client-1",
    conversationId: "conversation-1",
    messageId: "message-1",
    handoffId: null,
    clientFullName: "Elif Demir",
    titleKey: "notificationTitleUnsupportedMediaReview",
    summaryKey: "notificationSummaryUnsupportedMediaReview",
    occurrenceCount: 2,
    lastOccurredAt: "2026-07-12T10:00:00.000Z",
    readAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    lifecycleState: "active",
    target: {
      section: "messages",
      clientId: "client-1",
      conversationId: "conversation-1",
      messageId: "message-1",
    },
    ...overrides,
  };
}

describe("notifications-panel-helpers", () => {
  it("builds lifecycle segment labels with counts", () => {
    const label = buildNotificationStatusSegmentLabel(
      "unread",
      { active: 3, unread: 2, history: 5 },
      { active: "Aktif", unread: "Okunmamış", history: "Geçmiş" },
    );
    expect(label).toBe("Okunmamış (2)");
  });

  it("resolves empty states by segment and search", () => {
    expect(resolveNotificationEmptyStateKeys("active", "").titleKey).toBe("noNotificationsYet");
    expect(resolveNotificationEmptyStateKeys("unread", "menu").titleKey).toBe("notificationsEmptySearchTitle");
    expect(resolveNotificationEmptyStateKeys("history", "").titleKey).toBe("notificationsEmptyHistoryTitle");
  });

  it("blocks assistant receipt mutation and validates navigation", () => {
    expect(
      canActorMutateNotificationReceipts({ role: "assistant", dietitianId: "dietitian-1" }, "dietitian-1"),
    ).toBe(false);
    expect(
      canActorMutateNotificationReceipts({ role: "dietitian", dietitianId: "dietitian-1" }, "dietitian-1"),
    ).toBe(true);
    expect(canNavigateToNotificationTarget(buildNotification(), new Set(["client-1"]))).toBe(true);
    expect(canNavigateToNotificationTarget(buildNotification({ clientId: "missing" }), new Set(["client-1"]))).toBe(
      false,
    );
    expect(
      canNavigateToNotificationTarget(
        buildNotification({
          clientId: null,
          target: { section: "clients", clientId: "" },
        }),
        new Set(["client-1"]),
      ),
    ).toBe(true);
  });

  it("tracks receipt status and unsupported media review gate", () => {
    expect(resolveNotificationReceiptStatus(buildNotification())).toBe("unread");
    expect(resolveNotificationReceiptStatus(buildNotification({ readAt: "2026-07-12T10:01:00.000Z" }))).toBe("read");
    expect(
      resolveNotificationReceiptStatus(
        buildNotification({ readAt: "2026-07-12T10:01:00.000Z", acknowledgedAt: "2026-07-12T10:02:00.000Z" }),
      ),
    ).toBe("acknowledged");
    expect(
      shouldShowUnsupportedMediaReviewComplete(
        buildNotification({ readAt: "2026-07-12T10:01:00.000Z", acknowledgedAt: "2026-07-12T10:02:00.000Z" }),
      ),
    ).toBe(true);
    expect(shouldShowUnsupportedMediaReviewComplete(buildNotification({ resolvedAt: "2026-07-12T10:03:00.000Z" }))).toBe(
      false,
    );
  });

  it("merges bounded notification receipt mutations into the list slice", () => {
    const items = [buildNotification()];
    const merged = mergeStage4BNotificationMutationIntoItems(items, {
      version: "test",
      generatedAt: "2026-08-19T12:00:00.000Z",
      notificationId: "notification-1",
      readAt: "2026-08-19T12:00:00.000Z",
      acknowledgedAt: null,
      target: items[0]!.target,
      counts: { active: 1, unread: 0, history: 0 },
    });
    expect(merged[0]?.readAt).toBe("2026-08-19T12:00:00.000Z");
    expect(applyStage4BNotificationReadAllToItems(items, {
      version: "test",
      generatedAt: "2026-08-19T12:01:00.000Z",
      markedReadCount: 1,
      counts: { active: 1, unread: 0, history: 1 },
    }, "2026-08-19T12:01:00.000Z")[0]?.readAt).toBe("2026-08-19T12:01:00.000Z");
  });
});
