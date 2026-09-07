import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readBackupManifest, sha256File } from "./lib/backup-manifest.mjs";

export function parseRestoreArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  const manifestPath = argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1];
  return { dryRun, apply, manifestPath };
}

export function validateRestoreEnvironment(env = process.env, manifestPath) {
  if (!manifestPath) {
    throw new Error("backup_manifest_missing");
  }
  const manifest = readBackupManifest(path.resolve(manifestPath), {
    expectedProjectRef: env.MANU_HOSTED_SANDBOX_PROJECT_REF,
  });
  const databaseUrl = env.MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("restore_database_url_missing");
  }
  const ageIdentityFile = env.MANU_HOSTED_SANDBOX_BACKUP_AGE_IDENTITY_FILE;
  if (!ageIdentityFile && env.MANU_HOSTED_SANDBOX_RESTORE_APPROVED !== "true") {
    throw new Error("restore_not_approved");
  }
  const encryptedSha256 = sha256File(manifest.encryptedPath);
  if (encryptedSha256 !== manifest.backupSha256) {
    throw new Error("backup_hash_mismatch");
  }
  return { manifest, databaseUrl, ageIdentityFile };
}

export function runHostedRestore(options = {}) {
  const env = options.env ?? process.env;
  const { dryRun, apply, manifestPath } = parseRestoreArgs(options.argv ?? []);
  const requestId = options.requestId ?? randomUUID();
  const { manifest, databaseUrl, ageIdentityFile } = validateRestoreEnvironment(env, manifestPath);

  if (dryRun && !apply) {
    return {
      mode: "dry-run",
      requestId,
      sourceProjectRef: manifest.sourceProjectRef,
      encryptedPath: manifest.encryptedPath,
      backupSha256: manifest.backupSha256,
      restored: false,
    };
  }

  if (!apply) {
    throw new Error("apply_flag_required");
  }

  const decryptedPath = `${manifest.encryptedPath}.decrypted.dump`;
  const decryptArgs = ageIdentityFile
    ? ["-d", "-i", ageIdentityFile, "-o", decryptedPath, manifest.encryptedPath]
    : ["-d", "-o", decryptedPath, manifest.encryptedPath];
  const decrypt = spawnSync("age", decryptArgs, { encoding: "utf8" });
  if (decrypt.status !== 0) {
    throw new Error(`age_decrypt_failed:${decrypt.stderr || decrypt.stdout || "unknown"}`);
  }

  const restore = spawnSync(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", databaseUrl, decryptedPath],
    { encoding: "utf8" },
  );
  if (restore.status !== 0) {
    throw new Error(`pg_restore_failed:${restore.stderr || restore.stdout || "unknown"}`);
  }

  return {
    mode: "apply",
    requestId,
    sourceProjectRef: manifest.sourceProjectRef,
    encryptedPath: manifest.encryptedPath,
    backupSha256: manifest.backupSha256,
    restored: true,
  };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = runHostedRestore();
    process.stdout.write(
      `${[
        `requestId=${result.requestId}`,
        `mode=${result.mode}`,
        `sourceProjectRef=${result.sourceProjectRef}`,
        `backupSha256=${result.backupSha256}`,
        `restored=${result.restored}`,
      ].join("\n")}\n`,
    );
  } catch (error) {
    process.stderr.write(`FAIL hosted-sandbox restore: ${error.message}\n`);
    process.exit(1);
  }
}
