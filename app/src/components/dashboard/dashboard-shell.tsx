"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Maximize2, Minimize2, ShieldCheck } from "lucide-react";
import { DashboardMobileNav, DashboardSidebarNav } from "@/components/dashboard/dashboard-navigation";
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
      className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-safe py-10 text-stone-950"
      role="alert"
      data-testid="shell-blocker"
    >
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function renderRuntimeBlocker(runtime: string, lastError: string | null, onRetry: () => void) {
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
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-medium text-white"
              onClick={onRetry}
            >
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
            <Link
              href="/login?next=/dashboard"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-medium text-white"
            >
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
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-medium text-white"
            >
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
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
            >
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
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-medium text-white"
              onClick={onRetry}
            >
              Yeniden dene
            </button>
          }
        />
      );
  }
}

/**
 * Canonical authenticated dashboard chrome. Owns skip-link, sidebar, mobile nav,
 * header slots, focus-mode chrome, and runtime blockers. Route pages supply
 * main content and optional header slots only.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const {
    runtime,
    bootstrap,
    focusMode,
    activeDestination,
    uiLanguage,
    headerSlots,
    navigateToSection,
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
      <div className="min-h-screen bg-[#f7f5ef] text-stone-950" data-testid="authenticated-shell">
        <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
          İçeriğe atla
        </a>
        <div className="sticky top-0 z-40 flex min-h-11 items-center justify-between gap-3 border-b border-stone-200 bg-white px-safe py-2">
          <p className="text-sm font-medium text-stone-700">Odak modu</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
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
    <div className="min-h-screen bg-[#f7f5ef] text-stone-950" data-testid="authenticated-shell">
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
        İçeriğe atla
      </a>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside
          className="border-b border-stone-200 bg-white px-safe lg:w-72 lg:border-b-0 lg:border-r lg:px-0"
          aria-label="Ana navigasyon"
          data-testid="shell-sidebar"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">SiriusAI</p>
              <h1 className="mt-1 text-xl font-semibold">Diyetisyen konsolu</h1>
              <p className="mt-1 text-sm text-stone-500">{bootstrap.displayName}</p>
            </div>
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100"
                title="Oturumu kapat"
                aria-label="Oturumu kapat"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>

          <DashboardSidebarNav
            activeNavKey={activeDestination}
            uiLanguage={uiLanguage}
            badges={badges}
            aiChatEnabled={bootstrap.navigation.some((item) => item.id === "ai_chat" && item.enabled)}
            onNavigate={navigateToSection}
          />

          <div className="hidden px-5 py-5 lg:block">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} className="text-emerald-700" />
                Yerel güvenli mod
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Yalnızca simülatör. WhatsApp, Telegram veya canlı sağlık verisi sağlayıcısı bağlı değil.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {(headerSlots.title || headerSlots.actions || bootstrap.activeClient) && (
            <header
              className="border-b border-stone-200 bg-white px-safe py-4 pt-safe sm:px-6 lg:pt-4"
              data-testid="shell-header"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  {headerSlots.title}
                  {headerSlots.description}
                  {bootstrap.activeClient ? (
                    <p className="mt-1 text-sm text-stone-600" data-testid="shell-active-client">
                      {bootstrap.activeClient.fullName} · {bootstrap.activeClient.referenceShort}
                      {bootstrap.badgeCounts.alerts > 0
                        ? ` · uyarı ${formatShellBadgeDisplayCount(bootstrap.badgeCounts.alerts)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {headerSlots.actions}
                  {activeDestination === "ai_chat" ? (
                    <Link
                      href={`${AI_CHAT_ROOT_PATH}?focus=1`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                      aria-label="Odak moduna geç"
                      data-testid="shell-enter-focus"
                    >
                      <Maximize2 size={18} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </header>
          )}
          {children}
        </main>
      </div>

      <DashboardMobileNav
        activeNavKey={activeDestination}
        uiLanguage={uiLanguage}
        badges={badges}
        aiChatEnabled={bootstrap.navigation.some((item) => item.id === "ai_chat" && item.enabled)}
        onNavigate={navigateToSection}
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
