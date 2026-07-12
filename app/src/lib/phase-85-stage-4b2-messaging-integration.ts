import type { ClinicalAlertListItem, SystemNotificationListItem } from "./phase-85-stage-4b-contracts";
import type { DashboardUrlState } from "./phase-85-stage-4b-dashboard-routing";
import { detectP85IfIClientExportLeaks } from "./phase-85-if-i-lifecycle-closure";
import type { ManuAppState } from "./types";

export const PHASE_85_STAGE_4B_2_MESSAGING_INTEGRATION_VERSION = "p85-stage-4b2-messaging-integration-v1";

export type Stage4B2MessagingRefreshSurfaces = {
  refreshMessaging: (options?: { anchorMessageId?: string | null }) => void | Promise<void>;
  refreshInbox: () => void | Promise<void>;
};

export type Stage4B2ClientPanelTab =
  | "tab_overview"
  | "tab_personal_form"
  | "tab_food_rules"
  | "tab_menu"
  | "tab_ai_assistant";

export type Stage4B2NavigationAction =
  | { type: "dashboard"; patch: Partial<DashboardUrlState> }
  | { type: "client-panel"; clientId: string; clientDetailTab?: Stage4B2ClientPanelTab };

export type Stage4B2MessagingTargetValidity = {
  valid: boolean;
  reason: "ok" | "missing_client" | "missing_conversation" | "removed_client" | "broken_source_link";
};

export function refreshStage4B2OperationalSurfaces(
  surfaces: Stage4B2MessagingRefreshSurfaces,
  options?: { anchorMessageId?: string | null },
) {
  void surfaces.refreshMessaging(options);
  void surfaces.refreshInbox();
}

export function buildClinicalAlertMessagingNavigationPatch(
  alert: ClinicalAlertListItem,
): Partial<DashboardUrlState> | null {
  if (!alert.clientId?.trim() || !alert.conversationId?.trim()) {
    return null;
  }
  return {
    section: "messages",
    clientId: alert.clientId,
    conversationId: alert.conversationId,
    source: "alert",
    sourceId: alert.id,
    messageId: alert.sourceMessageId,
  };
}

export function buildSystemNotificationNavigationAction(
  notification: SystemNotificationListItem,
): Stage4B2NavigationAction | null {
  const target = notification.target;
  if (!target.clientId?.trim()) return null;

  if (target.section === "messages") {
    return {
      type: "dashboard",
      patch: {
        section: "messages",
        clientId: target.clientId,
        conversationId: target.conversationId ?? notification.conversationId,
        messageId: target.messageId ?? notification.messageId,
        source: "notification",
        sourceId: notification.id,
      },
    };
  }

  if (target.section === "ai-control") {
    return {
      type: "client-panel",
      clientId: target.clientId,
      clientDetailTab: "tab_ai_assistant",
    };
  }

  if (target.section === "clients") {
    return {
      type: "client-panel",
      clientId: target.clientId,
    };
  }

  return null;
}

export function resolveMessagingTargetValidity(
  state: ManuAppState,
  input: {
    clientId: string | null | undefined;
    conversationId: string | null | undefined;
    messageId?: string | null | undefined;
    activeClientIds?: ReadonlySet<string>;
  },
): Stage4B2MessagingTargetValidity {
  const clientId = input.clientId?.trim();
  if (!clientId) {
    return { valid: false, reason: "missing_client" };
  }

  const activeClientIds = input.activeClientIds ?? new Set(
    state.clients
      .filter((client) => client.lifecycleStatus !== "removed_anonymized")
      .map((client) => client.id),
  );
  if (!activeClientIds.has(clientId)) {
    return { valid: false, reason: "removed_client" };
  }

  const conversationId = input.conversationId?.trim();
  if (!conversationId) {
    return { valid: false, reason: "missing_conversation" };
  }

  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation || conversation.clientId !== clientId) {
    return { valid: false, reason: "broken_source_link" };
  }

  const messageId = input.messageId?.trim();
  if (messageId) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message || message.conversationId !== conversationId) {
      return { valid: false, reason: "broken_source_link" };
    }
  }

  return { valid: true, reason: "ok" };
}

export function detectConversationReadReceiptExportLeaks(exportData: Record<string, unknown>) {
  const failures: string[] = [];
  if ("conversationReadReceipts" in exportData) {
    failures.push("conversation_read_receipts_leaked");
  }
  const serialized = JSON.stringify(exportData);
  if (serialized.includes("conversationReadReceipts") || serialized.includes("conversation_read_receipts")) {
    failures.push("conversation_read_receipts_leaked");
  }
  if (serialized.includes("lastReadSequence")) {
    failures.push("conversation_read_receipt_marker_leaked");
  }
  return {
    passed: failures.length === 0,
    failures,
  };
}

export function assertClientExportExcludesConversationReadReceipts(exportData: Record<string, unknown>) {
  const receiptLeaks = detectConversationReadReceiptExportLeaks(exportData);
  const p85Leaks = detectP85IfIClientExportLeaks(exportData);
  const failures = [...receiptLeaks.failures, ...p85Leaks.failures];
  if (failures.length > 0) {
    throw new Error(`client_export_leak_detected:${failures.join(",")}`);
  }
  return exportData;
}
