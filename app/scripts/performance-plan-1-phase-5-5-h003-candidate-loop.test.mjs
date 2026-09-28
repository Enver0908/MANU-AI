import test from "node:test";
import assert from "node:assert/strict";
import {
  PHASE_5_5_H003_CANDIDATE_ID,
  PHASE_5_5_H003_CYCLE_COUNT,
  PHASE_5_5_H003_PARENT_EVIDENCE_RUN_ID,
  buildPhase55H003Evidence,
  phase55H003CandidateLoopContract,
  phase55H003EvidencePath,
  phase55H003PrerequisiteCheck,
  sanitizePhase55H003Evidence,
  summarizePhase55H003Cycles,
} from "./performance-plan-1-phase-5-5-h003-candidate-loop.mjs";

function trace(cycle, position, boundary, options = {}) {
  return {
    traceId: `cycle-${cycle}-${position}`,
    cycle,
    position,
    observationValidity: options.valid === false ? "INVALID" : "VALID",
    boundary: { routeCommitToTargetReadyMs: boundary },
    bundlePolicy: position === "B" ? "deferred_dynamic" : "current_eager",
    bundleObservation: {
      policyApplied: position === "B" ? "deferred_dynamic" : "current_eager",
      dynamicImportResolvedAtMs: position === "B" ? 120 : null,
      panelMountedAtMs: 130,
      resourceTimingAvailable: true,
    },
  };
}

function matchedTraces(deltas) {
  return deltas.flatMap((delta, index) => {
    const cycle = index + 1;
    return [
      trace(cycle, "A_before", 100),
      trace(cycle, "B", 100 + delta),
      trace(cycle, "A_after", 100),
    ];
  });
}

test("requires the pre-registered H-5.1-003 candidate, safety gate, and H-5.1-002 closure", () => {
  const parent = {
    runId: PHASE_5_5_H003_PARENT_EVIDENCE_RUN_ID,
    status: "COMPLETE",
    outcome: "HYPOTHESES_PRE_REGISTERED",
    hypothesisRegister: [{
      candidateId: PHASE_5_5_H003_CANDIDATE_ID,
      optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    }],
  };
  const safety = { status: "COMPLETE", outcome: "SAFETY_BEHAVIOR_CHECKS_COMPLETE" };
  const h002 = { status: "COMPLETE", outcome: "INCONCLUSIVE" };
  assert.equal(phase55H003PrerequisiteCheck(parent, safety, h002).status, "PASS");
  assert.equal(phase55H003PrerequisiteCheck(parent, safety, { ...h002, outcome: "BLOCKED" }).status, "BLOCKED");
});

test("keeps the H-5.1-003 variable to three matched A-B-A cycles", () => {
  const contract = phase55H003CandidateLoopContract();
  assert.equal(contract.candidateId, PHASE_5_5_H003_CANDIDATE_ID);
  assert.equal(contract.variable.A, "current_eager");
  assert.equal(contract.variable.B, "deferred_dynamic");
  assert.deepEqual(contract.repetition.order, ["A_before", "B", "A_after"]);
  assert.equal(contract.repetition.cycles, PHASE_5_5_H003_CYCLE_COUNT);
});

test("classifies a repeatable direction only when every B dynamic boundary is observed", () => {
  const summary = summarizePhase55H003Cycles(matchedTraces([25, 30, 20]));
  assert.equal(summary.repeatable, true);
  assert.equal(summary.conclusion, "REPEATABLE_PROVISIONAL_EFFECT");
  assert.deepEqual(summary.cycles.map((cycle) => cycle.direction), ["B_SLOWER", "B_SLOWER", "B_SLOWER"]);

  const inconclusive = summarizePhase55H003Cycles(matchedTraces([25, -5, 20]));
  assert.equal(inconclusive.repeatable, false);
  assert.equal(inconclusive.conclusion, "INCONCLUSIVE");
});

test("keeps incomplete traces invalid and evidence non-official", () => {
  const traces = matchedTraces([25, 25, 25]);
  traces[4] = trace(2, "B", 125, { valid: false });
  const evidence = buildPhase55H003Evidence({
    runId: "aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-test",
    status: "BLOCKED",
    traces,
    checkpoint: { status: "BLOCKED", hashChainRead: true },
    prerequisite: { status: "PASS" },
  }, {
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(evidence.status, "BLOCKED");
  assert.equal(evidence.evidenceIntegrity.officialMeasurementStarted, false);
  assert.equal(evidence.sampleSummary.validTracesAreNotOfficialBaseline, true);
});

test("sanitizes sensitive values and rejects unsafe evidence paths", () => {
  const sanitized = sanitizePhase55H003Evidence({ password: "secret-value", nested: { token: "token-value" } });
  assert.equal(sanitized.password, "<redacted>");
  assert.equal(sanitized.nested.token, "<redacted>");
  assert.throws(() => phase55H003EvidencePath("../unsafe"), /run_id_invalid/);
});
