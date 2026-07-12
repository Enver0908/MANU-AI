"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppRequestError } from "./app-errors";
import type {
  ConversationDetailResponse,
  ConversationInboxItem,
  ConversationListResponse,
  ConversationMessageDto,
  ConversationMutationResponse,
  ConversationPermissions,
} from "./phase-85-stage-4b2-contracts";
import { mergeConversationDetailMessages } from "./conversation-detail-helpers";
import {
  buildStage4B2ConversationDetailRequestQuery,
  buildStage4B2ConversationsRequestQuery,
  resolveMessagingUnreadBadgeCount,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  resolveStage4B2MessagingPollDelayMs,
  shouldPauseStage4B2MessagingPolling,
} from "./phase-85-stage-4b2-messaging-scheduler";
import { fetchWithInflightDedupe } from "./phase-85-stage-4b-inbox-scheduler";
import { mergeConversationDetailResponseIntoAppState } from "./phase-85-stage-4b2-state-merge";
import type { ManuAppState } from "./types";

export type Stage4B2MessagingSnapshot = {
  list: ConversationListResponse | null;
  listItems: ConversationInboxItem[];
  listNextCursor: string | null;
  detail: ConversationDetailResponse | null;
  detailMessages: ConversationMessageDto[];
  permissions: ConversationPermissions | null;
  listError: string | null;
  detailError: string | null;
  isListRefreshing: boolean;
  isDetailRefreshing: boolean;
  isLoadingMoreList: boolean;
  isLoadingOlderMessages: boolean;
  isLoadingNewerMessages: boolean;
  lastSuccessAt: string | null;
  messagingBadgeCount: number;
};

type UseStage4B2MessagingOptions = {
  enabled: boolean;
  conversationId: string | null;
  anchorMessageId?: string | null;
  filters: Pick<DashboardUrlState, "conversationStatus" | "conversationQuery">;
  mergeDetailIntoState: (detail: ConversationDetailResponse) => ManuAppState;
  mergeMutationIntoState: (mutation: ConversationMutationResponse) => ManuAppState;
};

async function requestJson<T>(url: string, init?: RequestInit, signal?: AbortSignal) {
  const response = await fetch(url, {
    ...init,
    signal,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let code = `request_failed_${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      // ignore parse errors
    }
    throw new AppRequestError(response.status, code);
  }
  return (await response.json()) as T;
}

export function useStage4B2Messaging({
  enabled,
  conversationId,
  anchorMessageId = null,
  filters,
  mergeDetailIntoState,
  mergeMutationIntoState,
}: UseStage4B2MessagingOptions) {
  const [list, setList] = useState<ConversationListResponse | null>(null);
  const [listItems, setListItems] = useState<ConversationInboxItem[]>([]);
  const [listNextCursor, setListNextCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [detailMessages, setDetailMessages] = useState<ConversationMessageDto[]>([]);
  const [permissions, setPermissions] = useState<ConversationPermissions | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [isLoadingMoreList, setIsLoadingMoreList] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isLoadingNewerMessages, setIsLoadingNewerMessages] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const listInflightRef = useRef(new Map<string, Promise<ConversationListResponse>>());
  const detailInflightRef = useRef(new Map<string, Promise<ConversationDetailResponse>>());
  const markReadInflightRef = useRef(new Map<string, Promise<ConversationMutationResponse>>());
  const pollTimerRef = useRef<number | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const paginationAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const detailRenderedRef = useRef(false);
  const pendingMarkReadSequenceRef = useRef<number | null>(null);

  const applyListResponse = useCallback((payload: ConversationListResponse, append: boolean) => {
    setList(payload);
    setListItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setListNextCursor(payload.nextCursor);
  }, []);

  const applyDetailResponse = useCallback(
    (payload: ConversationDetailResponse, mergeMode: "replace" | "older" | "newer" = "replace") => {
      setDetail(payload);
      setPermissions(payload.permissions);
      setDetailMessages((current) => {
        const merged =
          mergeMode === "replace"
            ? payload.messages
            : mergeConversationDetailMessages(current, payload.messages, mergeMode);
        pendingMarkReadSequenceRef.current = merged.reduce(
          (max, message) => Math.max(max, message.conversationSequence ?? 0),
          0,
        );
        return merged;
      });
      mergeDetailIntoState(payload);
      detailRenderedRef.current = false;
    },
    [mergeDetailIntoState],
  );

  const fetchDetailPage = useCallback(
    async (
      targetConversationId: string,
      options?: {
        anchorMessageId?: string | null;
        direction?: "older" | "newer";
        cursor?: string | null;
        mergeMode?: "replace" | "older" | "newer";
        abortController?: AbortController;
      },
    ) => {
      const controller = options?.abortController ?? new AbortController();
      if (!options?.abortController) {
        detailAbortRef.current?.abort();
        detailAbortRef.current = controller;
      }
      const query = buildStage4B2ConversationDetailRequestQuery({
        anchorMessageId: options?.anchorMessageId ?? anchorMessageId,
        direction: options?.direction,
        cursor: options?.cursor,
        limit: 50,
      }).toString();
      const payload = await fetchWithInflightDedupe<ConversationDetailResponse>(
        detailInflightRef.current,
        `conversation-detail:${targetConversationId}:${query}`,
        () =>
          requestJson<ConversationDetailResponse>(
            `/api/conversations/${encodeURIComponent(targetConversationId)}/messages?${query}`,
            undefined,
            controller.signal,
          ),
      );
      if (!mountedRef.current || controller.signal.aborted) return payload;
      applyDetailResponse(payload, options?.mergeMode ?? "replace");
      setDetailError(null);
      return payload;
    },
    [anchorMessageId, applyDetailResponse],
  );

  const fetchListPage = useCallback(
    async (cursor?: string | null, append = false) => {
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;
      const query = buildStage4B2ConversationsRequestQuery(filters, { cursor }).toString();
      const payload = await fetchWithInflightDedupe<ConversationListResponse>(
        listInflightRef.current,
        `conversations:${query}`,
        () => requestJson<ConversationListResponse>(`/api/conversations?${query}`, undefined, controller.signal),
      );
      if (!mountedRef.current || controller.signal.aborted) return payload;
      applyListResponse(payload, append);
      setListError(null);
      return payload;
    },
    [applyListResponse, filters.conversationQuery, filters.conversationStatus],
  );

  const fetchDetail = useCallback(
    async (targetConversationId: string, options?: { anchorMessageId?: string | null }) => {
      return fetchDetailPage(targetConversationId, {
        anchorMessageId: options?.anchorMessageId ?? anchorMessageId,
        mergeMode: "replace",
      });
    },
    [anchorMessageId, fetchDetailPage],
  );

  const markReadThroughSequence = useCallback(
    async (targetConversationId: string, throughSequence: number) => {
      const currentReceiptSequence = detail?.receipt?.lastReadSequence ?? 0;
      if (throughSequence <= currentReceiptSequence) return null;
      const payload = await fetchWithInflightDedupe(
        markReadInflightRef.current,
        `mark-read:${targetConversationId}:${throughSequence}`,
        () =>
          requestJson<ConversationMutationResponse>(`/api/conversations/${encodeURIComponent(targetConversationId)}/read`, {
            method: "POST",
            body: JSON.stringify({ throughSequence }),
          }),
      );
      if (!mountedRef.current) return payload;
      mergeMutationIntoState(payload);
      setDetail((current) =>
        current && current.conversation.id === targetConversationId
          ? {
              ...current,
              receipt: payload.receipt,
              unreadCount: payload.unreadCount,
              permissions: payload.permissions,
            }
          : current,
      );
      return payload;
    },
    [detail?.receipt?.lastReadSequence, mergeMutationIntoState],
  );

  const refreshList = useCallback(
    async (options?: { resetBackoff?: boolean }) => {
      if (!enabled) return;
      if (options?.resetBackoff) consecutiveErrorsRef.current = 0;
      setIsListRefreshing(true);
      try {
        await fetchListPage(null, false);
        consecutiveErrorsRef.current = 0;
        setLastSuccessAt(new Date().toISOString());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        consecutiveErrorsRef.current += 1;
        setListError(error instanceof Error ? error.message : "conversation_list_refresh_failed");
      } finally {
        if (mountedRef.current) setIsListRefreshing(false);
      }
    },
    [enabled, fetchListPage],
  );

  const refreshDetail = useCallback(
    async (options?: { resetBackoff?: boolean; anchorMessageId?: string | null }) => {
      if (!enabled || !conversationId) return;
      if (options?.resetBackoff) consecutiveErrorsRef.current = 0;
      setIsDetailRefreshing(true);
      try {
        await fetchDetail(conversationId, { anchorMessageId: options?.anchorMessageId ?? anchorMessageId });
        consecutiveErrorsRef.current = 0;
        setLastSuccessAt(new Date().toISOString());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        consecutiveErrorsRef.current += 1;
        setDetailError(error instanceof Error ? error.message : "conversation_detail_refresh_failed");
        throw error;
      } finally {
        if (mountedRef.current) setIsDetailRefreshing(false);
      }
    },
    [anchorMessageId, conversationId, enabled, fetchDetail],
  );

  const refreshAll = useCallback(
    async (options?: { resetBackoff?: boolean; anchorMessageId?: string | null }) => {
      await Promise.allSettled([
        refreshList(options),
        conversationId ? refreshDetail(options) : Promise.resolve(),
      ]);
    },
    [conversationId, refreshDetail, refreshList],
  );

  const refreshAfterMutation = useCallback(
    async (options?: { anchorMessageId?: string | null }) => {
      await refreshAll({ resetBackoff: true, anchorMessageId: options?.anchorMessageId });
    },
    [refreshAll],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !detail?.pagination.hasOlder || isLoadingOlderMessages) return;
    paginationAbortRef.current?.abort();
    const controller = new AbortController();
    paginationAbortRef.current = controller;
    setIsLoadingOlderMessages(true);
    try {
      await fetchDetailPage(conversationId, {
        direction: "older",
        cursor: detail.pagination.olderCursor,
        mergeMode: "older",
        abortController: controller,
      });
    } catch (error) {
      if (mountedRef.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setDetailError(error instanceof Error ? error.message : "conversation_detail_load_older_failed");
      }
    } finally {
      if (mountedRef.current) setIsLoadingOlderMessages(false);
    }
  }, [conversationId, detail, fetchDetailPage, isLoadingOlderMessages]);

  const loadNewerMessages = useCallback(async () => {
    if (!conversationId || !detail?.pagination.hasNewer || isLoadingNewerMessages) return;
    paginationAbortRef.current?.abort();
    const controller = new AbortController();
    paginationAbortRef.current = controller;
    setIsLoadingNewerMessages(true);
    try {
      await fetchDetailPage(conversationId, {
        direction: "newer",
        cursor: detail.pagination.newerCursor,
        mergeMode: "newer",
        abortController: controller,
      });
    } catch (error) {
      if (mountedRef.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setDetailError(error instanceof Error ? error.message : "conversation_detail_load_newer_failed");
      }
    } finally {
      if (mountedRef.current) setIsLoadingNewerMessages(false);
    }
  }, [conversationId, detail, fetchDetailPage, isLoadingNewerMessages]);

  const loadMoreList = useCallback(async () => {
    if (!listNextCursor || isLoadingMoreList) return;
    setIsLoadingMoreList(true);
    try {
      await fetchListPage(listNextCursor, true);
    } catch (error) {
      if (mountedRef.current) {
        setListError(error instanceof Error ? error.message : "conversation_list_load_more_failed");
      }
    } finally {
      if (mountedRef.current) setIsLoadingMoreList(false);
    }
  }, [fetchListPage, isLoadingMoreList, listNextCursor]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listAbortRef.current?.abort();
      detailAbortRef.current?.abort();
      paginationAbortRef.current?.abort();
      if (pollTimerRef.current != null) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => {
      void refreshAll({ resetBackoff: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [enabled, refreshAll, filters.conversationStatus, filters.conversationQuery, conversationId, anchorMessageId]);

  useEffect(() => {
    if (!enabled) return;
    const schedule = () => {
      if (pollTimerRef.current != null) window.clearTimeout(pollTimerRef.current);
      if (shouldPauseStage4B2MessagingPolling(document.visibilityState === "visible")) return;
      const delay = resolveStage4B2MessagingPollDelayMs(
        consecutiveErrorsRef.current,
        Boolean(conversationId),
      );
      pollTimerRef.current = window.setTimeout(() => {
        void refreshAll().finally(schedule);
      }, delay);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshAll();
      schedule();
    };
    const onFocus = () => {
      void refreshAll({ resetBackoff: true });
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    return () => {
      if (pollTimerRef.current != null) window.clearTimeout(pollTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [conversationId, enabled, refreshAll]);

  useEffect(() => {
    if (!enabled || !conversationId || !detail) return;
    const frame = window.requestAnimationFrame(() => {
      detailRenderedRef.current = true;
      const throughSequence = pendingMarkReadSequenceRef.current;
      if (!throughSequence || throughSequence < 1) return;
      void markReadThroughSequence(conversationId, throughSequence).catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, detail, enabled, markReadThroughSequence]);

  const snapshot = useMemo<Stage4B2MessagingSnapshot>(
    () => ({
      list,
      listItems,
      listNextCursor,
      detail: detail && detail.conversation.id === conversationId ? detail : null,
      detailMessages: detail && detail.conversation.id === conversationId ? detailMessages : [],
      permissions: detail && detail.conversation.id === conversationId ? permissions : null,
      listError,
      detailError,
      isListRefreshing,
      isDetailRefreshing,
      isLoadingMoreList,
      isLoadingOlderMessages,
      isLoadingNewerMessages,
      lastSuccessAt,
      messagingBadgeCount: resolveMessagingUnreadBadgeCount(listItems),
    }),
    [
      conversationId,
      detail,
      detailError,
      detailMessages,
      isDetailRefreshing,
      isListRefreshing,
      isLoadingMoreList,
      isLoadingOlderMessages,
      isLoadingNewerMessages,
      lastSuccessAt,
      list,
      listError,
      listItems,
      listNextCursor,
      permissions,
    ],
  );

  return {
    ...snapshot,
    refreshList,
    refreshDetail,
    refreshAll,
    refreshAfterMutation,
    loadMoreList,
    loadOlderMessages,
    loadNewerMessages,
    markReadThroughSequence,
    isRequestError: (error: unknown): error is AppRequestError => error instanceof AppRequestError,
  };
}

export { mergeConversationDetailResponseIntoAppState };
