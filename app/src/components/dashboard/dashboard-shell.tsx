"use client";

import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import type { DashboardNavKey, DashboardSection } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { DashboardMobileNav, DashboardSidebarNav } from "@/components/dashboard/dashboard-navigation";

export type DashboardShellBadges = { alerts: number; notifications: number; messages: number };

/**
 * Shared dashboard chrome (skip-link, nav aside, mobile nav) extracted from
 * the former monolithic `DashboardApp` so the classic dashboard and the AI
 * Chat workspace (Faz 4) render identical navigation without duplicating it.
 *
 * The caller owns its own header/content markup (including the
 * `#${DASHBOARD_MAIN_ID}` skip-link target) as `children`; this component
 * only owns the surrounding nav chrome. `focusMode` hides that chrome
 * entirely for a full-screen workspace (AI Chat focus mode).
 */
export function DashboardShell({
  activeNavKey,
  uiLanguage,
  badges,
  aiChatEnabled = false,
  onNavigateSection,
  focusMode = false,
  children,
}: {
  activeNavKey: DashboardNavKey;
  uiLanguage: SupportedLanguageCode;
  badges?: DashboardShellBadges;
  aiChatEnabled?: boolean;
  onNavigateSection: (section: DashboardSection) => void;
  focusMode?: boolean;
  children: ReactNode;
}) {
  if (focusMode) {
    return (
      <div className="min-h-screen bg-[#f7f5ef] text-stone-950">
        <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
          İçeriğe atla
        </a>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-stone-950">
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
        İçeriğe atla
      </a>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside
          className="border-b border-stone-200 bg-white px-safe lg:w-72 lg:border-b-0 lg:border-r lg:px-0"
          aria-label="Ana navigasyon"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">MANU-AI</p>
              <h1 className="mt-1 text-xl font-semibold">Diyetisyen konsolu</h1>
            </div>
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100"
                title="Demo oturumunu kapat"
                aria-label="Demo oturumunu kapat"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>

          <DashboardSidebarNav
            activeNavKey={activeNavKey}
            uiLanguage={uiLanguage}
            badges={badges}
            aiChatEnabled={aiChatEnabled}
            onNavigate={onNavigateSection}
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

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>

      <DashboardMobileNav
        activeNavKey={activeNavKey}
        uiLanguage={uiLanguage}
        badges={badges}
        aiChatEnabled={aiChatEnabled}
        onNavigate={onNavigateSection}
      />
    </div>
  );
}
