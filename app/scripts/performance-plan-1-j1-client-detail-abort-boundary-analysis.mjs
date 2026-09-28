#!/usr/bin/env node

/**
 * Read-only correlation of the client-detail abort in the shared-runtime J1
 * trace. This consumes an existing checkpoint and never starts a browser,
 * server, mutation, or new measurement.
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

export const ABORT_ANALYSIS_PHASE_ID =
  "aiya-performance-plan1-j1-client-detail-abort-boundary-analysis-v1";
export const ABORT_ANALYSIS_SCHEMA_VERSION = ABORT_ANALYSIS_PHASE_ID;
export const ABORT_ANALYSIS_PLAN_REVISION = "plan1-final-v3";
export const ABORT_ANALYSIS_SOURCE_PHASE_ID =
  "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1";
export const ABORT_ANALYSIS_SOURCE_RUN_ID =
  "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5";
export const ABORT_ANALYSIS_SOURCE_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5_EVIDENCE.json";
export const ABORT_ANALYSIS_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const ABORT_ANALYSIS_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);

const TARGET_ROUTE = "/api/clients/%3Cuuid%3E";
const SOURCE_FILES = Object.freeze([
  "app/src/lib/use-stage-6-client-workspace.ts",
  "app/src/components/dashboard/client-workspace.tsx",
  "app/src/lib/phase-85-stage-6-client-selection.ts",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/src/app/api/clients/[id]/route.ts",
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

export function sanitizeAnalysisRoute(route) {
  return String(route ?? "")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "%3Cuuid%3E",
    )
    .replace(/([?&]clientId=)[^&]+/gi, "$1%3Cpresent%3E")
    .slice(0, 400);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

function sourceTrace() {
  const sourceEvidence = readJson(join(repoRoot, ABORT_ANALYSIS_SOURCE_EVIDENCE_PATH));
  const persisted = readPhaseRun({
    root: ABORT_ANALYSIS_CHECKPOINT_ROOT,
    phaseId: ABORT_ANALYSIS_SOURCE_PHASE_ID,
    runId: ABORT_ANALYSIS_SOURCE_RUN_ID,
  });
  const sample = persisted.events
    .filter((event) => event.type === "measurement.unit.trace")
    .at(-1)?.payload;
  if (!sample) throw new Error("abort_analysis_checkpoint_sample_missing");

  const targetRequests = (sourceEvidence.coverage?.requests ?? []).filter(
    (request) => request.route === TARGET_ROUTE && request.method === "GET",
  );
  const routeHistory = (sample.trace.measurement.longTasks.routeHistoryEvents ?? []).map((event) => ({
    atMs: typeof event.atMs === "number" ? event.atMs : null,
    route: sanitizeAnalysisRoute(event.route),
    source: String(event.source ?? "").slice(0, 80),
  }));
  const phase55Events = (sample.trace.measurement.longTasks.phase55Events ?? [])
    .filter((event) => String(event.name ?? "").startsWith("stage6_workspace_"))
    .map((event) => ({
      name: String(event.name ?? "").slice(0, 100),
      atPerformanceMs:
        typeof event.atPerformanceMs === "number" ? event.atPerformanceMs : null,
      domain: ["summary", "forms", "nutrition", "menu", "context", "ai"].includes(event.domain)
        ? event.domain
        : null,
      sequence: typeof event.sequence === "number" ? event.sequence : null,
      routePathname: sanitizeAnalysisRoute(event.routePathname),
      routeSection: String(event.routeSection ?? "").slice(0, 80) || null,
      routeClientTask: String(event.routeClientTask ?? "").slice(0, 80) || null,
      routeHasClientId: event.routeHasClientId === true,
      hasPreviousController: event.hasPreviousController === true,
    }));
  return {
    sourceEvidence,
    sample,
    targetRequests,
    routeHistory,
    phase55Events,
  };
}

function staticCodeAssertions() {
  const hook = readFileSync(join(repoRoot, "app/src/lib/use-stage-6-client-workspace.ts"), "utf8");
  const workspace = readFileSync(join(repoRoot, "app/src/components/dashboard/client-workspace.tsx"), "utf8");
  const journey = readFileSync(join(repoRoot, "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs"), "utf8");
  return {
    hookAbortsPreviousControllerOnLoad: hook.includes("abortRef.current?.abort();"),
    hookAbortsControllerDuringEffectCleanup: /return \(\) => \{[\s\S]*abortRef\.current\?\.abort\(\);/.test(hook),
    hookLoadDependsOnDomain: hook.includes("options.domain") && hook.includes("[enabled, load, options.clientId, options.domain, ownerKey]"),
    summaryMapsToClientDetailRoute: hook.includes('case "summary":') && hook.includes("return `/api/clients/${clientId}`;"),
    workspaceMapsClientTaskToDomain: workspace.includes("const domain = selectedClient ? taskDomain(clientTask) : null;"),
    journeyChangesFormsThenNutrition: journey.includes('label: "select_forms"') && journey.includes('label: "select_nutrition"'),
  };
}

export function deriveAbortBoundaryOutcome({ targetRequests, routeHistory, phase55Events, code }) {
  const targetRequest = targetRequests[0] ?? null;
  const hasTargetAbort =
    targetRequests.length === 1 &&
    targetRequest.failed === true &&
    targetRequest.responseHeaderAtMs == null &&
    targetRequest.bodyFinishedAtMs == null;
  const routeClient = routeHistory.some((event) => event.route === "/dashboard?section=clients&clientId=%3Cpresent%3E");
  const routeForms = routeHistory.some((event) => event.route === "/dashboard?section=clients&clientTask=forms&clientId=%3Cpresent%3E");
  const routeNutrition = routeHistory.some((event) => event.route === "/dashboard?section=clients&clientTask=nutrition&clientId=%3Cpresent%3E");
  const summaryCleanup = phase55Events.some(
    (event) => event.name === "stage6_workspace_effect_cleanup" && event.domain === "summary" && event.routeClientTask === "forms",
  );
  const formsSetup = phase55Events.some(
    (event) => event.name === "stage6_workspace_effect_setup" && event.domain === "forms" && event.routeClientTask === "forms",
  );
  const summaryAbort = phase55Events.some(
    (event) => event.name === "stage6_workspace_load_aborted" && event.domain === "summary" && event.routeClientTask === "forms",
  );
  const staticContractPass = Object.values(code).every(Boolean);
  if (hasTargetAbort && routeClient && routeForms && routeNutrition && summaryCleanup && formsSetup && summaryAbort && staticContractPass) {
    return "CLIENT_DETAIL_ABORT_CORRELATED_WITH_STAGE6_DOMAIN_SWITCH_CLEANUP";
  }
  return "CLIENT_DETAIL_ABORT_BOUNDARY_CORRELATION_INCOMPLETE";
}

function makeRunId() {
  return `${ABORT_ANALYSIS_PHASE_ID}-${new Date().toISOString().replaceAll(/[-:.]/g, "")}`;
}

function evidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("abort_analysis_run_id_invalid");
  }
  return join(repoRoot, `${ABORT_ANALYSIS_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

export function buildAbortBoundaryEvidence({ runId = makeRunId(), generatedAt = new Date().toISOString() } = {}) {
  const trace = sourceTrace();
  const code = staticCodeAssertions();
  const outcome = deriveAbortBoundaryOutcome({
    targetRequests: trace.targetRequests,
    routeHistory: trace.routeHistory,
    phase55Events: trace.phase55Events,
    code,
  });
  const sourceEvidenceSha256 = hashFile(join(repoRoot, ABORT_ANALYSIS_SOURCE_EVIDENCE_PATH));
  const targetRequest = trace.targetRequests[0] ?? null;
  return {
    schemaVersion: "aiya-performance-plan1-j1-client-detail-abort-boundary-analysis-v1",
    planRevision: ABORT_ANALYSIS_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-client-detail-abort-boundary-analysis",
    stageId: ABORT_ANALYSIS_PHASE_ID,
    runId,
    generatedAt,
    status: "COMPLETE",
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Correlate the observed client-detail request abort with route/domain transition and Stage 6 effect cleanup using the completed J1 checkpoint.",
      analysisOnly: true,
      browserRerunStarted: false,
      applicationRuntimeChanged: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      sourceMeasurementRunId: ABORT_ANALYSIS_SOURCE_RUN_ID,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: ABORT_ANALYSIS_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    sourceIdentity: sourceIdentity(),
    sourceMeasurement: {
      runId: ABORT_ANALYSIS_SOURCE_RUN_ID,
      evidencePath: ABORT_ANALYSIS_SOURCE_EVIDENCE_PATH,
      evidenceSha256: sourceEvidenceSha256,
      status: trace.sourceEvidence.status,
      outcome: trace.sourceEvidence.outcome,
      validity: trace.sourceEvidence.validity,
    },
    boundary: {
      targetRoute: TARGET_ROUTE,
      targetMethod: "GET",
      targetRequestCount: trace.targetRequests.length,
      targetRequest: targetRequest
        ? {
            failed: targetRequest.failed === true,
            status: targetRequest.status,
            responseHeaderAtMs: targetRequest.responseHeaderAtMs,
            bodyFinishedAtMs: targetRequest.bodyFinishedAtMs,
            serverTimingNames: targetRequest.serverTiming.map((metric) => metric.name),
          }
        : null,
      routeHistory: trace.routeHistory,
      stage6Lifecycle: trace.phase55Events,
      staticCodeAssertions: code,
    },
    validity: {
      sourceTrace: "1/1 valid functional J1 trace",
      targetAbortObserved: targetRequest?.failed === true ? "1/1" : "0/1",
      routeTransitionObserved: trace.routeHistory.length > 0,
      stage6CleanupCorrelationObserved: trace.phase55Events.some(
        (event) => event.name === "stage6_workspace_load_aborted",
      ),
      officialSample: false,
    },
    interpretation: "The completed trace records one client-detail GET with no response timing while the same journey transitions from a selected client to Forms and then Nutrition. The Stage 6 trace records summary effect cleanup, Forms effect setup, and summary load abort during the Forms transition. The hook source explicitly aborts the active controller during effect cleanup and reloads by domain. This is a client-side cancellation correlation, not proof that the route transition was premature or that it caused the global freeze.",
    evidenceGaps: [
      "The aborted request cannot provide Server-Timing, so server-side work after browser cancellation is not measured.",
      "The trace contains one occurrence and no single-variable control of the route/domain transition.",
      "No browser, server, database, or production runtime change was made in this analysis.",
    ],
    explicitNonClaims: [
      "The normal summary-to-Forms transition is not declared a bug by this correlation.",
      "The correlation does not prove auth-chain cost, request fan-out causality, React commit causality, or the global-freeze root cause.",
      "No runtime fix, finding disposition, Plan 2 eligibility, or production decision changed.",
    ],
    closure: {
      status: "COMPLETE",
      outcome,
      candidateNarrowedFurther: outcome === "CLIENT_DETAIL_ABORT_CORRELATED_WITH_STAGE6_DOMAIN_SWITCH_CLEANUP",
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
    },
    nextAction: "Treat the client-detail abort as a client-side cancellation boundary associated with the expected summary-to-Forms domain switch, not as a confirmed product defect. Only if server-side continuation or premature transition remains material should a separately authorized controlled capture add a bounded server-completion marker.",
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
      process.stdout.write("Use --run --write-evidence for read-only checkpoint correlation.\n");
      return null;
    } else throw new Error(`abort_analysis_argument_invalid:${arg}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) return;
  if (!options.run) {
    process.stdout.write("J1 client-detail abort boundary analysis ready. Use --run explicitly.\n");
    return;
  }
  const evidence = buildAbortBoundaryEvidence({ runId: options.runId || undefined });
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
