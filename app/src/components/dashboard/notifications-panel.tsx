"use client";

import { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import type { AppTenantContext } from "@/lib/auth-context";
import type {
  Stage4BNotificationMutationResponse,
  Stage4BNotificationReadAllResponse,
  SystemNotificationListItem,
} from "@/lib/phase-85-stage-4b-contracts";
import type { DashboardUrlState } from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  buildNotificationStatusSegmentLabel,
  canActorMutateNotificationReceipts,
  canNavigateToNotificationTarget,
  NOTIFICATIONS_PANEL_SKELETON_ROW_COUNT,
  resolveNotificationEmptyStateKeys,
  type NotificationStatusSegment,
} from "@/lib/notifications-panel-helpers";
import {
  acknowledgeStage4BNotification,
  completeStage4BUnsupportedMediaReview,
  markAllStage4BNotificationsRead,
  markStage4BNotificationRead,
} from "@/lib/stage-4b-notification-mutations";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextInput } from "./shared";
import { EmptyState } from "./state-primitives";
import { Stage4BNotificationRow, Stage4BNotificationRowSkeleton } from "./stage-4b-list-row";

export function NotificationsPanel({
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
  actorContext,
  activeClientIds,
  onFiltersChange,
  onRefresh,
  onLoadMore,
  onOpenNotificationTarget,
  onReceiptMutated,
  onReadAllMutated,
}: {
  uiLanguage: SupportedLanguageCode;
  filters: DashboardUrlState;
  items: SystemNotificationListItem[];
  counts: { active: number; unread: number; history: number } | null;
  filteredTotal: number;
  nextCursor: string | null;
  error: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  lastSuccessAt: string | null;
  actorContext: Pick<AppTenantContext, "role" | "dietitianId">;
  activeClientIds: ReadonlySet<string>;
  onFiltersChange: (patch: Partial<DashboardUrlState>) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenNotificationTarget: (notification: SystemNotificationListItem) => void;
  onReceiptMutated: (payload: Stage4BNotificationMutationResponse) => void;
  onReadAllMutated: (payload: Stage4BNotificationReadAllResponse) => void;
}) {
  const [targetError, setTargetError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [completingReviewId, setCompletingReviewId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const canMutateReceipts = canActorMutateNotificationReceipts(actorContext, actorContext.dietitianId);
  const statusCounts = counts ?? { active: 0, unread: 0, history: 0 };
  const segmentLabels: Record<NotificationStatusSegment, string> = {
    active: t(uiLanguage, "filterActive"),
    unread: t(uiLanguage, "filterUnread"),
    history: t(uiLanguage, "filterHistory"),
  };
  const segmentOptions: Array<[NotificationStatusSegment, string]> = (["active", "unread", "history"] as const).map(
    (segment) => [segment, buildNotificationStatusSegmentLabel(segment, statusCounts, segmentLabels)],
  );
  const emptyState = resolveNotificationEmptyStateKeys(filters.notificationStatus, filters.notificationQuery);
  const showInitialLoading = isRefreshing && items.length === 0;
  const showInitialError = Boolean(error) && items.length === 0 && !showInitialLoading;
  const showEmpty = !showInitialLoading && !showInitialError && items.length === 0;
  const priorityOptions = useMemo(
    () =>
      [
        ["", t(uiLanguage, "filterAll")],
        ["intervention_required", t(uiLanguage, "filterInterventionRequired")],
        ["review_required", t(uiLanguage, "filterReviewRequired")],
        ["info", t(uiLanguage, "filterInfo")],
      ] as const,
    [uiLanguage],
  );
  const categoryOptions = useMemo(
    () =>
      [
        ["", t(uiLanguage, "filterAll")],
        ["records", t(uiLanguage, "filterRecords")],
        ["conversation_review", t(uiLanguage, "filterConversationReview")],
        ["channel_delivery", t(uiLanguage, "filterChannelDelivery")],
        ["ai_control", t(uiLanguage, "filterAiControl")],
      ] as const,
    [uiLanguage],
  );

  const handleOpenNotification = async (notification: SystemNotificationListItem) => {
    setMutationError(null);
    if (!canNavigateToNotificationTarget(notification, activeClientIds)) {
      setTargetError(t(uiLanguage, "notificationTargetError"));
      return;
    }
    setTargetError(null);

    if (canMutateReceipts && !notification.readAt) {
      try {
        const payload = await markStage4BNotificationRead(notification.id);
        onReceiptMutated(payload);
      } catch (readError) {
        setMutationError(readError instanceof Error ? readError.message : t(uiLanguage, "notificationReadFailed"));
        return;
      }
    }

    onOpenNotificationTarget(notification);
  };

  const handleAcknowledge = async (notification: SystemNotificationListItem) => {
    if (!canMutateReceipts || notification.acknowledgedAt) return;
    setMutationError(null);
    setAcknowledgingId(notification.id);
    try {
        const payload = await acknowledgeStage4BNotification(notification.id);
        onReceiptMutated(payload);
    } catch (ackError) {
      setMutationError(ackError instanceof Error ? ackError.message : t(uiLanguage, "notificationAcknowledgeFailed"));
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleCompleteReview = async (notification: SystemNotificationListItem) => {
    if (!canMutateReceipts) return;
    setMutationError(null);
    setCompletingReviewId(notification.id);
    try {
        const payload = await completeStage4BUnsupportedMediaReview(notification.id);
        onReceiptMutated(payload);
    } catch (completeError) {
      setMutationError(
        completeError instanceof Error ? completeError.message : t(uiLanguage, "notificationCompleteReviewFailed"),
      );
    } finally {
      setCompletingReviewId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!canMutateReceipts || filters.notificationStatus !== "unread") return;
    setMutationError(null);
    setIsMarkingAllRead(true);
    try {
        const payload = await markAllStage4BNotificationsRead();
        onReadAllMutated(payload);
    } catch (markAllError) {
      setMutationError(markAllError instanceof Error ? markAllError.message : t(uiLanguage, "notificationMarkAllReadFailed"));
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <section className="space-y-4 overflow-x-hidden" data-testid="notifications-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(uiLanguage, "notifications")}</h2>
          <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "notificationsSectionSubtitle")}</p>
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
          label={t(uiLanguage, "searchNotifications")}
          value={filters.notificationQuery}
          onChange={(value) => onFiltersChange({ notificationQuery: value })}
        />
        <div>
          <p className="text-sm font-medium text-stone-700">{t(uiLanguage, "notificationStatusFilter")}</p>
          <div
            className="mt-1 grid grid-cols-1 gap-1 rounded-lg bg-stone-100 p-1 sm:grid-cols-3"
            role="tablist"
            aria-label={t(uiLanguage, "notificationStatusFilter")}
          >
            {segmentOptions.map(([segment, label]) => (
              <button
                key={segment}
                type="button"
                role="tab"
                aria-selected={filters.notificationStatus === segment}
                onClick={() => onFiltersChange({ notificationStatus: segment })}
                className={`min-h-11 rounded-md px-2 py-2 text-sm font-semibold transition ${
                  filters.notificationStatus === segment
                    ? "bg-white text-emerald-950 shadow-sm"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-stone-700">
            {t(uiLanguage, "notificationPriorityFilter")}
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              value={filters.notificationPriority ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  notificationPriority:
                    event.target.value === ""
                      ? null
                      : (event.target.value as DashboardUrlState["notificationPriority"]),
                })
              }
            >
              {priorityOptions.map(([value, label]) => (
                <option key={value || "all"} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-stone-700">
            {t(uiLanguage, "notificationCategoryFilter")}
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              value={filters.notificationCategory ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  notificationCategory:
                    event.target.value === ""
                      ? null
                      : (event.target.value as DashboardUrlState["notificationCategory"]),
                })
              }
            >
              {categoryOptions.map(([value, label]) => (
                <option key={value || "all"} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canMutateReceipts && filters.notificationStatus === "unread" ? (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={isMarkingAllRead}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t(uiLanguage, "notificationMarkAllRead")}
          </button>
        ) : null}
      </div>

      {targetError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {targetError}. {t(uiLanguage, "notificationTargetErrorHint")}
        </div>
      ) : null}

      {mutationError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {mutationError}
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
          {Array.from({ length: NOTIFICATIONS_PANEL_SKELETON_ROW_COUNT }).map((_, index) => (
            <Stage4BNotificationRowSkeleton key={index} />
          ))}
        </ul>
      ) : showEmpty ? (
        <EmptyState title={t(uiLanguage, emptyState.titleKey)} message={t(uiLanguage, emptyState.messageKey)} />
      ) : (
        <>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
            {items.map((notification) => (
              <Stage4BNotificationRow
                key={notification.id}
                notification={notification}
                uiLanguage={uiLanguage}
                canMutateReceipts={canMutateReceipts}
                isAcknowledging={acknowledgingId === notification.id}
                isCompletingReview={completingReviewId === notification.id}
                onOpen={(item) => void handleOpenNotification(item)}
                onAcknowledge={(item) => void handleAcknowledge(item)}
                onCompleteReview={(item) => void handleCompleteReview(item)}
              />
            ))}
          </ul>
          {nextCursor ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? t(uiLanguage, "refreshInbox") : t(uiLanguage, "notificationsLoadMore")}
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
