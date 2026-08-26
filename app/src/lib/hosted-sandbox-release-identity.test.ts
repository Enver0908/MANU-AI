import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveShellVersion } from "./phase-85-stage-5-shell-store";
import {
  FORBIDDEN_HOSTED_FALLBACK_VERSION,
  assertHostedFallbackForbidden,
  isHostedSupabaseConfigured,
  resolveReleaseIdentity,
  resolveShellSwCacheVersion,
} from "./release-identity";
import {
  SW_CACHE_VERSION_PLACEHOLDER,
  buildReleaseIdentity,
  renderServiceWorkerForRelease,
  syncServiceWorkerCacheVersion,
} from "../../scripts/lib/release-identity.mjs";

describe("hosted-sandbox release identity", () => {
  it("builds release identity from HEAD and migration fingerprint", () => {
    const identity = buildReleaseIdentity({ repoRoot: join(process.cwd(), "..") });
    expect(identity.releaseId).toMatch(/^hs-[a-f0-9]{12}-[a-f0-9]{12}$/);
    expect(identity.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(identity.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(identity.migrationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.compatibilityVersion).not.toBe(FORBIDDEN_HOSTED_FALLBACK_VERSION);
  });

  it("forbids hosted fallback version when Supabase is configured", () => {
    expect(isHostedSupabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" } as NodeJS.ProcessEnv)).toBe(true);
    expect(() =>
      assertHostedFallbackForbidden(
        { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" } as NodeJS.ProcessEnv,
        FORBIDDEN_HOSTED_FALLBACK_VERSION,
      ),
    ).toThrow(FORBIDDEN_HOSTED_FALLBACK_VERSION);
  });

  it("exposes release identity on shell version contract", () => {
    const version = resolveShellVersion("0.0.0-dev-local");
    expect(version.releaseIdentity.compatibilityVersion).toBe(version.deploymentVersion);
    expect(version.releaseIdentity.releaseId).toBe(resolveReleaseIdentity().releaseId);
  });

  it("keeps tracked service worker stable and renders release cache names for artifacts", () => {
    const env = { MANU_SW_CACHE_VERSION: "hs-test-release-id" } as NodeJS.ProcessEnv;
    expect(resolveShellSwCacheVersion(env)).toBe("hs-test-release-id");
    const swSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const match = swSource.match(/const SW_CACHE_VERSION = "([^"]+)"/);
    expect(match?.[1]).toBe(SW_CACHE_VERSION_PLACEHOLDER);
    const rendered = renderServiceWorkerForRelease(swSource, "hs-test-release-id");
    expect(rendered).toContain('const SW_CACHE_VERSION = "hs-test-release-id";');
    const synced = syncServiceWorkerCacheVersion(join(process.cwd(), ".."), "hs-test-release-id", { write: false });
    expect(synced).toBe("hs-test-release-id");
  });
});
