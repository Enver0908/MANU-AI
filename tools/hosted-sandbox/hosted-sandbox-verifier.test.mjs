import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEMO_TENANT_UUID,
  fingerprintMigrations,
  sha256Buffer
} from "./lib/identity.mjs";
import {
  evaluateDemoTenantSource,
  evaluateShaBinding,
  evaluateUnauthorizedDiff,
  runNegativeControls
} from "./lib/negative-controls.mjs";
import { findRepoRoot, runHostedSandboxVerifier } from "./run-verifier.mjs";

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

test("HS-GOV-VS-003 wrong SHA fails closed", () => {
  const result = evaluateShaBinding("a".repeat(40), "b".repeat(40));
  assert.equal(result.ok, false);
});

test("HS-GOV-VS-003 missing migration set fails closed", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "hs-test-mig-"));
  mkdirSync(path.join(tempRoot, "app", "supabase", "migrations"), { recursive: true });
  assert.throws(() => fingerprintMigrations(tempRoot), /empty|missing/);
});

test("HS-GOV-VS-003 demo tenant fixture fails closed", () => {
  const result = evaluateDemoTenantSource(`id ${DEMO_TENANT_UUID}`);
  assert.equal(result.ok, false);
});

test("HS-GOV-VS-003 unauthorized diff fails closed", () => {
  const result = evaluateUnauthorizedDiff(["app/package.json"], ["docs/example.md"]);
  assert.equal(result.ok, false);
});

test("HS-GOV-VS-003 negative control suite fails closed as a group", () => {
  const result = runNegativeControls(repoRoot);
  assert.equal(result.wrongSha, "FAIL_CLOSED");
  assert.equal(result.missingMigration, "FAIL_CLOSED");
  assert.equal(result.demoTenant, "FAIL_CLOSED");
  assert.equal(result.unauthorizedDiff, "FAIL_CLOSED");
});

test("HS-GOV-VS-002 live verifier binds SHA and migration fingerprint", () => {
  const { artifact } = runHostedSandboxVerifier({ repoRoot });
  assert.equal(artifact.result, "PASS");
  assert.match(artifact.commitSha, /^[a-f0-9]{40}$/);
  assert.equal(artifact.identity.migrations.count >= 1, true);
  assert.equal(artifact.identity.migrations.fingerprint.length, 64);
  assert.equal(sha256Buffer(Buffer.from(artifact.commitSha)).length, 64);
});
