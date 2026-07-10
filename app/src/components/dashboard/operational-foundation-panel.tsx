"use client";

import { Link2, Shield, ShieldAlert } from "lucide-react";
import type { ManuAppState, SupportedLanguageCode } from "@/lib/types";
import { t } from "@/lib/i18n";
import {
  buildChannelTrustOperationalSnapshot,
  buildQuarantineInspectionRows,
  buildTrustBindingInspectionSummary,
} from "@/lib/phase-85-if-h-operational-visibility";
import { Badge, InfoLine, MetricCard } from "./shared";

export function OperationalFoundationPanel({
  state,
  uiLanguage,
  showInspectionDetails,
}: {
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  showInspectionDetails: boolean;
}) {
  const channelTrust = buildChannelTrustOperationalSnapshot(state);
  const quarantineRows = buildQuarantineInspectionRows(state);
  const trustBindings = buildTrustBindingInspectionSummary(state);
  const statusTone =
    channelTrust.status === "healthy" ? "emerald" : channelTrust.status === "degraded" ? "amber" : "red";

  return (
    <section className="space-y-4" data-testid="operational-foundation-panel">
      <div>
        <h3 className="text-lg font-semibold">{t(uiLanguage, "operationalFoundationTitle")}</h3>
        <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "operationalFoundationSubtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge label={t(uiLanguage, channelTrust.statusI18nKey)} tone={statusTone} />
        <span className="text-sm text-stone-600">{t(uiLanguage, "channelTrustTitle")}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ShieldAlert}
          label={t(uiLanguage, "channelTrustQuarantineCount")}
          value={String(channelTrust.openQuarantineCount)}
          tone={channelTrust.openQuarantineCount > 0 ? "amber" : "stone"}
        />
        <MetricCard
          icon={Link2}
          label={t(uiLanguage, "channelTrustBindingActive")}
          value={String(channelTrust.activeAccountBindingCount)}
          tone="emerald"
        />
        <MetricCard
          icon={Shield}
          label={t(uiLanguage, "channelTrustBindingRevoked")}
          value={String(channelTrust.revokedAccountBindingCount)}
          tone={channelTrust.revokedAccountBindingCount > 0 ? "amber" : "stone"}
        />
        <MetricCard
          icon={Shield}
          label={t(uiLanguage, "channelTrustActorBindings")}
          value={String(channelTrust.activeActorBindingCount)}
          tone="stone"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InfoLine label={t(uiLanguage, "channelTrustDeliveryFailures")} value={String(channelTrust.deliveryFailureCount)} />
        <InfoLine label={t(uiLanguage, "channelTrustGateBlocked")} value={String(channelTrust.gateBlockedCount)} />
        <InfoLine label={t(uiLanguage, "channelTrustDuplicateIgnored")} value={String(channelTrust.duplicateIgnoredCount)} />
        <InfoLine label={t(uiLanguage, "channelTrustOptOut")} value={String(channelTrust.optOutCount)} />
        <InfoLine label={t(uiLanguage, "channelTrustRollbackScopes")} value={String(channelTrust.rollbackScopeCount)} />
      </div>

      {showInspectionDetails ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold">{t(uiLanguage, "trustBindingInspectionTitle")}</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {trustBindings.accounts.length === 0 ? (
                <li className="text-stone-500">{t(uiLanguage, "noQuarantineRows")}</li>
              ) : (
                trustBindings.accounts.map((account) => (
                  <li key={account.id} className="rounded-lg border border-stone-100 bg-stone-50 p-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge label={account.provider} tone="stone" />
                      <Badge label={account.lifecycleStatus} tone={account.lifecycleStatus === "active" ? "emerald" : "amber"} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-stone-600">{account.normalizedDisplayNumber}</p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold">{t(uiLanguage, "quarantineInspectionTitle")}</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {quarantineRows.length === 0 ? (
                <li className="text-stone-500">{t(uiLanguage, "noQuarantineRows")}</li>
              ) : (
                quarantineRows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-stone-100 bg-stone-50 p-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge label={row.eventKind} tone="amber" />
                      <Badge label={row.processingStatus} tone="stone" />
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      {row.observedAt.slice(0, 19)} · {row.payloadDigestPrefix}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      ) : (
        <p className="text-sm text-stone-500">{t(uiLanguage, "inspectionAdminOnlyNote")}</p>
      )}
    </section>
  );
}
