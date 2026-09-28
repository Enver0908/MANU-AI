import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_5_6_ALLOWED_DISPOSITIONS,
  PHASE_5_6_FINDING_IDS,
  applyPhase56ManifestReview,
  buildPhase56Dispositions,
  phase56PrerequisiteCheck,
  phase56V3EvidencePath,
} from "./performance-plan-1-phase-5-6-finding-disposition.mjs";

function inputFixture() {
  const evidence = (runId, status, outcome) => ({
    runId,
    status,
    outcome,
    sampleSummary: { observationValidTraces: 9 },
    cycleSummary: {
      findingDispositionChanged: false,
      repeatable: outcome === "REPEATABLE_PROVISIONAL_EFFECT",
    },
    executionScope: { runtimeChangeAcceptedAsFix: false },
    attribution: { causeConfirmed: false },
  });
  return {
    manifest: { findings: PHASE_5_6_FINDING_IDS.map((id) => ({ id, phase1Status: "PENDING" })) },
    phase47: evidence("phase47", "COMPLETE", "DIAGNOSIS_BLOCKED"),
    phase51: evidence("phase51", "COMPLETE", "HYPOTHESES_PRE_REGISTERED"),
    phase52: evidence("phase52", "COMPLETE", "REPEATABLE_PROVISIONAL_EFFECT"),
    phase53: evidence("phase53", "COMPLETE", "LAYER_ATTRIBUTION_INCONCLUSIVE"),
    phase54: evidence("phase54", "COMPLETE", "SAFETY_BEHAVIOR_CHECKS_COMPLETE"),
    h002: evidence("h002", "COMPLETE", "INCONCLUSIVE"),
    h003: evidence("h003", "COMPLETE", "REPEATABLE_PROVISIONAL_EFFECT"),
  };
}

test("locks the five allowed findings and requires completed prerequisite evidence", () => {
  const result = phase56PrerequisiteCheck(inputFixture());
  assert.equal(result.status, "PASS");
  assert.deepEqual(PHASE_5_6_ALLOWED_DISPOSITIONS, [
    "CAUSE_CONFIRMED",
    "CONTRIBUTING_FACTOR_CONFIRMED",
    "MEASUREMENT_GAP_RESOLVED",
    "NOT_REPRODUCED",
    "INCONCLUSIVE",
    "OPEN_BLOCKED",
  ]);
});

test("assigns bounded dispositions without promoting provisional effects to causes", () => {
  const decisions = buildPhase56Dispositions(inputFixture());
  assert.deepEqual(decisions.map((item) => [item.findingId, item.disposition]), [
    ["PERF-F2-001", "INCONCLUSIVE"],
    ["PERF-F2-002", "INCONCLUSIVE"],
    ["PERF-F2-003", "INCONCLUSIVE"],
    ["PERF-F12-001", "OPEN_BLOCKED"],
    ["PERF-F12-002", "OPEN_BLOCKED"],
  ]);
  assert.equal(decisions.every((item) => item.plan2Eligibility === "NOT_ELIGIBLE"), true);
  assert.equal(decisions.every((item) => item.exactCauseEvidence !== "CONFIRMED"), true);
});

test("preserves phase-1 fields while adding the review reference", () => {
  const inputs = inputFixture();
  const decisions = buildPhase56Dispositions(inputs);
  const updated = applyPhase56ManifestReview(inputs.manifest, {
    runId: "phase56-test-run",
    evidencePath: "docs/phase56-test.json",
    reviewedAt: "2026-09-18T00:00:00.000Z",
    dispositions: decisions,
  });
  assert.equal(updated.currentDispositionReview.outcome, "FINDING_DISPOSITIONS_REVIEWED");
  assert.equal(updated.findings[0].phase1Status, "PENDING");
  assert.equal(updated.findings[0].disposition, "INCONCLUSIVE");
  assert.equal(updated.findings[3].disposition, "OPEN_BLOCKED");
  assert.equal(updated.findings[0].dispositionReview.evidencePath, "docs/phase56-test.json");
});

test("rejects incomplete candidate evidence and unsafe run ids", () => {
  const inputs = inputFixture();
  inputs.h003.sampleSummary.observationValidTraces = 6;
  assert.equal(phase56PrerequisiteCheck(inputs).status, "BLOCKED");
  assert.throws(() => phase56V3EvidencePath("../escape"), /phase56_v3_run_id_invalid/);
});
