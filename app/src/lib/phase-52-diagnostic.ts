export type Phase52SharedReadStartPolicy = "independent" | "bootstrap_gate";

type Phase52EventValue = string | number | boolean | null;

type Phase52ClientEvent = {
  name: string;
  atWallMs: number;
  atPerformanceMs: number;
  [key: string]: Phase52EventValue;
};

type Phase52RuntimeWindow = Window & {
  __aiyaPhase52TraceEnabled?: boolean;
  __aiyaPhase52SharedReadStartPolicy?: Phase52SharedReadStartPolicy;
  __aiyaPhase52Events?: Phase52ClientEvent[];
};

export function resolvePhase52SharedReadStartPolicy(): Phase52SharedReadStartPolicy {
  if (typeof window === "undefined") return "independent";

  const runtimeWindow = window as Phase52RuntimeWindow;
  if (runtimeWindow.__aiyaPhase52TraceEnabled !== true) return "independent";
  return runtimeWindow.__aiyaPhase52SharedReadStartPolicy === "bootstrap_gate"
    ? "bootstrap_gate"
    : "independent";
}

export function recordPhase52ClientEvent(
  name: string,
  details: Record<string, Phase52EventValue> = {},
) {
  if (typeof window === "undefined") return;

  const runtimeWindow = window as Phase52RuntimeWindow;
  if (runtimeWindow.__aiyaPhase52TraceEnabled !== true) return;

  const atPerformanceMs = window.performance.now();
  runtimeWindow.__aiyaPhase52Events ??= [];
  runtimeWindow.__aiyaPhase52Events.push({
    name,
    atWallMs: Date.now(),
    atPerformanceMs: Number(atPerformanceMs.toFixed(3)),
    ...details,
  });
}
