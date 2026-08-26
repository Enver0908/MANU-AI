import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const FORBIDDEN_HOSTED_FALLBACK_VERSION = "0.0.0-stage5";
export const DEV_LOCAL_COMPATIBILITY_VERSION = "0.0.0-dev-local";
export const DEV_LOCAL_RELEASE_ID = "dev-local";
export const SW_CACHE_VERSION_PLACEHOLDER = "__MANU_RELEASE_CACHE_VERSION__";

const ZERO_SHA = "0000000000000000000000000000000000000000";
const ZERO_FINGERPRINT = "0000000000000000000000000000000000000000000000000000000000000000";

export function isHostedSupabaseConfigured(env = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "").trim();
  return url.length > 0;
}

export function assertHostedFallbackForbidden(env, version) {
  if (version === FORBIDDEN_HOSTED_FALLBACK_VERSION && isHostedSupabaseConfigured(env)) {
    throw new Error(`${FORBIDDEN_HOSTED_FALLBACK_VERSION} is forbidden when hosted Supabase is configured`);
  }
}

export function readHeadSha(repoRoot, env = process.env) {
  const fromEnv = String(env.MANU_RELEASE_COMMIT_SHA ?? "").trim();
  if (/^[a-f0-9]{40}$/.test(fromEnv)) {
    return fromEnv;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${result.stderr || result.stdout}`);
  }
  const sha = String(result.stdout || "").trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(`HEAD SHA is not a 40-character hex digest: ${sha}`);
  }
  return sha;
}

export function readHeadBuiltAt(repoRoot) {
  const result = spawnSync("git", ["show", "-s", "--format=%cI", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git show HEAD commit time failed: ${result.stderr || result.stdout}`);
  }
  const builtAt = String(result.stdout || "").trim();
  return normalizeIsoDateTime(builtAt, "HEAD commit time");
}

export function fingerprintMigrations(repoRoot, migrationsDir = "app/supabase/migrations") {
  const absolute = path.join(repoRoot, ...migrationsDir.split("/"));
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new Error(`migration directory missing: ${migrationsDir}`);
  }
  const files = readdirSync(absolute)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error("migration set is empty");
  }
  const hash = createHash("sha256");
  for (const name of files) {
    const relative = `${migrationsDir}/${name}`;
    hash.update(relative);
    hash.update("\0");
    hash.update(readFileSync(path.join(absolute, name)));
    hash.update("\n");
  }
  return {
    directory: migrationsDir,
    count: files.length,
    fingerprint: hash.digest("hex"),
    files,
  };
}

export function deriveReleaseId(commitSha, fingerprint) {
  return `hs-${commitSha.slice(0, 12)}-${fingerprint.slice(0, 12)}`;
}

export function deriveCompatibilityVersion(env, commitSha) {
  const explicit =
    String(env.MANU_RELEASE_COMPATIBILITY_VERSION ?? "").trim() ||
    String(env.SIRIUSAI_APP_DEPLOYMENT_VERSION ?? "").trim() ||
    String(env.NEXT_PUBLIC_SIRIUSAI_APP_VERSION ?? "").trim();
  if (explicit) {
    assertHostedFallbackForbidden(env, explicit);
    return explicit;
  }
  return `0.0.0+${commitSha.slice(0, 7)}`;
}

export function sanitizeReleaseIdForCache(releaseId) {
  return String(releaseId).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

export function assertIsoDateTime(value, label = "builtAt") {
  normalizeIsoDateTime(value, label);
}

export function normalizeIsoDateTime(value, label = "builtAt") {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO-8601 timestamp`);
  }
  return new Date(timestamp).toISOString();
}

export function buildReleaseIdentity({ repoRoot, env = process.env } = {}) {
  if (!repoRoot) {
    throw new Error("repoRoot is required to build release identity");
  }

  const isProduction = String(env.NODE_ENV ?? "").trim() === "production";
  let commitSha;
  let migrationFingerprint;

  try {
    commitSha = readHeadSha(repoRoot, env);
  } catch (error) {
    if (isProduction || isHostedSupabaseConfigured(env)) {
      throw error;
    }
    commitSha = ZERO_SHA;
  }

  try {
    migrationFingerprint = fingerprintMigrations(repoRoot).fingerprint;
  } catch (error) {
    if (isProduction || isHostedSupabaseConfigured(env)) {
      throw error;
    }
    migrationFingerprint = ZERO_FINGERPRINT;
  }

  const explicitBuiltAt = String(env.MANU_RELEASE_BUILT_AT ?? "").trim();
  const builtAt = normalizeIsoDateTime(explicitBuiltAt || readHeadBuiltAt(repoRoot));
  const environment =
    String(env.MANU_RELEASE_ENVIRONMENT ?? "").trim() ||
    (isProduction ? "production" : "development");
  const compatibilityVersion = deriveCompatibilityVersion(env, commitSha);
  const releaseId =
    String(env.MANU_RELEASE_ID ?? "").trim() || deriveReleaseId(commitSha, migrationFingerprint);

  return {
    releaseId,
    commitSha,
    builtAt,
    environment,
    migrationFingerprint,
    compatibilityVersion,
  };
}

export function assertProductionReleaseIdentity(identity, env = process.env) {
  if (String(env.NODE_ENV ?? "").trim() !== "production") {
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(identity.commitSha)) {
    throw new Error("production build requires a 40-character commit SHA");
  }
  if (!/^[a-f0-9]{64}$/.test(identity.migrationFingerprint)) {
    throw new Error("production build requires a 64-character migration fingerprint");
  }
  assertHostedFallbackForbidden(env, identity.compatibilityVersion);
}

export function readServiceWorkerCacheVersion(swPath) {
  const content = readFileSync(swPath, "utf8");
  const match = content.match(/const SW_CACHE_VERSION = "([^"]+)"/);
  return match?.[1] ?? "";
}

export function syncServiceWorkerCacheVersion(repoRoot, releaseId, { write = false } = {}) {
  const cacheVersion = sanitizeReleaseIdForCache(releaseId);
  const swPath = path.join(repoRoot, "app", "public", "sw.js");
  const current = readServiceWorkerCacheVersion(swPath);
  if (write) {
    throw new Error("tracked public/sw.js is immutable; render the release cache version into an artifact copy");
  }
  if (current !== SW_CACHE_VERSION_PLACEHOLDER && current !== cacheVersion) {
    throw new Error(`service worker source has unexpected cache version: ${current || "<missing>"}`);
  }
  return cacheVersion;
}

export function assertServiceWorkerCacheMatchesRelease(repoRoot, releaseId) {
  const swPath = path.join(repoRoot, "app", "public", "sw.js");
  const expected = sanitizeReleaseIdForCache(releaseId);
  const actual = readServiceWorkerCacheVersion(swPath);
  if (actual !== expected) {
    throw new Error(`service worker cache version ${actual} does not match release id ${expected}`);
  }
}

export function assertServiceWorkerSourceUsesPlaceholder(repoRoot) {
  const swPath = path.join(repoRoot, "app", "public", "sw.js");
  const actual = readServiceWorkerCacheVersion(swPath);
  if (actual !== SW_CACHE_VERSION_PLACEHOLDER) {
    throw new Error(
      `tracked public/sw.js must use ${SW_CACHE_VERSION_PLACEHOLDER}; found ${actual || "<missing>"}`,
    );
  }
}

export function renderServiceWorkerForRelease(source, releaseId) {
  const cacheVersion = sanitizeReleaseIdForCache(releaseId);
  if (!source.includes(`"${SW_CACHE_VERSION_PLACEHOLDER}"`)) {
    throw new Error(`service worker source is missing ${SW_CACHE_VERSION_PLACEHOLDER}`);
  }
  const rendered = source.replaceAll(SW_CACHE_VERSION_PLACEHOLDER, cacheVersion);
  if (readServiceWorkerCacheVersionFromSource(rendered) !== cacheVersion) {
    throw new Error("failed to render service worker release cache version");
  }
  return rendered;
}

export function readServiceWorkerCacheVersionFromSource(source) {
  const match = String(source).match(/const SW_CACHE_VERSION = "([^"]+)"/);
  return match?.[1] ?? "";
}
