import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  readBackupManifest,
  readRestoreApproval,
  sha256File,
} from "./lib/hosted-sandbox-backup-manifest.mjs";
import {
  buildPostgresChildEnv,
  removeDatabaseUrlEnv,
  resolveProjectRef,
  sanitizeProcessOutput,
} from "./lib/postgres-env.mjs";

export function parseRestoreArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  const manifestPath = argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1];
  const approvalPath = argv.find((arg) => arg.startsWith("--approval="))?.split("=")[1];
  return { dryRun, apply, manifestPath, approvalPath };
}

export function validateRestoreEnvironment(env = process.env, { manifestPath, approvalPath, apply = false } = {}) {
  if (!manifestPath) {
    throw new Error("backup_manifest_missing");
  }
  const manifest = readBackupManifest(path.resolve(manifestPath));
  const databaseUrl = env.MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("restore_database_url_missing");
  }
  const targetProjectRef = resolveProjectRef(databaseUrl, env);
  const ageIdentityFile = env.MANU_HOSTED_SANDBOX_BACKUP_AGE_IDENTITY_FILE;
  if (!ageIdentityFile) {
    throw new Error("restore_age_identity_missing");
  }
  const encryptedSha256 = sha256File(manifest.encryptedPath);
  if (encryptedSha256 !== manifest.backupSha256) {
    throw new Error("backup_hash_mismatch");
  }

  let approval = null;
  if (apply) {
    const resolvedApprovalPath = approvalPath || env.MANU_HOSTED_SANDBOX_RESTORE_APPROVAL;
    if (!resolvedApprovalPath) {
      throw new Error("restore_approval_missing");
    }
    approval = readRestoreApproval(path.resolve(resolvedApprovalPath), { manifest, targetProjectRef });
  }
  return { manifest, databaseUrl, targetProjectRef, ageIdentityFile, approval };
}

function runChecked(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command}_failed:${sanitizeProcessOutput(result.stderr || result.stdout || "unknown")}`);
  }
  return result;
}

export function runHostedRestore(options = {}) {
  const env = options.env ?? process.env;
  const { dryRun, apply, manifestPath, approvalPath } = parseRestoreArgs(options.argv ?? []);
  const requestId = options.requestId ?? randomUUID();
  const { manifest, databaseUrl, targetProjectRef, ageIdentityFile } = validateRestoreEnvironment(env, {
    manifestPath,
    approvalPath,
    apply,
  });

  if (dryRun && !apply) {
    return {
      mode: "dry-run",
      requestId,
      sourceProjectRef: manifest.sourceProjectRef,
      targetProjectRef,
      encryptedPath: manifest.encryptedPath,
      backupSha256: manifest.backupSha256,
      restored: false,
    };
  }
  if (!apply) {
    throw new Error("apply_flag_required");
  }

  const decryptedPath = `${manifest.encryptedPath}.decrypted.dump`;
  const { childEnv, database } = buildPostgresChildEnv(databaseUrl, env);

  try {
    runChecked("age", ["-d", "-i", ageIdentityFile, "-o", decryptedPath, manifest.encryptedPath], {
      env: removeDatabaseUrlEnv(env),
    });
    runChecked("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", database, decryptedPath], {
      env: childEnv,
    });
    return {
      mode: "apply",
      requestId,
      sourceProjectRef: manifest.sourceProjectRef,
      targetProjectRef,
      encryptedPath: manifest.encryptedPath,
      backupSha256: manifest.backupSha256,
      restored: true,
    };
  } finally {
    rmSync(decryptedPath, { force: true });
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = runHostedRestore();
    process.stdout.write(
      `${[
        `requestId=${result.requestId}`,
        `mode=${result.mode}`,
        `sourceProjectRef=${result.sourceProjectRef}`,
        `targetProjectRef=${result.targetProjectRef}`,
        `backupSha256=${result.backupSha256}`,
        `restored=${result.restored}`,
      ].join("\n")}\n`,
    );
  } catch (error) {
    process.stderr.write(`FAIL hosted-sandbox restore: ${error.message}\n`);
    process.exit(1);
  }
}
