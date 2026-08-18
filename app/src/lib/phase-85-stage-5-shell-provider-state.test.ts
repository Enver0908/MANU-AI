import { describe, expect, it } from "vitest";
import {
  AI_CHAT_ROOT_PATH,
  MORE_ROOT_PATH,
  SETTINGS_ROOT_PATH,
  buildShellHref,
  resolveActiveDestination,
  resolveLegacyCopilotSectionRedirect,
  resolveShellDestination,
  sanitizeShellDestination,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  createFallbackShellBootstrap,
  createInitialShellProviderState,
  mapShellBootstrapHttpFailure,
  reduceShellProviderState,
} from "./phase-85-stage-5-shell-provider-state";

describe("stage 5 shell destination routing", () => {
  it("sanitizes unknown and legacy destinations to safe targets", () => {
    expect(sanitizeShellDestination("unknown")).toBe("home");
    expect(sanitizeShellDestination("copilot")).toBe("ai_chat");
    expect(sanitizeShellDestination("overview")).toBe("home");
    expect(sanitizeShellDestination("handoffs")).toBe("alerts");
  });

  it("resolves destinations from pathname and query", () => {
    expect(resolveShellDestination("/dashboard", new URLSearchParams())).toBe("home");
    expect(resolveShellDestination("/dashboard", new URLSearchParams("section=messages"))).toBe(
      "messages",
    );
    expect(resolveShellDestination("/dashboard", new URLSearchParams("section=copilot"))).toBe(
      "ai_chat",
    );
    expect(resolveShellDestination(AI_CHAT_ROOT_PATH)).toBe("ai_chat");
    expect(resolveShellDestination(`${AI_CHAT_ROOT_PATH}/chat-1`)).toBe("ai_chat");
    expect(resolveShellDestination(SETTINGS_ROOT_PATH)).toBe("settings");
    expect(resolveShellDestination(MORE_ROOT_PATH)).toBe("more");
  });

  it("maps active nav keys including more and overview", () => {
    expect(resolveActiveDestination("/dashboard", new URLSearchParams())).toBe("overview");
    expect(resolveActiveDestination(MORE_ROOT_PATH)).toBe("more");
    expect(resolveActiveDestination(AI_CHAT_ROOT_PATH)).toBe("ai_chat");
  });

  it("builds hrefs without carrying clinical params onto account routes", () => {
    const current = {
      section: "messages" as const,
      clientId: "00000000-0000-4000-8000-000000000001",
      conversationId: "00000000-0000-4000-8000-000000000002",
      messageId: "00000000-0000-4000-8000-000000000003",
      source: "alert" as const,
      sourceId: "alert-1",
      alertSeverity: "all" as const,
      alertQuery: "",
      notificationStatus: "active" as const,
      notificationPriority: null,
      notificationCategory: null,
      notificationQuery: "",
      conversationStatus: "unread" as const,
      conversationQuery: "mert",
    };

    expect(buildShellHref("settings", { current })).toBe(SETTINGS_ROOT_PATH);
    expect(buildShellHref("more", { current })).toBe(MORE_ROOT_PATH);
    expect(buildShellHref("ai_chat", { current, focusMode: true })).toBe(
      `${AI_CHAT_ROOT_PATH}?focus=1`,
    );

    const messagesHref = buildShellHref("messages", { current });
    expect(messagesHref).toContain("section=messages");
    expect(messagesHref).toContain("clientId=");
    expect(messagesHref).toContain("conversationStatus=unread");

    const clientsHref = buildShellHref("clients", { current, preserveFilters: false });
    expect(clientsHref).toContain("section=clients");
    expect(clientsHref).not.toContain("conversationId=");
  });

  it("keeps legacy copilot redirect compatibility without primary nav emission", () => {
    expect(resolveLegacyCopilotSectionRedirect("copilot")).toBe(AI_CHAT_ROOT_PATH);
    expect(buildShellHref("ai_chat")).not.toContain("section=copilot");
  });
});

describe("stage 5 shell provider reducer", () => {
  it("projects an explicitly enabled AI Chat flag into fallback navigation", () => {
    const disabled = createFallbackShellBootstrap();
    const enabled = createFallbackShellBootstrap({ aiChatEnabled: true });

    expect(disabled.navigation.find((item) => item.id === "ai_chat")).toMatchObject({
      enabled: false,
      disabledReason: "feature_disabled",
    });
    expect(enabled.navigation.find((item) => item.id === "ai_chat")).toEqual({
      id: "ai_chat",
      enabled: true,
    });
  });

  it("ignores stale bootstrap success and failure", () => {
    let state = createInitialShellProviderState("live");
    state = reduceShellProviderState(state, { type: "bootstrap_started", sequence: 2 });
    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 1,
      bootstrap: createFallbackShellBootstrap(),
    });
    expect(state.runtime).toBe("booting");
    expect(state.bootstrap).toBeNull();

    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 2,
      bootstrap: createFallbackShellBootstrap({ displayName: "Ada" }),
    });
    expect(state.runtime).toBe("ready");
    expect(state.bootstrap?.displayName).toBe("Ada");

    state = reduceShellProviderState(state, {
      type: "bootstrap_failed",
      sequence: 1,
      runtime: "service_unavailable",
      error: "stale",
    });
    expect(state.runtime).toBe("ready");
  });

  it("maps http failures to runtime states", () => {
    expect(mapShellBootstrapHttpFailure({ status: 401, errorCode: "session_inactive" })).toBe(
      "session_locked",
    );
    expect(mapShellBootstrapHttpFailure({ status: 403, errorCode: "entitlement_inactive" })).toBe(
      "entitlement_blocked",
    );
    expect(mapShellBootstrapHttpFailure({ status: 503, offline: true })).toBe("offline");
    expect(mapShellBootstrapHttpFailure({ status: 500 })).toBe("service_unavailable");
  });

  it("toggles focus mode without dropping ready bootstrap", () => {
    let state = createInitialShellProviderState("live");
    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 1,
      bootstrap: createFallbackShellBootstrap(),
    });
    state = reduceShellProviderState(state, { type: "set_focus_mode", focusMode: true });
    expect(state.focusMode).toBe(true);
    expect(state.runtime).toBe("ready");
  });
});
