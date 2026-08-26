import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildReleaseArtifact } from "./build-release-artifact.mjs";

test("buildReleaseArtifact stages standalone output and renders SW only in the artifact copy", () => {
  const root = mkdtempSync(join(tmpdir(), "manu-release-artifact-"));
  const appRoot = join(root, "app");
  const repoRoot = root;
  mkdirSync(join(appRoot, ".next", "standalone", ".next"), { recursive: true });
  mkdirSync(join(appRoot, ".next", "static", "chunks"), { recursive: true });
  mkdirSync(join(appRoot, "public"), { recursive: true });
  writeFileSync(join(appRoot, ".next", "standalone", "server.js"), "console.log('server');\n", "utf8");
  writeFileSync(join(appRoot, ".next", "standalone", ".next", "BUILD_ID"), "build-id\n", "utf8");
  writeFileSync(join(appRoot, ".next", "static", "chunks", "main.js"), "console.log('main');\n", "utf8");
  writeFileSync(
    join(appRoot, "public", "sw.js"),
    'const SW_CACHE_VERSION = "__MANU_RELEASE_CACHE_VERSION__";\n',
    "utf8",
  );

  const result = buildReleaseArtifact({
    appRoot,
    repoRoot,
    identity: {
      releaseId: "hs-abcdef123456-fedcba654321",
      commitSha: "abcdef123456abcdef123456abcdef123456abcd",
      builtAt: "2026-08-26T00:00:00.000Z",
      environment: "production",
      migrationFingerprint: "f".repeat(64),
      compatibilityVersion: "0.0.0+abcdef1",
    },
  });

  assert.equal(readFileSync(join(appRoot, "public", "sw.js"), "utf8").includes("__MANU_RELEASE_CACHE_VERSION__"), true);
  assert.equal(
    readFileSync(join(result.packageRoot, "public", "sw.js"), "utf8").includes("hs-abcdef123456-fedcba654321"),
    true,
  );
  assert.equal(existsSync(join(result.packageRoot, ".next", "static", "chunks", "main.js")), true);
  assert.equal(existsSync(result.archivePath), true);
  assert.equal(statSync(result.archivePath).size > 0, true);
  assert.equal(readFileSync(result.archiveSha256Path, "utf8").includes(".tar.gz"), true);

  const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
  assert.equal(manifest.nextOutput, "standalone");
  assert.equal(manifest.serviceWorker.renderedInArtifactOnly, true);
  assert.equal(manifest.files.some((file) => file.path === "release-manifest.json"), true);
});
