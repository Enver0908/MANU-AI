import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PHASE_4_3_CHECKPOINT_PHASE_ID,
  PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
  PHASE_4_3_CONTROL_VARIANTS,
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_MODES,
  PHASE_4_3_PHASE_DEFINITION,
  PHASE_4_3_REQUIRED_TIMING_FIELDS,
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
  PHASE_4_3_TRACE_VARIANTS,
  addDiagnosticFailure,
  classifyPreferenceIntentBody,
  createDiagnosticTrace,
  phase43CheckpointIdentity,
  recordDiagnosticTiming,
  routeMatchesExpectedRoute,
  sanitizeDiagnosticEvidence,
  sanitizeRoute,
  validateDiagnosticTrace,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  createPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  assertPhaseDefinition,
  validatePhaseDefinition,
} from "../../tools/phase-execution/phase-runner.mjs";

test("Phase 4.3 descriptor has ordered stages and exactly three journeys", () => {
  assert.doesNotThrow(() => assertPhaseDefinition(PHASE_4_3_PHASE_DEFINITION));
  assert.deepEqual(
    PHASE_4_3_PHASE_DEFINITION.stages.map((stage) => stage.stageId),
    ["4.3.1", "4.3.2", "4.3.3"],
  );
  assert.equal(PHASE_4_3_JOURNEYS.length, 3);
  assert.deepEqual(
    PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
    ["J1", "J2", "J3"],
  );
  assert.equal(validatePhaseDefinition(PHASE_4_3_PHASE_DEFINITION).status, "PASS");
});

test("normal and diagnostic modes remain distinct", () => {
  assert.equal(PHASE_4_3_MODES.normal.profiler, "off");
  assert.equal(PHASE_4_3_MODES.normal.browserObservers, "off");
  assert.equal(PHASE_4_3_MODES.normal.serverTiming, "off");
  assert.equal(PHASE_4_3_MODES.diagnostic.profiler, "on");
  assert.equal(PHASE_4_3_MODES.diagnostic.browserObservers, "on");
  assert.equal(PHASE_4_3_MODES.diagnostic.serverTiming, "on");
  assert.notDeepEqual(
    PHASE_4_3_MODES.normal.serverEnvironmentPatch,
    PHASE_4_3_MODES.diagnostic.serverEnvironmentPatch,
  );
});

test("single-variable control variant is explicit and trace-visible", () => {
  assert.equal(
    PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference,
    "await_active_client_preference",
  );
  assert.equal(
    PHASE_4_3_CONTROL_VARIANTS.awaitInitialSummaryNavigation,
    "await_initial_summary_navigation",
  );
  const trace = createDiagnosticTrace({
    journeyId: "J1",
    mode: "normal",
    controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference,
  });
  assert.equal(trace.controlVariant, "await_active_client_preference");
  assert.equal(createDiagnosticTrace({ journeyId: "J1", mode: "normal" }).controlVariant, null);
  assert.equal(
    sanitizeDiagnosticEvidence(trace).controlVariant,
    "await_active_client_preference",
  );
});

test("preference intent trace variant records only allowlisted body keys", () => {
  assert.equal(
    PHASE_4_3_TRACE_VARIANTS.preferenceIntentTimingAndCompletion,
    "preference_intent_timing_and_completion",
  );
  assert.deepEqual(
    classifyPreferenceIntentBody({
      activeClientId: "client-secret",
      unrelatedPrivateValue: "must-not-appear",
    }),
    {
      bodyShape: "object",
      intentKeys: ["activeClientId"],
      intentClass: "active_client",
    },
  );
  assert.deepEqual(
    classifyPreferenceIntentBody({ lastDestinationId: "destination-secret" }),
    {
      bodyShape: "object",
      intentKeys: ["lastDestinationId"],
      intentClass: "last_destination",
    },
  );
  assert.deepEqual(classifyPreferenceIntentBody(null), {
    bodyShape: "unavailable",
    intentKeys: [],
    intentClass: "unclassified",
  });
  const trace = createDiagnosticTrace({
    journeyId: "J1",
    mode: "normal",
    traceVariant: PHASE_4_3_TRACE_VARIANTS.preferenceIntentTimingAndCompletion,
  });
  assert.equal(trace.traceVariant, "preference_intent_timing_and_completion");
  assert.equal(
    JSON.stringify(trace).includes("client-secret"),
    false,
  );
});

test("journeys preserve fixed two-second dispatch and no-retry policy", () => {
  for (const journey of PHASE_4_3_JOURNEYS) {
    assert.equal(journey.secondActionDelayMs ?? PHASE_4_3_SECOND_ACTION_DELAY_MS, PHASE_4_3_SECOND_ACTION_DELAY_MS);
    assert.equal(journey.autoRetryMissingClick ?? false, false);
    assert.equal(journey.secondActionAnchor?.actionId, "first");
    assert.ok(journey.secondActionAnchor?.stepLabel);
    assert.ok(journey.firstAction.steps.some((step) => step.kind === "click"));
    assert.equal(journey.secondAction.click.kind, "click");
  }
  assert.deepEqual(PHASE_4_3_REQUIRED_TIMING_FIELDS, [
    "plannedActionAtMs",
    "dispatchAtMs",
    "trustedEventAtMs",
    "routeCommittedAtMs",
    "requiredRequestStartAtMs",
    "responseHeaderAtMs",
    "responseBodyFinishedAtMs",
    "parseRenderCompletedAtMs",
    "readyStateAtMs",
    "secondActionAccepted",
  ]);
});

test("J2 models the preloaded inbox list without requiring an untriggered detail read", () => {
  const j2 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J2");
  assert.deepEqual(j2?.requiredReads, []);
});

test("trace validation records incomplete or failed evidence without converting it to PASS", () => {
  const trace = createDiagnosticTrace({ journeyId: "J2", mode: "diagnostic", startedAtWallMs: 10_000 });
  recordDiagnosticTiming(trace, "first", "plannedActionAtMs", 0);
  trace.secondActionAnchor = {
    status: "RESOLVED",
    actionId: "first",
    stepLabel: "select_clients",
    trustedEventAtMs: 0,
  };
  recordDiagnosticTiming(trace, "second", "plannedActionAtMs", 2_000);
  recordDiagnosticTiming(trace, "second", "dispatchAtMs", 2_005);
  recordDiagnosticTiming(trace, "second", "secondActionAccepted", false);
  addDiagnosticFailure(trace, "second", "missing_click_or_not_ready", { selector: "<redacted>" });
  const result = validateDiagnosticTrace(trace);
  assert.equal(result.status, "PASS");
  assert.equal(result.completenessStatus, "INCOMPLETE");
  assert.ok(result.missingTimingFields.includes("readyStateAtMs"));
  assert.equal(trace.actions.second.secondActionAccepted, false);
  assert.equal(trace.actions.second.clickAttemptCount, 0);
});

test("trace validation rejects altered delay and click retry", () => {
  const trace = createDiagnosticTrace({ journeyId: "J1", mode: "normal" });
  trace.secondActionDelayMs = 1_000;
  trace.secondActionAnchor = {
    status: "RESOLVED",
    actionId: "first",
    stepLabel: "select_forms",
    trustedEventAtMs: 0,
  };
  trace.actions.second.plannedActionAtMs = 1_000;
  trace.actions.second.secondActionAccepted = true;
  trace.actions.second.clickAttemptCount = 2;
  const result = validateDiagnosticTrace(trace);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failures.includes("fixed_second_action_delay_invalid"));
  assert.ok(result.failures.includes("second_action_click_retried"));
});

test("a genuine first-action failure may be valid without inventing a second-action anchor", () => {
  const trace = createDiagnosticTrace({ journeyId: "J1", mode: "normal" });
  trace.secondActionAnchor = {
    status: "UNAVAILABLE",
    actionId: "first",
    stepLabel: "select_forms",
    trustedEventAtMs: null,
  };
  trace.actions.first.functionalOutcome = "FAILURE";
  addDiagnosticFailure(trace, "first", "missing_click_or_not_ready");
  recordDiagnosticTiming(trace, "second", "secondActionAccepted", false);
  const result = validateDiagnosticTrace(trace);
  assert.equal(result.status, "PASS");
  assert.equal(result.completenessStatus, "COMPLETE");
  assert.equal(trace.actions.second.plannedActionAtMs, null);
});

test("route and evidence sanitizers preserve route shape without identifiers or secrets", () => {
  assert.equal(
    sanitizeRoute("https://example.invalid/dashboard?section=clients&clientId=client-1&clientTask=nutrition&token=secret"),
    "/dashboard?section=clients&clientTask=nutrition&clientId=%3Cpresent%3E",
  );
  assert.equal(
    routeMatchesExpectedRoute("/dashboard?section=clients&clientId=client-1&clientTask=nutrition", {
      pathname: "/dashboard",
      query: { section: "clients", clientId: "present", clientTask: "nutrition" },
    }),
    true,
  );
  const sanitized = sanitizeDiagnosticEvidence({ email: "owner@example.invalid", password: "secret", route: "/dashboard?clientId=x" });
  assert.equal(sanitized.email, "<redacted>");
  assert.equal(sanitized.password, "<redacted>");
  assert.equal(sanitized.route, "/dashboard?clientId=%3Cpresent%3E");
});

test("checkpoint integration uses a separate Phase 4.3 identity and redacted payload", () => {
  const root = mkdtempSync(join(tmpdir(), "manu-ai-phase43-"));
  let checkpoint;
  try {
    checkpoint = createPhaseRun({
      root,
      phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
      phaseSchemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
      identity: phase43CheckpointIdentity({ sourceHead: "head", sourceVariant: "current" }),
      metadata: { identitySummary: { phase: "4.3" } },
      redact: sanitizeDiagnosticEvidence,
    });
    checkpoint.append("diagnostic.test", { email: "owner@example.invalid", countedAsOfficialSample: false });
    const read = readPhaseRun({ root, phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID, runId: checkpoint.runId });
    assert.equal(read.manifest.phaseSchemaVersion, PHASE_4_3_CHECKPOINT_SCHEMA_VERSION);
    assert.equal(read.events.at(-1).payload.email, "<redacted>");
    assert.equal(read.events.at(-1).payload.countedAsOfficialSample, false);
    assert.equal(read.manifest.identityFingerprint.length, 64);
  } finally {
    checkpoint?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
