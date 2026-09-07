"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ClinicalAlertListItem,
  ClinicalAlertsListResponse,
  Stage4BNotificationMutationResponse,
  Stage4BNotificationReadAllResponse,
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
  applyStage4BNotificationReadAllToItems,
  mergeStage4BNotificationMutationIntoItems,
} from "./notifications-panel-helpers";
import {
  createStage4BInboxRequestGate,
  mergeStage4BInboxPageItems,
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

async function requestJson<T>(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`stage_4b_inbox_request_failed_${response.status}`);
  }
  return (await response.json()) as T;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
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
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const alertsOwnerKey = buildStage4BAlertsRequestQuery(filters).toString();
  const notificationsOwnerKey = buildStage4BNotificationsRequestQuery(filters).toString();
  const alertsGateRef = useRef(createStage4BInboxRequestGate(alertsOwnerKey));
  const notificationsGateRef = useRef(createStage4BInboxRequestGate(notificationsOwnerKey));
  const alertsAbortRef = useRef<AbortController | null>(null);
  const notificationsAbortRef = useRef<AbortController | null>(null);
  const alertsOperationRef = useRef<number | null>(null);
  const notificationsOperationRef = useRef<number | null>(null);
  const refreshSequenceRef = useRef(0);

  const applyAlertsResponse = useCallback((payload: ClinicalAlertsListResponse, append: boolean) => {
    setAlerts(payload);
    setAlertItems((current) => (append ? mergeStage4BInboxPageItems(current, payload.items) : payload.items));
    setAlertsNextCursor(payload.nextCursor);
  }, []);

  const applyNotificationsResponse = useCallback((payload: SystemNotificationsListResponse, append: boolean) => {
    setNotifications(payload);
    setNotificationItems((current) =>
      append ? mergeStage4BInboxPageItems(current, payload.items) : payload.items,
    );
    setNotificationsNextCursor(payload.nextCursor);
  }, []);

  const fetchAlertsPage = useCallback(
    async (cursor?: string | null, append = false) => {
      const query = buildStage4BAlertsRequestQuery(filters, { cursor }).toString();
      alertsAbortRef.current?.abort();
      const controller = new AbortController();
      alertsAbortRef.current = controller;
      const token = alertsGateRef.current.begin(alertsOwnerKey);
      alertsOperationRef.current = token.sequence;
      try {
        const payload = await requestJson<ClinicalAlertsListResponse>(`/api/alerts?${query}`, controller.signal);
        if (!mountedRef.current || controller.signal.aborted || !alertsGateRef.current.canApply(token)) {
          return { payload, applied: false };
        }
        applyAlertsResponse(payload, append);
        setAlertsError(null);
        return { payload, applied: true };
      } finally {
        if (alertsOperationRef.current === token.sequence) alertsOperationRef.current = null;
      }
    },
    [alertsOwnerKey, applyAlertsResponse, filters],
  );

  const fetchNotificationsPage = useCallback(
    async (cursor?: string | null, append = false) => {
      const query = buildStage4BNotificationsRequestQuery(filters, { cursor }).toString();
      notificationsAbortRef.current?.abort();
      const controller = new AbortController();
      notificationsAbortRef.current = controller;
      const token = notificationsGateRef.current.begin(notificationsOwnerKey);
      notificationsOperationRef.current = token.sequence;
      try {
        const payload = await requestJson<SystemNotificationsListResponse>(
          `/api/notifications?${query}`,
          controller.signal,
        );
        if (!mountedRef.current || controller.signal.aborted || !notificationsGateRef.current.canApply(token)) {
          return { payload, applied: false };
        }
        applyNotificationsResponse(payload, append);
        setNotificationsError(null);
        return { payload, applied: true };
      } finally {
        if (notificationsOperationRef.current === token.sequence) notificationsOperationRef.current = null;
      }
    },
    [applyNotificationsResponse, filters, notificationsOwnerKey],
  );

  const refresh = useCallback(
    async (options?: { resetBackoff?: boolean }) => {
      const refreshSequence = ++refreshSequenceRef.current;
      if (options?.resetBackoff) {
        consecutiveErrorsRef.current = 0;
      }
      setIsRefreshing(true);
      try {
        const [alertsResult, notificationsResult] = await Promise.allSettled([
          fetchAlertsPage(null, false),
          fetchNotificationsPage(null, false),
        ]);

        if (!mountedRef.current || refreshSequence !== refreshSequenceRef.current) return;

        let hadError = false;
        if (alertsResult.status === "rejected" && !isAbortError(alertsResult.reason)) {
          hadError = true;
          setAlertsError(alertsResult.reason instanceof Error ? alertsResult.reason.message : "alerts_refresh_failed");
        }

        if (notificationsResult.status === "fulfilled") {
          if (notificationsResult.value.applied) setNotificationsError(null);
        } else if (!isAbortError(notificationsResult.reason)) {
          hadError = true;
          setNotificationsError(
            notificationsResult.reason instanceof Error
              ? notificationsResult.reason.message
              : "notifications_refresh_failed",
          );
        }

        const fullyApplied =
          alertsResult.status === "fulfilled" &&
          alertsResult.value.applied &&
          notificationsResult.status === "fulfilled" &&
          notificationsResult.value.applied;
        if (hadError) {
          consecutiveErrorsRef.current += 1;
        } else if (fullyApplied) {
          consecutiveErrorsRef.current = 0;
          setLastSuccessAt(new Date().toISOString());
        }
      } finally {
        if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [fetchAlertsPage, fetchNotificationsPage],
  );

  const loadMoreAlerts = useCallback(async () => {
    if (!alertsNextCursor || isLoadingMoreAlerts || alertsOperationRef.current != null) return;
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
    if (!notificationsNextCursor || isLoadingMoreNotifications || notificationsOperationRef.current != null) return;
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

  const applyNotificationMutation = useCallback((payload: Stage4BNotificationMutationResponse) => {
    notificationsGateRef.current.invalidateForMutation();
    notificationsAbortRef.current?.abort();
    notificationsOperationRef.current = null;
    setNotificationItems((current) => mergeStage4BNotificationMutationIntoItems(current, payload));
    setNotifications((current) => (current ? { ...current, counts: payload.counts } : current));
  }, []);

  const applyNotificationReadAll = useCallback((payload: Stage4BNotificationReadAllResponse) => {
    notificationsGateRef.current.invalidateForMutation();
    notificationsAbortRef.current?.abort();
    notificationsOperationRef.current = null;
    const readAt = payload.generatedAt;
    setNotificationItems((current) => applyStage4BNotificationReadAllToItems(current, payload, readAt));
    setNotifications((current) => (current ? { ...current, counts: payload.counts } : current));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      alertsAbortRef.current?.abort();
      notificationsAbortRef.current?.abort();
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    alertsGateRef.current.setOwner(alertsOwnerKey);
    alertsAbortRef.current?.abort();
    alertsOperationRef.current = null;
    setAlerts(null);
    setAlertItems([]);
    setAlertsNextCursor(null);
    setAlertsError(null);
    setIsLoadingMoreAlerts(false);
  }, [alertsOwnerKey]);

  useLayoutEffect(() => {
    notificationsGateRef.current.setOwner(notificationsOwnerKey);
    notificationsAbortRef.current?.abort();
    notificationsOperationRef.current = null;
    setNotifications(null);
    setNotificationItems([]);
    setNotificationsNextCursor(null);
    setNotificationsError(null);
    setIsLoadingMoreNotifications(false);
  }, [notificationsOwnerKey]);

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
    applyNotificationMutation,
    applyNotificationReadAll,
    loadMoreAlerts,
    loadMoreNotifications,
  };
}
