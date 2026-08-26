#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertProductionReleaseIdentity,
  buildReleaseIdentity,
  renderServiceWorkerForRelease,
  sanitizeReleaseIdForCache,
} from "./lib/release-identity.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const repoRoot = join(appRoot, "..");

export function buildReleaseArtifact({
  appRoot: inputAppRoot = appRoot,
  repoRoot: inputRepoRoot = repoRoot,
  env = { ...process.env, NODE_ENV: "production" },
  identity = buildReleaseIdentity({ repoRoot: inputRepoRoot, env }),
  outputRoot = join(inputAppRoot, ".manu-runtime", "release-artifacts"),
} = {}) {
  assertProductionReleaseIdentity(identity, env);

  const cacheVersion = sanitizeReleaseIdForCache(identity.releaseId);
  const standaloneSource = join(inputAppRoot, ".next", "standalone");
  const nextStaticSource = join(inputAppRoot, ".next", "static");
  const publicSource = join(inputAppRoot, "public");

  assertDirectory(standaloneSource, "Next standalone output");
  assertDirectory(nextStaticSource, "Next static output");
  assertDirectory(publicSource, "public assets");

  mkdirSync(outputRoot, { recursive: true });
  const packageRoot = join(outputRoot, cacheVersion);
  rmSync(packageRoot, { force: true, recursive: true, maxRetries: 10, retryDelay: 250 });
  mkdirSync(packageRoot, { recursive: true });

  cpSync(standaloneSource, packageRoot, { recursive: true });
  cpSync(nextStaticSource, join(packageRoot, ".next", "static"), { recursive: true });
  cpSync(publicSource, join(packageRoot, "public"), { recursive: true });

  const stagedSwPath = join(packageRoot, "public", "sw.js");
  writeFileSync(
    stagedSwPath,
    renderServiceWorkerForRelease(readFileSync(stagedSwPath, "utf8"), identity.releaseId),
    "utf8",
  );

  const manifestPath = join(packageRoot, "release-manifest.json");
  const manifest = {
    schemaVersion: 1,
    releaseId: identity.releaseId,
    cacheVersion,
    commitSha: identity.commitSha,
    builtAt: identity.builtAt,
    environment: identity.environment,
    migrationFingerprint: identity.migrationFingerprint,
    compatibilityVersion: identity.compatibilityVersion,
    nextOutput: "standalone",
    serviceWorker: {
      source: "public/sw.js",
      cacheVersion,
      renderedInArtifactOnly: true,
    },
    files: collectFiles(packageRoot, manifestPath),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  manifest.files = collectFiles(packageRoot);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const archivePath = join(outputRoot, `${cacheVersion}.tar.gz`);
  const archiveSha256Path = `${archivePath}.sha256`;
  rmSync(archivePath, { force: true });
  rmSync(archiveSha256Path, { force: true });
  createTarGzArchive({ archivePath, cwd: packageRoot });
  const archiveSha256 = sha256File(archivePath);
  writeFileSync(
    archiveSha256Path,
    `${archiveSha256}  ${relative(outputRoot, archivePath).replace(/\\/g, "/")}\n`,
    "utf8",
  );

  return {
    releaseId: identity.releaseId,
    cacheVersion,
    packageRoot,
    manifestPath,
    archivePath,
    archiveSha256Path,
    archiveSha256,
    fileCount: manifest.files.length,
  };
}

function assertDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`${label} missing: ${path}`);
  }
}

function collectFiles(root, excludedPath = null) {
  const files = [];
  walk(root, (absolute) => {
    if (excludedPath && absolute === excludedPath) return;
    files.push({
      path: relative(root, absolute).replace(/\\/g, "/"),
      bytes: statSync(absolute).size,
      sha256: sha256File(absolute),
    });
  });
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function walk(root, visit) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, visit);
      continue;
    }
    if (entry.isFile()) {
      visit(absolute);
    }
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function createTarGzArchive({ archivePath, cwd }) {
  const tar = spawnSync("tar", ["-czf", archivePath, "-C", cwd, "."], {
    encoding: "utf8",
    shell: false,
  });
  if (tar.status !== 0) {
    throw new Error(`tar archive failed: ${tar.stderr || tar.stdout || "unknown error"}`);
  }
  if (!existsSync(archivePath) || statSync(archivePath).size === 0) {
    throw new Error(`tar archive is missing or empty: ${archivePath}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildReleaseArtifact();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
