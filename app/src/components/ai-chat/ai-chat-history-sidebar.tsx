"use client";

import { useEffect, useRef } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { formatTime } from "@/components/dashboard/shared";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { AiChatHistoryGroup, AiChatDateGroupKey } from "@/lib/use-ai-chat";
import type { AiChatConversationListItem, AiChatListScopeFilter } from "@/lib/phase-85-stage-4c-contracts";

const GROUP_LABEL_KEY: Record<AiChatDateGroupKey, "aiChatGroupToday" | "aiChatGroupLast7Days" | "aiChatGroupLast30Days" | "aiChatGroupOlder"> = {
  today: "aiChatGroupToday",
  last7Days: "aiChatGroupLast7Days",
  last30Days: "aiChatGroupLast30Days",
  older: "aiChatGroupOlder",
};

function HistoryRow({
  item,
  uiLanguage,
  active,
  onSelect,
  onDelete,
}: {
  item: AiChatConversationListItem;
  uiLanguage: SupportedLanguageCode;
  active: boolean;
  onSelect: (chatId: string) => void;
  onDelete?: (chatId: string) => void;
}) {
  const label = item.scopeType === "client" ? item.clientFullName || t(uiLanguage, "aiChatScopeClient") : t(uiLanguage, "aiChatScopeGeneral");
  const timestamp = item.lastMessageAt ?? item.createdAt;

  return (
    <div
      className={`flex min-h-11 w-full items-center gap-1 rounded-lg px-1 py-1 transition ${
        active ? "bg-emerald-950 text-white" : "text-stone-700 hover:bg-stone-100"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? "page" : undefined}
        data-testid={`ai-chat-history-row-${item.id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-2 text-left"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold" style={{ overflowWrap: "anywhere" }}>
            {item.title}
          </span>
          {item.status === "locked" && (
            <span className={`shrink-0 text-[10px] font-bold uppercase ${active ? "text-emerald-200" : "text-amber-700"}`}>
              {t(uiLanguage, "aiChatConversationLocked")}
            </span>
          )}
          {item.status === "deleting" && (
            <span className={`shrink-0 text-[10px] font-bold uppercase ${active ? "text-emerald-200" : "text-stone-500"}`}>
              {t(uiLanguage, "aiChatDeletingStatus")}
            </span>
          )}
        </span>
        <span className={`truncate text-xs ${active ? "text-emerald-100" : "text-stone-600"}`} style={{ overflowWrap: "anywhere" }}>
          {label} · {formatTime(timestamp)}
        </span>
      </button>
      {onDelete && item.status === "active" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item.id);
          }}
          aria-label={t(uiLanguage, "aiChatDeleteChat")}
          data-testid={`ai-chat-delete-chat-${item.id}`}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg ${
            active ? "text-emerald-100 hover:bg-emerald-900" : "text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function AiChatHistorySidebar({
  uiLanguage,
  scope,
  query,
  onScopeChange,
  onQueryChange,
  groups,
  activeChatId,
  onSelectChat,
  onNewChat,
  isLoading,
  isLoadingMore,
  error,
  hasNextPage,
  onLoadMore,
  onRetry,
  onDeleteChat,
}: {
  uiLanguage: SupportedLanguageCode;
  scope: AiChatListScopeFilter;
  query: string;
  onScopeChange: (scope: AiChatListScopeFilter) => void;
  onQueryChange: (query: string) => void;
  groups: AiChatHistoryGroup[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onDeleteChat?: (chatId: string) => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore]);

  const isEmpty = !isLoading && !error && groups.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="ai-chat-history-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-3">
        <h2 className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChat")}</h2>
        <button
          type="button"
          onClick={onNewChat}
          aria-label={t(uiLanguage, "aiChatNewChat")}
          data-testid="ai-chat-new-chat-button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t(uiLanguage, "aiChatNewChat")}</span>
        </button>
      </div>

      <div className="space-y-2 border-b border-stone-200 px-3 py-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t(uiLanguage, "aiChatSearchHistoryPlaceholder")}
            aria-label={t(uiLanguage, "aiChatSearchHistoryPlaceholder")}
            className="min-h-11 w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-700"
          />
        </div>
        <div className="inline-flex w-full rounded-lg border border-stone-200 p-1" role="tablist" aria-label={t(uiLanguage, "aiChat")}>
          {(["all", "general", "client"] as AiChatListScopeFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => onScopeChange(value)}
              className={`min-h-11 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                scope === value ? "bg-emerald-950 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {value === "all" ? t(uiLanguage, "filterAll") : t(uiLanguage, value === "general" ? "aiChatScopeGeneral" : "aiChatScopeClient")}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p>{t(uiLanguage, "aiChatHistoryError")}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              {t(uiLanguage, "aiChatRetry")}
            </button>
          </div>
        ) : isEmpty ? (
          <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center" role="status">
            <p className="text-sm font-semibold text-stone-700">
              {t(uiLanguage, query.trim() ? "aiChatEmptySearchTitle" : "aiChatEmptyHistoryTitle")}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {t(uiLanguage, query.trim() ? "aiChatEmptySearchMessage" : "aiChatEmptyHistoryMessage")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((bucket) => (
              <div key={bucket.group}>
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  {t(uiLanguage, GROUP_LABEL_KEY[bucket.group])}
                </p>
                <div className="space-y-1">
                  {bucket.items.map((item) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      uiLanguage={uiLanguage}
                      active={item.id === activeChatId}
                      onSelect={onSelectChat}
                      onDelete={onDeleteChat}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
                >
                  {t(uiLanguage, "aiChatLoadMore")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
