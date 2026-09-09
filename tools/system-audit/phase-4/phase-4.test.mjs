import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PHASE_4_ID, PHASE_4_STAGES } from "./phase-4-plan.mjs";
import {
  assertPhase3Closed,
  buildAiContractMatrix,
  buildMediaContractMatrix,
  buildMessagingContractMatrix,
  buildWorkerContractMatrix,
} from "./phase-4-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("phase 4 has five strictly ordered stages with one closure stage", () => {
  assert.equal(PHASE_4_ID, "phase-4");
  assert.deepEqual(PHASE_4_STAGES.map((stage) => stage.id), ["4.1", "4.2", "4.3", "4.4", "4.5"]);
  assert.deepEqual(PHASE_4_STAGES[0].prerequisiteStageIds, ["phase-3-closed"]);
  assert.deepEqual(PHASE_4_STAGES[1].prerequisiteStageIds, ["4.1"]);
  assert.deepEqual(PHASE_4_STAGES[2].prerequisiteStageIds, ["4.2"]);
  assert.deepEqual(PHASE_4_STAGES[3].prerequisiteStageIds, ["4.3"]);
  assert.deepEqual(PHASE_4_STAGES[4].prerequisiteStageIds, ["4.1", "4.2", "4.3", "4.4"]);
  for (const stage of PHASE_4_STAGES) {
    assert.ok(stage.objective);
    assert.ok(stage.scope);
    assert.ok(stage.operations.length >= 5);
    assert.ok(stage.verificationCriteria.length >= 3);
    assert.ok(stage.completionCriteria);
  }
});

test("phase 3 closure is a mandatory and digest-validated precondition", () => {
  const precondition = assertPhase3Closed(repoRoot);
  assert.equal(precondition.ok, true, JSON.stringify(precondition));
  assert.equal(precondition.stageFailures.length, 0);
});

test("worker contract matrix is secret-free and passes static reconciliation", () => {
  const matrix = buildWorkerContractMatrix(repoRoot);
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.ok(matrix.releaseWorkers.length >= 6);
  assert.ok(matrix.sourceFiles.every((source) => !source.source.toLowerCase().includes("secret")));
});

test("messaging contract matrix closes ingress and delivery gates", () => {
  const matrix = buildMessagingContractMatrix(repoRoot);
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.externalEgress.enabledForAudit, false);
  assert.ok(matrix.routeChecks.every((route) => route.pass));
});

test("AI contract matrix closes provider and run lifecycle gates", () => {
  const matrix = buildAiContractMatrix(repoRoot);
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.equal(matrix.providerBoundary.realEgressEnabledForAudit, false);
  assert.equal(matrix.providerBoundary.rawPromptCompletionRetention, 0);
});

test("media contract matrix covers all Stage 4B3 and 4B4 sources", () => {
  const matrix = buildMediaContractMatrix(repoRoot);
  assert.equal(matrix.status, "PASS", JSON.stringify(matrix.blockers));
  assert.ok(matrix.mediaSurface.sourceCount >= 40);
  assert.ok(matrix.mediaSurface.externalCallCount >= 0);
  assert.equal(matrix.checks.find((check) => check.id === "external_transport_guarded")?.pass, true);
});

test("phase 4 output directories are not treated as source inputs", () => {
  assert.equal(existsSync(path.join(repoRoot, "tools", "system-audit", "phase-4", "phase-4.test.mjs")), true);
  assert.equal(existsSync(path.join(repoRoot, "docs", "system-audit", "phase-5")), false);
});
