#!/usr/bin/env node

/**
 * Phase 4.4.4 offline reconciliation for the v3 local observation run.
 *
 * This evaluator reads existing evidence and checkpoint events. It does not
 * launch the app, create a new measurement, or change product runtime code.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  PHASE_4_4_CHECKPOINT_PHASE_ID,
  PHASE_4_4_CHECKPOINT_ROOT,
  PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
  PHASE_4_4_DEFAULT_BASE_URL,
  PHASE_4_4_EXECUTION_MODES,
  PHASE_4_4_FIXTURE_ID,
  PHASE_4_4_PLAN_REVISION,
  PHASE_4_4_STAGE_LEDGER,
  phase44CheckpointIdentity,
  phase44MeasurementUnits,
  phase44StageStatuses,
  resolvePhase44LocalConfiguration,
  sanitizePhase44Evidence,
  validatePhase44TraceForJourney,
  deriveFailureBoundary,
  isValidPhase44Sample,
} from "./performance-plan-1-phase-4-4-local.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const REFERENCE_SNAPSHOT_ID = "phase4-3-reference-snapshot-20260916T194917770Z";
const RECONCILIATION_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase4-4-reconciliation-v1";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function check(id, status, details = {}) {
  return { id, status, ...details };
}

function requestLifecycle(record) {
  if (!record || !Number.isInteger(record.startedAtMs)) {
    return "INVALID_START";
  }
  if (record.failed === true) return "FAILED_OR_ABORTED";
  if (Number.isInteger(record.status) && Number.isInteger(record.bodyFinishedAtMs)) {
    return "COMPLETED";
  }
  if (record.status == null && record.bodyFinishedAtMs == null) {
    return "PENDING_AT_CAPTURE_END";
  }
  return "INCOMPLETE";
}

function summarizeRequestLifecycle(sample) {
  const requests = sample.trace?.measurement?.requestSummary?.requests;
  if (!Array.isArray(requests)) {
    return {
      status: "FAIL",
      requestCount: 0,
      byState: {},
      invalidRequestCount: 1,
    };
  }
  const states = requests.map(requestLifecycle);
  const byState = states.reduce((summary, state) => {
    summary[state] = (summary[state] ?? 0) + 1;
    return summary;
  }, {});
  const invalidRequestCount = states.filter((state) =>
    ["INVALID_START", "INCOMPLETE"].includes(state),
  ).length;
  return {
    status: invalidRequestCount === 0 ? "PASS" : "FAIL",
    requestCount: requests.length,
    byState,
    invalidRequestCount,
    bodyFinishTimedOut: sample.trace?.measurement?.requestSummary?.bodyFinishTimedOut === true,
  };
}

function expectedSecondActionDelta(sample) {
  const anchorAtMs = sample.trace?.secondActionAnchor?.trustedEventAtMs;
  const plannedAtMs = sample.trace?.actions?.second?.plannedActionAtMs;
  return Number.isInteger(anchorAtMs) && Number.isInteger(plannedAtMs)
    ? plannedAtMs - anchorAtMs
    : null;
}

function reconcileSample(sample) {
  const journey = PHASE_4_3_JOURNEYS.find(
    (candidate) => candidate.journeyId === sample?.journeyId,
  );
  const trace = sample?.trace;
  const measurement = trace?.measurement ?? {};
  const anchor = trace?.secondActionAnchor;
  const first = trace?.actions?.first;
  const second = trace?.actions?.second;
  const validation = validatePhase44TraceForJourney(trace, journey);
  const derivedFailureBoundary = deriveFailureBoundary({
    auth: sample?.auth,
    trace,
    traceValidation: validation,
    journey,
    j2DataReady: measurement.j2DataReady,
    requiredReads: measurement.requiredReads,
    expectedRouteMatched: measurement.expectedRouteMatched,
    mutationRequests: measurement.mutationRequests,
    expectedMutationRequests: measurement.expectedMutationRequests,
  });
  const lifecycle = summarizeRequestLifecycle(sample);
  const failureBoundaryConsistent = equalJson(
    sample?.failureBoundary ?? null,
    derivedFailureBoundary,
  );
  const sampleValidityConsistent = sample?.validSample === isValidPhase44Sample({
    auth: sample?.auth,
    trace,
    journey,
    j2DataReady: measurement.j2DataReady,
    requiredReads: measurement.requiredReads,
    expectedRouteMatched: measurement.expectedRouteMatched,
    mutationRequests: measurement.mutationRequests,
    expectedMutationRequests: measurement.expectedMutationRequests,
  });
  const failures = [];
  const addFailure = (condition, reason) => {
    if (!condition) failures.push(reason);
  };

  addFailure(Boolean(journey), "journey_descriptor_missing");
  addFailure(sample?.mode === "normal", "sample_mode_not_normal");
  addFailure(sample?.observationValidity === "VALID", "observation_not_valid");
  addFailure(sample?.countedAsOfficialSample === false, "official_sample_flag_changed");
  addFailure(trace?.schemaVersion === "aiya-performance-plan1-phase4-diagnostic-v3", "trace_schema_mismatch");
  addFailure(Array.isArray(trace?.events) && trace.events.length > 0, "trace_events_missing");
  addFailure(validation.status === "PASS", "trace_validation_failed");
  addFailure(validation.completenessStatus === "COMPLETE", "trace_completeness_failed");
  addFailure(anchor?.status === "RESOLVED", "second_action_anchor_unresolved");
  addFailure(anchor?.actionId === journey?.secondActionAnchor?.actionId, "second_action_anchor_action_mismatch");
  addFailure(anchor?.stepLabel === journey?.secondActionAnchor?.stepLabel, "second_action_anchor_step_mismatch");
  addFailure(expectedSecondActionDelta(sample) === PHASE_4_3_SECOND_ACTION_DELAY_MS, "second_action_delay_not_anchored");
  addFailure(Number.isInteger(first?.trustedEventAtMs), "first_trusted_event_missing");
  addFailure(Number.isInteger(second?.trustedEventAtMs), "second_trusted_event_missing");
  addFailure(second?.secondActionAccepted === true, "second_action_not_accepted");
  addFailure(second?.targetReadyStatus === "READY", "second_target_not_ready");
  addFailure(Number.isInteger(second?.readyStateAtMs), "second_ready_timing_missing");
  addFailure(measurement.expectedRouteMatched === true, "expected_route_not_matched");
  addFailure((measurement.mutationRequests ?? []).length === 0, "unexpected_mutation_observed");
  addFailure((measurement.expectedMutationRequests ?? []).every((record) =>
    Number.isInteger(record.status) &&
    record.status >= 200 &&
    record.status < 300 &&
    record.bodyFinishedAtMs != null &&
    record.failed !== true,
  ), "expected_mutation_not_completed");
  addFailure(failureBoundaryConsistent, "failure_boundary_not_reconciled");
  addFailure(sampleValidityConsistent, "sample_validity_not_consistent");
  addFailure(lifecycle.status === "PASS", "request_lifecycle_not_recorded");
  addFailure(
    measurement.foregroundBodyFinishTimedOut !== true,
    "foreground_request_body_finish_timeout_recorded",
  );

  if (sample?.journeyId === "J3") {
    addFailure(
      first?.functionalOutcome === "ABANDONED" && first?.targetUnmounted === true,
      "j3_abandonment_boundary_missing",
    );
    addFailure(
      sample.failureBoundary?.reason === "first_target_abandoned_after_navigation",
      "j3_failure_reason_mismatch",
    );
    addFailure(sample?.validSample === false, "j3_abandoned_trace_counted_as_success");
  } else {
    addFailure(
      first?.functionalOutcome === "SUCCESS" && second?.functionalOutcome === "SUCCESS",
      "successful_action_outcome_missing",
    );
    addFailure(sample?.validSample === true, "successful_trace_not_counted_as_valid_sample");
  }

  const eventTypes = new Set((trace?.events ?? []).map((event) => event.type));
  addFailure(eventTypes.has("action.planned"), "planned_action_event_missing");
  addFailure(eventTypes.has("action.dispatch"), "dispatch_event_missing");
  addFailure(eventTypes.has("trusted.event"), "trusted_event_missing");
  addFailure(eventTypes.has("route.committed"), "route_event_missing");

  return {
    unitKey: sample?.unitKey ?? null,
    journeyId: sample?.journeyId ?? null,
    repetition: sample?.repetition ?? null,
    status: failures.length ? "FAIL" : "PASS",
    failures,
    traceValidation: {
      status: validation.status,
      completenessStatus: validation.completenessStatus,
      toleratedMissingTimingFields: validation.toleratedMissingTimingFields ?? [],
    },
    anchor: {
      status: anchor?.status ?? null,
      stepLabel: anchor?.stepLabel ?? null,
      deltaMs: expectedSecondActionDelta(sample),
    },
    observedOutcome: {
      first: first?.functionalOutcome ?? null,
      second: second?.functionalOutcome ?? null,
      functionalOutcome: sample?.functionalOutcome ?? null,
      failureBoundary: sample?.failureBoundary ?? null,
    },
    requestLifecycle: lifecycle,
  };
}

function checkRunIdentity(evidence) {
  const measurement = evidence?.measurementIdentity ?? {};
  const scope = evidence?.executionScope ?? {};
  const integrity = evidence?.evidenceIntegrity ?? {};
  const failures = [];
  if (evidence?.schemaVersion !== "aiya-performance-plan1-v3-phase4-4-evidence-v1") failures.push("evidence_schema_mismatch");
  if (evidence?.planRevision !== PHASE_4_4_PLAN_REVISION) failures.push("plan_revision_mismatch");
  if (evidence?.stageId !== "4.4") failures.push("stage_id_mismatch");
  if (scope.executionMode !== PHASE_4_4_EXECUTION_MODES.localNormalObservations) failures.push("execution_mode_mismatch");
  if (measurement.fixtureId !== PHASE_4_4_FIXTURE_ID) failures.push("fixture_id_mismatch");
  if (measurement.secondActionDelayMs !== PHASE_4_3_SECOND_ACTION_DELAY_MS) failures.push("delay_contract_mismatch");
  if (scope.officialMeasurementStarted !== false) failures.push("official_measurement_started");
  if (scope.causalExperimentStarted !== false) failures.push("causal_experiment_started");
  if (scope.runtimeChangeAcceptedAsFix !== false) failures.push("runtime_fix_accepted");
  if (integrity.historicalPhase4EvidenceRewritten !== false) failures.push("historical_evidence_rewritten");
  return check("run_identity_and_scope", failures.length ? "FAIL" : "PASS", { failures });
}

function checkCoverage(samples) {
  const plannedKeys = phase44MeasurementUnits({ modes: ["normal"] }).map((unit) => unit.unitKey);
  const observedKeys = samples.map((sample) => sample?.unitKey).filter(Boolean);
  const duplicateKeys = observedKeys.filter((key, index) => observedKeys.indexOf(key) !== index);
  const missingKeys = plannedKeys.filter((key) => !observedKeys.includes(key));
  const unexpectedKeys = observedKeys.filter((key) => !plannedKeys.includes(key));
  const failures = [
    ...new Set([
      ...(duplicateKeys.length ? ["duplicate_unit_keys"] : []),
      ...(missingKeys.length ? ["missing_unit_keys"] : []),
      ...(unexpectedKeys.length ? ["unexpected_unit_keys"] : []),
    ]),
  ];
  return check("normal_observation_coverage", failures.length ? "FAIL" : "PASS", {
    plannedCount: plannedKeys.length,
    observedCount: observedKeys.length,
    observationValidCount: samples.filter((sample) => sample?.observationValidity === "VALID").length,
    successfulSampleCount: samples.filter((sample) => sample?.validSample === true).length,
    duplicateKeys,
    missingKeys,
    unexpectedKeys,
  });
}

function checkProbeGate(probeEvidence) {
  const preflightStatus = probeEvidence?.stageLedger?.find((stage) => stage.stageId === "4.4.1")?.status ?? "NOT_STARTED";
  const stageStatuses = phase44StageStatuses({
    preflightStatus,
    probeResults: probeEvidence?.samples ?? [],
  });
  const failures = [];
  if (stageStatuses["4.4.1"] !== "PASS") failures.push("probe_preflight_not_pass");
  if (stageStatuses["4.4.2"] !== "PASS") failures.push("targeted_capture_probe_not_pass");
  if (probeEvidence?.evidenceIntegrity?.historicalPhase4EvidenceRewritten !== false) failures.push("probe_rewrote_historical_evidence");
  return check("targeted_capture_dependency", failures.length ? "FAIL" : "PASS", {
    stageStatuses: {
      "4.4.1": stageStatuses["4.4.1"],
      "4.4.2": stageStatuses["4.4.2"],
    },
    observationValidCount: probeEvidence?.sampleSummary?.observationValidSamples ?? 0,
    failures,
  });
}

export function reconcilePhase44Observations({ normalEvidence, probeEvidence } = {}) {
  const samples = Array.isArray(normalEvidence?.samples) ? normalEvidence.samples : [];
  const sampleResults = samples.map(reconcileSample);
  const checks = [
    checkRunIdentity(normalEvidence),
    checkProbeGate(probeEvidence),
    checkCoverage(samples),
    ...sampleResults.map((result) => check(
      `trace:${result.unitKey}`,
      result.status,
      { failures: result.failures },
    )),
  ];
  const j3Results = sampleResults.filter((result) => result.journeyId === "J3");
  const j3Reasons = [...new Set(j3Results.map((result) => result.observedOutcome.failureBoundary?.reason ?? "none"))];
  const j3Pattern = j3Results.length === 3 && j3Reasons.length === 1 &&
    j3Reasons[0] === "first_target_abandoned_after_navigation";
  checks.push(check("j3_repeated_failure_boundary", j3Pattern ? "PASS" : "FAIL", {
    observationCount: j3Results.length,
    reasons: j3Reasons,
    interpretation: "Observed navigation-away lifecycle; not a root-cause claim.",
  }));
  const requestLifecycle = sampleResults.reduce((summary, result) => {
    for (const [state, count] of Object.entries(result.requestLifecycle.byState ?? {})) {
      summary[state] = (summary[state] ?? 0) + count;
    }
    return summary;
  }, {});
  const status = checks.every((item) => item.status === "PASS") ? "PASS" : "BLOCKED";
  const stageStatuses = phase44StageStatuses({
    preflightStatus: "PASS",
    probeResults: probeEvidence?.samples ?? [],
    normalResults: samples,
    reconciliationStatus: status,
  });
  if (status === "BLOCKED") stageStatuses["4.4.4"] = "BLOCKED";
  return {
    schemaVersion: RECONCILIATION_SCHEMA_VERSION,
    status,
    outcome: status === "PASS"
      ? "TRACE_INTEGRITY_RECONCILED"
      : "TRACE_RECONCILIATION_BLOCKED",
    stageId: "4.4.4",
    stageStatuses: {
      "4.4.1": stageStatuses["4.4.1"],
      "4.4.2": stageStatuses["4.4.2"],
      "4.4.3": stageStatuses["4.4.3"],
      "4.4.4": stageStatuses["4.4.4"],
    },
    checks,
    sampleResults,
    requestLifecycle,
    openGaps: [
      "Performance remains NOT_EVALUABLE for this capture and observation scope.",
      "J3 navigation-away is observed consistently but is not a confirmed application cause.",
      "Failed and pending background requests are retained as observations, not assigned to a root-cause layer.",
    ],
    officialMeasurementStarted: false,
    causalExperimentStarted: false,
    runtimeFixAccepted: false,
    historicalPhase4EvidenceRewritten: false,
    nextAction: status === "PASS"
      ? "Make the proportionate 4.5/4.6 environment-scope decision or proceed to the next declared Plan 1 reconciliation; do not infer a root cause from this run."
      : "Preserve the blocked reconciliation and repair only the declared evidence boundary before continuing.",
  };
}

function reconcileCheckpoint({ runId, reconciliation, evidence }) {
  const configuration = resolvePhase44LocalConfiguration();
  const identity = phase44CheckpointIdentity({
    sourceHead: evidence?.sourceIdentity?.head ?? "unbound",
    sourceVariant: "current",
    referenceSnapshotId: REFERENCE_SNAPSHOT_ID,
    baseUrl: PHASE_4_4_DEFAULT_BASE_URL,
    configurationIdentity: configuration.identity,
    executionMode: PHASE_4_4_EXECUTION_MODES.localNormalObservations,
  });
  const metadata = {
    identitySummary: {
      planRevision: PHASE_4_4_PLAN_REVISION,
      fixtureId: PHASE_4_4_FIXTURE_ID,
      executionMode: PHASE_4_4_EXECUTION_MODES.localNormalObservations,
      reconciliationOnly: true,
    },
    reconciliationSchemaVersion: RECONCILIATION_SCHEMA_VERSION,
  };
  const opened = openPhaseRun({
    root: PHASE_4_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata,
    runId,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const existing = readPhaseRun({
      root: PHASE_4_4_CHECKPOINT_ROOT,
      phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
      runId,
    });
    const prior = existing.events
      .filter((event) => event.type === "stage.reconciliation.evaluated")
      .at(-1)?.payload ?? null;
    return {
      status: "ALREADY_COMPLETE",
      runId,
      eventCount: existing.events.length,
      hashChainRead: true,
      priorReconciliation: prior,
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`phase44_reconciliation_checkpoint_${String(opened.action).toLowerCase()}`);
  }
  const checkpoint = opened.run;
  checkpoint.append("stage.reconciliation.evaluated", {
    stageId: "4.4.4",
    reconciliation,
    countedAsOfficialSample: false,
  }, { status: "RUNNING" });
  checkpoint.markStatus(reconciliation.status === "PASS" ? "COMPLETE" : "BLOCKED", {
    reason: reconciliation.status === "PASS"
      ? "phase44_trace_integrity_reconciled"
      : "phase44_trace_reconciliation_blocked",
    stageId: "4.4.4",
    countedAsOfficialSample: false,
  });
  checkpoint.close();
  const persisted = readPhaseRun({
    root: PHASE_4_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
    runId,
  });
  return {
    status: persisted.manifest.status,
    runId,
    eventCount: persisted.events.length,
    hashChainRead: true,
    lastEventType: persisted.events.at(-1)?.type ?? null,
    reconciliationEventCount: persisted.events.filter((event) =>
      event.type === "stage.reconciliation.evaluated",
    ).length,
  };
}

export function buildReconciledPhase44Evidence({
  normalEvidence,
  reconciliation,
  checkpoint,
} = {}) {
  const stageLedger = PHASE_4_4_STAGE_LEDGER.map((stage) => ({
    ...stage,
    status: reconciliation.stageStatuses[stage.stageId] ?? "NOT_STARTED",
  }));
  return sanitizePhase44Evidence({
    ...normalEvidence,
    outcome: reconciliation.status === "PASS"
      ? "LOCAL_OBSERVATIONS_RECONCILED"
      : "LOCAL_OBSERVATION_RECONCILIATION_BLOCKED",
    stageLedger,
    stageScheduler: {
      ...normalEvidence.stageScheduler,
      ...reconciliation.stageStatuses,
    },
    activeContract: {
      ...normalEvidence.activeContract,
      nextEligibleStage: reconciliation.status === "PASS" ? "4.5" : "4.4",
    },
    reconciliation,
    checkpointReconciliation: checkpoint,
    closure: {
      ...normalEvidence.closure,
      status: "IN_PROGRESS",
      outcome: reconciliation.status === "PASS"
        ? "LOCAL_OBSERVATIONS_RECONCILED"
        : "LOCAL_OBSERVATION_RECONCILIATION_BLOCKED",
      phase4Closed: false,
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction: reconciliation.nextAction,
    },
  });
}

export function reconcilePhase44Run({
  normalEvidencePath,
  probeEvidencePath,
  runId,
  writeEvidence = false,
} = {}) {
  const normalEvidence = readJson(normalEvidencePath);
  const probeEvidence = readJson(probeEvidencePath);
  const reconciliation = reconcilePhase44Observations({ normalEvidence, probeEvidence });
  const checkpoint = reconcileCheckpoint({
    runId: runId ?? normalEvidence.runId,
    reconciliation,
    evidence: normalEvidence,
  });
  const evidence = buildReconciledPhase44Evidence({
    normalEvidence,
    probeEvidence,
    reconciliation,
    checkpoint,
  });
  if (writeEvidence) writeFileSync(normalEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { evidence, reconciliation, checkpoint };
}

function parseArguments(argv) {
  const options = {
    runId: null,
    normalEvidencePath: null,
    probeEvidencePath: null,
    writeEvidence: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-id") options.runId = argv[++index];
    else if (arg === "--normal-evidence") options.normalEvidencePath = argv[++index];
    else if (arg === "--probe-evidence") options.probeEvidencePath = argv[++index];
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else throw new Error(`phase44_reconciliation_argument_invalid:${arg}`);
  }
  return options;
}

function defaultEvidencePaths() {
  const normalRunId = "aiya-performance-plan1-phase4-4-local-v3-20260917T075911349Z-64dd47c1-4cc0-4b6f-b1ff-6fe3b3373512";
  const probeRunId = "aiya-performance-plan1-phase4-4-local-v3-20260917T073613059Z-e2c3495a-ed74-4eb5-9982-f842efe3c1b8";
  return {
    normalEvidencePath: join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${normalRunId}_EVIDENCE.json`),
    probeEvidencePath: join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${probeRunId}_EVIDENCE.json`),
    runId: normalRunId,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const defaults = defaultEvidencePaths();
  const normalEvidencePath = options.normalEvidencePath ?? defaults.normalEvidencePath;
  const probeEvidencePath = options.probeEvidencePath ?? defaults.probeEvidencePath;
  if (!existsSync(normalEvidencePath) || !existsSync(probeEvidencePath)) {
    throw new Error("phase44_reconciliation_evidence_missing");
  }
  const result = reconcilePhase44Run({
    normalEvidencePath,
    probeEvidencePath,
    runId: options.runId ?? defaults.runId,
    writeEvidence: options.writeEvidence,
  });
  process.stdout.write(`${JSON.stringify({
    status: result.reconciliation.status,
    outcome: result.reconciliation.outcome,
    stageStatuses: result.reconciliation.stageStatuses,
    checkpoint: result.checkpoint,
    evidencePath: normalEvidencePath,
  }, null, 2)}\n`);
}
