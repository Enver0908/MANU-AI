"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClinicalAlertListItem,
  ClinicalAlertsListResponse,
  SystemNotificationListItem,
  SystemNotificationsListResponse,
} from "./phase-85-stage-4b-contracts";
import {
  buildStage4BAlertsRequestQuery,
  buildStage4BNotificationsRequestQuery,
  resolveAlertsBadgeCount,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  fetchWithInflightDedupe,
  resolveStage4BInboxPollDelayMs,
  shouldPauseStage4BInboxPolling,
} from "./phase-85-stage-4b-inbox-scheduler";

export type Stage4BInboxSnapshot = {
  alerts: ClinicalAlertsListResponse | null;
  alertItems: ClinicalAlertListItem[];
  alertsNextCursor: string | null;
  notifications: SystemNotificationsListResponse | null;
  notificationItems: SystemNotificationListItem[];
  notificationsNextCursor: string | null;
  alertsError: string | null;
  notificationsError: string | null;
  isRefreshing: boolean;
  isLoadingMoreAlerts: boolean;
  isLoadingMoreNotifications: boolean;
  lastSuccessAt: string | null;
  alertsBadgeCount: number;
  notificationsBadgeCount: number;
};

async function requestJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`stage_4b_inbox_request_failed_${response.status}`);
  }
  return (await response.json()) as T;
}

export function useStage4BInbox(filters: Pick<
  DashboardUrlState,
  | "alertSeverity"
  | "alertQuery"
  | "notificationStatus"
  | "notificationPriority"
  | "notificationCategory"
  | "notificationQuery"
>) {
  const [alerts, setAlerts] = useState<ClinicalAlertsListResponse | null>(null);
  const [alertItems, setAlertItems] = useState<ClinicalAlertListItem[]>([]);
  const [alertsNextCursor, setAlertsNextCursor] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<SystemNotificationsListResponse | null>(null);
  const [notificationItems, setNotificationItems] = useState<SystemNotificationListItem[]>([]);
  const [notificationsNextCursor, setNotificationsNextCursor] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMoreAlerts, setIsLoadingMoreAlerts] = useState(false);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const alertsInflightRef = useRef(new Map<string, Promise<ClinicalAlertsListResponse>>());
  const notificationsInflightRef = useRef(new Map<string, Promise<SystemNotificationsListResponse>>());
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const applyAlertsResponse = useCallback((payload: ClinicalAlertsListResponse, append: boolean) => {
    setAlerts(payload);
    setAlertItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setAlertsNextCursor(payload.nextCursor);
  }, []);

  const applyNotificationsResponse = useCallback((payload: SystemNotificationsListResponse, append: boolean) => {
    setNotifications(payload);
    setNotificationItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setNotificationsNextCursor(payload.nextCursor);
  }, []);

  const fetchAlertsPage = useCallback(
    async (cursor?: string | null, append = false) => {
      const query = buildStage4BAlertsRequestQuery(filters, { cursor }).toString();
      const payload = await fetchWithInflightDedupe<ClinicalAlertsListResponse>(
        alertsInflightRef.current,
        `alerts:${query}`,
        () => requestJson<ClinicalAlertsListResponse>(`/api/alerts?${query}`),
      );
      if (!mountedRef.current) return payload;
      applyAlertsResponse(payload, append);
      setAlertsError(null);
      return payload;
    },
    [applyAlertsResponse, filters],
  );

  const fetchNotificationsPage = useCallback(
    async (cursor?: string | null, append = false) => {
      const query = buildStage4BNotificationsRequestQuery(filters, { cursor }).toString();
      const payload = await fetchWithInflightDedupe<SystemNotificationsListResponse>(
        notificationsInflightRef.current,
        `notifications:${query}`,
        () => requestJson<SystemNotificationsListResponse>(`/api/notifications?${query}`),
      );
      if (!mountedRef.current) return payload;
      applyNotificationsResponse(payload, append);
      setNotificationsError(null);
      return payload;
    },
    [applyNotificationsResponse, filters],
  );

  const refresh = useCallback(
    async (options?: { resetBackoff?: boolean }) => {
      if (options?.resetBackoff) {
        consecutiveErrorsRef.current = 0;
      }
      setIsRefreshing(true);
      try {
        const [alertsResult, notificationsResult] = await Promise.allSettled([
          fetchAlertsPage(null, false),
          fetchNotificationsPage(null, false),
        ]);

        if (!mountedRef.current) return;

        let hadError = false;
        if (alertsResult.status === "rejected") {
          hadError = true;
          setAlertsError(alertsResult.reason instanceof Error ? alertsResult.reason.message : "alerts_refresh_failed");
        }

        if (notificationsResult.status === "fulfilled") {
          setNotificationsError(null);
        } else {
          hadError = true;
          setNotificationsError(
            notificationsResult.reason instanceof Error
              ? notificationsResult.reason.message
              : "notifications_refresh_failed",
          );
        }

        if (hadError) {
          consecutiveErrorsRef.current += 1;
        } else {
          consecutiveErrorsRef.current = 0;
          setLastSuccessAt(new Date().toISOString());
        }
      } finally {
        if (mountedRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [fetchAlertsPage, fetchNotificationsPage],
  );

  const loadMoreAlerts = useCallback(async () => {
    if (!alertsNextCursor || isLoadingMoreAlerts) return;
    setIsLoadingMoreAlerts(true);
    try {
      await fetchAlertsPage(alertsNextCursor, true);
    } catch (error) {
      if (mountedRef.current) {
        setAlertsError(error instanceof Error ? error.message : "alerts_load_more_failed");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMoreAlerts(false);
      }
    }
  }, [alertsNextCursor, fetchAlertsPage, isLoadingMoreAlerts]);

  const loadMoreNotifications = useCallback(async () => {
    if (!notificationsNextCursor || isLoadingMoreNotifications) return;
    setIsLoadingMoreNotifications(true);
    try {
      await fetchNotificationsPage(notificationsNextCursor, true);
    } catch (error) {
      if (mountedRef.current) {
        setNotificationsError(error instanceof Error ? error.message : "notifications_load_more_failed");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMoreNotifications(false);
      }
    }
  }, [fetchNotificationsPage, isLoadingMoreNotifications, notificationsNextCursor]);

  const refreshAfterMutation = useCallback(() => {
    void refresh({ resetBackoff: true });
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh({ resetBackoff: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    const schedule = () => {
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
      if (shouldPauseStage4BInboxPolling(document.visibilityState === "visible")) {
        return;
      }
      const delay = resolveStage4BInboxPollDelayMs(consecutiveErrorsRef.current);
      pollTimerRef.current = window.setTimeout(() => {
        void refresh().finally(schedule);
      }, delay);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
      schedule();
    };

    const onFocus = () => {
      void refresh();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    return () => {
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const snapshot = useMemo<Stage4BInboxSnapshot>(
    () => ({
      alerts,
      alertItems,
      alertsNextCursor,
      notifications,
      notificationItems,
      notificationsNextCursor,
      alertsError,
      notificationsError,
      isRefreshing,
      isLoadingMoreAlerts,
      isLoadingMoreNotifications,
      lastSuccessAt,
      alertsBadgeCount: resolveAlertsBadgeCount(alerts?.counts),
      notificationsBadgeCount: notifications?.counts.unread ?? 0,
    }),
    [
      alertItems,
      alerts,
      alertsError,
      alertsNextCursor,
      isLoadingMoreAlerts,
      isLoadingMoreNotifications,
      isRefreshing,
      lastSuccessAt,
      notificationItems,
      notifications,
      notificationsError,
      notificationsNextCursor,
    ],
  );

  return {
    ...snapshot,
    refresh,
    refreshAfterMutation,
    loadMoreAlerts,
    loadMoreNotifications,
  };
}
