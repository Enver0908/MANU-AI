export const RELEASES_ROOT = "/opt/manu-ai/releases";
export const CURRENT_SYMLINK = "/opt/manu-ai/current";

export const FORBIDDEN_DEPLOY_ENV_KEYS = [
  "MANU_PRODUCTION_PILOT_STARTED",
  "MANU_ENABLE_PROVIDER_EGRESS",
  "MANU_ENABLE_CHANNEL_EGRESS",
  "MANU_ENABLE_LIVE_BILLING",
  "MANU_ENABLE_PRODUCTION_SCHEMA",
];

export const FORBIDDEN_DEPLOY_ENV_VALUES = new Set(["true", "1", "yes", "on"]);

export const FORBIDDEN_WORKFLOW_PATTERNS = [
  /pull_request_target:/,
  /\bcontents:\s*write\b/,
  /\bdeployments:\s*write\b/,
  /\bMANU_PRODUCTION_PILOT_STARTED\b/,
  /\bMANU_ENABLE_PROVIDER_EGRESS\b/,
  /\bMANU_ENABLE_CHANNEL_EGRESS\b/,
  /\bMANU_ENABLE_LIVE_BILLING\b/,
  /\bsupabase\s+db\s+push\b/i,
  /\bvercel\s+deploy\b/i,
];

export function assertDeployEnvironmentSafe(env = process.env) {
  for (const key of FORBIDDEN_DEPLOY_ENV_KEYS) {
    const value = String(env[key] ?? "").trim().toLowerCase();
    if (FORBIDDEN_DEPLOY_ENV_VALUES.has(value)) {
      throw new Error("forbidden deploy flag enabled: " + key + "=" + env[key]);
    }
  }
}

export function assertMigrationFingerprintMatch(expected, actual) {
  const left = String(expected ?? "").trim().toLowerCase();
  const right = String(actual ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    throw new Error("migration fingerprint must be a 64-character hex digest");
  }
  if (left !== right) {
    throw new Error("migration fingerprint mismatch blocks deploy");
  }
}

export function assertSshHostKeyPin(pin) {
  const normalized = String(pin ?? "").trim();
  if (!normalized) {
    throw new Error("SSH host key pin is required for remote deploy");
  }
  if (!/^(SHA256:[A-Za-z0-9+/=]+|[a-f0-9]{64})$/.test(normalized)) {
    throw new Error("SSH host key pin format is invalid");
  }
  return normalized;
}

export function assertReleaseArtifactManifest(manifest, { requireArchive = false } = {}) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("release artifact manifest is required");
  }
  if (!/^[a-f0-9]{40}$/.test(String(manifest.commitSha ?? ""))) {
    throw new Error("release artifact manifest commit SHA is invalid");
  }
  if (!/^[a-f0-9]{64}$/.test(String(manifest.migrationFingerprint ?? ""))) {
    throw new Error("release artifact manifest migration fingerprint is invalid");
  }
  if (!String(manifest.releaseId ?? "").startsWith("hs-")) {
    throw new Error("release artifact manifest release id is invalid");
  }
  const mode = String(manifest.mode ?? "manifest-only");
  if (mode !== "manifest-only" && mode !== "archive") {
    throw new Error("release artifact manifest mode is invalid");
  }
  const artifact = manifest.releaseArtifact ?? null;
  if (requireArchive || mode === "archive") {
    if (!artifact) {
      throw new Error("release artifact metadata is required");
    }
    if (!/^[a-f0-9]{64}$/.test(String(artifact.archiveSha256 ?? ""))) {
      throw new Error("release artifact archive sha256 is invalid");
    }
    if (!String(artifact.archivePath ?? "").endsWith(".tar.gz")) {
      throw new Error("release artifact archive path must end with .tar.gz");
    }
    if (!String(artifact.archiveSha256Path ?? "").endsWith(".tar.gz.sha256")) {
      throw new Error("release artifact sha256 path must end with .tar.gz.sha256");
    }
  }
  return manifest;
}
