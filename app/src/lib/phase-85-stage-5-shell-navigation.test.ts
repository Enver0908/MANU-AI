import { describe, expect, it } from "vitest";
import { SHELL_COMPACT_BOTTOM_NAV_IDS } from "./phase-85-stage-5-shell-contracts";
import {
  SHELL_MEDIUM_RAIL_PX,
  SHELL_WIDE_SIDEBAR_PX,
  SHELL_COMPACT_BOTTOM_NAV_PX,
  SHELL_COMPACT_HEADER_PX,
  SHELL_WIDE_HEADER_PX,
  resolveCompactBottomNavItems,
  resolveMediumRailNavItems,
  resolveMoreMenuSections,
  resolveWideSidebarNavItems,
} from "./phase-85-stage-5-shell-navigation";
import type { ShellNavigationItemDto } from "./phase-85-stage-5-shell-contracts";

function nav(items: Array<Partial<ShellNavigationItemDto> & { id: ShellNavigationItemDto["id"] }>): ShellNavigationItemDto[] {
  return items.map((item) => ({
    id: item.id,
    enabled: item.enabled ?? true,
    disabledReason: item.disabledReason,
    badgeCount: item.badgeCount,
  }));
}

describe("phase-85-stage-5-shell-navigation", () => {
  it("locks compact bottom nav to five fixed destinations without notifications", () => {
    expect([...SHELL_COMPACT_BOTTOM_NAV_IDS]).toEqual([
      "home",
      "clients",
      "messages",
      "alerts",
      "more",
    ]);
    const items = resolveCompactBottomNavItems({
      badges: { alerts: 2, messages: 3, notifications: 9 },
      role: "dietitian",
      navigation: nav([
        { id: "home" },
        { id: "clients" },
        { id: "messages" },
        { id: "alerts" },
        { id: "more" },
        { id: "notifications" },
      ]),
    });
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.destinationId)).toEqual([
      "home",
      "clients",
      "messages",
      "alerts",
      "more",
    ]);
    expect(items.find((item) => item.destinationId === "messages")?.badgeCount).toBe(3);
    expect(items.some((item) => item.destinationId === "notifications")).toBe(false);

    const auditorItems = resolveCompactBottomNavItems({
      role: "auditor",
      navigation: nav([
        { id: "home" },
        { id: "clients" },
        { id: "messages", enabled: false, disabledReason: "conversation_read_forbidden" },
        { id: "alerts" },
        { id: "more" },
      ]),
    });
    expect(auditorItems.map((item) => item.destinationId)).toEqual(["home", "clients", "alerts", "more"]);
  });

  it("keeps responsive shell geometry contracts", () => {
    expect(SHELL_WIDE_SIDEBAR_PX).toBe(288);
    expect(SHELL_MEDIUM_RAIL_PX).toBe(80);
    expect(SHELL_COMPACT_BOTTOM_NAV_PX).toBe(64);
    expect(SHELL_COMPACT_HEADER_PX).toBe(64);
    expect(SHELL_WIDE_HEADER_PX).toBe(56);
  });

  it("projects role-aware more sections and omits permanent rbac denials", () => {
    const dietitian = resolveMoreMenuSections({
      role: "dietitian",
      aiChatEnabled: false,
      navigation: nav([
        { id: "ai_chat", enabled: false, disabledReason: "feature_disabled" },
        { id: "simulator" },
        { id: "voice" },
        { id: "forms" },
        { id: "notifications" },
        { id: "settings" },
      ]),
    });
    expect(dietitian.map((section) => section.id)).toEqual([
      "ai_tools",
      "client_tools",
      "account",
    ]);
    const aiChat = dietitian[0]?.items.find((item) => item.id === "ai_chat");
    expect(aiChat).toMatchObject({ enabled: false, disabledReason: "feature_disabled" });

    const assistant = resolveMoreMenuSections({
      role: "assistant",
      aiChatEnabled: true,
      navigation: nav([
        { id: "ai_chat", enabled: false, disabledReason: "rbac_forbidden_dietitian_ai_chat" },
        { id: "simulator", enabled: false, disabledReason: "read_only_role" },
        { id: "voice", enabled: false, disabledReason: "read_only_role" },
        { id: "forms", enabled: false, disabledReason: "read_only_role" },
        { id: "notifications" },
        { id: "settings", enabled: false, disabledReason: "rbac_forbidden_update_own_profile" },
      ]),
    });
    expect(assistant.some((section) => section.items.some((item) => item.id === "ai_chat"))).toBe(
      false,
    );
    expect(assistant.some((section) => section.items.some((item) => item.id === "simulator"))).toBe(
      false,
    );
    expect(assistant.find((section) => section.id === "client_tools")?.items.map((i) => i.id)).toEqual([
      "notifications",
    ]);

    const owner = resolveMoreMenuSections({
      role: "owner",
      aiChatEnabled: true,
      uiLanguage: "en",
      navigation: nav([{ id: "ai_chat" }, { id: "simulator" }, { id: "voice" }, { id: "forms" }, { id: "notifications" }, { id: "settings" }]),
    });
    expect(owner.some((section) => section.id === "admin")).toBe(true);
    expect(owner.find((section) => section.id === "admin")?.items[0]).toMatchObject({
      id: "operational_foundation",
      label: "Operational foundation",
      href: "/dashboard?section=overview&inspection=operational",
    });
  });

  it("filters auditor wide sidebar to readable destinations", () => {
    const items = resolveWideSidebarNavItems({
      role: "auditor",
      badges: { alerts: 1, messages: 4, notifications: 2 },
      navigation: nav([
        { id: "home" },
        { id: "clients" },
        { id: "messages", enabled: false, disabledReason: "conversation_read_forbidden" },
        { id: "alerts" },
        { id: "notifications" },
        { id: "simulator", enabled: false, disabledReason: "read_only_role" },
        { id: "voice", enabled: false, disabledReason: "read_only_role" },
        { id: "forms", enabled: false, disabledReason: "read_only_role" },
        { id: "ai_chat", enabled: false, disabledReason: "rbac_forbidden_dietitian_ai_chat" },
        { id: "more" },
        { id: "settings", enabled: false, disabledReason: "rbac_forbidden_update_own_profile" },
      ]),
    });
    expect(items.map((item) => item.destinationId)).toEqual([
      "home",
      "clients",
      "alerts",
      "notifications",
      "more",
      "settings",
    ]);
  });

  it("keeps medium rail short labels visible and includes more", () => {
    const items = resolveMediumRailNavItems({
      role: "dietitian",
      uiLanguage: "en",
      badges: { alerts: 0, messages: 0, notifications: 0 },
      navigation: nav([
        { id: "home" },
        { id: "clients" },
        { id: "messages" },
        { id: "alerts" },
        { id: "more" },
        { id: "settings" },
        { id: "notifications" },
      ]),
    });
    expect(items.some((item) => item.destinationId === "more")).toBe(true);
    expect(items.every((item) => item.shortLabel.length > 0)).toBe(true);
    expect(items.find((item) => item.destinationId === "clients")?.label).toBe("Clients");
  });
});
