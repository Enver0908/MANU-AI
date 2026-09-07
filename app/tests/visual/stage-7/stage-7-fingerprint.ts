import { createHash } from "node:crypto";
import type { Stage7Finding } from "./stage-7-schema";

const VOLATILE_KEYS = new Set([
  "timestamp",
  "time",
  "date",
  "runId",
  "sessionId",
  "traceId",
  "requestId",
  "durationMs",
]);

export function normalizeFindingActual(value: string): string {
  return value
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, "http://127.0.0.1:<port>")
    .replace(/http:\/\/localhost:\d+/g, "http://localhost:<port>")
    .replace(/\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+/g, "<timestamp>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableFingerprintInput(finding: Pick<
  Stage7Finding,
  "category" | "surface" | "scenarioId" | "expected" | "actual" | "wcagCriteria"
>) {
  return {
    category: finding.category,
    surface: finding.surface,
    scenarioState: finding.scenarioId.split(".").slice(0, 3).join("."),
    expected: normalizeFindingActual(finding.expected),
    actual: normalizeFindingActual(finding.actual),
    wcagCriteria: [...finding.wcagCriteria].sort(),
  };
}

export function computeFindingFingerprint(
  finding: Pick<Stage7Finding, "category" | "surface" | "scenarioId" | "expected" | "actual" | "wcagCriteria">,
): string {
  const payload = stableFingerprintInput(finding);
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function stripVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripVolatileFields);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE_KEYS.has(key)) continue;
      output[key] = stripVolatileFields(nested);
    }
    return output;
  }
  return value;
}

export function mergeFindingsByFingerprint<T extends { fingerprint: string }>(findings: T[]): T[] {
  const merged = new Map<string, T>();
  for (const finding of findings) {
    if (!merged.has(finding.fingerprint)) {
      merged.set(finding.fingerprint, finding);
    }
  }
  return [...merged.values()].sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}
