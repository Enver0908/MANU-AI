"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  MessageSquareText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { DashboardMessageKey } from "@/lib/i18n";
import {
  AI_CHAT_ROOT_PATH,
  formatStage4BBadgeCount,
  SETTINGS_ROOT_PATH,
  type DashboardNavKey,
  type DashboardSection,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

export type DashboardNavItem =
  | {
      type: "section";
      key: DashboardSection;
      labelKey: DashboardMessageKey;
      icon: LucideIcon;
      desktopOnly?: boolean;
      mobileOnly?: boolean;
    }
  | {
      type: "link";
      key: "ai_chat" | "settings";
      labelKey: DashboardMessageKey;
      icon: LucideIcon;
      href: string;
    };

const AI_CHAT_NAV_ITEM: DashboardNavItem = {
  type: "link",
  key: "ai_chat",
  labelKey: "aiChat",
  icon: Sparkles,
  href: AI_CHAT_ROOT_PATH,
};

const SETTINGS_NAV_ITEM: DashboardNavItem = {
  type: "link",
  key: "settings",
  labelKey: "settings",
  icon: Settings,
  href: SETTINGS_ROOT_PATH,
};

const desktopSectionNavItems: DashboardNavItem[] = [
  { type: "section", key: "overview", labelKey: "overview", icon: Activity },
  { type: "section", key: "clients", labelKey: "clients", icon: UsersRound },
  { type: "section", key: "messages", labelKey: "conversation", icon: MessageSquareText },
  { type: "section", key: "simulator", labelKey: "simulator", icon: Bot },
  { type: "section", key: "alerts", labelKey: "alerts", icon: AlertTriangle },
  { type: "section", key: "notifications", labelKey: "notifications", icon: Bell, desktopOnly: false },
  { type: "section", key: "voice", labelKey: "voice", icon: ClipboardList },
  { type: "section", key: "forms", labelKey: "forms", icon: SlidersHorizontal },
];

const mobileSectionNavItems: DashboardNavItem[] = [
  { type: "section", key: "overview", labelKey: "overview", icon: Activity },
  { type: "section", key: "clients", labelKey: "clients", icon: UsersRound },
  { type: "section", key: "messages", labelKey: "conversation", icon: MessageSquareText },
  { type: "section", key: "alerts", labelKey: "alerts", icon: AlertTriangle },
  { type: "section", key: "simulator", labelKey: "simulator", icon: Bot },
];

// AI Chat replaces the old internal-Copilot nav entry; hidden entirely when
 // the feature flag is off (production default). The flag is resolved
 // server-side and passed down as a prop so `next start` picks up runtime
 // changes without a rebuild (no `NEXT_PUBLIC_` inlining involved).
 // Settings is always a real route link on desktop and mobile.
export function resolveDesktopDashboardNavItems(aiChatEnabled: boolean): DashboardNavItem[] {
  const withOptionalAiChat = aiChatEnabled
    ? [...desktopSectionNavItems, AI_CHAT_NAV_ITEM]
    : desktopSectionNavItems;
  return [...withOptionalAiChat, SETTINGS_NAV_ITEM];
}

export function resolveMobileDashboardNavItems(aiChatEnabled: boolean): DashboardNavItem[] {
  const withOptionalAiChat = aiChatEnabled
    ? [...mobileSectionNavItems, AI_CHAT_NAV_ITEM]
    : mobileSectionNavItems;
  return [...withOptionalAiChat, SETTINGS_NAV_ITEM];
}

function resolveNavBadgeCount(
  item: DashboardNavItem,
  badges: { alerts: number; notifications: number; messages: number },
) {
  if (item.type !== "section") return 0;
  if (item.key === "alerts") return badges.alerts;
  if (item.key === "notifications") return badges.notifications;
  if (item.key === "messages") return badges.messages;
  return 0;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {formatStage4BBadgeCount(count)}
    </span>
  );
}

const DEFAULT_NAV_BADGES = { alerts: 0, notifications: 0, messages: 0 };

export function DashboardSidebarNav({
  activeNavKey,
  uiLanguage,
  badges = DEFAULT_NAV_BADGES,
  aiChatEnabled = false,
  onNavigate,
}: {
  activeNavKey: DashboardNavKey;
  uiLanguage: SupportedLanguageCode;
  badges?: { alerts: number; notifications: number; messages: number };
  aiChatEnabled?: boolean;
  onNavigate: (section: DashboardSection) => void;
}) {
  const items = resolveDesktopDashboardNavItems(aiChatEnabled);
  return (
    <nav className="hidden gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Panel görünümleri">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeNavKey;
        const badgeCount = resolveNavBadgeCount(item, badges);
        const className = `inline-flex min-h-11 min-w-fit items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
          active ? "bg-emerald-950 text-white" : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
        }`;

        if (item.type === "link") {
          return (
            <Link key={item.key} href={item.href} className={className} aria-current={active ? "page" : undefined}>
              <Icon size={18} />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>{t(uiLanguage, item.labelKey)}</span>
              </span>
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={className}
            type="button"
          >
            <Icon size={18} />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span>{t(uiLanguage, item.labelKey)}</span>
              <NavBadge count={badgeCount} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function DashboardMobileNav({
  activeNavKey,
  uiLanguage,
  badges = DEFAULT_NAV_BADGES,
  aiChatEnabled = false,
  onNavigate,
}: {
  activeNavKey: DashboardNavKey;
  uiLanguage: SupportedLanguageCode;
  badges?: { alerts: number; notifications: number; messages: number };
  aiChatEnabled?: boolean;
  onNavigate: (section: DashboardSection) => void;
}) {
  const items = resolveMobileDashboardNavItems(aiChatEnabled);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-stone-200 bg-white pb-safe lg:hidden"
      aria-label="Mobil navigasyon"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeNavKey;
        const label = t(uiLanguage, item.labelKey);
        const badgeCount = resolveNavBadgeCount(item, badges);
        const className = `relative flex min-h-14 w-20 shrink-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition sm:flex-1 ${
          active ? "text-emerald-900" : "text-stone-500"
        }`;

        if (item.type === "link") {
          return (
            <Link key={item.key} href={item.href} aria-current={active ? "page" : undefined} aria-label={label} className={className}>
              <Icon size={20} aria-hidden="true" />
              <span className="truncate px-1">{label}</span>
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={className}
            type="button"
          >
            <span className="relative">
              <Icon size={20} aria-hidden="true" />
              {badgeCount > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                  {formatStage4BBadgeCount(badgeCount)}
                </span>
              ) : null}
            </span>
            <span className="truncate px-1">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function DashboardHeaderBell({
  unreadCount,
  onOpenNotifications,
}: {
  unreadCount: number;
  onOpenNotifications: () => void;
}) {
  return (
    <button
      onClick={onOpenNotifications}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
      type="button"
      aria-label="Bildirimler"
    >
      <Bell size={18} />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {formatStage4BBadgeCount(unreadCount)}
        </span>
      ) : null}
    </button>
  );
}
