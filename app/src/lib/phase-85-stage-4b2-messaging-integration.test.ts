import { describe, expect, it } from "vitest";
import { exportClientInState } from "./app-state-store";
import { buildClientScopedExport } from "./data-governance";
import { createInitialState } from "./seed-data";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "./phase-85-stage-4b-contracts";
import {
  assertClientExportExcludesConversationReadReceipts,
  buildClinicalAlertMessagingNavigationPatch,
  buildSystemNotificationNavigationAction,
  detectConversationReadReceiptExportLeaks,
  resolveMessagingTargetValidity,
} from "./phase-85-stage-4b2-messaging-integration";
import {
  assertRevokedConversationMessageRendersSafely,
  evaluateStage4B2MessagingLifecycleEvidence,
  projectRevokedConversationMessageDto,
} from "./phase-85-stage-4b2-messaging-integration-evidence";

describe("phase-85-stage-4b2-messaging-integration", () => {
  it("builds anchored alert and notification navigation actions", () => {
    const alertPatch = buildClinicalAlertMessagingNavigationPatch({
      id: "red:handoff-1",
      clientId: "client-mert",
      conversationId: "conversation-client-mert",
      sourceMessageId: "message-1",
    } as ClinicalAlertListItem);
    expect(alertPatch).toMatchObject({
      section: "messages",
      source: "alert",
      messageId: "message-1",
    });

    const notificationAction = buildSystemNotificationNavigationAction({
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
    } as SystemNotificationListItem);
    expect(notificationAction).toMatchObject({
      type: "dashboard",
      patch: {
        section: "messages",
        source: "notification",
      },
    });
  });

  it("detects broken messaging targets and export receipt leaks", () => {
    const state = createInitialState();
    expect(
      resolveMessagingTargetValidity(state, {
        clientId: "client-mert",
        conversationId: "missing-conversation",
      }).reason,
    ).toBe("broken_source_link");

    const exportPayload = exportClientInState(
      {
        ...state,
        conversationReadReceipts: [
          {
            tenantId: state.tenant.id,
            conversationId: state.conversations[0]!.id,
            dietitianId: state.dietitian.id,
            actorRole: "dietitian",
            lastReadSequence: 1,
            readAt: "2026-07-12T12:00:00.000Z",
            createdAt: "2026-07-12T12:00:00.000Z",
            updatedAt: "2026-07-12T12:00:00.000Z",
          },
        ],
      },
      "client-mert",
    ) as Record<string, unknown>;

    expect(detectConversationReadReceiptExportLeaks(exportPayload).passed).toBe(true);
    expect(() => assertClientExportExcludesConversationReadReceipts(exportPayload)).not.toThrow();

    const scoped = buildClientScopedExport(state, "client-mert") as Record<string, unknown>;
    expect(detectConversationReadReceiptExportLeaks(scoped).passed).toBe(true);

    expect(
      resolveMessagingTargetValidity(state, {
        clientId: "client-mert",
        conversationId: "conversation-from-old-link",
        messageId: "message-from-old-link",
        allowRemoteTarget: true,
      }),
    ).toMatchObject({ valid: true, reason: "ok" });
  });

  it("evaluates lifecycle anonymization and revoked message rendering", () => {
    const state = createInitialState();
    const lifecycle = evaluateStage4B2MessagingLifecycleEvidence(state, "client-mert");
    expect(lifecycle.ready).toBe(true);

    const revokedState = {
      ...state,
      messages: state.messages.map((message, index) =>
        index === 0
          ? {
              ...message,
              contentStatus: "revoked" as const,
            }
          : message,
      ),
    };
    const revoked = revokedState.messages[0]!;
    const dto = projectRevokedConversationMessageDto(revokedState, revoked.conversationId, revoked.id);
    expect(dto).toBeTruthy();
    expect(() => assertRevokedConversationMessageRendersSafely(dto!)).not.toThrow();
  });
});
