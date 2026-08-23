"use client";

import {
  formatStage4BBadgeCount,
  type DashboardNavKey,
  type DashboardSection,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { ShellNavigationItemDto } from "@/lib/phase-85-stage-5-shell-contracts";
import {
  resolveCompactBottomNavItems,
  resolveMediumRailNavItems,
  resolveWideSidebarNavItems,
  type ShellNavVisualItem,
} from "@/lib/phase-85-stage-5-shell-navigation";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { TenantRole } from "@/lib/types";
import { Bell } from "lucide-react";

export type ShellNavBadges = { alerts: number; notifications: number; messages: number };

const DEFAULT_NAV_BADGES: ShellNavBadges = { alerts: 0, notifications: 0, messages: 0 };

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-warm px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {formatStage4BBadgeCount(count)}
    </span>
  );
}

function navClass(active: boolean, enabled: boolean, layout: "wide" | "rail" | "compact") {
  if (layout === "compact") {
    return `relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight transition ${
      active ? "text-primary" : "text-ink-muted"
    } ${enabled ? "" : "opacity-50"}`;
  }
  if (layout === "rail") {
    return `inline-flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-control px-1 py-2 text-[10px] font-medium leading-tight transition ${
      active ? "bg-primary text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
    } ${enabled ? "" : "pointer-events-none opacity-50"}`;
  }
  return `inline-flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition ${
    active ? "bg-primary text-white" : "text-ink hover:bg-surface-muted"
  } ${enabled ? "" : "pointer-events-none opacity-50"}`;
}

function ShellNavLink({
  item,
  active,
  layout,
  navigationLocked = false,
  onNavigateDestination,
}: {
  item: ShellNavVisualItem;
  active: boolean;
  layout: "wide" | "rail" | "compact";
  navigationLocked?: boolean;
  onNavigateDestination: (destinationId: ShellNavVisualItem["destinationId"]) => void;
}) {
  const enabled = item.enabled && !navigationLocked;
  const Icon = item.icon;
  const className = navClass(active, enabled, layout);
  const content =
    layout === "wide" ? (
      <>
        <Icon size={18} aria-hidden="true" />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="command-label">{item.label}</span>
          <NavBadge count={item.badgeCount} />
        </span>
      </>
    ) : layout === "rail" ? (
      <>
        <span className="relative">
          <Icon size={20} aria-hidden="true" />
          {item.badgeCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-warm px-1 text-[9px] font-bold text-white">
              {formatStage4BBadgeCount(item.badgeCount)}
            </span>
          ) : null}
        </span>
        <span className="command-label max-w-full px-0.5" title={item.label}>
          {item.shortLabel}
        </span>
      </>
    ) : (
      <>
        <span className="relative">
          <Icon size={20} aria-hidden="true" />
          {item.badgeCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-warm px-1 text-[9px] font-bold text-white">
              {formatStage4BBadgeCount(item.badgeCount)}
            </span>
          ) : null}
        </span>
        <span className="command-label max-w-full text-center leading-tight">{item.label}</span>
      </>
    );

  if (!enabled) {
    return (
      <span
        className={className}
        aria-disabled="true"
        title={navigationLocked ? "Kayıt sürüyor" : item.disabledReason}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={layout === "rail" ? item.label : undefined}
      onClick={() => onNavigateDestination(item.destinationId)}
    >
      {content}
    </button>
  );
}

export function DashboardWideSidebarNav({
  activeNavKey,
  badges = DEFAULT_NAV_BADGES,
  navigation,
  role,
  uiLanguage,
  navigationLocked = false,
  onNavigateDestination,
}: {
  activeNavKey: DashboardNavKey;
  badges?: ShellNavBadges;
  navigation?: readonly ShellNavigationItemDto[] | null;
  role: TenantRole;
  uiLanguage?: SupportedLanguageCode;
  navigationLocked?: boolean;
  onNavigateDestination: (destinationId: ShellNavVisualItem["destinationId"]) => void;
}) {
  const items = resolveWideSidebarNavItems({ navigation, badges, role, uiLanguage });
  return (
    <nav
      className="space-y-1 overflow-y-auto px-3 pb-3"
      aria-label="Ana navigasyon"
      data-testid="shell-wide-nav"
    >
      {items.map((item) => (
        <ShellNavLink
          key={item.destinationId}
          item={item}
          active={item.navKey === activeNavKey}
          layout="wide"
          navigationLocked={navigationLocked}
          onNavigateDestination={onNavigateDestination}
        />
      ))}
    </nav>
  );
}

export function DashboardMediumRailNav({
  activeNavKey,
  badges = DEFAULT_NAV_BADGES,
  navigation,
  role,
  uiLanguage,
  navigationLocked = false,
  onNavigateDestination,
}: {
  activeNavKey: DashboardNavKey;
  badges?: ShellNavBadges;
  navigation?: readonly ShellNavigationItemDto[] | null;
  role: TenantRole;
  uiLanguage?: SupportedLanguageCode;
  navigationLocked?: boolean;
  onNavigateDestination: (destinationId: ShellNavVisualItem["destinationId"]) => void;
}) {
  const items = resolveMediumRailNavItems({ navigation, badges, role, uiLanguage });
  return (
    <nav
      className="flex h-full flex-col gap-1 overflow-y-auto px-1 py-2"
      aria-label="Navigasyon rayı"
      data-testid="shell-medium-rail"
    >
      {items.map((item) => (
        <ShellNavLink
          key={item.destinationId}
          item={item}
          active={item.navKey === activeNavKey}
          layout="rail"
          navigationLocked={navigationLocked}
          onNavigateDestination={onNavigateDestination}
        />
      ))}
    </nav>
  );
}

export function DashboardCompactBottomNav({
  activeNavKey,
  badges = DEFAULT_NAV_BADGES,
  navigation,
  role,
  uiLanguage,
  navigationLocked = false,
  onNavigateDestination,
}: {
  activeNavKey: DashboardNavKey;
  badges?: ShellNavBadges;
  navigation?: readonly ShellNavigationItemDto[] | null;
  role: TenantRole;
  uiLanguage?: SupportedLanguageCode;
  navigationLocked?: boolean;
  onNavigateDestination: (destinationId: ShellNavVisualItem["destinationId"]) => void;
}) {
  const items = resolveCompactBottomNavItems({ navigation, badges, role, uiLanguage });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-surface pb-safe min-[768px]:hidden"
      aria-label="Mobil alt navigasyon"
      data-testid="shell-compact-bottom-nav"
    >
      {items.map((item) => (
        <ShellNavLink
          key={item.destinationId}
          item={item}
          active={item.navKey === activeNavKey}
          layout="compact"
          navigationLocked={navigationLocked}
          onNavigateDestination={onNavigateDestination}
        />
      ))}
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
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink transition hover:bg-surface-muted"
      type="button"
      aria-label="Bildirimler"
      data-testid="shell-header-bell"
    >
      <Bell size={18} />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warm px-1 text-[10px] font-bold text-white">
          {formatStage4BBadgeCount(unreadCount)}
        </span>
      ) : null}
    </button>
  );
}

/** @deprecated Prefer destination-based shell nav helpers. */
export function resolveDesktopDashboardNavItems(_aiChatEnabled: boolean) {
  void _aiChatEnabled;
  return [];
}

/** @deprecated Prefer resolveCompactBottomNavItems. */
export function resolveMobileDashboardNavItems(_aiChatEnabled: boolean) {
  void _aiChatEnabled;
  return [];
}

/** Compatibility export for older section-based callers. */
export type DashboardNavItem = never;
export type { DashboardSection };
