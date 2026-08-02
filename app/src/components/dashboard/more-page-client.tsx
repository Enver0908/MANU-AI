"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import { MORE_ROOT_PATH } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { resolveMoreMenuSections } from "@/lib/phase-85-stage-5-shell-navigation";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { TenantRole } from "@/lib/types";

/**
 * Role-aware More destination with four fixed IA sections.
 */
export function MorePageClient({
  uiLanguage: _uiLanguage,
  aiChatEnabled,
  role,
}: {
  uiLanguage: SupportedLanguageCode;
  aiChatEnabled: boolean;
  role: TenantRole;
}) {
  const { setHeaderSlots, bootstrap, navigateToDestination } = useShellProvider();

  useEffect(() => {
    setHeaderSlots({
      title: <h1 className="text-2xl font-semibold text-ink">Diğer</h1>,
      description: (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
          AI araçları, danışan yardımcıları, hesap ve yönetim kısayolları.
        </p>
      ),
    });
    return () => setHeaderSlots({});
  }, [setHeaderSlots]);

  const sections = resolveMoreMenuSections({
    role: bootstrap?.role ?? role,
    navigation: bootstrap?.navigation,
    aiChatEnabled,
    capabilities: bootstrap?.capabilities,
  });

  return (
    <div
      id={DASHBOARD_MAIN_ID}
      tabIndex={-1}
      className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
      data-testid="more-page"
      data-path={MORE_ROOT_PATH}
    >
      <div className="space-y-8 px-safe py-5 pb-24 sm:px-6 lg:pb-6">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`more-section-${section.id}`} data-testid={`more-section-${section.id}`}>
            <div className="border-b border-line pb-2">
              <h2 id={`more-section-${section.id}`} className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {section.title}
              </h2>
            </div>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {section.items.map((item) => {
                const className =
                  "inline-flex min-h-11 w-full items-center justify-between gap-3 bg-surface px-1 text-sm font-medium transition";
                if (!item.enabled) {
                  return (
                    <li key={item.id}>
                      <span
                        className={`${className} cursor-not-allowed text-ink-muted`}
                        aria-disabled="true"
                        title={item.disabledReason}
                        data-testid={`more-item-${item.id}-disabled`}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs font-normal text-ink-subtle">
                          {item.disabledReason === "feature_disabled"
                            ? "Özellik kapalı"
                            : "Kullanılamıyor"}
                        </span>
                      </span>
                    </li>
                  );
                }

                if (
                  item.destinationId === "ai_chat" ||
                  item.destinationId === "settings" ||
                  item.destinationId === "operational_foundation"
                ) {
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`${className} text-ink hover:bg-surface-muted`}
                        data-testid={`more-item-${item.id}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${className} text-left text-ink hover:bg-surface-muted`}
                      data-testid={`more-item-${item.id}`}
                      onClick={() => {
                        if (item.destinationId !== "operational_foundation") {
                          navigateToDestination(item.destinationId);
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {bootstrap?.warnings?.length ? (
        <p className="px-safe text-sm text-ink-muted sm:px-6" role="status">
          {bootstrap.warnings.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
