import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const BACKUP_MANIFEST_SCHEMA_VERSION = "2.0.0";
export const RESTORE_APPROVAL_SCHEMA_VERSION = "1.0.0";
export const RESTORE_CONFIRMATION = "RESTORE_TO_ISOLATED_TARGET";
export const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

export function sha256File(filePath) {
  const bytes = readFileSync(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateBackupManifest(manifest, { now = new Date(), expectedProjectRef } = {}) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("backup_manifest_invalid");
  }
  if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new Error("backup_manifest_schema_mismatch");
  }
  if (!manifest.sourceProjectRef || !manifest.backupSha256 || !manifest.encryptedPath) {
    throw new Error("backup_manifest_incomplete");
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.backupSha256)) {
    throw new Error("backup_manifest_hash_invalid");
  }
  const createdAt = Date.parse(manifest.createdAt ?? "");
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

export function readBackupManifest(filePath, options) {
  return validateBackupManifest(JSON.parse(readFileSync(filePath, "utf8")), options);
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

export function validateRestoreApproval(approval, { manifest, targetProjectRef, now = new Date() }) {
  if (!approval || typeof approval !== "object") {
    throw new Error("restore_approval_invalid");
  }
  if (approval.schemaVersion !== RESTORE_APPROVAL_SCHEMA_VERSION) {
    throw new Error("restore_approval_schema_mismatch");
  }
  if (approval.operatorConfirmation !== RESTORE_CONFIRMATION) {
    throw new Error("restore_approval_confirmation_mismatch");
  }
  if (approval.sourceProjectRef !== manifest.sourceProjectRef) {
    throw new Error("restore_approval_source_ref_mismatch");
  }
  if (approval.targetProjectRef !== targetProjectRef) {
    throw new Error("restore_approval_target_ref_mismatch");
  }
  if (approval.backupSha256 !== manifest.backupSha256) {
    throw new Error("restore_approval_backup_hash_mismatch");
  }
  if (approval.sourceProjectRef === approval.targetProjectRef) {
    throw new Error("restore_target_must_be_isolated");
  }

  const approvedAt = Date.parse(approval.approvedAt ?? "");
  const expiresAt = Date.parse(approval.expiresAt ?? "");
  if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt)) {
    throw new Error("restore_approval_time_invalid");
  }
  const nowMs = now.getTime();
  if (approvedAt > nowMs) {
    throw new Error("restore_approval_from_future");
  }
  if (expiresAt <= nowMs) {
    throw new Error("restore_approval_expired");
  }
  return approval;
}

export function readRestoreApproval(filePath, input) {
  return validateRestoreApproval(JSON.parse(readFileSync(filePath, "utf8")), input);
}
