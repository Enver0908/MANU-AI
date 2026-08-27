import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const BACKUP_MANIFEST_SCHEMA_VERSION = "2.0.0";
export const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

export function sha256File(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateBackupManifest(manifest, { now = new Date(), expectedProjectRef } = {}) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("backup_manifest_invalid");
  }
  if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new Error("backup_manifest_schema_mismatch");
  }
  if (!manifest.sourceProjectRef || !manifest.backupSha256 || !manifest.encryptedPath || !manifest.createdAt) {
    throw new Error("backup_manifest_incomplete");
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.backupSha256)) {
    throw new Error("backup_manifest_hash_invalid");
  }
  const createdAt = Date.parse(manifest.createdAt);
  if (!Number.isFinite(createdAt)) {
    throw new Error("backup_manifest_created_at_invalid");
  }
  const nowMs = now.getTime();
  if (createdAt > nowMs) {
    throw new Error("backup_manifest_from_future");
  }
  if (nowMs - createdAt > MAX_BACKUP_AGE_MS) {
    throw new Error("backup_manifest_stale");
  }
  if (expectedProjectRef && manifest.sourceProjectRef !== expectedProjectRef) {
    throw new Error("backup_manifest_project_ref_mismatch");
  }
  return manifest;
}

export function readBackupManifest(path, options) {
  return validateBackupManifest(JSON.parse(readFileSync(path, "utf8")), options);
}

export function buildBackupManifest(input) {
  return {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    sourceProjectRef: input.sourceProjectRef,
    createdAt: input.createdAt ?? new Date().toISOString(),
    encryptedPath: input.encryptedPath,
    backupSha256: input.backupSha256,
    dumpFormat: "custom",
    encryption: "age",
    retentionPolicy: "14d_daily+8w_weekly",
    rpoHours: 24,
    rtoHours: 4,
  };
}
