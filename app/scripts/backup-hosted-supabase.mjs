import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildBackupManifest, sha256File } from "./lib/hosted-sandbox-backup-manifest.mjs";
import {
  buildPostgresChildEnv,
  isLocalDatabaseUrl,
  removeDatabaseUrlEnv,
  resolveProjectRef,
  sanitizeProcessOutput,
} from "./lib/postgres-env.mjs";

export function parseBackupArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  const outputDir = argv.find((arg) => arg.startsWith("--output-dir="))?.split("=")[1] ?? ".manu-runtime/hosted-sandbox/backups";
  return { dryRun, apply, outputDir };
}

export function validateBackupEnvironment(env = process.env) {
  const databaseUrl = env.MANU_HOSTED_SANDBOX_DATABASE_URL || env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("database_url_missing");
  }
  const sourceProjectRef = resolveProjectRef(databaseUrl, env);
  const expectedProjectRef = env.MANU_HOSTED_SANDBOX_PROJECT_REF;
  if (expectedProjectRef && expectedProjectRef !== sourceProjectRef) {
    throw new Error("project_ref_mismatch");
  }
  if (!isLocalDatabaseUrl(databaseUrl) && env.MANU_HOSTED_SANDBOX_BACKUP_APPROVED !== "true") {
    throw new Error("remote_backup_not_approved");
  }
  const agePublicKey = env.MANU_HOSTED_SANDBOX_BACKUP_AGE_PUBLIC_KEY;
  if (!agePublicKey) {
    throw new Error("backup_age_public_key_missing");
  }
  return { databaseUrl, sourceProjectRef, agePublicKey };
}

function runChecked(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command}_failed:${sanitizeProcessOutput(result.stderr || result.stdout || "unknown")}`);
  }
  return result;
}

export function runHostedBackup(options = {}) {
  const env = options.env ?? process.env;
  const { dryRun, apply, outputDir } = parseBackupArgs(options.argv ?? []);
  const requestId = options.requestId ?? randomUUID();
  const { databaseUrl, sourceProjectRef, agePublicKey } = validateBackupEnvironment(env);
  const resolvedOutputDir = path.resolve(outputDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(resolvedOutputDir, `${sourceProjectRef}-${stamp}.dump`);
  const encryptedPath = `${dumpPath}.age`;
  const manifestPath = `${encryptedPath}.manifest.json`;

  if (dryRun && !apply) {
    return { mode: "dry-run", requestId, sourceProjectRef, encryptedPath, manifestPath, created: false };
  }
  if (!apply) {
    throw new Error("apply_flag_required");
  }

  mkdirSync(resolvedOutputDir, { recursive: true });
  const { childEnv, database } = buildPostgresChildEnv(databaseUrl, env);

  try {
    runChecked("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath, "--dbname", database], {
      env: childEnv,
    });
    runChecked("age", ["-r", agePublicKey, "-o", encryptedPath, dumpPath], { env: removeDatabaseUrlEnv(env) });
    const backupSha256 = sha256File(encryptedPath);
    const manifest = buildBackupManifest({ sourceProjectRef, encryptedPath, backupSha256 });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { mode: "apply", requestId, sourceProjectRef, encryptedPath, manifestPath, backupSha256, created: true };
  } finally {
    rmSync(dumpPath, { force: true });
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = runHostedBackup();
    process.stdout.write(
      `${[
        `requestId=${result.requestId}`,
        `mode=${result.mode}`,
        `sourceProjectRef=${result.sourceProjectRef}`,
        `encryptedPath=${result.encryptedPath}`,
        result.backupSha256 ? `backupSha256=${result.backupSha256}` : null,
        `created=${result.created}`,
      ]
        .filter(Boolean)
        .join("\n")}\n`,
    );
  } catch (error) {
    process.stderr.write(`FAIL hosted-sandbox backup: ${error.message}\n`);
    process.exit(1);
  }
}
