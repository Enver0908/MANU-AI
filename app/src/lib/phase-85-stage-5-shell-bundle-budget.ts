/**
 * Stage 5 shell bundle budget helpers (Faz 9).
 * Faz 1 did not publish a gzip number; Faz 9 locks the measured local baseline
 * and enforces ≤ +10% for shell entry JS gzip thereafter.
 */

import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const STAGE5_SHELL_BUNDLE_BUDGET_MULTIPLIER = 1.1;

export type ShellBundleBaseline = {
  lockedAt: string;
  note: string;
  shellEntryGzipBytes: number;
};

export function gzipByteLength(buffer: Buffer) {
  return gzipSync(buffer).byteLength;
}

export function resolveShellEntryCandidates(nextDir: string) {
  const buildManifestPath = join(nextDir, "build-manifest.json");
  const candidates = new Set<string>();

  if (existsSync(buildManifestPath)) {
    const buildManifest = JSON.parse(readFileSync(buildManifestPath, "utf8")) as {
      rootMainFiles?: string[];
      pages?: Record<string, string[]>;
    };
    for (const file of buildManifest.rootMainFiles ?? []) candidates.add(file);
    for (const files of Object.values(buildManifest.pages ?? {})) {
      for (const file of files) {
        if (file.includes("dashboard") || file.includes("main-app") || file.includes("webpack")) {
          candidates.add(file);
        }
      }
    }
  }

  return [...candidates].filter((file) => file.endsWith(".js"));
}

export function measureShellEntryGzipBytes(nextDir: string) {
  const files = resolveShellEntryCandidates(nextDir);
  let total = 0;
  const measured: Array<{ file: string; gzipBytes: number }> = [];
  for (const relative of files) {
    const absolute = join(nextDir, relative);
    const staticPath = join(nextDir, "static", relative.replace(/^static\//, ""));
    const path = existsSync(absolute) ? absolute : existsSync(staticPath) ? staticPath : null;
    if (!path) continue;
    const bytes = gzipByteLength(readFileSync(path));
    measured.push({ file: relative, gzipBytes: bytes });
    total += bytes;
  }
  return { totalGzipBytes: total, files: measured };
}

export function evaluateShellBundleBudget(currentGzipBytes: number, baselineGzipBytes: number) {
  const limit = Math.floor(baselineGzipBytes * STAGE5_SHELL_BUNDLE_BUDGET_MULTIPLIER);
  return {
    currentGzipBytes,
    baselineGzipBytes,
    limitGzipBytes: limit,
    withinBudget: currentGzipBytes <= limit,
    deltaPct:
      baselineGzipBytes === 0 ? 0 : ((currentGzipBytes - baselineGzipBytes) / baselineGzipBytes) * 100,
  };
}

export function readOrCreateBundleBaseline(baselinePath: string, measuredGzipBytes: number): ShellBundleBaseline {
  if (existsSync(baselinePath)) {
    return JSON.parse(readFileSync(baselinePath, "utf8")) as ShellBundleBaseline;
  }
  const baseline: ShellBundleBaseline = {
    lockedAt: new Date().toISOString(),
    note: "Faz 1 published no gzip baseline; Faz 9 locks the first local production-build measurement.",
    shellEntryGzipBytes: measuredGzipBytes,
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return baseline;
}
