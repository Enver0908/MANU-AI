"use client";

import {
  canOpenConversationInboxItem,
  CONVERSATION_CHANNEL_ICON,
  formatConversationLastActivityAt,
  MESSAGING_PANEL_ROW_MIN_HEIGHT_CLASS,
  resolveConversationClientDisplayName,
  resolveConversationRowUnreadCount,
} from "@/lib/messaging-panel-helpers";
import type { ConversationInboxItem } from "@/lib/phase-85-stage-4b2-contracts";
import { formatStage4BBadgeCount } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

export function ConversationListRow({
  item,
  uiLanguage,
  isActive,
  onOpen,
}: {
  item: ConversationInboxItem;
  uiLanguage: SupportedLanguageCode;
  isActive: boolean;
  onOpen: (item: ConversationInboxItem) => void;
}) {
  const ChannelIcon = CONVERSATION_CHANNEL_ICON[item.channel];
  const clientName = resolveConversationClientDisplayName(item.clientFullName, t(uiLanguage, "alertGenericClientName"));
  const activityLabel = formatConversationLastActivityAt(item.lastActivityAt);
  const unreadCount = resolveConversationRowUnreadCount(item);
  const disabled = !canOpenConversationInboxItem(item);
  const rowLabel = `${clientName}. ${item.preview}. ${t(uiLanguage, "messagingOpenConversation")}`;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        disabled={disabled}
        aria-current={isActive ? "true" : undefined}
        aria-label={rowLabel}
        data-testid={`conversation-list-row-${item.id}`}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${MESSAGING_PANEL_ROW_MIN_HEIGHT_CLASS} ${
          isActive ? "bg-emerald-50" : "hover:bg-stone-50"
        }`}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-emerald-800"
        >
          <ChannelIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-stone-900">{clientName}</span>
            {activityLabel ? (
              <span className="ml-auto shrink-0 text-xs text-stone-500">{activityLabel}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm leading-5 text-stone-600">{item.preview}</span>
        </span>
        {unreadCount > 0 ? (
          <span
            aria-label={`${unreadCount} ${t(uiLanguage, "filterUnread")}`}
            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
          >
            {formatStage4BBadgeCount(unreadCount)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function ConversationListRowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className={`px-3 py-2 ${MESSAGING_PANEL_ROW_MIN_HEIGHT_CLASS}`}
      data-testid="conversation-list-row-skeleton"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-stone-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="h-3 w-full max-w-xs animate-pulse rounded bg-stone-100" />
        </div>
      </div>
    </li>
  );
}
