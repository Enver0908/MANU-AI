"use client";

import { useMemo } from "react";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "@/lib/phase-85-stage-4b-contracts";
import type { DashboardSection, DashboardUrlState } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { useStage4BInbox } from "@/lib/use-stage-4b-inbox";
import type { SupportedLanguageCode } from "@/lib/languages";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";

export function InboxRoute({
  section,
  urlState,
  uiLanguage,
  dietitianId,
  role,
  activeClientIds,
  onFiltersChange,
  onOpenAlertTarget,
  onOpenNotificationTarget,
}: {
  section: Extract<DashboardSection, "alerts" | "notifications">;
  urlState: DashboardUrlState;
  uiLanguage: SupportedLanguageCode;
  dietitianId: string;
  role: "owner" | "admin" | "dietitian" | "assistant" | "auditor";
  activeClientIds: Set<string>;
  onFiltersChange: (patch: Partial<DashboardUrlState>) => void;
  onOpenAlertTarget: (alert: ClinicalAlertListItem) => void;
  onOpenNotificationTarget: (notification: SystemNotificationListItem) => void;
}) {
  const filters = useMemo(
    () => ({
      alertSeverity: urlState.alertSeverity,
      alertQuery: urlState.alertQuery,
      notificationStatus: urlState.notificationStatus,
      notificationPriority: urlState.notificationPriority,
      notificationCategory: urlState.notificationCategory,
      notificationQuery: urlState.notificationQuery,
    }),
    [
      urlState.alertQuery,
      urlState.alertSeverity,
      urlState.notificationCategory,
      urlState.notificationPriority,
      urlState.notificationQuery,
      urlState.notificationStatus,
    ],
  );
  const inbox = useStage4BInbox(filters, { surface: section });

  if (section === "alerts") {
    return (
      <AlertsPanel
        uiLanguage={uiLanguage}
        filters={urlState}
        items={inbox.alertItems}
        counts={inbox.alerts?.counts ?? null}
        filteredTotal={inbox.alerts?.filteredTotal ?? 0}
        nextCursor={inbox.alertsNextCursor}
        error={inbox.alertsError}
        isRefreshing={inbox.isRefreshing}
        isLoadingMore={inbox.isLoadingMoreAlerts}
        lastSuccessAt={inbox.lastSuccessAt}
        onFiltersChange={onFiltersChange}
        onRefresh={() => void inbox.refresh({ resetBackoff: true })}
        onLoadMore={() => void inbox.loadMoreAlerts()}
        onOpenAlertTarget={onOpenAlertTarget}
      />
    );
  }

  return (
    <NotificationsPanel
      uiLanguage={uiLanguage}
      filters={urlState}
      items={inbox.notificationItems}
      counts={inbox.notifications?.counts ?? null}
      filteredTotal={inbox.notifications?.filteredTotal ?? 0}
      nextCursor={inbox.notificationsNextCursor}
      error={inbox.notificationsError}
      isRefreshing={inbox.isRefreshing}
      isLoadingMore={inbox.isLoadingMoreNotifications}
      lastSuccessAt={inbox.lastSuccessAt}
      actorContext={{ role, dietitianId }}
      activeClientIds={activeClientIds}
      onFiltersChange={onFiltersChange}
      onRefresh={() => void inbox.refresh({ resetBackoff: true })}
      onLoadMore={() => void inbox.loadMoreNotifications()}
      onOpenNotificationTarget={onOpenNotificationTarget}
      onReceiptMutated={(payload) => inbox.applyNotificationMutation(payload)}
      onReadAllMutated={(payload) => inbox.applyNotificationReadAll(payload)}
    />
  );
}
