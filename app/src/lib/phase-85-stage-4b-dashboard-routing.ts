import type { ReadonlyURLSearchParams } from "next/navigation";
import type { NotificationCategory, NotificationPriority } from "./phase-85-stage-4b-contracts";
import type { ClinicalAlertFilterSeverity } from "./phase-85-stage-4b-alerts";
import type { NotificationListStatus } from "./phase-85-stage-4b-api";
import { STAGE_4B_DEFAULT_PAGE_SIZE } from "./phase-85-stage-4b-api";
import type { ConversationListStatus } from "./phase-85-stage-4b2-contracts";
import { CONVERSATION_LIST_DEFAULT_PAGE_SIZE } from "./phase-85-stage-4b2-contracts";

export const PHASE_85_STAGE_4B_DASHBOARD_ROUTING_VERSION = "p85-stage-4b-dashboard-routing-v1";

export type DashboardSection =
  | "overview"
  | "clients"
  | "messages"
  | "simulator"
  | "alerts"
  | "notifications"
  | "copilot"
  | "voice"
  | "forms";

export type DashboardMessageSource = "alert" | "notification";

export type DashboardUrlState = {
  section: DashboardSection;
  clientId: string | null;
  conversationId: string | null;
  messageId: string | null;
  source: DashboardMessageSource | null;
  sourceId: string | null;
  alertSeverity: ClinicalAlertFilterSeverity;
  alertQuery: string;
  notificationStatus: NotificationListStatus;
  notificationPriority: NotificationPriority | null;
  notificationCategory: NotificationCategory | null;
  notificationQuery: string;
  conversationStatus: ConversationListStatus;
  conversationQuery: string;
};

const DASHBOARD_SECTION_ALLOWLIST = new Set<DashboardSection>([
  "overview",
  "clients",
  "messages",
  "simulator",
  "alerts",
  "notifications",
  "copilot",
  "voice",
  "forms",
]);

const LEGACY_SECTION_ALIASES: Record<string, DashboardSection> = {
  conversation: "messages",
  handoffs: "alerts",
};

const DEFAULT_DASHBOARD_URL_STATE: DashboardUrlState = {
  section: "overview",
  clientId: null,
  conversationId: null,
  messageId: null,
  source: null,
  sourceId: null,
  alertSeverity: "all",
  alertQuery: "",
  notificationStatus: "active",
  notificationPriority: null,
  notificationCategory: null,
  notificationQuery: "",
  conversationStatus: "all",
  conversationQuery: "",
};

export function formatStage4BBadgeCount(count: number) {
  if (count <= 0) return "0";
  if (count > 99) return "99+";
  return String(count);
}

export function resolveDashboardSection(value: string | null | undefined): DashboardSection {
  if (!value) return "overview";
  const normalized = value.trim().toLowerCase();
  const aliased = LEGACY_SECTION_ALIASES[normalized] ?? normalized;
  if (DASHBOARD_SECTION_ALLOWLIST.has(aliased as DashboardSection)) {
    return aliased as DashboardSection;
  }
  return "overview";
}

function readOptionalString(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseAlertSeverity(value: string | null): ClinicalAlertFilterSeverity {
  if (!value || value === "all") return "all";
  if (value === "red" || value === "yellow") return value;
  return "all";
}

function parseNotificationStatus(value: string | null): NotificationListStatus {
  if (!value || value === "active") return "active";
  if (value === "unread" || value === "history") return value;
  return "active";
}

function parseNotificationPriority(value: string | null): NotificationPriority | null {
  if (!value) return null;
  if (value === "intervention_required" || value === "review_required" || value === "info") return value;
  return null;
}

function parseNotificationCategory(value: string | null): NotificationCategory | null {
  if (!value) return null;
  if (
    value === "records" ||
    value === "conversation_review" ||
    value === "channel_delivery" ||
    value === "ai_control"
  ) {
    return value;
  }
  return null;
}

function parseMessageSource(value: string | null): DashboardMessageSource | null {
  if (value === "alert") return "alert";
  if (value === "notification") return "notification";
  return null;
}

function parseConversationListStatus(value: string | null): ConversationListStatus {
  if (!value || value === "all") return "all";
  if (value === "unread") return "unread";
  return "all";
}

export function parseDashboardSearchParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get"> | URLSearchParams,
): DashboardUrlState {
  const section = resolveDashboardSection(searchParams.get("section"));
  return {
    section,
    clientId: readOptionalString(searchParams.get("clientId")),
    conversationId: readOptionalString(searchParams.get("conversationId")),
    messageId: readOptionalString(searchParams.get("messageId")),
    source: parseMessageSource(searchParams.get("source")),
    sourceId: readOptionalString(searchParams.get("sourceId")),
    alertSeverity: parseAlertSeverity(searchParams.get("alertSeverity")),
    alertQuery: searchParams.get("alertQuery")?.trim() ?? "",
    notificationStatus: parseNotificationStatus(searchParams.get("notificationStatus")),
    notificationPriority: parseNotificationPriority(searchParams.get("notificationPriority")),
    notificationCategory: parseNotificationCategory(searchParams.get("notificationCategory")),
    notificationQuery: searchParams.get("notificationQuery")?.trim() ?? "",
    conversationStatus: parseConversationListStatus(searchParams.get("conversationStatus")),
    conversationQuery: searchParams.get("conversationQuery")?.trim() ?? "",
  };
}

export function serializeDashboardSearchParams(state: DashboardUrlState) {
  const params = new URLSearchParams();
  if (state.section !== "overview") {
    params.set("section", state.section);
  }
  if (state.clientId) params.set("clientId", state.clientId);
  if (state.conversationId) params.set("conversationId", state.conversationId);
  if (state.messageId) params.set("messageId", state.messageId);
  if (state.source) params.set("source", state.source);
  if (state.sourceId) params.set("sourceId", state.sourceId);
  if (state.alertSeverity !== "all") params.set("alertSeverity", state.alertSeverity);
  if (state.alertQuery) params.set("alertQuery", state.alertQuery);
  if (state.notificationStatus !== "active") params.set("notificationStatus", state.notificationStatus);
  if (state.notificationPriority) params.set("notificationPriority", state.notificationPriority);
  if (state.notificationCategory) params.set("notificationCategory", state.notificationCategory);
  if (state.notificationQuery) params.set("notificationQuery", state.notificationQuery);
  if (state.conversationStatus !== "all") params.set("conversationStatus", state.conversationStatus);
  if (state.conversationQuery) params.set("conversationQuery", state.conversationQuery);
  return params;
}

export function buildDashboardHref(pathname: string, state: DashboardUrlState) {
  const query = serializeDashboardSearchParams(state).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function mergeDashboardUrlState(
  current: DashboardUrlState,
  patch: Partial<DashboardUrlState>,
): DashboardUrlState {
  return { ...current, ...patch };
}

export function getDefaultDashboardUrlState() {
  return { ...DEFAULT_DASHBOARD_URL_STATE };
}

export function buildStage4BAlertsRequestQuery(
  state: Pick<DashboardUrlState, "alertSeverity" | "alertQuery">,
  options?: { cursor?: string | null; limit?: number },
) {
  const params = new URLSearchParams();
  if (state.alertSeverity !== "all") params.set("severity", state.alertSeverity);
  if (state.alertQuery) params.set("query", state.alertQuery);
  params.set("limit", String(options?.limit ?? STAGE_4B_DEFAULT_PAGE_SIZE));
  if (options?.cursor) params.set("cursor", options.cursor);
  return params;
}

export function buildStage4BNotificationsRequestQuery(
  state: Pick<
    DashboardUrlState,
    "notificationStatus" | "notificationPriority" | "notificationCategory" | "notificationQuery"
  >,
  options?: { cursor?: string | null; limit?: number },
) {
  const params = new URLSearchParams();
  params.set("status", state.notificationStatus);
  if (state.notificationPriority) params.set("priority", state.notificationPriority);
  if (state.notificationCategory) params.set("category", state.notificationCategory);
  if (state.notificationQuery) params.set("query", state.notificationQuery);
  params.set("limit", String(options?.limit ?? STAGE_4B_DEFAULT_PAGE_SIZE));
  if (options?.cursor) params.set("cursor", options.cursor);
  return params;
}

export function resolveAlertsBadgeCount(counts: { red: number; yellow: number } | null | undefined) {
  if (!counts) return 0;
  return counts.red + counts.yellow;
}

export type MessagingRouteConversation = {
  id: string;
  clientId: string;
};

export type MessagingRouteSelection = {
  conversationId: string | null;
  clientId: string | null;
  messageId: string | null;
  canonicalConversationId: string | null;
  canonicalClientId: string | null;
  needsCanonicalization: boolean;
};

export function resolveMessagingRouteSelection(
  urlState: Pick<DashboardUrlState, "conversationId" | "clientId" | "messageId">,
  conversations: readonly MessagingRouteConversation[],
  activeClientIds: ReadonlySet<string>,
): MessagingRouteSelection {
  const messageId = urlState.messageId;
  const explicitConversationId = urlState.conversationId?.trim() || null;
  const conversationById = explicitConversationId
    ? conversations.find((item) => item.id === explicitConversationId)
    : undefined;
  if (conversationById && activeClientIds.has(conversationById.clientId)) {
    return {
      conversationId: conversationById.id,
      clientId: conversationById.clientId,
      messageId,
      canonicalConversationId: conversationById.id,
      canonicalClientId: conversationById.clientId,
      needsCanonicalization:
        !urlState.conversationId ||
        urlState.conversationId !== conversationById.id ||
        urlState.clientId !== conversationById.clientId,
    };
  }

  // A copied URL is authoritative for the conversation. The list/state cache
  // may not contain an older conversation yet; the bounded detail API remains
  // the authority for whether that target is readable.
  if (explicitConversationId) {
    const explicitClientId = urlState.clientId?.trim() || conversationById?.clientId || null;
    return {
      conversationId: explicitConversationId,
      clientId: explicitClientId,
      messageId,
      canonicalConversationId: null,
      canonicalClientId: null,
      needsCanonicalization: false,
    };
  }

  const conversationByClient = urlState.clientId
    ? conversations.find((item) => item.clientId === urlState.clientId)
    : undefined;
  if (conversationByClient && activeClientIds.has(conversationByClient.clientId)) {
    return {
      conversationId: conversationByClient.id,
      clientId: conversationByClient.clientId,
      messageId,
      canonicalConversationId: conversationByClient.id,
      canonicalClientId: conversationByClient.clientId,
      needsCanonicalization: urlState.conversationId !== conversationByClient.id,
    };
  }

  return {
    conversationId: null,
    clientId: urlState.clientId && activeClientIds.has(urlState.clientId) ? urlState.clientId : null,
    messageId,
    canonicalConversationId: null,
    canonicalClientId: urlState.clientId && activeClientIds.has(urlState.clientId) ? urlState.clientId : null,
    needsCanonicalization: false,
  };
}

export function buildStage4B2ConversationsRequestQuery(
  state: Pick<DashboardUrlState, "conversationStatus" | "conversationQuery">,
  options?: { cursor?: string | null; limit?: number },
) {
  const params = new URLSearchParams();
  if (state.conversationStatus !== "all") params.set("status", state.conversationStatus);
  if (state.conversationQuery) params.set("query", state.conversationQuery);
  params.set("limit", String(options?.limit ?? CONVERSATION_LIST_DEFAULT_PAGE_SIZE));
  if (options?.cursor) params.set("cursor", options.cursor);
  return params;
}

export function buildStage4B2ConversationDetailRequestQuery(options?: {
  anchorMessageId?: string | null;
  cursor?: string | null;
  direction?: "older" | "newer";
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.direction) params.set("direction", options.direction);
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.anchorMessageId) params.set("anchorMessageId", options.anchorMessageId);
  return params;
}

export function resolveMessagingUnreadBadgeCount(
  items: readonly { unreadCount: number }[] | null | undefined,
) {
  if (!items?.length) return 0;
  return items.reduce((total, item) => total + Math.max(0, item.unreadCount), 0);
}
