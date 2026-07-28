"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui";
import type { DashboardMessageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";

export function SettingsBillingPortalButton({ uiLanguage }: { uiLanguage: SupportedLanguageCode }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenPortal = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/commercial/billing-portal", { method: "POST" });
      const data = (await response.json()) as { portalUrl?: string; error?: string };
      if (!response.ok || !data.portalUrl) {
        const key = `settingsBillingPortalError_${data.error}` as DashboardMessageKey;
        setError(t(uiLanguage, key) || t(uiLanguage, "settingsBillingPortalFailed"));
        return;
      }
      window.location.assign(data.portalUrl);
    } catch {
      setError(t(uiLanguage, "settingsBillingPortalFailed"));
    } finally {
      setBusy(false);
    }
  }, [uiLanguage]);

  return (
    <div className="space-y-3" data-testid="settings-billing-portal">
      <Button type="button" onClick={onOpenPortal} disabled={busy} data-testid="settings-billing-portal-open">
        {busy ? t(uiLanguage, "settingsBillingPortalOpening") : t(uiLanguage, "settingsBillingPortalOpen")}
      </Button>
      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert" data-testid="settings-billing-portal-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
