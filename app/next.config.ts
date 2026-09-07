import type { NextConfig } from "next";
import { join } from "node:path";
import {
  assertProductionReleaseIdentity,
  buildReleaseIdentity,
  sanitizeReleaseIdForCache,
} from "./scripts/lib/release-identity.mjs";

const repoRoot = join(process.cwd(), "..");
type ReleaseIdentity = {
  releaseId: string;
  commitSha: string;
  builtAt: string;
  environment: string;
  migrationFingerprint: string;
  compatibilityVersion: string;
};

const resolveBuildReleaseIdentity = buildReleaseIdentity as (input: {
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
}) => ReleaseIdentity;

const identity = resolveBuildReleaseIdentity({ repoRoot });
assertProductionReleaseIdentity(identity);
const swCacheVersion = sanitizeReleaseIdForCache(identity.releaseId);
const releaseEnv = {
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
};

Object.assign(process.env, releaseEnv);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  generateBuildId: async () => swCacheVersion,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  transpilePackages: ["dietitian-ai-assistant-architecture"],
  experimental: {
    externalDir: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.production.json",
  },
  env: releaseEnv,
};

export default nextConfig;
