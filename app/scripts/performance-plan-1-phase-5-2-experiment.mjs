#!/usr/bin/env node

/**
 * AIya Performance Plan 1 - Phase 5.2 single-variable experiment.
 *
 * This runner measures the first pre-registered candidate on the local
 * desktop only. It uses one unchanged build and three matched A -> B -> A
 * cycles. The B policy is enabled only by a trace-only browser flag.
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
  buildPhase44ServerEnvironment,
  checkPhase44LocalInputs,
  collectBrowserMetrics,
  createRichRequestCapture,
  installPhase44BrowserInstrumentation,
  resolvePhase44LocalConfiguration,
  waitForReady,
} from "./performance-plan-1-phase-4-4-local.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const PHASE_5_2_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_2_CANDIDATE_ID = "H-5.1-001";
export const PHASE_5_2_VARIABLE_ID = "shared_read_start_policy";
export const PHASE_5_2_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase5-2-single-variable-experiment-v3";
export const PHASE_5_2_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase5-2-single-variable-experiment-v3";
export const PHASE_5_2_CHECKPOINT_ROOT = join(repoRoot, ".manu-runtime", "phase-execution");
export const PHASE_5_2_DEFAULT_BASE_URL = "http://127.0.0.1:3142";
export const PHASE_5_2_CYCLE_COUNT = 3;
export const PHASE_5_2_MAX_REPETITIONS = 5;
export const PHASE_5_2_POLICIES = Object.freeze({
  A: "independent",
  B: "bootstrap_gate",
});
export const PHASE_5_2_TRACE_JOURNEY_ID = "P5.2-H-5.1-001-dashboard-initial-load";
export const PHASE_5_2_TARGET_SELECTOR = '[data-testid="overview-work-areas"]';
export const PHASE_5_2_PARENT_EVIDENCE_RUN_ID =
  "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f";
export const PHASE_5_2_PARENT_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_2_PARENT_EVIDENCE_RUN_ID}_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`;
export const PHASE_5_2_SOURCE_PATHS = Object.freeze([
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/lib/use-aiya-state.ts",
  "app/src/lib/phase-52-diagnostic.ts",
  "app/scripts/performance-plan-1-phase-5-2-experiment.mjs",
  "app/scripts/performance-plan-1-phase-5-2-experiment.test.mjs",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  PHASE_5_2_PARENT_EVIDENCE_PATH,
]);

const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_STOP_TIMEOUT_MS = 10_000;
const TRACE_TIMEOUT_MS = 45_000;
const ROUTE_PATH = "/dashboard";
const REQUIRED_READ_PATHS = Object.freeze({
  shellBootstrap: "/api/shell/bootstrap",
  appState: "/api/app-state",
});

function safeErrorClass(error) {
  return error?.name || "Error";
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  return finite(value) == null ? null : Number(Number(value).toFixed(3));
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

function gitOutput(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function phase52CheckpointSummary(runId) {
  if (!runId) {
    return {
      status: "NOT_STARTED",
      runId: null,
      eventCount: 0,
      hashChainRead: false,
      lastEventType: null,
    };
  }
  const persisted = readPhaseRun({
    root: PHASE_5_2_CHECKPOINT_ROOT,
    phaseId: PHASE_5_2_CHECKPOINT_PHASE_ID,
    runId,
  });
  return {
    status: persisted.manifest.status,
    runId,
    eventCount: persisted.events.length,
    hashChainRead: true,
    lastEventType: persisted.events.at(-1)?.type ?? null,
  };
}

function phase52PersistedRunResult(persisted, prerequisite) {
  const traces = persisted.events
    .filter((event) => event.type === "experiment.trace.completed")
    .map((event) => event.payload);
  const preflight = persisted.events
    .filter((event) => event.type === "environment.preflight")
    .at(-1)?.payload ?? null;
  const cycleSummary = summarizePhase52Cycles(traces);
  const status = persisted.manifest.status === "COMPLETE" ? "COMPLETE" : "BLOCKED";
  return {
    runId: persisted.manifest.runId,
    status,
    outcome: cycleSummary.conclusion,
    traces,
    prerequisite,
    parentEvidence: prerequisite.parentEvidence,
    preflight,
    buildIdentity: preflight?.release ?? null,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : traces.length > 0
      ? ["invalid_or_incomplete_experiment_trace"]
      : ["checkpoint_not_complete"],
    checkpoint: phase52CheckpointSummary(persisted.manifest.runId),
  };
}

function redactString(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<redacted-email>")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer <redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>");
}

const SENSITIVE_KEY = /(?:password|token|secret|cookie|authorization|prompt|clinical|raw.?body|credential|private.?key|api.?key)/i;

export function sanitizePhase52Evidence(value, key = "") {
  if (SENSITIVE_KEY.test(String(key))) return "<redacted>";
  if (Array.isArray(value)) return value.map((item) => sanitizePhase52Evidence(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizePhase52Evidence(childValue, childKey),
      ]),
    );
  }
  if (typeof value === "string") return redactString(value);
  return value;
}

export function phase52V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase52_v3_run_id_invalid");
  }
  return join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json`,
  );
}

export function phase52SourceIdentity() {
  const status = gitOutput(["status", "--short"]) ?? "";
  const statusLines = status ? status.split(/\r?\n/).filter(Boolean) : [];
  const diffCheck = gitOutput(["diff", "--check"]);
  return {
    head: gitOutput(["rev-parse", "HEAD"]),
    branchMode: gitOutput(["symbolic-ref", "--short", "-q", "HEAD"])
      ? "ATTACHED"
      : "DETACHED_HEAD",
    branch: gitOutput(["branch", "--show-current"]),
    statusLineCount: statusLines.length,
    statusHash: hashText(status),
    diffCheck: diffCheck === "" ? "PASS" : "FAIL",
    sourceFiles: PHASE_5_2_SOURCE_PATHS.map((relativePath) => ({
      path: relativePath,
      sha256: hashFile(join(repoRoot, relativePath)),
    })),
  };
}

export function phase52PrerequisiteCheck(
  parentEvidence = readJson(join(repoRoot, PHASE_5_2_PARENT_EVIDENCE_PATH)),
) {
  const failures = [];
  if (!parentEvidence) failures.push("parent_evidence_missing_or_invalid_json");
  if (parentEvidence?.runId !== PHASE_5_2_PARENT_EVIDENCE_RUN_ID) {
    failures.push("parent_evidence_run_id_mismatch");
  }
  if (parentEvidence?.status !== "COMPLETE") failures.push("phase5_1_not_complete");
  if (parentEvidence?.outcome !== "HYPOTHESES_PRE_REGISTERED") {
    failures.push("phase5_1_outcome_invalid");
  }
  const candidate = parentEvidence?.hypothesisRegister?.find(
    (item) => item.candidateId === PHASE_5_2_CANDIDATE_ID,
  );
  if (!candidate) failures.push("first_candidate_missing");
  if (candidate?.optimizationStatus !== "NOT_AUTHORIZED_UNMEASURED") {
    failures.push("first_candidate_optimization_gate_invalid");
  }
  return {
    status: failures.length ? "BLOCKED" : "PASS",
    failures,
    parentEvidence: {
      runId: parentEvidence?.runId ?? null,
      status: parentEvidence?.status ?? null,
      outcome: parentEvidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_2_PARENT_EVIDENCE_PATH)),
    },
    candidateId: candidate?.candidateId ?? null,
  };
}

export function phase52ExperimentContract() {
  return {
    candidateId: PHASE_5_2_CANDIDATE_ID,
    title: "Shared shell and app-state hydration fan-out",
    variableId: PHASE_5_2_VARIABLE_ID,
    variable: {
      A: PHASE_5_2_POLICIES.A,
      B: PHASE_5_2_POLICIES.B,
      BDescription: "Gate the first app-state hydration trigger until shell bootstrap has completed.",
      runtimeDefault: PHASE_5_2_POLICIES.A,
      traceOnlyEnablement: "window.__aiyaPhase52TraceEnabled=true plus policy flag",
    },
    exactFilesAndFunctions: [
      "app/src/components/dashboard-app.tsx:138-149 hydration trigger and policy gate",
      "app/src/components/dashboard/shell-provider.tsx:253-337 runBootstrap lifecycle",
      "app/src/lib/use-aiya-state.ts:157-184 hydrate single-flight lifecycle",
      "app/src/lib/phase-52-diagnostic.ts:1-46 trace-only policy/event helper",
    ],
    journey: {
      id: PHASE_5_2_TRACE_JOURNEY_ID,
      linkedPlanJourneys: ["J1", "J2", "J3"],
      environment: "local_desktop",
      routeOrder: ["/login?next=/dashboard", "/dashboard", PHASE_5_2_TARGET_SELECTOR],
      startBoundary: "trusted_password_login_submit",
      routeCommitBoundary: "dashboard_url_observed_after_authenticated_navigation",
      endBoundary: "overview_work_areas_visible_after_client_hydration",
      requiredSubboundaries: [
        "trusted_action",
        "route_commit",
        "shell_bootstrap_request_start_and_body_finish",
        "app_state_request_start_and_body_finish",
        "client_hydration_start_and_complete",
        "target_ready",
      ],
    },
    matchedControls: [
      "same synthetic password-authenticated account and local normal tenant fixture",
      "same build and release identity for all nine traces",
      "same Chromium headless desktop browser, cold context, and service worker blocked",
      "same network, local Supabase, route order, target selector, and request contract",
      "same diagnostic instrumentation and request observation deadline",
    ],
    safetyChecks: [
      "tenant/session/role/capability and RLS identity remain unchanged",
      "full app-state completeness and freshness remain unchanged",
      "hydration single-flight and late-response behavior remain unchanged",
      "no mutation, provider egress, PWA cache, or offline privacy behavior is exercised",
    ],
    rollback: "Remove only the trace-only policy gate and diagnostic event hooks; restore A as the default.",
    repetitionContract: {
      cycles: PHASE_5_2_CYCLE_COUNT,
      order: ["A_before", "B", "A_after"],
      maxRepetitions: PHASE_5_2_MAX_REPETITIONS,
      countedAsOfficialSample: false,
    },
  };
}

function phase52LocalStatusSummary(localStatus) {
  let apiOrigin = null;
  try {
    apiOrigin = localStatus?.apiUrl ? new URL(localStatus.apiUrl).origin : null;
  } catch {
    apiOrigin = null;
  }
  return {
    status: localStatus?.status ?? "BLOCKED",
    apiUrl: apiOrigin,
    urlIsLocal: localStatus?.urlIsLocal === true,
    credentialsPresent: {
      anonKey: Boolean(localStatus?.anonKey),
      serviceRoleKey: Boolean(localStatus?.serviceRoleKey),
    },
    reason: localStatus?.reason ?? null,
  };
}

function runLocalBuild(localStatus, configuration, baseUrl) {
  if (!existsSync(nextCliPath)) {
    return { status: "BLOCKED", reason: "next_cli_missing", outputRecorded: false };
  }
  const environment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
    baseUrl,
    localStatus,
  });
  const result = spawnSync(
    process.execPath,
    [nextCliPath, "build", "--webpack"],
    {
      cwd: appRoot,
      env: environment,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  return {
    status: result.status === 0 ? "PASS" : "BLOCKED",
    exitCode: result.status,
    timedOut: result.error?.code === "ETIMEDOUT",
    reason: result.status === 0 ? null : "local_build_failed",
    outputRecorded: false,
  };
}

function startLocalServer(environment, baseUrl) {
  const port = new URL(baseUrl).port || "80";
  const output = [];
  const server = spawn(
    process.execPath,
    [nextCliPath, "start", "--port", String(port), "--hostname", "0.0.0.0"],
    {
      cwd: appRoot,
      env: { ...environment, PORT: String(port), HOSTNAME: "0.0.0.0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const collect = (chunk) => {
    output.push(String(chunk).slice(-2_000));
    if (output.length > 8) output.shift();
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  return { server, output };
}

async function waitForLocalServer(handle, baseUrl) {
  const startedAt = Date.now();
  const releaseUrl = new URL("/api/health/release", baseUrl).toString();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (handle.server.exitCode != null) throw new Error("phase52_next_server_exited");
    try {
      const response = await fetch(releaseUrl, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 200 && payload.status === "ok") return payload;
    } catch {
      // The production-mode local server may need a few seconds after spawn.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("phase52_next_server_timeout");
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
  while (server.exitCode == null && Date.now() - startedAt < SERVER_STOP_TIMEOUT_MS) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
}

function addTraceInitScript(page, policy) {
  return page.addInitScript(({ selectedPolicy }) => {
    window.__aiyaPhase52TraceEnabled = true;
    window.__aiyaPhase52SharedReadStartPolicy = selectedPolicy;
    window.__aiyaPhase52Events = [];
  }, { selectedPolicy: policy });
}

function relativeWallTime(atWallMs, traceStartWallMs) {
  return atWallMs == null || traceStartWallMs == null
    ? null
    : roundMs(Number(atWallMs) - traceStartWallMs);
}

function relativeRequestRecord(record, captureStartedAtWallMs, traceStartWallMs) {
  const offset = captureStartedAtWallMs - traceStartWallMs;
  return {
    route: record.route,
    method: record.method,
    resourceType: record.resourceType,
    startedAtMs: roundMs(record.startedAtMs + offset),
    responseHeaderAtMs: record.responseHeaderAtMs == null
      ? null
      : roundMs(record.responseHeaderAtMs + offset),
    bodyFinishedAtMs: record.bodyFinishedAtMs == null
      ? null
      : roundMs(record.bodyFinishedAtMs + offset),
    status: record.status,
    bodySizeBytes: record.bodySizeBytes,
    bodySizeSource: record.bodySizeSource,
    serverTiming: record.serverTiming,
    failed: record.failed,
  };
}

function firstRequest(requests, route) {
  return requests
    .filter((record) => record.route === route && (record.startedAtMs ?? -1) >= 0)
    .sort((left, right) => (left.startedAtMs ?? Infinity) - (right.startedAtMs ?? Infinity))[0] ?? null;
}

function firstEvent(events, name, traceStartWallMs) {
  return events
    .filter((event) => event?.name === name && Number(event.atWallMs) >= traceStartWallMs)
    .sort((left, right) => Number(left.atWallMs) - Number(right.atWallMs))[0] ?? null;
}

function eventAtMs(event, traceStartWallMs) {
  return event ? relativeWallTime(event.atWallMs, traceStartWallMs) : null;
}

function toTraceEvent(event, traceStartWallMs) {
  if (!event || typeof event !== "object") return null;
  return {
    name: event.name,
    atMs: eventAtMs(event, traceStartWallMs),
    atPerformanceMs: finite(event.atPerformanceMs),
    ...(typeof event.policy === "string" ? { policy: event.policy } : {}),
    ...(typeof event.reason === "string" ? { reason: event.reason } : {}),
    ...(typeof event.status === "string" ? { status: event.status } : {}),
    ...(typeof event.runtime === "string" ? { runtime: event.runtime } : {}),
  };
}

function classifyTrace(trace) {
  const failures = [];
  if (trace.policy !== PHASE_5_2_POLICIES.A && trace.policy !== PHASE_5_2_POLICIES.B) {
    failures.push("policy_invalid");
  }
  if (trace.trustedActionAtMs == null) failures.push("trusted_action_not_observed");
  if (trace.routeCommitAtMs == null) failures.push("route_commit_not_observed");
  for (const [name, read] of Object.entries(trace.reads)) {
    if (read.requestStartedAtMs == null) failures.push(`${name}_request_start_missing`);
    if (read.bodyFinishedAtMs == null) failures.push(`${name}_body_finish_missing`);
    if (read.status !== 200) failures.push(`${name}_status_not_200`);
  }
  if (trace.hydration.startedAtMs == null) failures.push("hydration_start_missing");
  if (trace.hydration.completedAtMs == null) failures.push("hydration_complete_missing");
  if (trace.targetReadyAtMs == null) failures.push("target_ready_missing");
  const targetReady = trace.targetReadyAtMs != null;
  const observationValidity = failures.length === 0 ? "VALID" : "INVALID";
  return {
    observationValidity,
    functionalOutcome: targetReady ? "SUCCESS" : "INCOMPLETE",
    timingOutcome: targetReady ? "MEASURED" : "NOT_EVALUABLE",
    failures,
  };
}

export async function runPhase52Trace({
  browser,
  baseUrl,
  email,
  password,
  policy,
  cycle,
  position,
  checkpoint = null,
} = {}) {
  const traceStartFallback = Date.now();
  const trace = {
    traceId: `cycle-${cycle}-${position}`,
    journeyId: PHASE_5_2_TRACE_JOURNEY_ID,
    cycle,
    position,
    policy,
    environment: "local_desktop",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", PHASE_5_2_TARGET_SELECTOR],
    traceStartBoundary: "trusted_password_login_submit",
    traceStartWallMs: null,
    trustedActionAtMs: null,
    trustedActionSource: null,
    routeCommitAtMs: null,
    routeCommitSource: null,
    reads: {
      shellBootstrap: {
        route: REQUIRED_READ_PATHS.shellBootstrap,
        requestStartedAtMs: null,
        responseHeaderAtMs: null,
        bodyFinishedAtMs: null,
        status: null,
        serverTiming: [],
      },
      appState: {
        route: REQUIRED_READ_PATHS.appState,
        requestStartedAtMs: null,
        responseHeaderAtMs: null,
        bodyFinishedAtMs: null,
        status: null,
        serverTiming: [],
      },
    },
    hydration: {
      triggerAtMs: null,
      startedAtMs: null,
      completedAtMs: null,
    },
    targetReadyAtMs: null,
    targetInteractivePaintAtMs: null,
    routeEvents: [],
    clientEvents: [],
    requestCapture: null,
    browserMetrics: null,
    errorClass: null,
  };
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  let capture = null;
  try {
    await installPhase44BrowserInstrumentation(page, "diagnostic");
    await addTraceInitScript(page, policy);
    capture = createRichRequestCapture(page);
    await page.goto(`${baseUrl}/login?next=/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: TRACE_TIMEOUT_MS,
    });
    await page.waitForFunction(() => {
      const input = document.querySelector("#customer-login-email");
      return input instanceof HTMLInputElement &&
        Object.prototype.hasOwnProperty.call(input, "_valueTracker");
    }, { timeout: TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-email").fill(email, { timeout: TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-password").fill(password, { timeout: TRACE_TIMEOUT_MS });

    trace.traceStartWallMs = Date.now();
    const loginRequestPromise = page
      .waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/password-login", {
        timeout: TRACE_TIMEOUT_MS,
      })
      .catch(() => null);
    const loginResponsePromise = page
      .waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/password-login", {
        timeout: TRACE_TIMEOUT_MS,
      })
      .catch(() => null);
    const routeCommitPromise = page.waitForURL(
      (url) => new URL(url).pathname === ROUTE_PATH,
      { timeout: TRACE_TIMEOUT_MS },
    );
    const trustedClickDispatchWallMs = Date.now();
    await page.locator('[data-testid="customer-login-submit"]').click({ timeout: TRACE_TIMEOUT_MS });
    trace.trustedActionAtMs = roundMs(trustedClickDispatchWallMs - trace.traceStartWallMs);
    trace.trustedActionSource = "playwright_locator_click";
    const [loginRequest, loginResponse] = await Promise.all([
      loginRequestPromise,
      loginResponsePromise,
    ]);
    if (!loginRequest || !loginResponse || !loginResponse.ok()) {
      throw new Error("phase52_password_login_failed");
    }
    await loginResponse.finished();
    await routeCommitPromise;
    trace.routeCommitAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    trace.routeCommitSource = "page_url_observed";
    await waitForReady(page, '[data-testid="authenticated-shell"]');
    await waitForReady(page, PHASE_5_2_TARGET_SELECTOR);
    trace.targetReadyAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await page.evaluate(
      () => new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise))),
    );
    trace.targetInteractivePaintAtMs = roundMs(Date.now() - trace.traceStartWallMs);
  } catch (error) {
    trace.errorClass = safeErrorClass(error);
  }

  const traceStartWallMs = trace.traceStartWallMs ?? traceStartFallback;
  const browserState = await page.evaluate(() => ({
    phase52Events: window.__aiyaPhase52Events ?? [],
    phase44RouteEvents: window.__aiyaPhase44?.routeEvents ?? [],
  })).catch(() => ({ phase52Events: [], phase44RouteEvents: [] }));
  const captureSummary = capture
    ? await capture.finish().catch(() => ({
        captureStartedAtWallMs: traceStartWallMs,
        requests: [],
        overlappingRequests: [],
        bodyFinishTimedOut: true,
      }))
    : {
        captureStartedAtWallMs: traceStartWallMs,
        requests: [],
        overlappingRequests: [],
        bodyFinishTimedOut: true,
      };
  capture?.dispose();
  const requests = (captureSummary.requests ?? []).map((record) =>
    relativeRequestRecord(record, captureSummary.captureStartedAtWallMs, traceStartWallMs),
  );
  const shellBootstrapRequest = firstRequest(requests, REQUIRED_READ_PATHS.shellBootstrap);
  const appStateRequest = firstRequest(requests, REQUIRED_READ_PATHS.appState);
  const shellStart = firstEvent(browserState.phase52Events, "shell_bootstrap_started", traceStartWallMs);
  const shellComplete = firstEvent(browserState.phase52Events, "shell_bootstrap_completed", traceStartWallMs);
  const hydrationTrigger = firstEvent(browserState.phase52Events, "dashboard_hydration_triggered", traceStartWallMs);
  const hydrationStart = firstEvent(browserState.phase52Events, "app_state_hydration_started", traceStartWallMs);
  const hydrationComplete = firstEvent(browserState.phase52Events, "app_state_hydration_completed", traceStartWallMs);
  trace.traceStartWallMs = undefined;
  trace.reads.shellBootstrap = {
    route: REQUIRED_READ_PATHS.shellBootstrap,
    requestStartedAtMs: shellBootstrapRequest?.startedAtMs ?? null,
    responseHeaderAtMs: shellBootstrapRequest?.responseHeaderAtMs ?? null,
    bodyFinishedAtMs: shellBootstrapRequest?.bodyFinishedAtMs ?? null,
    status: shellBootstrapRequest?.status ?? null,
    serverTiming: shellBootstrapRequest?.serverTiming ?? [],
    clientStartedAtMs: eventAtMs(shellStart, traceStartWallMs),
    clientCompletedAtMs: eventAtMs(shellComplete, traceStartWallMs),
  };
  trace.reads.appState = {
    route: REQUIRED_READ_PATHS.appState,
    requestStartedAtMs: appStateRequest?.startedAtMs ?? null,
    responseHeaderAtMs: appStateRequest?.responseHeaderAtMs ?? null,
    bodyFinishedAtMs: appStateRequest?.bodyFinishedAtMs ?? null,
    status: appStateRequest?.status ?? null,
    serverTiming: appStateRequest?.serverTiming ?? [],
    clientStartedAtMs: eventAtMs(hydrationStart, traceStartWallMs),
    clientCompletedAtMs: eventAtMs(hydrationComplete, traceStartWallMs),
  };
  trace.hydration = {
    triggerAtMs: eventAtMs(hydrationTrigger, traceStartWallMs),
    startedAtMs: eventAtMs(hydrationStart, traceStartWallMs),
    completedAtMs: eventAtMs(hydrationComplete, traceStartWallMs),
  };
  trace.routeEvents = browserState.phase44RouteEvents
    .filter((event) => Number(event.atWallMs) >= traceStartWallMs)
    .map((event) => ({
      atMs: relativeWallTime(event.atWallMs, traceStartWallMs),
      route: typeof event.route === "string" ? new URL(event.route, baseUrl).pathname : null,
      source: typeof event.source === "string" ? event.source : null,
    }));
  trace.clientEvents = browserState.phase52Events
    .filter((event) => Number(event.atWallMs) >= traceStartWallMs)
    .map((event) => toTraceEvent(event, traceStartWallMs))
    .filter(Boolean);
  trace.requestCapture = {
    requestCount: requests.length,
    apiRequestCount: requests.filter((record) => record.route.startsWith("/api/")).length,
    bodyFinishTimedOut: captureSummary.bodyFinishTimedOut === true,
    requests: requests.filter((record) =>
      record.route === REQUIRED_READ_PATHS.shellBootstrap ||
      record.route === REQUIRED_READ_PATHS.appState ||
      record.route === "/api/auth/password-login" ||
      record.resourceType === "document",
    ),
    overlappingRequests: (captureSummary.overlappingRequests ?? [])
      .filter((overlap) =>
        overlap.leftRoute === REQUIRED_READ_PATHS.shellBootstrap ||
        overlap.rightRoute === REQUIRED_READ_PATHS.shellBootstrap ||
        overlap.leftRoute === REQUIRED_READ_PATHS.appState ||
        overlap.rightRoute === REQUIRED_READ_PATHS.appState,
      )
      .map((overlap) => ({
        leftRoute: overlap.leftRoute,
        rightRoute: overlap.rightRoute,
        overlapStartAtMs: roundMs(overlap.overlapStartAtMs + captureSummary.captureStartedAtWallMs - traceStartWallMs),
        overlapEndAtMs: roundMs(overlap.overlapEndAtMs + captureSummary.captureStartedAtWallMs - traceStartWallMs),
      })),
  };
  trace.browserMetrics = await collectBrowserMetrics(page, "diagnostic").catch(() => null);
  const classification = classifyTrace(trace);
  Object.assign(trace, classification);
  trace.boundary = {
    trustedActionToTargetReadyMs:
      trace.trustedActionAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.trustedActionAtMs)
        : null,
    routeCommitToTargetReadyMs:
      trace.routeCommitAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.routeCommitAtMs)
        : null,
    routeCommitToHydrationStartMs:
      trace.routeCommitAtMs != null && trace.hydration.startedAtMs != null
        ? roundMs(trace.hydration.startedAtMs - trace.routeCommitAtMs)
        : null,
    hydrationStartToCompleteMs:
      trace.hydration.startedAtMs != null && trace.hydration.completedAtMs != null
        ? roundMs(trace.hydration.completedAtMs - trace.hydration.startedAtMs)
        : null,
  };
  const sanitized = sanitizePhase52Evidence(trace);
  checkpoint?.append("experiment.trace.completed", sanitized, {
    status: trace.observationValidity === "VALID" ? "RUNNING" : "RUNNING",
  });
  await context.close();
  return sanitized;
}

function median(values) {
  const sorted = values.filter((value) => finite(value) != null).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizePhase52Cycles(traces) {
  const cycles = [];
  for (let cycle = 1; cycle <= PHASE_5_2_CYCLE_COUNT; cycle += 1) {
    const cycleTraces = traces.filter((trace) => trace.cycle === cycle);
    const before = cycleTraces.find((trace) => trace.position === "A_before");
    const variant = cycleTraces.find((trace) => trace.position === "B");
    const after = cycleTraces.find((trace) => trace.position === "A_after");
    const aMedian = median([before?.boundary?.routeCommitToTargetReadyMs, after?.boundary?.routeCommitToTargetReadyMs]);
    const bBoundary = variant?.boundary?.routeCommitToTargetReadyMs ?? null;
    const delta = aMedian != null && bBoundary != null ? roundMs(bBoundary - aMedian) : null;
    cycles.push({
      cycle,
      traceIds: [before?.traceId, variant?.traceId, after?.traceId].filter(Boolean),
      observationValid: [before, variant, after].every((trace) => trace?.observationValidity === "VALID"),
      aBoundaryMs: aMedian,
      bBoundaryMs: bBoundary,
      deltaBMinusAMs: delta,
      direction: delta == null ? "NOT_EVALUABLE" : delta < 0 ? "B_FASTER" : delta > 0 ? "B_SLOWER" : "EQUAL",
    });
  }
  const directions = cycles.map((cycle) => cycle.direction).filter((direction) => direction !== "NOT_EVALUABLE");
  const repeatable =
    directions.length === PHASE_5_2_CYCLE_COUNT &&
    directions.every((direction) => direction === directions[0]) &&
    directions[0] !== "EQUAL";
  return {
    cycles,
    repeatable,
    conclusion: repeatable ? "REPEATABLE_PROVISIONAL_EFFECT" : "INCONCLUSIVE",
    noCauseConfirmed: true,
    findingDispositionChanged: false,
  };
}

export function buildPhase52Evidence(result, {
  generatedAt = new Date().toISOString(),
  sourceIdentity = phase52SourceIdentity(),
} = {}) {
  const contract = phase52ExperimentContract();
  const cycleSummary = result.cycleSummary ?? summarizePhase52Cycles(result.traces ?? []);
  const traces = result.traces ?? [];
  const validTraceCount = traces.filter((trace) => trace.observationValidity === "VALID").length;
  const allNineAttempted = traces.length === PHASE_5_2_CYCLE_COUNT * 3;
  const environmentBlocked = result.status === "BLOCKED" && traces.length === 0;
  const status = result.status ?? (allNineAttempted ? "COMPLETE" : "BLOCKED");
  return sanitizePhase52Evidence({
    schemaVersion: "aiya-performance-plan1-v3-phase5-2-single-variable-evidence-v1",
    planRevision: PHASE_5_2_PLAN_REVISION,
    phase: "5",
    stage: "5.2",
    stageId: "5.2",
    runId: result.runId ?? null,
    generatedAt,
    status,
    outcome: environmentBlocked ? "SINGLE_VARIABLE_EXPERIMENT_BLOCKED" : cycleSummary.conclusion,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Measure H-5.1-001 with three matched A -> B -> A local desktop cycles.",
      environment: "local_desktop",
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: traces.length > 0,
      causalExperimentStarted: traces.length > 0,
      runtimeChangeAcceptedAsFix: false,
      externalOperations: [],
      preservedExistingChanges: true,
      countedAsOfficialSample: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_2_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.7 COMPLETE / DIAGNOSIS_BLOCKED",
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
      ],
      currentStage: "5.2",
      nextEligibleStage: allNineAttempted && validTraceCount === traces.length ? "5.3" : "5.2 retry or blocked review",
    },
    sourceIdentity,
    parentEvidence: result.parentEvidence,
    experimentContract: contract,
    buildIdentity: result.buildIdentity ?? null,
    inputPreflight: result.preflight ?? null,
    cycleSummary,
    sampleSummary: {
      attemptedTraces: traces.length,
      plannedTraces: PHASE_5_2_CYCLE_COUNT * 3,
      observationValidTraces: validTraceCount,
      observationInvalidTraces: traces.length - validTraceCount,
      allNineAttempted,
      validTracesAreNotOfficialBaseline: true,
    },
    traces,
    blockers: result.blockers ?? [],
    findingDispositionChanges: [],
    deferredToLaterStages: [
      "5.3 layer attribution is required before any exact cause claim.",
      "5.4 safety and behavior checks are required before any fix proposal.",
      "AI Chat F12 findings remain deferred without a dedicated journey.",
    ],
    constraints: [
      "The B policy is a reversible trace-only probe and is not an accepted runtime fix.",
      "No official nine-scenario sample was started.",
      "No data, API, auth, RLS, migration, dependency, secret, provider, channel, or production change was made.",
      "A result is INCONCLUSIVE unless the measured direction repeats in all three matched cycles.",
      "Credentials, cookies, tokens, raw bodies, prompts, clinical content, and device serials are excluded.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PASS",
      redactionCheck: "PASS",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      parentEvidenceParsed: result.prerequisite?.status === "PASS",
      parentEvidenceIntegrityPass: result.prerequisite?.status === "PASS",
      officialMeasurementStarted: false,
      causalExperimentStarted: traces.length > 0,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      checkpointHashChain: result.checkpoint?.hashChainRead ?? null,
      checkpointComplete: result.checkpoint?.status ?? null,
      incompleteTracesRemainInvalid: true,
      findingManifestChanged: false,
    },
    closure: {
      status,
      outcome: environmentBlocked ? "SINGLE_VARIABLE_EXPERIMENT_BLOCKED" : cycleSummary.conclusion,
      phase4Closed: true,
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: traces.length > 0,
      runtimeFixAccepted: false,
      nextAction: environmentBlocked
        ? "Repair only the declared local input or build boundary; preserve this blocked run."
        : cycleSummary.repeatable
          ? "Proceed to 5.3 layer attribution and 5.4 safety checks; do not accept a runtime fix from 5.2 alone."
          : "Record the experiment as INCONCLUSIVE and review the timing boundary before any new variable is proposed.",
    },
    checkpointReconciliation: result.checkpoint ?? null,
  });
}

export async function runPhase52Experiment({
  baseUrl = process.env.AIYA_PHASE52_BASE_URL || PHASE_5_2_DEFAULT_BASE_URL,
  newRun = false,
  reconcileRunId = null,
} = {}) {
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");
  const parentEvidence = readJson(join(repoRoot, PHASE_5_2_PARENT_EVIDENCE_PATH));
  const prerequisite = phase52PrerequisiteCheck(parentEvidence);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = (() => {
    try {
      return parseLocalSupabaseStatus();
    } catch (error) {
      return { status: "BLOCKED", reason: safeErrorClass(error) };
    }
  })();
  const sourceIdentity = phase52SourceIdentity();
  const identity = {
    planRevision: PHASE_5_2_PLAN_REVISION,
    candidateId: PHASE_5_2_CANDIDATE_ID,
    variableId: PHASE_5_2_VARIABLE_ID,
    environment: "local_desktop",
    baseOrigin: new URL(normalizedBaseUrl).origin,
    sourceHead: sourceIdentity.head,
    sourceFiles: sourceIdentity.sourceFiles,
    parentEvidenceSha256: prerequisite.parentEvidence.sha256,
    buildControl: "one_same_build_for_all_A_B_A_traces",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", PHASE_5_2_TARGET_SELECTOR],
    repetitionOrder: ["A_before", "B", "A_after"],
  };
  if (reconcileRunId) {
    if (!new RegExp(`^${PHASE_5_2_CHECKPOINT_PHASE_ID}-[A-Za-z0-9-]+$`).test(reconcileRunId)) {
      throw new Error("phase52_reconciliation_run_id_invalid");
    }
    return phase52PersistedRunResult(readPhaseRun({
      root: PHASE_5_2_CHECKPOINT_ROOT,
      phaseId: PHASE_5_2_CHECKPOINT_PHASE_ID,
      runId: reconcileRunId,
    }), prerequisite);
  }
  const opened = openPhaseRun({
    root: PHASE_5_2_CHECKPOINT_ROOT,
    phaseId: PHASE_5_2_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_5_2_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata: {
      planRevision: PHASE_5_2_PLAN_REVISION,
      candidateId: PHASE_5_2_CANDIDATE_ID,
      variableId: PHASE_5_2_VARIABLE_ID,
      countedAsOfficialSample: false,
    },
    newRun,
    redact: sanitizePhase52Evidence,
  });
  if (opened.action === "COMPLETE") {
    const run = readPhaseRun({
      root: PHASE_5_2_CHECKPOINT_ROOT,
      phaseId: PHASE_5_2_CHECKPOINT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return phase52PersistedRunResult(run, prerequisite);
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: opened.action,
      outcome: "EXPERIMENT_CHECKPOINT_NOT_RUN",
      traces: [],
      prerequisite,
      parentEvidence: prerequisite.parentEvidence,
      blockers: [opened.reason ?? "checkpoint_not_run"],
      checkpoint: {
        status: opened.manifest?.status ?? opened.action,
        runId: opened.manifest?.runId ?? null,
        eventCount: 0,
        hashChainRead: false,
        lastEventType: null,
      },
    };
  }
  const checkpoint = opened.run;
  checkpoint.append("experiment.contract.bound", {
    ...phase52ExperimentContract(),
    countedAsOfficialSample: false,
  });
  if (prerequisite.status !== "PASS") {
    checkpoint.append("environment.preflight", {
      status: "BLOCKED",
      blockers: prerequisite.failures,
      parentEvidence: prerequisite.parentEvidence,
    }, { status: "BLOCKED" });
    checkpoint.markStatus("BLOCKED", { reason: "phase52_prerequisite_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "EXPERIMENT_PREREQUISITE_BLOCKED",
      traces: [],
      prerequisite,
      parentEvidence: prerequisite.parentEvidence,
      blockers: prerequisite.failures,
      checkpoint: phase52CheckpointSummary(checkpoint.runId),
    };
  }
  if (localStatus.status !== "PASS") {
    const blockers = ["local_supabase_unreachable_or_not_ready"];
    checkpoint.append("environment.preflight", {
      status: "BLOCKED",
      blockers,
      localSupabase: phase52LocalStatusSummary(localStatus),
      configuration: configuration.summary,
    }, { status: "BLOCKED" });
    checkpoint.markStatus("BLOCKED", { reason: blockers[0] });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "EXPERIMENT_LOCAL_INPUT_BLOCKED",
      traces: [],
      prerequisite,
      parentEvidence: prerequisite.parentEvidence,
      blockers,
      preflight: { status: "BLOCKED", blockers, localSupabase: phase52LocalStatusSummary(localStatus) },
      checkpoint: phase52CheckpointSummary(checkpoint.runId),
    };
  }
  const build = runLocalBuild(localStatus, configuration, normalizedBaseUrl);
  checkpoint.append("environment.build", {
    status: build.status,
    exitCode: build.exitCode ?? null,
    timedOut: build.timedOut === true,
    outputRecorded: false,
  }, { status: build.status === "PASS" ? "RUNNING" : "BLOCKED" });
  if (build.status !== "PASS") {
    const blockers = [build.reason ?? "local_build_failed"];
    checkpoint.markStatus("BLOCKED", { reason: blockers[0] });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "EXPERIMENT_BUILD_BLOCKED",
      traces: [],
      prerequisite,
      parentEvidence: prerequisite.parentEvidence,
      blockers,
      preflight: { status: "BLOCKED", blockers, build },
      checkpoint: phase52CheckpointSummary(checkpoint.runId),
    };
  }
  const serverEnvironment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
    baseUrl: normalizedBaseUrl,
    localStatus,
  });
  const server = startLocalServer(serverEnvironment, normalizedBaseUrl);
  const traces = [];
  let releaseIdentity = null;
  let preflight = null;
  try {
    const release = await waitForLocalServer(server, normalizedBaseUrl);
    releaseIdentity = {
      status: release.status === "ok" ? "PASS" : "BLOCKED",
      httpStatus: 200,
      apiStatus: release.status === "ok" ? "ok" : null,
      release: typeof release.release === "string" ? release.release : null,
    };
    preflight = await checkPhase44LocalInputs(normalizedBaseUrl, {
      emailAvailable: Boolean(configuration.email),
      passwordAvailable: Boolean(configuration.password),
    });
    checkpoint.append("environment.preflight", {
      status: preflight.status,
      fixtureId: "local-normal",
      environment: "local_desktop",
      credentialsAvailable: preflight.credentialsAvailable,
      app: preflight.app,
      supabase: preflight.supabase,
      blockers: preflight.blockers,
      release: releaseIdentity,
      localSupabase: phase52LocalStatusSummary(localStatus),
    }, { status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED" });
    if (preflight.status !== "PASS") {
      const blockers = preflight.blockers;
      checkpoint.markStatus("BLOCKED", { reason: "experiment_preflight_blocked" });
      checkpoint.close();
      return {
        runId: checkpoint.runId,
        status: "BLOCKED",
        outcome: "EXPERIMENT_PREFLIGHT_BLOCKED",
        traces,
        prerequisite,
        parentEvidence: prerequisite.parentEvidence,
        blockers,
        preflight,
        buildIdentity: releaseIdentity,
        checkpoint: phase52CheckpointSummary(checkpoint.runId),
      };
    }
    const browser = await chromium.launch({ headless: true });
    try {
      for (let cycle = 1; cycle <= PHASE_5_2_CYCLE_COUNT; cycle += 1) {
        const cycleTraces = [];
        for (const position of ["A_before", "B", "A_after"]) {
          const policy = position === "B" ? PHASE_5_2_POLICIES.B : PHASE_5_2_POLICIES.A;
          checkpoint.append("experiment.trace.started", {
            cycle,
            position,
            policy,
            candidateId: PHASE_5_2_CANDIDATE_ID,
            variableId: PHASE_5_2_VARIABLE_ID,
            countedAsOfficialSample: false,
          });
          const trace = await runPhase52Trace({
            browser,
            baseUrl: normalizedBaseUrl,
            email: configuration.email,
            password: configuration.password,
            policy,
            cycle,
            position,
            checkpoint,
          });
          traces.push(trace);
          cycleTraces.push(trace);
        }
        checkpoint.append("experiment.cycle.completed", {
          cycle,
          traceIds: cycleTraces.map((trace) => trace.traceId),
          observationValid: cycleTraces.every((trace) => trace.observationValidity === "VALID"),
          countedAsOfficialSample: false,
        });
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "experiment_runner_failed",
      errorClass: safeErrorClass(error),
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "EXPERIMENT_RUNNER_BLOCKED",
      traces,
      prerequisite,
      parentEvidence: prerequisite.parentEvidence,
      blockers: ["experiment_runner_failed"],
      preflight,
      buildIdentity: releaseIdentity,
      checkpoint: phase52CheckpointSummary(checkpoint.runId),
    };
  } finally {
    await stopLocalServer(server);
  }
  const cycleSummary = summarizePhase52Cycles(traces);
  const allValid = traces.length === PHASE_5_2_CYCLE_COUNT * 3 &&
    traces.every((trace) => trace.observationValidity === "VALID");
  const status = allValid ? "COMPLETE" : "BLOCKED";
  if (status === "BLOCKED") {
    checkpoint.markStatus("BLOCKED", {
      reason: "invalid_or_incomplete_experiment_trace",
      attemptedTraceCount: traces.length,
      validTraceCount: traces.filter((trace) => trace.observationValidity === "VALID").length,
    });
  } else {
    checkpoint.markStatus("COMPLETE", {
      attemptedTraceCount: traces.length,
      validTraceCount: traces.length,
      conclusion: cycleSummary.conclusion,
      countedAsOfficialSample: false,
    });
  }
  checkpoint.close();
  return {
    runId: checkpoint.runId,
    status,
    outcome: status === "COMPLETE" ? cycleSummary.conclusion : "EXPERIMENT_TRACE_BLOCKED",
    traces,
    prerequisite,
    parentEvidence: prerequisite.parentEvidence,
    preflight,
    buildIdentity: releaseIdentity,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : ["invalid_or_incomplete_experiment_trace"],
    checkpoint: phase52CheckpointSummary(checkpoint.runId),
  };
}

function parseArguments(argv) {
  const options = {
    descriptor: false,
    status: false,
    run: false,
    newRun: false,
    reconcileRunId: null,
    writeEvidence: false,
    baseUrl: process.env.AIYA_PHASE52_BASE_URL || PHASE_5_2_DEFAULT_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--reconcile-run-id") options.reconcileRunId = argv[++index];
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`phase52_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(sanitizePhase52Evidence({
      phase: "5",
      stage: "5.2",
      planRevision: PHASE_5_2_PLAN_REVISION,
      experimentContract: phase52ExperimentContract(),
      prerequisite: phase52PrerequisiteCheck(),
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
    }), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: PHASE_5_2_CHECKPOINT_ROOT,
      phaseId: PHASE_5_2_CHECKPOINT_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Phase 5.2 single-variable experiment ready. Use --descriptor, --status, or explicit --run.\n");
    return;
  }
  const result = await runPhase52Experiment({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
    reconcileRunId: options.reconcileRunId,
  });
  const priorEvidence = options.reconcileRunId
    ? readJson(phase52V3EvidencePath(result.runId))
    : null;
  const evidence = buildPhase52Evidence(result, {
    sourceIdentity: priorEvidence?.sourceIdentity ?? phase52SourceIdentity(),
  });
  if (options.writeEvidence && result.runId) {
    writeFileSync(phase52V3EvidencePath(result.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
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
