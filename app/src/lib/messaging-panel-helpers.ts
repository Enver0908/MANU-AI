import type { LucideIcon } from "lucide-react";
import { MessageCircle, Send } from "lucide-react";
import type { ConversationInboxItem, ConversationListStatus } from "./phase-85-stage-4b2-contracts";
import type { Channel } from "./types";
import type { DashboardMessageKey } from "./i18n";

export const MESSAGING_PANEL_ROW_MIN_HEIGHT_CLASS = "min-h-11";
export const MESSAGING_PANEL_SKELETON_ROW_COUNT = 6;
export const MESSAGING_PANEL_LIST_WIDTH_CLASS = "md:max-w-[360px] md:shrink-0";

export const CONVERSATION_CHANNEL_ICON: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  telegram: Send,
};

export function resolveConversationClientDisplayName(fullName: string | null | undefined, fallbackLabel: string) {
  const trimmed = fullName?.trim();
  return trimmed ? trimmed : fallbackLabel;
}

export function formatConversationLastActivityAt(value: string | null, locale = "tr-TR", timeZone = "Europe/Istanbul") {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(parsed));
}

export function buildConversationStatusSegmentLabel(
  segment: ConversationListStatus,
  counts: { all: number; unread: number },
  labels: Record<ConversationListStatus, string>,
) {
  const count = segment === "all" ? counts.all : counts.unread;
  return `${labels[segment]} (${count})`;
}

export function resolveMessagingEmptyStateKeys(
  status: ConversationListStatus,
  query: string,
): { titleKey: DashboardMessageKey; messageKey: DashboardMessageKey } {
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    return {
      titleKey: "messagingListEmptySearchTitle",
      messageKey: "messagingListEmptySearchMessage",
    };
  }
  if (status === "unread") {
    return {
      titleKey: "messagingListEmptyUnreadTitle",
      messageKey: "messagingListEmptyUnreadMessage",
    };
  }
  return {
    titleKey: "messagingListEmpty",
    messageKey: "messagingListEmptyHint",
  };
}

export function resolveConversationRowUnreadCount(item: ConversationInboxItem) {
  return Math.max(0, item.unreadCount);
}

export function canOpenConversationInboxItem(item: ConversationInboxItem) {
  return Boolean(item.id?.trim() && item.clientId?.trim() && item.permissions.canRead);
}
