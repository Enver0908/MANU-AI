import type { ShellBootstrapDto, ShellRuntimeState } from "./phase-85-stage-5-shell-contracts";
import { PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION } from "./phase-85-stage-5-shell-contracts";

export const PHASE_85_STAGE_5_SHELL_PROVIDER_VERSION = "p85-stage-5-shell-provider-v1";

export type ShellProviderMode = "live" | "fallback";

export type ShellProviderState = {
  runtime: ShellRuntimeState;
  bootstrap: ShellBootstrapDto | null;
  requestSequence: number;
  focusMode: boolean;
  lastError: string | null;
  mode: ShellProviderMode;
  /** Optional SW update waiting for user confirmation. */
  updateWaiting: boolean;
  /** Required update keeps content readable; non-save mutations close. */
  updateRequired: boolean;
};

export type ShellProviderAction =
  | { type: "bootstrap_started"; sequence: number }
  | {
      type: "bootstrap_succeeded";
      sequence: number;
      bootstrap: ShellBootstrapDto;
    }
  | {
      type: "bootstrap_failed";
      sequence: number;
      runtime: Exclude<ShellRuntimeState, "booting" | "ready">;
      error: string;
    }
  | { type: "set_focus_mode"; focusMode: boolean }
  | { type: "reset_to_booting" }
  | { type: "go_offline" }
  | { type: "session_locked"; error?: string }
  | { type: "set_update_waiting"; waiting: boolean }
  | { type: "set_update_required"; required: boolean };

export function createInitialShellProviderState(
  mode: ShellProviderMode = "live",
): ShellProviderState {
  return {
    runtime: "booting",
    bootstrap: null,
    requestSequence: 0,
    focusMode: false,
    lastError: null,
    mode,
    updateWaiting: false,
    updateRequired: false,
  };
}

export function createFallbackShellBootstrap(input?: {
  displayName?: string;
  uiLanguage?: string;
  timezone?: string;
}): ShellBootstrapDto {
  return {
    contractVersion: PHASE_85_STAGE_5_SHELL_CONTRACT_VERSION,
    displayName: input?.displayName ?? "Dietitian",
    uiLanguage: input?.uiLanguage ?? "tr",
    timezone: input?.timezone ?? "Europe/Istanbul",
    role: "dietitian",
    capabilities: ["read_app_state"],
    navigation: [
      { id: "home", enabled: true },
      { id: "clients", enabled: true },
      { id: "messages", enabled: true },
      { id: "alerts", enabled: true },
      { id: "notifications", enabled: true },
      { id: "simulator", enabled: true },
      { id: "voice", enabled: true },
      { id: "forms", enabled: true },
      { id: "ai_chat", enabled: false, disabledReason: "feature_disabled" },
      { id: "settings", enabled: true },
      { id: "more", enabled: true },
    ],
    badgeCounts: { alerts: 0, handoffs: 0, messages: 0, notifications: 0 },
    homeActions: [],
    activeClient: null,
    preferences: {
      revision: 0,
      activeClientId: null,
      lastDestinationId: null,
      destinationState: {},
    },
    warnings: [],
    sessionExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

/**
 * Pure shell provider reducer. Stale bootstrap responses (lower sequence) are ignored.
 */
export function reduceShellProviderState(
  state: ShellProviderState,
  action: ShellProviderAction,
): ShellProviderState {
  switch (action.type) {
    case "bootstrap_started":
      return {
        ...state,
        runtime: state.runtime === "ready" ? "ready" : "booting",
        requestSequence: action.sequence,
        lastError: null,
      };
    case "bootstrap_succeeded":
      if (action.sequence < state.requestSequence) {
        return state;
      }
      return {
        ...state,
        runtime: state.updateRequired ? "update_required" : "ready",
        bootstrap: action.bootstrap,
        requestSequence: action.sequence,
        lastError: null,
      };
    case "bootstrap_failed":
      if (action.sequence < state.requestSequence) {
        return state;
      }
      if (action.runtime === "update_required") {
        return {
          ...state,
          runtime: "update_required",
          updateRequired: true,
          requestSequence: action.sequence,
          lastError: action.error,
          // Keep prior bootstrap so dirty screens remain readable for save-only.
        };
      }
      return {
        ...state,
        runtime: action.runtime,
        bootstrap: null,
        requestSequence: action.sequence,
        lastError: action.error,
      };
    case "set_focus_mode":
      return { ...state, focusMode: action.focusMode };
    case "reset_to_booting":
      return {
        ...state,
        runtime: "booting",
        bootstrap: null,
        lastError: null,
      };
    case "go_offline":
      return {
        ...state,
        runtime: "offline",
        bootstrap: null,
        lastError: "offline",
        focusMode: false,
      };
    case "session_locked":
      return {
        ...state,
        runtime: "session_locked",
        bootstrap: null,
        lastError: action.error ?? "session_inactive",
        focusMode: false,
      };
    case "set_update_waiting":
      return { ...state, updateWaiting: action.waiting };
    case "set_update_required":
      return {
        ...state,
        updateRequired: action.required,
        runtime: action.required ? "update_required" : state.runtime === "update_required" ? "ready" : state.runtime,
      };
    default:
      return state;
  }
}

export function mapShellBootstrapHttpFailure(input: {
  status: number;
  errorCode?: string | null;
  offline?: boolean;
}): Exclude<ShellRuntimeState, "booting" | "ready"> {
  if (input.offline) return "offline";
  if (input.status === 401 && input.errorCode === "session_inactive") {
    return "session_locked";
  }
  if (input.status === 403) {
    return "entitlement_blocked";
  }
  if (input.errorCode === "update_required" || input.errorCode === "client_update_required") {
    return "update_required";
  }
  return "service_unavailable";
}
