import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseBackupArgs, validateBackupEnvironment } from "./backup-hosted-supabase.mjs";
import { parseRestoreArgs, validateRestoreEnvironment } from "./restore-hosted-supabase.mjs";
import {
  buildBackupManifest,
  readBackupManifest,
  RESTORE_CONFIRMATION,
  sha256File,
  validateRestoreApproval,
} from "./lib/hosted-sandbox-backup-manifest.mjs";
import {
  buildPostgresChildEnv,
  parsePostgresUrl,
  removeDatabaseUrlEnv,
  sanitizeProcessOutput,
} from "./lib/postgres-env.mjs";

function tempDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function writeManifest(dir, encryptedContent = "encrypted-bytes") {
  const encryptedPath = path.join(dir, "backup.dump.age");
  writeFileSync(encryptedPath, encryptedContent, "utf8");
  const manifest = buildBackupManifest({
    sourceProjectRef: "source-ref",
    encryptedPath,
    backupSha256: sha256File(encryptedPath),
    createdAt: "2026-08-26T00:00:00.000Z",
  });
  const manifestPath = path.join(dir, "backup.dump.age.manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { encryptedPath, manifest, manifestPath };
}

test("backup and restore args fail closed by default", () => {
  assert.deepEqual(parseBackupArgs([]).dryRun, true);
  assert.deepEqual(parseBackupArgs(["--apply"]).apply, true);
  assert.equal(parseRestoreArgs(["--manifest=backup.json"]).manifestPath, "backup.json");
  assert.equal(parseRestoreArgs(["--approval=approval.json"]).approvalPath, "approval.json");
});

test("Postgres child env keeps database URL and password out of command arguments", () => {
  const databaseUrl = "postgresql://postgres:test-password@db.source-ref.supabase.co:5432/postgres";
  const parsed = parsePostgresUrl(databaseUrl);
  assert.equal(parsed.host, "db.source-ref.supabase.co");
  assert.equal(parsed.password, "test-password");

  const { childEnv, database } = buildPostgresChildEnv(databaseUrl, {
    DATABASE_URL: databaseUrl,
    SUPABASE_DB_URL: databaseUrl,
    MANU_HOSTED_SANDBOX_DATABASE_URL: databaseUrl,
  });
  assert.equal(database, "postgres");
  assert.equal(childEnv.PGHOST, "db.source-ref.supabase.co");
  assert.equal(childEnv.PGPASSWORD, "test-password");
  assert.equal(childEnv.DATABASE_URL, undefined);
  assert.equal(childEnv.SUPABASE_DB_URL, undefined);
  assert.equal(childEnv.MANU_HOSTED_SANDBOX_DATABASE_URL, undefined);

  const pgDumpArgs = ["--format=custom", "--no-owner", "--no-privileges", "--file", "backup.dump", "--dbname", database];
  assert.equal(pgDumpArgs.join(" ").includes("secret-password"), false);
  assert.equal(pgDumpArgs.join(" ").includes(databaseUrl), false);
  const ageEnv = removeDatabaseUrlEnv({ MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL: databaseUrl, PGPASSWORD: "test-password" });
  assert.equal(ageEnv.MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL, undefined);
  assert.equal(ageEnv.PGPASSWORD, undefined);
});

test("remote backup requires explicit approval and age public key", () => {
  assert.throws(
    () =>
      validateBackupEnvironment({
        MANU_HOSTED_SANDBOX_DATABASE_URL: "postgresql://postgres:pw@db.source-ref.supabase.co:5432/postgres",
        MANU_HOSTED_SANDBOX_BACKUP_AGE_PUBLIC_KEY: "age1example",
      }),
    /remote_backup_not_approved/,
  );
  assert.throws(
    () =>
      validateBackupEnvironment({
        MANU_HOSTED_SANDBOX_DATABASE_URL: "postgresql://postgres:pw@db.source-ref.supabase.co:5432/postgres",
        MANU_HOSTED_SANDBOX_BACKUP_APPROVED: "true",
      }),
    /backup_age_public_key_missing/,
  );
});

test("restore apply requires approval JSON and rejects identity-file-only approval", () => {
  const dir = tempDir("hs-restore-approval-");
  const { manifestPath } = writeManifest(dir);
  const env = {
    MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL: "postgresql://postgres:pw@db.target-ref.supabase.co:5432/postgres",
    MANU_HOSTED_SANDBOX_BACKUP_AGE_IDENTITY_FILE: path.join(dir, "identity.txt"),
  };
  assert.throws(
    () => validateRestoreEnvironment(env, { manifestPath, apply: true }),
    /restore_approval_missing/,
  );
});

test("restore approval binds source, target, hash, expiry, and confirmation", () => {
  const dir = tempDir("hs-restore-bound-");
  const { manifest } = writeManifest(dir);
  const approval = {
    schemaVersion: "1.0.0",
    sourceProjectRef: "source-ref",
    targetProjectRef: "target-ref",
    backupSha256: manifest.backupSha256,
    approvedAt: "2026-08-26T00:00:00.000Z",
    expiresAt: "2026-08-27T00:00:00.000Z",
    operatorConfirmation: RESTORE_CONFIRMATION,
  };

  assert.equal(
    validateRestoreApproval(approval, {
      manifest,
      targetProjectRef: "target-ref",
      now: new Date("2026-08-26T12:00:00.000Z"),
    }).targetProjectRef,
    "target-ref",
  );

  assert.throws(
    () =>
      validateRestoreApproval(
        { ...approval, targetProjectRef: "source-ref" },
        { manifest, targetProjectRef: "source-ref", now: new Date("2026-08-26T12:00:00.000Z") },
      ),
    /restore_target_must_be_isolated/,
  );
  assert.throws(
    () =>
      validateRestoreApproval(
        { ...approval, operatorConfirmation: "YES" },
        { manifest, targetProjectRef: "target-ref", now: new Date("2026-08-26T12:00:00.000Z") },
      ),
    /restore_approval_confirmation_mismatch/,
  );
  assert.throws(
    () =>
      validateRestoreApproval(
        { ...approval, expiresAt: "2026-08-25T00:00:00.000Z" },
        { manifest, targetProjectRef: "target-ref", now: new Date("2026-08-26T12:00:00.000Z") },
      ),
    /restore_approval_expired/,
  );
});

test("restore validates encrypted backup hash before apply", () => {
  const dir = tempDir("hs-restore-hash-");
  const { encryptedPath, manifestPath } = writeManifest(dir);
  writeFileSync(encryptedPath, "tampered", "utf8");
  assert.throws(
    () =>
      validateRestoreEnvironment(
        {
          MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL: "postgresql://postgres:pw@db.target-ref.supabase.co:5432/postgres",
          MANU_HOSTED_SANDBOX_BACKUP_AGE_IDENTITY_FILE: path.join(dir, "identity.txt"),
        },
        { manifestPath, apply: false },
      ),
    /backup_hash_mismatch/,
  );
});

test("restore apply accepts only a valid approval file", () => {
  const dir = tempDir("hs-restore-apply-");
  const { manifest, manifestPath } = writeManifest(dir);
  const approvalPath = path.join(dir, "approval.json");
  writeFileSync(
    approvalPath,
    `${JSON.stringify({
      schemaVersion: "1.0.0",
      sourceProjectRef: "source-ref",
      targetProjectRef: "target-ref",
      backupSha256: manifest.backupSha256,
      approvedAt: "2026-08-26T00:00:00.000Z",
      expiresAt: "2999-01-01T00:00:00.000Z",
      operatorConfirmation: RESTORE_CONFIRMATION,
    })}\n`,
    "utf8",
  );
  const result = validateRestoreEnvironment(
    {
      MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL: "postgresql://postgres:pw@db.target-ref.supabase.co:5432/postgres",
      MANU_HOSTED_SANDBOX_BACKUP_AGE_IDENTITY_FILE: path.join(dir, "identity.txt"),
    },
    { manifestPath, approvalPath, apply: true },
  );
  assert.equal(result.approval.targetProjectRef, "target-ref");
});

test("manifest and error output are redacted and schema validated", () => {
  const dir = tempDir("hs-manifest-");
  const { manifestPath, manifest } = writeManifest(dir);
  assert.deepEqual(readBackupManifest(manifestPath), manifest);
  assert.equal(
    sanitizeProcessOutput("failed postgresql://postgres:test-password@db.source-ref.supabase.co:5432/postgres"),
    "failed [redacted-postgres-url]",
  );
  assert.equal(readFileSync(manifestPath, "utf8").includes("test-password"), false);
});
