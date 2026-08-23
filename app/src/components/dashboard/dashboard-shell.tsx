"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { LogOut, Maximize2, Minimize2, ShieldCheck } from "lucide-react";
import {
  DashboardCompactBottomNav,
  DashboardHeaderBell,
  DashboardMediumRailNav,
  DashboardWideSidebarNav,
} from "@/components/dashboard/dashboard-navigation";
import { ActiveClientControl } from "@/components/dashboard/active-client-control";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";

function ShellBlocker({
  title,
  message,
  action,
  runtime,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  runtime?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!action) return;
    const focusable = rootRef.current?.querySelector<HTMLElement>("button, a[href]");
    focusable?.focus();
  }, [action, runtime]);

  return (
    <div
      ref={rootRef}
      className="flex min-h-dvh items-center justify-center bg-paper px-safe py-10 text-ink"
      role="alert"
      data-testid="shell-blocker"
      data-shell-runtime={runtime}
    >
      <div className="w-full max-w-md border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function renderRuntimeBlocker(
  runtime: string,
  lastError: string | null,
  onRetry: () => void,
  uiLanguage: SupportedLanguageCode,
) {
  const primaryButton =
    "inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-white";
  switch (runtime) {
    case "booting":
      return (
        <ShellBlocker
          title={t(uiLanguage, "shellBootingTitle")}
          message={t(uiLanguage, "shellBootingMessage")}
        />
      );
    case "offline":
      return (
        <ShellBlocker
          runtime="offline"
          title={t(uiLanguage, "shellOfflineTitle")}
          message={t(uiLanguage, "shellOfflineMessage")}
          action={
            <button type="button" className={primaryButton} data-testid="shell-retry" onClick={onRetry}>
              {t(uiLanguage, "shellRetry")}
            </button>
          }
        />
      );
    case "session_locked":
      return (
        <ShellBlocker
          title={t(uiLanguage, "shellSessionLockedTitle")}
          message={t(uiLanguage, "shellSessionLockedMessage")}
          action={
            <Link href="/login?next=/dashboard" className={primaryButton}>
              {t(uiLanguage, "shellReLogin")}
            </Link>
          }
        />
      );
    case "entitlement_blocked":
      return (
        <ShellBlocker
          title={t(uiLanguage, "shellEntitlementBlockedTitle")}
          message={t(uiLanguage, "shellEntitlementBlockedMessage")}
          action={
            <Link href="/pricing" className={primaryButton}>
              {t(uiLanguage, "shellCheckSubscription")}
            </Link>
          }
        />
      );
    case "update_required":
      return (
        <ShellBlocker
          title={t(uiLanguage, "shellUpdateRequiredTitle")}
          message={t(uiLanguage, "shellUpdateRequiredMessage")}
          action={
            <button type="button" className={primaryButton} onClick={() => window.location.reload()}>
              {t(uiLanguage, "shellReload")}
            </button>
          }
        />
      );
    case "service_unavailable":
    default:
      return (
        <ShellBlocker
          title={t(uiLanguage, "shellUnavailableTitle")}
          message={lastError ? `Durum: ${lastError}` : t(uiLanguage, "shellUnavailableMessage")}
          action={
            <button type="button" className={primaryButton} onClick={onRetry}>
              {t(uiLanguage, "shellRetry")}
            </button>
          }
        />
      );
  }
}

/**
 * Canonical authenticated dashboard chrome with compact / medium / wide layouts.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const {
    runtime,
    bootstrap,
    focusMode,
    activeDestination,
    headerSlots,
    navigateToDestination,
    setFocusMode,
    refreshBootstrap,
    showActiveClientControl,
    updateWaiting,
    updateRequired,
    applyWaitingServiceWorkerUpdate,
    dismissOptionalUpdate,
    canNavigateAway,
    requestLogout,
    dirtySnapshot,
    hideCompactNavigation,
    uiLanguage,
    lastError,
  } = useShellProviderWithLastError();

  const navigationLocked = dirtySnapshot.isSaving;
  const hardBlockRuntime =
    runtime === "booting" ||
    runtime === "offline" ||
    runtime === "session_locked" ||
    runtime === "entitlement_blocked" ||
    runtime === "service_unavailable";

  if (hardBlockRuntime) {
    return renderRuntimeBlocker(runtime, lastError, refreshBootstrap, uiLanguage);
  }

  if (!bootstrap) {
    return renderRuntimeBlocker(
      runtime === "update_required" ? "update_required" : "booting",
      lastError,
      refreshBootstrap,
      uiLanguage,
    );
  }

  const badges = {
    alerts: bootstrap.badgeCounts.alerts,
    notifications: bootstrap.badgeCounts.notifications,
    messages: bootstrap.badgeCounts.messages,
  };

  const updateBanner =
    updateRequired || updateWaiting ? (
      <div
        className="border-b border-line bg-surface-muted px-safe py-2 text-sm text-ink"
        role="status"
        data-testid={updateRequired ? "shell-update-required-banner" : "shell-update-waiting-banner"}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {updateRequired
              ? t(uiLanguage, "shellUpdateRequiredBanner")
              : t(uiLanguage, "shellUpdateWaitingBanner")}
          </p>
          <div className="flex flex-wrap gap-2">
            {updateRequired ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 text-sm font-medium text-white"
                onClick={() => window.location.reload()}
              >
                {t(uiLanguage, "shellUpdateNow")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-control border border-line px-3 text-sm"
                  onClick={dismissOptionalUpdate}
                >
                  {t(uiLanguage, "shellUpdateLater")}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 text-sm font-medium text-white disabled:opacity-50"
                  disabled={!canNavigateAway()}
                  onClick={applyWaitingServiceWorkerUpdate}
                >
                  {t(uiLanguage, "shellUpdateApply")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    ) : null;

  if (focusMode) {
    return (
      <div className="min-h-dvh bg-paper text-ink" data-testid="authenticated-shell">
        <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link" data-testid="skip-link">
          {t(uiLanguage, "shellSkipToContent")}
        </a>
        {updateBanner}
        <div className="sticky top-0 z-40 flex min-h-11 items-center justify-between gap-3 border-b border-line bg-surface px-safe py-2">
          <p className="text-sm font-medium text-ink">{t(uiLanguage, "shellFocusMode")}</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink disabled:opacity-50"
            aria-label={t(uiLanguage, "shellFocusExit")}
            data-testid="shell-exit-focus"
            disabled={navigationLocked}
            onClick={() => setFocusMode(false)}
          >
            <Minimize2 size={18} />
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper text-ink" data-testid="authenticated-shell">
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link" data-testid="skip-link">
        {t(uiLanguage, "shellSkipToContent")}
      </a>
      {updateBanner}
      <div className="flex min-h-dvh flex-col min-[768px]:flex-row">
        <aside
          className="hidden w-20 shrink-0 flex-col border-r border-line bg-surface min-[768px]:flex min-[1200px]:hidden"
          aria-label="Orta genişlik navigasyon"
          data-testid="shell-medium-aside"
        >
          <div className="flex min-h-16 items-center justify-center border-b border-line px-1">
            <span className="text-sm font-semibold text-primary" aria-label="SiriusAI">
              S
            </span>
          </div>
          <DashboardMediumRailNav
            activeNavKey={activeDestination}
            badges={badges}
            navigation={bootstrap.navigation}
            role={bootstrap.role}
            uiLanguage={uiLanguage}
            navigationLocked={navigationLocked}
            onNavigateDestination={navigateToDestination}
          />
        </aside>

        <aside
          className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface min-[1200px]:flex"
          aria-label="Ana navigasyon"
          data-testid="shell-sidebar"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SiriusAI</p>
              <h1 className="mt-1 text-xl font-semibold text-ink">Diyetisyen konsolu</h1>
              <p className="mt-1 truncate text-sm text-ink-muted">{bootstrap.displayName}</p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink-muted transition hover:bg-surface-muted disabled:opacity-50"
              title={t(uiLanguage, "shellLogout")}
              aria-label={t(uiLanguage, "shellLogout")}
              data-testid="shell-logout"
              disabled={navigationLocked}
              onClick={requestLogout}
            >
              <LogOut size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <DashboardWideSidebarNav
              activeNavKey={activeDestination}
              badges={badges}
              navigation={bootstrap.navigation}
              role={bootstrap.role}
              uiLanguage={uiLanguage}
              navigationLocked={navigationLocked}
              onNavigateDestination={navigateToDestination}
            />
          </div>

          <div className="border-t border-line px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={18} className="text-sage" />
              {t(uiLanguage, "shellLocalSafeMode")}
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {t(uiLanguage, "shellLocalSafeModeHint")}
            </p>
          </div>
        </aside>

        <main
          className={`flex min-w-0 flex-1 flex-col ${hideCompactNavigation ? "" : "pb-shell-compact-nav"}`}
        >
          <header
            className="sticky top-0 z-30 flex min-h-16 items-center border-b border-line bg-surface px-safe pt-safe min-[1200px]:min-h-14"
            data-testid="shell-header"
          >
            <div className="flex w-full flex-col gap-3 py-3 sm:px-2 xl:flex-row xl:items-center xl:justify-between min-[1200px]:py-2">
              <div className="min-w-0">
                <div className="min-[768px]:hidden">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SiriusAI</p>
                </div>
                {headerSlots.title}
                {headerSlots.description}
                {showActiveClientControl ? (
                  <div className="mt-2" data-testid="shell-active-client">
                    <ActiveClientControl disabled={navigationLocked} />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DashboardHeaderBell
                  unreadCount={badges.notifications}
                  onOpenNotifications={() => {
                    if (navigationLocked) return;
                    navigateToDestination("notifications");
                  }}
                />
                {headerSlots.actions}
                {activeDestination === "ai_chat" ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink disabled:opacity-50"
                    aria-label={t(uiLanguage, "shellFocusEnter")}
                    data-testid="shell-enter-focus"
                    disabled={navigationLocked}
                    onClick={() => setFocusMode(true)}
                  >
                    <Maximize2 size={18} />
                  </button>
                ) : null}
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>

      {hideCompactNavigation ? null : (
        <DashboardCompactBottomNav
          activeNavKey={activeDestination}
          badges={badges}
          navigation={bootstrap.navigation}
          role={bootstrap.role}
          uiLanguage={uiLanguage}
          navigationLocked={navigationLocked}
          onNavigateDestination={navigateToDestination}
        />
      )}
    </div>
  );
}

function useShellProviderWithLastError() {
  const value = useShellProvider();
  return { ...value, lastError: value.state.lastError };
}

/** @deprecated Prefer DashboardShell via AuthenticatedShellBoundary; kept for transitional imports. */
export type DashboardShellBadges = { alerts: number; notifications: number; messages: number };
