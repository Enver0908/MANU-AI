"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Maximize2, Minimize2, ShieldCheck } from "lucide-react";
import {
  DashboardCompactBottomNav,
  DashboardHeaderBell,
  DashboardMediumRailNav,
  DashboardWideSidebarNav,
} from "@/components/dashboard/dashboard-navigation";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import { AI_CHAT_ROOT_PATH } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { formatShellBadgeDisplayCount } from "@/lib/phase-85-stage-5-shell-contracts";

function ShellBlocker({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-paper px-safe py-10 text-ink"
      role="alert"
      data-testid="shell-blocker"
    >
      <div className="w-full max-w-md border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function renderRuntimeBlocker(runtime: string, lastError: string | null, onRetry: () => void) {
  const primaryButton =
    "inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-white";
  switch (runtime) {
    case "booting":
      return (
        <ShellBlocker
          title="Kabuk yükleniyor"
          message="Oturum ve kabuk durumu doğrulanıyor. Klinik içerik henüz açılmadı."
        />
      );
    case "offline":
      return (
        <ShellBlocker
          title="İnternet bağlantısı gerekli"
          message="Korumalı içerik çevrimdışıyken açılamaz. Bağlantı gelince yeniden deneyin."
          action={
            <button type="button" className={primaryButton} onClick={onRetry}>
              Yeniden dene
            </button>
          }
        />
      );
    case "session_locked":
      return (
        <ShellBlocker
          title="Oturum kilitlendi"
          message="Hareketsizlik nedeniyle oturum kilitlendi. Devam etmek için yeniden giriş yapın."
          action={
            <Link href="/login?next=/dashboard" className={primaryButton}>
              Yeniden giriş
            </Link>
          }
        />
      );
    case "entitlement_blocked":
      return (
        <ShellBlocker
          title="Erişim engellendi"
          message="Aktif abonelik veya yetki olmadan kabuk açılamaz."
          action={
            <Link href="/pricing" className={primaryButton}>
              Aboneliği kontrol et
            </Link>
          }
        />
      );
    case "update_required":
      return (
        <ShellBlocker
          title="Güncelleme gerekli"
          message="Bu sürüm artık desteklenmiyor. Uygulamayı yenileyip tekrar deneyin."
          action={
            <button type="button" className={primaryButton} onClick={() => window.location.reload()}>
              Yenile
            </button>
          }
        />
      );
    case "service_unavailable":
    default:
      return (
        <ShellBlocker
          title="Kabuk kullanılamıyor"
          message={lastError ? `Durum: ${lastError}` : "Kabuk bootstrap başarısız oldu."}
          action={
            <button type="button" className={primaryButton} onClick={onRetry}>
              Yeniden dene
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
    lastError,
  } = useShellProviderWithLastError();

  if (runtime !== "ready" || !bootstrap) {
    return renderRuntimeBlocker(runtime, lastError, refreshBootstrap);
  }

  const badges = {
    alerts: bootstrap.badgeCounts.alerts,
    notifications: bootstrap.badgeCounts.notifications,
    messages: bootstrap.badgeCounts.messages,
  };

  if (focusMode) {
    return (
      <div className="min-h-dvh bg-paper text-ink" data-testid="authenticated-shell">
        <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
          İçeriğe atla
        </a>
        <div className="sticky top-0 z-40 flex min-h-11 items-center justify-between gap-3 border-b border-line bg-surface px-safe py-2">
          <p className="text-sm font-medium text-ink">Odak modu</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink"
            aria-label="Odak modundan çık"
            data-testid="shell-exit-focus"
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
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
        İçeriğe atla
      </a>
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
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink-muted transition hover:bg-surface-muted"
                title="Oturumu kapat"
                aria-label="Oturumu kapat"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <DashboardWideSidebarNav
              activeNavKey={activeDestination}
              badges={badges}
              navigation={bootstrap.navigation}
              role={bootstrap.role}
              onNavigateDestination={navigateToDestination}
            />
          </div>

          <div className="border-t border-line px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={18} className="text-sage" />
              Yerel güvenli mod
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Yalnızca simülatör. WhatsApp, Telegram veya canlı sağlık verisi sağlayıcısı bağlı değil.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col pb-shell-compact-nav">
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
                {bootstrap.activeClient ? (
                  <p className="mt-1 text-sm text-ink-muted" data-testid="shell-active-client">
                    {bootstrap.activeClient.fullName} · {bootstrap.activeClient.referenceShort}
                    {bootstrap.badgeCounts.alerts > 0
                      ? ` · uyarı ${formatShellBadgeDisplayCount(bootstrap.badgeCounts.alerts)}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DashboardHeaderBell
                  unreadCount={badges.notifications}
                  onOpenNotifications={() => navigateToDestination("notifications")}
                />
                {headerSlots.actions}
                {activeDestination === "ai_chat" ? (
                  <Link
                    href={`${AI_CHAT_ROOT_PATH}?focus=1`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface text-ink"
                    aria-label="Odak moduna geç"
                    data-testid="shell-enter-focus"
                  >
                    <Maximize2 size={18} />
                  </Link>
                ) : null}
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>

      <DashboardCompactBottomNav
        activeNavKey={activeDestination}
        badges={badges}
        navigation={bootstrap.navigation}
        onNavigateDestination={navigateToDestination}
      />
    </div>
  );
}

function useShellProviderWithLastError() {
  const value = useShellProvider();
  return { ...value, lastError: value.state.lastError };
}

/** @deprecated Prefer DashboardShell via AuthenticatedShellBoundary; kept for transitional imports. */
export type DashboardShellBadges = { alerts: number; notifications: number; messages: number };
