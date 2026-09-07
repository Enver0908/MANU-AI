import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Clock3,
  FileText,
  GitBranch,
  Image,
  Lock,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { AppTenantContext } from "./auth-context";
import type {
  NotificationCategory,
  NotificationKind,
  NotificationPriority,
  Stage4BNotificationMutationResponse,
  Stage4BNotificationReadAllResponse,
  SystemNotificationListItem,
} from "./phase-85-stage-4b-contracts";
import {
  getDefaultDashboardUrlState,
  resolveStage6CommunicationDestination,
} from "./phase-85-stage-4b-dashboard-routing";
import type { NotificationListStatus } from "./phase-85-stage-4b-api";
import { canMutateStage4BNotificationReceipt } from "./phase-85-stage-4b-notifications";
import type { DashboardMessageKey } from "./i18n";
import { formatAlertStartedAt } from "./alerts-panel-helpers";

export const NOTIFICATIONS_PANEL_ROW_MIN_HEIGHT_CLASS = "min-h-11";
export const NOTIFICATIONS_PANEL_SKELETON_ROW_COUNT = 6;

export type NotificationStatusSegment = NotificationListStatus;

export type NotificationPriorityTone = "stone" | "emerald";

export const NOTIFICATION_KIND_ICON: Record<NotificationKind, LucideIcon> = {
  structured_record_update_required: FileText,
  competing_authoritative_instructions: GitBranch,
  unsupported_media_review: Image,
  visual_message_review: Image,
  visual_correction_follow_up: MessageSquareWarning,
  voice_transcript_correction_follow_up: MessageSquareWarning,
  safe_reply_unavailable: MessageSquareWarning,
  delivery_failed: Send,
  communication_permission_closed: Lock,
  ai_window_expired: Clock3,
  ai_paused_by_verified_human: UserRound,
  draft_invalidated: FileText,
  human_control_integrity: ShieldCheck,
  ai_chat_red_review_required: ShieldAlert,
  legacy_system: Bell,
  legacy_handoff: Bell,
};

export function resolveNotificationPriorityLabelKey(priority: NotificationPriority): DashboardMessageKey {
  if (priority === "intervention_required") return "filterInterventionRequired";
  if (priority === "review_required") return "filterReviewRequired";
  return "filterInfo";
}

export function resolveNotificationPriorityTone(priority: NotificationPriority): NotificationPriorityTone {
  void priority;
  return "stone";
}

export function resolveNotificationCategoryLabelKey(category: NotificationCategory): DashboardMessageKey {
  if (category === "records") return "filterRecords";
  if (category === "conversation_review") return "filterConversationReview";
  if (category === "channel_delivery") return "filterChannelDelivery";
  return "filterAiControl";
}

export function formatNotificationOccurredAt(value: string, locale = "tr-TR", timeZone = "Europe/Istanbul") {
  return formatAlertStartedAt(value, locale, timeZone);
}

export function formatNotificationOccurrenceLabel(count: number, label: string) {
  if (count <= 1) return "";
  return `${count} ${label}`;
}

export function buildNotificationStatusSegmentLabel(
  segment: NotificationStatusSegment,
  counts: { active: number; unread: number; history: number },
  labels: Record<NotificationStatusSegment, string>,
) {
  const count = segment === "active" ? counts.active : segment === "unread" ? counts.unread : counts.history;
  return `${labels[segment]} (${count})`;
}

export function resolveNotificationEmptyStateKeys(
  status: NotificationStatusSegment,
  query: string,
): { titleKey: DashboardMessageKey; messageKey: DashboardMessageKey } {
  if (query.trim()) {
    return {
      titleKey: "notificationsEmptySearchTitle",
      messageKey: "notificationsEmptySearchMessage",
    };
  }
  if (status === "unread") {
    return { titleKey: "notificationsEmptyUnreadTitle", messageKey: "notificationsEmptyUnreadMessage" };
  }
  if (status === "history") {
    return { titleKey: "notificationsEmptyHistoryTitle", messageKey: "notificationsEmptyHistoryMessage" };
  }
  return { titleKey: "noNotificationsYet", messageKey: "noNotificationsYetHint" };
}

export function resolveNotificationContextLabel(
  notification: SystemNotificationListItem,
  labels: { client: string; system: string },
) {
  const clientName = notification.clientFullName?.trim();
  return clientName || labels.system;
}

export function resolveNotificationReceiptStatus(
  notification: SystemNotificationListItem,
): "unread" | "read" | "acknowledged" {
  if (notification.acknowledgedAt) return "acknowledged";
  if (notification.readAt) return "read";
  return "unread";
}

export function canActorMutateNotificationReceipts(context: Pick<AppTenantContext, "role" | "dietitianId">, dietitianId: string) {
  return canMutateStage4BNotificationReceipt(context, dietitianId);
}

export function canNavigateToNotificationTarget(
  notification: SystemNotificationListItem,
  activeClientIds: ReadonlySet<string>,
) {
  const destination = resolveStage6CommunicationDestination(
    getDefaultDashboardUrlState(),
    {
      section: notification.target.section,
      clientId: notification.clientId ?? notification.target.clientId,
      conversationId: notification.target.conversationId ?? notification.conversationId,
      messageId: notification.target.messageId ?? notification.messageId,
      source: "notification",
      sourceId: notification.id,
      clientTask: notification.target.section === "ai-control" ? "ai" : "summary",
    },
    { knownClientIds: activeClientIds },
  );
  return !destination.inaccessible;
}

export function mergeStage4BNotificationMutationIntoItems(
  items: SystemNotificationListItem[],
  mutation: Stage4BNotificationMutationResponse,
) {
  return items.map((item) =>
    item.id === mutation.notificationId
      ? {
          ...item,
          readAt: mutation.readAt,
          acknowledgedAt: mutation.acknowledgedAt,
          resolvedAt: mutation.resolvedAt ?? item.resolvedAt,
        }
      : item,
  );
}

export function applyStage4BNotificationReadAllToItems(
  items: SystemNotificationListItem[],
  mutation: Stage4BNotificationReadAllResponse,
  readAt: string,
) {
  if (mutation.markedReadCount <= 0) return items;
  return items.map((item) => (item.readAt ? item : { ...item, readAt }));
}

export function shouldShowUnsupportedMediaReviewComplete(notification: SystemNotificationListItem) {
  return (
    notification.kind === "unsupported_media_review" &&
    Boolean(notification.readAt && notification.acknowledgedAt) &&
    !notification.resolvedAt
  );
}

export function isNotificationTitleKey(value: string): value is DashboardMessageKey {
  return value.startsWith("notificationTitle");
}

export function isNotificationSummaryKey(value: string): value is DashboardMessageKey {
  return value.startsWith("notificationSummary");
}
