#!/usr/bin/env node

/**
 * Read-only alignment of the second trusted J1 interaction across the
 * existing auth-coverage checkpoint. This never starts a browser, server,
 * mutation, or new measurement.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readPhaseRun } from "../../tools/phase-execution/checkpoint-store.mjs";
import { deriveRequestIntervals } from "./performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = resolve(scriptPath, "..");
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const SECOND_ACTION_TIMELINE_PHASE_ID =
  "aiya-performance-plan1-j1-second-action-timeline-analysis-v1";
export const SECOND_ACTION_TIMELINE_SCHEMA_VERSION = SECOND_ACTION_TIMELINE_PHASE_ID;
export const SECOND_ACTION_TIMELINE_PLAN_REVISION = "plan1-final-v3";
export const SECOND_ACTION_TIMELINE_SOURCE_PHASE_ID =
  "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1";
export const SECOND_ACTION_TIMELINE_SOURCE_RUN_ID =
  "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5";
export const SECOND_ACTION_TIMELINE_SOURCE_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5_EVIDENCE.json";
export const SECOND_ACTION_TIMELINE_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const SECOND_ACTION_TIMELINE_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);

const SOURCE_FILES = Object.freeze([
  "app/src/lib/auth-context.ts",
  "app/src/lib/dashboard-server-auth.ts",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/components/dashboard-app.tsx",
  "app/src/lib/use-stage-6-client-workspace.ts",
  "app/src/lib/performance-diagnostic.ts",
  "app/scripts/performance-plan-1-j1-shared-runtime-auth-coverage.mjs",
  "app/scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs",
  "app/scripts/performance-plan-1-j1-second-action-timeline-analysis.mjs",
]);

const SERVER_TIMING_NAMES = Object.freeze([
  "auth",
  "auth_get_user",
  "auth_membership",
  "auth_dietitian",
  "auth_get_session",
  "auth_session_activity",
  "auth_total",
  "entitlement",
  "rate_limit",
  "store",
  "json",
  "route",
]);

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const number = finite(value);
  return number == null ? null : Number(number.toFixed(3));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashFile(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function gitOutput(args) {
  try {
    return execFileSync("git", ["--no-optional-locks", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function sanitizeTimelineRoute(route) {
  return String(route ?? "")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "%3Cuuid%3E",
    )
    .replace(/<uuid>/gi, "%3Cuuid%3E")
    .replace(/([?&]clientId=)[^&]+/gi, "$1%3Cpresent%3E")
    .slice(0, 400);
}

function sourceIdentity() {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  return {
    cwd: repoRoot.replaceAll("\\", "/"),
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    statusLineCount: status ? status.split(/\r?\n/).filter(Boolean).length : 0,
    statusHash: hashText(status),
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
    sourceFiles: SOURCE_FILES.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

function readSourceTrace() {
  const sourceEvidencePath = join(repoRoot, SECOND_ACTION_TIMELINE_SOURCE_EVIDENCE_PATH);
  const sourceEvidence = readJson(sourceEvidencePath);
  const persisted = readPhaseRun({
    root: SECOND_ACTION_TIMELINE_CHECKPOINT_ROOT,
    phaseId: SECOND_ACTION_TIMELINE_SOURCE_PHASE_ID,
    runId: SECOND_ACTION_TIMELINE_SOURCE_RUN_ID,
  });
  const sample = persisted.events
    .filter((event) => event.type === "measurement.unit.trace")
    .at(-1)?.payload;
  if (!sample) throw new Error("second_action_timeline_checkpoint_sample_missing");
  return {
    sourceEvidence,
    sourceEvidenceSha256: hashFile(sourceEvidencePath),
    persisted,
    trace: sample.trace ?? sample,
  };
}

function withinWindow(startAtMs, endAtMs, windowStartMs, windowEndMs) {
  return finite(startAtMs) != null &&
    finite(endAtMs) != null &&
    startAtMs < windowEndMs &&
    windowStartMs < endAtMs;
}

function atOrWithin(value, windowStartMs, windowEndMs) {
  return finite(value) != null && value >= windowStartMs && value <= windowEndMs;
}

function durationFrom(start, end) {
  return finite(start) != null && finite(end) != null ? roundMs(end - start) : null;
}

function routeMatchesRequiredRead(route) {
  return sanitizeTimelineRoute(route).endsWith("/food-rule-profile");
}

function selectedServerTiming(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => SERVER_TIMING_NAMES.includes(String(entry?.name ?? "")))
    .map((entry) => ({
      name: String(entry.name),
      durationMs: roundMs(entry.durationMs),
    }));
}

function normalizeRequest(request) {
  return {
    route: sanitizeTimelineRoute(request.route),
    method: request.method,
    requestKind: request.requestKind,
    startAtMs: request.startAtMs,
    endAtMs: request.endAtMs,
    responseHeaderAtMs: finite(request.responseHeaderAtMs),
    bodyFinishedAtMs: finite(request.bodyFinishedAtMs),
    status: request.status,
    failed: request.failed,
    serverTiming: selectedServerTiming(request.serverTiming),
  };
}

function normalizePhase52Event(event, windowStartMs, atMs) {
  return {
    name: String(event.name ?? "unknown").slice(0, 100),
    relativeAtMs: roundMs(atMs - windowStartMs),
    transition: event.transition == null ? null : String(event.transition).slice(0, 40),
    runtime: event.runtime == null ? null : String(event.runtime).slice(0, 40),
    reason: event.reason == null ? null : String(event.reason).slice(0, 80),
    status: event.status == null ? null : String(event.status).slice(0, 40),
    requestSequence: Number.isInteger(event.requestSequence) ? event.requestSequence : null,
  };
}

function normalizePhase55Event(event, windowStartMs, atMs) {
  return {
    name: String(event.name ?? "unknown").slice(0, 100),
    relativeAtMs: roundMs(atMs - windowStartMs),
    domain: String(event.domain ?? "").slice(0, 40) || null,
    routeSection: String(event.routeSection ?? "").slice(0, 40) || null,
    routeClientTask: String(event.routeClientTask ?? "").slice(0, 40) || null,
    sequence: Number.isInteger(event.sequence) ? event.sequence : null,
    previousSequence: Number.isInteger(event.previousSequence) ? event.previousSequence : null,
    hasPreviousController: event.hasPreviousController === true,
  };
}

function normalizeEventTiming(event, windowStartMs, clockOffsetMs) {
  const startTimeMs = event.startTimeMs + clockOffsetMs;
  const processingStartMs = event.processingStartMs + clockOffsetMs;
  const processingEndMs = event.processingEndMs + clockOffsetMs;
  return {
    name: String(event.name ?? "unknown").slice(0, 24),
    relativeStartMs: roundMs(startTimeMs - windowStartMs),
    processingDelayMs: durationFrom(startTimeMs, processingStartMs),
    processingDurationMs: durationFrom(processingStartMs, processingEndMs),
    durationMs: roundMs(event.durationMs),
    interactionId: Number.isFinite(event.interactionId) ? event.interactionId : null,
  };
}

function normalizeLongTask(event, windowStartMs, clockOffsetMs) {
  return {
    relativeStartMs: roundMs(event.startTimeMs + clockOffsetMs - windowStartMs),
    durationMs: roundMs(event.durationMs),
  };
}

function requiredRequestBoundary(action) {
  const required = Array.isArray(action?.requiredRequestTimings)
    ? action.requiredRequestTimings[0]
    : null;
  if (!required) return null;
  return {
    route: sanitizeTimelineRoute(required.route),
    method: String(required.method ?? "GET").slice(0, 12),
    requestStartAtMs: finite(required.startedAtMs),
    responseHeaderAtMs: finite(required.responseHeaderAtMs),
    responseBodyFinishedAtMs: finite(required.bodyFinishedAtMs),
    status: Number.isInteger(required.status) ? required.status : null,
    failed: required.failed === true,
    failureReason: required.failureReason == null ? null : String(required.failureReason).slice(0, 80),
  };
}

export function deriveSecondActionTimeline(trace) {
  const action = trace?.actions?.second ?? {};
  const trustedAtMs = finite(action.trustedEventAtMs);
  const readyAtMs = finite(action.readyStateAtMs);
  const windowReady = trustedAtMs != null && readyAtMs != null && readyAtMs >= trustedAtMs;
  const bounds = {
    dispatchAtMs: finite(action.dispatchAtMs),
    trustedEventAtMs: trustedAtMs,
    routeCommittedAtMs: finite(action.routeCommittedAtMs),
    requiredRequestStartAtMs: finite(action.requiredRequestStartAtMs),
    requiredResponseHeaderAtMs: finite(action.responseHeaderAtMs),
    requiredResponseBodyFinishedAtMs: finite(action.responseBodyFinishedAtMs),
    readyStateAtMs: readyAtMs,
    parseRenderCompletedAtMs: finite(action.parseRenderCompletedAtMs),
  };
  const requestIntervals = deriveRequestIntervals(trace);
  const overlappingRequests = windowReady
    ? requestIntervals
      .filter((request) => withinWindow(request.startAtMs, request.endAtMs, trustedAtMs, readyAtMs))
      .map(normalizeRequest)
    : [];
  const requiredNetworkRequest = overlappingRequests.find((request) => routeMatchesRequiredRead(request.route)) ?? null;
  const bootstrapRequests = overlappingRequests.filter((request) => request.route === "/api/shell/bootstrap");
  const rscRequests = overlappingRequests.filter((request) => request.requestKind === "rsc");
  const phase52All = Array.isArray(trace?.measurement?.longTasks?.phase52Events)
    ? trace.measurement.longTasks.phase52Events
    : [];
  const traceStartedAtWallMs = finite(trace?.startedAtWallMs);
  const performanceOffsets = phase52All
    .map((event) => finite(event.atWallMs) != null && finite(event.atPerformanceMs) != null && traceStartedAtWallMs != null
      ? event.atWallMs - event.atPerformanceMs - traceStartedAtWallMs
      : null)
    .filter((value) => value != null)
    .sort((left, right) => left - right);
  const performanceClockOffsetMs = performanceOffsets.length >= 2
    ? performanceOffsets[Math.floor(performanceOffsets.length / 2)]
    : null;
  const performanceClockSpreadMs = performanceOffsets.length >= 2
    ? roundMs(performanceOffsets.at(-1) - performanceOffsets[0])
    : null;
  const performanceClockStatus = performanceClockOffsetMs == null
    ? "UNAVAILABLE"
    : performanceClockSpreadMs <= 5
      ? "ALIGNED"
      : "UNCERTAIN";
  const phase52AtTraceMs = (event) => finite(event.atWallMs) != null && traceStartedAtWallMs != null
    ? event.atWallMs - traceStartedAtWallMs
    : performanceClockStatus === "ALIGNED" && finite(event.atPerformanceMs) != null
      ? event.atPerformanceMs + performanceClockOffsetMs
      : null;
  const phase52Window = windowReady
    ? phase52All
      .filter((event) => atOrWithin(phase52AtTraceMs(event), trustedAtMs, readyAtMs))
      .map((event) => normalizePhase52Event(event, trustedAtMs, phase52AtTraceMs(event)))
    : [];
  const profilerEventsAll = phase52All.filter((event) => event.name === "react_commit");
  const contextEvents = phase52Window.filter((event) => event.name.includes("context"));
  const phase55All = Array.isArray(trace?.measurement?.longTasks?.phase55Events)
    ? trace.measurement.longTasks.phase55Events
    : [];
  const phase55Window = windowReady
    ? phase55All
      .filter((event) => atOrWithin(phase52AtTraceMs(event), trustedAtMs, readyAtMs))
      .map((event) => normalizePhase55Event(event, trustedAtMs, phase52AtTraceMs(event)))
    : [];
  const eventTimingsAll = Array.isArray(trace?.measurement?.longTasks?.eventTimings)
    ? trace.measurement.longTasks.eventTimings
    : [];
  const eventTimingsWindow = windowReady && performanceClockStatus === "ALIGNED"
    ? eventTimingsAll
      .filter((event) => atOrWithin(event.startTimeMs + performanceClockOffsetMs, trustedAtMs, readyAtMs))
      .map((event) => normalizeEventTiming(event, trustedAtMs, performanceClockOffsetMs))
    : null;
  const longTasksAll = Array.isArray(trace?.measurement?.longTasks?.longTasks)
    ? trace.measurement.longTasks.longTasks
    : [];
  const longTasksWindow = windowReady && performanceClockStatus === "ALIGNED"
    ? longTasksAll
      .filter((event) => withinWindow(
        event.startTimeMs + performanceClockOffsetMs,
        event.startTimeMs + performanceClockOffsetMs + (finite(event.durationMs) ?? 0),
        trustedAtMs,
        readyAtMs,
      ))
      .map((event) => normalizeLongTask(event, trustedAtMs, performanceClockOffsetMs))
    : null;
  const postReadyLongTask = windowReady && performanceClockStatus === "ALIGNED"
    ? longTasksAll
      .filter((event) => finite(event.startTimeMs) != null &&
        event.startTimeMs + performanceClockOffsetMs >= readyAtMs)
      .sort((left, right) => left.startTimeMs - right.startTimeMs)[0]
    : null;
  const requiredBoundary = requiredRequestBoundary(action);
  const requiredToNetworkStartDeltaMs = requiredBoundary && requiredNetworkRequest
    ? roundMs(requiredBoundary.requestStartAtMs - requiredNetworkRequest.startAtMs)
    : null;
  const requiredToNetworkHeaderDeltaMs = requiredBoundary && requiredNetworkRequest?.responseHeaderAtMs != null
    ? roundMs(requiredBoundary.responseHeaderAtMs - requiredNetworkRequest.responseHeaderAtMs)
    : null;
  const requiredToNetworkBodyDeltaMs = requiredBoundary?.responseBodyFinishedAtMs != null && requiredNetworkRequest?.bodyFinishedAtMs != null
    ? roundMs(requiredBoundary.responseBodyFinishedAtMs - requiredNetworkRequest.bodyFinishedAtMs)
    : null;
  const largestBoundedSegment = [
    {
      segment: "trusted_to_required_response_body",
      durationMs: durationFrom(trustedAtMs, bounds.requiredResponseBodyFinishedAtMs),
    },
    {
      segment: "required_body_to_ready",
      durationMs: durationFrom(bounds.requiredResponseBodyFinishedAtMs, readyAtMs),
    },
    {
      segment: "ready_to_parse_render_complete",
      durationMs: durationFrom(readyAtMs, bounds.parseRenderCompletedAtMs),
    },
  ]
    .filter((entry) => finite(entry.durationMs) != null)
    .sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;

  return {
    status: windowReady ? "COMPLETE" : "NOT_EVALUABLE",
    windowClock: "trace action and paired wall-clock events; performance entries are aligned from paired wall/performance samples",
    window: {
      trustedEventAtMs: trustedAtMs,
      readyStateAtMs: readyAtMs,
      trustedToReadyMs: durationFrom(trustedAtMs, readyAtMs),
    },
    actionBoundaries: bounds,
    actionDurations: {
      dispatchToTrustedMs: durationFrom(bounds.dispatchAtMs, trustedAtMs),
      trustedToRouteCommittedMs: durationFrom(trustedAtMs, bounds.routeCommittedAtMs),
      trustedToRequiredRequestStartMs: durationFrom(trustedAtMs, bounds.requiredRequestStartAtMs),
      trustedToRequiredResponseHeaderMs: durationFrom(trustedAtMs, bounds.requiredResponseHeaderAtMs),
      trustedToRequiredBodyFinishedMs: durationFrom(trustedAtMs, bounds.requiredResponseBodyFinishedAtMs),
      requiredBodyToReadyMs: durationFrom(bounds.requiredResponseBodyFinishedAtMs, readyAtMs),
      readyToParseRenderCompleteMs: durationFrom(readyAtMs, bounds.parseRenderCompletedAtMs),
    },
    requiredRequest: requiredBoundary,
    requests: {
      clockAlignment: {
        requestTimebase: trace?.measurement?.requestSummary?.requestTimebase ?? "historical_or_unspecified",
        requestOrigin: requestIntervals[0]?.clockOrigin ?? "unavailable",
        inferredSpreadMs: requestIntervals[0]?.clockOriginSpreadMs ?? null,
      },
      overlapCount: overlappingRequests.length,
      apiCount: overlappingRequests.filter((request) => request.route.startsWith("/api/")).length,
      rscCount: rscRequests.length,
      requiredNetworkRequest,
      bootstrapRequests,
      rscRequests,
      all: overlappingRequests,
      requiredBoundaryToRequestSummaryDeltaMs: {
        requestStart: requiredToNetworkStartDeltaMs,
        responseHeader: requiredToNetworkHeaderDeltaMs,
        responseBody: requiredToNetworkBodyDeltaMs,
        note: "Non-zero deltas are retained as instrumentation-boundary differences; the two timing sources are not silently merged.",
      },
    },
    browserWork: {
      phase52Events: phase52Window,
      contextEvents,
      contextCommitCount: contextEvents.filter((event) => event.name.endsWith("context_state_committed")).length,
      reactProfilerCommitEventCountInWindow: phase52Window.filter((event) => event.name === "react_commit").length,
      reactProfilerCommitEventCountFullTrace: profilerEventsAll.length,
      reactProfilerClockAvailability: profilerEventsAll.length > 0 ? "AVAILABLE_SOMEWHERE_IN_TRACE" : "NOT_OBSERVED_IN_TRACE",
      phase55Events: phase55Window,
      eventTimings: eventTimingsWindow,
      longTasksInWindow: longTasksWindow,
      performanceClock: {
        status: performanceClockStatus,
        pairedSamples: performanceOffsets.length,
        offsetMs: performanceClockOffsetMs == null ? null : roundMs(performanceClockOffsetMs),
        spreadMs: performanceClockSpreadMs,
      },
      fullTraceLongTaskCount: longTasksAll.length,
      firstLongTaskStartingAtOrAfterReady: postReadyLongTask
        ? {
            relativeToTrustedMs: roundMs(postReadyLongTask.startTimeMs + performanceClockOffsetMs - trustedAtMs),
            relativeToReadyMs: roundMs(postReadyLongTask.startTimeMs + performanceClockOffsetMs - readyAtMs),
            durationMs: roundMs(postReadyLongTask.durationMs),
          }
        : null,
      postReadyLongTaskStatus: performanceClockStatus,
    },
    segments: {
      largestDirectlyBoundedSegment: largestBoundedSegment,
      interpretation: "The largest bounded segment is descriptive for this trace; overlapping requests and context events do not establish causality.",
    },
  };
}

export function classifySecondActionTimeline(timeline) {
  if (timeline?.status !== "COMPLETE") return "SECOND_ACTION_TIMELINE_NOT_EVALUABLE";
  const networkMs = timeline.actionDurations.trustedToRequiredBodyFinishedMs;
  const postBodyMs = timeline.actionDurations.requiredBodyToReadyMs;
  const contextObserved = timeline.browserWork.contextCommitCount > 0;
  const profilerObserved = timeline.browserWork.reactProfilerCommitEventCountInWindow > 0;
  const longTasksAbsent = Array.isArray(timeline.browserWork.longTasksInWindow) &&
    timeline.browserWork.longTasksInWindow.length === 0;
  if (networkMs != null && postBodyMs != null && networkMs > postBodyMs) {
    if (contextObserved && !profilerObserved && longTasksAbsent) {
      return "NETWORK_SERVER_FIRST_WITH_CONTEXT_TAIL_MAIN_THREAD_CAUSE_UNRESOLVED";
    }
    return "NETWORK_SERVER_FIRST_WITH_POST_BODY_READY_TAIL_UNRESOLVED";
  }
  return "POST_BODY_READY_TAIL_OR_MAIN_THREAD_BOUNDARY_REQUIRES_CONTROLLED_COMPARISON";
}

function makeRunId() {
  return `${SECOND_ACTION_TIMELINE_PHASE_ID}-${new Date().toISOString().replaceAll(/[-:.]/g, "")}`;
}

function evidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("second_action_timeline_run_id_invalid");
  }
  return join(repoRoot, `${SECOND_ACTION_TIMELINE_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

export function buildSecondActionTimelineEvidence({
  runId = makeRunId(),
  generatedAt = new Date().toISOString(),
} = {}) {
  const source = readSourceTrace();
  const timeline = deriveSecondActionTimeline(source.trace);
  const outcome = classifySecondActionTimeline(timeline);
  const validSample = source.trace?.measurement?.validSample === true;
  const functionalOutcome = source.trace?.functionalOutcome ?? source.trace?.measurement?.functionalOutcome ?? null;
  const observationValidity = source.trace?.observationValidity ?? source.trace?.measurement?.observationValidity ?? null;
  return {
    schemaVersion: SECOND_ACTION_TIMELINE_SCHEMA_VERSION,
    planRevision: SECOND_ACTION_TIMELINE_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-second-action-timeline-analysis",
    stageId: SECOND_ACTION_TIMELINE_PHASE_ID,
    runId,
    generatedAt,
    status: "COMPLETE",
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Align the existing current-source J1 second trusted interaction with request intervals, server timing, route/state events, browser event timing, long tasks, and available React/context commit evidence.",
      analysisOnly: true,
      browserRerunStarted: false,
      applicationRuntimeChanged: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      sourceMeasurementRunId: SECOND_ACTION_TIMELINE_SOURCE_RUN_ID,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: SECOND_ACTION_TIMELINE_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    sourceIdentity: sourceIdentity(),
    sourceMeasurement: {
      runId: SECOND_ACTION_TIMELINE_SOURCE_RUN_ID,
      evidencePath: SECOND_ACTION_TIMELINE_SOURCE_EVIDENCE_PATH,
      evidenceSha256: source.sourceEvidenceSha256,
      status: source.sourceEvidence.status,
      outcome: source.sourceEvidence.outcome,
      validity: source.sourceEvidence.validity,
      checkpoint: {
        phaseId: SECOND_ACTION_TIMELINE_SOURCE_PHASE_ID,
        status: source.persisted.manifest?.status ?? null,
        eventCount: source.persisted.events.length,
        lastEventType: source.persisted.events.at(-1)?.type ?? null,
        hashChainRead: true,
      },
    },
    validity: {
      sourceTrace: validSample && observationValidity === "VALID" && functionalOutcome === "SUCCESS"
        ? "1/1 valid functional J1 trace"
        : "0/1 valid functional J1 trace",
      observationValidity,
      functionalOutcome,
      validSample,
      officialSample: false,
      secondActionBoundary: timeline.status,
    },
    measurement: {
      journeyId: source.trace?.journeyId ?? "J1",
      unitKey: source.trace?.measurement?.unitKey ?? null,
      timeline,
    },
    interpretation: "In this one valid current-source trace, the largest directly bounded interval is the trusted interaction through required response-body completion. The required food-rule-profile read and a concurrent shell bootstrap carried server timing, while context-state commits were observed before ready. No React profiler commit event or long task was observed inside the second-action window, so the post-body readiness tail and the proposed global commit storm remain unresolved.",
    evidenceGaps: [
      "This is one diagnostic trace, not the required repeated causal record.",
      "The request-summary clock and action timing clock retain measurable boundary deltas; they are reported separately rather than silently combined.",
      "The client-detail request had no response timing and the dashboard RSC request ended as failed/aborted, so server continuation is not measured.",
      "No React profiler commit event was present in this trace, so context-state commits cannot be converted into a React render-duration claim.",
    ],
    explicitNonClaims: [
      "The trace does not confirm the global freeze root cause.",
      "Auth timing and request fan-out co-occurrence are not a causal proof or an accepted runtime fix.",
      "No performance recovery, finding-disposition change, Plan 2 entry, or production approval follows.",
    ],
    closure: {
      status: "COMPLETE",
      outcome,
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
    },
    nextAction: "Use this aligned boundary to choose one separately authorized controlled comparison: required-read/server scheduling or post-response state/commit scheduling. Hold the other boundary and request fan-out constant; do not combine variables or claim a root cause from this single trace.",
  };
}

function parseArguments(argv) {
  const options = { run: false, writeEvidence: false, runId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--run-id") options.runId = argv[++index];
    else if (arg === "--help") {
      process.stdout.write("Use --run --write-evidence for read-only checkpoint timeline analysis.\n");
      return null;
    } else throw new Error(`second_action_timeline_argument_invalid:${arg}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) return;
  if (!options.run) {
    process.stdout.write("J1 second-action timeline analysis ready. Use --run explicitly.\n");
    return;
  }
  const evidence = buildSecondActionTimelineEvidence({ runId: options.runId || undefined });
  if (options.writeEvidence) writeFileSync(evidencePath(evidence.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  }
}
