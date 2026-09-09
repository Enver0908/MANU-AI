import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PHASE_5_ID, PHASE_5_STAGES } from "./phase-5-plan.mjs";
import {
  assertPhase4Closed,
  buildAuthenticatedShellMatrix,
  buildAuthUserFlowMatrix,
  buildFrontendBackendContractMatrix,
} from "./phase-5-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("phase 5 has five strictly ordered stages with one closure stage", () => {
  assert.equal(PHASE_5_ID, "phase-5");
  assert.deepEqual(PHASE_5_STAGES.map((stage) => stage.id), ["5.1", "5.2", "5.3", "5.4", "5.5"]);
  assert.deepEqual(PHASE_5_STAGES[0].prerequisiteStageIds, ["phase-4-closed"]);
  assert.deepEqual(PHASE_5_STAGES[1].prerequisiteStageIds, ["5.1"]);
  assert.deepEqual(PHASE_5_STAGES[2].prerequisiteStageIds, ["5.2"]);
  assert.deepEqual(PHASE_5_STAGES[3].prerequisiteStageIds, ["5.3"]);
  assert.deepEqual(PHASE_5_STAGES[4].prerequisiteStageIds, ["5.1", "5.2", "5.3", "5.4"]);
  for (const stage of PHASE_5_STAGES) {
    assert.ok(stage.objective);
    assert.ok(stage.scope);
    assert.ok(stage.prerequisites.length >= 3);
    assert.ok(stage.affectedComponents.length >= 2);
    assert.ok(stage.affectedFiles.length >= 2);
    assert.ok(stage.architectureDecisions.length >= 3);
    assert.ok(stage.operations.length >= 6);
    assert.ok(stage.technicalMethods.length >= 3);
    assert.ok(stage.dataFlow);
    assert.ok(stage.dependencies.length >= 2);
    assert.ok(stage.errorAndBoundaryCases.length >= 4);
    assert.ok(stage.tests.length >= 2);
    assert.ok(stage.verificationCriteria.length >= 3);
    assert.ok(stage.completionCriteria);
  }
});

test("phase 4 closure is a mandatory and digest-validated precondition", () => {
  const precondition = assertPhase4Closed(repoRoot);
  assert.equal(precondition.ok, true, JSON.stringify(precondition));
  assert.equal(precondition.stageFailures.length, 0);
});

test("frontend and backend route inventory reconciles without client service-role imports", () => {
  const matrix = buildFrontendBackendContractMatrix(repoRoot);
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.ok(matrix.inventory.pageCount >= 18);
  assert.ok(matrix.inventory.apiRouteCount >= 100);
  assert.ok(matrix.apiCalls.every((call) => call.pass), JSON.stringify(matrix.apiCalls.filter((call) => !call.pass)));
});

test("auth and authenticated shell source contracts are present", () => {
  const auth = buildAuthUserFlowMatrix(repoRoot);
  const shell = buildAuthenticatedShellMatrix(repoRoot);
  assert.equal(auth.status, "PASS", JSON.stringify(auth.blockers));
  assert.equal(shell.status, "PASS", JSON.stringify(shell.blockers));
  assert.ok(shell.phase5ShellTests.length >= 10);
});

test("phase 5 output directory is evidence only and not a source input", () => {
  assert.equal(existsSync(path.join(repoRoot, "tools", "system-audit", "phase-5", "phase-5.test.mjs")), true);
  assert.equal(existsSync(path.join(repoRoot, "docs", "system-audit", "phase-6")), false);
});
