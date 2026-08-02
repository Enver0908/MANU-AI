import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  Ellipsis,
  MessageSquareText,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { AppCapability } from "./auth-context";
import { hasCapability } from "./auth-context";
import {
  AI_CHAT_ROOT_PATH,
  MORE_ROOT_PATH,
  SETTINGS_ROOT_PATH,
  buildShellHref,
  type DashboardNavKey,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  SHELL_COMPACT_BOTTOM_NAV_IDS,
  type ShellDestinationId,
  type ShellNavigationItemDto,
} from "./phase-85-stage-5-shell-contracts";
import type { TenantRole } from "./types";

export const PHASE_85_STAGE_5_SHELL_NAVIGATION_VERSION = "p85-stage-5-shell-navigation-v1";

export const SHELL_COMPACT_MAX_PX = 767;
export const SHELL_MEDIUM_MIN_PX = 768;
export const SHELL_MEDIUM_MAX_PX = 1199;
export const SHELL_WIDE_MIN_PX = 1200;
export const SHELL_WIDE_SIDEBAR_PX = 288;
export const SHELL_MEDIUM_RAIL_PX = 80;
export const SHELL_COMPACT_HEADER_PX = 64;
export const SHELL_WIDE_HEADER_PX = 56;
export const SHELL_COMPACT_BOTTOM_NAV_PX = 64;

export type ShellNavVisualItem = {
  destinationId: ShellDestinationId;
  navKey: DashboardNavKey;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  badgeCount: number;
  enabled: boolean;
  disabledReason?: string;
};

export type MoreMenuSectionId = "ai_tools" | "client_tools" | "account" | "admin";

export type MoreMenuItem = {
  id: string;
  destinationId: ShellDestinationId | "operational_foundation";
  label: string;
  href: string;
  enabled: boolean;
  disabledReason?: string;
};

export type MoreMenuSection = {
  id: MoreMenuSectionId;
  title: string;
  items: MoreMenuItem[];
};

const DESTINATION_META: Record<
  ShellDestinationId,
  { navKey: DashboardNavKey; label: string; shortLabel: string; icon: LucideIcon }
> = {
  home: { navKey: "overview", label: "Ana Sayfa", shortLabel: "Ana", icon: Activity },
  clients: { navKey: "clients", label: "Danışanlar", shortLabel: "Danışan", icon: UsersRound },
  messages: { navKey: "messages", label: "Mesajlar", shortLabel: "Mesaj", icon: MessageSquareText },
  alerts: { navKey: "alerts", label: "Uyarılar", shortLabel: "Uyarı", icon: AlertTriangle },
  notifications: {
    navKey: "notifications",
    label: "Bildirimler",
    shortLabel: "Bildirim",
    icon: Bell,
  },
  simulator: { navKey: "simulator", label: "Simülatör", shortLabel: "Sim", icon: Bot },
  voice: { navKey: "voice", label: "Ses", shortLabel: "Ses", icon: ClipboardList },
  forms: { navKey: "forms", label: "Formlar", shortLabel: "Form", icon: SlidersHorizontal },
  ai_chat: { navKey: "ai_chat", label: "AI Chat", shortLabel: "AI", icon: Sparkles },
  settings: { navKey: "settings", label: "Ayarlar", shortLabel: "Ayar", icon: Settings },
  more: { navKey: "more", label: "Diğer", shortLabel: "Diğer", icon: Ellipsis },
};

const WIDE_SIDEBAR_ORDER: ShellDestinationId[] = [
  "home",
  "clients",
  "messages",
  "alerts",
  "notifications",
  "simulator",
  "voice",
  "forms",
  "ai_chat",
  "more",
  "settings",
];

function hrefForDestination(destinationId: ShellDestinationId) {
  if (destinationId === "more") return MORE_ROOT_PATH;
  if (destinationId === "settings") return SETTINGS_ROOT_PATH;
  if (destinationId === "ai_chat") return AI_CHAT_ROOT_PATH;
  return buildShellHref(destinationId);
}

function navigationEnabledMap(navigation: readonly ShellNavigationItemDto[] | null | undefined) {
  const map = new Map<ShellDestinationId, ShellNavigationItemDto>();
  for (const item of navigation ?? []) {
    map.set(item.id, item);
  }
  return map;
}

function toVisualItem(
  destinationId: ShellDestinationId,
  navigation: ReadonlyMap<ShellDestinationId, ShellNavigationItemDto>,
  badges: { alerts: number; messages: number; notifications: number },
): ShellNavVisualItem {
  const meta = DESTINATION_META[destinationId];
  const projected = navigation.get(destinationId);
  const enabled = projected?.enabled !== false;
  let badgeCount = 0;
  if (destinationId === "alerts") badgeCount = badges.alerts;
  if (destinationId === "messages") badgeCount = badges.messages;
  if (destinationId === "notifications") badgeCount = badges.notifications;

  return {
    destinationId,
    navKey: meta.navKey,
    label: meta.label,
    shortLabel: meta.shortLabel,
    href: hrefForDestination(destinationId),
    icon: meta.icon,
    badgeCount: enabled ? Math.max(0, badgeCount) : 0,
    enabled,
    disabledReason: projected?.disabledReason,
  };
}

/**
 * Compact bottom nav is fixed to five destinations and never includes notifications.
 */
export function resolveCompactBottomNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  return SHELL_COMPACT_BOTTOM_NAV_IDS.map((id) => toVisualItem(id, navigation, badges));
}

export function resolveMediumRailNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
  role: TenantRole;
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  const order: ShellDestinationId[] = [
    "home",
    "clients",
    "messages",
    "alerts",
    "more",
    "settings",
  ];
  if (input.role === "owner" || input.role === "admin" || input.role === "dietitian") {
    order.splice(5, 0, "notifications");
  }
  return order
    .map((id) => toVisualItem(id, navigation, badges))
    .filter((item) => item.enabled || item.destinationId === "more" || item.destinationId === "settings");
}

export function resolveWideSidebarNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
  role: TenantRole;
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  return WIDE_SIDEBAR_ORDER.map((id) => toVisualItem(id, navigation, badges)).filter((item) => {
    if (item.destinationId === "more" || item.destinationId === "settings") return true;
    if (input.role === "assistant" || input.role === "auditor") {
      return item.enabled && hasCapability(input.role, "read_app_state");
    }
    return item.enabled;
  });
}

function pushMoreItem(
  items: MoreMenuItem[],
  item: MoreMenuItem,
  options: { omitIfPermanentlyDenied: boolean },
) {
  if (options.omitIfPermanentlyDenied && !item.enabled && item.disabledReason?.startsWith("rbac_")) {
    return;
  }
  if (options.omitIfPermanentlyDenied && !item.enabled && item.disabledReason === "read_only_role") {
    return;
  }
  if (options.omitIfPermanentlyDenied && !item.enabled && item.disabledReason === "conversation_read_forbidden") {
    return;
  }
  items.push(item);
}

/**
 * More page IA: four fixed sections with capability/feature-flag projection.
 */
export function resolveMoreMenuSections(input: {
  role: TenantRole;
  navigation?: readonly ShellNavigationItemDto[] | null;
  aiChatEnabled: boolean;
  capabilities?: readonly AppCapability[];
}): MoreMenuSection[] {
  const navigation = navigationEnabledMap(input.navigation);
  const canReadOps =
    hasCapability(input.role, "read_operational_foundation") ||
    (input.capabilities?.includes("read_operational_foundation") ?? false);

  const aiItems: MoreMenuItem[] = [];
  const aiChat = navigation.get("ai_chat");
  pushMoreItem(
    aiItems,
    {
      id: "ai_chat",
      destinationId: "ai_chat",
      label: "AI Chat",
      href: AI_CHAT_ROOT_PATH,
      enabled: Boolean(input.aiChatEnabled && aiChat?.enabled !== false),
      disabledReason: !input.aiChatEnabled
        ? "feature_disabled"
        : aiChat?.disabledReason,
    },
    { omitIfPermanentlyDenied: true },
  );
  for (const id of ["simulator", "voice"] as const) {
    const projected = navigation.get(id);
    pushMoreItem(
      aiItems,
      {
        id,
        destinationId: id,
        label: DESTINATION_META[id].label,
        href: hrefForDestination(id),
        enabled: projected?.enabled !== false,
        disabledReason: projected?.disabledReason,
      },
      { omitIfPermanentlyDenied: true },
    );
  }

  const clientItems: MoreMenuItem[] = [];
  for (const id of ["forms", "notifications"] as const) {
    const projected = navigation.get(id);
    pushMoreItem(
      clientItems,
      {
        id,
        destinationId: id,
        label: DESTINATION_META[id].label,
        href: hrefForDestination(id),
        enabled: projected?.enabled !== false,
        disabledReason: projected?.disabledReason,
      },
      { omitIfPermanentlyDenied: true },
    );
  }

  const accountItems: MoreMenuItem[] = [
    {
      id: "settings",
      destinationId: "settings",
      label: "Ayarlar",
      href: SETTINGS_ROOT_PATH,
      enabled: navigation.get("settings")?.enabled !== false,
      disabledReason: navigation.get("settings")?.disabledReason,
    },
  ];

  const sections: MoreMenuSection[] = [
    { id: "ai_tools", title: "AI ve iş araçları", items: aiItems },
    { id: "client_tools", title: "Danışan araçları", items: clientItems },
    { id: "account", title: "Hesap ve uygulama", items: accountItems },
  ];

  if ((input.role === "owner" || input.role === "admin") && canReadOps) {
    sections.push({
      id: "admin",
      title: "Owner / admin yönetimi",
      items: [
        {
          id: "operational_foundation",
          destinationId: "operational_foundation",
          label: "Operasyon temeli",
          href: buildShellHref("home"),
          enabled: true,
        },
      ],
    });
  }

  return sections.filter((section) => section.items.length > 0);
}

export function shellDestinationIcon(destinationId: ShellDestinationId): LucideIcon {
  return DESTINATION_META[destinationId].icon;
}

export const SHELL_ADMIN_SECTION_ICON = Shield;
