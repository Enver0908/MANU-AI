import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const appRoot = join(__dirname, "..", "..");
export const repoRoot = join(appRoot, "..");
export const docsRoot = join(repoRoot, "docs");
export const packageLockPath = join(appRoot, "package-lock.json");

export const STAGE5_EVIDENCE_SCHEMA_VERSION = "stage5-evidence-v2";

export function sha256File(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.code === "ETIMEDOUT",
    error: result.error ? result.error.message : null,
  };
}

export function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function gitCommand() {
  return process.platform === "win32" ? "git.exe" : "git";
}

export function currentSourceRevision() {
  const result = runCapture(gitCommand(), ["rev-parse", "HEAD"], { cwd: repoRoot, timeoutMs: 30_000 });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

export function isSourceTreeClean() {
  const result = runCapture(gitCommand(), ["status", "--short"], { cwd: repoRoot, timeoutMs: 30_000 });
  return result.status === 0 && result.stdout.trim().length === 0;
}

export function buildStage5EvidenceHeader(evidenceType, command) {
  return {
    schemaVersion: STAGE5_EVIDENCE_SCHEMA_VERSION,
    evidenceType,
    sourceRevision: currentSourceRevision(),
    sourceTreeClean: isSourceTreeClean(),
    packageLockSha256: sha256File(packageLockPath),
    generatedAt: new Date().toISOString(),
    command,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
  };
}
