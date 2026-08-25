import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const BACKUP_MANIFEST_SCHEMA_VERSION = "1.0.0";

export function sha256File(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("backup_manifest_invalid");
  }
  if (!manifest.projectRef || !manifest.backupSha256 || !manifest.encryptedPath) {
    throw new Error("backup_manifest_incomplete");
  }
  if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new Error("backup_manifest_schema_mismatch");
  }
  return manifest;
}

export function readBackupManifest(path) {
  return validateBackupManifest(JSON.parse(readFileSync(path, "utf8")));
}

export function buildBackupManifest(input) {
  return {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    projectRef: input.projectRef,
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
