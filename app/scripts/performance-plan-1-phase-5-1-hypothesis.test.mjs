import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_5_1_FINDING_IDS,
  buildPhase51Evidence,
  getPhase51Hypotheses,
  phase47PrerequisiteCheck,
  phase51V3EvidencePath,
} from "./performance-plan-1-phase-5-1-hypothesis.mjs";

function makePhase47Evidence() {
  return {
    planRevision: "plan1-final-v3",
    stageId: "4.7",
    status: "COMPLETE",
    outcome: "DIAGNOSIS_BLOCKED",
    runId: "phase47-run",
    stageLedger: [{ stageId: "4.7", status: "COMPLETE" }],
    closure: { phase4Closed: true, plan1Closed: false },
    coverage: {
      attemptedCount: 36,
      observationValidCount: 36,
      validFunctionalSampleCount: 23,
    },
    diagnosticConclusion: { performanceOutcome: "NOT_EVALUABLE" },
    findingReconciliation: PHASE_5_1_FINDING_IDS.map((findingId) => ({ findingId })),
    evidenceIntegrity: {
      status: "PASS",
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
    },
  };
}

function sourceIdentity() {
  return {
    head: "test-head",
    branchMode: "DETACHED_HEAD",
    diffCheck: "PASS",
    sourceFiles: [{ path: "test.ts", exists: true, sha256: "hash" }],
  };
}

test("requires a completed 4.7 reconciliation before 5.1", () => {
  const result = phase47PrerequisiteCheck(makePhase47Evidence());
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.failures, []);

  const blocked = phase47PrerequisiteCheck({ ...makePhase47Evidence(), status: "BLOCKED" });
  assert.equal(blocked.status, "FAIL");
  assert.ok(blocked.failures.includes("phase4_7_not_complete"));
});

test("orders the four candidates without presenting any as a confirmed cause", () => {
  const hypotheses = getPhase51Hypotheses();
  assert.deepEqual(
    hypotheses.map((hypothesis) => hypothesis.candidateId),
    ["H-5.1-001", "H-5.1-002", "H-5.1-003", "H-5.1-004"],
  );
  assert.equal(hypotheses[0].affectedJourneys.length, 3);
  assert.equal(hypotheses[3].status, "DEFERRED_NOT_EXERCISED");
  assert.ok(hypotheses.every((hypothesis) =>
    hypothesis.optimizationStatus !== "CAUSE_CONFIRMED"));
});

test("keeps unmeasured contribution as a gate instead of optimizing a candidate", () => {
  const evidence = buildPhase51Evidence({
    phase47Evidence: makePhase47Evidence(),
    phase47EvidencePath: "docs/phase47.json",
    sourceIdentity: sourceIdentity(),
    checkpoint: { runId: "phase51-run", status: "COMPLETE" },
    generatedAt: "2026-09-17T00:00:00.000Z",
  });
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "HYPOTHESES_PRE_REGISTERED");
  assert.equal(evidence.ordering.measuredContributionAvailable, false);
  assert.equal(evidence.ordering.orderingStatus, "PROVISIONAL_PENDING_ACCEPTED_TIMING_MEASUREMENT");
  assert.ok(evidence.blockers.includes("measured_contribution_unavailable"));
  assert.equal(evidence.gates.noRuntimeChangeIn51, true);
  assert.equal(evidence.executionScope.causalExperimentStarted, false);
});

test("each candidate pre-registers one variable, timing, controls, safety, and rollback", () => {
  const hypotheses = getPhase51Hypotheses();
  for (const hypothesis of hypotheses) {
    assert.ok(hypothesis.singleVariableFor52.length > 0);
    assert.ok(hypothesis.expectedTimingBoundary.start.length > 0);
    assert.ok(hypothesis.expectedTimingBoundary.end.length > 0);
    assert.ok(hypothesis.controlsFor52.length > 0);
    assert.ok(hypothesis.safetyChecks.length > 0);
    assert.ok(hypothesis.rollback.length > 0);
  }
});

test("evidence is redacted, non-official, and output paths reject traversal", () => {
  const evidence = buildPhase51Evidence({
    phase47Evidence: makePhase47Evidence(),
    phase47EvidencePath: "docs/phase47.json",
    sourceIdentity: sourceIdentity(),
    checkpoint: { runId: "phase51-run", status: "COMPLETE" },
    generatedAt: "2026-09-17T00:00:00.000Z",
  });
  assert.equal(evidence.evidenceIntegrity.status, "PASS");
  assert.equal(evidence.evidenceIntegrity.redactionCheck, "PASS");
  assert.equal(evidence.productionDecision, "NO-GO");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
  assert.equal(evidence.executionScope.runtimeChangeAcceptedAsFix, false);
  assert.throws(() => phase51V3EvidencePath("../escape"), /phase51_run_id_invalid/);
});
