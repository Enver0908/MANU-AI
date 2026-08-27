import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import {
  assertDeployEnvironmentSafe,
  assertMigrationFingerprintMatch,
  assertReleaseArtifactManifest,
} from "./lib/deploy-contract.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const deployScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "deploy-hosted-release.mjs");

function runNode(script, args = [], env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("forbidden deploy flags fail closed", () => {
  assert.throws(
    () => assertDeployEnvironmentSafe({ MANU_ENABLE_LIVE_BILLING: "true" }),
    /forbidden deploy flag enabled/,
  );
});

test("fingerprint mismatch blocks deploy", () => {
  assert.throws(
    () => assertMigrationFingerprintMatch("a".repeat(64), "b".repeat(64)),
    /migration fingerprint mismatch blocks deploy/,
  );
  const bad = runNode(deployScript, [], {
    MANU_EXPECTED_MIGRATION_FINGERPRINT: "f".repeat(64),
  });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr + bad.stdout, /migration fingerprint mismatch blocks deploy/);
});

test("release artifact manifest validation fails closed", () => {
  assert.throws(() => assertReleaseArtifactManifest(null), /release artifact manifest is required/);
  assert.throws(
    () =>
      assertReleaseArtifactManifest(
        {
          mode: "archive",
          commitSha: "a".repeat(40),
          migrationFingerprint: "b".repeat(64),
          releaseId: "hs-test",
          releaseArtifact: { archivePath: "release.zip", archiveSha256: "c".repeat(64) },
        },
        { requireArchive: true },
      ),
    /release artifact archive path must end with .tar.gz/,
  );
});

test("dry-run atomic deploy passes", () => {
  const result = runNode(deployScript, []);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(payload.result, "PASS");
  assert.equal(payload.mode, "dry-run");
});

test("artifact-required dry-run binds archive sha", () => {
  const identity = buildReleaseIdentity({ repoRoot, env: process.env });
  const workRoot = path.join(os.tmpdir(), "manu-hosted-sandbox-artifact-required-test");
  rmSync(workRoot, { recursive: true, force: true });
  mkdirSync(workRoot, { recursive: true });
  const manifestPath = path.join(workRoot, "release-manifest.json");
  const archiveSha256 = "c".repeat(64);
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        mode: "archive",
        commitSha: identity.commitSha,
        migrationFingerprint: identity.migrationFingerprint,
        releaseId: identity.releaseId,
        compatibilityVersion: identity.compatibilityVersion,
        releaseArtifact: {
          archivePath: path.join(workRoot, identity.releaseId + ".tar.gz"),
          archiveSha256Path: path.join(workRoot, identity.releaseId + ".tar.gz.sha256"),
          archiveSha256,
        },
        entries: [],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  const result = runNode(deployScript, [], {
    MANU_DEPLOY_WORK_ROOT: workRoot,
    MANU_DEPLOY_TEXT_POINTER: "true",
    MANU_RELEASE_ARTIFACT_REQUIRED: "true",
    MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(payload.artifactMode, "archive");
  assert.equal(payload.artifactSha256, archiveSha256);
  assert.equal(
    readFileSync(path.join(workRoot, "releases", identity.commitSha, "RELEASE_ARTIFACT_SHA256.txt"), "utf8").trim(),
    archiveSha256,
  );
});

test("rollback on smoke failure restores previous release", () => {
  const identity = buildReleaseIdentity({ repoRoot, env: process.env });
  const workRoot = path.join(os.tmpdir(), "manu-hosted-sandbox-rollback-test");
  rmSync(workRoot, { recursive: true, force: true });
  const previousSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const previousDir = path.join(workRoot, "releases", previousSha);
  mkdirSync(previousDir, { recursive: true });
  writeFileSync(path.join(previousDir, "RELEASE_ID.txt"), "hs-prev\n", "utf8");
  writeFileSync(path.join(workRoot, "previous-release.txt"), previousSha + "\n", "utf8");
  writeFileSync(path.join(workRoot, "current-release.txt"), previousSha + "\n", "utf8");
  const manifestPath = path.join(workRoot, "release-manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        mode: "archive",
        commitSha: identity.commitSha,
        migrationFingerprint: identity.migrationFingerprint,
        releaseId: identity.releaseId,
        compatibilityVersion: identity.compatibilityVersion,
        releaseArtifact: {
          archivePath: path.join(workRoot, identity.releaseId + ".tar.gz"),
          archiveSha256Path: path.join(workRoot, identity.releaseId + ".tar.gz.sha256"),
          archiveSha256: "d".repeat(64),
        },
        entries: [],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const failed = runNode(deployScript, ["--apply"], {
    MANU_DEPLOY_WORK_ROOT: workRoot,
    MANU_DEPLOY_TEXT_POINTER: "true",
    MANU_HOSTED_DEPLOY_APPROVED: "true",
    MANU_SSH_HOST_KEY_PIN: "SHA256:abcdefghijklmnopqrstuvwxyz0123456789+/=",
    MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
    MANU_SMOKE_CHECK_FORCE_FAIL: "true",
  });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr + failed.stdout, /rolled back to/);
  const activeSha = readFileSync(path.join(workRoot, "current-release.txt"), "utf8").trim();
  assert.equal(activeSha, previousSha);
  const currentTarget = readFileSync(path.join(workRoot, "releases", activeSha, "RELEASE_ID.txt"), "utf8");
  assert.equal(currentTarget.trim(), "hs-prev");
});

test("nginx template verify passes", () => {
  const result = runNode(path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-nginx-template.mjs"));
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("workflow hardening passes", () => {
  const install = runNode(path.join(path.dirname(fileURLToPath(import.meta.url)), "install-workflows.mjs"));
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const result = runNode(path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-workflow-hardening.mjs"));
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
