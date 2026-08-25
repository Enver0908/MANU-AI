#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import {
  assertDeployEnvironmentSafe,
  assertMigrationFingerprintMatch,
  assertSshHostKeyPin,
  RELEASES_ROOT,
} from "./lib/deploy-contract.mjs";
import { runSmokeCheck } from "./run-smoke-check.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");
const simRoot = path.join(repoRoot, ".execution-governance", "runtime", "hosted-sandbox", "deploy-sim");
const workRoot = process.env.MANU_DEPLOY_WORK_ROOT
  ? path.resolve(process.env.MANU_DEPLOY_WORK_ROOT)
  : dryRun
    ? simRoot
    : RELEASES_ROOT;
const useTextPointer = process.env.MANU_DEPLOY_TEXT_POINTER === "true";
const linkType = process.platform === "win32" ? "junction" : "dir";

function currentPointerPath(rootDir) {
  return path.join(rootDir, useTextPointer ? "current-release.txt" : "current");
}

function activateRelease(rootDir, commitSha) {
  const releaseDir = path.join(rootDir, "releases", commitSha);
  if (useTextPointer) {
    writeFileSync(currentPointerPath(rootDir), commitSha + "\n", "utf8");
    return releaseDir;
  }
  const currentLink = currentPointerPath(rootDir);
  if (existsSync(currentLink)) {
    rmSync(currentLink, { force: true, recursive: true });
  }
  symlinkSync(releaseDir, currentLink, linkType);
  return releaseDir;
}

assertDeployEnvironmentSafe(process.env);

const identity = buildReleaseIdentity({ repoRoot, env: process.env });
const expectedFingerprint = String(process.env.MANU_EXPECTED_MIGRATION_FINGERPRINT ?? identity.migrationFingerprint);
assertMigrationFingerprintMatch(expectedFingerprint, identity.migrationFingerprint);

if (!dryRun) {
  assertSshHostKeyPin(process.env.MANU_SSH_HOST_KEY_PIN);
  if (process.env.MANU_HOSTED_DEPLOY_APPROVED !== "true") {
    throw new Error("MANU_HOSTED_DEPLOY_APPROVED=true is required for apply");
  }
}

const releaseDir = path.join(workRoot, "releases", identity.commitSha);
const previousPointer = path.join(workRoot, "previous-release.txt");

mkdirSync(releaseDir, { recursive: true });
writeFileSync(path.join(releaseDir, "RELEASE_ID.txt"), identity.releaseId + "\n", "utf8");

let previous = "";
if (existsSync(previousPointer)) {
  previous = readFileSync(previousPointer, "utf8").trim();
}

activateRelease(workRoot, identity.commitSha);

let smokeOk = true;
try {
  if (dryRun) {
    smokeOk = true;
  } else {
    await runSmokeCheck(process.env.MANU_SMOKE_BASE_URL);
  }
} catch {
  smokeOk = false;
}

if (!smokeOk && previous) {
  const rollbackDir = path.join(workRoot, "releases", previous);
  if (existsSync(rollbackDir)) {
    activateRelease(workRoot, previous);
    throw new Error("deploy smoke failed; rolled back to " + previous);
  }
  throw new Error("deploy smoke failed; rollback target missing");
}

if (!smokeOk) {
  throw new Error("deploy smoke failed");
}

writeFileSync(previousPointer, identity.commitSha + "\n", "utf8");
process.stdout.write(JSON.stringify({
  result: "PASS",
  mode: dryRun ? "dry-run" : "apply",
  releaseDir,
  currentLink: currentPointerPath(workRoot),
  releaseId: identity.releaseId,
  commitSha: identity.commitSha,
}, null, 2) + "\n");
