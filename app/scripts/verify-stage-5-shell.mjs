#!/usr/bin/env node
/**
 * Stage 5 shell verification harness (Faz 9).
 * Runs local automation gates that do not require real devices.
 * Does not claim production GO or replace dependency/RLS/device/performance evidence.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const UNIT_TESTS = [
  "src/lib/phase-85-stage-5-shell-dirty-registry.test.ts",
  "src/lib/phase-85-stage-5-shell-i18n.test.ts",
  "src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
  "src/lib/phase-85-stage-5-shell-privacy-scan.test.ts",
  "src/lib/phase-85-stage-5-shell-bundle-budget.test.ts",
  "src/lib/phase-85-stage-5-shell-pwa.test.ts",
  "src/lib/phase-85-stage-5-shell-authenticated-mutation.test.ts",
  "src/lib/phase-85-stage-5-closure-gates.test.ts",
  "src/lib/phase-85-stage-5-shell-branding.test.ts",
  "src/lib/phase-85-stage-5-shell-navigation.test.ts",
  "src/lib/phase-85-stage-5-shell-preference-coordinator.test.ts",
  "src/lib/phase-85-stage-5-shell-contracts.test.ts",
  "src/lib/i18n.test.ts",
];

function run(label, command, args, cwd = appRoot, options = {}) {
  console.log(`\n[verify-stage-5-shell] ${label}`);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    stdio: options.stdio ?? "inherit",
    shell: true,
    encoding: options.stdio === "pipe" ? "utf8" : undefined,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const gate = {
    status: result.status === 0 ? "PASS" : "FAIL",
    durationMs: Date.now() - startedAt,
    exitCode: result.status ?? 1,
  };
  if (result.status !== 0) {
    gate.output = `${result.stdout || ""}${result.stderr || ""}`.slice(-8_000);
    report.gates[label] = gate;
    throw new Error(`${label} failed with exit ${result.status}`);
  }
  report.gates[label] = gate;
  return result;
}

function cleanNextBuildOutput() {
  const nextDir = join(appRoot, ".next");
  if (!existsSync(nextDir)) return;
  try {
    rmSync(nextDir, { force: true, recursive: true, maxRetries: 10, retryDelay: 500 });
  } catch (error) {
    report.gates.cleanNextBuildOutput = {
      status: "BLOCKED",
      reason: "next_build_artifact_locked",
      path: nextDir,
      error: error instanceof Error ? error.message : String(error),
    };
    throw error;
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
    const staticPath = join(nextDir, "static", String(relative).replace(/^static\//, ""));
    const sourcePath = existsSync(absolute) ? absolute : existsSync(staticPath) ? staticPath : null;
    if (!sourcePath) continue;
    const gzipBytes = gzipSync(readFileSync(sourcePath)).byteLength;
    measured.push({ file: relative, gzipBytes });
    total += gzipBytes;
  }
  return { totalGzipBytes: total, files: measured };
}

const report = {
  generatedAt: new Date().toISOString(),
  productionStatus: "NO-GO",
  closureStatus: "LOCAL_AUTOMATION_PENDING",
  r405: "covered_by_stage5_dependency_security_report",
  scope:
    "Stage 5 local shell verification only. Dependency security, real-device PWA proof, and zero-skip RLS are evaluated by dedicated Stage 5 gates; production launch gates remain separate from Stage 5.",
  gates: {},
};

try {
  run("production typecheck", "npm", ["run", "typecheck"]);
  run("stage-5 unit/contract tests", "npx", ["vitest", "run", ...UNIT_TESTS]);

  cleanNextBuildOutput();
  report.gates.cleanNextBuildOutput = { status: "PASS" };
  run("production build", "npm", ["run", "build"]);

  const nextDir = join(appRoot, ".next");
  const measured = measureShellEntryGzipBytes(nextDir);
  if (measured.files.length === 0 || measured.totalGzipBytes <= 0) {
    throw new Error("Shell bundle measurement produced no JS files");
  }
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
  report.closureStatus = "LOCAL_AUTOMATION_COMPLETE_DEDICATED_GATES_EVALUATED_SEPARATELY";
  report.blockers = [];
  report.scopeNotes = [
    "real_device_pwa_evidence_evaluated_by_stage5_closure_harness",
    "zero_skip_rls_evaluated_by_stage5_closure_harness",
    "dependency_security_evaluated_by_stage5_closure_harness",
    "production_launch_gates_outside_stage5_scope",
  ];

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\n[verify-stage-5-shell] PASS (local automation). Dedicated closure gates are evaluated separately.");
  console.log(`Report: ${reportPath}`);
} catch (error) {
  report.closureStatus = "BLOCKED";
  report.gates.error = error instanceof Error ? error.message : String(error);
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
}
