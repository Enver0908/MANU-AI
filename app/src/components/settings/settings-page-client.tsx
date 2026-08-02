"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { SettingsActiveSection } from "@/components/settings/settings-sections";
import { Tabs } from "@/components/ui";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import {
  buildSettingsHref,
  SETTINGS_TABS,
  type SettingsAccountReadModel,
  type SettingsTab,
} from "@/lib/phase-85-stage-4d-settings-contracts";
import type { DashboardMessageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";

const TAB_LABEL_KEYS: Record<SettingsTab, DashboardMessageKey> = {
  profile: "settingsTabProfile",
  security: "settingsTabSecurity",
  workspace: "settingsTabWorkspace",
  billing: "settingsTabBilling",
  application: "settingsTabApplication",
};

export function SettingsPageClient({
  model,
  activeTab,
  aiChatEnabled: _aiChatEnabled,
}: {
  model: SettingsAccountReadModel;
  activeTab: SettingsTab;
  aiChatEnabled: boolean;
}) {
  const { setHeaderSlots, requestHrefNavigation } = useShellProvider();
  const uiLanguage = model.profile.uiLanguage;

  useEffect(() => {
    setHeaderSlots({
      title: <h1 className="text-2xl font-semibold text-ink">{t(uiLanguage, "settingsTitle")}</h1>,
      description: (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{t(uiLanguage, "settingsSubtitle")}</p>
      ),
    });
    return () => setHeaderSlots({});
  }, [setHeaderSlots, uiLanguage]);

  const tabItems = useMemo(
    () =>
      SETTINGS_TABS.map((tab) => ({
        id: tab,
        label: t(uiLanguage, TAB_LABEL_KEYS[tab]),
      })),
    [uiLanguage],
  );

  const onTabChange = useCallback(
    (id: string) => {
      const next = SETTINGS_TABS.includes(id as SettingsTab) ? (id as SettingsTab) : "profile";
      requestHrefNavigation(buildSettingsHref(next));
    },
    [requestHrefNavigation],
  );

  return (
    <div
      id={DASHBOARD_MAIN_ID}
      tabIndex={-1}
      className="flex min-h-screen min-w-0 flex-1 flex-col outline-none"
      data-testid="settings-page"
    >
      {model.runtime.mode === "fallback" ? (
        <p
          className="mx-safe mt-4 rounded-card border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted sm:mx-6"
          role="status"
          data-testid="settings-fallback-banner"
        >
          {t(uiLanguage, "settingsFallbackBanner")}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-5 px-safe py-5 pb-24 sm:px-6 lg:flex-row lg:pb-6">
        <nav
          className="lg:w-56 lg:shrink-0"
          aria-label={t(uiLanguage, "settingsNavSections")}
          data-testid="settings-section-nav"
        >
          <div className="lg:hidden">
            <Tabs
              items={tabItems}
              value={activeTab}
              onValueChange={onTabChange}
              ariaLabel={t(uiLanguage, "settingsNavSections")}
            />
          </div>
          <ul className="hidden space-y-1 lg:block">
            {SETTINGS_TABS.map((tab) => {
              const active = tab === activeTab;
              return (
                <li key={tab}>
                  <button
                    type="button"
                    onClick={() => onTabChange(tab)}
                    className={`inline-flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition ${
                      active
                        ? "bg-emerald-950 text-white"
                        : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                    }`}
                    aria-current={active ? "page" : undefined}
                    data-testid={`settings-nav-${tab}`}
                  >
                    {t(uiLanguage, TAB_LABEL_KEYS[tab])}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <SettingsActiveSection tab={activeTab} model={model} uiLanguage={uiLanguage} />
        </div>
      </div>
    </div>
  );
}
