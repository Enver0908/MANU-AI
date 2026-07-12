import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  acknowledgeNotificationReceiptInState,
  buildStage4BDedupeKey,
  buildTestNotification,
  canMutateStage4BNotificationReceipt,
  classifyLegacyNotificationKind,
  emitSafeReplyUnavailableNotification,
  isNotificationUnreadForActor,
  isStage4BNotificationVisible,
  markAllVisibleNotificationReceiptsReadInState,
  markNotificationReceiptReadInState,
  normalizeNotificationsInState,
  reconcileSafeReplyUnavailableNotifications,
  resolveNotificationCategory,
  resolveNotificationPriority,
  shouldEmitClinicalHandoffNotification,
  upsertSystemNotificationInState,
} from "./phase-85-stage-4b-notifications";

describe("phase-85-stage-4b notifications", () => {
  it("classifies legacy notification kinds without title or body inference", () => {
    expect(
      classifyLegacyNotificationKind({
        type: "system",
        entityType: "client",
        dedupeKey: "p85-if-e:structured:client-1:menu:msg-1",
      }),
    ).toBe("structured_record_update_required");
    expect(
      classifyLegacyNotificationKind({
        type: "handoff_urgent",
        entityType: "handoff_case",
        dedupeKey: null,
      }),
    ).toBe("legacy_handoff");
    expect(
      classifyLegacyNotificationKind({
        type: "system",
        entityType: "client",
        dedupeKey: null,
      }),
    ).toBe("legacy_system");
  });

  it("resolves notification priority from kind", () => {
    expect(resolveNotificationPriority("delivery_failed")).toBe("intervention_required");
    expect(resolveNotificationPriority("ai_window_expired")).toBe("info");
  });

  it("normalizes notification links from handoff and message entities", () => {
    const state = createInitialState();
    const handoff = {
      id: "handoff-case-1",
      tenantId: state.tenant.id,
      dietitianId: state.dietitian.id,
      clientId: state.clients[0]!.id,
      conversationId: state.conversations[0]!.id,
      triggeringMessageId: state.messages[0]?.id ?? "message-1",
      risk: "red" as const,
      reasons: ["review_required"],
      status: "open" as const,
      urgency: "urgent" as const,
      safeAcknowledgement: "Review required.",
      recommendedAction: "Review required.",
      createdAt: "2026-05-22T10:00:00.000Z",
    };
    const normalized = normalizeNotificationsInState({
      ...state,
      handoffCases: [handoff],
      notifications: [
        buildTestNotification({
          id: "notif-handoff",
          tenantId: state.tenant.id,
          type: "handoff_urgent",
          entityType: "handoff_case",
          entityId: handoff.id,
          title: "Handoff",
          body: "Review required.",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-05-22T10:00:00.000Z",
        }),
      ],
    });

    expect(normalized.notifications[0]?.kind).toBe("legacy_handoff");
    expect(normalized.notifications[0]?.clientId).toBe(handoff.clientId);
    expect(normalized.notifications[0]?.handoffId).toBe(handoff.id);
  });

  it("enforces actor receipt visibility and mutation rules", () => {
    const state = createInitialState();
    const notification = buildTestNotification({
      id: "notif-client",
      tenantId: state.tenant.id,
      type: "system",
      entityType: "client",
      entityId: state.clients[0]!.id,
      clientId: state.clients[0]!.id,
      title: "System",
      body: "Review required.",
      read: false,
      acknowledgedAt: null,
      createdAt: "2026-05-22T10:00:00.000Z",
    });

    expect(
      isStage4BNotificationVisible(notification, { role: "auditor", dietitianId: state.dietitian.id }, [], state.clients),
    ).toBe(false);
    expect(
      isStage4BNotificationVisible(notification, { role: "dietitian", dietitianId: state.dietitian.id }, [], state.clients),
    ).toBe(true);
    expect(canMutateStage4BNotificationReceipt({ role: "assistant", dietitianId: state.dietitian.id }, state.dietitian.id)).toBe(
      false,
    );
    expect(canMutateStage4BNotificationReceipt({ role: "dietitian", dietitianId: state.dietitian.id }, state.dietitian.id)).toBe(
      true,
    );
  });

  it("tracks unread state and receipt mutations per actor", () => {
    const state = createInitialState();
    const notificationId = "notif-read-ack";
    const withNotification = {
      ...state,
      notifications: [
        buildTestNotification({
          id: notificationId,
          tenantId: state.tenant.id,
          type: "system",
          entityType: "client",
          entityId: state.clients[0]!.id,
          clientId: state.clients[0]!.id,
          title: "System",
          body: "Review required.",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-05-22T10:00:00.000Z",
        }),
      ],
    };

    expect(isNotificationUnreadForActor(notificationId, state.dietitian.id, withNotification.notificationReceipts)).toBe(true);

    const readState = markNotificationReceiptReadInState(withNotification, notificationId, state.dietitian.id, "2026-05-22T10:01:00.000Z");
    expect(isNotificationUnreadForActor(notificationId, state.dietitian.id, readState.notificationReceipts)).toBe(false);

    const ackState = acknowledgeNotificationReceiptInState(readState, notificationId, state.dietitian.id, "2026-05-22T10:02:00.000Z");
    const receipt = ackState.notificationReceipts.find(
      (item) => item.notificationId === notificationId && item.dietitianId === state.dietitian.id,
    );
    expect(receipt?.acknowledgedAt).toBe("2026-05-22T10:02:00.000Z");

    const bulkRead = markAllVisibleNotificationReceiptsReadInState(
      withNotification,
      state.dietitian.id,
      new Set([notificationId]),
      "2026-05-22T10:03:00.000Z",
    );
    expect(
      bulkRead.notificationReceipts.find(
        (item) => item.notificationId === notificationId && item.dietitianId === state.dietitian.id,
      )?.readAt,
    ).toBe("2026-05-22T10:03:00.000Z");
  });

  it("dedupes open system notifications and increments occurrence count", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;
    const dedupeKey = buildStage4BDedupeKey({
      kind: "safe_reply_unavailable",
      scopeId: client.id,
      entityId: conversation.id,
      sourceId: "provider_timeout",
    });

    const first = upsertSystemNotificationInState(state, {
      kind: "safe_reply_unavailable",
      tenantId: state.tenant.id,
      entityType: "conversation",
      entityId: conversation.id,
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      sourceMessageId: "message-1",
      dedupeKey,
      title: "Safe reply unavailable",
      body: "Review manually.",
      createdAt: "2026-05-22T10:00:00.000Z",
    }, "2026-05-22T10:00:00.000Z");

    const second = upsertSystemNotificationInState(first, {
      kind: "safe_reply_unavailable",
      tenantId: state.tenant.id,
      entityType: "conversation",
      entityId: conversation.id,
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      sourceMessageId: "message-1",
      dedupeKey,
      title: "Safe reply unavailable",
      body: "Review manually.",
      createdAt: "2026-05-22T10:01:00.000Z",
    }, "2026-05-22T10:01:00.000Z");

    expect(second.notifications).toHaveLength(1);
    expect(second.notifications[0]?.occurrenceCount).toBe(2);
    expect(second.notifications[0]?.lastOccurredAt).toBe("2026-05-22T10:01:00.000Z");
  });

  it("creates a new lifecycle row after resolved recurrence", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;
    const dedupeKey = buildStage4BDedupeKey({
      kind: "delivery_failed",
      scopeId: client.id,
      entityId: "message-1",
      sourceId: "delivery-1",
    });
    const resolved = upsertSystemNotificationInState(state, {
      kind: "delivery_failed",
      tenantId: state.tenant.id,
      entityType: "message",
      entityId: "message-1",
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      dedupeKey,
      title: "Delivery failed",
      body: "Retry required.",
      resolvedAt: "2026-05-22T09:00:00.000Z",
      createdAt: "2026-05-22T08:00:00.000Z",
    }, "2026-05-22T08:00:00.000Z");
    const recurring = upsertSystemNotificationInState(resolved, {
      kind: "delivery_failed",
      tenantId: state.tenant.id,
      entityType: "message",
      entityId: "message-1",
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      dedupeKey,
      title: "Delivery failed",
      body: "Retry required.",
      createdAt: "2026-05-22T10:00:00.000Z",
    }, "2026-05-22T10:00:00.000Z");

    expect(recurring.notifications).toHaveLength(2);
    expect(recurring.notifications.filter((item) => item.resolvedAt == null)).toHaveLength(1);
  });

  it("excludes clinical red handoffs from notification emission", () => {
    expect(shouldEmitClinicalHandoffNotification({ risk: "red", blockedReason: "review_required" })).toBe(false);
    expect(shouldEmitClinicalHandoffNotification({ risk: "yellow", blockedReason: "review_required" })).toBe(false);
    expect(shouldEmitClinicalHandoffNotification({ risk: "green", blockedReason: "provider_timeout" })).toBe(true);
  });

  it("maps kinds to deterministic priority and category", () => {
    expect(resolveNotificationPriority("safe_reply_unavailable")).toBe("intervention_required");
    expect(resolveNotificationCategory("ai_window_expired")).toBe("ai_control");
    expect(resolveNotificationCategory("communication_permission_closed")).toBe("channel_delivery");
  });

  it("reconciles safe reply unavailable after manual dietitian reply", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;
    const withNotification = emitSafeReplyUnavailableNotification(state, {
      clientId: client.id,
      conversationId: conversation.id,
      messageId: "message-1",
      blockedReason: "provider_timeout",
      clientName: client.fullName,
      now: "2026-05-22T10:00:00.000Z",
    });
    const reconciled = reconcileSafeReplyUnavailableNotifications(
      withNotification,
      conversation.id,
      "2026-05-22T10:05:00.000Z",
    );
    expect(reconciled.notifications[0]?.resolvedAt).toBe("2026-05-22T10:05:00.000Z");
  });
});
