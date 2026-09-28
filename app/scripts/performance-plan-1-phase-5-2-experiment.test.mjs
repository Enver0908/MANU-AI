import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_5_2_CANDIDATE_ID,
  PHASE_5_2_CYCLE_COUNT,
  PHASE_5_2_MAX_REPETITIONS,
  PHASE_5_2_POLICIES,
  PHASE_5_2_VARIABLE_ID,
  buildPhase52Evidence,
  phase52ExperimentContract,
  phase52PrerequisiteCheck,
  phase52V3EvidencePath,
  sanitizePhase52Evidence,
  summarizePhase52Cycles,
} from "./performance-plan-1-phase-5-2-experiment.mjs";

test("requires the completed Phase 5.1 evidence and first candidate", () => {
  const pass = phase52PrerequisiteCheck({
    runId: "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f",
    status: "COMPLETE",
    outcome: "HYPOTHESES_PRE_REGISTERED",
    hypothesisRegister: [{
      candidateId: PHASE_5_2_CANDIDATE_ID,
      optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    }],
  });
  assert.equal(pass.status, "PASS");

  const blocked = phase52PrerequisiteCheck({
    runId: "wrong",
    status: "BLOCKED",
    outcome: "NOPE",
    hypothesisRegister: [],
  });
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.failures.includes("parent_evidence_run_id_mismatch"));
});

test("keeps the experiment to one variable and three A-B-A cycles", () => {
  const contract = phase52ExperimentContract();
  assert.equal(contract.candidateId, PHASE_5_2_CANDIDATE_ID);
  assert.equal(contract.variableId, PHASE_5_2_VARIABLE_ID);
  assert.deepEqual(contract.repetitionContract.order, ["A_before", "B", "A_after"]);
  assert.equal(contract.repetitionContract.cycles, PHASE_5_2_CYCLE_COUNT);
  assert.equal(contract.repetitionContract.maxRepetitions, PHASE_5_2_MAX_REPETITIONS);
  assert.equal(contract.variable.A, PHASE_5_2_POLICIES.A);
  assert.equal(contract.variable.B, PHASE_5_2_POLICIES.B);
  assert.equal(contract.variable.runtimeDefault, PHASE_5_2_POLICIES.A);
});

function trace(cycle, position, boundary) {
  return {
    traceId: `cycle-${cycle}-${position}`,
    cycle,
    position,
    observationValidity: "VALID",
    boundary: { routeCommitToTargetReadyMs: boundary },
  };
}

test("requires the B direction to repeat across all matched cycles", () => {
  const repeatable = summarizePhase52Cycles([
    trace(1, "A_before", 100), trace(1, "B", 80), trace(1, "A_after", 110),
    trace(2, "A_before", 120), trace(2, "B", 90), trace(2, "A_after", 100),
    trace(3, "A_before", 105), trace(3, "B", 85), trace(3, "A_after", 115),
  ]);
  assert.equal(repeatable.repeatable, true);
  assert.equal(repeatable.conclusion, "REPEATABLE_PROVISIONAL_EFFECT");
  assert.equal(repeatable.noCauseConfirmed, true);

  const inconclusive = summarizePhase52Cycles([
    trace(1, "A_before", 100), trace(1, "B", 80), trace(1, "A_after", 110),
    trace(2, "A_before", 120), trace(2, "B", 140), trace(2, "A_after", 100),
    trace(3, "A_before", 105), trace(3, "B", 105), trace(3, "A_after", 115),
  ]);
  assert.equal(inconclusive.repeatable, false);
  assert.equal(inconclusive.conclusion, "INCONCLUSIVE");
});

test("sanitizes sensitive values and rejects unsafe evidence paths", () => {
  const sanitized = sanitizePhase52Evidence({
    email: "owner@example.com",
    accessToken: "eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk",
    timing: 42,
  });
  assert.equal(sanitized.email, "<redacted-email>");
  assert.equal(sanitized.accessToken, "<redacted>");
  assert.equal(sanitized.timing, 42);
  assert.throws(() => phase52V3EvidencePath("../escape"), /phase52_v3_run_id_invalid/);
});

test("does not mark the experiment as an official measurement or accepted fix", () => {
  const evidence = buildPhase52Evidence({
    runId: "phase52-test-run",
    status: "COMPLETE",
    traces: [],
    parentEvidence: { runId: "parent", status: "COMPLETE" },
    prerequisite: { status: "PASS" },
    checkpoint: { status: "COMPLETE", hashChainRead: true },
  }, {
    sourceIdentity: { diffCheck: "PASS" },
  });
  assert.equal(evidence.productionDecision, "NO-GO");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
  assert.equal(evidence.executionScope.runtimeChangeAcceptedAsFix, false);
  assert.equal(evidence.evidenceIntegrity.checkpointHashChain, true);
  assert.deepEqual(evidence.findingDispositionChanges, []);
});
