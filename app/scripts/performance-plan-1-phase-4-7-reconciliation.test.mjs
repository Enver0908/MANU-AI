import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_4_7_FINDING_IDS,
  buildPhase47Evidence,
  mapPhase47Observations,
  phase47V3EvidencePath,
  reconcilePhase47Inputs,
} from "./performance-plan-1-phase-4-7-reconciliation.mjs";

function sample(environment, journeyId, repetition, {
  functionalOutcome = "SUCCESS",
  observationValidity = "VALID",
  failureReason = null,
} = {}) {
  return {
    unitKey: `${environment ? `${environment}:` : "normal:"}${journeyId}:r${repetition}`,
    environment,
    journeyId,
    repetition,
    observationValidity,
    functionalOutcome,
    performanceOutcome: "NOT_EVALUABLE",
    validSample: observationValidity === "VALID" && functionalOutcome === "SUCCESS",
    failureBoundary: {
      phase: failureReason ? "first_action" : "none",
      actionId: failureReason ? "first" : null,
      reason: failureReason,
    },
  };
}

function stageLedger(stages) {
  return stages.map((stageId) => ({ stageId, status: "COMPLETE" }));
}

function makeInputs() {
  const localEvidence = {
    planRevision: "plan1-final-v3",
    stageId: "4.4",
    status: "IN_PROGRESS",
    outcome: "LOCAL_OBSERVATIONS_RECONCILED",
    runId: "local-run",
    stageLedger: stageLedger(["4.4.1", "4.4.2", "4.4.3", "4.4.4"]),
    reconciliation: { status: "PASS" },
    blockers: [],
    evidenceIntegrity: {
      redactionCheck: "PASS",
      historicalPhase4EvidenceRewritten: false,
      officialMeasurementStarted: false,
      runtimeFixAccepted: false,
    },
    samples: [
      sample(null, "J1", 1),
      sample(null, "J2", 1),
      sample(null, "J3", 1, {
        functionalOutcome: "INCOMPLETE",
        failureReason: "first_target_abandoned_after_navigation",
      }),
    ],
  };
  const environmentEvidence = {
    planRevision: "plan1-final-v3",
    stageId: "4.5-4.6",
    status: "COMPLETE",
    outcome: "ENVIRONMENT_OBSERVATIONS_CAPTURED",
    runId: "environment-run",
    stageLedger: stageLedger(["4.5", "4.6"]),
    blockers: [],
    evidenceIntegrity: {
      redactionCheck: "PASS",
      historicalPhase4EvidenceRewritten: false,
      officialMeasurementStarted: false,
      runtimeFixAccepted: false,
    },
    environmentSummary: {
      hosted: { status: "COMPLETE" },
      android_chrome: { status: "COMPLETE" },
      android_pwa: { status: "COMPLETE" },
    },
    samples: [
      sample("hosted", "J1", 1),
      sample("android_chrome", "J2", 1, {
        functionalOutcome: "FAILURE",
        failureReason: "j2_preloaded_inbox_read_not_linked_to_data_ready",
      }),
      sample("android_pwa", "J3", 1),
    ],
  };
  const findingManifest = {
    findings: PHASE_4_7_FINDING_IDS.map((id) => ({
      id,
      severity: "medium",
      phase1Status: id === "PERF-F12-001"
        ? "MEASUREMENT_GAP_CONFIRMED"
        : "PENDING_VALID_AUTHENTICATED_REPRODUCTION",
    })),
  };
  return { localEvidence, environmentEvidence, findingManifest };
}

test("maps every compatible local and environment observation to a locked finding", () => {
  const inputs = makeInputs();
  const observations = mapPhase47Observations(inputs);
  assert.equal(observations.length, 6);
  assert.ok(observations.every((observation) => PHASE_4_7_FINDING_IDS.includes(observation.findingId)));
  assert.deepEqual(
    observations.map((observation) => observation.findingId),
    ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003", "PERF-F2-001", "PERF-F2-002", "PERF-F2-003"],
  );
});

test("reconciliation keeps functional failures separate and blocks only diagnosis", () => {
  const inputs = makeInputs();
  const result = reconcilePhase47Inputs({
    ...inputs,
    sourceIdentity: { head: "test-head", diffCheck: "PASS", sourceFiles: [] },
    inputPaths: ["local.json", "environment.json", "FINDING_MANIFEST.json"],
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.outcome, "DIAGNOSIS_BLOCKED");
  assert.equal(result.summary.attemptedCount, 6);
  assert.equal(result.summary.observationValidCount, 6);
  assert.equal(result.summary.validFunctionalSampleCount, 4);
  assert.equal(result.summary.functionalOutcomes.FAILURE, 1);
  assert.equal(result.commonLayerDelay.status, "NOT_ESTABLISHED");
  assert.equal(result.commonLayerDelay.timingBoundaryKnown, false);
  assert.equal(result.findingReconciliation.find((item) => item.findingId === "PERF-F12-001").currentStatus, "NOT_EXERCISED_IN_CURRENT_JOURNEYS");
});

test("an unmapped observation blocks 4.7 instead of silently dropping it", () => {
  const inputs = makeInputs();
  inputs.localEvidence.samples.push(sample(null, "UNKNOWN", 1));
  const result = reconcilePhase47Inputs({
    ...inputs,
    sourceIdentity: { head: "test-head", diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.outcome, "PHASE_4_7_RECONCILIATION_BLOCKED");
  assert.equal(result.checks.find((checkResult) => checkResult.id === "observation_mapping").status, "FAIL");
});

test("a blocked incompatible retry is retained outside valid counts", () => {
  const inputs = makeInputs();
  const result = reconcilePhase47Inputs({
    ...inputs,
    blockedEnvironmentEvidence: {
      runId: "blocked-retry",
      status: "BLOCKED",
      outcome: "ENVIRONMENT_OBSERVATIONS_BLOCKED",
    },
    sourceIdentity: { head: "test-head", diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.blockedRetry.excludedFromCurrentCounts, true);
  assert.equal(result.summary.attemptedCount, 6);
});

test("evidence remains redacted, non-official, and path-safe", () => {
  const inputs = makeInputs();
  const evidence = buildPhase47Evidence({
    ...inputs,
    sourceIdentity: { head: "test-head", diffCheck: "PASS", sourceFiles: [] },
    inputPaths: ["local.json", "environment.json", "FINDING_MANIFEST.json"],
    checkpoint: { runId: "phase47-test-run", status: "COMPLETE", hashChainRead: true },
    generatedAt: "2026-09-17T00:00:00.000Z",
  });
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "DIAGNOSIS_BLOCKED");
  assert.equal(evidence.evidenceIntegrity.status, "PASS");
  assert.equal(evidence.evidenceIntegrity.redactionCheck, "PASS");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
  assert.equal(evidence.executionScope.runtimeChangeAcceptedAsFix, false);
  assert.equal(evidence.findingReconciliation.length, 5);
  assert.throws(() => phase47V3EvidencePath("../escape"), /phase47_run_id_invalid/);
});
