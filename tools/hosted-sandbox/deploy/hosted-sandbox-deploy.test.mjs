import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function createReleaseArchive(workRoot, identity) {
  const packageRoot = path.join(workRoot, "package");
  mkdirSync(packageRoot, { recursive: true });
  const serverPath = path.join(packageRoot, "server.js");
  writeFileSync(serverPath, "console.log('ok');\n", "utf8");
  const innerManifest = {
    schemaVersion: 1,
    releaseId: identity.releaseId,
    commitSha: identity.commitSha,
    migrationFingerprint: identity.migrationFingerprint,
    compatibilityVersion: identity.compatibilityVersion,
    files: [{ path: "server.js", bytes: 19, sha256: sha256File(serverPath) }],
  };
  writeFileSync(path.join(packageRoot, "release-manifest.json"), JSON.stringify(innerManifest, null, 2) + "\n", "utf8");
  const archivePath = path.join(workRoot, identity.releaseId + ".tar.gz");
  const tar = spawnSync("tar", ["-czf", archivePath, "-C", packageRoot, "."], { encoding: "utf8" });
  assert.equal(tar.status, 0, tar.stderr || tar.stdout);
  const archiveSha256 = sha256File(archivePath);
  const archiveSha256Path = archivePath + ".sha256";
  writeFileSync(archiveSha256Path, archiveSha256 + "  " + path.basename(archivePath) + "\n", "utf8");
  return { archivePath, archiveSha256Path, archiveSha256, packageRoot };
}

function writeOuterManifest(workRoot, identity) {
  const releaseArtifact = createReleaseArchive(workRoot, identity);
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
        releaseArtifact,
        entries: [],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  return { manifestPath, releaseArtifact };
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
  const { releaseArtifact } = writeOuterManifest(workRoot, identity);
  const result = runNode(deployScript, [], {
    MANU_DEPLOY_WORK_ROOT: workRoot,
    MANU_DEPLOY_TEXT_POINTER: "true",
    MANU_RELEASE_ARTIFACT_REQUIRED: "true",
    MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(payload.artifactMode, "archive");
  assert.equal(payload.artifactSha256, releaseArtifact.archiveSha256);
  assert.equal(
    readFileSync(path.join(workRoot, "releases", identity.commitSha, "RELEASE_ARTIFACT_SHA256.txt"), "utf8").trim(),
    releaseArtifact.archiveSha256,
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
  const { manifestPath } = writeOuterManifest(workRoot, identity);

  const failed = runNode(deployScript, ["--apply"], {
    MANU_DEPLOY_WORK_ROOT: workRoot,
    MANU_DEPLOY_TEXT_POINTER: "true",
    MANU_HOSTED_DEPLOY_APPROVED: "true",
    MANU_SSH_HOST_KEY_PIN: "SHA256:abcdefghijklmnopqrstuvwxyz0123456789+/=",
    MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
    MANU_SMOKE_CHECK_FORCE_FAIL: "true",
    MANU_DEPLOY_SKIP_PM2: "true",
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
