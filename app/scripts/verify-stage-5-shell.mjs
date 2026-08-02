#!/usr/bin/env node
/**
 * Stage 5 shell verification harness (Faz 9).
 * Runs local automation gates that do not require real devices.
 * Does not claim production GO or close R-405.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const repoRoot = join(appRoot, "..");
const evidenceDir = join(repoRoot, "docs");
const baselinePath = join(evidenceDir, "PHASE_85_STAGE_5_SHELL_BUNDLE_BASELINE.json");
const reportPath = join(evidenceDir, "PHASE_85_STAGE_5_SHELL_VERIFY_REPORT.json");
const BUDGET_MULTIPLIER = 1.1;

function run(label, command, args, cwd = appRoot) {
  console.log(`\n[verify-stage-5-shell] ${label}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}

function measureShellEntryGzipBytes(nextDir) {
  const buildManifestPath = join(nextDir, "build-manifest.json");
  if (!existsSync(buildManifestPath)) return { totalGzipBytes: 0, files: [] };
  const buildManifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
  const candidates = new Set([...(buildManifest.rootMainFiles || [])]);
  for (const files of Object.values(buildManifest.pages || {})) {
    for (const file of files) {
      if (String(file).includes("dashboard") || String(file).includes("main-app") || String(file).includes("webpack")) {
        candidates.add(file);
      }
    }
  }
  let total = 0;
  const measured = [];
  for (const relative of candidates) {
    if (!String(relative).endsWith(".js")) continue;
    const absolute = join(nextDir, relative);
    if (!existsSync(absolute)) continue;
    const gzipBytes = gzipSync(readFileSync(absolute)).byteLength;
    measured.push({ file: relative, gzipBytes });
    total += gzipBytes;
  }
  return { totalGzipBytes: total, files: measured };
}

const report = {
  generatedAt: new Date().toISOString(),
  productionStatus: "NO-GO",
  r405: "open",
  gates: {},
};

try {
  run("stage-5 unit/contract tests", "npx", [
    "vitest",
    "run",
    "src/lib/phase-85-stage-5-shell-dirty-registry.test.ts",
    "src/lib/phase-85-stage-5-shell-i18n.test.ts",
    "src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
    "src/lib/phase-85-stage-5-shell-privacy-scan.test.ts",
    "src/lib/phase-85-stage-5-shell-bundle-budget.test.ts",
    "src/lib/phase-85-stage-5-shell-pwa.test.ts",
    "src/lib/phase-85-stage-5-shell-branding.test.ts",
    "src/lib/phase-85-stage-5-shell-navigation.test.ts",
    "src/lib/phase-85-stage-5-shell-contracts.test.ts",
    "src/lib/i18n.test.ts",
  ]);
  report.gates.unitContracts = "PASS";

  const nextDir = join(appRoot, ".next");
  if (!existsSync(nextDir)) {
    run("production build (for bundle budget)", "npm", ["run", "build"]);
  }
  const measured = measureShellEntryGzipBytes(nextDir);
  let baseline;
  if (existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } else {
    baseline = {
      lockedAt: new Date().toISOString(),
      note: "Faz 1 published no gzip baseline; Faz 9 locks the first local production-build measurement.",
      shellEntryGzipBytes: measured.totalGzipBytes || 1,
    };
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  }
  const limit = Math.floor((baseline.shellEntryGzipBytes || 1) * BUDGET_MULTIPLIER);
  const budget = {
    currentGzipBytes: measured.totalGzipBytes || 0,
    baselineGzipBytes: baseline.shellEntryGzipBytes || 1,
    limitGzipBytes: limit,
    withinBudget: (measured.totalGzipBytes || 0) <= limit,
    filesMeasured: measured.files.length,
  };
  report.gates.bundleBudget = budget;
  if (!budget.withinBudget) {
    throw new Error(
      `Shell entry gzip ${budget.currentGzipBytes} exceeds +10% of baseline ${budget.baselineGzipBytes}`,
    );
  }
  report.gates.bundleBudgetStatus = "PASS";

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\n[verify-stage-5-shell] PASS (local automation). Real-device and RLS gates remain separate.");
  console.log(`Report: ${reportPath}`);
} catch (error) {
  report.gates.error = error instanceof Error ? error.message : String(error);
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
}
