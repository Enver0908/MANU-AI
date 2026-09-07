export const FORBIDDEN_HOSTED_FALLBACK_VERSION = "0.0.0-stage5";
export const DEV_LOCAL_COMPATIBILITY_VERSION = "0.0.0-dev-local";
export const DEV_LOCAL_RELEASE_ID = "dev-local";

const ZERO_SHA = "0000000000000000000000000000000000000000";
const ZERO_FINGERPRINT =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type ReleaseIdentity = {
  releaseId: string;
  commitSha: string;
  builtAt: string;
  environment: string;
  migrationFingerprint: string;
  compatibilityVersion: string;
};

export function isHostedSupabaseConfigured(env: NodeJS.ProcessEnv = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "").trim();
  return url.length > 0;
}

export function assertHostedFallbackForbidden(
  env: NodeJS.ProcessEnv,
  version: string,
) {
  if (version === FORBIDDEN_HOSTED_FALLBACK_VERSION && isHostedSupabaseConfigured(env)) {
    throw new Error(
      FORBIDDEN_HOSTED_FALLBACK_VERSION + " is forbidden when hosted Supabase is configured",
    );
  }
}

function readBoundReleaseIdentity(env: NodeJS.ProcessEnv): ReleaseIdentity | null {
  const releaseId = String(env.MANU_RELEASE_ID ?? "").trim();
  const commitSha = String(env.MANU_RELEASE_COMMIT_SHA ?? "").trim();
  const builtAt = String(env.MANU_RELEASE_BUILT_AT ?? "").trim();
  const environment = String(env.MANU_RELEASE_ENVIRONMENT ?? "").trim();
  const migrationFingerprint = String(env.MANU_RELEASE_MIGRATION_FINGERPRINT ?? "").trim();
  const compatibilityVersion = String(env.MANU_RELEASE_COMPATIBILITY_VERSION ?? "").trim();

  if (
    !releaseId ||
    !commitSha ||
    !builtAt ||
    !environment ||
    !migrationFingerprint ||
    !compatibilityVersion
  ) {
    return null;
  }

  assertHostedFallbackForbidden(env, compatibilityVersion);

  return {
    releaseId,
    commitSha,
    builtAt,
    environment,
    migrationFingerprint,
    compatibilityVersion,
  };
}

export function resolveReleaseIdentity(env: NodeJS.ProcessEnv = process.env): ReleaseIdentity {
  const bound = readBoundReleaseIdentity(env);
  if (bound) {
    return bound;
  }

  if (isHostedSupabaseConfigured(env)) {
    throw new Error("release_identity_missing_for_hosted_configuration");
  }

  const compatibilityVersion =
    String(env.NEXT_PUBLIC_SIRIUSAI_APP_VERSION ?? "").trim() ||
    String(env.SIRIUSAI_APP_DEPLOYMENT_VERSION ?? "").trim() ||
    DEV_LOCAL_COMPATIBILITY_VERSION;
  assertHostedFallbackForbidden(env, compatibilityVersion);

  return {
    releaseId: String(env.MANU_RELEASE_ID ?? "").trim() || DEV_LOCAL_RELEASE_ID,
    commitSha: ZERO_SHA,
    builtAt: "1970-01-01T00:00:00.000Z",
    environment: "development",
    migrationFingerprint: ZERO_FINGERPRINT,
    compatibilityVersion,
  };
}

export function resolveDeploymentCompatibilityVersion(env: NodeJS.ProcessEnv = process.env) {
  const explicit = String(env.SIRIUSAI_APP_DEPLOYMENT_VERSION ?? "").trim();
  if (explicit) {
    assertHostedFallbackForbidden(env, explicit);
    return explicit;
  }
  return resolveReleaseIdentity(env).compatibilityVersion;
}

export function resolveClientCompatibilityVersion(env: NodeJS.ProcessEnv = process.env) {
  const explicit =
    String(env.NEXT_PUBLIC_SIRIUSAI_APP_VERSION ?? "").trim() ||
    String(env.SIRIUSAI_APP_DEPLOYMENT_VERSION ?? "").trim();
  if (explicit) {
    assertHostedFallbackForbidden(env, explicit);
    return explicit;
  }
  return resolveReleaseIdentity(env).compatibilityVersion;
}

export function sanitizeReleaseIdForCache(releaseId: string) {
  return String(releaseId).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

export function resolveShellSwCacheVersion(env: NodeJS.ProcessEnv = process.env) {
  const fromEnv = String(env.MANU_SW_CACHE_VERSION ?? "").trim();
  if (fromEnv) {
    return sanitizeReleaseIdForCache(fromEnv);
  }
  return sanitizeReleaseIdForCache(resolveReleaseIdentity(env).releaseId);
}
