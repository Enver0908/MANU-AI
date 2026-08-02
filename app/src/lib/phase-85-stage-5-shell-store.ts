import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountTenantContext } from "./auth-context";
import { AppAuthError } from "./auth-context";
import {
  clientReferenceMatchesQuery,
  decodeClientReferenceCode,
  encodeClientReferenceCode,
  formatClientReferenceShort,
} from "./client-reference-code";
import {
  buildShellHomeActions,
  buildShellNavigation,
  compareShellVersions,
  isShellDestinationId,
  PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
  resolveShellCapabilities,
  resolveShellDeploymentVersion,
  resolveShellMinClientVersion,
  ShellApiError,
  type ShellActiveClientDto,
  type ShellBadgeCountsDto,
  type ShellBootstrapDto,
  type ShellClientSearchDto,
  type ShellClientSearchItemDto,
  type ShellDestinationId,
  type ShellHandoffState,
  type ShellPreferencesDto,
  type ShellPreferencesPatchResultDto,
  type ShellRiskLevel,
  type ShellVersionDto,
} from "./phase-85-stage-5-shell-contracts";
import type { AiMode, PermissionState } from "./types";

type ShellBootstrapRpcRow = {
  displayName?: string;
  uiLanguage?: string;
  timezone?: string;
  role?: string;
  preferences?: {
    revision?: number;
    activeClientId?: string | null;
    lastDestinationId?: string | null;
    destinationState?: Record<string, unknown>;
  };
  warnings?: string[];
  activeClient?: {
    id?: string;
    fullName?: string;
    riskLevel?: string;
    handoffState?: string;
    channelReadiness?: string;
    aiMode?: string;
  } | null;
  badgeCounts?: {
    alerts?: number;
    handoffs?: number;
    messages?: number;
    notifications?: number;
  };
  sessionExpiresAt?: string;
};

type ShellClientSearchRpcRow = {
  id?: string;
  fullName?: string;
};

const SHELL_RPC_ERROR_CODES = [
  "client_context_unavailable",
  "invalid_request_id",
  "invalid_expected_revision",
  "invalid_last_destination_id",
  "invalid_destination_state",
  "invalid_search_query",
  "preferences_revision_conflict",
  "shell_bootstrap_unavailable",
  "shell_client_search_unavailable",
  "session_claim_missing",
  "session_inactive",
  "session_claim_mismatch",
  "unauthenticated",
  "no_tenant_membership",
  "no_dietitian_profile",
] as const;

function mapShellStoreRpcError(error: { message?: string | null }): never {
  const message = String(error.message ?? "");
  for (const code of SHELL_RPC_ERROR_CODES) {
    if (!message.includes(code)) continue;
    if (code === "shell_bootstrap_unavailable" || code === "shell_client_search_unavailable") {
      throw new ShellApiError(503, code);
    }
    if (code === "preferences_revision_conflict") {
      throw new ShellApiError(409, code);
    }
    if (code === "client_context_unavailable") {
      throw new ShellApiError(403, code);
    }
    if (
      code === "invalid_request_id" ||
      code === "invalid_expected_revision" ||
      code === "invalid_last_destination_id" ||
      code === "invalid_destination_state" ||
      code === "invalid_search_query"
    ) {
      throw new ShellApiError(400, code);
    }
    const status =
      code === "no_tenant_membership" || code === "no_dietitian_profile" ? 403 : 401;
    throw new AppAuthError(status, code);
  }
  throw error;
}

function toRiskLevel(value: string | undefined): ShellRiskLevel {
  if (value === "red" || value === "yellow" || value === "green") return value;
  return "green";
}

function toHandoffState(value: string | undefined): ShellHandoffState {
  if (
    value === "open" ||
    value === "assigned" ||
    value === "resolved" ||
    value === "dismissed" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function toPermissionState(value: string | undefined): PermissionState {
  if (value === "ready" || value === "pending" || value === "blocked" || value === "opted_out") {
    return value;
  }
  return "pending";
}

function toAiMode(value: string | undefined): AiMode {
  if (value === "autopilot" || value === "copilot" || value === "manual" || value === "paused") {
    return value;
  }
  return "manual";
}

function toActiveClientDto(row: NonNullable<ShellBootstrapRpcRow["activeClient"]>): ShellActiveClientDto {
  const id = String(row.id ?? "");
  const referenceCode = encodeClientReferenceCode(id);
  return {
    id,
    fullName: String(row.fullName ?? ""),
    referenceShort: formatClientReferenceShort(referenceCode),
    riskLevel: toRiskLevel(row.riskLevel),
    handoffState: toHandoffState(row.handoffState),
    channelReadiness: toPermissionState(row.channelReadiness),
    aiMode: toAiMode(row.aiMode),
  };
}

function toPreferencesDto(row: ShellBootstrapRpcRow["preferences"]): ShellPreferencesDto {
  const lastDestinationId = row?.lastDestinationId;
  return {
    revision: Number(row?.revision ?? 0),
    activeClientId: row?.activeClientId ?? null,
    lastDestinationId:
      typeof lastDestinationId === "string" && isShellDestinationId(lastDestinationId)
        ? lastDestinationId
        : null,
    destinationState:
      row?.destinationState && typeof row.destinationState === "object" && !Array.isArray(row.destinationState)
        ? row.destinationState
        : {},
  };
}

function toBadgeCounts(row: ShellBootstrapRpcRow["badgeCounts"]): ShellBadgeCountsDto {
  return {
    alerts: Math.max(0, Number(row?.alerts ?? 0)),
    handoffs: Math.max(0, Number(row?.handoffs ?? 0)),
    messages: Math.max(0, Number(row?.messages ?? 0)),
    notifications: Math.max(0, Number(row?.notifications ?? 0)),
  };
}

function toSearchItem(row: ShellClientSearchRpcRow): ShellClientSearchItemDto {
  const id = String(row.id ?? "");
  const referenceCode = encodeClientReferenceCode(id);
  return {
    id,
    fullName: String(row.fullName ?? ""),
    referenceShort: formatClientReferenceShort(referenceCode),
  };
}

function filterSearchItemsByReference(items: ShellClientSearchItemDto[], query: string | null) {
  if (!query) return items;
  const decodedClientId = decodeClientReferenceCode(query);
  if (decodedClientId) {
    const decodedMatch = items.filter((item) => item.id === decodedClientId);
    if (decodedMatch.length > 0) {
      return decodedMatch;
    }
  }

  return items.filter((item) => {
    const referenceCode = encodeClientReferenceCode(item.id);
    return (
      item.fullName.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")) ||
      clientReferenceMatchesQuery(referenceCode, query)
    );
  });
}

export async function loadShellBootstrap(
  context: AccountTenantContext,
  activeClientId: string | null,
): Promise<ShellBootstrapDto> {
  const { data, error } = await context.supabase.rpc("p85_stage_5_load_shell_bootstrap_v1", {
    p_active_client_id: activeClientId,
  });
  if (error) {
    mapShellStoreRpcError(error);
  }

  const row = data as ShellBootstrapRpcRow;
  const preferences = toPreferencesDto(row.preferences);
  const badgeCounts = toBadgeCounts(row.badgeCounts);
  const role = context.role;

  return {
    contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
    displayName: String(row.displayName ?? ""),
    uiLanguage: String(row.uiLanguage ?? "tr"),
    timezone: String(row.timezone ?? "Europe/Istanbul"),
    role,
    capabilities: resolveShellCapabilities(role),
    navigation: buildShellNavigation(role, badgeCounts),
    badgeCounts,
    homeActions: buildShellHomeActions({
      badgeCounts,
      lastDestinationId: preferences.lastDestinationId,
      role,
    }),
    activeClient: row.activeClient?.id ? toActiveClientDto(row.activeClient) : null,
    preferences,
    warnings: Array.isArray(row.warnings)
      ? row.warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
    sessionExpiresAt: String(row.sessionExpiresAt ?? new Date().toISOString()),
  };
}

export async function searchShellClients(
  context: AccountTenantContext,
  input: { query: string | null; limit: number },
): Promise<ShellClientSearchDto> {
  const decodedClientId = input.query ? decodeClientReferenceCode(input.query) : null;
  const { data, error } = await context.supabase.rpc("p85_stage_5_search_shell_clients_v1", {
    p_query: input.query,
    p_client_id: decodedClientId,
    p_limit: input.limit,
  });
  if (error) {
    mapShellStoreRpcError(error);
  }

  const rows = Array.isArray(data) ? (data as ShellClientSearchRpcRow[]) : [];
  const items = filterSearchItemsByReference(rows.map(toSearchItem), input.query).slice(0, input.limit);

  return {
    contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
    items,
  };
}

export async function updateShellPreferences(
  context: AccountTenantContext,
  patch: {
    requestId: string;
    expectedRevision: number;
    activeClientId?: string | null;
    lastDestinationId?: ShellDestinationId | null;
    destinationState?: Record<string, unknown>;
    clearActiveClient?: boolean;
  },
): Promise<ShellPreferencesPatchResultDto> {
  const rpcArgs: Record<string, unknown> = {
    p_expected_revision: patch.expectedRevision,
    p_request_id: patch.requestId,
    p_clear_active_client: patch.clearActiveClient === true,
  };
  if (patch.lastDestinationId !== undefined) {
    rpcArgs.p_last_destination_id = patch.lastDestinationId;
  }
  if (patch.destinationState !== undefined) {
    rpcArgs.p_destination_state = patch.destinationState;
  }
  if (patch.clearActiveClient !== true && patch.activeClientId !== undefined) {
    rpcArgs.p_active_client_id = patch.activeClientId;
  }

  const { data, error } = await context.supabase.rpc(
    "p85_stage_5_update_shell_preferences_v1",
    rpcArgs,
  );
  if (error) {
    mapShellStoreRpcError(error);
  }

  const row = data as {
    revision?: number;
    activeClientId?: string | null;
    lastDestinationId?: string | null;
    destinationState?: Record<string, unknown>;
    requestId?: string;
    idempotentReplay?: boolean;
  };

  const lastDestinationId = row.lastDestinationId;
  return {
    contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
    revision: Number(row.revision ?? 0),
    activeClientId: row.activeClientId ?? null,
    lastDestinationId:
      typeof lastDestinationId === "string" && isShellDestinationId(lastDestinationId)
        ? lastDestinationId
        : null,
    destinationState:
      row.destinationState &&
      typeof row.destinationState === "object" &&
      !Array.isArray(row.destinationState)
        ? row.destinationState
        : {},
    requestId: String(row.requestId ?? patch.requestId),
    idempotentReplay: row.idempotentReplay === true,
  };
}

export function resolveShellVersion(clientVersion: string): ShellVersionDto {
  const minClientVersion = resolveShellMinClientVersion();
  const deploymentVersion = resolveShellDeploymentVersion();
  return {
    contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
    deploymentVersion,
    minClientVersion,
    clientVersion,
    updateRequired: compareShellVersions(clientVersion, minClientVersion) < 0,
  };
}

export function assertSupabaseShellStoreConfigured(isConfigured: boolean) {
  if (!isConfigured) {
    throw new ShellApiError(503, "shell_bootstrap_unavailable");
  }
}

export function setShellStoreRpcClientForTests(_client: SupabaseClient | null) {
  // Reserved for future route-level integration tests.
}
