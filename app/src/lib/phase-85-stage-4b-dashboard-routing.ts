import type { ReadonlyURLSearchParams } from "next/navigation";
import type { NotificationCategory, NotificationPriority } from "./phase-85-stage-4b-contracts";
import type { ClinicalAlertFilterSeverity } from "./phase-85-stage-4b-alerts";
import type { NotificationListStatus } from "./phase-85-stage-4b-api";
import { STAGE_4B_DEFAULT_PAGE_SIZE } from "./phase-85-stage-4b-api";
import type { ConversationListStatus } from "./phase-85-stage-4b2-contracts";
import { CONVERSATION_LIST_DEFAULT_PAGE_SIZE } from "./phase-85-stage-4b2-contracts";
import type { ShellDestinationId } from "./phase-85-stage-5-shell-contracts";
import { isShellDestinationId } from "./phase-85-stage-5-shell-contracts";
import { SETTINGS_ROOT_PATH } from "./phase-85-stage-4d-settings-contracts";

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

/**
 * Nav highlighting key. AI Chat, Settings, and More live on real routes
 * (`/dashboard/ai-chat`, `/dashboard/settings`, `/dashboard/more`), not a
 * `?section=` query value, so they need keys distinct from `DashboardSection`.
 */
export type DashboardNavKey = DashboardSection | "ai_chat" | "settings" | "more";

export const AI_CHAT_ROOT_PATH = "/dashboard/ai-chat";
export const MORE_ROOT_PATH = "/dashboard/more";
export const DASHBOARD_ROOT_PATH = "/dashboard";
export { SETTINGS_ROOT_PATH };
/**
 * Server-evaluated only (no `NEXT_PUBLIC_` prefix): callers must resolve this
 * on the server and pass the result down as a prop, so `next start` picks up
 * the flag at runtime without requiring a rebuild.
 */
export function isAiChatUiEnabled() {
  return process.env.AI_CHAT_UI_ENABLED === "true";
}

/** Legacy `?section=copilot` deep links replace-redirect to the AI Chat route. */
export function resolveLegacyCopilotSectionRedirect(section: DashboardSection): string | null {
  return section === "copilot" ? AI_CHAT_ROOT_PATH : null;
}

export type ClientWorkspaceSection = "summary" | "forms" | "nutrition" | "menu" | "ai";
export type ClientWorkspaceTask = ClientWorkspaceSection | "context" | "export";
export type ClientWorkspaceStage = "list" | "hub" | "task";

export const CLIENT_WORKSPACE_SECTIONS: readonly ClientWorkspaceSection[] = [
  "summary",
  "forms",
  "nutrition",
  "menu",
  "ai",
];

export const CLIENT_WORKSPACE_TASKS: readonly ClientWorkspaceTask[] = [
  ...CLIENT_WORKSPACE_SECTIONS,
  "context",
  "export",
];

const CLIENT_WORKSPACE_TASK_SET = new Set<string>(CLIENT_WORKSPACE_TASKS);

const LEGACY_CLIENT_TAB_TO_TASK: Record<string, ClientWorkspaceTask> = {
  tab_overview: "summary",
  tab_personal_form: "forms",
  tab_food_rules: "nutrition",
  tab_menu: "menu",
  tab_ai_assistant: "ai",
  tab_critical_context: "context",
  tab_export: "export",
};

export const CLIENT_WORKSPACE_TASK_TO_LEGACY_TAB: Record<ClientWorkspaceTask, string> = {
  summary: "tab_overview",
  forms: "tab_personal_form",
  nutrition: "tab_food_rules",
  menu: "tab_menu",
  ai: "tab_ai_assistant",
  context: "tab_critical_context",
  export: "tab_export",
};

export type DashboardUrlState = {
  section: DashboardSection;
  clientId: string | null;
  clientTask: ClientWorkspaceTask | null;
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
  clientTask: null,
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

export function parseClientWorkspaceTask(value: string | null | undefined): ClientWorkspaceTask | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (CLIENT_WORKSPACE_TASK_SET.has(normalized)) return normalized as ClientWorkspaceTask;
  return LEGACY_CLIENT_TAB_TO_TASK[normalized] ?? null;
}

export function resolveClientWorkspaceTask(state: Pick<DashboardUrlState, "section" | "clientId" | "clientTask">): ClientWorkspaceTask {
  if (state.section !== "clients" || !state.clientId) return "summary";
  return state.clientTask ?? "summary";
}

export function resolveClientWorkspaceStage(state: Pick<DashboardUrlState, "section" | "clientId" | "clientTask">): ClientWorkspaceStage {
  if (state.section !== "clients" || !state.clientId) return "list";
  const task = resolveClientWorkspaceTask(state);
  return task === "summary" ? "hub" : "task";
}

export function parseDashboardSearchParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get"> | URLSearchParams,
): DashboardUrlState {
  const section = resolveDashboardSection(searchParams.get("section"));
  return {
    section,
    clientId: readOptionalString(searchParams.get("clientId")),
    clientTask: parseClientWorkspaceTask(searchParams.get("clientTask") ?? searchParams.get("tab")),
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
  if (state.clientTask && state.clientTask !== "summary") params.set("clientTask", state.clientTask);
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

export function currentDashboardHref() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

export const DASHBOARD_HREF_CHANGE_EVENT = "manu:dashboard-href-change";

export function subscribeDashboardHrefChange(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("popstate", listener);
  window.addEventListener(DASHBOARD_HREF_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(DASHBOARD_HREF_CHANGE_EVENT, listener);
  };
}

/**
 * Same-page search-param updates are not always applied by the App Router.
 * Native history is the live source of truth; listeners re-render from it.
 */
export function commitDashboardHref(href: string, mode: "push" | "replace" = "replace") {
  if (typeof window === "undefined") return;
  if (currentDashboardHref() === href) return;
  if (mode === "push") {
    window.history.pushState(window.history.state, "", href);
  } else {
    window.history.replaceState(window.history.state, "", href);
  }
  window.dispatchEvent(new Event(DASHBOARD_HREF_CHANGE_EVENT));
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

  // Client-only URLs stay on the list. Auto-opening a conversation would
  // prevent mobile back-to-list from restoring the inbox.
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

const SECTION_TO_SHELL_DESTINATION: Record<DashboardSection, ShellDestinationId> = {
  overview: "home",
  clients: "clients",
  messages: "messages",
  simulator: "simulator",
  alerts: "alerts",
  notifications: "notifications",
  copilot: "ai_chat",
  voice: "voice",
  forms: "forms",
};

const SHELL_DESTINATION_TO_SECTION: Partial<Record<ShellDestinationId, DashboardSection>> = {
  home: "overview",
  clients: "clients",
  messages: "messages",
  simulator: "simulator",
  alerts: "alerts",
  notifications: "notifications",
  voice: "voice",
  forms: "forms",
};

const CLIENT_SCOPED_SHELL_DESTINATIONS = new Set<ShellDestinationId>([
  "home",
  "clients",
  "messages",
  "alerts",
  "notifications",
  "simulator",
  "voice",
  "forms",
]);

export type BuildShellHrefOptions = {
  clientId?: string | null;
  chatId?: string | null;
  focusMode?: boolean;
  current?: DashboardUrlState | null;
  /** When true, preserve safe filter params for the target destination family. */
  preserveFilters?: boolean;
};

/**
 * Normalize an arbitrary destination token to a canonical Stage 5 destination.
 * Unknown values fail closed to `home`. Legacy `copilot` resolves to `ai_chat`
 * and must not appear in primary navigation.
 */
export function sanitizeShellDestination(value: string | null | undefined): ShellDestinationId {
  if (!value) return "home";
  const normalized = value.trim().toLowerCase();
  if (normalized === "overview" || normalized === "home") return "home";
  if (normalized === "copilot") return "ai_chat";
  if (normalized === "conversation") return "messages";
  if (normalized === "handoffs") return "alerts";
  if (isShellDestinationId(normalized)) return normalized;
  return "home";
}

/**
 * Resolve the canonical shell destination from the current URL.
 * URL is the source of truth for route state.
 */
export function resolveShellDestination(
  pathname: string,
  searchParams?: Pick<ReadonlyURLSearchParams, "get"> | URLSearchParams | null,
): ShellDestinationId {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === MORE_ROOT_PATH || path.startsWith(`${MORE_ROOT_PATH}/`)) {
    return "more";
  }
  if (path === SETTINGS_ROOT_PATH || path.startsWith(`${SETTINGS_ROOT_PATH}/`)) {
    return "settings";
  }
  if (path === AI_CHAT_ROOT_PATH || path.startsWith(`${AI_CHAT_ROOT_PATH}/`)) {
    return "ai_chat";
  }
  if (path === DASHBOARD_ROOT_PATH || path.startsWith(`${DASHBOARD_ROOT_PATH}/`)) {
    const section = resolveDashboardSection(searchParams?.get("section") ?? null);
    return SECTION_TO_SHELL_DESTINATION[section];
  }
  return "home";
}

/**
 * Nav-highlight key for the current URL. Maps shell `home` to legacy `overview`.
 */
export function resolveActiveDestination(
  pathname: string,
  searchParams?: Pick<ReadonlyURLSearchParams, "get"> | URLSearchParams | null,
): DashboardNavKey {
  const destination = resolveShellDestination(pathname, searchParams);
  if (destination === "home") return "overview";
  if (destination === "ai_chat") return "ai_chat";
  if (destination === "settings") return "settings";
  if (destination === "more") return "more";
  return destination;
}

/**
 * Build a typed href for a shell destination.
 * Unauthorized/clinical params are not copied onto account-only destinations.
 * `section=copilot` is never emitted; AI Chat uses the real route.
 */
export function buildShellHref(destination: ShellDestinationId, options: BuildShellHrefOptions = {}) {
  const safeDestination = sanitizeShellDestination(destination);
  const current = options.current ?? null;
  const clientId =
    options.clientId !== undefined ? options.clientId : current?.clientId ?? null;
  const preserveFilters = options.preserveFilters !== false;

  if (safeDestination === "ai_chat") {
    const base = options.chatId
      ? `${AI_CHAT_ROOT_PATH}/${options.chatId}`
      : AI_CHAT_ROOT_PATH;
    return options.focusMode ? `${base}?focus=1` : base;
  }

  if (safeDestination === "settings") {
    return SETTINGS_ROOT_PATH;
  }

  if (safeDestination === "more") {
    return MORE_ROOT_PATH;
  }

  const section = SHELL_DESTINATION_TO_SECTION[safeDestination] ?? "overview";
  const next: DashboardUrlState = {
    ...getDefaultDashboardUrlState(),
    section,
  };

  if (clientId && CLIENT_SCOPED_SHELL_DESTINATIONS.has(safeDestination)) {
    next.clientId = clientId;
  }

  if (preserveFilters && current && safeDestination === "clients" && clientId && current.clientId === clientId) {
    next.clientTask = current.clientTask;
  }

  if (preserveFilters && current) {
    if (safeDestination === "alerts") {
      next.alertSeverity = current.alertSeverity;
      next.alertQuery = current.alertQuery;
    }
    if (safeDestination === "notifications") {
      next.notificationStatus = current.notificationStatus;
      next.notificationPriority = current.notificationPriority;
      next.notificationCategory = current.notificationCategory;
      next.notificationQuery = current.notificationQuery;
    }
    if (safeDestination === "messages") {
      next.conversationStatus = current.conversationStatus;
      next.conversationQuery = current.conversationQuery;
      next.conversationId = current.conversationId;
      next.messageId = current.messageId;
      next.source = current.source;
      next.sourceId = current.sourceId;
      if (current.clientId) next.clientId = current.clientId;
    }
  }

  return buildDashboardHref(DASHBOARD_ROOT_PATH, next);
}

export function shellDestinationAcceptsClientId(destination: ShellDestinationId) {
  return CLIENT_SCOPED_SHELL_DESTINATIONS.has(sanitizeShellDestination(destination));
}

export function dashboardSectionToShellDestination(section: DashboardSection): ShellDestinationId {
  return SECTION_TO_SHELL_DESTINATION[section];
}

export type Stage6CommunicationDestinationKind =
  | "conversation"
  | "clientWorkspace"
  | "settings"
  | "aiChat"
  | "fallback";

export type Stage6CommunicationDestinationInput = {
  kindHint?: string | null;
  section?: string | null;
  clientId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  source?: DashboardMessageSource | null;
  sourceId?: string | null;
  clientTask?: string | null;
};

export type Stage6ResolvedCommunicationDestination = {
  kind: Stage6CommunicationDestinationKind;
  href: string;
  urlPatch: Partial<DashboardUrlState>;
  linkedClientId: string | null;
  requiresActiveClient: boolean;
  inaccessible: boolean;
};

function normalizeStage6CommunicationKind(
  input: Stage6CommunicationDestinationInput,
): Stage6CommunicationDestinationKind {
  const hint = `${input.kindHint ?? ""} ${input.section ?? ""}`.trim().toLowerCase();
  if (hint.includes("settings") || hint === "account") return "settings";
  if (
    hint.includes("ai_chat") ||
    hint.includes("ai-chat") ||
    hint.includes("aichat") ||
    hint === "copilot"
  ) {
    return "aiChat";
  }
  if (hint.includes("message") || hint.includes("conversation")) return "conversation";
  if (hint.includes("ai-control") || hint.includes("client")) return "clientWorkspace";
  if (input.conversationId?.trim()) return "conversation";
  return "fallback";
}

function inaccessibleStage6CommunicationDestination(
  current: DashboardUrlState,
): Stage6ResolvedCommunicationDestination {
  return {
    kind: "fallback",
    href: buildDashboardHref(DASHBOARD_ROOT_PATH, current),
    urlPatch: {},
    linkedClientId: null,
    requiresActiveClient: false,
    inaccessible: true,
  };
}

export function resolveStage6CommunicationDestination(
  current: DashboardUrlState,
  input: Stage6CommunicationDestinationInput,
  options?: { knownClientIds?: ReadonlySet<string> },
): Stage6ResolvedCommunicationDestination {
  const kind = normalizeStage6CommunicationKind(input);
  const clientId = input.clientId?.trim() || null;
  const conversationId = input.conversationId?.trim() || null;
  const messageId = input.messageId?.trim() || null;

  if (clientId && options?.knownClientIds && !options.knownClientIds.has(clientId)) {
    return inaccessibleStage6CommunicationDestination(current);
  }

  if (kind === "settings") {
    return {
      kind: "settings",
      href: SETTINGS_ROOT_PATH,
      urlPatch: {},
      linkedClientId: null,
      requiresActiveClient: false,
      inaccessible: false,
    };
  }

  if (kind === "aiChat") {
    return {
      kind: "aiChat",
      href: AI_CHAT_ROOT_PATH,
      urlPatch: {},
      linkedClientId: null,
      requiresActiveClient: false,
      inaccessible: false,
    };
  }

  if (kind === "conversation") {
    if (!clientId || !conversationId) {
      return inaccessibleStage6CommunicationDestination(current);
    }
    const urlPatch: Partial<DashboardUrlState> = {
      section: "messages",
      clientId,
      conversationId,
      messageId,
      source: input.source ?? null,
      sourceId: input.sourceId ?? null,
    };
    return {
      kind: "conversation",
      href: buildDashboardHref(DASHBOARD_ROOT_PATH, mergeDashboardUrlState(current, urlPatch)),
      urlPatch,
      linkedClientId: clientId,
      requiresActiveClient: true,
      inaccessible: false,
    };
  }

  if (kind === "clientWorkspace") {
    if (!clientId) {
      return {
        kind: "fallback",
        href: buildDashboardHref(
          DASHBOARD_ROOT_PATH,
          mergeDashboardUrlState(current, { section: "overview" }),
        ),
        urlPatch: { section: "overview" },
        linkedClientId: null,
        requiresActiveClient: false,
        inaccessible: false,
      };
    }
    const clientTask =
      parseClientWorkspaceTask(input.clientTask) ??
      (String(input.section ?? "").toLowerCase() === "ai-control" ? "ai" : "summary");
    const urlPatch: Partial<DashboardUrlState> = {
      section: "clients",
      clientId,
      clientTask,
    };
    return {
      kind: "clientWorkspace",
      href: buildDashboardHref(DASHBOARD_ROOT_PATH, mergeDashboardUrlState(current, urlPatch)),
      urlPatch,
      linkedClientId: clientId,
      requiresActiveClient: true,
      inaccessible: false,
    };
  }

  return {
    kind: "fallback",
    href: buildDashboardHref(DASHBOARD_ROOT_PATH, mergeDashboardUrlState(current, { section: "overview" })),
    urlPatch: { section: "overview" },
    linkedClientId: null,
    requiresActiveClient: false,
    inaccessible: false,
  };
}
