import { AppDomainError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import {
  CLINICAL_ALERT_SEVERITY_RANK,
  type ClinicalAlertListItem,
  type ClinicalAlertsListResponse,
  type NotificationCategory,
  type NotificationKind,
  type NotificationPriority,
  type NotificationReceiptRecord,
  type Stage4BNavigationSection,
  type Stage4BNavigationTarget,
  type Stage4BNotificationMutationResponse,
  type Stage4BNotificationReadAllResponse,
  type SystemNotificationListItem,
  type SystemNotificationsListResponse,
} from "./phase-85-stage-4b-contracts";
import {
  filterClinicalAlerts,
  projectClinicalAlertsFromState,
  sortClinicalAlerts,
  type ClinicalAlertFilterSeverity,
} from "./phase-85-stage-4b-alerts";
import {
  getNotificationReceiptForActor,
  isStage4BNotificationVisible,
  normalizeNotificationsInState,
  resolveNotificationCategory,
  resolveNotificationPriority,
} from "./phase-85-stage-4b-notifications";
import type { ClientRecord, ManuAppState, NotificationRecord } from "./types";

export const PHASE_85_STAGE_4B_API_VERSION = "p85-stage-4b-api-v1";
export const STAGE_4B_DEFAULT_PAGE_SIZE = 30;
export const STAGE_4B_MAX_PAGE_SIZE = 100;
export const STAGE_4B_MAX_QUERY_LENGTH = 80;
export const STAGE_4B_CURSOR_VERSION = 1;

export type NotificationListStatus = "active" | "unread" | "history";

export type DbClientAssignment = {
  client_id: string;
  dietitian_id: string;
};

const NOTIFICATION_PRIORITY_RANK: Record<NotificationPriority, number> = {
  intervention_required: 0,
  review_required: 1,
  info: 2,
};

const NOTIFICATION_KIND_I18N_KEYS: Record<
  NotificationKind,
  { titleKey: string; summaryKey: string }
> = {
  structured_record_update_required: {
    titleKey: "notificationTitleStructuredRecordUpdateRequired",
    summaryKey: "notificationSummaryStructuredRecordUpdateRequired",
  },
  competing_authoritative_instructions: {
    titleKey: "notificationTitleCompetingAuthoritativeInstructions",
    summaryKey: "notificationSummaryCompetingAuthoritativeInstructions",
  },
  unsupported_media_review: {
    titleKey: "notificationTitleUnsupportedMediaReview",
    summaryKey: "notificationSummaryUnsupportedMediaReview",
  },
  safe_reply_unavailable: {
    titleKey: "notificationTitleSafeReplyUnavailable",
    summaryKey: "notificationSummarySafeReplyUnavailable",
  },
  delivery_failed: {
    titleKey: "notificationTitleDeliveryFailed",
    summaryKey: "notificationSummaryDeliveryFailed",
  },
  communication_permission_closed: {
    titleKey: "notificationTitleCommunicationPermissionClosed",
    summaryKey: "notificationSummaryCommunicationPermissionClosed",
  },
  ai_window_expired: {
    titleKey: "notificationTitleAiWindowExpired",
    summaryKey: "notificationSummaryAiWindowExpired",
  },
  ai_paused_by_verified_human: {
    titleKey: "notificationTitleAiPausedByVerifiedHuman",
    summaryKey: "notificationSummaryAiPausedByVerifiedHuman",
  },
  draft_invalidated: {
    titleKey: "notificationTitleDraftInvalidated",
    summaryKey: "notificationSummaryDraftInvalidated",
  },
  human_control_integrity: {
    titleKey: "notificationTitleHumanControlIntegrity",
    summaryKey: "notificationSummaryHumanControlIntegrity",
  },
  legacy_system: {
    titleKey: "notificationTitleLegacySystem",
    summaryKey: "notificationSummaryLegacySystem",
  },
  legacy_handoff: {
    titleKey: "notificationTitleLegacyHandoff",
    summaryKey: "notificationSummaryLegacyHandoff",
  },
};

type AlertCursorPayload = {
  v: number;
  severityRank: number;
  startedAt: string;
  id: string;
};

type NotificationActiveCursorPayload = {
  v: number;
  mode: "active" | "unread";
  priorityRank: number;
  lastOccurredAt: string;
  id: string;
};

type NotificationHistoryCursorPayload = {
  v: number;
  mode: "history";
  historyAt: string;
  id: string;
};

export function resolveVisibleClientIds(
  clients: ClientRecord[],
  context: AppTenantContext,
  assignments: DbClientAssignment[],
) {
  if (context.role === "owner" || context.role === "admin") {
    return new Set(clients.map((client) => client.id));
  }
  if (context.role === "auditor") {
    return new Set<string>();
  }

  const assignedClientIds = new Set(
    assignments
      .filter((assignment) => assignment.dietitian_id === context.dietitianId)
      .map((assignment) => assignment.client_id),
  );

  if (context.role === "assistant") {
    return assignedClientIds;
  }

  if (context.role === "dietitian") {
    return new Set(
      clients
        .filter((client) => client.dietitianId === context.dietitianId || assignedClientIds.has(client.id))
        .map((client) => client.id),
    );
  }

  return new Set<string>();
}

export function parseStage4BLimit(value: string | null | undefined) {
  if (value == null || value.trim() === "") return STAGE_4B_DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppDomainError(400, "invalid_limit");
  }
  return Math.min(parsed, STAGE_4B_MAX_PAGE_SIZE);
}

export function parseStage4BQuery(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length > STAGE_4B_MAX_QUERY_LENGTH) {
    throw new AppDomainError(400, "invalid_query");
  }
  return trimmed;
}

export function parseAlertSeverityFilter(value: string | null | undefined): ClinicalAlertFilterSeverity {
  if (!value || value === "all") return "all";
  if (value === "red" || value === "yellow") return value;
  throw new AppDomainError(400, "invalid_severity_filter");
}

export function parseNotificationStatusFilter(value: string | null | undefined): NotificationListStatus {
  if (!value || value === "active") return "active";
  if (value === "unread" || value === "history") return value;
  throw new AppDomainError(400, "invalid_status_filter");
}

export function parseNotificationPriorityFilter(value: string | null | undefined): NotificationPriority | null {
  if (!value) return null;
  if (value === "intervention_required" || value === "review_required" || value === "info") return value;
  throw new AppDomainError(400, "invalid_priority_filter");
}

export function parseNotificationCategoryFilter(value: string | null | undefined): NotificationCategory | null {
  if (!value) return null;
  if (
    value === "records" ||
    value === "conversation_review" ||
    value === "channel_delivery" ||
    value === "ai_control"
  ) {
    return value;
  }
  throw new AppDomainError(400, "invalid_category_filter");
}

function encodeCursor(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursorValue<T extends { v: number }>(
  value: string | null | undefined,
  validate?: (parsed: T) => void,
): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
    if (parsed.v !== STAGE_4B_CURSOR_VERSION) {
      throw new AppDomainError(400, "invalid_cursor");
    }
    validate?.(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof AppDomainError) throw error;
    throw new AppDomainError(400, "invalid_cursor");
  }
}

export function decodeAlertCursor(value: string | null | undefined) {
  return decodeCursorValue<AlertCursorPayload>(value, (parsed) => {
    if (
      typeof parsed.severityRank !== "number" ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new AppDomainError(400, "invalid_cursor");
    }
  });
}

export function decodeNotificationCursor(
  status: NotificationListStatus,
  value: string | null | undefined,
): NotificationActiveCursorPayload | NotificationHistoryCursorPayload | null {
  if (status === "history") {
    return decodeCursorValue<NotificationHistoryCursorPayload>(value, (parsed) => {
      if (parsed.mode !== "history" || typeof parsed.historyAt !== "string" || typeof parsed.id !== "string") {
        throw new AppDomainError(400, "invalid_cursor");
      }
    });
  }
  return decodeCursorValue<NotificationActiveCursorPayload>(value, (parsed) => {
    if (
      (parsed.mode !== "active" && parsed.mode !== "unread") ||
      typeof parsed.priorityRank !== "number" ||
      typeof parsed.lastOccurredAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new AppDomainError(400, "invalid_cursor");
    }
    if (parsed.mode !== status) {
      throw new AppDomainError(400, "invalid_cursor");
    }
  });
}

function compareAlertCursor(left: ClinicalAlertListItem, cursor: AlertCursorPayload) {
  const leftRank = CLINICAL_ALERT_SEVERITY_RANK[left.severity];
  if (leftRank !== cursor.severityRank) return leftRank - cursor.severityRank;
  const leftStarted = Date.parse(left.startedAt);
  const cursorStarted = Date.parse(cursor.startedAt);
  if (leftStarted !== cursorStarted) return cursorStarted - leftStarted;
  return left.id.localeCompare(cursor.id);
}

function isAlertAfterCursor(alert: ClinicalAlertListItem, cursor: AlertCursorPayload) {
  return compareAlertCursor(alert, cursor) > 0;
}

function compareActiveNotificationCursor(left: SystemNotificationListItem, cursor: NotificationActiveCursorPayload) {
  const leftRank = NOTIFICATION_PRIORITY_RANK[left.priority];
  if (leftRank !== cursor.priorityRank) return leftRank - cursor.priorityRank;
  const leftOccurred = Date.parse(left.lastOccurredAt);
  const cursorOccurred = Date.parse(cursor.lastOccurredAt);
  if (leftOccurred !== cursorOccurred) return cursorOccurred - leftOccurred;
  return left.id.localeCompare(cursor.id);
}

function isActiveNotificationAfterCursor(item: SystemNotificationListItem, cursor: NotificationActiveCursorPayload) {
  return compareActiveNotificationCursor(item, cursor) > 0;
}

function compareHistoryNotificationCursor(left: SystemNotificationListItem, cursor: NotificationHistoryCursorPayload) {
  const leftHistoryAt = resolveNotificationHistoryTimestamp(left);
  const cursorHistoryAt = Date.parse(cursor.historyAt);
  if (leftHistoryAt !== cursorHistoryAt) return cursorHistoryAt - leftHistoryAt;
  return left.id.localeCompare(cursor.id);
}

function isHistoryNotificationAfterCursor(item: SystemNotificationListItem, cursor: NotificationHistoryCursorPayload) {
  return compareHistoryNotificationCursor(item, cursor) > 0;
}

function paginateAlerts(items: ClinicalAlertListItem[], limit: number, cursor: AlertCursorPayload | null) {
  const sorted = sortClinicalAlerts(items);
  const startIndex = cursor ? sorted.findIndex((item) => isAlertAfterCursor(item, cursor)) : 0;
  const safeStart = startIndex < 0 ? sorted.length : startIndex;
  const page = sorted.slice(safeStart, safeStart + limit);
  const last = page.at(-1);
  const nextCursor =
    safeStart + page.length < sorted.length && last
      ? encodeCursor({
          v: STAGE_4B_CURSOR_VERSION,
          severityRank: CLINICAL_ALERT_SEVERITY_RANK[last.severity],
          startedAt: last.startedAt,
          id: last.id,
        })
      : null;
  return { items: page, nextCursor };
}

function paginateNotifications(
  items: SystemNotificationListItem[],
  status: NotificationListStatus,
  limit: number,
  cursor: NotificationActiveCursorPayload | NotificationHistoryCursorPayload | null,
) {
  const sorted = sortSystemNotificationListItems(items, status);
  const startIndex =
    cursor == null
      ? 0
      : status === "history"
        ? sorted.findIndex((item) => isHistoryNotificationAfterCursor(item, cursor as NotificationHistoryCursorPayload))
        : sorted.findIndex((item) => isActiveNotificationAfterCursor(item, cursor as NotificationActiveCursorPayload));
  const safeStart = startIndex < 0 ? sorted.length : startIndex;
  const page = sorted.slice(safeStart, safeStart + limit);
  const last = page.at(-1);
  let nextCursor: string | null = null;
  if (safeStart + page.length < sorted.length && last) {
    nextCursor =
      status === "history"
        ? encodeCursor({
            v: STAGE_4B_CURSOR_VERSION,
            mode: "history",
            historyAt: new Date(resolveNotificationHistoryTimestamp(last)).toISOString(),
            id: last.id,
          })
        : encodeCursor({
            v: STAGE_4B_CURSOR_VERSION,
            mode: status,
            priorityRank: NOTIFICATION_PRIORITY_RANK[last.priority],
            lastOccurredAt: last.lastOccurredAt,
            id: last.id,
          });
  }
  return { items: page, nextCursor };
}

function sortSystemNotificationListItems(items: SystemNotificationListItem[], status: NotificationListStatus) {
  return [...items].sort((left, right) => {
    if (status === "history") {
      const historyDelta = resolveNotificationHistoryTimestamp(right) - resolveNotificationHistoryTimestamp(left);
      if (historyDelta !== 0) return historyDelta;
      return left.id.localeCompare(right.id);
    }
    const priorityDelta = NOTIFICATION_PRIORITY_RANK[left.priority] - NOTIFICATION_PRIORITY_RANK[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const occurredDelta = Date.parse(right.lastOccurredAt) - Date.parse(left.lastOccurredAt);
    if (occurredDelta !== 0) return occurredDelta;
    return left.id.localeCompare(right.id);
  });
}

function resolveNotificationHistoryTimestamp(item: SystemNotificationListItem) {
  if (item.resolvedAt) return Date.parse(item.resolvedAt);
  if (item.readAt) return Date.parse(item.readAt);
  return Date.parse(item.lastOccurredAt);
}

function normalizeSearchQuery(value: string) {
  return value.trim().slice(0, STAGE_4B_MAX_QUERY_LENGTH).toLocaleLowerCase("tr");
}

function matchesNotificationSearch(item: SystemNotificationListItem, query: string) {
  if (!query) return true;
  const normalized = normalizeSearchQuery(query);
  const clientName = item.clientFullName ? normalizeSearchQuery(item.clientFullName) : "";
  const titleKey = normalizeSearchQuery(item.titleKey);
  return clientName.includes(normalized) || titleKey.includes(normalized);
}

export function buildNotificationNavigationTarget(
  notification: Pick<
    NotificationRecord,
    "id" | "kind" | "clientId" | "conversationId" | "messageId" | "entityType" | "entityId"
  >,
  state: Pick<ManuAppState, "clients" | "conversations" | "messages">,
): Stage4BNavigationTarget {
  const clientId = notification.clientId;
  if (!clientId || !state.clients.some((client) => client.id === clientId)) {
    return { section: "clients", clientId: clientId || "unknown", source: "alert", sourceId: notification.id };
  }

  const section = resolveNotificationTargetSection(notification.kind);
  if (section === "ai-control") {
    return { section, clientId, source: "alert", sourceId: notification.id };
  }
  if (section === "clients") {
    return { section, clientId, source: "alert", sourceId: notification.id };
  }

  const conversationId =
    notification.conversationId &&
    state.conversations.some(
      (conversation) => conversation.id === notification.conversationId && conversation.clientId === clientId,
    )
      ? notification.conversationId
      : state.conversations.find((conversation) => conversation.clientId === clientId)?.id;

  if (!conversationId) {
    return { section: "clients", clientId, source: "alert", sourceId: notification.id };
  }

  const messageId =
    notification.messageId && state.messages.some((message) => message.id === notification.messageId)
      ? notification.messageId
      : undefined;

  return {
    section: "messages",
    clientId,
    conversationId,
    messageId,
    source: "alert",
    sourceId: notification.id,
  };
}

function resolveNotificationTargetSection(kind: NotificationKind): Stage4BNavigationSection {
  switch (kind) {
    case "ai_window_expired":
    case "ai_paused_by_verified_human":
    case "human_control_integrity":
      return "ai-control";
    case "structured_record_update_required":
    case "communication_permission_closed":
    case "competing_authoritative_instructions":
      return "clients";
    default:
      return "messages";
  }
}

function resolveNotificationLifecycleState(
  notification: NotificationRecord,
  receipt: NotificationReceiptRecord | undefined,
): "active" | "unread" | "history" {
  const readAt = receipt?.readAt ?? null;
  if (notification.priority === "info") {
    return readAt ? "history" : "active";
  }
  if (notification.resolvedAt) return "history";
  return "active";
}

function matchesNotificationStatusBucket(
  lifecycleState: "active" | "unread" | "history",
  unread: boolean,
  status: NotificationListStatus,
) {
  if (status === "active") return lifecycleState === "active";
  if (status === "unread") return unread;
  return lifecycleState === "history";
}

export function projectSystemNotificationListItems(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
): SystemNotificationListItem[] {
  const normalized = normalizeNotificationsInState(state);
  const clientsById = new Map(state.clients.map((client) => [client.id, client]));

  return normalized.notifications
    .filter((notification) => notification.kind !== "legacy_handoff")
    .filter((notification) =>
      isStage4BNotificationVisible(notification, context, assignments, state.clients),
    )
    .map((notification) => {
      const receipt = getNotificationReceiptForActor(
        state.notificationReceipts,
        notification.id,
        context.dietitianId,
      );
      const lifecycleState = resolveNotificationLifecycleState(notification, receipt);
      const i18nKeys = NOTIFICATION_KIND_I18N_KEYS[notification.kind];
      const client = notification.clientId ? clientsById.get(notification.clientId) : undefined;
      return {
        id: notification.id,
        kind: notification.kind,
        priority: notification.priority ?? resolveNotificationPriority(notification.kind),
        category: resolveNotificationCategory(notification.kind),
        clientId: notification.clientId ?? null,
        conversationId: notification.conversationId ?? null,
        messageId: notification.messageId ?? null,
        handoffId: notification.handoffId ?? null,
        clientFullName: client?.fullName ?? null,
        titleKey: i18nKeys.titleKey,
        summaryKey: i18nKeys.summaryKey,
        occurrenceCount: notification.occurrenceCount,
        lastOccurredAt: notification.lastOccurredAt,
        readAt: receipt?.readAt ?? null,
        acknowledgedAt: receipt?.acknowledgedAt ?? null,
        resolvedAt: notification.resolvedAt ?? null,
        lifecycleState,
        target: buildNotificationNavigationTarget(notification, state),
      };
    });
}

export function buildNotificationCounts(items: SystemNotificationListItem[]) {
  let active = 0;
  let unread = 0;
  let history = 0;
  let interventionRequired = 0;

  for (const item of items) {
    if (item.lifecycleState === "active") active += 1;
    if (!item.readAt) unread += 1;
    if (item.lifecycleState === "history") history += 1;
    if (item.priority === "intervention_required" && item.lifecycleState === "active") {
      interventionRequired += 1;
    }
  }

  return { active, unread, history, interventionRequired };
}

export function buildClinicalAlertsListResponse(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
  input: {
    severity?: ClinicalAlertFilterSeverity;
    query?: string;
    cursor?: string | null;
    limit?: number;
    generatedAt?: string;
  },
): ClinicalAlertsListResponse {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (context.role === "auditor") {
    return {
      version: PHASE_85_STAGE_4B_API_VERSION,
      generatedAt,
      items: [],
      nextCursor: null,
      filteredTotal: 0,
      counts: { all: 0, red: 0, yellow: 0 },
    };
  }

  const visibleClientIds = resolveVisibleClientIds(state.clients, context, assignments);
  const alerts = projectClinicalAlertsFromState(state, { now: generatedAt, visibleClientIds });
  const counts = {
    all: alerts.length,
    red: alerts.filter((alert) => alert.severity === "red").length,
    yellow: alerts.filter((alert) => alert.severity === "yellow").length,
  };
  const filtered = filterClinicalAlerts(alerts, {
    severity: input.severity ?? "all",
    query: input.query,
  });
  const cursor = input.cursor ? decodeAlertCursor(input.cursor) : null;
  const limit = input.limit ?? STAGE_4B_DEFAULT_PAGE_SIZE;
  const page = paginateAlerts(filtered, limit, cursor);

  return {
    version: PHASE_85_STAGE_4B_API_VERSION,
    generatedAt,
    items: page.items,
    nextCursor: page.nextCursor,
    filteredTotal: filtered.length,
    counts,
  };
}

export function buildSystemNotificationsListResponse(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
  input: {
    status?: NotificationListStatus;
    priority?: NotificationPriority | null;
    category?: NotificationCategory | null;
    query?: string;
    cursor?: string | null;
    limit?: number;
    generatedAt?: string;
  },
): SystemNotificationsListResponse {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const status = input.status ?? "active";
  const items = projectSystemNotificationListItems(state, context, assignments);
  const counts = buildNotificationCounts(items);

  if (context.role === "auditor") {
    return {
      version: PHASE_85_STAGE_4B_API_VERSION,
      generatedAt,
      items: [],
      nextCursor: null,
      filteredTotal: 0,
      counts: { active: 0, unread: 0, history: 0, interventionRequired: 0 },
    };
  }

  const filtered = items.filter((item) => {
    if (input.priority && item.priority !== input.priority) return false;
    if (input.category && item.category !== input.category) return false;
    if (!matchesNotificationSearch(item, input.query || "")) return false;
    const unread = !item.readAt;
    return matchesNotificationStatusBucket(item.lifecycleState, unread, status);
  });

  const cursor = decodeNotificationCursor(status, input.cursor);
  const limit = input.limit ?? STAGE_4B_DEFAULT_PAGE_SIZE;
  const page = paginateNotifications(filtered, status, limit, cursor);

  return {
    version: PHASE_85_STAGE_4B_API_VERSION,
    generatedAt,
    items: page.items,
    nextCursor: page.nextCursor,
    filteredTotal: filtered.length,
    counts,
  };
}

export function assertNotificationAccessibleInState(
  state: ManuAppState,
  notificationId: string,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
) {
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (!notification) {
    throw new AppDomainError(404, "notification_not_found");
  }
  if (!isStage4BNotificationVisible(notification, context, assignments, state.clients)) {
    throw new AppDomainError(404, "notification_not_found");
  }
  return notification;
}

export function buildNotificationMutationResponse(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
  notificationId: string,
  generatedAt = new Date().toISOString(),
): Stage4BNotificationMutationResponse {
  const notification = assertNotificationAccessibleInState(state, notificationId, context, assignments);
  const receipt = getNotificationReceiptForActor(state.notificationReceipts, notificationId, context.dietitianId);
  const items = projectSystemNotificationListItems(state, context, assignments);
  return {
    version: PHASE_85_STAGE_4B_API_VERSION,
    generatedAt,
    notificationId,
    readAt: receipt?.readAt ?? null,
    acknowledgedAt: receipt?.acknowledgedAt ?? null,
    resolvedAt: notification.resolvedAt,
    target: buildNotificationNavigationTarget(notification, state),
    counts: buildNotificationCounts(items),
  };
}

export function buildNotificationReadAllResponse(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
  markedReadCount: number,
  generatedAt = new Date().toISOString(),
): Stage4BNotificationReadAllResponse {
  return {
    version: PHASE_85_STAGE_4B_API_VERSION,
    generatedAt,
    markedReadCount,
    counts: buildNotificationCounts(projectSystemNotificationListItems(state, context, assignments)),
  };
}

export function listFallbackAssignments(): DbClientAssignment[] {
  return [];
}
