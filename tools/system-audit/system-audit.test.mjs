import test from "node:test";
import assert from "node:assert/strict";
import { AUDIT_PLAN_ID, PHASE_1_STAGES } from "./lib/audit-plan.mjs";
import { assertCanBeginStage, assertPhaseCanVerify, createInitialState, markStageInProgress, markStageImplemented, markStageVerified } from "./lib/audit-contract.mjs";

test("Phase 1 stages have a fixed, complete order", () => {
  assert.equal(AUDIT_PLAN_ID, "aiya-system-compatibility-reliability-release-readiness-v1");
  assert.deepEqual(PHASE_1_STAGES.map((stage) => stage.id), ["1.1", "1.2", "1.3", "1.4"]);
  for (const stage of PHASE_1_STAGES) {
    assert.ok(stage.operations.length > 0);
    assert.ok(stage.requiredOutputFiles.length > 0);
    assert.ok(stage.verificationRules.length > 0);
  }
});

test("stage transitions reject skipping and allow only verified prerequisites", () => {
  const state = createInitialState({ repoRoot: ".", observedAt: "2026-09-08T00:00:00.000Z", sourceCommit: "a".repeat(40) });
  assert.throws(() => assertCanBeginStage(state, "1.2"), /stage_prerequisite_not_verified/);
  markStageInProgress(state, "1.1", "2026-09-08T00:01:00.000Z");
  markStageImplemented(state, "1.1", "2026-09-08T00:02:00.000Z", { "baseline.json": "b".repeat(64) });
  assert.throws(() => assertCanBeginStage(state, "1.2"), /stage_prerequisite_not_verified/);
  markStageVerified(state, "1.1", "2026-09-08T00:03:00.000Z", "evidence", "c".repeat(64), { "baseline.json": "b".repeat(64) });
  assert.doesNotThrow(() => assertCanBeginStage(state, "1.2"));
  assert.throws(() => assertPhaseCanVerify(state), /phase_stages_not_verified/);
});
