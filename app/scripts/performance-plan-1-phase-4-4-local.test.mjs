import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_REQUIRED_TIMING_FIELDS,
  shellNavSelector,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  PHASE_4_4_CHECKPOINT_PHASE_ID,
  PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
  PHASE_4_4_EXECUTION_MODES,
  PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES,
  PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES,
  PHASE_4_4_REQUIRED_CAPTURE_FIELDS,
  PHASE_4_4_REPETITION_COUNT,
  buildPhase44ServerEnvironment,
  buildPhase44Evidence,
  checkPhase44LocalInputs,
  classifyPhase44Observation,
  deriveFailureBoundary,
  evaluatePhase44J2PreloadedRead,
  isValidPhase44Sample,
  normalizeBrowserRouteEvents,
  normalizeBrowserTrustedEvents,
  parseServerTimingHeader,
  phase44CheckpointIdentity,
  phase44ExecutionUnits,
  readPhase44CaptureProbeEvidence,
  phase44MeasurementUnits,
  phase44StageStatuses,
  phase44TargetedCaptureUnits,
  phase44UnitKey,
  phase44V3EvidencePath,
  sanitizePhase44Evidence,
  sanitizeRequestFailureReason,
  summarizePhase44UnitEvents,
  validatePhase44TraceForJourney,
  verifyPhase44CaptureContract,
} from "./performance-plan-1-phase-4-4-local.mjs";

test("request failure reasons stay bounded and payload-free", () => {
  assert.equal(sanitizeRequestFailureReason("net::ERR_ABORTED"), "net::ERR_ABORTED");
  assert.equal(sanitizeRequestFailureReason("net::ERR_CONNECTION_RESET"), "net::ERR_CONNECTION_RESET");
  assert.equal(sanitizeRequestFailureReason("https://example.invalid/private?token=value"), "request_failed");
  assert.equal(sanitizeRequestFailureReason(null), "request_failed_unknown");
});

test("route history capture is relative, sanitized, and identifier-free", () => {
  const routes = normalizeBrowserRouteEvents([
    {
      atWallMs: 1_250,
      route: "/dashboard?section=clients&clientTask=forms&clientId=client-secret",
      source: "pushState",
    },
  ], 1_000);
  assert.deepEqual(routes, [{
    atMs: 250,
    route: "/dashboard?section=clients&clientTask=forms&clientId=%3Cpresent%3E",
    source: "pushState",
  }]);
});

test("trusted click capture keeps only bounded target metadata", () => {
  const clicks = normalizeBrowserTrustedEvents([
    {
      atWallMs: 1_075,
      testId: "dashboard-client-task-forms",
      href: "/dashboard?section=clients&clientTask=forms&clientId=client-secret",
    },
  ], 1_000);
  assert.deepEqual(clicks, [{
    atMs: 75,
    testId: "dashboard-client-task-forms",
    href: "/dashboard?section=clients&clientTask=forms&clientId=%3Cpresent%3E",
  }]);
});

test("Phase 4.4 identity is separate from Phase 4.3 and bound to the local fixture", () => {
  const identity = phase44CheckpointIdentity({
    sourceHead: "a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a",
    sourceVariant: "current",
    referenceSnapshotId: "phase4-3-reference-snapshot-20260916T194917770Z",
  });
  assert.equal(identity.phase, "4.4");
  assert.equal(identity.checkpointPhaseId, PHASE_4_4_CHECKPOINT_PHASE_ID);
  assert.equal(identity.checkpointSchemaVersion, PHASE_4_4_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(identity.fixtureId, "local-normal");
  assert.equal(identity.countedAsOfficialSample, false);
  assert.notEqual(identity.checkpointPhaseId, "aiya-performance-plan1-phase4-diagnostic");
  assert.equal(identity.serverControl, "managed_same_port_per_mode");
  assert.ok(identity.harnessSourceIdentity.some((entry) => entry.path.endsWith("phase-4-4-local.mjs")));
});

test("invalid completed units never promote a checkpoint to COMPLETE", () => {
  const planned = phase44MeasurementUnits().slice(0, 2);
  const events = planned.map((unit, index) => ({
    type: "measurement.unit.completed",
    payload: {
      unitKey: unit.unitKey,
      validSample: index === 0,
    },
  }));
  const summary = summarizePhase44UnitEvents(events, planned);
  assert.equal(summary.attemptedCount, 2);
  assert.equal(summary.validCount, 1);
  assert.equal(summary.invalidCount, 1);
  assert.equal(summary.status, "BLOCKED");
});

test("normal and diagnostic server environments are explicit and distinct", () => {
  const baseEnvironment = { MANU_DEV_FALLBACK_STORE: "true" };
  const localStatus = {
    apiUrl: "http://127.0.0.1:54321",
    anonKey: "local-anon-key",
    serviceRoleKey: "local-service-role-key",
  };
  const normal = buildPhase44ServerEnvironment(baseEnvironment, "normal", {
    baseUrl: "http://127.0.0.1:3136",
    localStatus,
  });
  const diagnostic = buildPhase44ServerEnvironment(baseEnvironment, "diagnostic", {
    baseUrl: "http://127.0.0.1:3136",
    localStatus,
  });
  assert.equal(normal.AIYA_PERF_DIAGNOSTIC, "0");
  assert.equal(diagnostic.AIYA_PERF_DIAGNOSTIC, "1");
  assert.equal(normal.MANU_DEV_FALLBACK_STORE, "false");
  assert.equal(diagnostic.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.notEqual(normal.AIYA_PERF_DIAGNOSTIC, diagnostic.AIYA_PERF_DIAGNOSTIC);
});

test("J2 follows the real preloaded inbox path without inventing a detail click", () => {
  const j2 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J2");
  assert.deepEqual(j2?.requiredReads, []);
  assert.deepEqual(PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES, ["/api/shell/preferences"]);
  assert.deepEqual(PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES, ["/api/session/activity"]);
});

test("J2 requires a completed authenticated inbox read linked before messaging readiness", () => {
  const j2 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J2");
  const trace = {
    startedAtWallMs: 1_000,
    actions: { second: { readyStateAtMs: 800 } },
  };
  const pass = evaluatePhase44J2PreloadedRead({
    journey: j2,
    trace,
    auth: { status: "PASS" },
    requestSummary: {
      captureStartedAtWallMs: 0,
      requests: [{
        route: "/api/conversations",
        method: "GET",
        status: 200,
        bodyFinishedAtMs: 1_500,
        failed: false,
      }],
    },
  });
  assert.equal(pass.status, "PASS");
  assert.equal(pass.loadedBeforeSecondAction, true);
  assert.deepEqual(pass.linkedTo, ["authenticated_dashboard_load", "messaging_panel_data_ready"]);

  const missing = evaluatePhase44J2PreloadedRead({
    journey: j2,
    trace,
    auth: { status: "PASS" },
    requestSummary: { captureStartedAtWallMs: 0, requests: [] },
  });
  assert.equal(missing.status, "FAIL");
  assert.equal(missing.valid, false);
});

test("responsive shell navigation selectors only target visible layout copies", () => {
  const selector = shellNavSelector("/dashboard?section=clients");
  assert.equal(selector.split(", ").length, 3);
  assert.ok(selector.split(", ").every((part) => part.endsWith(":visible")));
});

test("the contract creates exactly eighteen ordered diagnostic units", () => {
  const units = phase44MeasurementUnits();
  assert.equal(PHASE_4_3_JOURNEYS.length, 3);
  assert.equal(PHASE_4_4_REPETITION_COUNT, 3);
  assert.equal(units.length, 18);
  assert.deepEqual(units.slice(0, 3).map((unit) => unit.unitKey), [
    "normal:J1:r1",
    "normal:J1:r2",
    "normal:J1:r3",
  ]);
  assert.deepEqual(units.slice(-3).map((unit) => unit.unitKey), [
    "diagnostic:J3:r1",
    "diagnostic:J3:r2",
    "diagnostic:J3:r3",
  ]);
  assert.equal(phase44UnitKey({ mode: "normal", journeyId: "J2", repetition: 2 }), "normal:J2:r2");
  assert.ok(units.every((unit) => unit.countedAsOfficialSample === false));
});

test("v3 starts with one J1 capture probe and keeps expansion separate", () => {
  const probe = phase44TargetedCaptureUnits();
  assert.equal(probe.length, 1);
  assert.equal(probe[0].unitKey, "probe:normal:J1:r1");
  assert.deepEqual(phase44ExecutionUnits(PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe), probe);
  assert.equal(phase44ExecutionUnits(PHASE_4_4_EXECUTION_MODES.localNormalObservations).length, 9);
  assert.throws(() => phase44V3EvidencePath("../unsafe"), /run_id_invalid/);
  assert.match(phase44V3EvidencePath("probe-run-1"), /AIYA_PERFORMANCE_PLAN_1_V3_probe-run-1_EVIDENCE\.json$/);
});

test("diagnostic expansion accepts only a complete current v3 capture probe", () => {
  const probePath = new URL(
    "../../docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T073613059Z-e2c3495a-ed74-4eb5-9982-f842efe3c1b8_EVIDENCE.json",
    import.meta.url,
  );
  const probe = readPhase44CaptureProbeEvidence(fileURLToPath(probePath));
  assert.equal(probe.length, 1);
  assert.equal(probe[0].unitKey, "probe:normal:J1:r1");
  assert.equal(probe[0].observationValidity, "VALID");
  assert.deepEqual(readPhase44CaptureProbeEvidence("missing-probe.json"), []);
});

test("capture verification covers the v3 boundary controls", () => {
  const verification = verifyPhase44CaptureContract();
  assert.equal(verification.status, "PASS");
  assert.equal(verification.checks.timerAnchoredToTrustedClick, true);
  assert.equal(verification.checks.visibleSelectors, true);
  assert.equal(verification.checks.navigationAwayIsRepresentable, true);
  assert.equal(verification.checks.slowResponseObservationBounded, true);
  assert.equal(verification.checks.genuineTargetFailureIsObservable, true);
});

test("the capture contract covers layer boundaries without raw response bodies", () => {
  assert.deepEqual(PHASE_4_4_REQUIRED_CAPTURE_FIELDS, [
    "overlappingRequests",
    "requestCount",
    "requestStatus",
    "bodySizeBytes",
    "authSessionTiming",
    "serverStoreTiming",
    "browserParseRenderTiming",
    "longTasks",
    "failureBoundary",
    "observationValidity",
    "functionalOutcome",
    "performanceOutcome",
  ]);
  assert.equal(PHASE_4_3_REQUIRED_TIMING_FIELDS.length, 10);
  const sanitized = sanitizePhase44Evidence({
    bodySizeBytes: 1234,
    responseBodyFinishedAtMs: 22,
    rawBody: "private response",
    password: "private password",
  });
  assert.equal(sanitized.bodySizeBytes, 1234);
  assert.equal(sanitized.responseBodyFinishedAtMs, 22);
  assert.equal(sanitized.rawBody, "<redacted>");
  assert.equal(sanitized.password, "<redacted>");
});

test("Server-Timing parsing keeps only safe metric names and durations", () => {
  assert.deepEqual(parseServerTimingHeader("store;dur=4.5, shell_auth;dur=2"), [
    { name: "store", durationMs: 4.5 },
    { name: "shell_auth", durationMs: 2 },
  ]);
  assert.deepEqual(parseServerTimingHeader("bad metric;dur=1, valid-name"), [
    { name: "valid-name", durationMs: null },
  ]);
});

test("failure boundaries distinguish auth, second action, required reads, and route validation", () => {
  assert.equal(deriveFailureBoundary({ auth: { status: "FAIL", failureBoundary: "auth_session" } }).phase, "auth_session");
  assert.equal(deriveFailureBoundary({
    auth: { status: "PASS" },
    trace: { actions: { first: { readyStateAtMs: 4 }, second: { secondActionAccepted: false, failureClass: "missing_click_or_not_ready" } } },
  }).phase, "second_action");
  assert.equal(deriveFailureBoundary({
    auth: { status: "PASS" },
    trace: { actions: { first: { readyStateAtMs: 4 }, second: { secondActionAccepted: true, parseRenderCompletedAtMs: 7, readyStateAtMs: 8 } } },
    requiredReads: [{ actionId: "second", pattern: "/api/x", valid: false }],
    expectedRouteMatched: true,
  }).phase, "required_read");
  assert.equal(deriveFailureBoundary({
    auth: { status: "PASS" },
    trace: { actions: { first: { readyStateAtMs: 4 }, second: { secondActionAccepted: true, parseRenderCompletedAtMs: 7, readyStateAtMs: 8 } } },
    requiredReads: [],
    expectedRouteMatched: false,
  }).phase, "route_validation");
});

test("sample validity never promotes incomplete or failed traces", () => {
  const base = {
    auth: { status: "PASS" },
    trace: {
      status: "COMPLETE",
      validation: { status: "PASS", completenessStatus: "COMPLETE" },
      failures: [],
      actions: {
        first: { functionalOutcome: "SUCCESS" },
        second: { functionalOutcome: "SUCCESS", secondActionAccepted: true },
      },
    },
    requiredReads: [],
    expectedRouteMatched: true,
    mutationRequests: [],
  };
  assert.equal(isValidPhase44Sample(base), true);
  assert.equal(isValidPhase44Sample({ ...base, trace: { ...base.trace, status: "INCOMPLETE" } }), false);
  assert.equal(isValidPhase44Sample({ ...base, trace: { ...base.trace, failures: [{ failureClass: "timeout" }] } }), false);
  assert.equal(isValidPhase44Sample({ ...base, mutationRequests: [{ method: "POST" }] }), false);
  assert.equal(isValidPhase44Sample({
    ...base,
    expectedMutationRequests: [{ status: 204, bodyFinishedAtMs: 2, failed: false }],
  }), true);
  assert.equal(isValidPhase44Sample({
    ...base,
    expectedMutationRequests: [{ status: 409, bodyFinishedAtMs: 2, failed: false }],
  }), false);
});

test("J3 may omit required-read timing only because it has no required reads", () => {
  const j3 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J3");
  const trace = {
    status: "INCOMPLETE",
    validation: {
      status: "PASS",
      completenessStatus: "INCOMPLETE",
      missingTimingFields: [
        "requiredRequestStartAtMs",
        "responseHeaderAtMs",
        "responseBodyFinishedAtMs",
      ],
    },
    failures: [],
    actions: {
      first: { functionalOutcome: "SUCCESS" },
      second: { functionalOutcome: "SUCCESS", secondActionAccepted: true },
    },
  };
  const validation = validatePhase44TraceForJourney(trace, j3);
  assert.equal(validation.completenessStatus, "COMPLETE");
  assert.deepEqual(validation.toleratedMissingTimingFields, [
    "requiredRequestStartAtMs",
    "responseHeaderAtMs",
    "responseBodyFinishedAtMs",
  ]);
  assert.equal(isValidPhase44Sample({
    auth: { status: "PASS" },
    trace,
    journey: j3,
    requiredReads: [],
    expectedRouteMatched: true,
    mutationRequests: [],
  }), true);
});

test("a reliably observed target failure is valid evidence but never a successful sample", () => {
  const j1 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J1");
  const observation = classifyPhase44Observation({
    auth: { status: "PASS" },
    journey: j1,
    trace: {
      validation: {
        status: "PASS",
        completenessStatus: "INCOMPLETE",
        missingTimingFields: ["readyStateAtMs"],
      },
      failures: [{ actionId: "second", failureClass: "missing_click_or_not_ready" }],
      actions: {
        first: { functionalOutcome: "SUCCESS" },
        second: {
          functionalOutcome: "FAILURE",
          secondActionAccepted: true,
          failureClass: "missing_click_or_not_ready",
        },
      },
      requiredRequests: [],
    },
    expectedRouteMatched: true,
    requiredReads: [],
    mutationRequests: [],
  });
  assert.equal(observation.observationValidity, "VALID");
  assert.equal(observation.functionalOutcome, "FAILURE");
  assert.equal(observation.performanceOutcome, "NOT_EVALUABLE");
});

test("stage scheduler never promotes normal or reconciliation stages from diagnostic evidence", () => {
  const probeResult = [{ unitKey: "probe:normal:J1:r1", observationValidity: "VALID" }];
  const diagnosticResults = phase44MeasurementUnits({ modes: ["diagnostic"] }).map((unit) => ({
    unitKey: unit.unitKey,
    observationValidity: "VALID",
  }));
  const beforeNormal = phase44StageStatuses({
    preflightStatus: "PASS",
    probeResults: probeResult,
    diagnosticResults,
  });
  assert.equal(beforeNormal["4.4.2"], "PASS");
  assert.equal(beforeNormal["4.4.3"], "NOT_STARTED");
  assert.equal(beforeNormal["4.4.4"], "NOT_STARTED");

  const normalResults = phase44MeasurementUnits({ modes: ["normal"] }).map((unit) => ({
    unitKey: unit.unitKey,
    observationValidity: "VALID",
  }));
  const afterNormal = phase44StageStatuses({
    preflightStatus: "PASS",
    probeResults: probeResult,
    normalResults,
    diagnosticResults,
  });
  assert.equal(afterNormal["4.4.3"], "COMPLETE");
  assert.equal(afterNormal["4.4.4"], "NOT_STARTED");
});

test("evidence builder keeps blocked preflight explicit and non-official", () => {
  const evidence = buildPhase44Evidence({
    status: "BLOCKED",
    outcome: "LOCAL_INPUT_BLOCKED",
    runId: "aiya-performance-plan1-phase4-4-local-test",
    preflight: {
      status: "BLOCKED",
      fixtureId: "local-normal",
      blockers: ["local_app_unreachable_or_not_ready"],
    },
    results: [],
  }, {
    generatedAt: "2026-09-16T20:00:00.000Z",
    sourceIdentity: { head: "a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a" },
  });
  assert.equal(evidence.status, "BLOCKED");
  assert.equal(evidence.outcome, "LOCAL_INPUT_BLOCKED");
  assert.equal(evidence.executionScope.officialMeasurementStarted, false);
  assert.equal(evidence.sampleSummary.attemptedSamples, 0);
  assert.equal(evidence.measurementIdentity.countedAsOfficialSample, false);
  assert.equal(evidence.historicalPhase4EvidenceRewritten, undefined);
  assert.equal(evidence.constraints.includes("No official nine-scenario baseline was started."), true);
});

test("evidence builder keeps invalid measurement samples as an explicit blocker", () => {
  const evidence = buildPhase44Evidence({
    status: "BLOCKED",
    outcome: "LOCAL_INVALID_SAMPLES",
    runId: "aiya-performance-plan1-phase4-4-local-invalid-test",
    preflight: { status: "PASS", blockers: [] },
    results: [
      { mode: "normal", validSample: false },
    ],
  }, {
    generatedAt: "2026-09-16T23:00:00.000Z",
    sourceIdentity: { head: "a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a" },
  });
  assert.deepEqual(evidence.blockers, ["invalid_measurement_samples"]);
});

test("local preflight has no synthetic fallback opt-in", async () => {
  const result = await checkPhase44LocalInputs("http://127.0.0.1:1");
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.fallbackStoreAllowed, false);
  assert.equal(result.authentication, "real_password_session_required");
  assert.deepEqual(result.credentialsAvailable, { email: false, password: false });
  assert.ok(result.blockers.includes("synthetic_password_unavailable"));
  assert.ok(result.blockers.length >= 1);
});
