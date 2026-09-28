#!/usr/bin/env node

/**
 * Derive a bounded request/auth/React timeline from an existing completed
 * shared-runtime trace. This is analysis-only: it does not start a server,
 * open a browser, or change application behavior.
 */

import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizePhase44Evidence } from "./performance-plan-1-phase-4-4-local.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = resolve(scriptPath, "..");
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const AUTH_FANOUT_COMMIT_OVERLAP_PLAN_REVISION = "plan1-final-v3";
export const AUTH_FANOUT_COMMIT_OVERLAP_PHASE_ID =
  "aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap";
export const AUTH_FANOUT_COMMIT_OVERLAP_SCHEMA_VERSION =
  "aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap-v1";
export const AUTH_FANOUT_COMMIT_OVERLAP_DEFAULT_SOURCE_EVIDENCE =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260920T192740772Z-0263538b-baee-4e08-8668-eed92fd2cd6d_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json";
export const AUTH_FANOUT_COMMIT_OVERLAP_TARGET_JOURNEY = "J1";
export const AUTH_FANOUT_COMMIT_OVERLAP_AUTH_STAGES = Object.freeze([
  "auth_get_user",
  "auth_membership",
  "auth_dietitian",
  "auth_get_session",
  "auth_session_activity",
]);

const WINDOW_DEFINITIONS = Object.freeze({
  firstToSecondTrusted: "first trusted interaction through second trusted interaction",
  firstToSecondReady: "first trusted interaction through second ready state",
  secondAction: "second trusted interaction through second ready state",
});

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const number = finite(value);
  return number == null ? null : Number(number.toFixed(3));
}

function median(values) {
  const sorted = values.filter((value) => finite(value) != null).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundMs((sorted[middle - 1] + sorted[middle]) / 2)
    : roundMs(sorted[middle]);
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

function sourcePathFromEvidence(relativePath) {
  return join(repoRoot, relativePath);
}

function sanitizeObservedRoute(value) {
  return String(value ?? "")
    .slice(0, 240)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<redacted-email>")
    .replace(/([?&](?:token|secret|key|code|state)=)[^&]+/gi, "$1<redacted>");
}

function safeServerTiming(record) {
  return (Array.isArray(record?.serverTiming) ? record.serverTiming : [])
    .filter((entry) => /^[A-Za-z0-9._-]{1,80}$/.test(String(entry?.name ?? "")))
    .map((entry) => ({
      name: String(entry.name),
      durationMs: roundMs(Math.max(0, finite(entry.durationMs) ?? 0)),
    }));
}

function serverTimingDuration(record, name) {
  return safeServerTiming(record).find((entry) => entry.name === name)?.durationMs ?? null;
}

function requestEndAtMs(record) {
  return record?.bodyFinishedAtMs ?? record?.responseHeaderAtMs ?? record?.startedAtMs ?? null;
}

export function deriveRequestIntervals(trace) {
  const measurement = trace?.measurement ?? {};
  const requestSummary = measurement.requestSummary ?? {};
  const traceStartedAtWallMs = finite(trace?.startedAtWallMs);
  let requestTimeOriginWallMs = finite(requestSummary.requestTimeOriginWallMs);
  let requestTimeOriginSource = requestTimeOriginWallMs == null ? null : "captured";
  let requestTimeOriginSpreadMs = null;
  if (requestTimeOriginWallMs == null && requestSummary.requestTimebase === "first_request_relative") {
    const requestRecords = Array.isArray(requestSummary.requests) ? requestSummary.requests : [];
    const candidates = [trace?.actions?.first, trace?.actions?.second]
      .flatMap((action) => action?.requiredRequestTimings ?? [])
      .flatMap((required) => requestRecords
        .filter((record) => record.method === required.method && record.route === required.route)
        .map((record) => traceStartedAtWallMs + required.startedAtMs - record.startedAtMs));
    if (candidates.length) {
      candidates.sort((left, right) => left - right);
      requestTimeOriginSpreadMs = roundMs(candidates.at(-1) - candidates[0]);
      if (requestTimeOriginSpreadMs <= 5) {
        requestTimeOriginWallMs = candidates[Math.floor(candidates.length / 2)];
        requestTimeOriginSource = "required_read_inferred";
      } else {
        return [];
      }
    }
  }
  if (requestTimeOriginWallMs == null) {
    requestTimeOriginWallMs = finite(requestSummary.captureStartedAtWallMs);
    requestTimeOriginSource = requestTimeOriginWallMs == null ? "unavailable" : "legacy_capture_fallback";
  }
  if (traceStartedAtWallMs == null || requestTimeOriginWallMs == null) return [];

  return (Array.isArray(requestSummary.requests) ? requestSummary.requests : [])
    .map((record, index) => {
      const startedAtMs = finite(record?.startedAtMs);
      const endAtMs = finite(requestEndAtMs(record));
      if (startedAtMs == null || endAtMs == null) return null;
      const start = requestTimeOriginWallMs + startedAtMs - traceStartedAtWallMs;
      const end = requestTimeOriginWallMs + endAtMs - traceStartedAtWallMs;
      const responseHeaderAtMs = finite(record?.responseHeaderAtMs);
      const bodyFinishedAtMs = finite(record?.bodyFinishedAtMs);
      return {
        index,
        route: sanitizeObservedRoute(record.route),
        method: String(record.method ?? "GET").slice(0, 12),
        requestKind: String(record.requestKind ?? "unknown").slice(0, 24),
        startAtMs: roundMs(start),
        endAtMs: roundMs(Math.max(start, end)),
        clockOrigin: requestTimeOriginSource,
        clockOriginSpreadMs: requestTimeOriginSpreadMs,
        responseHeaderAtMs: responseHeaderAtMs == null
          ? null
          : roundMs(requestTimeOriginWallMs + responseHeaderAtMs - traceStartedAtWallMs),
        bodyFinishedAtMs: bodyFinishedAtMs == null
          ? null
          : roundMs(requestTimeOriginWallMs + bodyFinishedAtMs - traceStartedAtWallMs),
        status: Number.isInteger(record.status) ? record.status : null,
        failed: record.failed === true,
        serverTiming: safeServerTiming(record),
      };
    })
    .filter(Boolean);
}

function overlaps(interval, startAtMs, endAtMs) {
  return finite(interval?.startAtMs) != null &&
    finite(interval?.endAtMs) != null &&
    finite(startAtMs) != null &&
    finite(endAtMs) != null &&
    interval.startAtMs < endAtMs &&
    startAtMs < interval.endAtMs;
}

function isApiRequest(request) {
  return String(request?.route ?? "").startsWith("/api/");
}

function isRscRequest(request) {
  return request?.requestKind === "rsc";
}

function windowBounds(trace) {
  const firstTrusted = finite(trace?.actions?.first?.trustedEventAtMs);
  const secondTrusted = finite(trace?.actions?.second?.trustedEventAtMs);
  const secondReady = finite(trace?.actions?.second?.readyStateAtMs);
  return {
    firstToSecondTrusted: [firstTrusted, secondTrusted],
    firstToSecondReady: [firstTrusted, secondReady],
    secondAction: [secondTrusted, secondReady],
  };
}

function summarizeRequestsForWindow(requests, bounds) {
  const matching = requests.filter((request) => overlaps(request, bounds[0], bounds[1]));
  const apiRequests = matching.filter(isApiRequest);
  const rscRequests = matching.filter(isRscRequest);
  const timedApiRequests = apiRequests.filter((request) => serverTimingDuration(request, "auth_total") != null);
  const authStages = Object.fromEntries(
    AUTH_FANOUT_COMMIT_OVERLAP_AUTH_STAGES.map((stage) => [
      stage,
      roundMs(timedApiRequests.reduce(
        (total, request) => total + (serverTimingDuration(request, stage) ?? 0),
        0,
      )),
    ]),
  );
  const authTotalMs = roundMs(timedApiRequests.reduce(
    (total, request) => total + (serverTimingDuration(request, "auth_total") ?? 0),
    0,
  ));
  const entitlementMs = roundMs(timedApiRequests.reduce(
    (total, request) => total + (serverTimingDuration(request, "entitlement") ?? 0),
    0,
  ));
  const derivedAuthSpans = timedApiRequests.map((request) => {
    const authTotal = serverTimingDuration(request, "auth_total");
    return {
      route: request.route,
      startAtMs: request.startAtMs,
      endAtMs: roundMs(request.startAtMs + authTotal),
      placement: "request_start_plus_auth_total; inferred from sequential route timing",
    };
  });

  return {
    totalRequestCount: matching.length,
    apiRequestCount: apiRequests.length,
    rscRequestCount: rscRequests.length,
    documentRequestCount: matching.filter((request) => request.requestKind === "document").length,
    uniqueRoutes: [...new Set(matching.map((request) => request.route))].sort(),
    timedApiRequestCount: timedApiRequests.length,
    untimedApiRequestCount: Math.max(0, apiRequests.length - timedApiRequests.length),
    authTimingCoverage: apiRequests.length
      ? roundMs(timedApiRequests.length / apiRequests.length)
      : null,
    authTotalMs,
    authStages,
    entitlementMs,
    derivedAuthSpanCount: derivedAuthSpans.length,
    derivedAuthSpansOverlappingWindow: derivedAuthSpans.filter((span) =>
      overlaps(span, bounds[0], bounds[1]),
    ).length,
    derivedAuthSpanPlacement: "diagnostic inference only; Server-Timing exposes duration, not sub-span timestamps",
    requests: matching.map((request) => ({
      route: request.route,
      method: request.method,
      requestKind: request.requestKind,
      startAtMs: request.startAtMs,
      endAtMs: request.endAtMs,
      status: request.status,
      failed: request.failed,
      authTotalMs: serverTimingDuration(request, "auth_total"),
      serverTimingNames: request.serverTiming.map((entry) => entry.name),
    })),
  };
}

function phase52EventsRelativeToTrace(trace) {
  const traceStartedAtWallMs = finite(trace?.startedAtWallMs);
  if (traceStartedAtWallMs == null) return [];
  const events = trace?.measurement?.longTasks?.phase52Events;
  return (Array.isArray(events) ? events : [])
    .map((event) => {
      const atWallMs = finite(event?.atWallMs);
      if (atWallMs == null) return null;
      return {
        name: String(event.name ?? "unknown").slice(0, 80),
        atMs: roundMs(atWallMs - traceStartedAtWallMs),
        profilerId: event.profilerId == null ? null : String(event.profilerId).slice(0, 80),
        phase: event.phase == null ? null : String(event.phase).slice(0, 32),
        actualDurationMs: roundMs(event.actualDurationMs),
        commitTimeMs: roundMs(event.commitTimeMs),
      };
    })
    .filter(Boolean);
}

function summarizeReactForWindow(trace, bounds) {
  const events = phase52EventsRelativeToTrace(trace)
    .filter((event) => event.atMs >= bounds[0] && event.atMs <= bounds[1]);
  const profilerCommits = events.filter((event) => event.name === "react_commit");
  const commitWaveKeys = new Set(
    profilerCommits
      .map((event) => event.commitTimeMs)
      .filter((value) => finite(value) != null)
      .map((value) => value.toFixed(3)),
  );
  const profilerEventCounts = {};
  const actualDurationByProfilerMs = {};
  for (const event of profilerCommits) {
    const profilerId = event.profilerId ?? "unknown";
    profilerEventCounts[profilerId] = (profilerEventCounts[profilerId] ?? 0) + 1;
    actualDurationByProfilerMs[profilerId] = roundMs(
      (actualDurationByProfilerMs[profilerId] ?? 0) + (event.actualDurationMs ?? 0),
    );
  }
  const contextEvents = events.filter((event) => event.name !== "react_commit");
  return {
    profilerCommitEventCount: profilerCommits.length,
    commitWaveCount: commitWaveKeys.size,
    profilerEventCounts,
    actualDurationByProfilerMs,
    contextEventCounts: Object.fromEntries(
      Object.entries(contextEvents.reduce((counts, event) => {
        counts[event.name] = (counts[event.name] ?? 0) + 1;
        return counts;
      }, {})).sort(([left], [right]) => left.localeCompare(right)),
    ),
    firstCommitAtMs: profilerCommits[0]?.atMs ?? null,
    lastCommitAtMs: profilerCommits.at(-1)?.atMs ?? null,
    fullTraceLongTaskCount: finite(trace?.measurement?.longTasks?.longTaskCount) ?? null,
    longTaskWindowCorrelation: "not_evaluated; browser long-task timestamps use a different clock in the source trace",
  };
}

export function analyzeAuthFanoutCommitTrace(trace) {
  const bounds = windowBounds(trace);
  const requests = deriveRequestIntervals(trace);
  const windows = Object.fromEntries(
    Object.entries(bounds).map(([name, range]) => [
      name,
      range.every((value) => finite(value) != null)
        ? summarizeRequestsForWindow(requests, range)
        : { status: "NOT_EVALUABLE", reason: "required_action_boundary_missing" },
    ]),
  );
  const secondRange = bounds.secondAction;
  const react = secondRange.every((value) => finite(value) != null)
    ? summarizeReactForWindow(trace, secondRange)
    : { status: "NOT_EVALUABLE", reason: "second_action_boundary_missing" };
  return {
    unitKey: trace?.measurement?.unitKey ?? null,
    journeyId: trace?.journeyId ?? null,
    validSample: trace?.measurement?.validSample === true,
    functionalOutcome: trace?.functionalOutcome ?? null,
    observationValidity: trace?.observationValidity ?? null,
    secondActionTailMs: secondRange.every((value) => finite(value) != null)
      ? roundMs(secondRange[1] - secondRange[0])
      : null,
    windows,
    secondActionReact: react,
    requestSource: {
      requestSummaryCount: trace?.measurement?.requestSummary?.requestCount ?? null,
      requestBodyFinishTimedOut: trace?.measurement?.requestSummary?.bodyFinishTimedOut ?? null,
    },
  };
}

function aggregateMetric(records, selector) {
  const values = records.map(selector).filter((value) => finite(value) != null);
  return {
    count: values.length,
    min: values.length ? roundMs(Math.min(...values)) : null,
    median: median(values),
    max: values.length ? roundMs(Math.max(...values)) : null,
  };
}

function currentRuntimeSourceComparison(sourceEvidence) {
  const sourceFiles = Array.isArray(sourceEvidence?.sourceIdentity?.sourceFiles)
    ? sourceEvidence.sourceIdentity.sourceFiles
    : [];
  const runtimeFiles = sourceFiles.filter((entry) => String(entry.path).startsWith("app/src/"));
  const comparisons = runtimeFiles.map((entry) => {
    const currentSha256 = hashFile(sourcePathFromEvidence(entry.path));
    return {
      path: entry.path,
      evidenceSha256: entry.sha256,
      currentSha256,
      match: currentSha256 != null && currentSha256 === entry.sha256,
    };
  });
  return {
    checkedCount: comparisons.length,
    matchCount: comparisons.filter((entry) => entry.match).length,
    mismatchCount: comparisons.filter((entry) => !entry.match).length,
    allRuntimeFilesMatch: comparisons.length > 0 && comparisons.every((entry) => entry.match),
    files: comparisons,
    note: "Runtime app source hashes are compared separately from the historical harness/document hashes.",
  };
}

export function buildAuthFanoutCommitOverlapEvidence({
  sourceEvidence,
  sourceEvidencePath,
  runId = `aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap-v1-${new Date()
    .toISOString()
    .replace(/[-:.]/g, "")}-${randomUUID()}`,
  generatedAt = new Date().toISOString(),
} = {}) {
  const observations = (sourceEvidence?.diagnosticObservations ?? [])
    .filter((trace) => trace?.journeyId === AUTH_FANOUT_COMMIT_OVERLAP_TARGET_JOURNEY && trace?.validSample === true)
    .map((observation) => analyzeAuthFanoutCommitTrace(observation.trace ?? observation));
  const blockers = [];
  if (!sourceEvidence || typeof sourceEvidence !== "object") blockers.push("source_evidence_missing");
  if (sourceEvidence?.status !== "COMPLETE") blockers.push("source_evidence_not_complete");
  if (observations.length < 3) blockers.push("fewer_than_three_valid_j1_observations");
  if (sourceEvidence?.sourceIdentity?.head !== gitOutput(["rev-parse", "HEAD"])) {
    blockers.push("source_head_differs_from_current_head");
  }

  const firstToSecond = observations.map((observation) => observation.windows.firstToSecondTrusted);
  const secondAction = observations.map((observation) => observation.windows.secondAction);
  const allSecondActionCommitWaves = observations.every((observation) =>
    observation.secondActionReact.commitWaveCount > 0,
  );
  const allFanoutObserved = observations.every((observation) =>
    observation.windows.firstToSecondTrusted.apiRequestCount > 0 &&
    observation.windows.firstToSecondTrusted.rscRequestCount > 0,
  );
  const coverageIncomplete = observations.some((observation) =>
    observation.windows.firstToSecondTrusted.authTimingCoverage < 1 ||
    observation.windows.secondAction.authTimingCoverage < 1,
  );
  const status = blockers.length ? "BLOCKED" : "COMPLETE";
  const outcome = blockers.length
    ? "AUTH_FANOUT_COMMIT_OVERLAP_ANALYSIS_BLOCKED"
    : "AUTH_FANOUT_COMMIT_OVERLAP_OBSERVED_AUTH_COVERAGE_INCOMPLETE_GLOBAL_FREEZE_UNRESOLVED";

  return sanitizePhase44Evidence({
    schemaVersion: AUTH_FANOUT_COMMIT_OVERLAP_SCHEMA_VERSION,
    planRevision: AUTH_FANOUT_COMMIT_OVERLAP_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "shared-runtime-auth-fanout-commit-overlap-analysis",
    stageId: AUTH_FANOUT_COMMIT_OVERLAP_PHASE_ID,
    runId,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Correlate one real authenticated J1 interaction's request fan-out, available API auth timing, RSC intervals, and React commit waves.",
      analysisOnly: true,
      browserRerunStarted: false,
      applicationRuntimeChanged: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      fixture: "local-normal synthetic owner from completed shared-runtime evidence",
      targetJourney: AUTH_FANOUT_COMMIT_OVERLAP_TARGET_JOURNEY,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: AUTH_FANOUT_COMMIT_OVERLAP_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    hypothesisBoundary: {
      statement: "A single client interaction may create overlapping API/RSC work whose available auth spans and React commit waves occupy the second-action boundary.",
      tested: [
        "first-click-to-second-click request fan-out is present",
        "second-action window contains tracked API/RSC requests",
        "available API auth timing and React commit events can be aligned on one trace clock",
      ],
      notTested: [
        "every API route's auth chain, because most routes do not emit Server-Timing auth stages",
        "server-side RSC resolveDashboardAuth stage timings",
        "causality, because no single variable was changed",
      ],
    },
    sourceEvidence: {
      runId: sourceEvidence?.runId ?? null,
      path: sourceEvidencePath ?? null,
      sha256: sourceEvidencePath ? hashFile(sourceEvidencePath) : null,
      sourceHead: sourceEvidence?.sourceIdentity?.head ?? null,
      sourceBranch: sourceEvidence?.sourceIdentity?.branch ?? null,
      sourceMeasurementStatus: sourceEvidence?.status ?? null,
      sourceCheckpoint: sourceEvidence?.measurementIdentity ?? null,
      runtimeSourceComparison: currentRuntimeSourceComparison(sourceEvidence),
      analysisRunnerPath: "app/scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs",
      analysisRunnerSha256: hashFile(scriptPath),
    },
    windowContract: {
      definitions: WINDOW_DEFINITIONS,
      requestIntervalClock: "captureStartedAtWallMs + request-relative time - trace.startedAtWallMs",
      reactEventClock: "phase52 event atWallMs - trace.startedAtWallMs",
      authSpanPlacement: "request start through request start plus auth_total; inferred because Server-Timing provides duration only",
      nestedReactProfilerHandling: "report raw profiler events and distinct commitTimeMs waves separately; do not sum nested profiler durations as CPU time",
    },
    stageLedger: [
      { stageId: "AFC.1", name: "Source evidence and runtime hash check", status: sourceEvidence ? "COMPLETE" : "BLOCKED" },
      { stageId: "AFC.2", name: "Three valid J1 observation selection", status: observations.length >= 3 ? "COMPLETE" : "BLOCKED" },
      { stageId: "AFC.3", name: "Request/auth/React clock alignment", status: observations.length >= 3 ? "COMPLETE" : "BLOCKED" },
      { stageId: "AFC.4", name: "Coverage and causal boundary", status: status },
    ],
    validity: {
      sourceObservationsAvailable: observations.length,
      validFunctionalObservations: observations.filter((observation) => observation.functionalOutcome === "SUCCESS").length,
      observationValid: observations.length >= 3 ? "3/3 selected J1 observations" : `${observations.length}/3 selected J1 observations`,
      allFanoutObserved,
      allSecondActionCommitWaves,
      authTimingCoverageIncomplete: coverageIncomplete,
      firstToSecondApiRequestCount: firstToSecond.map((window) => window.apiRequestCount),
      firstToSecondRscRequestCount: firstToSecond.map((window) => window.rscRequestCount),
      secondActionApiRequestCount: secondAction.map((window) => window.apiRequestCount),
      secondActionRscRequestCount: secondAction.map((window) => window.rscRequestCount),
    },
    observations,
    aggregate: {
      firstToSecondTrustedApiRequests: aggregateMetric(observations, (observation) => observation.windows.firstToSecondTrusted.apiRequestCount),
      firstToSecondTrustedRscRequests: aggregateMetric(observations, (observation) => observation.windows.firstToSecondTrusted.rscRequestCount),
      firstToSecondTrustedTimedApiRequests: aggregateMetric(observations, (observation) => observation.windows.firstToSecondTrusted.timedApiRequestCount),
      firstToSecondTrustedAuthTimingCoverage: aggregateMetric(observations, (observation) => observation.windows.firstToSecondTrusted.authTimingCoverage),
      secondActionApiRequests: aggregateMetric(observations, (observation) => observation.windows.secondAction.apiRequestCount),
      secondActionRscRequests: aggregateMetric(observations, (observation) => observation.windows.secondAction.rscRequestCount),
      secondActionAuthTotalMs: aggregateMetric(observations, (observation) => observation.windows.secondAction.authTotalMs),
      secondActionReactCommitWaves: aggregateMetric(observations, (observation) => observation.secondActionReact.commitWaveCount),
      secondActionTailMs: aggregateMetric(observations, (observation) => observation.secondActionTailMs),
    },
    interpretation: {
      supported: "Across three valid J1 traces from the same runtime source, the first-click-to-second-click interval contained 7-10 API and 9-13 RSC requests, while the second-action interval contained 2 API and 1 RSC request in every trace. React commit waves were present in all three second-action windows.",
      authChainObservation: "Available Server-Timing showed auth_total and component stages on only a subset of API requests; this records measurable auth cost but cannot support the claim that every API request paid the full chain.",
      rscObservation: "RSC request intervals were visible at the browser boundary, but resolveDashboardAuth stage timing was not emitted for those responses.",
      causalStatus: "INCONCLUSIVE; the record is observational and did not perturb one variable.",
      globalFreezeResolved: false,
      rootCauseConfirmed: false,
    },
    evidenceGaps: [
      "Uninstrumented API routes prevent complete per-request auth-chain coverage.",
      "The browser trace has no server-side resolveDashboardAuth timing for RSC/document responses.",
      "Long-task timestamps in the source trace use a different clock and were not assigned to the second-action window.",
      "Request overlap and commit co-occurrence do not establish that auth, network fan-out, or React commits caused the freeze.",
    ],
    nextAction: "A separately bounded diagnostic-only instrumentation step should add redacted auth timing coverage to the uninstrumented shared API routes and a bounded server-side marker for dashboard RSC auth, then repeat one current-source J1 capture. Do not change auth behavior or accept a runtime fix.",
    explicitNonClaims: [
      "No production fix was proposed or accepted.",
      "No Plan 2 entry was authorized.",
      "No external provider, billing, worker, migration, or real health-data path was used.",
      "The analysis does not prove a six-to-seven-hop auth cost on every request.",
    ],
    redaction: {
      status: "PASS_BY_CONTRACT",
      rawBodiesIncluded: false,
      credentialsIncluded: false,
      cookiesIncluded: false,
      tokensIncluded: false,
      healthDataIncluded: false,
      deviceSerialIncluded: false,
      routeValuesSanitized: true,
    },
    closure: {
      status,
      outcome,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
    },
  });
}

export function buildEvidenceFromPath(sourceEvidencePath, options = {}) {
  const absoluteSourcePath = resolve(repoRoot, sourceEvidencePath);
  if (!existsSync(absoluteSourcePath)) throw new Error("source_evidence_missing");
  const sourceEvidence = readJson(absoluteSourcePath);
  return {
    absoluteSourcePath,
    sourceEvidence,
    evidence: buildAuthFanoutCommitOverlapEvidence({
      sourceEvidence,
      sourceEvidencePath,
      ...options,
    }),
  };
}

function parseArguments(argv) {
  const options = {
    writeEvidence: false,
    sourceEvidencePath: AUTH_FANOUT_COMMIT_OVERLAP_DEFAULT_SOURCE_EVIDENCE,
    runId: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--source-evidence") options.sourceEvidencePath = argv[++index];
    else if (arg === "--run-id") options.runId = argv[++index];
    else if (arg === "--help") options.help = true;
    else throw new Error(`auth_fanout_commit_overlap_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Use --source-evidence <repo-relative-path> and optionally --write-evidence.\n");
    return;
  }
  const result = buildEvidenceFromPath(options.sourceEvidencePath, { runId: options.runId ?? undefined });
  const outputPath = join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${result.evidence.runId}_EVIDENCE.json`,
  );
  if (options.writeEvidence) writeFileSync(outputPath, `${JSON.stringify(result.evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    runId: result.evidence.runId,
    status: result.evidence.status,
    outcome: result.evidence.outcome,
    sourceEvidencePath: options.sourceEvidencePath,
    outputPath: options.writeEvidence ? outputPath : null,
    observationCount: result.evidence.validity.sourceObservationsAvailable,
    firstToSecondApiRequests: result.evidence.validity.firstToSecondApiRequestCount,
    firstToSecondRscRequests: result.evidence.validity.firstToSecondRscRequestCount,
    secondActionCommitWaves: result.evidence.aggregate.secondActionReactCommitWaves,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
