export type Phase55BundlePolicy = "current_eager" | "deferred_dynamic";

type Phase55BundleEventValue = string | number | boolean | null;

export type Phase55BundleEvent = {
  name: string;
  atWallMs: number;
  atPerformanceMs: number;
  policy: Phase55BundlePolicy;
  [key: string]: Phase55BundleEventValue;
};

type Phase55BundleRuntimeWindow = Window & {
  __aiyaPhase55BundleTraceEnabled?: boolean;
  __aiyaPhase55BundlePolicy?: Phase55BundlePolicy;
  __aiyaPhase55BundleEvents?: Phase55BundleEvent[];
};

export function resolvePhase55BundlePolicyFromRuntime(input: {
  traceEnabled?: boolean;
  policy?: Phase55BundlePolicy;
}): Phase55BundlePolicy {
  if (input.traceEnabled !== true) return "current_eager";
  return input.policy === "deferred_dynamic" ? "deferred_dynamic" : "current_eager";
}

export function resolvePhase55BundlePolicy(): Phase55BundlePolicy {
  if (typeof window === "undefined") return "current_eager";
  const runtimeWindow = window as Phase55BundleRuntimeWindow;
  return resolvePhase55BundlePolicyFromRuntime({
    traceEnabled: runtimeWindow.__aiyaPhase55BundleTraceEnabled,
    policy: runtimeWindow.__aiyaPhase55BundlePolicy,
  });
}

export function recordPhase55BundleEvent(
  name: string,
  details: Record<string, Phase55BundleEventValue> = {},
) {
  if (typeof window === "undefined") return;
  const runtimeWindow = window as Phase55BundleRuntimeWindow;
  if (runtimeWindow.__aiyaPhase55BundleTraceEnabled !== true) return;
  runtimeWindow.__aiyaPhase55BundleEvents ??= [];
  runtimeWindow.__aiyaPhase55BundleEvents.push({
    name,
    atWallMs: Date.now(),
    atPerformanceMs: Number(window.performance.now().toFixed(3)),
    policy: resolvePhase55BundlePolicy(),
    ...details,
  });
}
