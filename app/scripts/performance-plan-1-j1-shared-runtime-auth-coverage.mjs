#!/usr/bin/env node

/**
 * Trace-only single J1 capture for shared API auth timing and the bounded
 * server-provided dashboard RSC auth marker. This is not an official sample,
 * does not change auth behavior, and never records credentials or bodies.
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  inspectPhaseRuns,
  openPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import { parseLocalSupabaseStatus } from "./performance-plan-1-phase-4.mjs";
import {
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_READY_TIMEOUT_MS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  buildPhase44ServerEnvironment,
  resolvePhase44LocalConfiguration,
  runMeasurementUnit,
  sanitizePhase44Evidence,
} from "./performance-plan-1-phase-4-4-local.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const AUTH_COVERAGE_PHASE_ID =
  "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1";
export const AUTH_COVERAGE_SCHEMA_VERSION = AUTH_COVERAGE_PHASE_ID;
export const AUTH_COVERAGE_PLAN_REVISION = "plan1-final-v3";
export const AUTH_COVERAGE_BASE_URL = "http://127.0.0.1:3156";
export const AUTH_COVERAGE_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const AUTH_COVERAGE_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const AUTH_COVERAGE_EXPECTED_ROUTES = Object.freeze([
  "/api/conversations",
  "/api/alerts",
  "/api/notifications",
  "/api/shell/preferences",
  "/api/clients/%3Cuuid%3E",
  "/api/clients/%3Cuuid%3E/forms",
]);

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

function normalizeBaseUrl(value) {
  const url = new URL(value || AUTH_COVERAGE_BASE_URL);
  if (!url.port) url.port = "3156";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("auth_coverage_run_id_invalid");
  }
  return join(repoRoot, `${AUTH_COVERAGE_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-shared-runtime-auth-coverage.mjs",
    "app/src/lib/performance-diagnostic.ts",
    "app/src/lib/dashboard-server-auth.ts",
    "app/src/components/dashboard/authenticated-shell-boundary.tsx",
    "app/src/app/dashboard/layout.tsx",
    "app/src/app/dashboard/page.tsx",
    "app/src/app/api/conversations/route.ts",
    "app/src/app/api/alerts/route.ts",
    "app/src/app/api/notifications/route.ts",
    "app/src/app/api/shell/preferences/route.ts",
    "app/src/app/api/clients/[id]/route.ts",
    "app/src/app/api/clients/[id]/forms/route.ts",
  ].map((path) => ({ path, sha256: hashFile(join(repoRoot, path)) }));
  return {
    cwd: repoRoot.replaceAll("\\", "/"),
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    statusLineCount: status ? status.split(/\r?\n/).filter(Boolean).length : 0,
    statusHash: hashText(status),
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    localSupabaseHost: "127.0.0.1:54321",
    shellDirtyRegistrationPolicy:
      String(configuration.environment.NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY ?? "")
        .trim()
        .toLowerCase() === "stable"
        ? "stable"
        : "legacy",
    sourceFiles,
  };
}

function startLocalServer(environment, baseUrl) {
  const url = new URL(baseUrl);
  const server = spawn(
    process.execPath,
    [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", url.port],
    {
      cwd: appRoot,
      env: { ...process.env, ...environment, PORT: url.port, HOSTNAME: "127.0.0.1" },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  return { server, baseUrl };
}

async function waitForServer(handle, timeoutMs = PHASE_4_3_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (handle.server.exitCode != null) throw new Error("auth_coverage_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The production server may still be binding or loading the build.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("auth_coverage_server_timeout");
}

async function stopLocalServer(handle) {
  const server = handle?.server;
  if (!server || server.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  const startedAt = Date.now();
  while (server.exitCode == null && Date.now() - startedAt < 10_000) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
}

function safeTimingMetrics(request) {
  return (Array.isArray(request?.serverTiming) ? request.serverTiming : [])
    .map((metric) => ({
      name: String(metric?.name ?? "").slice(0, 80),
      durationMs: typeof metric?.durationMs === "number" && Number.isFinite(metric.durationMs)
        ? Number(metric.durationMs.toFixed(3))
        : null,
    }))
    .filter((metric) => /^[A-Za-z0-9._-]+$/.test(metric.name));
}

export function sanitizeCoverageRoute(route) {
  return String(route ?? "")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "%3Cuuid%3E",
    )
    .replace(/([?&]clientId=)[^&]+/gi, "$1%3Cpresent%3E")
    .slice(0, 400);
}

function safeRequestRecord(request) {
  return {
    route: sanitizeCoverageRoute(request?.route),
    method: request?.method ?? null,
    requestKind: request?.requestKind ?? null,
    startedAtMs: request?.startedAtMs ?? null,
    endAtMs: request?.endAtMs ?? null,
    responseHeaderAtMs: request?.responseHeaderAtMs ?? null,
    bodyFinishedAtMs: request?.bodyFinishedAtMs ?? null,
    status: request?.status ?? null,
    failed: request?.failed === true,
    serverTiming: safeTimingMetrics(request),
  };
}

function safeRscMarker(event) {
  return {
    name: String(event?.name ?? "").slice(0, 80),
    scope: event?.scope === "layout" || event?.scope === "page" ? event.scope : null,
    atWallMs: typeof event?.atWallMs === "number" ? event.atWallMs : null,
    atPerformanceMs: typeof event?.atPerformanceMs === "number" ? event.atPerformanceMs : null,
    authGetUserMs: event?.authGetUserMs ?? null,
    authMembershipMs: event?.authMembershipMs ?? null,
    authCustomerSessionFactsMs: event?.authCustomerSessionFactsMs ?? null,
    authDietitianMs: event?.authDietitianMs ?? null,
    authEntitlementMs: event?.authEntitlementMs ?? null,
    authTotalMs: event?.authTotalMs ?? null,
  };
}

export function summarizeAuthCoverage(result) {
  const measurement = result?.trace?.measurement ?? {};
  const requests = measurement.requestSummary?.requests ?? [];
  const normalizedRequests = requests.map((request) => ({
    ...request,
    route: sanitizeCoverageRoute(request?.route),
  }));
  const apiRequests = normalizedRequests.filter((request) => String(request?.route ?? "").startsWith("/api/"));
  const expected = new Set(AUTH_COVERAGE_EXPECTED_ROUTES);
  const expectedRouteRecords = AUTH_COVERAGE_EXPECTED_ROUTES.map((route) => {
    const matches = apiRequests.filter((request) => request.route === route);
    const timed = matches.filter((request) => safeTimingMetrics(request).some((metric) => metric.name === "auth_total"));
    return {
      route,
      responseCount: matches.length,
      timedResponseCount: timed.length,
      timingNames: [...new Set(timed.flatMap((request) => safeTimingMetrics(request).map((metric) => metric.name)))].sort(),
    };
  });
  const phase52Events = measurement.longTasks?.phase52Events ?? [];
  const rscMarkers = phase52Events
    .filter((event) => event?.name === "rsc_auth_server_marker_observed")
    .map(safeRscMarker);
  const allApiRequestsTimed = apiRequests.length > 0 && apiRequests.every((request) =>
    safeTimingMetrics(request).some((metric) => metric.name === "auth_total"),
  );
  const missingExpectedRoutes = expectedRouteRecords
    .filter((record) => record.responseCount === 0 || record.timedResponseCount === 0)
    .map((record) => record.route);
  return {
    expectedRoutes: expectedRouteRecords,
    expectedRouteSet: [...expected],
    apiRequestCount: apiRequests.length,
    timedApiRequestCount: apiRequests.filter((request) =>
      safeTimingMetrics(request).some((metric) => metric.name === "auth_total"),
    ).length,
    allApiRequestsTimed,
    missingExpectedRoutes,
    rscMarkerCount: rscMarkers.length,
    rscMarkers,
    requests: normalizedRequests.map(safeRequestRecord),
    observation: {
      observationValidity: result?.observationValidity ?? null,
      functionalOutcome: result?.functionalOutcome ?? null,
      validSample: result?.validSample === true,
      performanceOutcome: result?.performanceOutcome ?? null,
      secondActionTailMs: result?.trace?.measurement?.secondActionTailMs ?? null,
    },
  };
}

export function deriveAuthCoverageOutcome({ result, summary }) {
  if (result?.validSample !== true) return "AUTH_COVERAGE_CAPTURE_INCOMPLETE";
  if (summary.rscMarkerCount > 0 && summary.missingExpectedRoutes.length === 0) {
    return "SHARED_RUNTIME_AUTH_COVERAGE_CAPTURED_RSC_MARKER_OBSERVED";
  }
  if (summary.rscMarkerCount > 0) return "SHARED_API_AUTH_COVERAGE_PARTIAL_RSC_MARKER_OBSERVED";
  return "SHARED_API_AUTH_COVERAGE_PARTIAL_RSC_MARKER_NOT_OBSERVED";
}

function buildEvidence(result, { source, preflight, generatedAt = new Date().toISOString() } = {}) {
  const sample = result.results?.[0] ?? null;
  const summary = summarizeAuthCoverage(sample);
  const outcome = deriveAuthCoverageOutcome({ result: sample, summary });
  return sanitizePhase44Evidence({
    schemaVersion: "aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1",
    planRevision: AUTH_COVERAGE_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "shared-runtime-auth-coverage-capture",
    stageId: AUTH_COVERAGE_PHASE_ID,
    runId: result.runId,
    generatedAt,
    status: result.status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Capture diagnostic-only timing for shared API auth paths and the bounded dashboard RSC auth marker in one current-source J1 trace.",
      analysisOnly: false,
      browserRerunStarted: true,
      applicationRuntimeChanged: false,
      diagnosticInstrumentationEnabled: true,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      targetJourney: "J1",
      fixture: "local-normal synthetic owner",
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: AUTH_COVERAGE_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    sourceIdentity: source ?? result.source ?? null,
    preflight: preflight ?? result.preflight ?? null,
    stageLedger: [
      { stageId: "ARC.1", name: "Current source identity and local preflight", status: (preflight ?? result.preflight)?.status === "PASS" ? "COMPLETE" : "BLOCKED" },
      { stageId: "ARC.2", name: "One diagnostic J1 capture", status: sample ? "COMPLETE" : "BLOCKED" },
      { stageId: "ARC.3", name: "Shared API auth coverage and RSC marker extraction", status: sample ? "COMPLETE" : "BLOCKED" },
    ],
    validity: {
      attempted: sample ? "1/1" : "0/1",
      observationValid: sample?.observationValidity ?? "NOT_AVAILABLE",
      functionalOutcome: sample?.functionalOutcome ?? "NOT_AVAILABLE",
      validSample: sample?.validSample === true,
      officialSample: false,
    },
    coverage: summary,
    interpretation: {
      observed: "Diagnostic timing is available for the API responses that completed in this trace; the bounded RSC marker records server-measured dashboard auth timing without exposing identity or response bodies.",
      notEstablished: "One J1 trace cannot establish repeatability, causality, or the global freeze root cause. Missing or aborted routes remain unmeasured.",
    },
    evidenceGaps: [
      "This is one trace-only J1 capture and is not an official acceptance sample.",
      "A route with no completed response cannot emit a response timing header in this capture.",
      "The RSC marker is a server-provided timing payload observed by the client; it is not a causal experiment or a full response-header timing boundary.",
    ],
    nextAction: "Review the single trace. Do not change auth behavior or promote the result to a root-cause finding; repeat only with separate authorization if the missing timing boundary still blocks the diagnosis.",
    explicitNonClaims: [
      "No auth cache, request coalescing, navigation, database, migration, or production fix was applied.",
      "No external provider, WhatsApp, billing, production worker, or real health-data path was used.",
      "The run does not change Plan 1 closure, Plan 2 eligibility, or production NO-GO.",
    ],
    closure: {
      status: result.status,
      outcome,
      globalFreezeResolved: false,
      rootCauseConfirmed: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
    },
    evidenceGeneration: {
      reconstructedFromCheckpoint: result.rebuiltFromCheckpoint === true,
      browserCaptureReexecutedDuringRebuild: result.rebuiltFromCheckpoint !== true,
    },
  });
}

function rebuildFromCheckpoint(runId) {
  const persisted = readPhaseRun({
    root: AUTH_COVERAGE_CHECKPOINT_ROOT,
    phaseId: AUTH_COVERAGE_PHASE_ID,
    runId,
  });
  const sample = persisted.events
    .filter((event) => event.type === "measurement.unit.trace")
    .at(-1)?.payload ?? null;
  const preflight = persisted.events
    .filter((event) => event.type === "environment.preflight")
    .at(-1)?.payload ?? null;
  if (!sample) throw new Error("auth_coverage_checkpoint_sample_missing");
  const configuration = resolvePhase44LocalConfiguration();
  return {
    runId,
    status: "COMPLETE",
    rebuiltFromCheckpoint: true,
    source: sourceIdentity(configuration),
    preflight,
    results: [sample],
  };
}

export async function runCapture({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = {
    planRevision: AUTH_COVERAGE_PLAN_REVISION,
    phaseId: AUTH_COVERAGE_PHASE_ID,
    phaseSchemaVersion: AUTH_COVERAGE_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: normalizedBaseUrl,
    sourceHead: source.head,
    sourceVariant: "current_shared_runtime_auth_coverage_trace_only",
    journeyId: "J1",
    repetitions: 1,
    executionMode: "diagnostic",
    localConfigurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  };
  const opened = openPhaseRun({
    root: AUTH_COVERAGE_CHECKPOINT_ROOT,
    phaseId: AUTH_COVERAGE_PHASE_ID,
    phaseSchemaVersion: AUTH_COVERAGE_SCHEMA_VERSION,
    identity,
    metadata: { contract: identity, countedAsOfficialSample: false },
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`auth_coverage_checkpoint_${String(opened.action ?? "unknown").toLowerCase()}`);
  }

  const checkpoint = opened.run;
  const preflight = {
    status:
      localStatus.status === "PASS" && configuration.email && configuration.password
        ? "PASS"
        : "BLOCKED",
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    authentication: "real_password_session_required",
    storePath: "normal_rls_api_path_required",
    fallbackStoreAllowed: false,
    targetOrigin: normalizedBaseUrl,
    localSupabase: {
      status: localStatus.status,
      targetHost: "127.0.0.1:54321",
      urlIsLocal: localStatus.urlIsLocal === true,
      credentialsPresent: {
        anonKey: Boolean(localStatus.anonKey),
        serviceRoleKey: Boolean(localStatus.serviceRoleKey),
      },
    },
    credentialsAvailable: {
      email: Boolean(configuration.email),
      password: Boolean(configuration.password),
    },
    blockers: [],
  };
  if (localStatus.status !== "PASS") preflight.blockers.push("local_supabase_unreachable_or_not_ready");
  if (!configuration.email) preflight.blockers.push("synthetic_email_unavailable");
  if (!configuration.password) preflight.blockers.push("synthetic_password_unavailable");
  checkpoint.append("environment.preflight", preflight, {
    status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED",
  });
  if (preflight.status !== "PASS") {
    checkpoint.markStatus("BLOCKED", { reason: "auth_coverage_preflight_blocked" });
    checkpoint.close();
    return { runId: checkpoint.runId, status: "BLOCKED", source, preflight, results: [] };
  }

  let serverHandle = null;
  let browser = null;
  try {
    const buildEnvironment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
      baseUrl: normalizedBaseUrl,
      localStatus,
    });
    if (!existsSync(nextCliPath)) throw new Error("auth_coverage_next_cli_missing");
    const build = spawnSync(process.execPath, [nextCliPath, "build", "--webpack"], {
      cwd: appRoot,
      env: buildEnvironment,
      stdio: "ignore",
      timeout: 600_000,
      windowsHide: true,
    });
    checkpoint.append("environment.build", {
      status: build.status === 0 ? "PASS" : "BLOCKED",
      timedOut: build.error?.code === "ETIMEDOUT",
      mode: "diagnostic",
      outputRecorded: false,
    }, { status: build.status === 0 ? "RUNNING" : "BLOCKED" });
    if (build.status !== 0) throw new Error("auth_coverage_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
    const sample = await runMeasurementUnit({
      browser,
      baseUrl: normalizedBaseUrl,
      mode: "diagnostic",
      journey,
      repetition: 1,
      unitKey: "diagnostic:J1:r1",
      scope: "j1_shared_runtime_auth_coverage",
      email: configuration.email,
      password: configuration.password,
      checkpoint,
    });
    const results = [sample];
    checkpoint.markStatus("COMPLETE", {
      reason: "j1_shared_runtime_auth_coverage_completed",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return { runId: checkpoint.runId, status: "COMPLETE", source, preflight, results };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "auth_coverage_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      source,
      preflight,
      results: [],
      runtimeError: String(error?.message || "auth_coverage_runner_failed").slice(0, 160),
    };
  } finally {
    if (browser) await browser.close();
    await stopLocalServer(serverHandle);
  }
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    writeEvidence: false,
    newRun: false,
    baseUrl: process.env.AIYA_AUTH_COVERAGE_BASE_URL || AUTH_COVERAGE_BASE_URL,
    rebuildRunId: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else if (arg === "--rebuild-existing") options.rebuildRunId = argv[++index];
    else if (arg === "--help") {
      process.stdout.write("Use --run --new-run --write-evidence for one trace-only J1 capture.\n");
      return null;
    } else throw new Error(`auth_coverage_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) return;
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: AUTH_COVERAGE_CHECKPOINT_ROOT,
      phaseId: AUTH_COVERAGE_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 shared-runtime auth coverage capture ready. Use --run explicitly.\n");
    return;
  }
  const result = options.rebuildRunId
    ? rebuildFromCheckpoint(options.rebuildRunId)
    : await runCapture({ baseUrl: options.baseUrl, newRun: options.newRun });
  const evidence = buildEvidence(result, { source: result.source, preflight: result.preflight });
  if (options.writeEvidence && result.runId) {
    writeFileSync(phaseEvidencePath(result.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
