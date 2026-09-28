/**
 * Read-only analysis of the J1 post-response A-B-A checkpoint.
 *
 * This does not start a browser or a server. It separates required-read
 * validity from request fan-out so the previous commit observation is not
 * interpreted while those two controls are open.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readPhaseRun } from "../../tools/phase-execution/checkpoint-store.mjs";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const FANOUT_VALIDITY_PLAN_REVISION = "plan1-final-v3";
export const FANOUT_VALIDITY_PHASE_ID =
  "aiya-performance-plan1-j1-post-response-commit-fanout-validity-analysis-v1";
export const FANOUT_VALIDITY_SCHEMA_VERSION = FANOUT_VALIDITY_PHASE_ID;
export const FANOUT_VALIDITY_SOURCE_PHASE_ID =
  "aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1";
export const FANOUT_VALIDITY_SOURCE_RUN_ID =
  "aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1-20260921T185539646Z-b4ef5bf1-8927-4107-af0d-a6867406050b";
export const FANOUT_VALIDITY_SOURCE_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1-20260921T185539646Z-b4ef5bf1-8927-4107-af0d-a6867406050b_EVIDENCE.json";
export const FANOUT_VALIDITY_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const FANOUT_VALIDITY_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const FANOUT_VALIDITY_VARIANTS = Object.freeze(["A1", "B", "A2"]);
export const FANOUT_VALIDITY_REPETITIONS = 3;

const UUID_PATH_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SOURCE_FILES = Object.freeze([
  "app/scripts/performance-plan-1-j1-post-response-commit-ownership-ab-a.mjs",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/src/lib/use-stage-6-client-workspace.ts",
]);

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const number = finite(value);
  return number == null ? null : Number(number.toFixed(3));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function sanitizeAnalysisRoute(value) {
  try {
    const parsed = new URL(String(value), "http://fanout-validity.local");
    const pathname = parsed.pathname.replace(UUID_PATH_RE, ":clientId");
    const params = new URLSearchParams();
    for (const key of ["section", "clientTask"]) {
      const current = parsed.searchParams.get(key);
      if (current) params.set(key, current);
    }
    for (const key of ["clientId", "conversationId", "messageId", "sourceId"]) {
      if (parsed.searchParams.has(key)) params.set(key, "<present>");
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  } catch {
    return "<invalid-route>";
  }
}

function policyMarker(trace) {
  const events = Array.isArray(trace?.measurement?.longTasks?.phase52Events)
    ? trace.measurement.longTasks.phase52Events
    : [];
  return String(
    events.find((event) => event.name === "shell_dirty_registration_policy")?.policy ??
      "unknown",
  ).slice(0, 24);
}

function parseUnitKey(unitKey) {
  const match = /^([A-Za-z0-9]+):[^:]+:J1:r([1-9][0-9]*)$/.exec(String(unitKey ?? ""));
  if (!match) throw new Error("fanout_validity_unit_key_invalid");
  return { variantId: match[1], repetition: Number(match[2]) };
}

function requestRecords(trace) {
  return Array.isArray(trace?.measurement?.requestSummary?.requests)
    ? trace.measurement.requestSummary.requests
    : [];
}

function requestCompleted(record) {
  return Boolean(
    record?.method === "GET" &&
      Number.isInteger(record.status) &&
      record.status >= 200 &&
      record.status < 300 &&
      record.bodyFinishedAtMs != null &&
      record.failed !== true,
  );
}

function requiredReadRecords(trace, actionId) {
  const requiredReads = Array.isArray(trace?.measurement?.requiredReads)
    ? trace.measurement.requiredReads
    : [];
  return requiredReads.find((read) => read.actionId === actionId) ?? null;
}

function summarizeRequiredRead(trace, actionId) {
  const required = requiredReadRecords(trace, actionId);
  const records = Array.isArray(required?.records) ? required.records : [];
  const routeRequests = requestRecords(trace).filter((record) => {
    const route = sanitizeAnalysisRoute(record.route);
    if (actionId === "first") return route.endsWith("/forms");
    return route.endsWith("/food-rule-profile");
  });
  const summarizedRecords = records.map((record, index) => {
    const transport = routeRequests[index] ?? null;
    return {
      method: record.method,
      status: Number.isInteger(record.status) ? record.status : null,
      responseHeaderAtMs: roundMs(record.responseHeaderAtMs),
      bodyFinishedAtMs: roundMs(record.bodyFinishedAtMs),
      failed: record.failed === true,
      failureReason: transport?.failureReason == null
        ? null
        : String(transport.failureReason).slice(0, 80),
    };
  });
  const incompleteBodyCount = summarizedRecords.filter((record) => record.bodyFinishedAtMs == null).length;
  const failedCount = summarizedRecords.filter((record) => record.failed).length;
  const non2xxCount = summarizedRecords.filter((record) =>
    record.status == null || record.status < 200 || record.status >= 300,
  ).length;
  return {
    actionId,
    pattern: String(required?.pattern ?? (actionId === "first"
      ? "/api/clients/:clientId/forms"
      : "/api/clients/:clientId/food-rule-profile")),
    count: Number.isInteger(required?.count) ? required.count : records.length,
    valid: required?.valid === true,
    recordCount: records.length,
    completedRecordCount: summarizedRecords.filter((record) =>
      requestCompleted(record),
    ).length,
    incompleteBodyCount,
    failedCount,
    non2xxCount,
    duplicateCount: Math.max(0, records.length - 1),
    records: summarizedRecords,
  };
}

function summarizeFormsTransport(trace) {
  const records = requestRecords(trace).filter((record) =>
    sanitizeAnalysisRoute(record.route).endsWith("/forms"),
  );
  return {
    total: records.length,
    completed: records.filter(requestCompleted).length,
    failed: records.filter((record) => record.failed === true).length,
    incompleteBody: records.filter((record) => record.bodyFinishedAtMs == null).length,
    records: records.map((record) => ({
      method: record.method,
      status: Number.isInteger(record.status) ? record.status : null,
      failed: record.failed === true,
      failureReason: record.failureReason == null
        ? null
        : String(record.failureReason).slice(0, 80),
      responseHeaderAtMs: roundMs(record.responseHeaderAtMs),
      bodyFinishedAtMs: roundMs(record.bodyFinishedAtMs),
    })),
  };
}

function routeCounts(trace) {
  const counts = {};
  for (const request of requestRecords(trace)) {
    const route = sanitizeAnalysisRoute(request.route);
    if (!route.startsWith("/api/")) continue;
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function summarizeLifecycle(trace) {
  const events = Array.isArray(trace?.measurement?.longTasks?.phase55Events)
    ? trace.measurement.longTasks.phase55Events.filter((event) =>
      String(event.name ?? "").startsWith("stage6_workspace_"),
    )
    : [];
  const count = (name, domain) => events.filter((event) =>
    event.name === name && (domain == null || event.domain === domain),
  ).length;
  const lifecycleEvents = events.map((event) => ({
    name: String(event.name).slice(0, 100),
    domain: String(event.domain ?? "").slice(0, 40) || null,
    sequence: Number.isInteger(event.sequence) ? event.sequence : null,
    previousSequence: Number.isInteger(event.previousSequence) ? event.previousSequence : null,
    hasPreviousController: event.hasPreviousController === true,
    atPerformanceMs: roundMs(event.atPerformanceMs),
  }));
  const formsSetup = count("stage6_workspace_effect_setup", "forms");
  const formsStarted = count("stage6_workspace_load_started", "forms");
  return {
    eventCount: events.length,
    forms: {
      effectSetup: formsSetup,
      effectCleanup: count("stage6_workspace_effect_cleanup", "forms"),
      loadStarted: formsStarted,
      loadSucceeded: count("stage6_workspace_load_succeeded", "forms"),
      loadAborted: count("stage6_workspace_load_aborted", "forms"),
      restarted: formsSetup > 1 || formsStarted > 1,
    },
    summary: {
      effectSetup: count("stage6_workspace_effect_setup", "summary"),
      effectCleanup: count("stage6_workspace_effect_cleanup", "summary"),
      loadStarted: count("stage6_workspace_load_started", "summary"),
      loadSucceeded: count("stage6_workspace_load_succeeded", "summary"),
      loadAborted: count("stage6_workspace_load_aborted", "summary"),
    },
    events: lifecycleEvents,
  };
}

function summarizeCommits(trace) {
  const events = Array.isArray(trace?.measurement?.longTasks?.phase52Events)
    ? trace.measurement.longTasks.phase52Events
    : [];
  const commits = events.filter((event) => event.name === "react_commit");
  const byProfiler = {};
  for (const event of commits) {
    const id = String(event.profilerId ?? "unknown").slice(0, 80);
    byProfiler[id] = (byProfiler[id] ?? 0) + 1;
  }
  return {
    totalReactCommitEvents: commits.length,
    shellProviderCommits: byProfiler["shell-provider"] ?? null,
    dashboardShellCommits: byProfiler["dashboard-shell"] ?? null,
  };
}

export function summarizeTrace(payload) {
  const trace = payload?.trace ?? payload;
  const { variantId, repetition } = parseUnitKey(payload?.unitKey);
  const requests = requestRecords(trace);
  const requiredForms = summarizeRequiredRead(trace, "first");
  const requiredNutrition = summarizeRequiredRead(trace, "second");
  const apiRequests = requests.filter((request) =>
    sanitizeAnalysisRoute(request.route).startsWith("/api/"),
  );
  return {
    unitKey: String(payload.unitKey),
    variantId,
    repetition,
    policy: policyMarker(trace),
    validSample: payload.validSample === true,
    observationValidity: String(payload.observationValidity ?? "UNKNOWN"),
    functionalOutcome: String(payload.functionalOutcome ?? "UNKNOWN"),
    eligibleFunctionalSample: payload.validSample === true &&
      payload.observationValidity === "VALID" &&
      payload.functionalOutcome === "SUCCESS",
    failureBoundary: payload.failureBoundary
      ? {
          phase: String(payload.failureBoundary.phase ?? "unknown"),
          actionId: payload.failureBoundary.actionId == null
            ? null
            : String(payload.failureBoundary.actionId),
          reason: payload.failureBoundary.reason == null
            ? null
            : String(payload.failureBoundary.reason).slice(0, 120),
          pattern: payload.failureBoundary.pattern == null
            ? null
            : String(payload.failureBoundary.pattern).slice(0, 120),
        }
      : null,
    fanout: {
      requestCount: requests.length,
      apiRequestCount: apiRequests.length,
      documentRequestCount: requests.filter((request) => request.requestKind === "document").length,
      rscRequestCount: requests.filter((request) => request.requestKind === "rsc").length,
      apiRouteCounts: routeCounts(trace),
    },
    requiredReads: {
      forms: requiredForms,
      nutrition: requiredNutrition,
    },
    formsTransport: summarizeFormsTransport(trace),
    stage6Lifecycle: summarizeLifecycle(trace),
    commitContext: summarizeCommits(trace),
  };
}

function rowFor(rows, variantId, repetition) {
  return rows.find((row) => row.variantId === variantId && row.repetition === repetition) ?? null;
}

function routeDelta(left, right) {
  const keys = new Set([
    ...Object.keys(left?.fanout?.apiRouteCounts ?? {}),
    ...Object.keys(right?.fanout?.apiRouteCounts ?? {}),
  ]);
  return Object.fromEntries(
    [...keys]
      .sort()
      .map((route) => [
        route,
        (right?.fanout?.apiRouteCounts?.[route] ?? 0) -
          (left?.fanout?.apiRouteCounts?.[route] ?? 0),
      ])
      .filter(([, delta]) => delta !== 0),
  );
}

export function deriveMatchedComparisons(rows) {
  return Array.from({ length: FANOUT_VALIDITY_REPETITIONS }, (_, index) => {
    const repetition = index + 1;
    const a1 = rowFor(rows, "A1", repetition);
    const b = rowFor(rows, "B", repetition);
    const a2 = rowFor(rows, "A2", repetition);
    const allPresent = Boolean(a1 && b && a2);
    const allEligible = allPresent && a1.eligibleFunctionalSample &&
      b.eligibleFunctionalSample && a2.eligibleFunctionalSample;
    return {
      repetition,
      allPresent,
      allEligible,
      fanout: {
        a1: a1?.fanout.requestCount ?? null,
        b: b?.fanout.requestCount ?? null,
        a2: a2?.fanout.requestCount ?? null,
        bMinusA1: a1 && b ? b.fanout.requestCount - a1.fanout.requestCount : null,
        bMinusA2: a2 && b ? b.fanout.requestCount - a2.fanout.requestCount : null,
        apiBMinusA1: a1 && b ? b.fanout.apiRequestCount - a1.fanout.apiRequestCount : null,
        apiBMinusA2: a2 && b ? b.fanout.apiRequestCount - a2.fanout.apiRequestCount : null,
      },
      forms: {
        a1Records: a1?.requiredReads.forms.recordCount ?? null,
        bRecords: b?.requiredReads.forms.recordCount ?? null,
        a2Records: a2?.requiredReads.forms.recordCount ?? null,
        bValid: b?.requiredReads.forms.valid ?? null,
        bAbortedRecords: b?.formsTransport.failed ?? null,
        bIncompleteBodies: b?.formsTransport.incompleteBody ?? null,
      },
      routeDeltaBMinusA1: routeDelta(a1, b),
      routeDeltaBMinusA2: routeDelta(a2, b),
    };
  });
}

function variantSummary(rows, variantId) {
  const selected = rows.filter((row) => row.variantId === variantId);
  return {
    attempted: `${selected.length}/${FANOUT_VALIDITY_REPETITIONS}`,
    eligibleFunctional: `${selected.filter((row) => row.eligibleFunctionalSample).length}/${FANOUT_VALIDITY_REPETITIONS}`,
    formsRequiredReadValid: `${selected.filter((row) => row.requiredReads.forms.valid).length}/${FANOUT_VALIDITY_REPETITIONS}`,
    formsTransportAbortObserved: `${selected.filter((row) => row.formsTransport.failed > 0 || row.formsTransport.incompleteBody > 0).length}/${FANOUT_VALIDITY_REPETITIONS}`,
    formsDuplicateObserved: `${selected.filter((row) => row.requiredReads.forms.duplicateCount > 0).length}/${FANOUT_VALIDITY_REPETITIONS}`,
    requestCounts: selected.map((row) => row.fanout.requestCount),
    apiRequestCounts: selected.map((row) => row.fanout.apiRequestCount),
  };
}

function staticAssertions() {
  const phase43 = readFileSync(join(repoRoot, "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs"), "utf8");
  const phase44 = readFileSync(join(repoRoot, "app/scripts/performance-plan-1-phase-4-4-local.mjs"), "utf8");
  const hook = readFileSync(join(repoRoot, "app/src/lib/use-stage-6-client-workspace.ts"), "utf8");
  return {
    requiredReadUsesEveryMatchingRecord: phase44.includes("matching.every((record) =>"),
    requiredReadRequiresBodyCompletion: phase44.includes("record.bodyFinishedAtMs != null"),
    requiredReadRejectsFailedRecord: phase44.includes("record.failed !== true"),
    phase43DoesNotRetryMissingClick: phase43.includes("autoRetryMissingClick: false"),
    stage6AbortsPreviousController: hook.includes("abortRef.current?.abort();"),
    stage6DomainIncludesForms: hook.includes('case "forms":'),
  };
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

function sourceMeasurement() {
  const evidencePath = join(repoRoot, FANOUT_VALIDITY_SOURCE_EVIDENCE_PATH);
  const sourceEvidence = readJson(evidencePath);
  const persisted = readPhaseRun({
    root: FANOUT_VALIDITY_CHECKPOINT_ROOT,
    phaseId: FANOUT_VALIDITY_SOURCE_PHASE_ID,
    runId: FANOUT_VALIDITY_SOURCE_RUN_ID,
  });
  const traces = persisted.events
    .filter((event) => event.type === "measurement.unit.trace")
    .map((event) => event.payload);
  return {
    sourceEvidence,
    sourceEvidenceSha256: hashFile(evidencePath),
    persisted,
    traces,
  };
}

function makeRunId() {
  return `${FANOUT_VALIDITY_PHASE_ID}-${new Date().toISOString().replaceAll(/[-:.]/g, "")}`;
}

export function fanoutValidityEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("fanout_validity_run_id_invalid");
  }
  return join(repoRoot, `${FANOUT_VALIDITY_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

export function classifyFanoutValidityBoundary({ rows, comparisons, assertions }) {
  const bInvalid = rows.filter((row) => row.variantId === "B" && !row.eligibleFunctionalSample);
  const bFormsAbort = bInvalid.some((row) =>
    row.formsTransport.failed > 0 || row.formsTransport.incompleteBody > 0,
  );
  const bDuplicate = bInvalid.some((row) => row.requiredReads.forms.duplicateCount > 0);
  const extraFanout = comparisons.some((comparison) =>
    comparison.allPresent &&
    ((comparison.fanout.bMinusA1 ?? 0) !== 0 || (comparison.fanout.bMinusA2 ?? 0) !== 0),
  );
  if (bInvalid.length > 0 && bFormsAbort && bDuplicate && extraFanout) {
    return "B_REQUIRED_READ_ABORT_AND_FANOUT_CONFOUND_OBSERVED_COMMIT_COMPARISON_OPEN";
  }
  if (bInvalid.length > 0 || !assertions.requiredReadUsesEveryMatchingRecord) {
    return "B_REQUIRED_READ_OR_FANOUT_VALIDITY_BOUNDARY_OPEN";
  }
  return "B_REQUIRED_READ_AND_FANOUT_BOUNDARY_NOT_REPRODUCED";
}

export function buildFanoutValidityEvidence({
  runId = makeRunId(),
  generatedAt = new Date().toISOString(),
} = {}) {
  const source = sourceMeasurement();
  const rows = source.traces.map(summarizeTrace);
  const comparisons = deriveMatchedComparisons(rows);
  const assertions = staticAssertions();
  const outcome = classifyFanoutValidityBoundary({ rows, comparisons, assertions });
  const counts = Object.fromEntries(FANOUT_VALIDITY_VARIANTS.map((variantId) => [
    variantId,
    variantSummary(rows, variantId),
  ]));
  const validMatchedRows = comparisons.filter((comparison) => comparison.allEligible);
  const fanoutInvariantRows = validMatchedRows.filter((comparison) =>
    comparison.fanout.a1 === comparison.fanout.b &&
    comparison.fanout.b === comparison.fanout.a2,
  );
  const sourceManifestPath = join(
    FANOUT_VALIDITY_CHECKPOINT_ROOT,
    FANOUT_VALIDITY_SOURCE_PHASE_ID,
    FANOUT_VALIDITY_SOURCE_RUN_ID,
    "manifest.json",
  );
  const sourceManifest = source.persisted.manifest ?? {};
  return {
    schemaVersion: FANOUT_VALIDITY_SCHEMA_VERSION,
    planRevision: FANOUT_VALIDITY_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-post-response-commit-fanout-validity-analysis",
    stageId: FANOUT_VALIDITY_PHASE_ID,
    runId,
    generatedAt,
    status: "COMPLETE",
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Separate the B required-read validity boundary from request fan-out in the completed J1 post-response commit checkpoint.",
      analysisOnly: true,
      browserRerunStarted: false,
      applicationRuntimeChanged: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      sourceMeasurementRunId: FANOUT_VALIDITY_SOURCE_RUN_ID,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: FANOUT_VALIDITY_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    sourceIdentity: sourceIdentity(),
    sourceMeasurement: {
      runId: FANOUT_VALIDITY_SOURCE_RUN_ID,
      evidencePath: FANOUT_VALIDITY_SOURCE_EVIDENCE_PATH,
      evidenceSha256: source.sourceEvidenceSha256,
      status: source.sourceEvidence.status,
      outcome: source.sourceEvidence.outcome,
      validity: source.sourceEvidence.validity,
      checkpoint: {
        phaseId: FANOUT_VALIDITY_SOURCE_PHASE_ID,
        status: sourceManifest.status ?? null,
        eventCount: source.persisted.events.length,
        lastSequence: sourceManifest.lastSequence ?? null,
        manifestSha256: hashFile(sourceManifestPath),
        hashChainRead: true,
      },
    },
    staticAssertions: assertions,
    measurement: {
      journeyId: "J1",
      traceCount: rows.length,
      rows,
      variantSummary: counts,
      matchedComparisons: comparisons,
      validMatchedRowCount: validMatchedRows.length,
      requestFanoutInvariantAcrossValidMatchedRows: fanoutInvariantRows.length === FANOUT_VALIDITY_REPETITIONS,
      requestFanoutInvariantRowCount: fanoutInvariantRows.length,
      formsAbortRows: rows.filter((row) => row.formsTransport.failed > 0 || row.formsTransport.incompleteBody > 0).map((row) => row.unitKey),
      formsDuplicateRows: rows.filter((row) => row.requiredReads.forms.duplicateCount > 0).map((row) => row.unitKey),
    },
    interpretation: "B repetition 3 is invalid because the first Forms matching record received HTTP 200 headers but ended with an aborted, body-incomplete request; a second Forms record completed with HTTP 200, but the required-read validator evaluates every matching record, so the later success does not promote the unit. The same unit has additional API fan-out, including duplicate Forms, client-summary, bootstrap, alerts, notifications, and conversations requests relative to the matched legacy rows. This leaves required-read validity and fan-out confounded with the earlier commit observation.",
    evidenceGaps: [
      "This is a read-only re-analysis of one completed A-B-A checkpoint, not a new controlled capture.",
      "The B group has only 2/3 eligible functional repetitions, so the three-valid-record causal gate is not met.",
      "Fan-out is not invariant across the fully valid matched repetitions; the next controlled capture must hold request fan-out and required-read validity as explicit gates.",
      "The request trace shows browser-visible cancellation and route/domain churn, but it does not prove server continuation after cancellation or the global freeze root cause.",
    ],
    explicitNonClaims: [
      "The duplicate Forms request is not declared a product defect by this analysis.",
      "The observed fan-out and required-read failure do not prove that the shell dirty-registration policy caused the global freeze.",
      "No runtime fix, finding disposition, Plan 2 entry, migration, deployment, or production decision changed.",
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
    nextAction: "Do not repeat the same A-B-A. Design one separately identified capture that preserves the existing dirty-registration variable while explicitly recording and controlling the Forms lifecycle and request fan-out; accept only repetitions with one completed Forms required read and a predeclared route-count envelope.",
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
      process.stdout.write("Use --run --write-evidence for read-only J1 fan-out/validity analysis.\n");
      return null;
    } else throw new Error(`fanout_validity_argument_invalid:${arg}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) return;
  if (!options.run) {
    process.stdout.write("J1 fan-out/validity analysis ready. Use --run explicitly.\n");
    return;
  }
  const evidence = buildFanoutValidityEvidence({ runId: options.runId || undefined });
  if (options.writeEvidence) {
    writeFileSync(fanoutValidityEvidencePath(evidence.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
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
