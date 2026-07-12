"use client";

import { Check, ChevronRight } from "lucide-react";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "@/lib/phase-85-stage-4b-contracts";
import {
  ALERTS_PANEL_ROW_MIN_HEIGHT_CLASS,
  formatAlertStartedAt,
  resolveAlertAdditionalReasonSuffix,
  resolveAlertClientDisplayName,
  resolveAlertSlaPresentation,
  resolveAlertTypeLabelKey,
} from "@/lib/alerts-panel-helpers";
import {
  formatNotificationOccurredAt,
  formatNotificationOccurrenceLabel,
  isNotificationSummaryKey,
  isNotificationTitleKey,
  NOTIFICATION_KIND_ICON,
  NOTIFICATIONS_PANEL_ROW_MIN_HEIGHT_CLASS,
  resolveNotificationContextLabel,
  resolveNotificationPriorityLabelKey,
  resolveNotificationPriorityTone,
  resolveNotificationReceiptStatus,
  shouldShowUnsupportedMediaReviewComplete,
} from "@/lib/notifications-panel-helpers";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { Badge } from "./shared";

export function Stage4BClinicalAlertRow({
  alert,
  uiLanguage,
  onOpen,
}: {
  alert: ClinicalAlertListItem;
  uiLanguage: SupportedLanguageCode;
  onOpen: (alert: ClinicalAlertListItem) => void;
}) {
  const clientName = resolveAlertClientDisplayName(alert.clientFullName, t(uiLanguage, "alertGenericClientName"));
  const alertTypeLabel = t(uiLanguage, resolveAlertTypeLabelKey(alert.kind));
  const reasonLabel = t(uiLanguage, alert.reasonLabelKey);
  const additionalSuffix = resolveAlertAdditionalReasonSuffix(alert.additionalReasonCount);
  const startedLabel = formatAlertStartedAt(alert.startedAt);
  const sla = resolveAlertSlaPresentation(alert);
  const rowLabel = `${clientName}. ${alertTypeLabel}. ${reasonLabel}${additionalSuffix}. ${t(uiLanguage, "alertsOpenConversation")}`;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(alert)}
        aria-label={rowLabel}
        data-testid={`clinical-alert-row-${alert.id}`}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${ALERTS_PANEL_ROW_MIN_HEIGHT_CLASS}`}
      >
        <span
          aria-hidden="true"
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === "red" ? "bg-red-600" : "bg-amber-500"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-stone-900">{clientName}</span>
            <Badge label={alert.severity === "red" ? t(uiLanguage, "filterRed") : t(uiLanguage, "filterYellow")} tone={alert.severity === "red" ? "red" : "amber"} />
          </span>
          <span className="mt-1 block text-sm font-medium text-stone-800">{alertTypeLabel}</span>
          <span className="mt-0.5 block text-sm leading-5 text-stone-600 break-words">
            {reasonLabel}
            {additionalSuffix}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
            {startedLabel ? (
              <span>
                {t(uiLanguage, "alertsStartedAt")}: {startedLabel}
              </span>
            ) : null}
            {sla ? (
              <span className={sla.tone === "red" ? "text-red-700" : sla.tone === "amber" ? "text-amber-800" : undefined}>
                {t(uiLanguage, "alertsElapsed")}: {sla.elapsedLabel}
                {sla.deadlineLabel ? ` · ${t(uiLanguage, "alertsSlaDeadline")}: ${sla.deadlineLabel}` : ""}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />
      </button>
    </li>
  );
}

export function Stage4BAlertRowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className={`px-3 py-2 ${ALERTS_PANEL_ROW_MIN_HEIGHT_CLASS}`}
      data-testid="clinical-alert-row-skeleton"
    >
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-stone-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-stone-100" />
          <div className="h-3 w-28 animate-pulse rounded bg-stone-100" />
        </div>
      </div>
    </li>
  );
}

export function Stage4BNotificationRow({
  notification,
  uiLanguage,
  canMutateReceipts,
  isAcknowledging,
  isCompletingReview,
  onOpen,
  onAcknowledge,
  onCompleteReview,
}: {
  notification: SystemNotificationListItem;
  uiLanguage: SupportedLanguageCode;
  canMutateReceipts: boolean;
  isAcknowledging: boolean;
  isCompletingReview: boolean;
  onOpen: (notification: SystemNotificationListItem) => void;
  onAcknowledge: (notification: SystemNotificationListItem) => void;
  onCompleteReview: (notification: SystemNotificationListItem) => void;
}) {
  const Icon = NOTIFICATION_KIND_ICON[notification.kind];
  const title = isNotificationTitleKey(notification.titleKey)
    ? t(uiLanguage, notification.titleKey)
    : notification.titleKey;
  const summary = isNotificationSummaryKey(notification.summaryKey)
    ? t(uiLanguage, notification.summaryKey)
    : notification.summaryKey;
  const contextLabel = resolveNotificationContextLabel(notification, {
    client: t(uiLanguage, "alertGenericClientName"),
    system: t(uiLanguage, "notificationSystemContext"),
  });
  const occurredLabel = formatNotificationOccurredAt(notification.lastOccurredAt);
  const occurrenceSuffix = formatNotificationOccurrenceLabel(
    notification.occurrenceCount,
    t(uiLanguage, "notificationOccurrences"),
  );
  const receiptStatus = resolveNotificationReceiptStatus(notification);
  const receiptLabel =
    receiptStatus === "acknowledged"
      ? t(uiLanguage, "notificationAcknowledgedStatus")
      : receiptStatus === "read"
        ? t(uiLanguage, "notificationReadStatus")
        : t(uiLanguage, "notificationUnreadStatus");
  const priorityLabel = t(uiLanguage, resolveNotificationPriorityLabelKey(notification.priority));
  const priorityTone = resolveNotificationPriorityTone(notification.priority);
  const showCompleteReview = shouldShowUnsupportedMediaReviewComplete(notification);

  return (
    <li className="divide-y divide-stone-100" data-testid={`system-notification-row-${notification.id}`}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onOpen(notification)}
          aria-label={`${title}. ${contextLabel}. ${t(uiLanguage, "notificationsOpenTarget")}`}
          className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${NOTIFICATIONS_PANEL_ROW_MIN_HEIGHT_CLASS}`}
        >
          <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700" aria-hidden="true">
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-stone-900">{title}</span>
              <Badge label={priorityLabel} tone={priorityTone} />
            </span>
            <span className="mt-1 block text-sm font-medium text-stone-800">{contextLabel}</span>
            <span className="mt-0.5 block text-sm leading-5 text-stone-600 break-words">{summary}</span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
              {occurredLabel ? (
                <span>
                  {t(uiLanguage, "notificationsOccurredAt")}: {occurredLabel}
                </span>
              ) : null}
              {occurrenceSuffix ? <span>{occurrenceSuffix}</span> : null}
              <span>{receiptLabel}</span>
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />
        </button>
        {canMutateReceipts ? (
          <button
            type="button"
            onClick={() => onAcknowledge(notification)}
            disabled={isAcknowledging || Boolean(notification.acknowledgedAt)}
            aria-label={t(uiLanguage, "notificationAcknowledgeAction")}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-l border-stone-200 px-3 text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {showCompleteReview && canMutateReceipts ? (
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => onCompleteReview(notification)}
            disabled={isCompletingReview}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
          >
            {t(uiLanguage, "notificationCompleteMediaReview")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function Stage4BNotificationRowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className={`px-3 py-2 ${NOTIFICATIONS_PANEL_ROW_MIN_HEIGHT_CLASS}`}
      data-testid="system-notification-row-skeleton"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-stone-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-stone-100" />
          <div className="h-3 w-32 animate-pulse rounded bg-stone-100" />
        </div>
      </div>
    </li>
  );
}
