#!/usr/bin/env node

/**
 * Plan 1 v3 Phase 5.3 layer attribution.
 *
 * This stage is analysis-only. It reuses the valid Phase 5.2 traces and does
 * not launch the app, change product runtime code, or create new samples.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase52SourceIdentity,
  sanitizePhase52Evidence,
} from "./performance-plan-1-phase-5-2-experiment.mjs";
import {
  redactionCheck,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const PHASE_5_3_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_3_STAGE_ID = "5.3";
export const PHASE_5_3_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase5-3-layer-attribution-evidence-v1";
export const PHASE_5_3_RUN_ID =
  "aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b";
export const PHASE_5_3_INPUT_RUN_ID =
  "aiya-performance-plan1-phase5-2-single-variable-experiment-v3-20260917T134123969Z-21e8c635-0129-4a48-aca8-45831367a057";
export const PHASE_5_3_INPUT_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_3_INPUT_RUN_ID}_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json`;
export const PHASE_5_3_SOURCE_PATHS = Object.freeze([
  "app/scripts/performance-plan-1-phase-5-3-layer-attribution.mjs",
  "app/scripts/performance-plan-1-phase-5-3-layer-attribution.test.mjs",
  PHASE_5_3_INPUT_EVIDENCE_PATH,
]);

const REQUIRED_TRACE_COUNT = 9;
const REQUIRED_CYCLE_COUNT = 3;
const A_POSITION = new Set(["A_before", "A_after"]);
const B_POSITION = "B";
const LAYER_IDS = Object.freeze([
  "dns_tls_ttfb",
  "auth_session",
  "capability_rls",
  "server_store_fanout",
  "response_body_finish",
  "json_parse",
  "react_render_layout_paint",
  "polling_mount",
  "service_worker",
  "release_identity",
  "read_start_order",
  "capture_completeness",
]);

const METRIC_DEFINITIONS = Object.freeze([
  { id: "route_commit_to_target_ready_ms", label: "route commit to target ready", layer: "react_render_layout_paint" },
  { id: "route_commit_to_hydration_start_ms", label: "route commit to hydration start", layer: "server_store_fanout" },
  { id: "hydration_start_to_complete_ms", label: "hydration start to complete", layer: "react_render_layout_paint" },
  { id: "hydration_complete_to_target_ready_ms", label: "hydration complete to target ready", layer: "react_render_layout_paint" },
  { id: "target_ready_to_interactive_paint_ms", label: "target ready to interactive paint", layer: "react_render_layout_paint" },
  { id: "shell_request_to_header_ms", label: "shell bootstrap request to header", layer: "server_store_fanout" },
  { id: "shell_header_to_body_ms", label: "shell bootstrap header to body", layer: "response_body_finish" },
  { id: "app_state_request_to_header_ms", label: "app-state request to header", layer: "server_store_fanout" },
  { id: "app_state_header_to_body_ms", label: "app-state header to body", layer: "response_body_finish" },
  { id: "app_state_request_to_body_ms", label: "app-state request to body", layer: "server_store_fanout" },
  { id: "app_state_server_auth_ms", label: "app-state Server-Timing auth", layer: "auth_session" },
  { id: "app_state_server_store_ms", label: "app-state Server-Timing store", layer: "server_store_fanout" },
  { id: "app_state_server_json_ms", label: "app-state Server-Timing json", layer: "json_parse" },
  { id: "app_state_server_route_ms", label: "app-state Server-Timing route", layer: "server_store_fanout" },
  { id: "app_state_start_after_shell_body_ms", label: "app-state start after shell body", layer: "server_store_fanout" },
  { id: "app_state_start_after_hydration_trigger_ms", label: "app-state start after hydration trigger", layer: "server_store_fanout" },
]);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  return finite(value) == null ? null : Number(Number(value).toFixed(3));
}

function deltaMs(end, start) {
  const endValue = finite(end);
  const startValue = finite(start);
  return endValue == null || startValue == null ? null : roundMs(endValue - startValue);
}

function median(values) {
  const sorted = values.filter((value) => finite(value) != null).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? roundMs(sorted[middle])
    : roundMs((sorted[middle - 1] + sorted[middle]) / 2);
}

function serverTimingValue(read, name) {
  const metric = (read?.serverTiming ?? []).find((item) => item.name === name);
  return finite(metric?.durationMs);
}

function requestLayer(read) {
  if (!read) return null;
  return {
    status: read.status ?? null,
    requestToHeaderMs: deltaMs(read.responseHeaderAtMs, read.requestStartedAtMs),
    headerToBodyMs: deltaMs(read.bodyFinishedAtMs, read.responseHeaderAtMs),
    requestToBodyMs: deltaMs(read.bodyFinishedAtMs, read.requestStartedAtMs),
    bodyFinished: finite(read.bodyFinishedAtMs) != null,
    serverTiming: {
      authMs: serverTimingValue(read, "auth"),
      storeMs: serverTimingValue(read, "store"),
      jsonMs: serverTimingValue(read, "json"),
      routeMs: serverTimingValue(read, "route"),
    },
  };
}

function observeTrace(trace) {
  const shell = trace?.reads?.shellBootstrap;
  const appState = trace?.reads?.appState;
  const hydration = trace?.hydration;
  return {
    traceId: trace?.traceId ?? null,
    cycle: trace?.cycle ?? null,
    position: trace?.position ?? null,
    policy: trace?.policy ?? null,
    observationValidity: trace?.observationValidity ?? null,
    shellBootstrap: requestLayer(shell),
    appState: requestLayer(appState),
    metrics: {
      route_commit_to_target_ready_ms: finite(trace?.boundary?.routeCommitToTargetReadyMs),
      route_commit_to_hydration_start_ms: finite(trace?.boundary?.routeCommitToHydrationStartMs),
      hydration_start_to_complete_ms: finite(trace?.boundary?.hydrationStartToCompleteMs),
      hydration_complete_to_target_ready_ms: deltaMs(trace?.targetReadyAtMs, hydration?.completedAtMs),
      target_ready_to_interactive_paint_ms: deltaMs(trace?.targetInteractivePaintAtMs, trace?.targetReadyAtMs),
      shell_request_to_header_ms: deltaMs(shell?.responseHeaderAtMs, shell?.requestStartedAtMs),
      shell_header_to_body_ms: deltaMs(shell?.bodyFinishedAtMs, shell?.responseHeaderAtMs),
      app_state_request_to_header_ms: deltaMs(appState?.responseHeaderAtMs, appState?.requestStartedAtMs),
      app_state_header_to_body_ms: deltaMs(appState?.bodyFinishedAtMs, appState?.responseHeaderAtMs),
      app_state_request_to_body_ms: deltaMs(appState?.bodyFinishedAtMs, appState?.requestStartedAtMs),
      app_state_server_auth_ms: serverTimingValue(appState, "auth"),
      app_state_server_store_ms: serverTimingValue(appState, "store"),
      app_state_server_json_ms: serverTimingValue(appState, "json"),
      app_state_server_route_ms: serverTimingValue(appState, "route"),
      app_state_start_after_shell_body_ms: deltaMs(
        appState?.clientStartedAtMs,
        shell?.clientCompletedAtMs,
      ),
      app_state_start_after_hydration_trigger_ms: deltaMs(
        appState?.clientStartedAtMs,
        hydration?.triggerAtMs,
      ),
    },
    browser: {
      longTaskCount: finite(trace?.browserMetrics?.longTaskCount),
      lcpAtMs: finite(trace?.browserMetrics?.lcpAtMs),
      cls: finite(trace?.browserMetrics?.cls),
    },
    requestCapture: {
      bodyFinishTimedOut: trace?.requestCapture?.bodyFinishTimedOut === true,
      overlappingRequestCount: Array.isArray(trace?.requestCapture?.overlappingRequests)
        ? trace.requestCapture.overlappingRequests.length
        : null,
    },
  };
}

function metricSummary(observations) {
  return Object.fromEntries(
    METRIC_DEFINITIONS.map(({ id }) => [id, median(observations.map((item) => item.metrics[id]))]),
  );
}

function direction(delta) {
  if (finite(delta) == null) return "NOT_EVALUABLE";
  if (delta > 0) return "B_HIGHER";
  if (delta < 0) return "B_LOWER";
  return "EQUAL";
}

function buildMatchedComparisons(observations) {
  const cycles = [];
  for (let cycle = 1; cycle <= REQUIRED_CYCLE_COUNT; cycle += 1) {
    const cycleObservations = observations.filter((item) => item.cycle === cycle);
    const aObservations = cycleObservations.filter((item) => A_POSITION.has(item.position));
    const bObservations = cycleObservations.filter((item) => item.position === B_POSITION);
    const aMetrics = metricSummary(aObservations);
    const bMetrics = metricSummary(bObservations);
    const deltas = Object.fromEntries(
      METRIC_DEFINITIONS.map(({ id }) => [id, deltaMs(bMetrics[id], aMetrics[id])]),
    );
    cycles.push({
      cycle,
      observationValid: cycleObservations.length === 3 &&
        cycleObservations.every((item) => item.observationValidity === "VALID"),
      A: {
        traceIds: aObservations.map((item) => item.traceId),
        metrics: aMetrics,
      },
      B: {
        traceIds: bObservations.map((item) => item.traceId),
        metrics: bMetrics,
      },
      deltasBMinusA: deltas,
      directions: Object.fromEntries(
        METRIC_DEFINITIONS.map(({ id }) => [id, direction(deltas[id])]),
      ),
    });
  }
  return cycles;
}

function repeatability(comparisons, metricId) {
  const directions = comparisons.map((comparison) => comparison.directions[metricId]);
  const repeats = directions.length === REQUIRED_CYCLE_COUNT &&
    directions.every((value) => value === directions[0]) &&
    ["B_HIGHER", "B_LOWER"].includes(directions[0]);
  return { metricId, directions, repeats };
}

function buildLayerAssessments(comparisons, observations) {
  const appStateStore = repeatability(comparisons, "app_state_server_store_ms");
  const appStateRoute = repeatability(comparisons, "app_state_server_route_ms");
  const appStateTotal = repeatability(comparisons, "app_state_request_to_body_ms");
  const hydration = repeatability(comparisons, "hydration_start_to_complete_ms");
  const targetTail = repeatability(comparisons, "hydration_complete_to_target_ready_ms");
  const routeToHydration = repeatability(comparisons, "route_commit_to_hydration_start_ms");
  const json = repeatability(comparisons, "app_state_server_json_ms");
  const bodyTail = repeatability(comparisons, "app_state_header_to_body_ms");
  const allLongTasksZero = observations.every((item) => item.browser.longTaskCount === 0);
  const allRequiredReadsSuccessful = observations.every((item) =>
    item.shellBootstrap?.status === 200 &&
    item.shellBootstrap.bodyFinished &&
    item.appState?.status === 200 &&
    item.appState.bodyFinished);

  return [
    {
      layerId: "dns_tls_ttfb",
      status: "NOT_EXERCISED",
      basis: "The matched run used a local loopback origin; external DNS/TLS was outside this input.",
      metricIds: [],
    },
    {
      layerId: "auth_session",
      status: "OBSERVED_NOT_SEPARATED",
      basis: "Authenticated Server-Timing auth labels were present, but auth was not independently varied.",
      metricIds: ["app_state_server_auth_ms"],
      repeatability: repeatability(comparisons, "app_state_server_auth_ms"),
    },
    {
      layerId: "capability_rls",
      status: allRequiredReadsSuccessful ? "CONTROL_HELD" : "OBSERVATION_LIMITED",
      basis: "The same synthetic owner and local normal tenant path were retained; no permission variable was changed.",
      metricIds: [],
    },
    {
      layerId: "server_store_fanout",
      status: appStateStore.repeats && appStateRoute.repeats
        ? "PROVISIONAL_COVARIATION"
        : "NOT_REPEATED",
      basis: "App-state Server-Timing store and route labels covary with B in all matched cycles, but labels are not pure database or store time and no server variable was isolated.",
      metricIds: ["app_state_server_store_ms", "app_state_server_route_ms", "app_state_request_to_body_ms"],
      repeatability: { appStateStore, appStateRoute, appStateTotal },
    },
    {
      layerId: "response_body_finish",
      status: bodyTail.repeats && bodyTail.directions[0] === "B_HIGHER"
        ? "PROVISIONAL_COVARIATION"
        : "NOT_DOMINANT_SIGNAL",
      basis: "Required bodies finished with HTTP 200; header-to-body tails were small relative to app-state server timing and do not establish a body-transfer cause.",
      metricIds: ["shell_header_to_body_ms", "app_state_header_to_body_ms"],
      repeatability: { bodyTail },
    },
    {
      layerId: "json_parse",
      status: json.repeats && json.directions[0] === "B_HIGHER"
        ? "SMALL_COVARIATION_NOT_DOMINANT"
        : "NOT_REPEATED",
      basis: "Server-Timing json values were present but remained small; no client parse boundary was independently isolated.",
      metricIds: ["app_state_server_json_ms"],
      repeatability: { json },
    },
    {
      layerId: "react_render_layout_paint",
      status: hydration.repeats && targetTail.repeats
        ? "PROVISIONAL_DOWNSTREAM_COVARIATION"
        : "NOT_REPEATED",
      basis: `${allLongTasksZero ? "Zero long tasks were observed" : "Long tasks were observed"}; hydration duration and the post-hydration target-ready tail are higher in B across cycles, but no render-commit marker prevents exact client attribution.`,
      metricIds: ["hydration_start_to_complete_ms", "hydration_complete_to_target_ready_ms", "target_ready_to_interactive_paint_ms"],
      repeatability: { hydration, targetTail },
    },
    {
      layerId: "polling_mount",
      status: observations.some((item) => item.requestCapture.overlappingRequestCount > 0)
        ? "PRESENT_UNSEPARATED"
        : "NOT_OBSERVED",
      basis: "Background request overlap was retained by the input capture, but no polling policy variable was tested in 5.2.",
      metricIds: [],
    },
    {
      layerId: "service_worker",
      status: "NOT_EXERCISED",
      basis: "The 5.2 contract blocked service workers in cold browser contexts; this does not attribute a production PWA path.",
      metricIds: [],
    },
    {
      layerId: "release_identity",
      status: "CONTROL_HELD",
      basis: "All nine traces reused one build control and one source identity; no release variable was changed.",
      metricIds: [],
    },
    {
      layerId: "read_start_order",
      status: routeToHydration.repeats ? "PROVISIONAL_COVARIATION" : "NOT_ATTRIBUTED",
      basis: "The route-to-hydration-start boundary does not repeat a single B direction, so the gate's scheduling boundary is not independently attributed.",
      metricIds: ["route_commit_to_hydration_start_ms", "app_state_start_after_shell_body_ms", "app_state_start_after_hydration_trigger_ms"],
      repeatability: { routeToHydration },
    },
    {
      layerId: "capture_completeness",
      status: observations.every((item) => item.requestCapture.bodyFinishTimedOut)
        ? "ANCILLARY_TIMEOUT_RETAINED"
        : "COMPLETE",
      basis: "Required shell/app-state bodies were retained, while the unrelated-request body-finish drain reached its bounded deadline and remains a separate limitation.",
      metricIds: [],
    },
  ];
}

function buildProvisionalSignals(comparisons) {
  const store = repeatability(comparisons, "app_state_server_store_ms");
  const route = repeatability(comparisons, "app_state_server_route_ms");
  const hydration = repeatability(comparisons, "hydration_start_to_complete_ms");
  const tail = repeatability(comparisons, "hydration_complete_to_target_ready_ms");
  return [
    {
      signalId: "S5.3-001",
      layerId: "server_store_fanout",
      status: store.repeats && route.repeats ? "PROVISIONAL_COVARIATION" : "NOT_REPEATED",
      metricIds: ["app_state_server_store_ms", "app_state_server_route_ms"],
      directions: { store: store.directions, route: route.directions },
      interpretation: "B's app-state server timing is higher in each matched cycle and moves with the target-ready delta, but the Server-Timing labels are composite and no server/store variable was isolated.",
    },
    {
      signalId: "S5.3-002",
      layerId: "react_render_layout_paint",
      status: hydration.repeats && tail.repeats ? "PROVISIONAL_DOWNSTREAM_COVARIATION" : "NOT_REPEATED",
      metricIds: ["hydration_start_to_complete_ms", "hydration_complete_to_target_ready_ms"],
      directions: { hydration: hydration.directions, targetTail: tail.directions },
      interpretation: "B's hydration and post-hydration readiness intervals are higher in every cycle, but zero observed long tasks and the absence of a render-commit marker prevent exact client attribution.",
    },
    {
      signalId: "S5.3-003",
      layerId: "read_start_order",
      status: "NOT_ATTRIBUTED",
      metricIds: ["route_commit_to_hydration_start_ms", "app_state_start_after_hydration_trigger_ms"],
      directions: {
        routeToHydration: repeatability(comparisons, "route_commit_to_hydration_start_ms").directions,
        appStateAfterTrigger: repeatability(comparisons, "app_state_start_after_hydration_trigger_ms").directions,
      },
      interpretation: "The measured scheduling boundary does not show a consistent B delay; the repeatable overall effect cannot be assigned to the policy gate itself from these traces.",
    },
  ];
}

export function phase53V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^aiya-performance-plan1-phase5-3-layer-attribution-v3-[A-Za-z0-9._-]+$/.test(safeRunId)) {
    throw new Error("phase53_v3_run_id_invalid");
  }
  const outputPath = join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json`,
  );
  if (relative(repoRoot, outputPath).startsWith("..")) {
    throw new Error("phase53_v3_evidence_path_invalid");
  }
  return outputPath;
}

export function phase53SourceIdentity() {
  const base = phase52SourceIdentity();
  const existing = new Set((base.sourceFiles ?? []).map((item) => item.path));
  const additions = PHASE_5_3_SOURCE_PATHS
    .filter((path) => !existing.has(path))
    .map((path) => ({ path, sha256: sha256File(join(repoRoot, path)) }));
  return {
    ...base,
    sourceFiles: [...(base.sourceFiles ?? []), ...additions],
  };
}

export function phase53PrerequisiteCheck(
  inputEvidence = readJson(join(repoRoot, PHASE_5_3_INPUT_EVIDENCE_PATH)),
) {
  const failures = [];
  if (!inputEvidence) failures.push("phase52_input_evidence_missing_or_invalid_json");
  if (inputEvidence?.planRevision !== PHASE_5_3_PLAN_REVISION) {
    failures.push("phase52_plan_revision_invalid");
  }
  if (inputEvidence?.stageId !== "5.2") failures.push("phase52_stage_id_invalid");
  if (inputEvidence?.runId !== PHASE_5_3_INPUT_RUN_ID) failures.push("phase52_run_id_mismatch");
  if (inputEvidence?.status !== "COMPLETE") failures.push("phase52_not_complete");
  if (inputEvidence?.outcome !== "REPEATABLE_PROVISIONAL_EFFECT") {
    failures.push("phase52_outcome_invalid");
  }
  if (inputEvidence?.sampleSummary?.attemptedTraces !== REQUIRED_TRACE_COUNT) {
    failures.push("phase52_trace_count_invalid");
  }
  if (inputEvidence?.sampleSummary?.observationValidTraces !== REQUIRED_TRACE_COUNT) {
    failures.push("phase52_observation_validity_invalid");
  }
  if (inputEvidence?.sampleSummary?.observationInvalidTraces !== 0) {
    failures.push("phase52_invalid_trace_present");
  }
  if (inputEvidence?.evidenceIntegrity?.status !== "PASS") {
    failures.push("phase52_evidence_integrity_invalid");
  }
  if (inputEvidence?.evidenceIntegrity?.checkpointHashChain !== true) {
    failures.push("phase52_checkpoint_hash_chain_invalid");
  }
  if (inputEvidence?.checkpointReconciliation?.status !== "COMPLETE") {
    failures.push("phase52_checkpoint_not_complete");
  }
  if (inputEvidence?.checkpointReconciliation?.hashChainRead !== true) {
    failures.push("phase52_checkpoint_not_read");
  }
  return {
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    failures,
    inputEvidence: {
      runId: inputEvidence?.runId ?? null,
      status: inputEvidence?.status ?? null,
      outcome: inputEvidence?.outcome ?? null,
      sha256: sha256File(join(repoRoot, PHASE_5_3_INPUT_EVIDENCE_PATH)),
      checkpointReconciliation: inputEvidence?.checkpointReconciliation ?? null,
    },
  };
}

export function analyzePhase53Layers(inputEvidence) {
  const observations = (inputEvidence?.traces ?? []).map(observeTrace);
  const comparisons = buildMatchedComparisons(observations);
  return {
    observations: {
      attempted: observations.length,
      valid: observations.filter((item) => item.observationValidity === "VALID").length,
      invalid: observations.filter((item) => item.observationValidity !== "VALID").length,
      cycles: comparisons.map((comparison) => ({
        cycle: comparison.cycle,
        observationValid: comparison.observationValid,
        traceCount: comparison.A.traceIds.length + comparison.B.traceIds.length,
      })),
    },
    metricDefinitions: METRIC_DEFINITIONS,
    matchedComparisons: comparisons,
    layerAssessments: buildLayerAssessments(comparisons, observations),
    provisionalSignals: buildProvisionalSignals(comparisons),
    conclusion: {
      status: "INCONCLUSIVE",
      code: "NO_CAUSE_CONFIRMED",
      causeConfirmed: false,
      findingDispositionChanged: false,
      explanation: "The traces identify repeatable co-moving server/store and downstream hydration signals, but no layer was independently isolated enough for a cause claim.",
    },
  };
}

export function buildPhase53Evidence({
  inputEvidence = readJson(join(repoRoot, PHASE_5_3_INPUT_EVIDENCE_PATH)),
  inputEvidencePath = PHASE_5_3_INPUT_EVIDENCE_PATH,
  runId = PHASE_5_3_RUN_ID,
  generatedAt = new Date().toISOString(),
  sourceIdentity = phase53SourceIdentity(),
} = {}) {
  const prerequisite = phase53PrerequisiteCheck(inputEvidence);
  const analysis = prerequisite.status === "PASS" ? analyzePhase53Layers(inputEvidence) : null;
  const status = prerequisite.status === "PASS" ? "COMPLETE" : "BLOCKED";
  const outcome = prerequisite.status === "PASS"
    ? "LAYER_ATTRIBUTION_INCONCLUSIVE"
    : "LAYER_ATTRIBUTION_BLOCKED";
  const evidence = sanitizePhase52Evidence({
    schemaVersion: PHASE_5_3_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_5_3_PLAN_REVISION,
    phase: "5",
    stage: PHASE_5_3_STAGE_ID,
    stageId: PHASE_5_3_STAGE_ID,
    runId,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Attribute the existing Phase 5.2 effect across measured timing layers without creating a new sample.",
      environment: "local_desktop",
      analysisOnly: true,
      inputExperimentReused: true,
      newMeasurementStarted: false,
      officialMeasurementStarted: false,
      newCausalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      externalOperations: [],
      preservedExistingChanges: true,
      countedAsOfficialSample: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_3_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.7 COMPLETE / DIAGNOSIS_BLOCKED",
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
        "5.2 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
      ],
      currentStage: PHASE_5_3_STAGE_ID,
      nextEligibleStage: status === "COMPLETE" ? "5.4" : "5.3 retry or blocked review",
    },
    sourceIdentity,
    inputExperiment: {
      path: inputEvidencePath,
      runId: inputEvidence?.runId ?? null,
      status: inputEvidence?.status ?? null,
      outcome: inputEvidence?.outcome ?? null,
      sha256: prerequisite.inputEvidence.sha256,
      sampleSummary: inputEvidence?.sampleSummary ?? null,
      checkpointReconciliation: inputEvidence?.checkpointReconciliation ?? null,
      sourceIdentity: inputEvidence?.sourceIdentity ?? null,
    },
    prerequisite,
    attribution: analysis?.conclusion ?? {
      status: "BLOCKED",
      code: "INPUT_PREREQUISITE_BLOCKED",
      causeConfirmed: false,
      findingDispositionChanged: false,
    },
    observations: analysis?.observations ?? null,
    metricDefinitions: analysis?.metricDefinitions ?? [],
    matchedComparisons: analysis?.matchedComparisons ?? [],
    layerAssessments: analysis?.layerAssessments ?? [],
    provisionalSignals: analysis?.provisionalSignals ?? [],
    blockers: prerequisite.failures,
    findingDispositionChanges: [],
    deferredToLaterStages: [
      "5.4 applicable safety and behavior checks are required before any fix proposal.",
      "5.3 did not exercise DNS/TLS, service-worker, hosted/device, or AI Chat-specific paths.",
      "Plan 2 remains locked until a finding reaches the required causal disposition.",
    ],
    constraints: [
      "This stage reuses Phase 5.2 traces and starts no new measurement.",
      "Server-Timing labels are not treated as pure auth, database, or store time without contained-work evidence.",
      "A repeatable co-variation is not a root-cause confirmation.",
      "No official nine-scenario sample was started.",
      "Credentials, cookies, tokens, raw bodies, prompts, clinical content, and device serials are excluded.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PASS",
      redactionCheck: "PASS",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      inputEvidenceParsed: prerequisite.status === "PASS",
      inputEvidenceIntegrityPass: inputEvidence?.evidenceIntegrity?.status === "PASS",
      inputCheckpointHashChain: inputEvidence?.checkpointReconciliation?.hashChainRead === true,
      newMeasurementStarted: false,
      officialMeasurementStarted: false,
      newCausalExperimentStarted: false,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      findingManifestChanged: false,
    },
    closure: {
      status,
      outcome,
      phase4Closed: true,
      plan1Closed: false,
      newMeasurementStarted: false,
      newCausalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction: status === "COMPLETE"
        ? "Proceed to 5.4 applicable safety and behavior checks; do not accept a fix from this attribution alone."
        : "Repair the Phase 5.2 input evidence boundary and preserve this blocked attribution record.",
    },
    checkpointReconciliation: {
      status: inputEvidence?.checkpointReconciliation?.status ?? "NOT_STARTED",
      source: "phase5-2-input-checkpoint-read-only",
      runId: inputEvidence?.checkpointReconciliation?.runId ?? null,
      eventCount: inputEvidence?.checkpointReconciliation?.eventCount ?? 0,
      hashChainRead: inputEvidence?.checkpointReconciliation?.hashChainRead === true,
      lastEventType: inputEvidence?.checkpointReconciliation?.lastEventType ?? null,
      newCheckpointCreated: false,
    },
  });
  const redaction = redactionCheck(evidence);
  evidence.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  evidence.evidenceIntegrity.status = evidence.evidenceIntegrity.redactionCheck === "PASS" &&
    evidence.evidenceIntegrity.sourceIdentityPass &&
    evidence.evidenceIntegrity.inputEvidenceIntegrityPass
    ? "PASS"
    : "BLOCKED";
  return evidence;
}

function parseArguments(argv) {
  const options = {
    descriptor: false,
    run: false,
    writeEvidence: false,
    runId: PHASE_5_3_RUN_ID,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--run-id") options.runId = argv[++index];
    else throw new Error(`phase53_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_3_STAGE_ID,
      planRevision: PHASE_5_3_PLAN_REVISION,
      inputEvidence: PHASE_5_3_INPUT_EVIDENCE_PATH,
      analysisOnly: true,
      newMeasurementStarted: false,
      layers: LAYER_IDS,
      metricDefinitions: METRIC_DEFINITIONS,
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Phase 5.3 layer attribution ready. Use --descriptor or explicit --run.\n");
    return;
  }
  const evidence = buildPhase53Evidence({ runId: options.runId });
  if (options.writeEvidence) {
    writeFileSync(phase53V3EvidencePath(options.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
