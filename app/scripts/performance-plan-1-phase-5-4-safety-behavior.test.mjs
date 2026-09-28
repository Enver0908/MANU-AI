import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PHASE_5_4_FOCUSED_TEST_FILES,
  PHASE_5_4_INPUT_RUN_ID,
  buildPhase54Evidence,
  phase54PrerequisiteCheck,
  phase54V3EvidencePath,
} from "./performance-plan-1-phase-5-4-safety-behavior.mjs";

const inputEvidence = JSON.parse(readFileSync(
  new URL("../../docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json", import.meta.url),
  "utf8",
));

const testExecution = {
  status: "PASS",
  reason: null,
  exitCode: 0,
  testFiles: PHASE_5_4_FOCUSED_TEST_FILES,
  testFilesPassed: PHASE_5_4_FOCUSED_TEST_FILES.length,
  testFilesFailed: 0,
  testFilesSkipped: 0,
  testFilesTotal: PHASE_5_4_FOCUSED_TEST_FILES.length,
  testsPassed: 124,
  testsFailed: 0,
  testsSkipped: 0,
  testsTotal: 124,
};

test("requires the complete inconclusive Phase 5.3 input", () => {
  const pass = phase54PrerequisiteCheck(inputEvidence);
  assert.equal(pass.status, "PASS");
  assert.equal(pass.inputEvidence.runId, PHASE_5_4_INPUT_RUN_ID);

  const blocked = phase54PrerequisiteCheck({ ...inputEvidence, outcome: "CAUSE_CONFIRMED" });
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.failures.includes("phase53_outcome_invalid"));
});

test("keeps the local RLS runtime boundary fail-closed when unavailable", () => {
  const evidence = buildPhase54Evidence({
    inputEvidence,
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
    testExecution,
    rlsProbe: {
      status: "BLOCKED",
      endpoint: "127.0.0.1:54321",
      reason: "local_supabase_unavailable",
      integrationTestStarted: false,
    },
    generatedAt: "2026-09-17T16:30:00.000Z",
    runId: "phase54-test-run",
  });

  assert.equal(evidence.status, "BLOCKED");
  assert.equal(evidence.outcome, "SAFETY_BEHAVIOR_CHECKS_BLOCKED");
  assert.equal(evidence.checkResults.find((item) => item.checkId === "auth_login_logout_session")?.status, "PASS");
  assert.equal(evidence.checkResults.find((item) => item.checkId === "cross_user_isolation_rls_runtime")?.status, "BLOCKED");
  assert.deepEqual(
    evidence.staticContractChecks.map((item) => item.status),
    ["PASS", "PASS", "PASS", "PASS", "PASS"],
  );
  assert.deepEqual(evidence.findingDispositionChanges, []);
  assert.equal(evidence.executionScope.newMeasurementStarted, false);
  assert.equal(evidence.executionScope.databaseResetStarted, false);
  assert.equal(evidence.executionScope.migrationStarted, false);
  assert.equal(evidence.executionScope.providerTrafficStarted, false);
});

test("closes the safety gate only after the complete local RLS suite passes", () => {
  const evidence = buildPhase54Evidence({
    inputEvidence,
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
    testExecution,
    rlsProbe: {
      status: "PASS",
      endpoint: "127.0.0.1:54321",
      httpStatus: 200,
      integrationTestStarted: true,
      integrationTestStatus: "PASS",
      integrationTestFile: "src/lib/supabase-rls.integration.test.ts",
      integrationTestExitCode: 0,
      testFilesPassed: 1,
      testFilesFailed: 0,
      testFilesSkipped: 0,
      testsPassed: 56,
      testsFailed: 0,
      testsSkipped: 0,
      testsTotal: 56,
    },
    runId: "phase54-test-complete",
  });

  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "SAFETY_BEHAVIOR_CHECKS_COMPLETE");
  assert.equal(evidence.checkResults.find((item) => item.checkId === "cross_user_isolation_rls_runtime")?.status, "PASS");
  assert.deepEqual(evidence.blockers, []);
  assert.equal(evidence.activeContract.nextEligibleStage, "5.5");
  assert.match(evidence.closure.nextAction, /5\.5/);
});

test("records state, mutation, privacy, and stale-response coverage", () => {
  const evidence = buildPhase54Evidence({
    inputEvidence,
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
    testExecution,
    rlsProbe: { status: "BLOCKED", integrationTestStarted: false },
    runId: "phase54-test-run-coverage",
  });
  const ids = new Set(evidence.checkResults.map((item) => item.checkId));
  for (const id of [
    "tenant_context_role_capability",
    "state_freshness_late_response_single_flight",
    "mutation_revision_conflict_idempotency",
    "offline_privacy_reconnect",
  ]) {
    assert.ok(ids.has(id));
  }
  assert.equal(evidence.attribution.causeConfirmed, false);
  assert.equal(evidence.checkpointReconciliation.newCheckpointCreated, false);
});

test("keeps evidence redacted and output paths safe", () => {
  const evidence = buildPhase54Evidence({
    inputEvidence,
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
    testExecution,
    rlsProbe: { status: "BLOCKED", integrationTestStarted: false },
    runId: "phase54-test-redaction",
  });
  assert.equal(evidence.evidenceIntegrity.status, "PASS");
  assert.equal(evidence.evidenceIntegrity.redactionCheck, "PASS");
  assert.throws(() => phase54V3EvidencePath("../escape"), /phase54_v3_run_id_invalid/);
  assert.ok(phase54V3EvidencePath("aiya-performance-plan1-phase5-4-safety-behavior-v3-test").endsWith(
    "_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json",
  ));
});
