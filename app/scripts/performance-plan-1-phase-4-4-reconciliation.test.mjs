import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReconciledPhase44Evidence,
  reconcilePhase44Observations,
} from "./performance-plan-1-phase-4-4-reconciliation.mjs";
import {
  PHASE_4_3_JOURNEYS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";

function makeSample(journeyId, repetition, { probe = false, abandoned = false } = {}) {
  const journey = PHASE_4_3_JOURNEYS.find((candidate) => candidate.journeyId === journeyId);
  const firstOutcome = abandoned ? "ABANDONED" : "SUCCESS";
  const functionalOutcome = abandoned ? "INCOMPLETE" : "SUCCESS";
  const firstTrustedAtMs = 100;
  const trace = {
    schemaVersion: "aiya-performance-plan1-phase4-diagnostic-v3",
    status: "COMPLETE",
    failures: [],
    actions: {
      first: {
        plannedActionAtMs: 0,
        dispatchAtMs: 10,
        trustedEventAtMs: firstTrustedAtMs,
        routeCommittedAtMs: 101,
        functionalOutcome: firstOutcome,
        targetUnmounted: abandoned,
      },
      second: {
        plannedActionAtMs: firstTrustedAtMs + 2_000,
        dispatchAtMs: 2_110,
        trustedEventAtMs: 2_200,
        routeCommittedAtMs: 2_201,
        secondActionAccepted: true,
        functionalOutcome: "SUCCESS",
        targetReadyStatus: "READY",
        readyStateAtMs: 2_300,
        parseRenderCompletedAtMs: 2_301,
      },
    },
    secondActionAnchor: {
      status: "RESOLVED",
      actionId: journey.secondActionAnchor.actionId,
      stepLabel: journey.secondActionAnchor.stepLabel,
      trustedEventAtMs: firstTrustedAtMs,
    },
    validation: {
      status: "PASS",
      failures: [],
      completenessStatus: "COMPLETE",
      missingTimingFields: [],
    },
    events: [
      { type: "action.planned" },
      { type: "action.dispatch" },
      { type: "trusted.event" },
      { type: "route.committed" },
    ],
    measurement: {
      fixtureId: "local-normal",
      expectedRouteMatched: true,
      requiredReads: (journey.requiredReads ?? []).map((required) => ({
        ...required,
        valid: true,
      })),
      j2DataReady: journeyId === "J2"
        ? {
            status: "PASS",
            valid: true,
            route: "/api/conversations",
            loadedBeforeSecondAction: true,
            linkedTo: ["authenticated_dashboard_load", "messaging_panel_data_ready"],
          }
        : {
            status: "NOT_APPLICABLE",
            valid: true,
            route: "/api/conversations",
            linkedTo: [],
          },
      mutationRequests: [],
      expectedMutationRequests: [],
      requestSummary: {
        captureStartedAtWallMs: 0,
        bodyFinishTimedOut: false,
        requests: [{
          route: "/api/synthetic-read",
          method: "GET",
          resourceType: "fetch",
          startedAtMs: 0,
          responseHeaderAtMs: 1,
          bodyFinishedAtMs: 2,
          status: 200,
          failed: false,
        }],
      },
      foregroundBodyFinishTimedOut: false,
    },
  };
  return {
    unitKey: probe ? `probe:normal:${journeyId}:r${repetition}` : `normal:${journeyId}:r${repetition}`,
    mode: "normal",
    journeyId,
    repetition,
    scope: probe ? "targeted_capture_probe" : "local_normal_observations",
    status: abandoned ? "INVALID" : "VALID",
    validSample: !abandoned,
    observationValidity: "VALID",
    functionalOutcome,
    performanceOutcome: "NOT_EVALUABLE",
    auth: { status: "PASS" },
    trace,
    failureBoundary: abandoned
      ? {
          phase: "first_action",
          actionId: "first",
          reason: "first_target_abandoned_after_navigation",
        }
      : { phase: "none", actionId: null, reason: null },
    countedAsOfficialSample: false,
  };
}

function makeEvidence(samples, executionMode) {
  return {
    schemaVersion: "aiya-performance-plan1-v3-phase4-4-evidence-v1",
    planRevision: "plan1-final-v3",
    stageId: "4.4",
    executionScope: {
      executionMode,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
    },
    measurementIdentity: {
      fixtureId: "local-normal",
      secondActionDelayMs: 2_000,
    },
    evidenceIntegrity: {
      historicalPhase4EvidenceRewritten: false,
    },
    stageLedger: [
      { stageId: "4.4.1", status: "PASS" },
      { stageId: "4.4.2", status: "PASS" },
      { stageId: "4.4.3", status: executionMode === "local_normal_observations" ? "COMPLETE" : "NOT_STARTED" },
      { stageId: "4.4.4", status: "NOT_STARTED" },
    ],
    activeContract: { nextEligibleStage: "4.4" },
    closure: { status: "IN_PROGRESS", phase4Closed: false, plan1Closed: false },
    samples,
  };
}

function makeFixture() {
  const normalSamples = [
    ...[1, 2, 3].map((repetition) => makeSample("J1", repetition)),
    ...[1, 2, 3].map((repetition) => makeSample("J2", repetition)),
    ...[1, 2, 3].map((repetition) => makeSample("J3", repetition, { abandoned: true })),
  ];
  const probeSample = makeSample("J1", 1, { probe: true });
  return {
    normalEvidence: makeEvidence(normalSamples, "local_normal_observations"),
    probeEvidence: makeEvidence([probeSample], "targeted_capture_probe"),
  };
}

test("Phase 4.4.4 reconciles complete normal coverage and repeated J3 abandonment", () => {
  const fixture = makeFixture();
  const result = reconcilePhase44Observations(fixture);

  assert.equal(result.status, "PASS");
  assert.equal(result.outcome, "TRACE_INTEGRITY_RECONCILED");
  assert.equal(result.stageStatuses["4.4.4"], "COMPLETE");
  assert.equal(result.sampleResults.length, 9);
  assert.equal(result.sampleResults.filter((sample) => sample.status === "PASS").length, 9);
  assert.deepEqual(result.requestLifecycle, { COMPLETED: 9 });
  assert.equal(result.checks.find((check) => check.id === "j3_repeated_failure_boundary").status, "PASS");
});

test("Phase 4.4.4 blocks a changed failure boundary instead of promoting the trace", () => {
  const fixture = makeFixture();
  fixture.normalEvidence.samples[6].failureBoundary.reason = "invented_root_cause";
  const result = reconcilePhase44Observations(fixture);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.stageStatuses["4.4.4"], "BLOCKED");
  assert.ok(result.checks.some((check) =>
    check.id === "trace:normal:J3:r1" && check.status === "FAIL",
  ));
});

test("reconciled evidence keeps Plan 1 open and records the completed 4.4.4 stage", () => {
  const fixture = makeFixture();
  const reconciliation = reconcilePhase44Observations(fixture);
  const evidence = buildReconciledPhase44Evidence({
    normalEvidence: fixture.normalEvidence,
    probeEvidence: fixture.probeEvidence,
    reconciliation,
    checkpoint: { status: "COMPLETE", hashChainRead: true },
  });

  assert.equal(evidence.outcome, "LOCAL_OBSERVATIONS_RECONCILED");
  assert.equal(evidence.stageLedger.find((stage) => stage.stageId === "4.4.4").status, "COMPLETE");
  assert.equal(evidence.closure.phase4Closed, false);
  assert.equal(evidence.activeContract.nextEligibleStage, "4.5");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
});
