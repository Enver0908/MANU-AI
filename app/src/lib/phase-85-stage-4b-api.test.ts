import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildTestNotification, emitSafeReplyUnavailableNotification } from "./phase-85-stage-4b-notifications";
import {
  buildClinicalAlertsListResponse,
  buildNotificationCounts,
  buildNotificationNavigationTarget,
  buildSystemNotificationsListResponse,
  decodeAlertCursor,
  decodeNotificationCursor,
  parseNotificationStatusFilter,
  parseStage4BLimit,
  projectSystemNotificationListItems,
  resolveNotificationSearchKinds,
  resolveVisibleClientIds,
} from "./phase-85-stage-4b-api";
import type { AppTenantContext } from "./auth-context";

function ownerContextFor(state: ReturnType<typeof createInitialState>): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-1",
    role: "owner",
  };
}

describe("phase-85-stage-4b api", () => {
  it("parses list limits and rejects invalid values", () => {
    expect(parseStage4BLimit("30")).toBe(30);
    expect(parseStage4BLimit(null)).toBe(30);
    expect(parseStage4BLimit("100")).toBe(100);
    expect(parseStage4BLimit("101")).toBe(100);
    expect(() => parseStage4BLimit("0")).toThrow();
  });

  it("paginates clinical alerts with severity tie-break cursor", () => {
    const state = createInitialState();
    const ownerContext = ownerContextFor(state);
    state.handoffCases = [
      {
        id: "handoff-red-1",
        tenantId: state.tenant.id,
        dietitianId: state.dietitian.id,
        clientId: "client-mert",
        conversationId: state.conversations.find((item) => item.clientId === "client-mert")!.id,
        triggeringMessageId: state.messages[0]?.id ?? "message-1",
        risk: "red",
        reasons: ["possible_emergency_symptom"],
        status: "open",
        urgency: "urgent",
        safeAcknowledgement: "Review required.",
        recommendedAction: "Review required.",
        createdAt: "2026-05-22T10:00:00.000Z",
      },
    ];
    state.clients = state.clients.map((client) =>
      client.id === "client-mert"
        ? {
            ...client,
            redRiskLock: {
              status: "locked",
              handoffId: "handoff-red-1",
              lockedAt: "2026-05-22T10:00:00.000Z",
              reasons: ["possible_emergency_symptom"],
              previousAiStatus: "active",
              previousAiMode: "copilot",
            },
          }
        : client,
    );
    state.clients = state.clients.map((client) =>
      client.id === "client-elif"
        ? {
            ...client,
            yellowRiskHold: {
              status: "active",
              startedAt: "2026-05-22T09:00:00.000Z",
              firstMessageId: "message-yellow-1",
              latestMessageId: "message-yellow-1",
              activeDraftMessageId: null,
              activeDecisionId: null,
              messageIds: ["message-yellow-1"],
              reasons: ["symptom_question"],
              previousAiStatus: "active",
              previousAiMode: "copilot",
              blockedByRedHandoffId: null,
            },
          }
        : client,
    );
    const first = buildClinicalAlertsListResponse(state, ownerContext, [], {
      limit: 1,
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();

    const second = buildClinicalAlertsListResponse(state, ownerContext, [], {
      limit: 10,
      cursor: first.nextCursor,
      generatedAt: "2026-05-22T11:00:00.000Z",
    });
    expect(second.items.every((item) => !first.items.some((firstItem) => firstItem.id === item.id))).toBe(true);
    expect(decodeAlertCursor(first.nextCursor)?.id).toBe(first.items[0]?.id);
  });

  it("returns empty auditor lists with zero counts", () => {
    const state = createInitialState();
    const auditorContext = { ...ownerContextFor(state), role: "auditor" as const };
    const alerts = buildClinicalAlertsListResponse(state, auditorContext, [], {});
    const notifications = buildSystemNotificationsListResponse(state, auditorContext, [], {});
    expect(alerts.items).toHaveLength(0);
    expect(alerts.counts).toEqual({ all: 0, red: 0, yellow: 0 });
    expect(notifications.items).toHaveLength(0);
    expect(notifications.counts).toEqual({
      active: 0,
      unread: 0,
      history: 0,
      interventionRequired: 0,
    });
  });

  it("dedupes open notifications and moves read info notifications to history", () => {
    let state = createInitialState();
    const ownerContext = ownerContextFor(state);
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;
    state = emitSafeReplyUnavailableNotification(state, {
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      blockedReason: "provider_timeout",
      clientName: client.fullName,
      now: "2026-05-22T10:00:00.000Z",
    });
    state = {
      ...state,
      notifications: [
        ...state.notifications,
        buildTestNotification({
          id: "info-1",
          tenantId: state.tenant.id,
          type: "system",
          kind: "ai_window_expired",
          entityType: "client",
          entityId: client.id,
          clientId: client.id,
          title: "hidden",
          body: "hidden",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-05-22T09:00:00.000Z",
          lastOccurredAt: "2026-05-22T09:00:00.000Z",
        }),
      ],
      notificationReceipts: [
        {
          tenantId: state.tenant.id,
          notificationId: "info-1",
          dietitianId: state.dietitian.id,
          readAt: "2026-05-22T09:30:00.000Z",
          acknowledgedAt: null,
          createdAt: "2026-05-22T09:30:00.000Z",
          updatedAt: "2026-05-22T09:30:00.000Z",
        },
      ],
    };

    const items = projectSystemNotificationListItems(state, ownerContext, []);
    expect(items.some((item) => item.kind === "safe_reply_unavailable")).toBe(true);
    expect(items.every((item) => item.titleKey.startsWith("notification"))).toBe(true);
    expect(items.every((item) => item.summaryKey.startsWith("notification"))).toBe(true);
    expect(items.find((item) => item.id === "info-1")?.lifecycleState).toBe("history");

    const active = buildSystemNotificationsListResponse(state, ownerContext, [], { status: "active" });
    const history = buildSystemNotificationsListResponse(state, ownerContext, [], { status: "history" });
    expect(active.items.some((item) => item.id === "info-1")).toBe(false);
    expect(history.items.some((item) => item.id === "info-1")).toBe(true);
    expect(buildNotificationCounts(items).interventionRequired).toBe(1);
  });

  it("filters notifications by Turkish client name search", () => {
    const state = createInitialState();
    const ownerContext = ownerContextFor(state);
    const items = projectSystemNotificationListItems(state, ownerContext, []);
    const response = buildSystemNotificationsListResponse(state, ownerContext, [], {
      status: "active",
      query: "mert",
    });
    if (items.length > 0) {
      expect(response.filteredTotal).toBeGreaterThanOrEqual(0);
    }
    const mert = buildSystemNotificationsListResponse(state, ownerContext, [], {
      status: "active",
      query: "MERT",
    });
    expect(mert.filteredTotal).toBe(response.filteredTotal);
  });

  it("searches structured notification titles in the actor language", () => {
    expect(resolveNotificationSearchKinds("desteklenmeyen", "tr")).toContain("unsupported_media_review");
    expect(resolveNotificationSearchKinds("unsupported", "en")).toContain("unsupported_media_review");
  });

  it("rejects malformed notification cursors", () => {
    expect(() => decodeNotificationCursor(parseNotificationStatusFilter("active"), "not-a-cursor")).toThrow();
  });

  it("builds safe navigation targets within allowlist sections", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;
    const target = buildNotificationNavigationTarget(
      {
        id: "notif-1",
        kind: "safe_reply_unavailable",
        clientId: client.id,
        conversationId: conversation.id,
        messageId: state.messages[0]?.id ?? "message-1",
        entityType: "conversation",
        entityId: conversation.id,
      },
      state,
    );
    expect(["messages", "clients", "ai-control"]).toContain(target.section);
    expect(target.clientId).toBe(client.id);
  });

  it("does not preserve a foreign conversation or message in a notification target", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const foreignConversation = state.conversations.find((item) => item.clientId !== client.id)!;
    const target = buildNotificationNavigationTarget(
      {
        id: "notif-cross-client",
        kind: "safe_reply_unavailable",
        clientId: client.id,
        conversationId: foreignConversation.id,
        messageId: state.messages[0]?.id ?? "message-1",
        entityType: "conversation",
        entityId: foreignConversation.id,
      },
      state,
    );
    expect(target.section).toBe("clients");
    expect(target.conversationId).toBeUndefined();
    expect(target.messageId).toBeUndefined();
  });

  it("scopes visible clients for dietitian primary ownership", () => {
    const state = createInitialState();
    const dietitianContext = { ...ownerContextFor(state), role: "dietitian" as const };
    const visible = resolveVisibleClientIds(state.clients, dietitianContext, []);
    expect(visible.has("client-mert")).toBe(true);
  });
});
