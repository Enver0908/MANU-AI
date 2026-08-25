import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const FORBIDDEN_HOSTED_FALLBACK_VERSION = "0.0.0-stage5";

function readHeadSha(repoRoot: string): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", shell: false });
  if (result.status !== 0) {
    throw new Error("git rev-parse HEAD failed");
  }
  const sha = String(result.stdout || "").trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("invalid HEAD SHA");
  }
  return sha;
}

function fingerprintMigrations(repoRoot: string): string {
  const migrationsDir = join(repoRoot, "app", "supabase", "migrations");
  if (!existsSync(migrationsDir) || !statSync(migrationsDir).isDirectory()) {
    throw new Error("migration directory missing");
  }
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  if (files.length === 0) {
    throw new Error("migration set is empty");
  }
  const hash = createHash("sha256");
  for (const name of files) {
    const relative = `app/supabase/migrations/${name}`;
    hash.update(relative);
    hash.update("\0");
    hash.update(readFileSync(join(migrationsDir, name)));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function sanitizeReleaseIdForCache(releaseId: string): string {
  return releaseId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

function syncServiceWorkerCacheVersion(repoRoot: string, releaseId: string, write = false): string {
  const cacheVersion = sanitizeReleaseIdForCache(releaseId);
  const swPath = join(repoRoot, "app", "public", "sw.js");
  const content = readFileSync(swPath, "utf8");
  const current = content.match(/const SW_CACHE_VERSION = "([^"]+)"/)?.[1] ?? "";
  if (current !== cacheVersion && write) {
    const updated = content.replace(
      /const SW_CACHE_VERSION = "[^"]+";/,
      `const SW_CACHE_VERSION = "${cacheVersion}";`,
    );
    writeFileSync(swPath, updated, "utf8");
  }
  return cacheVersion;
}

function buildReleaseIdentity(repoRoot: string) {
  const commitSha = readHeadSha(repoRoot);
  const migrationFingerprint = fingerprintMigrations(repoRoot);
  const releaseId = `hs-${commitSha.slice(0, 12)}-${migrationFingerprint.slice(0, 12)}`;
  const compatibilityVersion = `0.0.0+${commitSha.slice(0, 7)}`;
  if (compatibilityVersion === FORBIDDEN_HOSTED_FALLBACK_VERSION) {
    throw new Error("forbidden hosted fallback version");
  }
  return {
    releaseId,
    commitSha,
    builtAt: new Date().toISOString(),
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    migrationFingerprint,
    compatibilityVersion,
  };
}

const repoRoot = join(process.cwd(), "..");
const identity = buildReleaseIdentity(repoRoot);
if (process.env.NODE_ENV === "production") {
  if (!/^[a-f0-9]{40}$/.test(identity.commitSha)) throw new Error("production build requires commit SHA");
  if (!/^[a-f0-9]{64}$/.test(identity.migrationFingerprint)) throw new Error("production build requires migration fingerprint");
}
const shouldSyncSw = process.env.NODE_ENV === "production" || process.argv.some((arg) => arg.includes("build"));
const swCacheVersion = syncServiceWorkerCacheVersion(repoRoot, identity.releaseId, shouldSyncSw);

const nextConfig: NextConfig = {
  transpilePackages: ["dietitian-ai-assistant-architecture"],
  experimental: {
    externalDir: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.production.json",
  },
  env: {
    MANU_RELEASE_ID: identity.releaseId,
    MANU_RELEASE_COMMIT_SHA: identity.commitSha,
    MANU_RELEASE_BUILT_AT: identity.builtAt,
    MANU_RELEASE_ENVIRONMENT: identity.environment,
    MANU_RELEASE_MIGRATION_FINGERPRINT: identity.migrationFingerprint,
    MANU_RELEASE_COMPATIBILITY_VERSION: identity.compatibilityVersion,
    MANU_SW_CACHE_VERSION: swCacheVersion,
    NEXT_PUBLIC_SIRIUSAI_APP_VERSION: identity.compatibilityVersion,
    SIRIUSAI_APP_DEPLOYMENT_VERSION: identity.compatibilityVersion,
    SIRIUSAI_SHELL_MIN_CLIENT_VERSION: identity.compatibilityVersion,
  },
};

export default nextConfig;
