import type { HandoffCaseRecord, NotificationRecord } from "./types";

export type NotificationSlaSnapshot = {
  breachedNotificationCount: number;
  urgentEscalationDueCount: number;
};

const URGENT_ACK_SLA_MINUTES = 15;
const STANDARD_ACK_SLA_MINUTES = 4 * 60;

export function buildNotificationSlaSnapshot(
  input: {
    notifications: NotificationRecord[];
    handoffCases: HandoffCaseRecord[];
  },
  options: { now?: string } = {},
): NotificationSlaSnapshot {
  const now = options.now ? new Date(options.now) : new Date();
  const openHandoffIds = new Set(
    input.handoffCases.filter((handoff) => handoff.status === "open").map((handoff) => handoff.id),
  );

  return input.notifications.reduce<NotificationSlaSnapshot>(
    (snapshot, notification) => {
      if (!isOpenHandoffNotification(notification, openHandoffIds) || notification.acknowledgedAt) {
        return snapshot;
      }

      const ageMinutes = (now.getTime() - new Date(notification.createdAt).getTime()) / (60 * 1000);
      const slaMinutes = notification.type === "handoff_urgent" ? URGENT_ACK_SLA_MINUTES : STANDARD_ACK_SLA_MINUTES;

      if (ageMinutes <= slaMinutes) {
        return snapshot;
      }

      return {
        breachedNotificationCount: snapshot.breachedNotificationCount + 1,
        urgentEscalationDueCount:
          snapshot.urgentEscalationDueCount + (notification.type === "handoff_urgent" ? 1 : 0),
      };
    },
    { breachedNotificationCount: 0, urgentEscalationDueCount: 0 },
  );
}

function isOpenHandoffNotification(notification: NotificationRecord, openHandoffIds: Set<string>) {
  return notification.entityType === "handoff_case" && openHandoffIds.has(notification.entityId);
}
