import { describe, expect, it } from "vitest";
import {
  buildDashboardHref,
  buildStage4BAlertsRequestQuery,
  buildStage4BNotificationsRequestQuery,
  buildStage4B2ConversationsRequestQuery,
  buildStage4B2ConversationDetailRequestQuery,
  formatStage4BBadgeCount,
  mergeDashboardUrlState,
  parseDashboardSearchParams,
  resolveAlertsBadgeCount,
  resolveDashboardSection,
  resolveMessagingRouteSelection,
  resolveMessagingUnreadBadgeCount,
  serializeDashboardSearchParams,
} from "./phase-85-stage-4b-dashboard-routing";

describe("phase-85-stage-4b dashboard routing", () => {
  it("parses allowlisted sections and legacy aliases", () => {
    expect(resolveDashboardSection("alerts")).toBe("alerts");
    expect(resolveDashboardSection("conversation")).toBe("messages");
    expect(resolveDashboardSection("handoffs")).toBe("alerts");
    expect(resolveDashboardSection("unknown")).toBe("overview");
  });

  it("round-trips section and filter params", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams(
        "section=notifications&notificationStatus=unread&notificationPriority=review_required&notificationCategory=records&notificationQuery=menu",
      ),
    );
    expect(parsed.section).toBe("notifications");
    expect(parsed.notificationStatus).toBe("unread");
    expect(parsed.notificationPriority).toBe("review_required");
    expect(parsed.notificationCategory).toBe("records");
    expect(parsed.notificationQuery).toBe("menu");

    const serialized = serializeDashboardSearchParams(parsed);
    expect(serialized.get("section")).toBe("notifications");
    expect(serialized.get("notificationStatus")).toBe("unread");
    expect(serialized.get("notificationPriority")).toBe("review_required");
    expect(serialized.get("notificationCategory")).toBe("records");
    expect(serialized.get("notificationQuery")).toBe("menu");
  });

  it("preserves message deep-link params", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams(
        "section=messages&clientId=client-mert&conversationId=conversation-client-mert&source=alert&sourceId=alert-1&messageId=message-1",
      ),
    );
    expect(parsed).toMatchObject({
      section: "messages",
      clientId: "client-mert",
      conversationId: "conversation-client-mert",
      source: "alert",
      sourceId: "alert-1",
      messageId: "message-1",
    });
    const href = buildDashboardHref("/dashboard", parsed);
    expect(href).toContain("section=messages");
    expect(href).toContain("clientId=client-mert");
    expect(href).toContain("source=alert");
  });

  it("parses notification message deep-link source", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams(
        "section=messages&clientId=client-mert&conversationId=conversation-client-mert&source=notification&sourceId=notification-1&messageId=message-1",
      ),
    );
    expect(parsed.source).toBe("notification");
    expect(parsed.sourceId).toBe("notification-1");
  });

  it("merges partial navigation patches without dropping filters", () => {
    const current = parseDashboardSearchParams(new URLSearchParams("section=alerts&alertSeverity=red&alertQuery=alerji"));
    const next = mergeDashboardUrlState(current, { section: "messages", clientId: "client-elif" });
    expect(next.section).toBe("messages");
    expect(next.clientId).toBe("client-elif");
    expect(next.alertSeverity).toBe("red");
    expect(next.alertQuery).toBe("alerji");
  });

  it("maps dashboard filters to bounded API query params", () => {
    const alerts = buildStage4BAlertsRequestQuery({
      alertSeverity: "yellow",
      alertQuery: "risk",
    });
    expect(alerts.get("severity")).toBe("yellow");
    expect(alerts.get("query")).toBe("risk");
    expect(alerts.get("limit")).toBe("30");

    const pagedAlerts = buildStage4BAlertsRequestQuery(
      { alertSeverity: "all", alertQuery: "" },
      { cursor: "cursor-2", limit: 30 },
    );
    expect(pagedAlerts.get("cursor")).toBe("cursor-2");

    const notifications = buildStage4BNotificationsRequestQuery({
      notificationStatus: "unread",
      notificationPriority: "intervention_required",
      notificationCategory: "ai_control",
      notificationQuery: "draft",
    });
    expect(notifications.get("status")).toBe("unread");
    expect(notifications.get("priority")).toBe("intervention_required");
    expect(notifications.get("category")).toBe("ai_control");
    expect(notifications.get("query")).toBe("draft");
    expect(notifications.get("limit")).toBe("30");

    const pagedNotifications = buildStage4BNotificationsRequestQuery(
      {
        notificationStatus: "active",
        notificationPriority: null,
        notificationCategory: null,
        notificationQuery: "",
      },
      { cursor: "cursor-3", limit: 30 },
    );
    expect(pagedNotifications.get("cursor")).toBe("cursor-3");
  });

  it("formats badge counts for zero, normal, and capped values", () => {
    expect(formatStage4BBadgeCount(0)).toBe("0");
    expect(formatStage4BBadgeCount(12)).toBe("12");
    expect(formatStage4BBadgeCount(100)).toBe("99+");
    expect(resolveAlertsBadgeCount({ red: 1, yellow: 2 })).toBe(3);
    expect(resolveMessagingUnreadBadgeCount([{ unreadCount: 2 }, { unreadCount: 4 }])).toBe(6);
  });

  it("round-trips conversation list filters in the URL", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams("section=messages&conversationStatus=unread&conversationQuery=elif"),
    );
    expect(parsed.conversationStatus).toBe("unread");
    expect(parsed.conversationQuery).toBe("elif");
    const query = buildStage4B2ConversationsRequestQuery(parsed);
    expect(query.get("status")).toBe("unread");
    expect(query.get("query")).toBe("elif");
  });

  it("canonicalizes legacy clientId routes to conversationId", () => {
    const conversations = [
      { id: "conversation-client-mert", clientId: "client-mert" },
      { id: "conversation-client-elif", clientId: "client-elif" },
    ];
    const active = new Set(["client-mert"]);
    const fromClient = resolveMessagingRouteSelection(
      { conversationId: null, clientId: "client-mert", messageId: null },
      conversations,
      active,
    );
    expect(fromClient).toMatchObject({
      conversationId: "conversation-client-mert",
      canonicalConversationId: "conversation-client-mert",
      needsCanonicalization: true,
    });

    const fromConversation = resolveMessagingRouteSelection(
      { conversationId: "conversation-client-mert", clientId: null, messageId: "message-1" },
      conversations,
      active,
    );
    expect(fromConversation).toMatchObject({
      conversationId: "conversation-client-mert",
      clientId: "client-mert",
      needsCanonicalization: true,
    });
  });

  it("preserves an explicit conversation deep-link until the bounded detail API resolves it", () => {
    const selection = resolveMessagingRouteSelection(
      { conversationId: "conversation-from-old-link", clientId: "client-mert", messageId: "message-old" },
      [],
      new Set(["client-mert"]),
    );
    expect(selection).toMatchObject({
      conversationId: "conversation-from-old-link",
      clientId: "client-mert",
      messageId: "message-old",
      needsCanonicalization: false,
    });
  });

  it("builds bounded detail request queries with anchor support", () => {
    const query = buildStage4B2ConversationDetailRequestQuery({
      anchorMessageId: "message-anchor",
      limit: 50,
    });
    expect(query.get("anchorMessageId")).toBe("message-anchor");
    expect(query.get("limit")).toBe("50");
  });
});
