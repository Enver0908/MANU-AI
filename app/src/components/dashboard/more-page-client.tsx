"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import {
  AI_CHAT_ROOT_PATH,
  MORE_ROOT_PATH,
  SETTINGS_ROOT_PATH,
  buildShellHref,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

/**
 * Minimal More destination for Faz 4 route wiring.
 * Faz 5 owns the grouped role-aware More IA and visual polish.
 */
export function MorePageClient({
  uiLanguage,
  aiChatEnabled,
}: {
  uiLanguage: SupportedLanguageCode;
  aiChatEnabled: boolean;
}) {
  const { setHeaderSlots, bootstrap } = useShellProvider();

  useEffect(() => {
    setHeaderSlots({
      title: <h1 className="text-2xl font-semibold text-ink">Diğer</h1>,
      description: (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
          Hesap, ayarlar ve ek araçlar. Gruplu More düzeni sonraki fazda tamamlanır.
        </p>
      ),
    });
    return () => setHeaderSlots({});
  }, [setHeaderSlots]);

  const links = [
    ...(aiChatEnabled
      ? [{ href: AI_CHAT_ROOT_PATH, label: t(uiLanguage, "aiChat") }]
      : []),
    { href: buildShellHref("simulator"), label: t(uiLanguage, "simulator") },
    { href: buildShellHref("voice"), label: t(uiLanguage, "voice") },
    { href: buildShellHref("forms"), label: t(uiLanguage, "forms") },
    { href: SETTINGS_ROOT_PATH, label: t(uiLanguage, "settings") },
  ];

  return (
    <div
      id={DASHBOARD_MAIN_ID}
      tabIndex={-1}
      className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
      data-testid="more-page"
      data-path={MORE_ROOT_PATH}
    >
      <ul className="space-y-2 px-safe py-5 pb-24 sm:px-6 lg:pb-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 w-full items-center rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      {bootstrap?.warnings?.length ? (
        <p className="px-safe text-sm text-stone-500 sm:px-6" role="status">
          {bootstrap.warnings.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
