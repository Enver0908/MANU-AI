import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PHASE_6_ID, PHASE_6_STAGES } from "./phase-6-plan.mjs";
import {
  assertPhase5Closed,
  buildFailureInjectionMatrix,
  buildLoadCapacityMatrix,
  buildObservabilityMatrix,
  buildRecoveryMatrix,
} from "./phase-6-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("phase 6 has five strictly ordered stages with one closure stage", () => {
  assert.equal(PHASE_6_ID, "phase-6");
  assert.deepEqual(PHASE_6_STAGES.map((stage) => stage.id), ["6.1", "6.2", "6.3", "6.4", "6.5"]);
  assert.deepEqual(PHASE_6_STAGES[0].prerequisiteStageIds, ["phase-5-closed"]);
  assert.deepEqual(PHASE_6_STAGES[1].prerequisiteStageIds, ["6.1"]);
  assert.deepEqual(PHASE_6_STAGES[2].prerequisiteStageIds, ["6.2"]);
  assert.deepEqual(PHASE_6_STAGES[3].prerequisiteStageIds, ["6.3"]);
  assert.deepEqual(PHASE_6_STAGES[4].prerequisiteStageIds, ["6.1", "6.2", "6.3", "6.4"]);
  for (const stage of PHASE_6_STAGES) {
    assert.ok(stage.objective);
    assert.ok(stage.scope);
    assert.ok(stage.prerequisites.length >= 3);
    assert.ok(stage.affectedComponents.length >= 2);
    assert.ok(stage.affectedFiles.length >= 2);
    assert.ok(stage.architectureDecisions.length >= 3);
    assert.equal(stage.operations.length, 8);
    assert.ok(stage.technicalMethods.length >= 3);
    assert.ok(stage.dataFlow);
    assert.ok(stage.dependencies.length >= 2);
    assert.ok(stage.errorAndBoundaryCases.length >= 4);
    assert.ok(stage.tests.length >= 2);
    assert.ok(stage.verificationCriteria.length >= 3);
    assert.ok(stage.completionCriteria);
  }
});

test("phase 5 closure is a mandatory and digest-validated precondition", () => {
  const precondition = assertPhase5Closed(repoRoot);
  assert.equal(precondition.ok, true, JSON.stringify(precondition));
  assert.equal(precondition.stageFailures.length, 0);
});

test("load and capacity matrix reconciles local harnesses and current bounded rehearsal", () => {
  const matrix = buildLoadCapacityMatrix(repoRoot, "test-source-commit");
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
  assert.equal(matrix.reports.every((report) => report.pass), true, JSON.stringify(matrix.reports));
  assert.equal(matrix.reports.every((report) => report.productionStatus === "NO-GO"), true);
});

test("failure injection matrix covers workers, AI, rate limit and request ids", () => {
  const matrix = buildFailureInjectionMatrix(repoRoot, "test-source-commit");
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
});

test("observability matrix covers bounded health, privacy and rollback signals", () => {
  const matrix = buildObservabilityMatrix(repoRoot, "test-source-commit");
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
});

test("recovery matrix covers dry-run, isolated restore and rollback evidence", () => {
  const matrix = buildRecoveryMatrix(repoRoot, "test-source-commit");
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
});

test("phase 6 audit boundary does not enable remote or provider mutation", () => {
  assert.notEqual(process.env.MANU_ALLOW_REAL_ZAI, "true");
  assert.notEqual(process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED, "true");
  assert.notEqual(process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED, "true");
  assert.notEqual(process.env.MANU_ALLOW_REMOTE_RLS_TESTS, "true");
});
