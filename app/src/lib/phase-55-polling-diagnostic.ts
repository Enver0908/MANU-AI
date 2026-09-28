export type Phase55PollingPolicy = "current" | "navigation_window_pause_cancel";

type Phase55EventValue = string | number | boolean | null;

type Phase55ClientEvent = {
  name: string;
  atWallMs: number;
  atPerformanceMs: number;
  [key: string]: Phase55EventValue;
};

type Phase55RuntimeWindow = Window & {
  __aiyaPhase55TraceEnabled?: boolean;
  __aiyaPhase55PollingPolicy?: Phase55PollingPolicy;
  __aiyaPhase55NavigationWindowUntilWallMs?: number;
  __aiyaPhase55NavigationWindowTimer?: number;
  __aiyaPhase55Events?: Phase55ClientEvent[];
};

export const PHASE55_NAVIGATION_WINDOW_EVENT = "aiya-phase55-navigation-window-changed";
export const PHASE55_NAVIGATION_WINDOW_MS = 5_000;

export function resolvePhase55PollingPolicyFromRuntime(input: {
  traceEnabled?: boolean;
  policy?: Phase55PollingPolicy;
}): Phase55PollingPolicy {
  if (input.traceEnabled !== true) return "current";
  return input.policy === "navigation_window_pause_cancel"
    ? "navigation_window_pause_cancel"
    : "current";
}

export function shouldPausePhase55PollingAt(
  policy: Phase55PollingPolicy,
  navigationWindowUntilWallMs: number | null | undefined,
  nowWallMs: number,
) {
  return policy === "navigation_window_pause_cancel" &&
    typeof navigationWindowUntilWallMs === "number" &&
    navigationWindowUntilWallMs > nowWallMs;
}

export function resolvePhase55PollingPolicy(): Phase55PollingPolicy {
  if (typeof window === "undefined") return "current";
  const runtimeWindow = window as Phase55RuntimeWindow;
  return resolvePhase55PollingPolicyFromRuntime({
    traceEnabled: runtimeWindow.__aiyaPhase55TraceEnabled,
    policy: runtimeWindow.__aiyaPhase55PollingPolicy,
  });
}

export function isPhase55NavigationWindowActive(nowWallMs = Date.now()) {
  if (typeof window === "undefined") return false;
  const runtimeWindow = window as Phase55RuntimeWindow;
  return shouldPausePhase55PollingAt(
    resolvePhase55PollingPolicy(),
    runtimeWindow.__aiyaPhase55NavigationWindowUntilWallMs,
    nowWallMs,
  );
}

export function recordPhase55ClientEvent(
  name: string,
  details: Record<string, Phase55EventValue> = {},
) {
  if (typeof window === "undefined") return;
  const runtimeWindow = window as Phase55RuntimeWindow;
  if (runtimeWindow.__aiyaPhase55TraceEnabled !== true) return;
  runtimeWindow.__aiyaPhase55Events ??= [];
  runtimeWindow.__aiyaPhase55Events.push({
    name,
    atWallMs: Date.now(),
    atPerformanceMs: Number(window.performance.now().toFixed(3)),
    ...details,
  });
}

function dispatchNavigationWindowChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PHASE55_NAVIGATION_WINDOW_EVENT));
}

export function endPhase55NavigationWindow() {
  if (typeof window === "undefined") return;
  const runtimeWindow = window as Phase55RuntimeWindow;
  runtimeWindow.__aiyaPhase55NavigationWindowUntilWallMs = 0;
  recordPhase55ClientEvent("phase55_navigation_window_ended");
  dispatchNavigationWindowChange();
}

export function beginPhase55NavigationWindow(reason: string) {
  if (typeof window === "undefined" || resolvePhase55PollingPolicy() !== "navigation_window_pause_cancel") {
    return;
  }
  const runtimeWindow = window as Phase55RuntimeWindow;
  if (runtimeWindow.__aiyaPhase55NavigationWindowTimer != null) {
    window.clearTimeout(runtimeWindow.__aiyaPhase55NavigationWindowTimer);
  }
  const untilWallMs = Date.now() + PHASE55_NAVIGATION_WINDOW_MS;
  runtimeWindow.__aiyaPhase55NavigationWindowUntilWallMs = untilWallMs;
  recordPhase55ClientEvent("phase55_navigation_window_started", {
    reason,
    durationMs: PHASE55_NAVIGATION_WINDOW_MS,
  });
  dispatchNavigationWindowChange();
  runtimeWindow.__aiyaPhase55NavigationWindowTimer = window.setTimeout(() => {
    runtimeWindow.__aiyaPhase55NavigationWindowTimer = undefined;
    endPhase55NavigationWindow();
  }, PHASE55_NAVIGATION_WINDOW_MS);
}
