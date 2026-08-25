export const ACTIVATION_STEPS = [
  "maintenance_on",
  "backup_freshness",
  "release_manifest",
  "migration_fingerprint",
  "demo_cleanup_dry_run",
  "demo_cleanup_apply",
  "deploy_switch",
  "smoke_check",
  "maintenance_off",
];

export const ACTIVATION_APPROVAL_KEYS = {
  activation: "MANU_HOSTED_ACTIVATION_APPROVED",
  backup: "MANU_HOSTED_ACTIVATION_BACKUP_APPROVED",
  migration: "MANU_HOSTED_ACTIVATION_MIGRATION_APPROVED",
  cleanupApply: "MANU_HOSTED_ACTIVATION_CLEANUP_APPLY_APPROVED",
  deploy: "MANU_HOSTED_DEPLOY_APPROVED",
};

export const IOS_PHYSICAL_DEVICE_STATUS = "WAIVED_NOT_EXECUTED";

export function isApprovalEnabled(env, key) {
  return String(env[key] ?? "").trim().toLowerCase() === "true";
}

export function assertActivationApprovals(env, options = {}) {
  if (!options.apply) return;
  for (const key of Object.values(ACTIVATION_APPROVAL_KEYS)) {
    if (!isApprovalEnabled(env, key)) {
      throw new Error(key + "=true is required for apply");
    }
  }
}

export function assertCleanupApplyApproval(env, applyCleanup) {
  if (!applyCleanup) return;
  if (!isApprovalEnabled(env, ACTIVATION_APPROVAL_KEYS.cleanupApply)) {
    throw new Error("MANU_HOSTED_ACTIVATION_CLEANUP_APPLY_APPROVED=true is required for cleanup apply");
  }
}
