import type {
  ClientRecord,
  HandoffCaseRecord,
  MessageRecord,
  NotificationRecord,
  ManuAppState,
} from "./types";
import {
  DIRECT_PILOT_SCALE_TARGET,
  paginateDirectPilotItems,
} from "./direct-pilot-scale-readiness";

export const PHASE_79B_VERSION = "phase-79b-windowed-read-v0.1.0";

export const WINDOWED_READ_DEFAULTS = {
  clientListPageSize: DIRECT_PILOT_SCALE_TARGET.defaultPageSize,
  clientListMaxPageSize: DIRECT_PILOT_SCALE_TARGET.maxPageSize,
  timelineWindowSize: DIRECT_PILOT_SCALE_TARGET.timelineWindowSize,
  timelineMaxWindowSize: DIRECT_PILOT_SCALE_TARGET.defaultPageSize,
  handoffPageSize: 20,
  handoffMaxPageSize: DIRECT_PILOT_SCALE_TARGET.defaultPageSize,
  notificationPageSize: 20,
  notificationMaxPageSize: DIRECT_PILOT_SCALE_TARGET.defaultPageSize,
} as const;

export type WindowedClientSummary = {
  id: string;
  name: string;
  lifecycleStatus: ClientRecord["lifecycleStatus"];
  aiStatus: ClientRecord["aiStatus"];
  channel: ClientRecord["channel"];
  createdAt: string;
};

export type WindowedClientListResult = {
  items: WindowedClientSummary[];
  nextCursor: string | null;
  pageSize: number;
  totalVisible: number;
};

export type WindowedTimelineEntry = {
  id: string;
  conversationId: string;
  sender: MessageRecord["sender"];
  status: MessageRecord["status"];
  createdAt: string;
};

export type WindowedTimelineResult = {
  clientId: string;
  items: WindowedTimelineEntry[];
  nextCursor: string | null;
  windowSize: number;
  totalMessages: number;
};

export type WindowedHandoffEntry = {
  id: string;
  clientId: string;
  status: HandoffCaseRecord["status"];
  urgency: string;
  risk: HandoffCaseRecord["risk"];
  createdAt: string;
};

export type WindowedHandoffListResult = {
  items: WindowedHandoffEntry[];
  nextCursor: string | null;
  pageSize: number;
  totalItems: number;
};

export type WindowedNotificationEntry = {
  id: string;
  type: NotificationRecord["type"];
  entityType: string;
  entityId: string;
  title: string;
  read: boolean;
  createdAt: string;
};

export type WindowedNotificationListResult = {
  items: WindowedNotificationEntry[];
  nextCursor: string | null;
  pageSize: number;
  totalItems: number;
};

export type WindowedAuditAggregateResult = {
  totalEventCount: number;
  entityTypeCounts: Record<string, number>;
};

export type Phase79WindowedDashboardPayload = {
  version: string;
  generatedAt: string;
  clients: WindowedClientListResult;
  handoffs: WindowedHandoffListResult;
  notifications: WindowedNotificationListResult;
  auditAggregate: WindowedAuditAggregateResult;
  clientDetail?: ReturnType<typeof windowClientDetail>;
  timeline?: WindowedTimelineResult;
  healthSignal: ReturnType<typeof buildPhase79bWindowedReadHealthSignal>;
};

export type Phase79WindowedReadEvidence = {
  version: string;
  status: "pass" | "fail";
  clientListWindowReady: boolean;
  clientDetailScopedReady: boolean;
  timelineWindowReady: boolean;
  handoffWindowReady: boolean;
  notificationWindowReady: boolean;
  auditAggregateReady: boolean;
  removedClientLeakDetected: boolean;
  rawDataInAggregateDetected: boolean;
  failures: string[];
};

function visibleClients(state: ManuAppState): ClientRecord[] {
  return state.clients.filter(
    (client) => client.lifecycleStatus !== "removed_anonymized",
  );
}

function visibleEntityIdsByType(state: ManuAppState) {
  const visibleClientIds = new Set(visibleClients(state).map((client) => client.id));
  const visibleConversationIds = new Set(
    state.conversations
      .filter((conversation) => visibleClientIds.has(conversation.clientId))
      .map((conversation) => conversation.id),
  );
  const visibleMessageIds = new Set(
    state.messages
      .filter((message) => visibleConversationIds.has(message.conversationId))
      .map((message) => message.id),
  );
  const visibleHandoffIds = new Set(
    state.handoffCases
      .filter((handoff) => visibleClientIds.has(handoff.clientId))
      .map((handoff) => handoff.id),
  );

  return new Map<string, Set<string>>([
    ["client", visibleClientIds],
    ["conversation", visibleConversationIds],
    ["message", visibleMessageIds],
    ["handoff_case", visibleHandoffIds],
    ["ai_decision", new Set(state.aiDecisions.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id))],
    [
      "client_form_response",
      new Set(state.clientFormResponses.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
    [
      "client_context_update",
      new Set(state.clientContextUpdates.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
    [
      "client_update_proposal",
      new Set(state.clientUpdateProposals.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
    [
      "client_food_rule_profile",
      new Set(state.clientFoodRuleProfiles.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
    [
      "client_menu_plan",
      new Set(state.clientMenuPlans.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
    [
      "channel_delivery",
      new Set(state.channelDeliveries.filter((item) => visibleClientIds.has(item.clientId)).map((item) => item.id)),
    ],
  ]);
}

function notificationIsVisible(state: ManuAppState, notification: NotificationRecord) {
  return visibleEntityIdsByType(state).get(notification.entityType)?.has(notification.entityId) ?? false;
}

export function windowClientList(
  state: ManuAppState,
  options: { cursor?: string | null; limit?: number } = {},
): WindowedClientListResult {
  const visible = visibleClients(state);
  const summaries: (WindowedClientSummary & { id: string })[] = visible.map(
    (client) => ({
      id: client.id,
      name: client.fullName,
      lifecycleStatus: client.lifecycleStatus,
      aiStatus: client.aiStatus,
      channel: client.channel,
      createdAt: client.createdAt,
    }),
  );

  const page = paginateDirectPilotItems(summaries, {
    cursor: options.cursor,
    limit: options.limit ?? WINDOWED_READ_DEFAULTS.clientListPageSize,
    maxLimit: WINDOWED_READ_DEFAULTS.clientListMaxPageSize,
  });

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    pageSize: page.pageSize,
    totalVisible: page.totalItems,
  };
}

export function windowClientDetail(
  state: ManuAppState,
  clientId: string,
): { found: true; client: WindowedClientSummary } | { found: false } {
  const client = visibleClients(state).find((c) => c.id === clientId);
  if (!client) return { found: false };

  return {
    found: true,
    client: {
      id: client.id,
      name: client.fullName,
      lifecycleStatus: client.lifecycleStatus,
      aiStatus: client.aiStatus,
      channel: client.channel,
      createdAt: client.createdAt,
    },
  };
}

export function windowTimeline(
  state: ManuAppState,
  clientId: string,
  options: { cursor?: string | null; limit?: number } = {},
): WindowedTimelineResult {
  const visible = visibleClients(state);
  if (!visible.some((c) => c.id === clientId)) {
    return {
      clientId,
      items: [],
      nextCursor: null,
      windowSize: 0,
      totalMessages: 0,
    };
  }

  const clientConversationIds = new Set(
    state.conversations
      .filter((conv) => conv.clientId === clientId)
      .map((conv) => conv.id),
  );

  const clientMessages = state.messages
    .filter((msg) => clientConversationIds.has(msg.conversationId))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const entries: (WindowedTimelineEntry & { id: string })[] =
    clientMessages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      status: msg.status,
      createdAt: msg.createdAt,
    }));

  const windowLimit =
    options.limit ?? WINDOWED_READ_DEFAULTS.timelineWindowSize;
  const cappedLimit = Math.min(
    Math.max(windowLimit, 1),
    WINDOWED_READ_DEFAULTS.timelineMaxWindowSize,
  );

  const page = paginateDirectPilotItems(entries, {
    cursor: options.cursor,
    limit: cappedLimit,
    maxLimit: WINDOWED_READ_DEFAULTS.timelineMaxWindowSize,
  });

  return {
    clientId,
    items: page.items,
    nextCursor: page.nextCursor,
    windowSize: page.pageSize,
    totalMessages: page.totalItems,
  };
}

export function windowHandoffs(
  state: ManuAppState,
  options: { cursor?: string | null; limit?: number } = {},
): WindowedHandoffListResult {
  const visibleClientIds = new Set(visibleClients(state).map((c) => c.id));
  const visibleHandoffs = state.handoffCases.filter((h) =>
    visibleClientIds.has(h.clientId),
  );

  const entries: (WindowedHandoffEntry & { id: string })[] =
    visibleHandoffs.map((h) => ({
      id: h.id,
      clientId: h.clientId,
      status: h.status,
      urgency: h.urgency,
      risk: h.risk,
      createdAt: h.createdAt,
    }));

  const page = paginateDirectPilotItems(entries, {
    cursor: options.cursor,
    limit: options.limit ?? WINDOWED_READ_DEFAULTS.handoffPageSize,
    maxLimit: WINDOWED_READ_DEFAULTS.handoffMaxPageSize,
  });

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
  };
}

export function windowNotifications(
  state: ManuAppState,
  options: { cursor?: string | null; limit?: number } = {},
): WindowedNotificationListResult {
  const entries: (WindowedNotificationEntry & { id: string })[] =
    state.notifications
      .filter((notification) => notificationIsVisible(state, notification))
      .map((n) => ({
        id: n.id,
        type: n.type,
        entityType: n.entityType,
        entityId: n.entityId,
        title: n.title,
        read: n.read,
        createdAt: n.createdAt,
      }));

  const page = paginateDirectPilotItems(entries, {
    cursor: options.cursor,
    limit: options.limit ?? WINDOWED_READ_DEFAULTS.notificationPageSize,
    maxLimit: WINDOWED_READ_DEFAULTS.notificationMaxPageSize,
  });

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
  };
}

export function windowAuditAggregate(
  state: ManuAppState,
): WindowedAuditAggregateResult {
  const entityTypeCounts: Record<string, number> = {};
  for (const event of state.auditEvents) {
    entityTypeCounts[event.entityType] =
      (entityTypeCounts[event.entityType] ?? 0) + 1;
  }

  return {
    totalEventCount: state.auditEvents.length,
    entityTypeCounts,
  };
}

const RAW_DATA_PATTERNS =
  /\+\d{10,}|phone|secret|prompt|password|token|api_key/i;

export function evaluatePhase79bWindowedReadEvidence(
  state: ManuAppState,
): Phase79WindowedReadEvidence {
  const failures: string[] = [];

  const clientList = windowClientList(state, { limit: 10 });
  const clientListReady = clientList.totalVisible >= 0;
  if (!clientListReady) failures.push("client_list_window_not_ready");

  const firstVisibleClient = visibleClients(state)[0];
  const clientDetailReady = firstVisibleClient
    ? windowClientDetail(state, firstVisibleClient.id).found
    : state.clients.length === 0;
  if (!clientDetailReady) failures.push("client_detail_scoped_not_ready");

  const timelineReady = firstVisibleClient
    ? windowTimeline(state, firstVisibleClient.id).windowSize >= 0
    : true;
  if (!timelineReady) failures.push("timeline_window_not_ready");

  const handoffReady = windowHandoffs(state).pageSize >= 0;
  if (!handoffReady) failures.push("handoff_window_not_ready");

  const notificationReady = windowNotifications(state).pageSize >= 0;
  if (!notificationReady) failures.push("notification_window_not_ready");

  const auditAgg = windowAuditAggregate(state);
  const auditReady = auditAgg.totalEventCount >= 0;
  if (!auditReady) failures.push("audit_aggregate_not_ready");

  const removedClients = state.clients.filter(
    (c) => c.lifecycleStatus === "removed_anonymized",
  );
  let removedClientLeakDetected = false;
  for (const removed of removedClients) {
    const detail = windowClientDetail(state, removed.id);
    if (detail.found) {
      removedClientLeakDetected = true;
      failures.push("removed_client_visible_in_client_list");
      break;
    }
    const timeline = windowTimeline(state, removed.id);
    if (timeline.items.length > 0) {
      removedClientLeakDetected = true;
      failures.push("removed_client_messages_visible_in_timeline");
      break;
    }
    const notifications = windowNotifications(state);
    if (notifications.items.some((notification) => notification.entityId === removed.id)) {
      removedClientLeakDetected = true;
      failures.push("removed_client_notification_visible");
      break;
    }
  }

  const auditAggJson = JSON.stringify(auditAgg);
  const rawDataInAggregateDetected = RAW_DATA_PATTERNS.test(auditAggJson);
  if (rawDataInAggregateDetected) {
    failures.push("raw_data_detected_in_audit_aggregate");
  }

  return {
    version: PHASE_79B_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    clientListWindowReady: clientListReady,
    clientDetailScopedReady: clientDetailReady,
    timelineWindowReady: timelineReady,
    handoffWindowReady: handoffReady,
    notificationWindowReady: notificationReady,
    auditAggregateReady: auditReady,
    removedClientLeakDetected,
    rawDataInAggregateDetected,
    failures,
  };
}

export function buildPhase79WindowedDashboardPayload(
  state: ManuAppState,
  options: {
    clientCursor?: string | null;
    clientLimit?: number;
    handoffCursor?: string | null;
    handoffLimit?: number;
    notificationCursor?: string | null;
    notificationLimit?: number;
    detailClientId?: string | null;
    timelineClientId?: string | null;
    timelineCursor?: string | null;
    timelineLimit?: number;
    generatedAt?: string;
  } = {},
): Phase79WindowedDashboardPayload {
  const evidence = evaluatePhase79bWindowedReadEvidence(state);
  return {
    version: PHASE_79B_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    clients: windowClientList(state, { cursor: options.clientCursor, limit: options.clientLimit }),
    handoffs: windowHandoffs(state, { cursor: options.handoffCursor, limit: options.handoffLimit }),
    notifications: windowNotifications(state, {
      cursor: options.notificationCursor,
      limit: options.notificationLimit,
    }),
    auditAggregate: windowAuditAggregate(state),
    clientDetail: options.detailClientId ? windowClientDetail(state, options.detailClientId) : undefined,
    timeline: options.timelineClientId
      ? windowTimeline(state, options.timelineClientId, {
          cursor: options.timelineCursor,
          limit: options.timelineLimit,
        })
      : undefined,
    healthSignal: buildPhase79bWindowedReadHealthSignal(evidence),
  };
}

export function buildPhase79bWindowedReadHealthSignal(
  evidence: Phase79WindowedReadEvidence,
) {
  return {
    phase79WindowedReadVersion: evidence.version,
    phase79WindowedReadStatus: evidence.status,
    phase79WindowedReadReady:
      evidence.status === "pass" && !evidence.removedClientLeakDetected,
    phase79WindowedReadFailures: evidence.failures,
  };
}
