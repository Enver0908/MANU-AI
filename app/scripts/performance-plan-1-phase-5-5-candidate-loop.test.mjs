import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_5_5_CANDIDATE_ID,
  PHASE_5_5_CYCLE_COUNT,
  PHASE_5_5_MAX_REPETITIONS,
  PHASE_5_5_POLICIES,
  PHASE_5_5_VARIABLE_ID,
  buildPhase55Evidence,
  phase55CandidateLoopContract,
  phase55PrerequisiteCheck,
  phase55V3EvidencePath,
  sanitizePhase55Evidence,
  summarizePhase55Cycles,
} from "./performance-plan-1-phase-5-5-candidate-loop.mjs";

test("requires the pre-registered H-5.1-002 candidate and completed safety checks", () => {
  const result = phase55PrerequisiteCheck({
    runId: "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f",
    status: "COMPLETE",
    outcome: "HYPOTHESES_PRE_REGISTERED",
    hypothesisRegister: [{
      candidateId: PHASE_5_5_CANDIDATE_ID,
      optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    }],
  }, {
    runId: "phase5-4-test",
    status: "COMPLETE",
    outcome: "SAFETY_BEHAVIOR_CHECKS_COMPLETE",
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.candidateId, PHASE_5_5_CANDIDATE_ID);
});

test("keeps the candidate loop to one variable and three matched A-B-A cycles", () => {
  const contract = phase55CandidateLoopContract();
  assert.equal(contract.candidateId, PHASE_5_5_CANDIDATE_ID);
  assert.equal(contract.variableId, PHASE_5_5_VARIABLE_ID);
  assert.deepEqual(contract.repetitionContract.order, ["A_before", "B", "A_after"]);
  assert.equal(contract.repetitionContract.cycles, PHASE_5_5_CYCLE_COUNT);
  assert.equal(contract.repetitionContract.maxRepetitions, PHASE_5_5_MAX_REPETITIONS);
  assert.equal(contract.variable.A, PHASE_5_5_POLICIES.A);
  assert.equal(contract.variable.B, PHASE_5_5_POLICIES.B);
  assert.equal(contract.variable.runtimeDefault, PHASE_5_5_POLICIES.A);
});

function trace(cycle, position, boundary, { valid = true, applied = true, cancelled = true } = {}) {
  return {
    traceId: `cycle-${cycle}-${position}`,
    cycle,
    position,
    observationValidity: valid ? "VALID" : "INVALID",
    boundary: { navigationClickToTargetReadyMs: boundary },
    pollingExposure: {
      navigationWindowApplied: applied,
      cancellationObserved: cancelled,
    },
  };
}

test("requires the B direction to repeat across all matched cycles", () => {
  const repeatable = summarizePhase55Cycles([
    trace(1, "A_before", 100), trace(1, "B", 80), trace(1, "A_after", 110),
    trace(2, "A_before", 120), trace(2, "B", 90), trace(2, "A_after", 100),
    trace(3, "A_before", 105), trace(3, "B", 85), trace(3, "A_after", 115),
  ]);
  assert.equal(repeatable.repeatable, true);
  assert.equal(repeatable.conclusion, "REPEATABLE_PROVISIONAL_EFFECT");
  assert.equal(repeatable.noCauseConfirmed, true);

  const inconclusive = summarizePhase55Cycles([
    trace(1, "A_before", 100), trace(1, "B", 80), trace(1, "A_after", 110),
    trace(2, "A_before", 120), trace(2, "B", 140), trace(2, "A_after", 100),
    trace(3, "A_before", 105), trace(3, "B", 105), trace(3, "A_after", 115),
  ]);
  assert.equal(inconclusive.repeatable, false);
  assert.equal(inconclusive.conclusion, "INCONCLUSIVE");
});

test("keeps incomplete traces invalid and evidence non-official", () => {
  const evidence = buildPhase55Evidence({
    runId: "phase55-test-run",
    status: "BLOCKED",
    traces: [trace(1, "A_before", 100, { valid: false })],
    prerequisite: { status: "PASS" },
    checkpoint: { status: "BLOCKED", hashChainRead: true },
  }, { sourceIdentity: { diffCheck: "PASS" } });
  assert.equal(evidence.productionDecision, "NO-GO");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
  assert.equal(evidence.executionScope.runtimeChangeAcceptedAsFix, false);
  assert.equal(evidence.sampleSummary.observationInvalidTraces, 1);
});

test("sanitizes sensitive values and rejects unsafe evidence paths", () => {
  const sanitized = sanitizePhase55Evidence({
    email: "owner@example.com",
    accessToken: "eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk",
    timing: 42,
  });
  assert.equal(sanitized.email, "<redacted>");
  assert.equal(sanitized.accessToken, "<redacted>");
  assert.equal(sanitized.timing, 42);
  assert.throws(() => phase55V3EvidencePath("../escape"), /phase55_v3_run_id_invalid/);
});
