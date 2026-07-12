"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  Database,
  MessageSquareText,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import type { DashboardMessageKey } from "@/lib/i18n";
import { formatStage4BBadgeCount, type DashboardSection } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

export type DashboardNavItem = {
  key: DashboardSection;
  labelKey: DashboardMessageKey;
  icon: LucideIcon;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
};

export const desktopDashboardNavItems: DashboardNavItem[] = [
  { key: "overview", labelKey: "overview", icon: Activity },
  { key: "clients", labelKey: "clients", icon: UsersRound },
  { key: "messages", labelKey: "conversation", icon: MessageSquareText },
  { key: "simulator", labelKey: "simulator", icon: Bot },
  { key: "alerts", labelKey: "alerts", icon: AlertTriangle },
  { key: "notifications", labelKey: "notifications", icon: Bell, desktopOnly: false },
  { key: "copilot", labelKey: "copilot", icon: Database },
  { key: "voice", labelKey: "voice", icon: ClipboardList },
  { key: "forms", labelKey: "forms", icon: SlidersHorizontal },
];

export const mobileDashboardNavItems: DashboardNavItem[] = [
  { key: "overview", labelKey: "overview", icon: Activity },
  { key: "clients", labelKey: "clients", icon: UsersRound },
  { key: "messages", labelKey: "conversation", icon: MessageSquareText },
  { key: "alerts", labelKey: "alerts", icon: AlertTriangle },
  { key: "simulator", labelKey: "simulator", icon: Bot },
];

function resolveNavBadgeCount(
  item: DashboardNavItem,
  badges: { alerts: number; notifications: number },
) {
  if (item.key === "alerts") return badges.alerts;
  if (item.key === "notifications") return badges.notifications;
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

export function DashboardSidebarNav({
  activeSection,
  uiLanguage,
  badges,
  onNavigate,
}: {
  activeSection: DashboardSection;
  uiLanguage: SupportedLanguageCode;
  badges: { alerts: number; notifications: number };
  onNavigate: (section: DashboardSection) => void;
}) {
  return (
    <nav className="hidden gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Panel görünümleri">
      {desktopDashboardNavItems.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeSection;
        const badgeCount = resolveNavBadgeCount(item, badges);
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`inline-flex min-h-11 min-w-fit items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
              active ? "bg-emerald-950 text-white" : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
            }`}
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
  activeSection,
  uiLanguage,
  badges,
  onNavigate,
}: {
  activeSection: DashboardSection;
  uiLanguage: SupportedLanguageCode;
  badges: { alerts: number; notifications: number };
  onNavigate: (section: DashboardSection) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-stone-200 bg-white pb-safe lg:hidden"
      aria-label="Mobil navigasyon"
    >
      {mobileDashboardNavItems.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeSection;
        const label = t(uiLanguage, item.labelKey);
        const badgeCount = resolveNavBadgeCount(item, badges);
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={`relative flex min-h-14 w-20 shrink-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition sm:flex-1 ${
              active ? "text-emerald-900" : "text-stone-500"
            }`}
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
