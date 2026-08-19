import { afterEach, describe, expect, it } from "vitest";
import {
  AI_CHAT_ROOT_PATH,
  SETTINGS_ROOT_PATH,
  buildDashboardHref,
  commitDashboardHref,
  currentDashboardHref,
  subscribeDashboardHrefChange,
  buildStage4BAlertsRequestQuery,
  buildStage4BNotificationsRequestQuery,
  buildStage4B2ConversationsRequestQuery,
  buildStage4B2ConversationDetailRequestQuery,
  formatStage4BBadgeCount,
  isAiChatUiEnabled,
  mergeDashboardUrlState,
  parseDashboardSearchParams,
  resolveAlertsBadgeCount,
  resolveDashboardSection,
  resolveLegacyCopilotSectionRedirect,
  resolveMessagingRouteSelection,
  resolveMessagingUnreadBadgeCount,
  resolveStage6CommunicationDestination,
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

  it("parses client workspace tasks and omits summary from the query string", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams("section=clients&clientId=client-mert&clientTask=forms"),
    );
    expect(parsed.clientTask).toBe("forms");
    const summary = parseDashboardSearchParams(
      new URLSearchParams("section=clients&clientId=client-mert&tab=tab_overview"),
    );
    expect(summary.clientTask).toBe("summary");
    expect(serializeDashboardSearchParams({ ...summary, clientTask: "summary" }).get("clientTask")).toBeNull();
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

  it("builds a client workspace href that keeps clientId on the clients section", () => {
    const href = buildDashboardHref(
      "/dashboard",
      mergeDashboardUrlState(parseDashboardSearchParams(new URLSearchParams("section=clients")), {
        clientId: "client-mert",
      }),
    );
    expect(href).toBe("/dashboard?section=clients&clientId=client-mert");
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

  it("keeps a client-only messages URL on the list instead of auto-opening a thread", () => {
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
      conversationId: null,
      clientId: "client-mert",
      needsCanonicalization: false,
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

  describe("AI Chat feature flag and legacy Copilot redirect", () => {
    const originalFlag = process.env.AI_CHAT_UI_ENABLED;

    afterEach(() => {
      if (originalFlag === undefined) {
        delete process.env.AI_CHAT_UI_ENABLED;
      } else {
        process.env.AI_CHAT_UI_ENABLED = originalFlag;
      }
    });

    it("defaults to disabled when the flag is unset", () => {
      delete process.env.AI_CHAT_UI_ENABLED;
      expect(isAiChatUiEnabled()).toBe(false);
    });

    it("enables only on an explicit true value", () => {
      process.env.AI_CHAT_UI_ENABLED = "true";
      expect(isAiChatUiEnabled()).toBe(true);
      process.env.AI_CHAT_UI_ENABLED = "1";
      expect(isAiChatUiEnabled()).toBe(false);
    });

    it("redirects legacy ?section=copilot to the AI Chat route only", () => {
      expect(resolveLegacyCopilotSectionRedirect("copilot")).toBe(AI_CHAT_ROOT_PATH);
      expect(resolveLegacyCopilotSectionRedirect("overview")).toBeNull();
      expect(resolveLegacyCopilotSectionRedirect("messages")).toBeNull();
    });
  });

  it("exposes the Stage 4D settings route path for real-link navigation", () => {
    expect(SETTINGS_ROOT_PATH).toBe("/dashboard/settings");
  });

  it("notifies subscribers when a same-page dashboard href is committed", () => {
    const originalWindow = globalThis.window;
    const listeners = new Map<string, Set<() => void>>();
    const location = { pathname: "/dashboard", search: "" };
    const fakeWindow = {
      location,
      history: {
        state: null,
        pushState(_state: unknown, _title: string, href: string) {
          const url = new URL(href, "http://localhost");
          location.pathname = url.pathname;
          location.search = url.search;
        },
        replaceState(_state: unknown, _title: string, href: string) {
          const url = new URL(href, "http://localhost");
          location.pathname = url.pathname;
          location.search = url.search;
        },
      },
      addEventListener(type: string, listener: () => void) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent(event: Event) {
        listeners.get(event.type)?.forEach((listener) => listener());
        return true;
      },
    };
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });

    try {
      const hrefs: string[] = [];
      const unsubscribe = subscribeDashboardHrefChange(() => hrefs.push(currentDashboardHref()));
      commitDashboardHref("/dashboard?section=messages", "push");
      expect(hrefs).toEqual(["/dashboard?section=messages"]);
      unsubscribe();
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
      }
    }
  });

  it("resolves typed communication destinations without inventing a client", () => {
    const current = parseDashboardSearchParams(new URLSearchParams("section=alerts&clientId=client-mert"));
    const conversation = resolveStage6CommunicationDestination(current, {
      section: "messages",
      clientId: "client-elif",
      conversationId: "conversation-client-elif",
      messageId: "message-1",
      source: "alert",
    });
    expect(conversation).toMatchObject({
      kind: "conversation",
      linkedClientId: "client-elif",
      requiresActiveClient: true,
      inaccessible: false,
    });
    expect(conversation.href).toContain("section=messages");
    expect(conversation.href).toContain("conversationId=conversation-client-elif");

    const workspace = resolveStage6CommunicationDestination(current, {
      section: "ai-control",
      clientId: "client-elif",
    });
    expect(workspace.kind).toBe("clientWorkspace");
    expect(workspace.urlPatch.clientTask).toBe("ai");

    const settings = resolveStage6CommunicationDestination(current, { section: "settings" });
    expect(settings).toMatchObject({ kind: "settings", requiresActiveClient: false, linkedClientId: null });
    expect(settings.href).toBe("/dashboard/settings");

    const aiChat = resolveStage6CommunicationDestination(current, { kindHint: "ai_chat" });
    expect(aiChat).toMatchObject({ kind: "aiChat", requiresActiveClient: false, linkedClientId: null });
    expect(aiChat.href).toBe("/dashboard/ai-chat");

    const fallback = resolveStage6CommunicationDestination(current, { section: "clients" });
    expect(fallback.kind).toBe("fallback");
    expect(fallback.linkedClientId).toBeNull();
    expect(fallback.inaccessible).toBe(false);
    expect(fallback.href).not.toContain("client-elif");

    const removed = resolveStage6CommunicationDestination(
      current,
      { section: "messages", clientId: "gone", conversationId: "conversation-gone" },
      { knownClientIds: new Set(["client-mert"]) },
    );
    expect(removed.inaccessible).toBe(true);
    expect(removed.linkedClientId).toBeNull();
  });
});
