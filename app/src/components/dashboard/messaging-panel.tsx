"use client";

import type { ReactNode } from "react";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import type { ConversationInboxItem } from "@/lib/phase-85-stage-4b2-contracts";
import type { ConversationListStatus } from "@/lib/phase-85-stage-4b2-contracts";
import type { DashboardUrlState } from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  buildConversationStatusSegmentLabel,
  MESSAGING_PANEL_LIST_WIDTH_CLASS,
  MESSAGING_PANEL_SKELETON_ROW_COUNT,
  resolveMessagingEmptyStateKeys,
} from "@/lib/messaging-panel-helpers";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextInput } from "./shared";
import { EmptyState } from "./state-primitives";
import { ConversationListRow, ConversationListRowSkeleton } from "./conversation-list-row";

export function MessagingPanel({
  uiLanguage,
  filters,
  items,
  filteredTotal,
  unreadConversationCount,
  unreadMessageCount,
  nextCursor,
  listError,
  detailError,
  isListRefreshing,
  isDetailRefreshing,
  isLoadingMore,
  lastSuccessAt,
  selectedConversationId,
  onFiltersChange,
  onRefreshList,
  onLoadMore,
  onSelectConversation,
  onBackToList,
  detail,
  detailUnavailable,
}: {
  uiLanguage: SupportedLanguageCode;
  filters: Pick<DashboardUrlState, "conversationStatus" | "conversationQuery">;
  items: ConversationInboxItem[];
  filteredTotal: number;
  unreadConversationCount: number;
  unreadMessageCount: number;
  nextCursor: string | null;
  listError: string | null;
  detailError: string | null;
  isListRefreshing: boolean;
  isDetailRefreshing: boolean;
  isLoadingMore: boolean;
  lastSuccessAt: string | null;
  selectedConversationId: string | null;
  onFiltersChange: (patch: Partial<DashboardUrlState>) => void;
  onRefreshList: () => void;
  onLoadMore: () => void;
  onSelectConversation: (item: ConversationInboxItem) => void;
  onBackToList: () => void;
  detail: ReactNode;
  detailUnavailable?: boolean;
}) {
  const statusLabels: Record<ConversationListStatus, string> = {
    all: t(uiLanguage, "filterAll"),
    unread: t(uiLanguage, "filterUnread"),
  };
  const statusOptions: Array<[ConversationListStatus, string]> = (["all", "unread"] as const).map((segment) => [
    segment,
    buildConversationStatusSegmentLabel(
      segment,
      { all: filteredTotal, unread: unreadConversationCount },
      statusLabels,
    ),
  ]);
  const emptyState = resolveMessagingEmptyStateKeys(filters.conversationStatus, filters.conversationQuery);
  const showInitialLoading = isListRefreshing && items.length === 0;
  const showInitialError = Boolean(listError) && items.length === 0 && !showInitialLoading;
  const showEmpty = !showInitialLoading && !showInitialError && items.length === 0;
  const showListOnMobile = !selectedConversationId;
  const showDetailOnMobile = Boolean(selectedConversationId);

  const listPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 space-y-3 border-b border-stone-200 bg-stone-50/95 pb-3 pt-1 backdrop-blur-sm">
        <TextInput
          label={t(uiLanguage, "searchConversations")}
          value={filters.conversationQuery}
          onChange={(value) => onFiltersChange({ conversationQuery: value })}
        />
        <div>
          <p className="text-sm font-medium text-stone-700">{t(uiLanguage, "conversationStatusFilter")}</p>
          <div
            className="mt-1 grid grid-cols-1 gap-1 rounded-lg bg-stone-100 p-1 sm:grid-cols-2"
            role="tablist"
            aria-label={t(uiLanguage, "conversationStatusFilter")}
          >
            {statusOptions.map(([segment, label]) => (
              <button
                key={segment}
                type="button"
                role="tab"
                aria-selected={filters.conversationStatus === segment}
                onClick={() => onFiltersChange({ conversationStatus: segment })}
                className={`min-h-11 rounded-md px-2 py-2 text-sm font-semibold transition ${
                  filters.conversationStatus === segment
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

      {listError && items.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t(uiLanguage, "inboxRefreshError")} ({listError})
        </div>
      ) : null}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {showInitialError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-semibold text-red-950">{t(uiLanguage, "inboxRefreshError")}</p>
            <p className="mt-1 text-sm text-red-900">{listError}</p>
            <button
              type="button"
              onClick={onRefreshList}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            >
              <RefreshCcw size={16} />
              {t(uiLanguage, "refreshInbox")}
            </button>
          </div>
        ) : showInitialLoading ? (
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
            {Array.from({ length: MESSAGING_PANEL_SKELETON_ROW_COUNT }).map((_, index) => (
              <ConversationListRowSkeleton key={index} />
            ))}
          </ul>
        ) : showEmpty ? (
          <EmptyState title={t(uiLanguage, emptyState.titleKey)} message={t(uiLanguage, emptyState.messageKey)} />
        ) : (
          <>
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {items.map((item) => (
                <ConversationListRow
                  key={item.id}
                  item={item}
                  uiLanguage={uiLanguage}
                  isActive={item.id === selectedConversationId}
                  onOpen={onSelectConversation}
                />
              ))}
            </ul>
            {nextCursor ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="mt-3 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? t(uiLanguage, "refreshInbox") : t(uiLanguage, "messagingLoadMore")}
              </button>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-3 shrink-0 text-xs text-stone-500">
        {t(uiLanguage, "inboxFilteredTotal")}: {filteredTotal} · {t(uiLanguage, "filterUnread")}: {unreadMessageCount}
        {lastSuccessAt ? ` · ${t(uiLanguage, "inboxLastRefresh")}: ${new Date(lastSuccessAt).toLocaleString("tr-TR")}` : ""}
      </p>
    </div>
  );

  const detailPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {selectedConversationId ? (
        <div className="mb-3 flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            aria-label={t(uiLanguage, "messagingBackToList")}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-stone-800">{t(uiLanguage, "messagingBackToList")}</span>
        </div>
      ) : null}

      {detailError ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {t(uiLanguage, "inboxRefreshError")} ({detailError})
        </div>
      ) : null}

      {detailUnavailable ? (
        <EmptyState
          title={t(uiLanguage, "messagesTargetMissing")}
          message={t(uiLanguage, "messagesTargetMissingHint")}
        />
      ) : selectedConversationId && isDetailRefreshing && !detail ? (
        <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600" aria-busy="true">
          {t(uiLanguage, "refreshInbox")}
        </div>
      ) : selectedConversationId && detail ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{detail}</div>
      ) : (
        <EmptyState
          title={t(uiLanguage, "messagingSelectConversation")}
          message={t(uiLanguage, "messagingSelectConversationHint")}
        />
      )}
    </div>
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="messaging-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(uiLanguage, "conversation")}</h2>
          <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "messagingSectionSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onRefreshList}
          disabled={isListRefreshing}
          aria-label={t(uiLanguage, "refreshInbox")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw size={16} className={isListRefreshing ? "animate-spin" : undefined} />
          {t(uiLanguage, "refreshInbox")}
        </button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[minmax(250px,0.38fr)_minmax(0,1fr)]">
        <div
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${MESSAGING_PANEL_LIST_WIDTH_CLASS} ${
            showListOnMobile ? "flex" : "hidden md:flex"
          }`}
        >
          {listPane}
        </div>
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-stone-200 md:border-l md:pl-4 ${
            showDetailOnMobile ? "flex" : "hidden md:flex"
          }`}
        >
          {detailPane}
        </div>
      </div>
    </section>
  );
}
