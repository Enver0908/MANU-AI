import type { NotificationRecord } from "./types";

export const PHASE_85_STAGE_4A_POST_IF_REMEDIATION_VERSION = "p85-stage-4a-post-if-remediation-v1";

export const P85_STAGE_4A_STRUCTURED_NOTIFICATION_TARGET_TABS = {
  menu: "tab_menu",
  active_nutrition_plan: "tab_food_rules",
  client_form: "tab_personal_form",
  diet_plan: "tab_critical_context",
} as const;

export type P85Stage4AStructuredNotificationTargetTab =
  (typeof P85_STAGE_4A_STRUCTURED_NOTIFICATION_TARGET_TABS)[keyof typeof P85_STAGE_4A_STRUCTURED_NOTIFICATION_TARGET_TABS];

export function resolveP85Stage4AStructuredNotificationTab(
  targetPanel: string | null | undefined,
): P85Stage4AStructuredNotificationTargetTab | null {
  if (!targetPanel) return null;
  return P85_STAGE_4A_STRUCTURED_NOTIFICATION_TARGET_TABS[
    targetPanel as keyof typeof P85_STAGE_4A_STRUCTURED_NOTIFICATION_TARGET_TABS
  ] || null;
}

export function isP85Stage4AResolvableStructuredNotification(
  notification: Pick<NotificationRecord, "dedupeKey" | "resolvedAt" | "targetPanel">,
) {
  return (
    notification.dedupeKey?.startsWith("p85-if-e:structured:") === true &&
    notification.resolvedAt == null &&
    resolveP85Stage4AStructuredNotificationTab(notification.targetPanel) !== null
  );
}
