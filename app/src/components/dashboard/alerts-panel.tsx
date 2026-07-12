"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import type { ClinicalAlertListItem } from "@/lib/phase-85-stage-4b-contracts";
import type { DashboardUrlState } from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  ALERTS_PANEL_SKELETON_ROW_COUNT,
  buildAlertSeveritySegmentLabel,
  canNavigateToAlertTarget,
  resolveAlertEmptyStateKeys,
  type AlertSeveritySegment,
} from "@/lib/alerts-panel-helpers";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextInput } from "./shared";
import { EmptyState } from "./state-primitives";
import { Stage4BAlertRowSkeleton, Stage4BClinicalAlertRow } from "./stage-4b-list-row";

export function AlertsPanel({
  uiLanguage,
  filters,
  items,
  counts,
  filteredTotal,
  nextCursor,
  error,
  isRefreshing,
  isLoadingMore,
  lastSuccessAt,
  onFiltersChange,
  onRefresh,
  onLoadMore,
  onOpenAlertTarget,
}: {
  uiLanguage: SupportedLanguageCode;
  filters: DashboardUrlState;
  items: ClinicalAlertListItem[];
  counts: { all: number; red: number; yellow: number } | null;
  filteredTotal: number;
  nextCursor: string | null;
  error: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  lastSuccessAt: string | null;
  onFiltersChange: (patch: Partial<DashboardUrlState>) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenAlertTarget: (alert: ClinicalAlertListItem) => void;
}) {
  const [targetError, setTargetError] = useState<string | null>(null);
  const severityCounts = counts ?? { all: 0, red: 0, yellow: 0 };
  const segmentLabels: Record<AlertSeveritySegment, string> = {
    all: t(uiLanguage, "filterAll"),
    red: t(uiLanguage, "filterRed"),
    yellow: t(uiLanguage, "filterYellow"),
  };
  const segmentOptions: Array<[AlertSeveritySegment, string]> = (["all", "red", "yellow"] as const).map(
    (segment) => [segment, buildAlertSeveritySegmentLabel(segment, severityCounts, segmentLabels)],
  );
  const emptyState = resolveAlertEmptyStateKeys(filters.alertSeverity, filters.alertQuery);
  const showInitialLoading = isRefreshing && items.length === 0;
  const showInitialError = Boolean(error) && items.length === 0 && !showInitialLoading;
  const showEmpty = !showInitialLoading && !showInitialError && items.length === 0;

  const handleOpenAlert = (alert: ClinicalAlertListItem) => {
    if (!canNavigateToAlertTarget(alert)) {
      setTargetError(t(uiLanguage, "alertTargetError"));
      return;
    }
    setTargetError(null);
    onOpenAlertTarget(alert);
  };

  return (
    <section className="space-y-4 overflow-x-hidden" data-testid="alerts-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(uiLanguage, "alerts")}</h2>
          <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "alertsSectionSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={t(uiLanguage, "refreshInbox")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : undefined} />
          {t(uiLanguage, "refreshInbox")}
        </button>
      </div>

      <div className="sticky top-0 z-10 space-y-3 border-b border-stone-200 bg-stone-50/95 pb-3 pt-1 backdrop-blur-sm">
        <TextInput
          label={t(uiLanguage, "searchAlerts")}
          value={filters.alertQuery}
          onChange={(value) => onFiltersChange({ alertQuery: value })}
        />
        <div>
          <p className="text-sm font-medium text-stone-700">{t(uiLanguage, "alertSeverityFilter")}</p>
          <div
            className="mt-1 grid grid-cols-1 gap-1 rounded-lg bg-stone-100 p-1 sm:grid-cols-3"
            role="tablist"
            aria-label={t(uiLanguage, "alertSeverityFilter")}
          >
            {segmentOptions.map(([segment, label]) => (
              <button
                key={segment}
                type="button"
                role="tab"
                aria-selected={filters.alertSeverity === segment}
                onClick={() => onFiltersChange({ alertSeverity: segment })}
                className={`min-h-11 rounded-md px-2 py-2 text-sm font-semibold transition ${
                  filters.alertSeverity === segment
                    ? "bg-white text-emerald-950 shadow-sm"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {targetError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {targetError}. {t(uiLanguage, "alertTargetErrorHint")}
        </div>
      ) : null}

      {error && items.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t(uiLanguage, "inboxRefreshError")} ({error})
        </div>
      ) : null}

      {showInitialError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-950">{t(uiLanguage, "inboxRefreshError")}</p>
          <p className="mt-1 text-sm text-red-900">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
          >
            <RefreshCcw size={16} />
            {t(uiLanguage, "refreshInbox")}
          </button>
        </div>
      ) : showInitialLoading ? (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {Array.from({ length: ALERTS_PANEL_SKELETON_ROW_COUNT }).map((_, index) => (
            <Stage4BAlertRowSkeleton key={index} />
          ))}
        </ul>
      ) : showEmpty ? (
        <EmptyState title={t(uiLanguage, emptyState.titleKey)} message={t(uiLanguage, emptyState.messageKey)} />
      ) : (
        <>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
            {items.map((alert) => (
              <Stage4BClinicalAlertRow key={alert.id} alert={alert} uiLanguage={uiLanguage} onOpen={handleOpenAlert} />
            ))}
          </ul>
          {nextCursor ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? t(uiLanguage, "refreshInbox") : t(uiLanguage, "alertsLoadMore")}
            </button>
          ) : null}
        </>
      )}

      <p className="text-xs text-stone-500">
        {t(uiLanguage, "inboxFilteredTotal")}: {filteredTotal}
        {lastSuccessAt ? ` · ${t(uiLanguage, "inboxLastRefresh")}: ${new Date(lastSuccessAt).toLocaleString("tr-TR")}` : ""}
      </p>
    </section>
  );
}
