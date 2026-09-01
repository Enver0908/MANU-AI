#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import {
  assertDeployEnvironmentSafe,
  assertMigrationFingerprintMatch,
  assertReleaseArtifactManifest,
  assertSshHostKeyPin,
  RELEASES_ROOT,
} from "./lib/deploy-contract.mjs";
import { runSmokeCheck } from "./run-smoke-check.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");
const simRoot = path.join(repoRoot, ".manu-runtime", "hosted-sandbox", "deploy-sim");
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

function readCurrentReleasePointer(rootDir) {
  const pointer = currentPointerPath(rootDir);
  if (!existsSync(pointer)) {
    return "";
  }
  if (useTextPointer) {
    return readFileSync(pointer, "utf8").trim();
  }
  const stat = lstatSync(pointer);
  if (!stat.isSymbolicLink()) {
    return "";
  }
  return path.basename(readlinkSync(pointer));
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, ...options });
  if (result.status !== 0) {
    throw new Error(command + " failed: " + (result.stderr || result.stdout || "unknown error").trim());
  }
  return result;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function artifactBasename(filePath) {
  return String(filePath).split(/[\\/]/).pop();
}

function verifyExtractedPackage(appDir, identity) {
  const manifestPath = path.join(appDir, "release-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("extracted release manifest missing");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.releaseId !== identity.releaseId || manifest.commitSha !== identity.commitSha) {
    throw new Error("extracted release manifest identity mismatch");
  }
  if (manifest.migrationFingerprint !== identity.migrationFingerprint) {
    throw new Error("extracted release manifest migration fingerprint mismatch");
  }
  if (!existsSync(path.join(appDir, "server.js"))) {
    throw new Error("extracted standalone server.js missing");
  }
  for (const file of manifest.files ?? []) {
    const relativePath = String(file.path ?? "");
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      throw new Error("extracted release manifest path invalid");
    }
    const absolute = path.join(appDir, ...relativePath.split("/"));
    if (!existsSync(absolute) || sha256File(absolute) !== file.sha256) {
      throw new Error("extracted release file hash mismatch: " + relativePath);
    }
  }
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function ensureLinuxSharpRuntime(appDir) {
  if (process.env.MANU_DEPLOY_SKIP_LINUX_OPTIONAL_DEPS === "true" || process.platform !== "linux") {
    return { checked: false, installed: false, reason: "not-linux-or-disabled" };
  }
  const sharpPackagePath = path.join(appDir, "node_modules", "sharp", "package.json");
  const sharpPackage = readJsonIfPresent(sharpPackagePath);
  if (!sharpPackage) {
    return { checked: true, installed: false, reason: "sharp-not-present" };
  }
  const optionalDependencies = sharpPackage.optionalDependencies ?? {};
  const requiredPackages = [
    "@img/sharp-linux-x64",
    "@img/sharp-libvips-linux-x64",
  ].filter((packageName) => optionalDependencies[packageName]);
  const missing = requiredPackages.filter((packageName) => !existsSync(path.join(appDir, "node_modules", ...packageName.split("/"), "package.json")));
  if (missing.length === 0) {
    return { checked: true, installed: false, reason: "already-present" };
  }
  const specs = missing.map((packageName) => packageName + "@" + optionalDependencies[packageName]);
  runChecked("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", ...specs], { cwd: appDir });
  runChecked(process.execPath, ["-e", "require('sharp')"], { cwd: appDir });
  return { checked: true, installed: true, reason: "installed", packages: missing };
}

function extractReleaseArchive(rootDir, commitSha, manifest, identity) {
  const releaseDir = path.join(rootDir, "releases", commitSha);
  const tempReleaseDir = path.join(rootDir, "releases", "." + commitSha + ".tmp-" + process.pid);
  rmSync(tempReleaseDir, { recursive: true, force: true });
  mkdirSync(path.join(tempReleaseDir, "app"), { recursive: true });
  runChecked("tar", ["-xzf", manifest.releaseArtifact.archivePath, "-C", path.join(tempReleaseDir, "app")]);
  verifyExtractedPackage(path.join(tempReleaseDir, "app"), identity);
  writeFileSync(path.join(tempReleaseDir, "RELEASE_ID.txt"), identity.releaseId + "\n", "utf8");
  writeFileSync(path.join(tempReleaseDir, "RELEASE_MANIFEST.txt"), manifest.releaseArtifact.manifestPath + "\n", "utf8");
  writeFileSync(
    path.join(tempReleaseDir, "RELEASE_ARTIFACT_SHA256.txt"),
    manifest.releaseArtifact.archiveSha256 + "\n",
    "utf8",
  );
  rmSync(releaseDir, { recursive: true, force: true });
  renameSync(tempReleaseDir, releaseDir);
  return releaseDir;
}

function restartPm2(rootDir) {
  if (process.env.MANU_DEPLOY_SKIP_PM2 === "true") {
    return;
  }
  spawnSync("pm2", ["delete", "manu-ai-hosted-sandbox"], { encoding: "utf8", shell: false });
  spawnSync("pm2", ["delete", "manu-ai"], { encoding: "utf8", shell: false });
  runChecked("pm2", ["start", path.join(repoRoot, "tools", "hosted-sandbox", "deploy", "pm2.ecosystem.config.cjs"), "--update-env"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
      PORT: process.env.PORT || "3001",
      MANU_CI_NO_PRODUCTION_EFFECTS: "true",
      MANU_DEPLOY_ROOT: rootDir,
    },
  });
}

function defaultManifestPath(commitSha) {
  return path.join(
    repoRoot,
    ".manu-runtime",
    "hosted-sandbox",
    "artifacts",
    commitSha,
    "release-manifest.json",
  );
}

function readReleaseManifest(identity) {
  const configured = String(process.env.MANU_RELEASE_ARTIFACT_MANIFEST ?? "").trim();
  const manifestPath = configured ? path.resolve(configured) : defaultManifestPath(identity.commitSha);
  if (!existsSync(manifestPath)) {
    if (!dryRun || process.env.MANU_RELEASE_ARTIFACT_REQUIRED === "true") {
      throw new Error("release artifact manifest missing: " + manifestPath);
    }
    return { manifestPath, manifest: null };
  }
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  const artifactDir = String(process.env.MANU_RELEASE_ARTIFACT_DIR ?? "").trim();
  if (artifactDir && parsed.releaseArtifact) {
    parsed.releaseArtifact = {
      ...parsed.releaseArtifact,
      archivePath: path.join(artifactDir, artifactBasename(parsed.releaseArtifact.archivePath)),
      archiveSha256Path: path.join(artifactDir, artifactBasename(parsed.releaseArtifact.archiveSha256Path)),
    };
  }
  const manifest = assertReleaseArtifactManifest(parsed, {
    requireArchive: !dryRun || process.env.MANU_RELEASE_ARTIFACT_REQUIRED === "true",
  });
  if (manifest.commitSha !== identity.commitSha) {
    throw new Error("release artifact manifest commit mismatch");
  }
  assertMigrationFingerprintMatch(identity.migrationFingerprint, manifest.migrationFingerprint);
  if (manifest.releaseId !== identity.releaseId) {
    throw new Error("release artifact manifest release id mismatch");
  }
  return { manifestPath, manifest };
}

assertDeployEnvironmentSafe(process.env);

const identity = buildReleaseIdentity({ repoRoot, env: process.env });
const expectedFingerprint = String(process.env.MANU_EXPECTED_MIGRATION_FINGERPRINT ?? identity.migrationFingerprint);
assertMigrationFingerprintMatch(expectedFingerprint, identity.migrationFingerprint);
const artifactManifest = readReleaseManifest(identity);

if (!dryRun) {
  assertSshHostKeyPin(process.env.MANU_SSH_HOST_KEY_PIN);
  if (process.env.MANU_HOSTED_DEPLOY_APPROVED !== "true") {
    throw new Error("MANU_HOSTED_DEPLOY_APPROVED=true is required for apply");
  }
}

const releaseDir = path.join(workRoot, "releases", identity.commitSha);
const previousPointer = path.join(workRoot, "previous-release.txt");

mkdirSync(path.join(workRoot, "releases"), { recursive: true });
if (artifactManifest.manifest?.releaseArtifact) {
  extractReleaseArchive(workRoot, identity.commitSha, artifactManifest.manifest, identity);
} else {
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(path.join(releaseDir, "RELEASE_ID.txt"), identity.releaseId + "\n", "utf8");
  writeFileSync(path.join(releaseDir, "RELEASE_MANIFEST.txt"), artifactManifest.manifestPath + "\n", "utf8");
}

const linuxRuntime = ensureLinuxSharpRuntime(path.join(releaseDir, "app"));

let previous = "";
previous = readCurrentReleasePointer(workRoot);

activateRelease(workRoot, identity.commitSha);

let smokeOk = true;
let smokeError = "";
try {
  if (dryRun) {
    smokeOk = true;
  } else {
    restartPm2(workRoot);
    await runSmokeCheck(process.env.MANU_SMOKE_BASE_URL, { expectedIdentity: identity });
  }
} catch (error) {
  smokeOk = false;
  smokeError = error instanceof Error ? error.message : String(error);
}

if (!smokeOk && previous) {
  const rollbackDir = path.join(workRoot, "releases", previous);
  if (existsSync(rollbackDir)) {
    activateRelease(workRoot, previous);
    restartPm2(workRoot);
    throw new Error("deploy smoke failed" + (smokeError ? ": " + smokeError : "") + "; rolled back to " + previous);
  }
  throw new Error("deploy smoke failed" + (smokeError ? ": " + smokeError : "") + "; rollback target missing");
}

if (!smokeOk) {
  throw new Error("deploy smoke failed" + (smokeError ? ": " + smokeError : ""));
}

if (previous && previous !== identity.commitSha) {
  writeFileSync(previousPointer, previous + "\n", "utf8");
}
process.stdout.write(JSON.stringify({
  result: "PASS",
  mode: dryRun ? "dry-run" : "apply",
  releaseDir,
  currentLink: currentPointerPath(workRoot),
  releaseId: identity.releaseId,
  commitSha: identity.commitSha,
  artifactManifestPath: artifactManifest.manifestPath,
  artifactMode: artifactManifest.manifest?.mode ?? "not-present",
  artifactSha256: artifactManifest.manifest?.releaseArtifact?.archiveSha256 ?? null,
  linuxRuntime,
}, null, 2) + "\n");
