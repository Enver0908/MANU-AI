#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import { assertDeployEnvironmentSafe } from "../deploy/lib/deploy-contract.mjs";
import {
  ACTIVATION_STEPS,
  ACTIVATION_APPROVAL_KEYS,
  IOS_PHYSICAL_DEVICE_STATUS,
  assertActivationApprovals,
  assertCleanupApplyApproval,
  isApprovalEnabled,
} from "./lib/activation-contract.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const runtimeDir = path.join(repoRoot, ".manu-runtime", "hosted-sandbox", "activation");
const maintenanceFlag = path.join(runtimeDir, "maintenance-mode.flag");

function runNodeScript(scriptRel, args = [], env = process.env) {
  const scriptPath = path.join(repoRoot, scriptRel);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(scriptRel + " failed: " + (result.stderr || result.stdout || "").trim());
  }
  return (result.stdout || "").trim();
}

export async function runHostedActivation(options = {}) {
  const env = options.env ?? process.env;
  const apply = options.apply ?? false;
  const applyCleanup = options.applyCleanup ?? false;
  const report = {
    schemaVersion: "1.0.0",
    mode: apply ? "apply" : "dry-run",
    steps: {},
    iosPhysicalDevice: IOS_PHYSICAL_DEVICE_STATUS,
    productionStatus: "NO-GO",
  };

  assertDeployEnvironmentSafe(env);
  assertActivationApprovals(env, { apply });
  assertCleanupApplyApproval(env, applyCleanup);

  mkdirSync(runtimeDir, { recursive: true });

  if (apply) {
    writeFileSync(maintenanceFlag, new Date().toISOString() + "\n", "utf8");
    report.steps.maintenance_on = "APPLIED";
  } else {
    report.steps.maintenance_on = "SIMULATED";
  }

  const identity = buildReleaseIdentity({ repoRoot, env });
  report.releaseId = identity.releaseId;
  report.commitSha = identity.commitSha;
  report.migrationFingerprint = identity.migrationFingerprint;

  const backupManifestDir = path.join(repoRoot, ".manu-runtime", "hosted-sandbox", "backups");
  const hasBackupManifest = existsSync(backupManifestDir);
  if (apply && !isApprovalEnabled(env, ACTIVATION_APPROVAL_KEYS.backup)) {
    throw new Error("backup approval missing");
  }
  report.steps.backup_freshness = hasBackupManifest ? "MANIFEST_PRESENT" : apply ? "BLOCKED_NO_MANIFEST" : "SIMULATED";

  const manifestOutput = runNodeScript("tools/hosted-sandbox/deploy/build-release-artifact.mjs", ["--manifest-only"], env);
  const manifestSummary = JSON.parse(manifestOutput);
  report.steps.release_manifest = "PASS";
  report.manifestSummary = manifestSummary;

  const manifestPath = manifestSummary.manifestPath;
  if (!manifestPath || !existsSync(manifestPath)) {
    throw new Error("release manifest missing after build");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (identity.migrationFingerprint !== manifest.migrationFingerprint) {
    throw new Error("migration fingerprint drift between identity and manifest");
  }
  report.steps.migration_fingerprint = "PASS";

  const supabaseUrl = String(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (supabaseUrl) {
    const cleanupOutput = runNodeScript("app/scripts/hosted-sandbox-demo-cleanup.mjs", ["--dry-run"], env);
    report.steps.demo_cleanup_dry_run = "PASS";
    report.demoCleanupDryRun = cleanupOutput.split("\n").slice(0, 6).join("\n");
    if (applyCleanup) {
      runNodeScript("app/scripts/hosted-sandbox-demo-cleanup.mjs", ["--apply"], env);
      report.steps.demo_cleanup_apply = "APPLIED";
    } else {
      report.steps.demo_cleanup_apply = apply ? "SKIPPED" : "SIMULATED";
    }
  } else {
    report.steps.demo_cleanup_dry_run = "BLOCKED_NO_SUPABASE";
    report.steps.demo_cleanup_apply = "BLOCKED_NO_SUPABASE";
  }

  const deployOutput = runNodeScript(
    "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs",
    apply ? ["--apply"] : [],
    {
      ...env,
      MANU_DEPLOY_TEXT_POINTER: env.MANU_DEPLOY_TEXT_POINTER ?? "true",
      MANU_EXPECTED_MIGRATION_FINGERPRINT: identity.migrationFingerprint,
    },
  );
  report.steps.deploy_switch = apply ? "APPLIED" : "DRY_RUN_PASS";
  report.deploySummary = JSON.parse(deployOutput);

  if (apply) {
    const smokeModule = await import("../deploy/run-smoke-check.mjs");
    await smokeModule.runSmokeCheck(env.MANU_SMOKE_BASE_URL ?? "http://127.0.0.1:3000");
    report.steps.smoke_check = "PASS";
    rmSync(maintenanceFlag, { force: true });
    report.steps.maintenance_off = "APPLIED";
  } else {
    report.steps.smoke_check = "SIMULATED";
    report.steps.maintenance_off = "SIMULATED";
  }

  for (const step of ACTIVATION_STEPS) {
    if (!report.steps[step]) {
      throw new Error("missing step result: " + step);
    }
  }

  const reportPath = path.join(runtimeDir, "activation-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return { report, reportPath };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const apply = process.argv.includes("--apply");
  const applyCleanup = process.argv.includes("--cleanup-apply");
  try {
    const result = await runHostedActivation({ apply, applyCleanup, env: process.env });
    process.stdout.write(JSON.stringify({ result: "PASS", reportPath: result.reportPath, mode: result.report.mode }, null, 2) + "\n");
  } catch (error) {
    process.stderr.write("FAIL hosted activation: " + (error instanceof Error ? error.message : String(error)) + "\n");
    process.exit(1);
  }
}
