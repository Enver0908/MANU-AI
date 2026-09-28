import assert from "node:assert/strict";
import test from "node:test";
import {
  SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS,
  SHARED_RUNTIME_NORMAL_REPETITIONS,
  SHARED_RUNTIME_PHASE_ID,
  buildSharedRuntimeEvidence,
  completedMeasurementResults,
  chooseDiagnosticJourney,
  secondActionResponseMs,
} from "./performance-plan-1-shared-runtime-diagnostic.mjs";

function validObservation(journeyId, tailMs) {
  return {
    journeyId,
    observationValidity: "VALID",
    validSample: true,
    functionalOutcome: "SUCCESS",
    trace: {
      secondActionAnchor: { trustedEventAtMs: 1_000 },
      actions: { second: { trustedEventAtMs: 1_000, readyStateAtMs: 1_000 + tailMs } },
    },
  };
}

test("candidate selection chooses the valid journey with the longest second-action tail", () => {
  const selection = chooseDiagnosticJourney([
    validObservation("J1", 420),
    validObservation("J2", 1_240),
    validObservation("J3", 880),
    { ...validObservation("J2", 9_999), observationValidity: "INCOMPLETE" },
  ]);
  assert.equal(selection.status, "PASS");
  assert.equal(selection.journeyId, "J2");
  assert.equal(selection.observedTailMs, 1_240);
  assert.deepEqual(selection.candidates.map((candidate) => candidate.journeyId), ["J2", "J3", "J1"]);
});

test("candidate selection excludes valid observations that are not successful samples", () => {
  const selection = chooseDiagnosticJourney([
    validObservation("J1", 420),
    {
      ...validObservation("J3", 9_999),
      validSample: false,
      functionalOutcome: "INCOMPLETE",
    },
  ]);
  assert.equal(selection.status, "PASS");
  assert.equal(selection.journeyId, "J1");
  assert.deepEqual(selection.candidates.map((candidate) => candidate.journeyId), ["J1"]);
});

test("second-action response excludes the fixed inter-action delay", () => {
  assert.equal(
    secondActionResponseMs({
      trace: {
        secondActionAnchor: { trustedEventAtMs: 2_000 },
        actions: { second: { trustedEventAtMs: 2_005, readyStateAtMs: 3_250 } },
      },
    }),
    1_245,
  );
});

test("resume restores only the latest durably completed unit", () => {
  const trace = {
    unitKey: "normal:J1:r1",
    mode: "normal",
    observationValidity: "VALID",
  };
  const events = [
    { sequence: 1, type: "measurement.unit.trace", payload: trace },
    { sequence: 2, type: "measurement.unit.completed", payload: { ...trace, status: "VALID" } },
    { sequence: 3, type: "measurement.unit.started", payload: { ...trace } },
  ];
  assert.deepEqual(completedMeasurementResults(events, "normal"), []);
  events.push(
    { sequence: 4, type: "measurement.unit.trace", payload: { ...trace, observationValidity: "VALID" } },
    { sequence: 5, type: "measurement.unit.completed", payload: { ...trace, status: "VALID" } },
  );
  assert.equal(completedMeasurementResults(events, "normal").length, 1);
});

test("evidence keeps the continuation outside the official baseline and records the non-claim", () => {
  const evidence = buildSharedRuntimeEvidence({
    runId: "shared-runtime-test",
    status: "COMPLETE",
    outcome: "SHARED_RUNTIME_DIAGNOSTIC_RECORDED",
    sourceIdentity: { head: "test-head", diffCheck: "PASS" },
    normalResults: [validObservation("J1", 420)],
    diagnosticResults: [validObservation("J1", 500)],
    selection: { status: "PASS", journeyId: "J1", observedTailMs: 420 },
    preflight: { status: "PASS", blockers: [] },
    stageStatuses: {
      "SRD.1": "PASS",
      "SRD.2": "COMPLETE",
      "SRD.3": "COMPLETE",
      "SRD.4": "COMPLETE",
    },
  }, { generatedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(evidence.stageId, SHARED_RUNTIME_PHASE_ID);
  assert.equal(evidence.executionScope.countedAsOfficialSample, false);
  assert.equal(evidence.measurementIdentity.countedAsOfficialSample, false);
  assert.equal(evidence.sampleSummary.officialBaselineSamples, 0);
  assert.equal(evidence.measurementIdentity.normalRepetitions, SHARED_RUNTIME_NORMAL_REPETITIONS);
  assert.equal(evidence.measurementIdentity.diagnosticRepetitions, SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS);
  assert.ok(evidence.explicitNonClaims.some((claim) => claim.includes("No root cause")));
  assert.equal(evidence.productionDecision, "NO-GO");
});
