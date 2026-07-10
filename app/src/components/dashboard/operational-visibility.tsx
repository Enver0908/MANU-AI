"use client";

import { PauseCircle, ShieldAlert, Zap } from "lucide-react";
import type { SupportedLanguageCode } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { HumanControlBannerModel } from "@/lib/phase-85-if-h-operational-visibility";
import { Badge, ConfirmButton, formatTime, InfoLine } from "./shared";

export function HumanControlSessionBanner({
  banner,
  uiLanguage,
  onActivateAi,
  isActivating,
}: {
  banner: HumanControlBannerModel;
  uiLanguage: SupportedLanguageCode;
  onActivateAi: () => void;
  isActivating?: boolean;
}) {
  return (
    <section
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm"
      data-testid="human-control-session-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-amber-950">
            <PauseCircle size={18} className="shrink-0 text-amber-800" />
            {t(uiLanguage, "humanControlBannerTitle")}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <InfoLine label={t(uiLanguage, "humanControlPauseReason")} value={t(uiLanguage, banner.reasonI18nKey)} />
            <InfoLine
              label={t(uiLanguage, "humanControlLatestResponse")}
              value={
                banner.latestHumanResponseAt
                  ? formatTime(banner.latestHumanResponseAt)
                  : t(uiLanguage, "humanControlLatestResponseNone")
              }
            />
            <InfoLine
              label={t(uiLanguage, "humanControlResponseCount")}
              value={String(banner.humanResponseCount)}
            />
          </div>
          {banner.requiresHandoffResolution && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
              <ShieldAlert size={16} className="mr-1 inline" />
              {t(uiLanguage, "humanControlReasonRedLock")}
            </p>
          )}
        </div>
        {banner.canActivateAi && !banner.requiresHandoffResolution && (
          <ConfirmButton
            label={t(uiLanguage, "humanControlActivateAi")}
            confirmLabel={t(uiLanguage, "humanControlActivateAi")}
            onConfirm={onActivateAi}
            disabled={isActivating}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge label={t(uiLanguage, banner.reasonI18nKey)} tone="amber" />
        {banner.canActivateAi ? <Badge label="AI paused" tone="stone" /> : null}
      </div>
    </section>
  );
}

export function StructuredUpdateSourceLinksPanel({
  links,
  uiLanguage,
  onScrollToMessage,
  onOpenPanel,
}: {
  links: Array<{
    proposalId: string;
    proposalTitle: string;
    sourceMessageId: string | null;
    panelDeepLinks: string[];
    structuredImpactFlags: string[];
  }>;
  uiLanguage: SupportedLanguageCode;
  onScrollToMessage?: (messageId: string) => void;
  onOpenPanel?: (panelKey: string) => void;
}) {
  if (links.length === 0) return null;

  return (
    <section
      className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
      data-testid="structured-update-source-links"
    >
      <h3 className="text-sm font-semibold">{t(uiLanguage, "structuredUpdateRequirements")}</h3>
      <ul className="mt-3 space-y-3">
        {links.map((link) => (
          <li key={link.proposalId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-950">{link.proposalTitle}</p>
            {link.structuredImpactFlags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {link.structuredImpactFlags.map((flag) => (
                  <Badge key={flag} label={flag} tone="amber" />
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {link.sourceMessageId && onScrollToMessage ? (
                <button
                  type="button"
                  onClick={() => onScrollToMessage(link.sourceMessageId!)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                >
                  <Zap size={14} />
                  {t(uiLanguage, "scrollToSourceMessage")}
                </button>
              ) : null}
              {link.panelDeepLinks.map((panelKey) =>
                onOpenPanel ? (
                  <button
                    key={`${link.proposalId}-${panelKey}`}
                    type="button"
                    onClick={() => onOpenPanel(panelKey)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                  >
                    {panelKey}
                  </button>
                ) : null,
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
