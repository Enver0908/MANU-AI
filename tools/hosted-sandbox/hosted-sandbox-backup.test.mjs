import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBackupManifest,
  readBackupManifest,
  sha256File,
  validateBackupManifest,
} from "./lib/backup-manifest.mjs";
import { parseBackupArgs, validateBackupEnvironment } from "./backup-hosted-supabase.mjs";
import { parseRestoreArgs, validateRestoreEnvironment } from "./restore-hosted-supabase.mjs";

test("backup manifest validates schema and hashes", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hs-backup-"));
  const encryptedPath = path.join(dir, "backup.age");
  writeFileSync(encryptedPath, "encrypted-bytes");
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = buildBackupManifest({
    projectRef: "local-dev",
    encryptedPath,
    backupSha256: sha256File(encryptedPath),
  });
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const loaded = readBackupManifest(manifestPath);
  assert.equal(loaded.projectRef, "local-dev");
  assert.equal(loaded.backupSha256, sha256File(encryptedPath));
});

test("backup dry-run requires approval and age key for remote targets", () => {
  assert.throws(
    () =>
      validateBackupEnvironment({
        MANU_HOSTED_SANDBOX_DATABASE_URL: "postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres",
      }),
    /remote_backup_not_approved|backup_age_public_key_missing/,
  );
  assert.equal(parseBackupArgs([]).dryRun, true);
  assert.equal(parseBackupArgs(["--apply"]).apply, true);
});

test("restore dry-run validates manifest hash before apply", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hs-restore-"));
  const encryptedPath = path.join(dir, "backup.age");
  writeFileSync(encryptedPath, "restore-me");
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = buildBackupManifest({
    projectRef: "local-dev",
    encryptedPath,
    backupSha256: sha256File(encryptedPath),
  });
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(
    () => validateRestoreEnvironment({}, manifestPath),
    /restore_database_url_missing/,
  );
  assert.equal(parseRestoreArgs(["--manifest=" + manifestPath]).manifestPath, manifestPath);
});

test("rejects incomplete backup manifest payloads", () => {
  assert.throws(() => validateBackupManifest({ projectRef: "x" }), /backup_manifest_incomplete/);
});
