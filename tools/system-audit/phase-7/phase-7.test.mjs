import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PHASE_7_ID, PHASE_7_STAGES } from "./phase-7-plan.mjs";
import {
  assertPhase6Closed,
  buildCiReleaseGateMatrix,
  buildReleaseGateMatrix,
  buildTargetEnvironmentReconciliationMatrix,
  deriveAuditReleaseIdentity,
  mutationPolicySnapshot,
} from "./phase-7-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("phase 7 has four strictly ordered stages with eight operations each", () => {
  assert.equal(PHASE_7_ID, "phase-7");
  assert.deepEqual(PHASE_7_STAGES.map((stage) => stage.id), ["7.1", "7.2", "7.3", "7.4"]);
  assert.deepEqual(PHASE_7_STAGES[0].prerequisiteStageIds, ["phase-6-closed"]);
  assert.deepEqual(PHASE_7_STAGES[1].prerequisiteStageIds, ["7.1"]);
  assert.deepEqual(PHASE_7_STAGES[2].prerequisiteStageIds, ["7.2"]);
  assert.deepEqual(PHASE_7_STAGES[3].prerequisiteStageIds, ["7.1", "7.2", "7.3"]);
  for (const stage of PHASE_7_STAGES) {
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
    assert.ok(stage.tests.length >= 1);
    assert.ok(stage.verificationCriteria.length >= 3);
    assert.ok(stage.completionCriteria);
  }
});

test("phase 6 closure is a mandatory current-source precondition", () => {
  const precondition = assertPhase6Closed(repoRoot);
  assert.equal(precondition.ok, true, JSON.stringify(precondition));
  assert.equal(precondition.stageFailures.length, 0);
});

test("CI release gates reconcile checked-in workflows and templates", () => {
  const sourceCommit = assertPhase6Closed(repoRoot).sourceCommit;
  const matrix = buildCiReleaseGateMatrix(repoRoot, sourceCommit, {
    finalGate: { pass: true, verifier: "fixture" },
  });
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
  assert.equal(matrix.workflowRecords.every((record) => record.byteIdentical), true, JSON.stringify(matrix.workflowRecords));
});

test("target reconciliation derives one release identity without target egress", () => {
  const sourceCommit = assertPhase6Closed(repoRoot).sourceCommit;
  const identity = deriveAuditReleaseIdentity(repoRoot, sourceCommit);
  const matrix = buildTargetEnvironmentReconciliationMatrix(repoRoot, sourceCommit, {
    identity,
    ciStageVerified: true,
    targetProbe: { status: "NOT_RUN_BY_POLICY", httpCalls: 0, supabaseCalls: 0, sshCalls: 0, providerCalls: 0, channelCalls: 0 },
    mutationPolicy: mutationPolicySnapshot({}),
    finalGate: { pass: true, verifier: "fixture" },
  });
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
  assert.equal(matrix.targetProbe.status, "NOT_RUN_BY_POLICY");
  assert.equal(matrix.productionDecision.productionDecision, "NO-GO");
  assert.ok(matrix.releaseBlockers.length > 0);
});

test("release gate matrix is fail-closed and artifact-bound", () => {
  const sourceCommit = assertPhase6Closed(repoRoot).sourceCommit;
  const identity = deriveAuditReleaseIdentity(repoRoot, sourceCommit);
  const commands = Array.from({ length: 7 }, (_, index) => ({ name: `gate-${index + 1}`, status: "PASS" }));
  const matrix = buildReleaseGateMatrix(repoRoot, sourceCommit, {
    identity,
    targetStageVerified: true,
    localCiPass: true,
    buildPass: true,
    verifierPass: true,
    smokePass: true,
    atomicPass: true,
    commandResults: commands,
    artifact: { pass: true, commitSha: sourceCommit, releaseId: identity.releaseId, migrationFingerprint: identity.migrationFingerprint },
  });
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.operationChecks.length, 8);
});

test("phase 7 contract boundary keeps remote, provider and production mutations closed", () => {
  const policy = mutationPolicySnapshot(process.env);
  assert.equal(Object.values(policy).some((item) => item.enabled), false, JSON.stringify(policy));
});
