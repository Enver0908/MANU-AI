import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildBackupManifest, sha256File } from "./lib/backup-manifest.mjs";

export function extractProjectRef(databaseUrl) {
  const match = String(databaseUrl).match(/postgres(?:ql)?:\/\/[^@]+@db\.([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function isLocalDatabaseUrl(databaseUrl) {
  const normalized = String(databaseUrl).toLowerCase();
  return normalized.includes("localhost") || normalized.includes("127.0.0.1");
}

export function parseBackupArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  const outputDir = argv.find((arg) => arg.startsWith("--output-dir="))?.split("=")[1] ?? ".execution-governance/runtime/hosted-sandbox/backups";
  return { dryRun, apply, outputDir };
}

export function validateBackupEnvironment(env = process.env) {
  const databaseUrl = env.MANU_HOSTED_SANDBOX_DATABASE_URL || env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("database_url_missing");
  }
  const projectRef = extractProjectRef(databaseUrl);
  if (!projectRef) {
    throw new Error("project_ref_unresolved");
  }
  const expectedProjectRef = env.MANU_HOSTED_SANDBOX_PROJECT_REF;
  if (expectedProjectRef && expectedProjectRef !== projectRef) {
    throw new Error("project_ref_mismatch");
  }
  if (!isLocalDatabaseUrl(databaseUrl) && env.MANU_HOSTED_SANDBOX_BACKUP_APPROVED !== "true") {
    throw new Error("remote_backup_not_approved");
  }
  const agePublicKey = env.MANU_HOSTED_SANDBOX_BACKUP_AGE_PUBLIC_KEY;
  if (!agePublicKey) {
    throw new Error("backup_age_public_key_missing");
  }
  return { databaseUrl, projectRef, agePublicKey };
}

export function runHostedBackup(options = {}) {
  const env = options.env ?? process.env;
  const { dryRun, apply, outputDir } = parseBackupArgs(options.argv ?? []);
  const requestId = options.requestId ?? randomUUID();
  const { databaseUrl, projectRef, agePublicKey } = validateBackupEnvironment(env);

  const resolvedOutputDir = path.resolve(outputDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(resolvedOutputDir, `${projectRef}-${stamp}.dump`);
  const encryptedPath = `${dumpPath}.age`;
  const manifestPath = `${encryptedPath}.manifest.json`;

  if (dryRun && !apply) {
    return {
      mode: "dry-run",
      requestId,
      projectRef,
      dumpPath,
      encryptedPath,
      manifestPath,
      created: false,
    };
  }

  if (!apply) {
    throw new Error("apply_flag_required");
  }

  mkdirSync(resolvedOutputDir, { recursive: true });

  const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath, databaseUrl], {
    encoding: "utf8",
  });
  if (dump.status !== 0) {
    throw new Error(`pg_dump_failed:${dump.stderr || dump.stdout || "unknown"}`);
  }

  const encrypt = spawnSync("age", ["-r", agePublicKey, "-o", encryptedPath, dumpPath], {
    encoding: "utf8",
  });
  if (encrypt.status !== 0) {
    throw new Error(`age_encrypt_failed:${encrypt.stderr || encrypt.stdout || "unknown"}`);
  }

  const backupSha256 = sha256File(encryptedPath);
  const manifest = buildBackupManifest({
    projectRef,
    encryptedPath,
    backupSha256,
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    mode: "apply",
    requestId,
    projectRef,
    dumpPath,
    encryptedPath,
    manifestPath,
    backupSha256,
    created: true,
  };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = runHostedBackup();
    process.stdout.write(
      `${[
        `requestId=${result.requestId}`,
        `mode=${result.mode}`,
        `projectRef=${result.projectRef}`,
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
