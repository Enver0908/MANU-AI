import { exportClientInState } from "./app-state-store";
import { resolveConversationMessageBody } from "./conversation-detail-helpers";
import {
  anonymizeClientInState,
  buildClientScopedExport,
  PHASE_74_REDACTION_MARKER,
} from "./data-governance";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "./phase-85-stage-4b-contracts";
import {
  CONVERSATION_UNAVAILABLE_PREVIEW,
  type ConversationMessageDto,
} from "./phase-85-stage-4b2-contracts";
import { buildConversationDetailResponseFromAppState } from "./phase-85-stage-4b2-messaging";
import {
  assertClientExportExcludesConversationReadReceipts,
  buildClinicalAlertMessagingNavigationPatch,
  buildSystemNotificationNavigationAction,
  resolveMessagingTargetValidity,
} from "./phase-85-stage-4b2-messaging-integration";
import { runStage4BChannelIntegrationChecks } from "./phase-85-stage-4b-integration-verification";
import { createInitialState } from "./seed-data";
import type { AppTenantContext } from "./auth-context";
import type { ManuAppState } from "./types";

export type Stage4B2MessagingIntegrationEvidence = {
  ready: boolean;
  failures: string[];
  channelReady: boolean;
  exportLeakFree: boolean;
  lifecycleReady: boolean;
};

function ownerContextFor(state: ManuAppState): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-owner",
    role: "owner",
  };
}

export function evaluateStage4B2MessagingLifecycleEvidence(state: ManuAppState, clientId?: string) {
  const failures: string[] = [];
  const resolvedClientId = clientId ?? state.clients[0]?.id;
  if (!resolvedClientId) {
    return { ready: false, failures: ["no_client_for_lifecycle"] };
  }

  const conversationId = state.conversations.find((item) => item.clientId === resolvedClientId)?.id;
  const receipt = conversationId
    ? {
        tenantId: state.tenant.id,
        conversationId,
        dietitianId: state.dietitian.id,
        actorRole: "dietitian" as const,
        lastReadSequence: 3,
        readAt: "2026-07-12T12:00:00.000Z",
        createdAt: "2026-07-12T12:00:00.000Z",
        updatedAt: "2026-07-12T12:00:00.000Z",
      }
    : null;

  const withReceipt =
    receipt == null
      ? state
      : {
          ...state,
          conversationReadReceipts: [...state.conversationReadReceipts, receipt],
        };

  const anonymized = anonymizeClientInState(withReceipt, resolvedClientId);
  if (anonymized.conversationReadReceipts.some((item) => item.conversationId === conversationId)) {
    failures.push("anonymization_retained_conversation_receipt");
  }

  const revokedMessage = state.messages.find((message) => message.conversationId === conversationId);
  if (revokedMessage) {
    const anonymizedMessage = anonymized.messages.find((message) => message.id === revokedMessage.id);
    if (!anonymizedMessage || anonymizedMessage.body !== PHASE_74_REDACTION_MARKER) {
      failures.push("anonymization_message_redaction_missing");
    }
  }

  try {
    const exportPayload = exportClientInState(withReceipt, resolvedClientId) as Record<string, unknown>;
    assertClientExportExcludesConversationReadReceipts(exportPayload);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "client_export_leak");
  }

  try {
    const scopedExport = buildClientScopedExport(withReceipt, resolvedClientId) as Record<string, unknown>;
    assertClientExportExcludesConversationReadReceipts(scopedExport);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "scoped_export_leak");
  }

  return {
    ready: failures.length === 0,
    failures,
  };
}

export function projectRevokedConversationMessageDto(
  state: ManuAppState,
  conversationId: string,
  messageId: string,
): ConversationMessageDto | null {
  const detail = buildConversationDetailResponseFromAppState(
    state,
    ownerContextFor(state),
    [],
    conversationId,
    { generatedAt: "2026-07-12T12:00:00.000Z" },
  );
  return detail.messages.find((message) => message.id === messageId) ?? null;
}

export function assertRevokedConversationMessageRendersSafely(message: ConversationMessageDto) {
  const body = resolveConversationMessageBody(message);
  if (body === message.body) {
    throw new Error("revoked_message_body_not_redacted_for_ui");
  }
  if (!body.includes("kullanilamiyor") && body !== CONVERSATION_UNAVAILABLE_PREVIEW) {
    throw new Error("revoked_message_unavailable_placeholder_missing");
  }
}

export async function evaluateStage4B2MessagingIntegrationEvidence(
  state: ManuAppState = createInitialState(),
): Promise<Stage4B2MessagingIntegrationEvidence> {
  const failures: string[] = [];
  const lifecycle = evaluateStage4B2MessagingLifecycleEvidence(state);
  failures.push(...lifecycle.failures);

  const alert = {
    id: "red:handoff-1",
    clientId: "client-mert",
    conversationId: "conversation-client-mert",
    sourceMessageId: "message-1",
  } as ClinicalAlertListItem;
  const alertPatch = buildClinicalAlertMessagingNavigationPatch(alert);
  if (!alertPatch?.messageId || alertPatch.section !== "messages") {
    failures.push("alert_navigation_missing_anchor");
  }

  const notification = {
    id: "notification-1",
    conversationId: "conversation-client-mert",
    messageId: "message-1",
    target: {
      section: "messages",
      clientId: "client-mert",
      conversationId: "conversation-client-mert",
      messageId: "message-1",
      source: "notification",
      sourceId: "notification-1",
    },
  } as SystemNotificationListItem;
  const notificationAction = buildSystemNotificationNavigationAction(notification);
  if (notificationAction?.type !== "dashboard" || notificationAction.patch.section !== "messages") {
    failures.push("notification_navigation_missing_messages_target");
  }

  const broken = resolveMessagingTargetValidity(state, {
    clientId: "client-mert",
    conversationId: "missing-conversation",
  });
  if (broken.valid) {
    failures.push("broken_source_link_not_detected");
  }

  const revoked = state.messages.find((message) => message.contentStatus === "revoked");
  if (revoked) {
    const dto = projectRevokedConversationMessageDto(state, revoked.conversationId, revoked.id);
    if (!dto) {
      failures.push("revoked_message_projection_missing");
    } else {
      try {
        assertRevokedConversationMessageRendersSafely(dto);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "revoked_message_render_unsafe");
      }
    }
  }

  const channel = await runStage4BChannelIntegrationChecks();
  if (!channel.ready) {
    failures.push(...channel.failures.map((failure) => `channel:${failure}`));
  }

  return {
    ready: failures.length === 0,
    failures,
    channelReady: channel.ready,
    exportLeakFree: lifecycle.ready,
    lifecycleReady: lifecycle.ready,
  };
}
