import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FIXTURE_VERSION, TENANTS, validatePhase3FixtureContract } from "./performance-plan-1-phase-3.mjs";

const appRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = join(appRoot, "..");
const evidencePath = join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json");

test("Plan 1 Phase 3 fixture contract locks the ordered data volumes and roles", () => {
  const contract = validatePhase3FixtureContract();
  assert.equal(contract.status, "PASS");
  assert.deepEqual(contract.failures, []);
  assert.equal(TENANTS.small.clientCount, 3);
  assert.equal(TENANTS.normal.clientCount, 50);
  assert.deepEqual(TENANTS.small.messageCounts, [20]);
  assert.deepEqual(TENANTS.normal.messageCounts, [20, 200]);
});

test("Plan 1 Phase 3 evidence closes only the complete ordered stage ledger", () => {
  assert.equal(existsSync(evidencePath), true);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "SYNTHETIC_AUTH_STORE_READY");
  assert.deepEqual(
    evidence.stageLedger.map((stage) => stage.stageId),
    ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
  );
  assert.deepEqual(
    evidence.stageLedger.map((stage) => stage.status),
    ["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"],
  );
  assert.ok(evidence.stageLedger.every((stage) => stage.sourceIdentity?.head));
  assert.equal(evidence.finalControls.orderedStagesComplete, true);
  assert.equal(evidence.finalControls.authenticatedSessionReady, true);
  assert.equal(evidence.finalControls.normalRlsPathReady, true);
  assert.equal(evidence.finalControls.validPerformanceBaselineCaptured, false);
  assert.equal(evidence.finalControls.rootCauseConfirmed, false);
  assert.equal(evidence.productionDecision, "NO-GO");
});

test("Plan 1 Phase 3 evidence records the synthetic fixture without raw clinical or credential data", () => {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.fixture.fixtureVersion, FIXTURE_VERSION);
  assert.deepEqual(
    evidence.fixture.tenants.map((tenant) => [tenant.class, tenant.clientCount]),
    [
      ["small", 3],
      ["normal", 50],
    ],
  );
  assert.deepEqual(evidence.fixture.tenants[0].conversationMessageCounts, [20]);
  assert.deepEqual(evidence.fixture.tenants[1].conversationMessageCounts, [20, 200]);
  assert.equal(evidence.fixture.rawRowsRecorded, false);
  assert.equal(evidence.fixture.rawMessageBodiesRecorded, false);
  assert.equal(evidence.fixture.clinicalDataRecorded, false);
  assert.equal(evidence.accountContract.tokensRecorded, false);
  assert.equal(evidence.accountContract.passwordsRecorded, false);

  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /AiyaPhase3LocalOnly/);
  assert.doesNotMatch(serialized, /@manu\.local/);
  assert.doesNotMatch(serialized, /Synthetic message/);
  assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(serialized, /sb-access-token|refresh_token=|service_role_key\s*:/i);
});

test("Plan 1 Phase 3 evidence proves local-only auth/store boundaries and preserves exclusions", () => {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.localTarget.projectId, "manu-ai-local");
  assert.equal(evidence.localTarget.urlIsLocal, true);
  assert.equal(evidence.localTarget.databaseReset, false);
  assert.equal(evidence.localTarget.remoteMigration, false);
  assert.equal(evidence.constraints.serviceRoleUse, "fixture_seed_cleanup_and_local_session_activity_only");
  assert.equal(evidence.constraints.demoCookie, "NOT_USED");
  assert.equal(evidence.constraints.fallbackStore, "NOT_USED");
  assert.equal(evidence.constraints.hostedSyntheticAccount, "NOT_EXECUTED");
  assert.equal(evidence.constraints.performanceBaseline, "NOT_EXECUTED");
  assert.equal(evidence.constraints.runtimeUiApiChange, "NOT_EXECUTED");
  assert.equal(evidence.constraints.productionGateChange, "NOT_EXECUTED");
  assert.equal(evidence.authenticationAndRls.status, "PASS");
  assert.equal(evidence.authenticationAndRls.assertions.ownerSmallCrossTenantHidden, true);
  assert.equal(evidence.authenticationAndRls.assertions.assistantUnassignedClientHidden, true);
  assert.equal(evidence.authenticationAndRls.assertions.viewerAssignedClientVisible, true);
  assert.equal(evidence.authenticationAndRls.assertions.auditorClientsHidden, true);
  assert.equal(evidence.authenticationAndRls.assertions.anonymousClientsHidden, true);
});

test("Plan 1 Phase 3 evidence preserves historical hashes and the working-tree check", () => {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.evidenceIntegrity.status, true);
  assert.equal(evidence.evidenceIntegrity.historicalAtStart.allUnchanged, true);
  assert.equal(evidence.evidenceIntegrity.historicalAtEnd.allUnchanged, true);
  assert.equal(evidence.evidenceIntegrity.diffCheck, "PASS");
  for (const item of evidence.evidenceIntegrity.historicalAtEnd.files) {
    if (!item.exists || !item.expectedSha256) continue;
    const actual = createHash("sha256").update(readFileSync(join(repoRoot, item.path))).digest("hex");
    assert.equal(actual, item.expectedSha256, item.path);
  }
});

test("Plan 1 Phase 3 package commands point to the dedicated evidence and test scripts", () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["audit:performance:plan1:phase3"], "node scripts/performance-plan-1-phase-3.mjs");
  assert.equal(
    packageJson.scripts["test:performance-plan1-phase3"],
    "node --test scripts/performance-plan-1-phase-3.test.mjs",
  );
});
