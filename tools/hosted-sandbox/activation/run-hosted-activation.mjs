#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import { readBackupManifest, sha256File } from "../lib/backup-manifest.mjs";
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

function resolveMaintenanceFlag(env) {
  const root = String(env.MANU_DEPLOY_WORK_ROOT ?? "").trim() || "/opt/manu-ai";
  return path.join(root, "maintenance.flag");
}

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
  const maintenanceFlag = resolveMaintenanceFlag(env);

  if (apply) {
    mkdirSync(path.dirname(maintenanceFlag), { recursive: true });
    writeFileSync(maintenanceFlag, new Date().toISOString() + "\n", "utf8");
    report.steps.maintenance_on = "APPLIED";
  } else {
    report.steps.maintenance_on = "SIMULATED";
  }

  const identity = buildReleaseIdentity({ repoRoot, env });
  report.releaseId = identity.releaseId;
  report.commitSha = identity.commitSha;
  report.migrationFingerprint = identity.migrationFingerprint;

  if (apply && !isApprovalEnabled(env, ACTIVATION_APPROVAL_KEYS.backup)) {
    throw new Error("backup approval missing");
  }
  const backupManifestPath = String(env.MANU_HOSTED_SANDBOX_BACKUP_MANIFEST ?? "").trim();
  if (backupManifestPath) {
    const manifest = readBackupManifest(path.resolve(backupManifestPath), {
      expectedProjectRef: env.MANU_HOSTED_SANDBOX_PROJECT_REF,
    });
    if (sha256File(manifest.encryptedPath) !== manifest.backupSha256) {
      throw new Error("backup_hash_mismatch");
    }
    report.steps.backup_freshness = "PASS";
    report.backupManifest = {
      sourceProjectRef: manifest.sourceProjectRef,
      createdAt: manifest.createdAt,
      backupSha256: manifest.backupSha256,
    };
  } else if (apply) {
    throw new Error("backup_manifest_missing");
  } else {
    report.steps.backup_freshness = "SIMULATED";
  }

  const manifestOutput = runNodeScript(
    "tools/hosted-sandbox/deploy/build-release-artifact.mjs",
    apply ? [] : ["--manifest-only"],
    env,
  );
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
      MANU_RELEASE_ARTIFACT_REQUIRED: apply ? "true" : (env.MANU_RELEASE_ARTIFACT_REQUIRED ?? ""),
      MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
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
