import type { AppCapability } from "./app-capability-contracts";
import { hasCapability } from "./app-capability-contracts";
import { isAiChatUiEnabled } from "./phase-85-stage-4b-dashboard-routing";
import type { AiMode, PermissionState, TenantRole } from "./types";

export const PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION = "p85-stage-5-shell-v1";

export const SHELL_CLIENT_SEARCH_DEBOUNCE_MS = 250;
export const SHELL_CLIENT_SEARCH_MIN_QUERY_LENGTH = 2;
export const SHELL_CLIENT_SEARCH_MAX_QUERY_LENGTH = 80;
export const SHELL_CLIENT_SEARCH_DEFAULT_LIMIT = 20;
export const SHELL_CLIENT_SEARCH_MAX_LIMIT = 20;
export const SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES = 20_480;

export const SHELL_API_RATE_LIMITS = {
  bootstrap: { scope: "shell_bootstrap" as const, limit: 60, windowMs: 60_000 },
  preferences: { scope: "shell_preferences" as const, limit: 30, windowMs: 60_000 },
  sessionActivity: { scope: "shell_session_activity" as const, limit: 12, windowMs: 60_000 },
  clientSearch: { scope: "shell_client_search" as const, limit: 30, windowMs: 60_000 },
} as const;

export const SHELL_DESTINATION_IDS = [
  "home",
  "clients",
  "messages",
  "alerts",
  "notifications",
  "simulator",
  "voice",
  "forms",
  "ai_chat",
  "settings",
  "more",
] as const;

export type ShellDestinationId = (typeof SHELL_DESTINATION_IDS)[number];

export const SHELL_COMPACT_BOTTOM_NAV_IDS = [
  "home",
  "clients",
  "messages",
  "alerts",
  "more",
] as const satisfies readonly ShellDestinationId[];

export type ShellRuntimeState =
  | "booting"
  | "ready"
  | "offline"
  | "session_locked"
  | "entitlement_blocked"
  | "update_required"
  | "service_unavailable";

export type ShellRiskLevel = "green" | "yellow" | "red" | "unknown";

export type ShellHandoffState = "none" | "open" | "assigned" | "resolved" | "dismissed" | "unknown";

export type ShellHomeActionId =
  | "alerts"
  | "handoffs"
  | "messages"
  | "notifications"
  | "resume_last_work";

export type ShellActiveClientDto = {
  id: string;
  fullName: string;
  referenceShort: string;
  riskLevel: ShellRiskLevel;
  handoffState: ShellHandoffState;
  channelReadiness: PermissionState | "unknown";
  aiMode: AiMode | "unknown";
};

export type ShellBadgeCountsDto = {
  alerts: number;
  handoffs: number;
  messages: number;
  notifications: number;
};

export type ShellNavigationItemDto = {
  id: ShellDestinationId;
  enabled: boolean;
  badgeCount?: number;
  disabledReason?: string;
};

export type ShellHomeActionDto = {
  id: ShellHomeActionId;
  destinationId: ShellDestinationId;
  count: number;
  enabled: boolean;
  disabledReason?: string;
};

export type ShellPreferencesDto = {
  revision: number;
  activeClientId: string | null;
  lastDestinationId: ShellDestinationId | null;
  destinationState: Record<string, unknown>;
};

export type ShellBootstrapDto = {
  contractVersion: string;
  displayName: string;
  uiLanguage: string;
  timezone: string;
  role: TenantRole;
  capabilities: AppCapability[];
  navigation: ShellNavigationItemDto[];
  badgeCounts: ShellBadgeCountsDto;
  homeActions: ShellHomeActionDto[];
  activeClient: ShellActiveClientDto | null;
  preferences: ShellPreferencesDto;
  warnings: string[];
  sessionExpiresAt: string;
};

export type ShellClientSearchItemDto = {
  id: string;
  fullName: string;
  referenceShort: string;
};

export type ShellClientSearchDto = {
  contractVersion: string;
  items: ShellClientSearchItemDto[];
};

export type ShellPreferencesPatchResultDto = {
  contractVersion: string;
  revision: number;
  activeClientId: string | null;
  lastDestinationId: ShellDestinationId | null;
  destinationState: Record<string, unknown>;
  requestId: string;
  idempotentReplay?: boolean;
};

export type ShellVersionDto = {
  contractVersion: string;
  deploymentVersion: string;
  minClientVersion: string;
  clientVersion: string;
  updateRequired: boolean;
};

export type ShellSessionActivityDto = {
  contractVersion: string;
  sessionId: string;
  locked: boolean;
  lastInteractiveAt: string;
  touched?: boolean;
};

export class ShellApiError extends Error {
  status: 400 | 401 | 403 | 409 | 429 | 503;

  constructor(status: 400 | 401 | 403 | 409 | 429 | 503, message: string) {
    super(message);
    this.name = "ShellApiError";
    this.status = status;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SHELL_CAPABILITY_ALLOWLIST: AppCapability[] = [
  "read_app_state",
  "reset_app_state",
  "create_client",
  "update_client",
  "simulate_inbound",
  "manual_reply",
  "draft_review",
  "handoff_update",
  "notification_update",
  "export_client",
  "anonymize_client",
  "release_takeover",
  "internal_copilot_chat",
  "dietitian_ai_chat",
  "read_operational_foundation",
  "revoke_tenant_channel_bindings",
  "update_own_profile",
];

const DESTINATION_CAPABILITY_REQUIREMENTS: Partial<Record<ShellDestinationId, AppCapability>> = {
  simulator: "simulate_inbound",
  voice: "manual_reply",
  forms: "read_app_state",
  ai_chat: "dietitian_ai_chat",
  settings: "update_own_profile",
};

export function isShellDestinationId(value: string): value is ShellDestinationId {
  return (SHELL_DESTINATION_IDS as readonly string[]).includes(value);
}

export function parseShellActiveClientIdParam(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!UUID_PATTERN.test(trimmed)) {
    throw new ShellApiError(400, "invalid_active_client_id");
  }
  return trimmed.toLowerCase();
}

export function parseShellClientSearchQuery(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < SHELL_CLIENT_SEARCH_MIN_QUERY_LENGTH) {
    throw new ShellApiError(400, "invalid_search_query");
  }
  if (trimmed.length > SHELL_CLIENT_SEARCH_MAX_QUERY_LENGTH) {
    throw new ShellApiError(400, "invalid_search_query");
  }
  return trimmed;
}

export function parseShellClientSearchLimit(value: string | null) {
  if (!value) return SHELL_CLIENT_SEARCH_DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > SHELL_CLIENT_SEARCH_MAX_LIMIT) {
    throw new ShellApiError(400, "invalid_search_limit");
  }
  return parsed;
}

export function parseShellPreferencesPatchBody(body: Record<string, unknown>) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (requestId.length < 8 || requestId.length > 128) {
    throw new ShellApiError(400, "invalid_request_id");
  }

  const expectedRevision = body.expectedRevision;
  if (
    typeof expectedRevision !== "number" ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    throw new ShellApiError(400, "invalid_expected_revision");
  }

  let activeClientId: string | null | undefined;
  if ("activeClientId" in body) {
    if (body.activeClientId === null) {
      activeClientId = null;
    } else if (typeof body.activeClientId === "string" && UUID_PATTERN.test(body.activeClientId.trim())) {
      activeClientId = body.activeClientId.trim().toLowerCase();
    } else {
      throw new ShellApiError(400, "invalid_active_client_id");
    }
  }

  let lastDestinationId: ShellDestinationId | null | undefined;
  if ("lastDestinationId" in body) {
    if (body.lastDestinationId === null) {
      lastDestinationId = null;
    } else if (
      typeof body.lastDestinationId === "string" &&
      isShellDestinationId(body.lastDestinationId.trim())
    ) {
      lastDestinationId = body.lastDestinationId.trim() as ShellDestinationId;
    } else {
      throw new ShellApiError(400, "invalid_last_destination_id");
    }
  }

  let destinationState: Record<string, unknown> | undefined;
  if ("destinationState" in body) {
    const value = body.destinationState;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new ShellApiError(400, "invalid_destination_state");
    }
    if (Object.keys(value as Record<string, unknown>).length > 0) {
      throw new ShellApiError(400, "invalid_destination_state");
    }
    destinationState = value as Record<string, unknown>;
  }

  const clearActiveClient = body.clearActiveClient === true;

  if (
    activeClientId === undefined &&
    lastDestinationId === undefined &&
    destinationState === undefined &&
    !clearActiveClient
  ) {
    throw new ShellApiError(400, "preferences_patch_empty");
  }

  return {
    requestId,
    expectedRevision,
    activeClientId,
    lastDestinationId,
    destinationState,
    clearActiveClient,
  };
}

export function parseShellClientVersionParam(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 64) {
    throw new ShellApiError(400, "invalid_client_version");
  }
  return trimmed;
}

export function compareShellVersions(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index]! : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index]! : 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function resolveShellDeploymentVersion(env: NodeJS.ProcessEnv = process.env) {
  return env.SIRIUSAI_APP_DEPLOYMENT_VERSION?.trim() || "0.0.0-stage5";
}

export function resolveShellMinClientVersion(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.SIRIUSAI_SHELL_MIN_CLIENT_VERSION?.trim() ||
    env.NEXT_PUBLIC_SIRIUSAI_APP_VERSION?.trim() ||
    "0.0.0-stage5"
  );
}

export function resolveShellCapabilities(role: TenantRole) {
  return SHELL_CAPABILITY_ALLOWLIST.filter((capability) => hasCapability(role, capability));
}

export function destinationEnabledForRole(
  destinationId: ShellDestinationId,
  role: TenantRole,
  aiChatEnabled = isAiChatUiEnabled(),
) {
  if (destinationId === "messages" && role === "auditor") {
    return { enabled: false, disabledReason: "conversation_read_forbidden" };
  }

  if (destinationId === "ai_chat" && !aiChatEnabled) {
    return { enabled: false, disabledReason: "feature_disabled" };
  }

  const requiredCapability = DESTINATION_CAPABILITY_REQUIREMENTS[destinationId] ?? "read_app_state";
  if (!hasCapability(role, requiredCapability)) {
    return { enabled: false, disabledReason: `rbac_forbidden_${requiredCapability}` };
  }

  if (
    (destinationId === "simulator" || destinationId === "voice" || destinationId === "forms") &&
    (role === "assistant" || role === "auditor")
  ) {
    return { enabled: false, disabledReason: "read_only_role" };
  }

  return { enabled: true };
}

export function buildShellNavigation(
  role: TenantRole,
  badgeCounts: ShellBadgeCountsDto,
  aiChatEnabled = isAiChatUiEnabled(),
): ShellNavigationItemDto[] {
  return SHELL_DESTINATION_IDS.map((id) => {
    const access = destinationEnabledForRole(id, role, aiChatEnabled);
    const item: ShellNavigationItemDto = {
      id,
      enabled: access.enabled,
      disabledReason: access.disabledReason,
    };

    if (id === "messages" && access.enabled) {
      item.badgeCount = badgeCounts.messages;
    }
    if (id === "alerts" && access.enabled) {
      item.badgeCount = badgeCounts.alerts;
    }
    if (id === "notifications" && access.enabled) {
      item.badgeCount = badgeCounts.notifications;
    }

    return item;
  });
}

export function buildShellHomeActions(input: {
  badgeCounts: ShellBadgeCountsDto;
  lastDestinationId: ShellDestinationId | null;
  role: TenantRole;
  aiChatEnabled?: boolean;
}): ShellHomeActionDto[] {
  const alertsAccess = destinationEnabledForRole("alerts", input.role, input.aiChatEnabled);
  const messagesAccess = destinationEnabledForRole("messages", input.role, input.aiChatEnabled);
  const notificationsAccess = destinationEnabledForRole(
    "notifications",
    input.role,
    input.aiChatEnabled,
  );

  const resumeDestination =
    input.lastDestinationId && destinationEnabledForRole(input.lastDestinationId, input.role).enabled
      ? input.lastDestinationId
      : "home";

  return [
    {
      id: "alerts",
      destinationId: "alerts",
      count: input.badgeCounts.alerts,
      enabled: alertsAccess.enabled && input.badgeCounts.alerts > 0,
      disabledReason: alertsAccess.enabled ? undefined : alertsAccess.disabledReason,
    },
    {
      id: "handoffs",
      destinationId: "alerts",
      count: input.badgeCounts.handoffs,
      enabled: alertsAccess.enabled && input.badgeCounts.handoffs > 0,
      disabledReason: alertsAccess.enabled ? undefined : alertsAccess.disabledReason,
    },
    {
      id: "messages",
      destinationId: "messages",
      count: input.badgeCounts.messages,
      enabled: messagesAccess.enabled && input.badgeCounts.messages > 0,
      disabledReason: messagesAccess.enabled ? undefined : messagesAccess.disabledReason,
    },
    {
      id: "notifications",
      destinationId: "notifications",
      count: input.badgeCounts.notifications,
      enabled: notificationsAccess.enabled && input.badgeCounts.notifications > 0,
      disabledReason: notificationsAccess.enabled ? undefined : notificationsAccess.disabledReason,
    },
    {
      id: "resume_last_work",
      destinationId: resumeDestination,
      count: 0,
      enabled: Boolean(input.lastDestinationId && resumeDestination === input.lastDestinationId),
      disabledReason: input.lastDestinationId ? undefined : "no_last_destination",
    },
  ];
}

export function formatShellBadgeDisplayCount(count: number) {
  if (!Number.isFinite(count) || count < 0) return "0";
  return count > 99 ? "99+" : String(count);
}

/**
 * URL-accessible clientId wins, then server preference, then unbound null.
 * Never auto-selects the first searchable client.
 */
export function resolveEffectiveShellActiveClientId(input: {
  urlClientId?: string | null;
  preferenceClientId?: string | null;
}) {
  const urlClientId = input.urlClientId?.trim() || null;
  if (urlClientId) return urlClientId;
  const preferenceClientId = input.preferenceClientId?.trim() || null;
  return preferenceClientId;
}

export function shouldShowShellActiveClientControl(destinationId: ShellDestinationId) {
  return destinationId !== "settings" && destinationId !== "ai_chat" && destinationId !== "more";
}

export type ShellStatusChip = {
  key: "risk" | "handoff" | "channel" | "ai" | "unknown";
  label: string;
};

const RISK_LABEL: Record<Exclude<ShellRiskLevel, "unknown">, string> = {
  green: "Risk yeşil",
  yellow: "Risk sarı",
  red: "Risk kırmızı",
};

const HANDOFF_LABEL: Record<Exclude<ShellHandoffState, "unknown">, string> = {
  none: "Devir yok",
  open: "Devir açık",
  assigned: "Devir atandı",
  resolved: "Devir kapandı",
  dismissed: "Devir kapatıldı",
};

const CHANNEL_LABEL: Record<PermissionState, string> = {
  ready: "Kanal hazır",
  pending: "Kanal bekliyor",
  blocked: "Kanal engelli",
  opted_out: "Kanal vazgeçti",
};

const AI_MODE_LABEL: Record<AiMode, string> = {
  autopilot: "AI autopilot",
  copilot: "AI copilot",
  manual: "AI manuel",
  paused: "AI duraklatıldı",
};

/**
 * Status chips in fixed priority order: risk → handoff → channel → AI mode.
 * Stale/missing projections fail closed to `unknown` (never assume green/safe).
 */
export function resolveShellClientStatusStrip(
  client: ShellActiveClientDto | null,
  options?: { stale?: boolean },
): ShellStatusChip[] {
  if (!client || options?.stale) {
    return [{ key: "unknown", label: "Durum bilinmiyor" }];
  }

  const chips: ShellStatusChip[] = [];
  if (client.riskLevel === "unknown") {
    chips.push({ key: "unknown", label: "Durum bilinmiyor" });
    return chips;
  }
  chips.push({ key: "risk", label: RISK_LABEL[client.riskLevel] });

  if (client.handoffState === "unknown") {
    chips.push({ key: "unknown", label: "Devir bilinmiyor" });
  } else {
    chips.push({ key: "handoff", label: HANDOFF_LABEL[client.handoffState] });
  }

  if (client.channelReadiness === "unknown") {
    chips.push({ key: "unknown", label: "Kanal bilinmiyor" });
  } else {
    chips.push({ key: "channel", label: CHANNEL_LABEL[client.channelReadiness] });
  }

  if (client.aiMode === "unknown") {
    chips.push({ key: "unknown", label: "AI durumu bilinmiyor" });
  } else {
    chips.push({ key: "ai", label: AI_MODE_LABEL[client.aiMode] });
  }

  return chips;
}

export function formatShellClientIdentity(client: Pick<ShellActiveClientDto, "fullName" | "referenceShort">) {
  return `${client.fullName} · ${client.referenceShort}`;
}

export function buildShellClientSwitchConfirmMessage(client: Pick<ShellActiveClientDto, "fullName" | "referenceShort">) {
  return `Kaydedilmemiş değişiklikler var. Danışanı değiştirmek istiyor musunuz?\n\nDanışan: ${formatShellClientIdentity(client)}`;
}

export function buildShellHighImpactConfirmMessage(
  actionLabel: string,
  client: Pick<ShellActiveClientDto, "fullName" | "referenceShort">,
) {
  return `${actionLabel}\n\nDanışan: ${formatShellClientIdentity(client)}`;
}

export type ShellDestinationViewSnapshot = {
  search?: string;
  filter?: string;
  tab?: string;
  scrollTop?: number;
  windowScrollY?: number;
};

/**
 * In-memory only. Never persists to localStorage/sessionStorage.
 * Cleared automatically when the app document unloads.
 */
export class ShellDestinationViewStateRegistry {
  private readonly store = new Map<string, ShellDestinationViewSnapshot>();

  save(destinationId: ShellDestinationId, snapshot: ShellDestinationViewSnapshot) {
    this.store.set(destinationId, { ...snapshot });
  }

  restore(destinationId: ShellDestinationId): ShellDestinationViewSnapshot | null {
    const value = this.store.get(destinationId);
    return value ? { ...value } : null;
  }

  clear(destinationId?: ShellDestinationId) {
    if (!destinationId) {
      this.store.clear();
      return;
    }
    this.store.delete(destinationId);
  }
}

export const shellDestinationViewStateRegistry = new ShellDestinationViewStateRegistry();

export const SHELL_PHI_FORBIDDEN_RESPONSE_KEYS = [
  "body",
  "message",
  "messages",
  "healthProfile",
  "health_profile",
  "primaryPhoneE164",
  "primary_phone_e164",
  "prompt",
  "transcript",
  "attachment",
  "safeAcknowledgement",
  "recommendedAction",
  "channelUserId",
  "billing",
  "stripe",
] as const;

export function collectForbiddenShellResponseKeys(
  value: unknown,
  path = "",
  found: string[] = [],
): string[] {
  if (value === null || typeof value !== "object") {
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectForbiddenShellResponseKeys(entry, `${path}[${index}]`, found);
    });
    return found;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    const isBadgeCountField = key === "messages" && path.endsWith("badgeCounts");
    if (
      !isBadgeCountField &&
      (SHELL_PHI_FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key)
    ) {
      found.push(nextPath);
    }
    collectForbiddenShellResponseKeys(nested, nextPath, found);
  }

  return found;
}
