#!/usr/bin/env node

/**
 * AIya Performance Plan 1 - Phase 5.5 remaining candidate loop.
 *
 * This runner observes H-5.1-002 on the local desktop with three matched
 * A -> B -> A cycles. B is a trace-only navigation-window polling probe.
 * No trace is an official baseline sample or an accepted runtime fix.
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

export const PHASE_5_5_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_5_CANDIDATE_ID = "H-5.1-002";
export const PHASE_5_5_VARIABLE_ID = "foreground_polling_policy";
export const PHASE_5_5_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase5-5-candidate-loop-v3";
export const PHASE_5_5_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase5-5-candidate-loop-v3";
export const PHASE_5_5_CHECKPOINT_ROOT = join(repoRoot, ".manu-runtime", "phase-execution");
export const PHASE_5_5_DEFAULT_BASE_URL = "http://127.0.0.1:3143";
export const PHASE_5_5_CYCLE_COUNT = 3;
export const PHASE_5_5_MAX_REPETITIONS = 5;
export const PHASE_5_5_TRACE_TIMEOUT_MS = 60_000;
export const PHASE_5_5_POLL_WAIT_TIMEOUT_MS = 45_000;
export const PHASE_5_5_POLICIES = Object.freeze({
  A: "current",
  B: "navigation_window_pause_cancel",
});
export const PHASE_5_5_TRACE_JOURNEY_ID = "P5.5-H-5.1-002-dashboard-to-messages";
export const PHASE_5_5_TARGET_SELECTOR = '[data-testid="messaging-panel"]';
export const PHASE_5_5_PARENT_EVIDENCE_RUN_ID =
  "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f";
export const PHASE_5_5_PARENT_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_5_PARENT_EVIDENCE_RUN_ID}_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`;
export const PHASE_5_5_SAFETY_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json";
export const PHASE_5_5_SOURCE_PATHS = Object.freeze([
  "app/src/components/dashboard/dashboard-navigation.tsx",
  "app/src/lib/use-stage-4b-inbox.ts",
  "app/src/lib/use-stage-4b2-messaging.ts",
  "app/src/lib/phase-55-polling-diagnostic.ts",
  "app/scripts/performance-plan-1-phase-5-5-candidate-loop.mjs",
  "app/scripts/performance-plan-1-phase-5-5-candidate-loop.test.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  PHASE_5_5_PARENT_EVIDENCE_PATH,
  PHASE_5_5_SAFETY_EVIDENCE_PATH,
]);

const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_STOP_TIMEOUT_MS = 10_000;
const ROUTE_PATH = "/dashboard";
const REQUIRED_READ_PATHS = Object.freeze({
  shellBootstrap: "/api/shell/bootstrap",
  appState: "/api/app-state",
  messages: "/api/conversations",
});
const POLLING_PATH_PREFIXES = Object.freeze([
  "/api/alerts",
  "/api/notifications",
  "/api/conversations",
]);

function safeErrorClass(error) {
  return String(error?.name || "Error").slice(0, 120);
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

function phase55CheckpointSummary(runId) {
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
    root: PHASE_5_5_CHECKPOINT_ROOT,
    phaseId: PHASE_5_5_CHECKPOINT_PHASE_ID,
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

function phase55LocalStatusSummary(localStatus) {
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

function phase55SourceIdentity() {
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
    sourceFiles: PHASE_5_5_SOURCE_PATHS.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

export function phase55PrerequisiteCheck(
  parentEvidence = readJson(join(repoRoot, PHASE_5_5_PARENT_EVIDENCE_PATH)),
  safetyEvidence = readJson(join(repoRoot, PHASE_5_5_SAFETY_EVIDENCE_PATH)),
) {
  const failures = [];
  if (!parentEvidence) failures.push("parent_hypothesis_evidence_missing_or_invalid_json");
  if (parentEvidence?.runId !== PHASE_5_5_PARENT_EVIDENCE_RUN_ID) {
    failures.push("parent_hypothesis_run_id_mismatch");
  }
  if (parentEvidence?.status !== "COMPLETE") failures.push("phase5_1_not_complete");
  if (parentEvidence?.outcome !== "HYPOTHESES_PRE_REGISTERED") {
    failures.push("phase5_1_outcome_invalid");
  }
  const candidate = parentEvidence?.hypothesisRegister?.find(
    (item) => item.candidateId === PHASE_5_5_CANDIDATE_ID,
  );
  if (!candidate) failures.push("second_candidate_missing");
  if (candidate?.optimizationStatus !== "NOT_AUTHORIZED_UNMEASURED") {
    failures.push("second_candidate_optimization_gate_invalid");
  }
  if (!safetyEvidence) failures.push("phase5_4_safety_evidence_missing_or_invalid_json");
  if (safetyEvidence?.status !== "COMPLETE") failures.push("phase5_4_not_complete");
  if (safetyEvidence?.outcome !== "SAFETY_BEHAVIOR_CHECKS_COMPLETE") {
    failures.push("phase5_4_outcome_invalid");
  }
  return {
    status: failures.length ? "BLOCKED" : "PASS",
    failures,
    parentEvidence: {
      runId: parentEvidence?.runId ?? null,
      status: parentEvidence?.status ?? null,
      outcome: parentEvidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_5_PARENT_EVIDENCE_PATH)),
    },
    safetyEvidence: {
      runId: safetyEvidence?.runId ?? null,
      status: safetyEvidence?.status ?? null,
      outcome: safetyEvidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_5_SAFETY_EVIDENCE_PATH)),
    },
    candidateId: candidate?.candidateId ?? null,
  };
}

export function phase55CandidateLoopContract() {
  return {
    candidateId: PHASE_5_5_CANDIDATE_ID,
    title: "Background inbox and messaging polling overlap during navigation",
    variableId: PHASE_5_5_VARIABLE_ID,
    variable: {
      A: PHASE_5_5_POLICIES.A,
      B: PHASE_5_5_POLICIES.B,
      BDescription: "Pause the polling timer and cancel an active polling request during the trace-only navigation window.",
      runtimeDefault: PHASE_5_5_POLICIES.A,
      traceOnlyEnablement: "window.__aiyaPhase55TraceEnabled=true plus policy flag",
    },
    exactFilesAndFunctions: [
      "app/src/components/dashboard/dashboard-navigation.tsx:ShellNavLink trusted navigation click boundary",
      "app/src/lib/use-stage-4b-inbox.ts:visible-page polling schedule and abort refs",
      "app/src/lib/use-stage-4b2-messaging.ts:visible-page polling schedule and abort refs",
      "app/src/lib/phase-55-polling-diagnostic.ts:trace-only navigation window and event ledger",
    ],
    journey: {
      id: PHASE_5_5_TRACE_JOURNEY_ID,
      linkedPlanJourneys: ["J1", "J2", "J3"],
      environment: "local_desktop",
      routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_TARGET_SELECTOR],
      startBoundary: "trusted_password_login_submit",
      pollingBoundary: "poll_start_and_end plus request body finish",
      navigationBoundary: "trusted_messages_navigation_click",
      routeCommitBoundary: "dashboard_messages_url_observed",
      endBoundary: "messaging_panel_visible_after_authenticated_navigation",
      requiredSubboundaries: [
        "trusted_action",
        "shell_bootstrap_request_start_and_body_finish",
      "app_state_request_start_and_body_finish",
        "inbox_and_messaging_poll_start_and_end",
        "foreground_messages_request_body_finish",
        "route_commit",
        "target_ready",
        "long_task_or_render_window",
      ],
    },
    matchedControls: [
      "same synthetic password-authenticated account and local normal tenant fixture",
      "same build and release identity for all nine traces",
      "same Chromium headless desktop viewport, cold context, and service worker blocked",
      "same network, local Supabase, route order, target selector, and request contract",
      "same 30s/15s polling intervals, request gate, in-flight dedupe, and abort semantics outside the probe window",
    ],
    safetyChecks: [
      "tenant/session/role/capability and RLS identity remain unchanged",
      "authenticated shell and full app-state reads remain status 200 with body finish",
      "conversation data remains status 200 with body finish before or during the messages navigation",
      "late-response and request-gate behavior remain active; no mutation path is exercised",
    ],
    rollback: "Remove only the trace-only navigation-window policy/event hooks; restore current visible-page polling as the default.",
    repetitionContract: {
      cycles: PHASE_5_5_CYCLE_COUNT,
      order: ["A_before", "B", "A_after"],
      maxRepetitions: PHASE_5_5_MAX_REPETITIONS,
      countedAsOfficialSample: false,
    },
  };
}

function redactString(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<redacted-email>")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer <redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>");
}

const SENSITIVE_KEY = /(?:password|token|secret|cookie|authorization|prompt|clinical|raw.?body|credential|private.?key|api.?key|email|phone)/i;

export function sanitizePhase55Evidence(value, key = "") {
  if (SENSITIVE_KEY.test(String(key))) return "<redacted>";
  if (Array.isArray(value)) return value.map((item) => sanitizePhase55Evidence(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizePhase55Evidence(childValue, childKey),
      ]),
    );
  }
  if (typeof value === "string") return redactString(value);
  return value;
}

export function phase55V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase55_v3_run_id_invalid");
  }
  return join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_EVIDENCE.json`);
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
    if (handle.server.exitCode != null) throw new Error("phase55_next_server_exited");
    try {
      const response = await fetch(releaseUrl, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 200 && payload.status === "ok") return payload;
    } catch {
      // The production-mode local server may need a few seconds after spawn.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("phase55_next_server_timeout");
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

function addPhase55TraceInitScript(page, policy) {
  return page.addInitScript(({ selectedPolicy }) => {
    window.__aiyaPhase55TraceEnabled = true;
    window.__aiyaPhase55PollingPolicy = selectedPolicy;
    window.__aiyaPhase55NavigationWindowUntilWallMs = 0;
    window.__aiyaPhase55Events = [];
  }, { selectedPolicy: policy });
}

function relativeWallTime(atWallMs, traceStartWallMs) {
  return atWallMs == null || traceStartWallMs == null
    ? null
    : roundMs(Number(atWallMs) - traceStartWallMs);
}

function requestPath(value, baseUrl) {
  try {
    return new URL(String(value), baseUrl).pathname;
  } catch {
    return "";
  }
}

function isPollingPath(path) {
  return POLLING_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function relativeRequestRecord(record, captureStartedAtWallMs, traceStartWallMs, baseUrl) {
  const offset = captureStartedAtWallMs - traceStartWallMs;
  return {
    route: requestPath(record.route, baseUrl),
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
    failed: record.failed === true,
  };
}

function toRelativeClientEvent(event, traceStartWallMs) {
  if (!event || typeof event.name !== "string") return null;
  return {
    name: event.name,
    atMs: relativeWallTime(event.atWallMs, traceStartWallMs),
    atPerformanceMs: finite(event.atPerformanceMs),
    ...(typeof event.surface === "string" ? { surface: event.surface } : {}),
    ...(typeof event.reason === "string" ? { reason: event.reason } : {}),
    ...(typeof event.durationMs === "number" ? { durationMs: event.durationMs } : {}),
  };
}

function eventAt(events, name) {
  return events.find((event) => event.name === name) ?? null;
}

function eventsAt(events, name) {
  return events.filter((event) => event.name === name);
}

async function waitForPollingIdle(page) {
  return page.waitForFunction(
    () => {
      const events = Array.isArray(window.__aiyaPhase55Events)
        ? window.__aiyaPhase55Events
        : [];
      const started = events.filter((event) => event.name === "phase55_poll_started").length;
      const finished = events.filter((event) => event.name === "phase55_poll_finished").length;
      return started > 0 && started === finished;
    },
    { timeout: 12_000 },
  ).then(() => true).catch(() => false);
}

async function waitForRequiredPollingSurfaces(page) {
  return page.waitForFunction(
    () => {
      const events = Array.isArray(window.__aiyaPhase55Events)
        ? window.__aiyaPhase55Events
        : [];
      const surfaces = new Set(
        events
          .filter((event) => event.name === "phase55_poll_started")
          .map((event) => event.surface),
      );
      return surfaces.has("inbox") && surfaces.has("messaging_list");
    },
    { timeout: PHASE_5_5_POLL_WAIT_TIMEOUT_MS },
  ).then(() => true).catch(() => false);
}

function firstRequestAfter(requests, routePrefix, afterMs) {
  return requests
    .filter((request) => request.route === routePrefix || request.route.startsWith(`${routePrefix}/`))
    .filter((request) => finite(request.startedAtMs) != null && request.startedAtMs >= afterMs - 1_000)
    .sort((left, right) => left.startedAtMs - right.startedAtMs)[0] ?? null;
}

function hasSuccessfulFinishedRequest(request) {
  return request?.status === 200 && request.bodyFinishedAtMs != null && request.failed !== true;
}

function summarizePollingExposure({ requests, events, trustedNavigationClickAtMs, targetReadyAtMs, policy }) {
  const pollStarted = eventsAt(events, "phase55_poll_started");
  const pollFinished = eventsAt(events, "phase55_poll_finished");
  const pollCancelled = eventsAt(events, "phase55_poll_cancelled");
  const pollingRequests = requests.filter((request) => isPollingPath(request.route));
  const overlappingRequests = pollingRequests.filter((request) => {
    const endAtMs = request.bodyFinishedAtMs ?? request.responseHeaderAtMs;
    return request.startedAtMs != null &&
      endAtMs != null &&
      trustedNavigationClickAtMs != null &&
      targetReadyAtMs != null &&
      request.startedAtMs < trustedNavigationClickAtMs &&
      endAtMs > trustedNavigationClickAtMs &&
      request.startedAtMs < targetReadyAtMs;
  });
  const lastPollStart = pollStarted
    .filter((event) => event.atMs != null && trustedNavigationClickAtMs != null && event.atMs <= trustedNavigationClickAtMs)
    .at(-1) ?? null;
  return {
    policy,
    pollStartCount: pollStarted.length,
    pollFinishCount: pollFinished.length,
    pollCancelCount: pollCancelled.length,
    pollStartSurfaces: [...new Set(pollStarted.map((event) => event.surface).filter(Boolean))],
    requiredPollingSurfacesObserved:
      pollStarted.some((event) => event.surface === "inbox") &&
      pollStarted.some((event) => event.surface === "messaging_list"),
    navigationWindowApplied: policy === PHASE_5_5_POLICIES.A
      ? true
      : Boolean(eventAt(events, "phase55_navigation_window_started")),
    cancellationObserved: pollCancelled.length > 0,
    overlappingRequestCount: overlappingRequests.length,
    overlapObserved: overlappingRequests.length > 0,
    pollStartToNavigationClickMs: lastPollStart && trustedNavigationClickAtMs != null
      ? roundMs(trustedNavigationClickAtMs - lastPollStart.atMs)
      : null,
    pollingRequests: pollingRequests.map(({ route, method, startedAtMs, bodyFinishedAtMs, status, failed }) => ({
      route,
      method,
      startedAtMs,
      bodyFinishedAtMs,
      status,
      failed,
    })),
    overlappingRequests: overlappingRequests.map(({ route, method, startedAtMs, bodyFinishedAtMs, status, failed }) => ({
      route,
      method,
      startedAtMs,
      bodyFinishedAtMs,
      status,
      failed,
    })),
  };
}

function classifyTrace(trace) {
  const failures = [];
  if (trace.auth?.requestObserved !== true) failures.push("password_login_request_missing");
  if (trace.auth?.responseStatus !== 200) failures.push("password_login_status_not_200");
  if (trace.auth?.bodyFinishedAtMs == null) failures.push("password_login_body_finish_missing");
  for (const [name, read] of Object.entries(trace.reads ?? {})) {
    if (read.status !== 200) failures.push(`${name}_status_not_200`);
    if (read.requestStartedAtMs == null) failures.push(`${name}_request_start_missing`);
    if (read.bodyFinishedAtMs == null) failures.push(`${name}_body_finish_missing`);
  }
  if (trace.initialTargetReadyAtMs == null) failures.push("overview_target_ready_missing");
  if (trace.pollingExposure?.pollStartCount < 1) failures.push("poll_start_missing");
  if (trace.pollingExposure?.requiredPollingSurfacesObserved !== true) {
    failures.push("inbox_and_messaging_poll_start_missing");
  }
  if (trace.pollingExposure?.pollFinishCount < trace.pollingExposure?.pollStartCount) {
    failures.push("poll_end_missing");
  }
  if (trace.trustedNavigationClickAtMs == null) failures.push("trusted_navigation_click_missing");
  if (trace.routeCommitAtMs == null) failures.push("messages_route_commit_missing");
  if (trace.targetReadyAtMs == null) failures.push("messages_target_ready_missing");
  if (trace.pollingExposure?.navigationWindowApplied !== true) failures.push("phase55_policy_not_applied");
  if (trace.pollingIdleObserved !== true) failures.push("polling_idle_not_observed");
  if (trace.requestCapture?.bodyFinishTimedOut === true) failures.push("request_body_finish_timeout");
  if (!hasSuccessfulFinishedRequest(trace.messagesDataReadyRequest)) {
    failures.push("messages_data_body_finish_missing");
  }
  return {
    observationValidity: failures.length === 0 ? "VALID" : "INVALID",
    functionalOutcome: trace.targetReadyAtMs != null ? "SUCCESS" : "INCOMPLETE",
    timingOutcome: trace.targetReadyAtMs != null ? "MEASURED" : "NOT_EVALUABLE",
    failures,
  };
}

export async function runPhase55Trace({
  browser,
  baseUrl,
  email,
  password,
  policy,
  cycle,
  position,
  checkpoint = null,
} = {}) {
  const trace = {
    traceId: `cycle-${cycle}-${position}`,
    journeyId: PHASE_5_5_TRACE_JOURNEY_ID,
    cycle,
    position,
    policy,
    environment: "local_desktop",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_TARGET_SELECTOR],
    traceStartWallMs: null,
    trustedActionAtMs: null,
    trustedNavigationClickAtMs: null,
    routeCommitAtMs: null,
    initialTargetReadyAtMs: null,
    targetReadyAtMs: null,
    targetInteractivePaintAtMs: null,
    auth: {
      requestObserved: false,
      responseStatus: null,
      bodyFinishedAtMs: null,
    },
    reads: {
      shellBootstrap: {
        route: REQUIRED_READ_PATHS.shellBootstrap,
        requestStartedAtMs: null,
        bodyFinishedAtMs: null,
        status: null,
      },
      appState: {
        route: REQUIRED_READ_PATHS.appState,
        requestStartedAtMs: null,
        bodyFinishedAtMs: null,
        status: null,
      },
    },
    phase55Events: [],
    routeEvents: [],
    requestCapture: null,
    foregroundMessagesRequest: null,
    messagesDataReadyRequest: null,
    pollingIdleObserved: false,
    pollingExposure: null,
    browserMetrics: null,
    errorClass: null,
  };
  const traceStartFallback = Date.now();
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  let capture = null;
  try {
    await installPhase44BrowserInstrumentation(page, "diagnostic");
    await addPhase55TraceInitScript(page, policy);
    capture = createRichRequestCapture(page);
    await page.goto(`${baseUrl}/login?next=/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: PHASE_5_5_TRACE_TIMEOUT_MS,
    });
    await page.locator("#customer-login-email").waitFor({ state: "visible", timeout: PHASE_5_5_TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-email").fill(email, { timeout: PHASE_5_5_TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-password").fill(password, { timeout: PHASE_5_5_TRACE_TIMEOUT_MS });

    trace.traceStartWallMs = Date.now();
    const loginRequestPromise = page.waitForRequest(
      (request) => requestPath(request.url(), baseUrl) === "/api/auth/password-login",
      { timeout: PHASE_5_5_TRACE_TIMEOUT_MS },
    ).catch(() => null);
    const loginResponsePromise = page.waitForResponse(
      (response) => requestPath(response.url(), baseUrl) === "/api/auth/password-login",
      { timeout: PHASE_5_5_TRACE_TIMEOUT_MS },
    ).catch(() => null);
    const routeCommitPromise = page.waitForURL(
      (url) => new URL(url).pathname === ROUTE_PATH,
      { timeout: PHASE_5_5_TRACE_TIMEOUT_MS },
    ).then(() => true).catch(() => false);
    const trustedClickDispatchWallMs = Date.now();
    await page.locator('[data-testid="customer-login-submit"]').click({ timeout: PHASE_5_5_TRACE_TIMEOUT_MS });
    trace.trustedActionAtMs = roundMs(trustedClickDispatchWallMs - trace.traceStartWallMs);
    const [loginRequest, loginResponse] = await Promise.all([loginRequestPromise, loginResponsePromise]);
    trace.auth.requestObserved = Boolean(loginRequest);
    trace.auth.responseStatus = loginResponse?.status() ?? null;
    if (!loginRequest || !loginResponse || !loginResponse.ok()) throw new Error("phase55_password_login_failed");
    await loginResponse.finished();
    if (!(await routeCommitPromise)) throw new Error("phase55_dashboard_route_commit_missing");
    trace.routeCommitAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await waitForReady(page, '[data-testid="authenticated-shell"]');
    await waitForReady(page, '[data-testid="overview-work-areas"]');
    trace.initialTargetReadyAtMs = roundMs(Date.now() - trace.traceStartWallMs);

    await waitForRequiredPollingSurfaces(page);
    const nav = page.locator('[data-testid="shell-wide-nav"] a[href*="section=messages"]').first();
    await nav.waitFor({ state: "visible", timeout: PHASE_5_5_TRACE_TIMEOUT_MS });
    const messagesRouteCommitPromise = page.waitForURL(
      (url) => new URL(url).pathname === ROUTE_PATH && new URL(url).searchParams.get("section") === "messages",
      { timeout: PHASE_5_5_TRACE_TIMEOUT_MS },
    ).then(() => true).catch(() => false);
    const navigationClickWallMs = Date.now();
    await nav.click({ timeout: PHASE_5_5_TRACE_TIMEOUT_MS });
    trace.trustedNavigationClickAtMs = roundMs(navigationClickWallMs - trace.traceStartWallMs);
    if (!(await messagesRouteCommitPromise)) throw new Error("phase55_messages_route_commit_missing");
    trace.routeCommitAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await waitForReady(page, PHASE_5_5_TARGET_SELECTOR);
    trace.targetReadyAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await page.evaluate(
      () => new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise))),
    );
    trace.targetInteractivePaintAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    trace.pollingIdleObserved = await waitForPollingIdle(page);
    if (policy === PHASE_5_5_POLICIES.B) {
      await page.waitForFunction(
        () => Array.isArray(window.__aiyaPhase55Events) &&
          window.__aiyaPhase55Events.some((event) => event.name === "phase55_navigation_window_ended"),
        { timeout: 8_000 },
      ).catch(() => undefined);
    }
  } catch (error) {
    trace.errorClass = safeErrorClass(error);
  }

  const traceStartWallMs = trace.traceStartWallMs ?? traceStartFallback;
  const browserState = await page.evaluate(() => ({
    phase55Events: window.__aiyaPhase55Events ?? [],
    phase44RouteEvents: window.__aiyaPhase44?.routeEvents ?? [],
  })).catch(() => ({ phase55Events: [], phase44RouteEvents: [] }));
  const captureSummary = capture
    ? await capture.finish().catch(() => ({
        captureStartedAtWallMs: traceStartWallMs,
        requests: [],
        bodyFinishTimedOut: true,
      }))
    : { captureStartedAtWallMs: traceStartWallMs, requests: [], bodyFinishTimedOut: true };
  const requests = (captureSummary.requests ?? []).map((record) =>
    relativeRequestRecord(record, captureSummary.captureStartedAtWallMs, traceStartWallMs, baseUrl),
  );
  const relevantRequests = requests.filter((request) =>
    request.route === "/api/auth/password-login" ||
    request.route === REQUIRED_READ_PATHS.shellBootstrap ||
    request.route === REQUIRED_READ_PATHS.appState ||
    isPollingPath(request.route),
  );
  trace.auth.bodyFinishedAtMs = relevantRequests.find(
    (request) => request.route === "/api/auth/password-login",
  )?.bodyFinishedAtMs ?? null;
  for (const [key, route] of Object.entries({
    shellBootstrap: REQUIRED_READ_PATHS.shellBootstrap,
    appState: REQUIRED_READ_PATHS.appState,
  })) {
    const request = relevantRequests.find((item) => item.route === route);
    trace.reads[key] = {
      route,
      requestStartedAtMs: request?.startedAtMs ?? null,
      bodyFinishedAtMs: request?.bodyFinishedAtMs ?? null,
      status: request?.status ?? null,
    };
  }
  trace.phase55Events = browserState.phase55Events
    .filter((event) => Number(event.atWallMs) >= traceStartWallMs)
    .map((event) => toRelativeClientEvent(event, traceStartWallMs))
    .filter(Boolean);
  trace.routeEvents = browserState.phase44RouteEvents
    .filter((event) => Number(event.atWallMs) >= traceStartWallMs)
    .map((event) => ({
      atMs: relativeWallTime(event.atWallMs, traceStartWallMs),
      route: requestPath(event.route, baseUrl),
      source: typeof event.source === "string" ? event.source : null,
    }));
  trace.requestCapture = {
    requestCount: relevantRequests.length,
    apiRequestCount: relevantRequests.filter((request) => request.route.startsWith("/api/")).length,
    captureBodyFinishTimedOut: captureSummary.bodyFinishTimedOut === true,
    bodyFinishTimedOut: relevantRequests.some((request) =>
      request.status != null &&
      request.bodyFinishedAtMs == null &&
      request.failed !== true,
    ),
    requests: relevantRequests,
  };
  const foregroundMessagesRequest = firstRequestAfter(
    relevantRequests,
    REQUIRED_READ_PATHS.messages,
    trace.trustedNavigationClickAtMs ?? Number.POSITIVE_INFINITY,
  );
  trace.foregroundMessagesRequest = foregroundMessagesRequest;
  trace.messagesDataReadyRequest = relevantRequests.find(
    (request) => request.route === REQUIRED_READ_PATHS.messages && hasSuccessfulFinishedRequest(request),
  ) ?? relevantRequests.find((request) => request.route === REQUIRED_READ_PATHS.messages) ?? null;
  trace.pollingExposure = summarizePollingExposure({
    requests: relevantRequests,
    events: trace.phase55Events,
    trustedNavigationClickAtMs: trace.trustedNavigationClickAtMs,
    targetReadyAtMs: trace.targetReadyAtMs,
    policy,
  });
  trace.browserMetrics = await collectBrowserMetrics(page, "diagnostic").catch(() => null);
  const classification = classifyTrace(trace);
  Object.assign(trace, classification);
  trace.boundary = {
    trustedActionToInitialTargetReadyMs:
      trace.trustedActionAtMs != null && trace.initialTargetReadyAtMs != null
        ? roundMs(trace.initialTargetReadyAtMs - trace.trustedActionAtMs)
        : null,
    navigationClickToTargetReadyMs:
      trace.trustedNavigationClickAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.trustedNavigationClickAtMs)
        : null,
    routeCommitToTargetReadyMs:
      trace.routeCommitAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.routeCommitAtMs)
        : null,
    navigationClickToForegroundBodyFinishMs:
      trace.trustedNavigationClickAtMs != null && trace.foregroundMessagesRequest?.bodyFinishedAtMs != null
        ? roundMs(trace.foregroundMessagesRequest.bodyFinishedAtMs - trace.trustedNavigationClickAtMs)
        : null,
  };
  const sanitized = sanitizePhase55Evidence(trace);
  checkpoint?.append("experiment.trace.completed", sanitized, { status: "RUNNING" });
  capture?.dispose();
  await context.close();
  return sanitized;
}

function median(values) {
  const sorted = values.filter((value) => finite(value) != null).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizePhase55Cycles(traces) {
  const cycles = [];
  for (let cycle = 1; cycle <= PHASE_5_5_CYCLE_COUNT; cycle += 1) {
    const cycleTraces = traces.filter((trace) => trace.cycle === cycle);
    const before = cycleTraces.find((trace) => trace.position === "A_before");
    const variant = cycleTraces.find((trace) => trace.position === "B");
    const after = cycleTraces.find((trace) => trace.position === "A_after");
    const aBoundary = median([
      before?.boundary?.navigationClickToTargetReadyMs,
      after?.boundary?.navigationClickToTargetReadyMs,
    ]);
    const bBoundary = variant?.boundary?.navigationClickToTargetReadyMs ?? null;
    const delta = aBoundary != null && bBoundary != null ? roundMs(bBoundary - aBoundary) : null;
    cycles.push({
      cycle,
      traceIds: [before?.traceId, variant?.traceId, after?.traceId].filter(Boolean),
      observationValid: [before, variant, after].every((trace) => trace?.observationValidity === "VALID"),
      aBoundaryMs: aBoundary,
      bBoundaryMs: bBoundary,
      deltaBMinusAMs: delta,
      bNavigationWindowApplied: variant?.pollingExposure?.navigationWindowApplied === true,
      bCancellationObserved: variant?.pollingExposure?.cancellationObserved === true,
      direction: delta == null ? "NOT_EVALUABLE" : delta < 0 ? "B_FASTER" : delta > 0 ? "B_SLOWER" : "EQUAL",
    });
  }
  const directions = cycles.map((cycle) => cycle.direction).filter((direction) => direction !== "NOT_EVALUABLE");
  const repeatable =
    cycles.every((cycle) => cycle.observationValid && cycle.bNavigationWindowApplied) &&
    directions.length === PHASE_5_5_CYCLE_COUNT &&
    directions.every((direction) => direction === directions[0]) &&
    directions[0] !== "EQUAL";
  return {
    cycles,
    repeatable,
    conclusion: repeatable ? "REPEATABLE_PROVISIONAL_EFFECT" : "INCONCLUSIVE",
    noCauseConfirmed: true,
    findingDispositionChanged: false,
    cancellationObservedInAllB: cycles.every((cycle) => cycle.bCancellationObserved),
  };
}

function phase55PersistedRunResult(persisted, prerequisite) {
  const traces = persisted.events
    .filter((event) => event.type === "experiment.trace.completed")
    .map((event) => event.payload);
  const preflight = persisted.events
    .filter((event) => event.type === "environment.preflight")
    .at(-1)?.payload ?? null;
  const cycleSummary = summarizePhase55Cycles(traces);
  const status = persisted.manifest.status === "COMPLETE" ? "COMPLETE" : "BLOCKED";
  return {
    runId: persisted.manifest.runId,
    status,
    outcome: status === "COMPLETE" ? cycleSummary.conclusion : "CANDIDATE_LOOP_BLOCKED",
    traces,
    prerequisite,
    preflight,
    buildIdentity: preflight?.release ?? null,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : ["checkpoint_not_complete"],
    checkpoint: phase55CheckpointSummary(persisted.manifest.runId),
  };
}

export function buildPhase55Evidence(result, {
  generatedAt = new Date().toISOString(),
  sourceIdentity = phase55SourceIdentity(),
} = {}) {
  const contract = phase55CandidateLoopContract();
  const cycleSummary = result.cycleSummary ?? summarizePhase55Cycles(result.traces ?? []);
  const traces = result.traces ?? [];
  const validTraceCount = traces.filter((trace) => trace.observationValidity === "VALID").length;
  const allNineAttempted = traces.length === PHASE_5_5_CYCLE_COUNT * 3;
  const status = result.status ?? (allNineAttempted && validTraceCount === traces.length ? "COMPLETE" : "BLOCKED");
  const outcome = status === "BLOCKED"
    ? "CANDIDATE_LOOP_BLOCKED"
    : cycleSummary.conclusion;
  return sanitizePhase55Evidence({
    schemaVersion: "aiya-performance-plan1-v3-phase5-5-candidate-loop-evidence-v1",
    planRevision: PHASE_5_5_PLAN_REVISION,
    phase: "5",
    stage: "5.5",
    stageId: "5.5",
    runId: result.runId ?? null,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Run the remaining supported candidate loop for H-5.1-002 with matched local desktop A -> B -> A cycles.",
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
      revision: PHASE_5_5_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
        "5.2 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
        "5.3 COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE",
        "5.4 COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE",
      ],
      currentStage: "5.5",
      nextEligibleStage: cycleSummary.conclusion === "INCONCLUSIVE"
        ? "5.5 next supported candidate or 5.6 disposition review after candidate coverage"
        : "5.6 finding dispositions",
    },
    sourceIdentity,
    prerequisites: result.prerequisite ?? null,
    experimentContract: contract,
    buildIdentity: result.buildIdentity ?? null,
    inputPreflight: result.preflight ?? null,
    cycleSummary,
    sampleSummary: {
      attemptedTraces: traces.length,
      plannedTraces: PHASE_5_5_CYCLE_COUNT * 3,
      observationValidTraces: validTraceCount,
      observationInvalidTraces: traces.length - validTraceCount,
      allNineAttempted,
      validTracesAreNotOfficialBaseline: true,
    },
    traces,
    blockers: result.blockers ?? [],
    findingDispositionChanges: [],
    deferredToLaterStages: [
      "Exact layer attribution remains unresolved; no cause is confirmed by this candidate loop.",
      "H-5.1-003 dashboard bundle/import/render and H-5.1-004 warm AI Chat remain separate candidates unless the active contract orders otherwise.",
      "No Plan 2 remediation is authorized by this evidence.",
    ],
    constraints: [
      "B is a reversible trace-only probe and is not an accepted runtime fix.",
      "No official nine-scenario sample was started.",
      "No data, API, auth, RLS, migration, dependency, secret, provider, channel, or production change was made.",
      "A result is INCONCLUSIVE unless the measured direction repeats in all three matched cycles with valid observations.",
      "Credentials, cookies, tokens, raw bodies, prompts, clinical content, and device serials are excluded.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PASS",
      redactionCheck: "PASS",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      prerequisitesParsed: result.prerequisite?.status === "PASS",
      checkpointHashChain: result.checkpoint?.hashChainRead ?? null,
      checkpointComplete: result.checkpoint?.status ?? null,
      incompleteTracesRemainInvalid: true,
      findingManifestChanged: false,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      officialMeasurementStarted: false,
    },
    closure: {
      status,
      outcome,
      phase4Closed: true,
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: traces.length > 0,
      runtimeFixAccepted: false,
      nextAction: status === "BLOCKED"
        ? "Preserve this blocked run and repair only the declared local input or trace boundary before resuming."
        : cycleSummary.conclusion === "INCONCLUSIVE"
          ? "Reconcile H-5.1-002 as INCONCLUSIVE and continue only with the next pre-registered supported candidate; do not accept a runtime fix."
          : "Proceed to 5.6 finding dispositions; do not treat the provisional effect as a confirmed cause.",
    },
    checkpointReconciliation: result.checkpoint ?? null,
  });
}

export async function runPhase55CandidateLoop({
  baseUrl = process.env.AIYA_PHASE55_BASE_URL || PHASE_5_5_DEFAULT_BASE_URL,
  newRun = false,
  reconcileRunId = null,
} = {}) {
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");
  const parentEvidence = readJson(join(repoRoot, PHASE_5_5_PARENT_EVIDENCE_PATH));
  const safetyEvidence = readJson(join(repoRoot, PHASE_5_5_SAFETY_EVIDENCE_PATH));
  const prerequisite = phase55PrerequisiteCheck(parentEvidence, safetyEvidence);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = (() => {
    try {
      return parseLocalSupabaseStatus();
    } catch (error) {
      return { status: "BLOCKED", reason: safeErrorClass(error) };
    }
  })();
  const sourceIdentity = phase55SourceIdentity();
  const identity = {
    planRevision: PHASE_5_5_PLAN_REVISION,
    candidateId: PHASE_5_5_CANDIDATE_ID,
    variableId: PHASE_5_5_VARIABLE_ID,
    environment: "local_desktop",
    baseOrigin: new URL(normalizedBaseUrl).origin,
    sourceHead: sourceIdentity.head,
    sourceFiles: sourceIdentity.sourceFiles,
    parentEvidenceSha256: prerequisite.parentEvidence.sha256,
    safetyEvidenceSha256: prerequisite.safetyEvidence.sha256,
    buildControl: "one_same_build_for_all_A_B_A_traces",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_TARGET_SELECTOR],
    repetitionOrder: ["A_before", "B", "A_after"],
  };
  if (reconcileRunId) {
    if (!new RegExp(`^${PHASE_5_5_CHECKPOINT_PHASE_ID}-[A-Za-z0-9-]+$`).test(reconcileRunId)) {
      throw new Error("phase55_reconciliation_run_id_invalid");
    }
    return phase55PersistedRunResult(readPhaseRun({
      root: PHASE_5_5_CHECKPOINT_ROOT,
      phaseId: PHASE_5_5_CHECKPOINT_PHASE_ID,
      runId: reconcileRunId,
    }), prerequisite);
  }
  const opened = openPhaseRun({
    root: PHASE_5_5_CHECKPOINT_ROOT,
    phaseId: PHASE_5_5_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_5_5_CHECKPOINT_SCHEMA_VERSION,
    identity,
    newRun,
    metadata: {
      identitySummary: {
        planRevision: PHASE_5_5_PLAN_REVISION,
        candidateId: PHASE_5_5_CANDIDATE_ID,
        variableId: PHASE_5_5_VARIABLE_ID,
        environment: "local_desktop",
        baseOrigin: new URL(normalizedBaseUrl).origin,
        cycleCount: PHASE_5_5_CYCLE_COUNT,
        countedAsOfficialSample: false,
      },
    },
    redact: sanitizePhase55Evidence,
  });
  if (opened.action === "COMPLETE") {
    return phase55PersistedRunResult(readPhaseRun({
      root: PHASE_5_5_CHECKPOINT_ROOT,
      phaseId: PHASE_5_5_CHECKPOINT_PHASE_ID,
      runId: opened.manifest.runId,
    }), prerequisite);
  }
  if (opened.action === "STALE") {
    return {
      runId: opened.manifest.runId,
      status: "BLOCKED",
      outcome: "CANDIDATE_LOOP_CHECKPOINT_STALE",
      traces: [],
      prerequisite,
      blockers: ["checkpoint_identity_changed"],
      checkpoint: phase55CheckpointSummary(opened.manifest.runId),
    };
  }
  const checkpoint = opened.run;
  if (prerequisite.status !== "PASS") {
    checkpoint.append("environment.preflight", {
      status: "BLOCKED",
      blockers: prerequisite.failures,
      prerequisite,
    }, { status: "BLOCKED" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "CANDIDATE_LOOP_PREREQUISITE_BLOCKED",
      traces: [],
      prerequisite,
      blockers: prerequisite.failures,
      checkpoint: phase55CheckpointSummary(checkpoint.runId),
    };
  }
  if (localStatus.status !== "PASS") {
    const blockers = ["local_supabase_unreachable_or_not_ready"];
    checkpoint.append("environment.preflight", {
      status: "BLOCKED",
      blockers,
      localSupabase: phase55LocalStatusSummary(localStatus),
      configuration: configuration.summary,
    }, { status: "BLOCKED" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "CANDIDATE_LOOP_LOCAL_INPUT_BLOCKED",
      traces: [],
      prerequisite,
      blockers,
      preflight: { status: "BLOCKED", blockers, localSupabase: phase55LocalStatusSummary(localStatus) },
      checkpoint: phase55CheckpointSummary(checkpoint.runId),
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
      outcome: "CANDIDATE_LOOP_BUILD_BLOCKED",
      traces: [],
      prerequisite,
      blockers,
      preflight: { status: "BLOCKED", blockers, build },
      checkpoint: phase55CheckpointSummary(checkpoint.runId),
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
      localSupabase: phase55LocalStatusSummary(localStatus),
    }, { status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED" });
    if (preflight.status !== "PASS") {
      const blockers = preflight.blockers;
      checkpoint.markStatus("BLOCKED", { reason: "candidate_loop_preflight_blocked" });
      checkpoint.close();
      return {
        runId: checkpoint.runId,
        status: "BLOCKED",
        outcome: "CANDIDATE_LOOP_PREFLIGHT_BLOCKED",
        traces,
        prerequisite,
        blockers,
        preflight,
        buildIdentity: releaseIdentity,
        checkpoint: phase55CheckpointSummary(checkpoint.runId),
      };
    }
    const browser = await chromium.launch({ headless: true });
    try {
      for (let cycle = 1; cycle <= PHASE_5_5_CYCLE_COUNT; cycle += 1) {
        const cycleTraces = [];
        for (const position of ["A_before", "B", "A_after"]) {
          const policy = position === "B" ? PHASE_5_5_POLICIES.B : PHASE_5_5_POLICIES.A;
          checkpoint.append("experiment.trace.started", {
            cycle,
            position,
            policy,
            candidateId: PHASE_5_5_CANDIDATE_ID,
            variableId: PHASE_5_5_VARIABLE_ID,
            countedAsOfficialSample: false,
          });
          const trace = await runPhase55Trace({
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
      reason: "candidate_loop_runner_failed",
      errorClass: safeErrorClass(error),
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "CANDIDATE_LOOP_RUNNER_BLOCKED",
      traces,
      prerequisite,
      blockers: ["candidate_loop_runner_failed"],
      preflight,
      buildIdentity: releaseIdentity,
      checkpoint: phase55CheckpointSummary(checkpoint.runId),
    };
  } finally {
    await stopLocalServer(server);
  }
  const cycleSummary = summarizePhase55Cycles(traces);
  const allValid = traces.length === PHASE_5_5_CYCLE_COUNT * 3 &&
    traces.every((trace) => trace.observationValidity === "VALID");
  const status = allValid ? "COMPLETE" : "BLOCKED";
  if (status === "BLOCKED") {
    checkpoint.markStatus("BLOCKED", {
      reason: "invalid_or_incomplete_candidate_trace",
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
    outcome: status === "COMPLETE" ? cycleSummary.conclusion : "CANDIDATE_TRACE_BLOCKED",
    traces,
    prerequisite,
    preflight,
    buildIdentity: releaseIdentity,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : ["invalid_or_incomplete_candidate_trace"],
    checkpoint: phase55CheckpointSummary(checkpoint.runId),
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
    baseUrl: process.env.AIYA_PHASE55_BASE_URL || PHASE_5_5_DEFAULT_BASE_URL,
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
    else throw new Error(`phase55_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(sanitizePhase55Evidence({
      phase: "5",
      stage: "5.5",
      planRevision: PHASE_5_5_PLAN_REVISION,
      contract: phase55CandidateLoopContract(),
      prerequisites: {
        parentEvidencePath: PHASE_5_5_PARENT_EVIDENCE_PATH,
        safetyEvidencePath: PHASE_5_5_SAFETY_EVIDENCE_PATH,
      },
      outputContract: "docs/AIYA_PERFORMANCE_PLAN_1_V3_<runId>_EVIDENCE.json",
    }), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(`${JSON.stringify(sanitizePhase55Evidence({
      phase: "5",
      stage: "5.5",
      checkpointPhaseId: PHASE_5_5_CHECKPOINT_PHASE_ID,
      runs: inspectPhaseRuns({ root: PHASE_5_5_CHECKPOINT_ROOT, phaseId: PHASE_5_5_CHECKPOINT_PHASE_ID }),
    }), null, 2)}\n`);
    return;
  }
  if (!options.run && !options.reconcileRunId) {
    throw new Error("phase55_run_or_descriptor_or_status_required");
  }
  const result = await runPhase55CandidateLoop({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
    reconcileRunId: options.reconcileRunId,
  });
  const evidence = buildPhase55Evidence(result);
  let evidencePath = null;
  if (options.writeEvidence) {
    evidencePath = phase55V3EvidencePath(result.runId);
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(sanitizePhase55Evidence({
    runId: result.runId,
    status: result.status,
    outcome: result.outcome,
    attemptedTraces: result.traces?.length ?? 0,
    validTraces: result.traces?.filter((trace) => trace.observationValidity === "VALID").length ?? 0,
    evidencePath,
    checkpoint: result.checkpoint,
  }), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${safeErrorClass(error)}\n`);
    process.exitCode = 1;
  });
}
