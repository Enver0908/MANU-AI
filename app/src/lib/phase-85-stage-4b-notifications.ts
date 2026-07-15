import type { AppTenantContext } from "./auth-context";
import type {
  ClientRecord,
  HandoffCaseRecord,
  ManuAppState,
  MessageRecord,
  NotificationRecord,
} from "./types";
import type {
  NotificationKind,
  NotificationPriority,
  NotificationReceiptRecord,
  NotificationCategory,
} from "./phase-85-stage-4b-contracts";
import { AppDomainError } from "./app-errors";

export const PHASE_85_STAGE_4B_NOTIFICATIONS_VERSION = "p85-stage-4b-notifications-v1";

const NOTIFICATION_KIND_PRIORITY: Record<NotificationKind, NotificationPriority> = {
  structured_record_update_required: "review_required",
  competing_authoritative_instructions: "intervention_required",
  unsupported_media_review: "review_required",
  visual_message_review: "review_required",
  visual_correction_follow_up: "intervention_required",
  voice_transcript_correction_follow_up: "intervention_required",
  safe_reply_unavailable: "intervention_required",
  delivery_failed: "intervention_required",
  communication_permission_closed: "review_required",
  ai_window_expired: "info",
  ai_paused_by_verified_human: "review_required",
  draft_invalidated: "review_required",
  human_control_integrity: "intervention_required",
  legacy_system: "review_required",
  legacy_handoff: "review_required",
};

type DbClientAssignment = {
  client_id: string;
  dietitian_id: string;
  access_level?: "care_team" | "viewer";
};

export function resolveNotificationPriority(kind: NotificationKind): NotificationPriority {
  return NOTIFICATION_KIND_PRIORITY[kind];
}

export function classifyLegacyNotificationKind(
  notification: Pick<NotificationRecord, "type" | "entityType" | "dedupeKey">,
): NotificationKind {
  if (notification.dedupeKey?.startsWith("p85-if-e:structured:")) {
    return "structured_record_update_required";
  }
  if (
    notification.type === "handoff_urgent" ||
    notification.type === "handoff_standard" ||
    notification.entityType === "handoff_case"
  ) {
    return "legacy_handoff";
  }
  return "legacy_system";
}

export function resolveNotificationLinks(input: {
  notification: Pick<
    NotificationRecord,
    "entityType" | "entityId" | "sourceMessageId" | "handoffId" | "clientId" | "conversationId" | "messageId"
  >;
  handoffCases: HandoffCaseRecord[];
  messages: MessageRecord[];
  conversations: Array<{ id: string; clientId: string }>;
  clients?: Array<{ id: string }>;
}): {
  clientId: string | null;
  conversationId: string | null;
  messageId: string | null;
  handoffId: string | null;
} {
  const clientIds = input.clients ? new Set(input.clients.map((client) => client.id)) : null;
  const conversationById = new Map(input.conversations.map((conversation) => [conversation.id, conversation]));
  const messageById = new Map(input.messages.map((message) => [message.id, message]));
  const handoffById = new Map(input.handoffCases.map((handoff) => [handoff.id, handoff]));
  const isKnownClient = (clientId: string | null | undefined) =>
    Boolean(clientId && (!clientIds || clientIds.has(clientId)));

  if (
    (input.clients && input.notification.clientId && !clientIds?.has(input.notification.clientId)) ||
    (input.clients &&
      input.notification.entityType === "client" &&
      input.notification.entityId &&
      !clientIds?.has(input.notification.entityId))
  ) {
    return { clientId: null, conversationId: null, messageId: null, handoffId: null };
  }

  let clientId: string | null = isKnownClient(input.notification.clientId) ? input.notification.clientId! : null;
  let conversationId: string | null = null;
  let messageId: string | null = null;
  let handoffId: string | null = null;

  const requestedConversation = input.notification.conversationId
    ? conversationById.get(input.notification.conversationId)
    : undefined;
  const hasInvalidRequestedConversation = Boolean(
    input.notification.conversationId &&
      (!requestedConversation || (clientId && requestedConversation.clientId !== clientId)),
  );
  if (requestedConversation && (!clientId || requestedConversation.clientId === clientId)) {
    conversationId = requestedConversation.id;
    clientId = clientId ?? requestedConversation.clientId;
  }

  if (input.notification.entityType === "client") {
    if (isKnownClient(input.notification.entityId)) {
      clientId = clientId ?? input.notification.entityId;
    }
  }

  if (input.notification.entityType === "handoff_case") {
    const requestedHandoffId = input.notification.handoffId ?? input.notification.entityId;
    const handoff = requestedHandoffId ? handoffById.get(requestedHandoffId) : undefined;
    if (handoff) {
      if (!clientId || clientId === handoff.clientId) {
        clientId = clientId ?? handoff.clientId;
        handoffId = handoff.id;
        const handoffConversation = conversationById.get(handoff.conversationId);
        if (!conversationId || conversationId === handoff.conversationId) {
          conversationId = handoffConversation?.clientId === clientId ? handoff.conversationId : null;
        }
        const triggeringMessage = handoff.triggeringMessageId
          ? messageById.get(handoff.triggeringMessageId)
          : undefined;
        if (
          triggeringMessage &&
          triggeringMessage.conversationId === handoff.conversationId &&
          (!conversationId || conversationId === triggeringMessage.conversationId)
        ) {
          messageId = handoff.triggeringMessageId;
        }
      }
    }
  }

  const requestedMessageId = input.notification.messageId ?? input.notification.sourceMessageId;
  const message = requestedMessageId ? messageById.get(requestedMessageId) : undefined;
  if (message) {
    const messageConversation = conversationById.get(message.conversationId);
    if (
      messageConversation &&
      (!clientId || messageConversation.clientId === clientId) &&
      (!conversationId || conversationId === message.conversationId)
    ) {
      messageId = message.id;
      conversationId = conversationId ?? message.conversationId;
      clientId = clientId ?? messageConversation.clientId;
    }
  }

  if (input.notification.handoffId && !handoffId) {
    const handoff = handoffById.get(input.notification.handoffId);
    if (handoff && (!clientId || handoff.clientId === clientId)) {
      handoffId = handoff.id;
      clientId = clientId ?? handoff.clientId;
    }
  }

  if (hasInvalidRequestedConversation) {
    conversationId = null;
    messageId = null;
  }

  return { clientId, conversationId, messageId, handoffId };
}

export function normalizeNotificationRecord(
  notification: NotificationRecord,
  input: {
    handoffCases: HandoffCaseRecord[];
    messages: MessageRecord[];
    conversations: Array<{ id: string; clientId: string }>;
    clients?: Array<{ id: string }>;
    now?: string;
  },
): NotificationRecord {
  const kind = notification.kind ?? classifyLegacyNotificationKind(notification);
  const links = resolveNotificationLinks({
    notification,
    handoffCases: input.handoffCases,
    messages: input.messages,
    conversations: input.conversations,
    clients: input.clients,
  });
  const timestamp = input.now ?? notification.lastOccurredAt ?? notification.createdAt;

  return {
    ...notification,
    kind,
    priority: notification.priority ?? resolveNotificationPriority(kind),
    clientId: links.clientId,
    conversationId: links.conversationId,
    messageId: links.messageId,
    handoffId: links.handoffId,
    occurrenceCount: notification.occurrenceCount ?? 1,
    lastOccurredAt: notification.lastOccurredAt ?? timestamp,
  };
}

export function isStage4BNotificationVisible(
  notification: Pick<NotificationRecord, "clientId">,
  context: Pick<AppTenantContext, "role" | "dietitianId">,
  assignments: DbClientAssignment[],
  clients: Pick<ClientRecord, "id" | "dietitianId">[],
): boolean {
  if (context.role === "auditor") return false;
  if (context.role === "owner" || context.role === "admin") {
    return true;
  }

  if (!notification.clientId) return false;

  const client = clients.find((item) => item.id === notification.clientId);
  if (!client) return false;

  const assignedClientIds = new Set(
    assignments
      .filter((assignment) => assignment.dietitian_id === context.dietitianId)
      .map((assignment) => assignment.client_id),
  );

  if (context.role === "assistant") {
    return assignedClientIds.has(notification.clientId);
  }

  if (context.role === "dietitian") {
    return client.dietitianId === context.dietitianId || assignedClientIds.has(notification.clientId);
  }

  return false;
}

export function canMutateStage4BNotificationReceipt(
  context: Pick<AppTenantContext, "role" | "dietitianId">,
  dietitianId: string,
) {
  if (context.role === "assistant" || context.role === "auditor") return false;
  if (context.role === "owner" || context.role === "admin" || context.role === "dietitian") {
    return context.dietitianId === dietitianId;
  }
  return false;
}

export function getNotificationReceiptForActor(
  receipts: NotificationReceiptRecord[],
  notificationId: string,
  dietitianId: string,
) {
  return receipts.find(
    (receipt) => receipt.notificationId === notificationId && receipt.dietitianId === dietitianId,
  );
}

export function isNotificationUnreadForActor(
  notificationId: string,
  dietitianId: string,
  receipts: NotificationReceiptRecord[],
) {
  const receipt = getNotificationReceiptForActor(receipts, notificationId, dietitianId);
  return !receipt?.readAt;
}

function upsertNotificationReceipt(
  state: ManuAppState,
  notificationId: string,
  dietitianId: string,
  patch: Partial<Pick<NotificationReceiptRecord, "readAt" | "acknowledgedAt">>,
  now: string,
): ManuAppState {
  const existing = getNotificationReceiptForActor(state.notificationReceipts, notificationId, dietitianId);
  if (existing) {
    return {
      ...state,
      notificationReceipts: state.notificationReceipts.map((receipt) =>
        receipt.notificationId === notificationId && receipt.dietitianId === dietitianId
          ? {
              ...receipt,
              ...patch,
              updatedAt: now,
            }
          : receipt,
      ),
    };
  }

  return {
    ...state,
    notificationReceipts: [
      ...state.notificationReceipts,
      {
        tenantId: state.tenant.id,
        notificationId,
        dietitianId,
        readAt: patch.readAt ?? null,
        acknowledgedAt: patch.acknowledgedAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

export function markNotificationReceiptReadInState(
  state: ManuAppState,
  notificationId: string,
  dietitianId: string,
  now = new Date().toISOString(),
): ManuAppState {
  return upsertNotificationReceipt(state, notificationId, dietitianId, { readAt: now }, now);
}

export function acknowledgeNotificationReceiptInState(
  state: ManuAppState,
  notificationId: string,
  dietitianId: string,
  now = new Date().toISOString(),
): ManuAppState {
  return upsertNotificationReceipt(
    state,
    notificationId,
    dietitianId,
    { readAt: now, acknowledgedAt: now },
    now,
  );
}

export function markAllVisibleNotificationReceiptsReadInState(
  state: ManuAppState,
  dietitianId: string,
  visibleNotificationIds: ReadonlySet<string>,
  now = new Date().toISOString(),
): ManuAppState {
  let next = state;
  for (const notificationId of visibleNotificationIds) {
    if (!isNotificationUnreadForActor(notificationId, dietitianId, next.notificationReceipts)) continue;
    next = markNotificationReceiptReadInState(next, notificationId, dietitianId, now);
  }
  return next;
}

export function buildTestNotification(
  input: Omit<NotificationRecord, "kind" | "priority" | "occurrenceCount" | "lastOccurredAt"> &
    Partial<Pick<NotificationRecord, "kind" | "priority" | "occurrenceCount" | "lastOccurredAt">>,
): NotificationRecord {
  return buildStage4BNotificationSeed(input);
}

export const STAGE_4B_DEDUPE_VERSION = "v1";

export const NOTIFICATION_KIND_CATEGORY: Record<NotificationKind, NotificationCategory> = {
  structured_record_update_required: "records",
  competing_authoritative_instructions: "records",
  unsupported_media_review: "conversation_review",
  visual_message_review: "conversation_review",
  visual_correction_follow_up: "conversation_review",
  voice_transcript_correction_follow_up: "conversation_review",
  safe_reply_unavailable: "conversation_review",
  draft_invalidated: "conversation_review",
  delivery_failed: "channel_delivery",
  communication_permission_closed: "channel_delivery",
  ai_window_expired: "ai_control",
  ai_paused_by_verified_human: "ai_control",
  human_control_integrity: "ai_control",
  legacy_system: "records",
  legacy_handoff: "records",
};

export const SAFE_REPLY_UNAVAILABLE_BLOCKED_REASONS = new Set([
  "approved_source_answerability_missing",
  "response_plan_not_provider_eligible",
  "claim_manifest_incomplete",
  "provider_timeout",
  "provider_policy_violation",
]);

const DELIVERY_SUCCESS_STATUSES = new Set(["sent", "delivered", "read"]);

export function resolveNotificationCategory(kind: NotificationKind): NotificationCategory {
  return NOTIFICATION_KIND_CATEGORY[kind];
}

export function buildStage4BDedupeKey(input: {
  kind: NotificationKind;
  scopeId: string;
  entityId: string;
  sourceId: string;
}): string {
  return `p85-4b:${STAGE_4B_DEDUPE_VERSION}:${input.kind}:${input.scopeId}:${input.entityId}:${input.sourceId}`;
}

export function isSafeReplyUnavailableBlockedReason(blockedReason: string | null | undefined): boolean {
  if (!blockedReason) return false;
  if (SAFE_REPLY_UNAVAILABLE_BLOCKED_REASONS.has(blockedReason)) return true;
  return blockedReason.startsWith("provider_");
}

export function shouldEmitClinicalHandoffNotification(input: {
  risk: string;
  blockedReason?: string | null;
}): boolean {
  if (input.risk === "red" || input.risk === "yellow") {
    return isSafeReplyUnavailableBlockedReason(input.blockedReason);
  }
  return isSafeReplyUnavailableBlockedReason(input.blockedReason);
}

export type SystemNotificationUpsertInput = {
  kind: NotificationKind;
  tenantId: string;
  type?: NotificationRecord["type"];
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  clientId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  handoffId?: string | null;
  sourceMessageId?: string | null;
  dedupeKey?: string;
  targetPanel?: string | null;
  baselineRevision?: number | null;
  read?: boolean;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  resolvedByDietitianId?: string | null;
  createdAt?: string;
};

function findOpenNotificationByDedupeKey(notifications: NotificationRecord[], dedupeKey: string) {
  return notifications.find((notification) => notification.dedupeKey === dedupeKey && notification.resolvedAt == null);
}

export function upsertSystemNotificationInState(
  state: ManuAppState,
  input: SystemNotificationUpsertInput,
  now = new Date().toISOString(),
): ManuAppState {
  const createdAt = input.createdAt ?? now;
  const scopeId = input.clientId ?? state.tenant.id;
  const dedupeKey =
    input.dedupeKey ??
    buildStage4BDedupeKey({
      kind: input.kind,
      scopeId,
      entityId: input.entityId,
      sourceId: input.sourceMessageId ?? input.messageId ?? input.entityId,
    });
  const existing = findOpenNotificationByDedupeKey(state.notifications, dedupeKey);

  if (existing) {
    return {
      ...state,
      notifications: state.notifications.map((notification) =>
        notification.id === existing.id
          ? normalizeNotificationRecord(
              {
                ...notification,
                title: input.title,
                body: input.body,
                occurrenceCount: notification.occurrenceCount + 1,
                lastOccurredAt: now,
                clientId: input.clientId ?? notification.clientId,
                conversationId: input.conversationId ?? notification.conversationId,
                messageId: input.messageId ?? notification.messageId,
                handoffId: input.handoffId ?? notification.handoffId,
                sourceMessageId: input.sourceMessageId ?? notification.sourceMessageId,
              },
              {
                handoffCases: state.handoffCases,
                messages: state.messages,
                conversations: state.conversations,
                clients: state.clients,
                now,
              },
            )
          : notification,
      ),
    };
  }

  const seeded = buildStage4BNotificationSeed({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    type: input.type ?? "system",
    kind: input.kind,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    body: input.body,
    read: input.read ?? false,
    acknowledgedAt: input.acknowledgedAt ?? null,
    dedupeKey,
    sourceMessageId: input.sourceMessageId ?? null,
    targetPanel: input.targetPanel ?? null,
    baselineRevision: input.baselineRevision ?? null,
    resolvedAt: input.resolvedAt ?? null,
    resolvedByDietitianId: input.resolvedByDietitianId ?? null,
    clientId: input.clientId ?? null,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    handoffId: input.handoffId ?? null,
    createdAt,
    lastOccurredAt: now,
  });

  return normalizeNotificationsInState({
    ...state,
    notifications: [...state.notifications, seeded],
  });
}

export const upsertSystemNotificationInSupabaseState = upsertSystemNotificationInState;

function resolveNotifications(
  state: ManuAppState,
  predicate: (notification: NotificationRecord) => boolean,
  map: (notification: NotificationRecord) => NotificationRecord,
  now: string,
  dietitianId?: string,
): ManuAppState {
  let changed = false;
  const notifications = state.notifications.map((notification) => {
    if (!predicate(notification)) return notification;
    changed = true;
    const next = map(notification);
    if (next.resolvedAt && !next.acknowledgedAt && dietitianId) {
      return { ...next, acknowledgedAt: now };
    }
    return next;
  });
  return changed ? { ...state, notifications } : state;
}

export function reconcileDeliveryFailedNotifications(
  state: ManuAppState,
  messageId: string,
  deliveryStatus: string,
  now = new Date().toISOString(),
) {
  if (!DELIVERY_SUCCESS_STATUSES.has(deliveryStatus)) return state;
  return resolveNotifications(
    state,
    (notification) => notification.kind === "delivery_failed" && notification.messageId === messageId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcilePermissionClosedNotifications(
  state: ManuAppState,
  clientId: string,
  permission: ClientRecord["channelPermission"],
  now = new Date().toISOString(),
) {
  if (permission !== "ready") return state;
  return resolveNotifications(
    state,
    (notification) =>
      notification.kind === "communication_permission_closed" && notification.clientId === clientId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcileSafeReplyUnavailableNotifications(
  state: ManuAppState,
  conversationId: string,
  now = new Date().toISOString(),
) {
  return resolveNotifications(
    state,
    (notification) =>
      notification.kind === "safe_reply_unavailable" && notification.conversationId === conversationId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcileAiPausedByVerifiedHumanNotifications(
  state: ManuAppState,
  clientId: string,
  now = new Date().toISOString(),
) {
  return resolveNotifications(
    state,
    (notification) => notification.kind === "ai_paused_by_verified_human" && notification.clientId === clientId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcileDraftInvalidatedNotifications(
  state: ManuAppState,
  conversationId: string,
  now = new Date().toISOString(),
) {
  return resolveNotifications(
    state,
    (notification) => notification.kind === "draft_invalidated" && notification.conversationId === conversationId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcileCompetingInstructionNotifications(
  state: ManuAppState,
  clientId: string,
  contextRevision: number,
  now = new Date().toISOString(),
) {
  return resolveNotifications(
    state,
    (notification) =>
      notification.kind === "competing_authoritative_instructions" &&
      notification.clientId === clientId &&
      notification.baselineRevision != null &&
      contextRevision > notification.baselineRevision,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function reconcileHumanControlIntegrityNotifications(
  state: ManuAppState,
  clientId: string,
  now = new Date().toISOString(),
) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return state;
  const lockedHandoffId = client.redRiskLock.status === "locked" ? client.redRiskLock.handoffId : null;
  const consistent =
    client.redRiskLock.status !== "locked" ||
    state.humanControlSessions.some(
      (session) =>
        session.clientId === clientId &&
        session.status === "active" &&
        session.reason === "red_risk_lock" &&
        session.linkedHandoffId === lockedHandoffId,
    );
  if (!consistent) return state;
  return resolveNotifications(
    state,
    (notification) => notification.kind === "human_control_integrity" && notification.clientId === clientId,
    (notification) => ({
      ...notification,
      resolvedAt: now,
      resolvedByDietitianId: state.dietitian.id,
    }),
    now,
    state.dietitian.id,
  );
}

export function completeUnsupportedMediaReviewInState(
  state: ManuAppState,
  notificationId: string,
  dietitianId: string,
  now = new Date().toISOString(),
): ManuAppState {
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (!notification || notification.kind !== "unsupported_media_review" || notification.resolvedAt) {
    throw new AppDomainError(409, "unsupported_media_review_not_completable");
  }
  const receipt = getNotificationReceiptForActor(state.notificationReceipts, notificationId, dietitianId);
  if (!receipt?.readAt || !receipt.acknowledgedAt) {
    throw new AppDomainError(409, "unsupported_media_review_requires_acknowledged_receipt");
  }
  const withResolution = {
    ...state,
    notifications: state.notifications.map((item) =>
      item.id === notificationId
        ? {
            ...item,
            resolvedAt: now,
            resolvedByDietitianId: dietitianId,
            acknowledgedAt: item.acknowledgedAt ?? now,
          }
        : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "unsupported_media_review_completed",
        entityType: "notification",
        entityId: notificationId,
        metadata: { clientId: notification.clientId, dietitianId },
        createdAt: now,
      },
    ],
  };
  return acknowledgeNotificationReceiptInState(withResolution, notificationId, dietitianId, now);
}

export function emitSafeReplyUnavailableNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    messageId: string;
    blockedReason: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  if (!isSafeReplyUnavailableBlockedReason(input.blockedReason)) return state;
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "safe_reply_unavailable",
      tenantId: state.tenant.id,
      entityType: "conversation",
      entityId: input.conversationId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      sourceMessageId: input.messageId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "safe_reply_unavailable",
        scopeId: input.clientId,
        entityId: input.conversationId,
        sourceId: input.blockedReason,
      }),
      title: "Safe reply unavailable",
      body: `A safe automated reply could not be sent for ${input.clientName}. Review the conversation and respond manually.`,
      createdAt: now,
    },
    now,
  );
}

export function emitDeliveryFailedNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    messageId: string;
    deliveryId: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "delivery_failed",
      tenantId: state.tenant.id,
      entityType: "message",
      entityId: input.messageId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "delivery_failed",
        scopeId: input.clientId,
        entityId: input.messageId,
        sourceId: input.deliveryId,
      }),
      title: "Message delivery failed",
      body: `An outbound message for ${input.clientName} could not be delivered. Review channel delivery status.`,
      createdAt: now,
    },
    now,
  );
}

export function emitCommunicationPermissionClosedNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    clientName: string;
    permission: ClientRecord["channelPermission"];
    now?: string;
  },
): ManuAppState {
  if (input.permission === "ready") return state;
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "communication_permission_closed",
      tenantId: state.tenant.id,
      entityType: "client",
      entityId: input.clientId,
      clientId: input.clientId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "communication_permission_closed",
        scopeId: input.clientId,
        entityId: input.clientId,
        sourceId: input.permission,
      }),
      title: "Communication permission closed",
      body: `Outbound communication is blocked for ${input.clientName} until permission is restored.`,
      createdAt: now,
    },
    now,
  );
}

export function emitDraftInvalidatedNotifications(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    clientName: string;
    decisionIds: string[];
    reason: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return input.decisionIds.reduce(
    (next, decisionId) =>
      upsertSystemNotificationInState(
        next,
        {
          kind: "draft_invalidated",
          tenantId: state.tenant.id,
          entityType: "ai_decision",
          entityId: decisionId,
          clientId: input.clientId,
          conversationId: input.conversationId,
          dedupeKey: buildStage4BDedupeKey({
            kind: "draft_invalidated",
            scopeId: input.clientId,
            entityId: decisionId,
            sourceId: input.reason,
          }),
          title: "Draft invalidated",
          body: `A pending AI draft for ${input.clientName} was invalidated and needs review.`,
          createdAt: now,
        },
        now,
      ),
    state,
  );
}

export function emitAiPausedByVerifiedHumanNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    messageId: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "ai_paused_by_verified_human",
      tenantId: state.tenant.id,
      entityType: "conversation",
      entityId: input.conversationId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      sourceMessageId: input.messageId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "ai_paused_by_verified_human",
        scopeId: input.clientId,
        entityId: input.conversationId,
        sourceId: input.messageId,
      }),
      title: "AI paused by verified human activity",
      body: `AI was paused for ${input.clientName} after verified human activity on the conversation.`,
      createdAt: now,
    },
    now,
  );
}

export function emitAiWindowExpiredNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "ai_window_expired",
      tenantId: state.tenant.id,
      type: "system",
      entityType: "client",
      entityId: input.clientId,
      clientId: input.clientId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "ai_window_expired",
        scopeId: input.clientId,
        entityId: input.clientId,
        sourceId: "window_expired",
      }),
      title: `AI window expired: ${input.clientName}`,
      body: `AI was passivated for ${input.clientName} because the activation window ended.`,
      createdAt: now,
    },
    now,
  );
}

export function emitHumanControlIntegrityNotification(
  state: ManuAppState,
  input: {
    clientId: string;
    clientName: string;
    issueCode: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "human_control_integrity",
      tenantId: state.tenant.id,
      entityType: "client",
      entityId: input.clientId,
      clientId: input.clientId,
      dedupeKey: buildStage4BDedupeKey({
        kind: "human_control_integrity",
        scopeId: input.clientId,
        entityId: input.clientId,
        sourceId: input.issueCode,
      }),
      title: "Human control integrity review required",
      body: `Human-control state for ${input.clientName} needs review before automation can resume safely.`,
      createdAt: now,
    },
    now,
  );
}

export function reconcileStage4BNotificationsForClient(
  state: ManuAppState,
  clientId: string,
  now = new Date().toISOString(),
) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return state;
  let next = reconcilePermissionClosedNotifications(state, clientId, client.channelPermission, now);
  next = reconcileCompetingInstructionNotifications(next, clientId, client.contextRevision, now);
  next = reconcileAiPausedByVerifiedHumanNotifications(next, clientId, now);
  const currentClient = next.clients.find((item) => item.id === clientId);
  const activeSession = next.humanControlSessions.find(
    (session) => session.clientId === clientId && session.status === "active",
  );
  const redLockConsistent =
    currentClient?.redRiskLock.status !== "locked" ||
    Boolean(
      currentClient?.redRiskLock.status === "locked" &&
      activeSession &&
        activeSession.reason === "red_risk_lock" &&
        activeSession.linkedHandoffId === currentClient.redRiskLock.handoffId,
    );
  const takeoverLockRequired =
    activeSession != null &&
    activeSession.reason !== "yellow_risk_hold";
  const humanControlConsistent = client.humanTakeoverLocked === takeoverLockRequired && redLockConsistent;
  if (humanControlConsistent) {
    next = reconcileHumanControlIntegrityNotifications(next, clientId, now);
  } else {
    next = emitHumanControlIntegrityNotification(next, {
      clientId,
      clientName: client.fullName,
      issueCode: "human_control_lock_session_mismatch",
      now,
    });
  }
  return next;
}

export function buildStage4BNotificationSeed(
  input: Omit<NotificationRecord, "kind" | "priority" | "occurrenceCount" | "lastOccurredAt"> &
    Partial<Pick<NotificationRecord, "kind" | "priority" | "occurrenceCount" | "lastOccurredAt">>,
): NotificationRecord {
  const kind = input.kind ?? classifyLegacyNotificationKind(input);
  const timestamp = input.lastOccurredAt ?? input.createdAt;
  return {
    ...input,
    kind,
    priority: input.priority ?? resolveNotificationPriority(kind),
    occurrenceCount: input.occurrenceCount ?? 1,
    lastOccurredAt: timestamp,
  };
}

export function normalizeNotificationsInState(state: ManuAppState): ManuAppState {
  return {
    ...state,
    notifications: state.notifications.map((notification) =>
      normalizeNotificationRecord(notification, {
        handoffCases: state.handoffCases,
        messages: state.messages,
        conversations: state.conversations,
        clients: state.clients,
      }),
    ),
  };
}
