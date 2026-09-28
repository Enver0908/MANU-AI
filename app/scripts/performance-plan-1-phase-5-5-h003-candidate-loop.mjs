/**
 * AIya Performance Plan 1 - Phase 5.5 H-5.1-003 candidate loop.
 *
 * This runner compares the current eager MessagingPanel import with one
 * trace-only dynamic split. Both variants use the same local fixture, auth,
 * route order, and browser controls. Neither variant is an accepted fix or an
 * official baseline sample.
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

export const PHASE_5_5_H003_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_5_H003_CANDIDATE_ID = "H-5.1-003";
export const PHASE_5_5_H003_VARIABLE_ID = "target_panel_loading";
export const PHASE_5_5_H003_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase5-5-h003-candidate-loop-v3";
export const PHASE_5_5_H003_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase5-5-h003-candidate-loop-v3";
export const PHASE_5_5_H003_CHECKPOINT_ROOT = join(repoRoot, ".manu-runtime", "phase-execution");
export const PHASE_5_5_H003_DEFAULT_BASE_URL = "http://127.0.0.1:3144";
export const PHASE_5_5_H003_CYCLE_COUNT = 3;
export const PHASE_5_5_H003_MAX_REPETITIONS = 5;
export const PHASE_5_5_H003_TRACE_TIMEOUT_MS = 60_000;
export const PHASE_5_5_H003_TARGET_SELECTOR = '[data-testid="messaging-panel"]';
export const PHASE_5_5_H003_TARGET_MODULE = "messaging-panel";
export const PHASE_5_5_H003_PARENT_EVIDENCE_RUN_ID =
  "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f";
export const PHASE_5_5_H003_PARENT_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_5_H003_PARENT_EVIDENCE_RUN_ID}_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`;
export const PHASE_5_5_H003_SAFETY_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json";
export const PHASE_5_5_H003_H002_EVIDENCE_RUN_ID =
  "aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T075150094Z-57b04620-bf53-4c9b-a368-aadc829272b2";
export const PHASE_5_5_H003_H002_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_5_H003_H002_EVIDENCE_RUN_ID}_EVIDENCE.json`;
export const PHASE_5_5_H003_VARIANTS = Object.freeze({
  A: "current_eager",
  B: "deferred_dynamic",
});
export const PHASE_5_5_H003_DIST_DIRS = Object.freeze({
  A: ".manu-runtime/phase55-h003-eager",
  B: ".manu-runtime/phase55-h003-dynamic",
});
export const PHASE_5_5_H003_SOURCE_PATHS = Object.freeze([
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/phase-55-messaging-panel.tsx",
  "app/src/components/dashboard/phase-55-messaging-panel.dynamic.tsx",
  "app/src/components/dashboard/phase-55-messaging-panel-target.tsx",
  "app/src/lib/phase-55-bundle-diagnostic.ts",
  "app/src/lib/phase-55-bundle-diagnostic.test.ts",
  "app/next.config.ts",
  "app/scripts/performance-plan-1-phase-5-5-h003-candidate-loop.mjs",
  "app/scripts/performance-plan-1-phase-5-5-h003-candidate-loop.test.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  PHASE_5_5_H003_PARENT_EVIDENCE_PATH,
  PHASE_5_5_H003_SAFETY_EVIDENCE_PATH,
  PHASE_5_5_H003_H002_EVIDENCE_PATH,
]);

const ROUTE_PATH = "/dashboard";
const LOGIN_PATH = "/api/auth/password-login";
const SHELL_BOOTSTRAP_PATH = "/api/shell/bootstrap";
const APP_STATE_PATH = "/api/app-state";
const CONVERSATIONS_PATH = "/api/conversations";
const POLLING_PATH_PREFIXES = Object.freeze([
  "/api/alerts",
  "/api/notifications",
  "/api/conversations",
]);
const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_STOP_TIMEOUT_MS = 10_000;
const BUILD_TIMEOUT_MS = 240_000;

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

function phase55H003CheckpointSummary(runId) {
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
    root: PHASE_5_5_H003_CHECKPOINT_ROOT,
    phaseId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID,
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

function phase55H003SourceIdentity() {
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
    sourceFiles: PHASE_5_5_H003_SOURCE_PATHS.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

export function phase55H003PrerequisiteCheck(
  parentEvidence = readJson(join(repoRoot, PHASE_5_5_H003_PARENT_EVIDENCE_PATH)),
  safetyEvidence = readJson(join(repoRoot, PHASE_5_5_H003_SAFETY_EVIDENCE_PATH)),
  h002Evidence = readJson(join(repoRoot, PHASE_5_5_H003_H002_EVIDENCE_PATH)),
) {
  const failures = [];
  if (!parentEvidence) failures.push("parent_hypothesis_evidence_missing_or_invalid_json");
  if (parentEvidence?.runId !== PHASE_5_5_H003_PARENT_EVIDENCE_RUN_ID) {
    failures.push("phase5_1_run_id_mismatch");
  }
  if (parentEvidence?.status !== "COMPLETE") failures.push("phase5_1_not_complete");
  if (parentEvidence?.outcome !== "HYPOTHESES_PRE_REGISTERED") {
    failures.push("phase5_1_outcome_invalid");
  }
  const candidate = parentEvidence?.hypothesisRegister?.find(
    (item) => item.candidateId === PHASE_5_5_H003_CANDIDATE_ID,
  );
  if (!candidate) failures.push("third_candidate_missing");
  if (candidate?.optimizationStatus !== "NOT_AUTHORIZED_UNMEASURED") {
    failures.push("third_candidate_optimization_gate_invalid");
  }
  if (!safetyEvidence) failures.push("phase5_4_safety_evidence_missing_or_invalid_json");
  if (safetyEvidence?.status !== "COMPLETE") failures.push("phase5_4_not_complete");
  if (safetyEvidence?.outcome !== "SAFETY_BEHAVIOR_CHECKS_COMPLETE") {
    failures.push("phase5_4_outcome_invalid");
  }
  if (!h002Evidence) failures.push("h002_evidence_missing_or_invalid_json");
  if (h002Evidence?.status !== "COMPLETE") failures.push("h002_candidate_not_complete");
  if (!["INCONCLUSIVE", "REPEATABLE_PROVISIONAL_EFFECT"].includes(h002Evidence?.outcome)) {
    failures.push("h002_candidate_outcome_invalid");
  }
  return {
    status: failures.length ? "BLOCKED" : "PASS",
    failures,
    parentEvidence: {
      runId: parentEvidence?.runId ?? null,
      status: parentEvidence?.status ?? null,
      outcome: parentEvidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_5_H003_PARENT_EVIDENCE_PATH)),
    },
    safetyEvidence: {
      runId: safetyEvidence?.runId ?? null,
      status: safetyEvidence?.status ?? null,
      outcome: safetyEvidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_5_H003_SAFETY_EVIDENCE_PATH)),
    },
    h002Evidence: {
      runId: h002Evidence?.runId ?? null,
      status: h002Evidence?.status ?? null,
      outcome: h002Evidence?.outcome ?? null,
      sha256: hashFile(join(repoRoot, PHASE_5_5_H003_H002_EVIDENCE_PATH)),
    },
    candidateId: candidate?.candidateId ?? null,
  };
}

export function phase55H003CandidateLoopContract() {
  return {
    candidateId: PHASE_5_5_H003_CANDIDATE_ID,
    title: "Dashboard bundle, import, and render work",
    variableId: PHASE_5_5_H003_VARIABLE_ID,
    target: {
      module: PHASE_5_5_H003_TARGET_MODULE,
      selector: PHASE_5_5_H003_TARGET_SELECTOR,
      rationale: "The existing dashboard-to-messages journey exposes a deterministic target panel boundary.",
    },
    variable: {
      A: PHASE_5_5_H003_VARIANTS.A,
      B: PHASE_5_5_H003_VARIANTS.B,
      BDescription: "Build the selected MessagingPanel as one dynamic client chunk with an explicit loading fallback.",
      runtimeDefault: PHASE_5_5_H003_VARIANTS.A,
      buildBoundary: "AIYA_PHASE55_BUNDLE_POLICY plus separate ignored diagnostic distDir",
    },
    exactFilesAndFunctions: [
      "app/src/components/dashboard-app.tsx:MessagingPanel render boundary",
      "app/src/components/dashboard/phase-55-messaging-panel.tsx:current eager wrapper",
      "app/src/components/dashboard/phase-55-messaging-panel.dynamic.tsx:trace-only dynamic wrapper",
      "app/src/components/dashboard/phase-55-messaging-panel-target.tsx:build-time diagnostic selector",
      "app/src/lib/phase-55-bundle-diagnostic.ts:trace-only bundle event ledger",
      "app/next.config.ts:diagnostic bundle policy and distDir selection",
    ],
    journey: {
      id: "P5.5-H-5.1-003-dashboard-to-messages",
      linkedPlanJourneys: ["J1", "J2", "J3"],
      environment: "local_desktop",
      routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_H003_TARGET_SELECTOR],
      startBoundary: "trusted_password_login_submit",
      navigationBoundary: "trusted_messages_navigation_click",
      routeCommitBoundary: "dashboard_messages_url_observed",
      endBoundary: "messaging_panel_mounted_after_authenticated_navigation",
      requiredSubboundaries: [
        "chunk_transfer_or_resource_timing",
        "script_parse_compile_proxy_via_long_task_and_panel_events",
        "long_task_window",
        "target_ready_and_two_frame_paint",
        "auth_shell_app_state_and_conversation_body_finish",
      ],
    },
    matchedControls: [
      "same synthetic password-authenticated account and local normal tenant fixture",
      "same source inputs except the selected import boundary and variant distDir",
      "same Chromium headless desktop viewport, cold context, and service worker blocked",
      "same network, local Supabase, route order, target selector, and request contract",
      "same auth, shell, app-state, and conversation data controls; polling remains recorded diagnostic context",
    ],
    safetyChecks: [
      "dynamic loading fallback preserves target accessibility and navigation",
      "server/client boundary and authenticated route guard remain unchanged",
      "no required data or safety state is skipped to improve timing",
      "PWA cache, privacy-lock, reconnect, tenant, and mutation behavior remain outside this desktop probe",
    ],
    rollback: "Restore the eager wrapper alias and remove the diagnostic dynamic wrapper; no data or API change.",
    repetition: {
      cycles: PHASE_5_5_H003_CYCLE_COUNT,
      order: ["A_before", "B", "A_after"],
      maxAttempts: PHASE_5_5_H003_MAX_REPETITIONS,
      officialBaseline: false,
    },
  };
}

const SENSITIVE_KEY = /(?:password|token|secret|cookie|authorization|prompt|clinical|raw.?body|credential|private.?key|api.?key|email|phone)/i;

function redactString(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<redacted-email>")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer <redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>");
}

export function sanitizePhase55H003Evidence(value, key = "") {
  if (SENSITIVE_KEY.test(String(key))) return "<redacted>";
  if (Array.isArray(value)) return value.map((item) => sanitizePhase55H003Evidence(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizePhase55H003Evidence(childValue, childKey),
      ]),
    );
  }
  if (typeof value === "string") return redactString(value);
  return value;
}

export function phase55H003EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase55_h003_run_id_invalid");
  }
  return join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_EVIDENCE.json`);
}

function phase55H003LocalStatusSummary(localStatus) {
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

function buildVariantEnvironment(environment, variant, distDir) {
  return {
    ...environment,
    AIYA_PHASE55_BUNDLE_POLICY: variant === "B" ? "dynamic" : "eager",
    AIYA_PHASE55_DIST_DIR: distDir,
  };
}

function runLocalBuild(localStatus, configuration, baseUrl, variant, distDir) {
  if (!existsSync(nextCliPath)) {
    return { status: "BLOCKED", variant, distDir, reason: "next_cli_missing" };
  }
  const baseEnvironment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
    baseUrl,
    localStatus,
  });
  const environment = buildVariantEnvironment(baseEnvironment, variant, distDir);
  const result = spawnSync(
    process.execPath,
    [nextCliPath, "build", "--webpack"],
    {
      cwd: appRoot,
      env: environment,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  return {
    status: result.status === 0 ? "PASS" : "BLOCKED",
    variant,
    policy: variant === "B" ? PHASE_5_5_H003_VARIANTS.B : PHASE_5_5_H003_VARIANTS.A,
    distDir,
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
    if (handle.server.exitCode != null) throw new Error("phase55_h003_next_server_exited");
    try {
      const response = await fetch(releaseUrl, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 200 && payload.status === "ok") {
        return {
          status: payload.status,
          release: typeof payload.release === "string" ? payload.release : null,
          httpStatus: response.status,
        };
      }
    } catch {
      // The production-mode local server may need a few seconds after spawn.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("phase55_h003_next_server_timeout");
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

function addPhase55H003TraceInitScript(page, policy) {
  return page.addInitScript(({ selectedPolicy }) => {
    window.__aiyaPhase55BundleTraceEnabled = true;
    window.__aiyaPhase55BundlePolicy = selectedPolicy;
    window.__aiyaPhase55BundleEvents = [];
    window.__aiyaPhase55TraceEnabled = true;
    window.__aiyaPhase55PollingPolicy = "current";
    window.__aiyaPhase55Events = [];
  }, { selectedPolicy: policy });
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

function relativeWallTime(atWallMs, traceStartWallMs) {
  return atWallMs == null || traceStartWallMs == null
    ? null
    : roundMs(Number(atWallMs) - traceStartWallMs);
}

function relativeApiRequestRecord(record, captureStartedAtWallMs, traceStartWallMs, baseUrl) {
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

function hasSuccessfulFinishedRequest(request) {
  return request?.status === 200 && request.bodyFinishedAtMs != null && request.failed !== true;
}

function createBundleRequestCapture(page, baseUrl, traceStartWallMs) {
  const records = new Map();
  const startedAtWallMs = Date.now();
  const shouldTrack = (request) => {
    const path = requestPath(request.url(), baseUrl);
    return request.resourceType() === "script" || path.startsWith("/_next/static/");
  };
  const onRequest = (request) => {
    if (!shouldTrack(request)) return;
    records.set(request, {
      route: requestPath(request.url(), baseUrl),
      resourceType: request.resourceType(),
      startedAtWallMs: Date.now(),
      responseAtWallMs: null,
      finishedAtWallMs: null,
      status: null,
      contentLengthBytes: null,
      failed: false,
    });
  };
  const onResponse = (response) => {
    const record = records.get(response.request());
    if (!record) return;
    record.responseAtWallMs = Date.now();
    record.status = response.status();
    const contentLength = response.headers()["content-length"];
    record.contentLengthBytes = /^\d+$/.test(String(contentLength ?? ""))
      ? Number(contentLength)
      : null;
  };
  const onFinished = (request) => {
    const record = records.get(request);
    if (record) record.finishedAtWallMs = Date.now();
  };
  const onFailed = (request) => {
    const record = records.get(request);
    if (record) {
      record.failed = true;
      record.finishedAtWallMs = Date.now();
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfinished", onFinished);
  page.on("requestfailed", onFailed);
  return {
    async finish() {
      const performanceTiming = await page.evaluate(() => ({
        timeOrigin: performance.timeOrigin,
        resourceTimingAvailable: typeof performance.getEntriesByType === "function",
        resources: performance.getEntriesByType("resource").map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType,
          startTime: entry.startTime,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        })),
      })).catch(() => ({ timeOrigin: null, resourceTimingAvailable: false, resources: [] }));
      return {
        startedAtWallMs,
        resourceTimingAvailable: performanceTiming.resourceTimingAvailable,
        resources: performanceTiming.resources
          .map((resource) => ({
            route: requestPath(resource.name, baseUrl),
            initiatorType: resource.initiatorType,
            startAtMs: performanceTiming.timeOrigin == null
              ? null
              : roundMs(performanceTiming.timeOrigin + resource.startTime - traceStartWallMs),
            durationMs: roundMs(resource.duration),
            transferSizeBytes: finite(resource.transferSize),
            encodedBodySizeBytes: finite(resource.encodedBodySize),
            decodedBodySizeBytes: finite(resource.decodedBodySize),
          }))
          .filter((resource) => resource.route.startsWith("/_next/static/")),
        networkRequests: [...records.values()].map((record) => ({
          route: record.route,
          resourceType: record.resourceType,
          startedAtMs: relativeWallTime(record.startedAtWallMs, traceStartWallMs),
          responseAtMs: relativeWallTime(record.responseAtWallMs, traceStartWallMs),
          finishedAtMs: relativeWallTime(record.finishedAtWallMs, traceStartWallMs),
          status: record.status,
          contentLengthBytes: record.contentLengthBytes,
          failed: record.failed,
        })),
      };
    },
    dispose() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfinished", onFinished);
      page.off("requestfailed", onFailed);
    },
  };
}

async function waitForPollingSurfaces(page) {
  return page.waitForFunction(
    () => {
      const events = Array.isArray(window.__aiyaPhase55Events) ? window.__aiyaPhase55Events : [];
      const surfaces = new Set(
        events
          .filter((event) => event.name === "phase55_poll_started")
          .map((event) => event.surface),
      );
      return surfaces.has("inbox") && surfaces.has("messaging_list");
    },
    { timeout: 45_000 },
  ).then(() => true).catch(() => false);
}

async function waitForPollingIdle(page) {
  return page.waitForFunction(
    () => {
      const events = Array.isArray(window.__aiyaPhase55Events) ? window.__aiyaPhase55Events : [];
      const started = events.filter((event) => event.name === "phase55_poll_started").length;
      const finished = events.filter((event) => event.name === "phase55_poll_finished").length;
      return started > 0 && started === finished;
    },
    { timeout: 12_000 },
  ).then(() => true).catch(() => false);
}

function eventsAt(events, name) {
  return events.filter((event) => event.name === name);
}

function summarizePollingExposure(events, requests) {
  const started = eventsAt(events, "phase55_poll_started");
  const finished = eventsAt(events, "phase55_poll_finished");
  const pollingRequests = requests.filter((request) => isPollingPath(request.route));
  return {
    pollStartCount: started.length,
    pollFinishCount: finished.length,
    pollStartSurfaces: [...new Set(started.map((event) => event.surface).filter(Boolean))],
    requiredPollingSurfacesObserved: started.some((event) => event.surface === "inbox") &&
      started.some((event) => event.surface === "messaging_list"),
    pollingIdleObserved: started.length > 0 && started.length === finished.length,
    pollingRequestCount: pollingRequests.length,
  };
}

function toRelativeClientEvent(event, traceStartWallMs) {
  if (!event || typeof event.name !== "string") return null;
  return {
    name: event.name,
    atMs: relativeWallTime(event.atWallMs, traceStartWallMs),
    atPerformanceMs: finite(event.atPerformanceMs),
    ...(typeof event.policy === "string" ? { policy: event.policy } : {}),
    ...(typeof event.loader === "string" ? { loader: event.loader } : {}),
    ...(typeof event.module === "string" ? { module: event.module } : {}),
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
  if (trace.pollingIdleObserved !== true) failures.push("polling_idle_not_observed");
  if (trace.trustedNavigationClickAtMs == null) failures.push("trusted_navigation_click_missing");
  if (trace.routeCommitAtMs == null) failures.push("messages_route_commit_missing");
  if (trace.targetReadyAtMs == null) failures.push("messages_target_ready_missing");
  if (trace.bundleObservation?.policyApplied !== trace.bundlePolicy) {
    failures.push("bundle_policy_not_applied");
  }
  if (trace.bundleObservation?.panelMountedAtMs == null) failures.push("panel_mount_event_missing");
  if (trace.bundleObservation?.resourceTimingAvailable !== true) {
    failures.push("bundle_resource_timing_missing");
  }
  if (trace.requestCapture?.bodyFinishTimedOut === true) failures.push("relevant_request_body_finish_timeout");
  if (!trace.messagesDataReadyRequest || trace.messagesDataReadyRequest.status !== 200 ||
      trace.messagesDataReadyRequest.bodyFinishedAtMs == null || trace.messagesDataReadyRequest.failed === true) {
    failures.push("messages_data_body_finish_missing");
  }
  return {
    observationValidity: failures.length === 0 ? "VALID" : "INVALID",
    functionalOutcome: trace.targetReadyAtMs != null ? "SUCCESS" : "INCOMPLETE",
    timingOutcome: trace.targetReadyAtMs != null ? "MEASURED" : "NOT_EVALUABLE",
    failures,
  };
}

export async function runPhase55H003Trace({
  browser,
  baseUrl,
  email,
  password,
  bundlePolicy,
  buildVariant,
  buildRelease,
  cycle,
  position,
  checkpoint = null,
} = {}) {
  const trace = {
    traceId: `cycle-${cycle}-${position}`,
    journeyId: "P5.5-H-5.1-003-dashboard-to-messages",
    cycle,
    position,
    bundlePolicy,
    buildVariant,
    buildRelease,
    environment: "local_desktop",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_H003_TARGET_SELECTOR],
    traceStartWallMs: null,
    trustedActionAtMs: null,
    dashboardRouteCommitAtMs: null,
    trustedNavigationClickAtMs: null,
    routeCommitAtMs: null,
    initialTargetReadyAtMs: null,
    targetReadyAtMs: null,
    targetInteractivePaintAtMs: null,
    auth: { requestObserved: false, responseStatus: null, bodyFinishedAtMs: null },
    reads: {
      shellBootstrap: { route: SHELL_BOOTSTRAP_PATH, requestStartedAtMs: null, bodyFinishedAtMs: null, status: null },
      appState: { route: APP_STATE_PATH, requestStartedAtMs: null, bodyFinishedAtMs: null, status: null },
    },
    bundleEvents: [],
    routeEvents: [],
    requestCapture: null,
    messagesDataReadyRequest: null,
    pollingExposure: null,
    pollingIdleObserved: false,
    bundleObservation: null,
    browserMetrics: null,
    errorClass: null,
  };
  const traceStartFallback = Date.now();
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  let apiCapture = null;
  let bundleCapture = null;
  try {
    await installPhase44BrowserInstrumentation(page, "diagnostic");
    await addPhase55H003TraceInitScript(page, bundlePolicy);
    await page.goto(`${baseUrl}/login?next=/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS,
    });
    await page.locator("#customer-login-email").waitFor({ state: "visible", timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-email").fill(email, { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    await page.locator("#customer-login-password").fill(password, { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    trace.traceStartWallMs = Date.now();
    apiCapture = createRichRequestCapture(page);
    bundleCapture = createBundleRequestCapture(page, baseUrl, trace.traceStartWallMs);
    const loginRequestPromise = page.waitForRequest(
      (request) => requestPath(request.url(), baseUrl) === LOGIN_PATH,
      { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS },
    ).catch(() => null);
    const loginResponsePromise = page.waitForResponse(
      (response) => requestPath(response.url(), baseUrl) === LOGIN_PATH,
      { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS },
    ).catch(() => null);
    const dashboardRouteCommitPromise = page.waitForURL(
      (url) => new URL(url).pathname === ROUTE_PATH,
      { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS },
    ).then(() => true).catch(() => false);
    const trustedClickDispatchWallMs = Date.now();
    await page.locator('[data-testid="customer-login-submit"]').click({ timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    trace.trustedActionAtMs = roundMs(trustedClickDispatchWallMs - trace.traceStartWallMs);
    const [loginRequest, loginResponse] = await Promise.all([loginRequestPromise, loginResponsePromise]);
    trace.auth.requestObserved = Boolean(loginRequest);
    trace.auth.responseStatus = loginResponse?.status() ?? null;
    if (!loginRequest || !loginResponse || !loginResponse.ok()) throw new Error("phase55_h003_password_login_failed");
    await loginResponse.finished();
    if (!(await dashboardRouteCommitPromise)) throw new Error("phase55_h003_dashboard_route_commit_missing");
    trace.dashboardRouteCommitAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await waitForReady(page, '[data-testid="authenticated-shell"]');
    await waitForReady(page, '[data-testid="overview-work-areas"]');
    trace.initialTargetReadyAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    // Observe polling without making the user's navigation wait for a background interval.
    const pollingSurfacesPromise = waitForPollingSurfaces(page);
    const nav = page.locator('[data-testid="shell-wide-nav"] a[href*="section=messages"]').first();
    await nav.waitFor({ state: "visible", timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    const messagesRouteCommitPromise = page.waitForURL(
      (url) => new URL(url).pathname === ROUTE_PATH && new URL(url).searchParams.get("section") === "messages",
      { timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS },
    ).then(() => true).catch(() => false);
    const navigationClickWallMs = Date.now();
    await nav.click({ timeout: PHASE_5_5_H003_TRACE_TIMEOUT_MS });
    trace.trustedNavigationClickAtMs = roundMs(navigationClickWallMs - trace.traceStartWallMs);
    if (!(await messagesRouteCommitPromise)) throw new Error("phase55_h003_messages_route_commit_missing");
    trace.routeCommitAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await waitForReady(page, PHASE_5_5_H003_TARGET_SELECTOR);
    await page.waitForFunction(
      () => Array.isArray(window.__aiyaPhase55BundleEvents) &&
        window.__aiyaPhase55BundleEvents.some((event) => event.name === "panel_component_mounted"),
      { timeout: 10_000 },
    );
    trace.targetReadyAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await page.evaluate(
      () => new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise))),
    );
    trace.targetInteractivePaintAtMs = roundMs(Date.now() - trace.traceStartWallMs);
    await pollingSurfacesPromise;
    trace.pollingIdleObserved = await waitForPollingIdle(page);
  } catch (error) {
    trace.errorClass = safeErrorClass(error);
  }

  const traceStartWallMs = trace.traceStartWallMs ?? traceStartFallback;
  const browserState = await page.evaluate(() => ({
    bundleEvents: window.__aiyaPhase55BundleEvents ?? [],
    phase55Events: window.__aiyaPhase55Events ?? [],
    phase44RouteEvents: window.__aiyaPhase44?.routeEvents ?? [],
  })).catch(() => ({ bundleEvents: [], phase55Events: [], phase44RouteEvents: [] }));
  const apiSummary = apiCapture
    ? await apiCapture.finish().catch(() => ({ captureStartedAtWallMs: traceStartWallMs, requests: [], bodyFinishTimedOut: true }))
    : { captureStartedAtWallMs: traceStartWallMs, requests: [], bodyFinishTimedOut: true };
  const bundleSummary = bundleCapture
    ? await bundleCapture.finish().catch(() => ({ resourceTimingAvailable: false, resources: [], networkRequests: [] }))
    : { resourceTimingAvailable: false, resources: [], networkRequests: [] };
  const requests = (apiSummary.requests ?? []).map((record) =>
    relativeApiRequestRecord(record, apiSummary.captureStartedAtWallMs, traceStartWallMs, baseUrl),
  );
  const relevantRequests = requests.filter((request) =>
    request.route === LOGIN_PATH ||
    request.route === SHELL_BOOTSTRAP_PATH ||
    request.route === APP_STATE_PATH ||
    isPollingPath(request.route),
  );
  trace.auth.bodyFinishedAtMs = relevantRequests.find((request) => request.route === LOGIN_PATH)?.bodyFinishedAtMs ?? null;
  for (const [key, route] of Object.entries({
    shellBootstrap: SHELL_BOOTSTRAP_PATH,
    appState: APP_STATE_PATH,
  })) {
    const request = relevantRequests.find((item) => item.route === route);
    trace.reads[key] = {
      route,
      requestStartedAtMs: request?.startedAtMs ?? null,
      bodyFinishedAtMs: request?.bodyFinishedAtMs ?? null,
      status: request?.status ?? null,
    };
  }
  trace.bundleEvents = browserState.bundleEvents
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
    captureBodyFinishTimedOut: apiSummary.bodyFinishTimedOut === true,
    bodyFinishTimedOut: relevantRequests.some((request) =>
      request.status != null && request.bodyFinishedAtMs == null && request.failed !== true,
    ),
    requests: relevantRequests,
  };
  trace.messagesDataReadyRequest = relevantRequests.find(
    (request) => request.route === CONVERSATIONS_PATH && hasSuccessfulFinishedRequest(request),
  ) ?? relevantRequests.find((request) => request.route === CONVERSATIONS_PATH) ?? null;
  trace.pollingExposure = summarizePollingExposure(browserState.phase55Events, relevantRequests);
  trace.pollingIdleObserved = trace.pollingIdleObserved || trace.pollingExposure.pollingIdleObserved;
  const panelMounted = trace.bundleEvents.find((event) => event.name === "panel_component_mounted");
  const dynamicResolved = trace.bundleEvents.find((event) => event.name === "dynamic_import_resolved");
  trace.bundleObservation = {
    policyApplied: trace.bundleEvents.find((event) => event.policy)?.policy ?? null,
    expectedPolicy: trace.bundlePolicy,
    panelMountedAtMs: panelMounted?.atMs ?? null,
    dynamicImportResolvedAtMs: dynamicResolved?.atMs ?? null,
    resourceTimingAvailable: bundleSummary.resourceTimingAvailable === true,
    staticResourceCount: bundleSummary.resources.length,
    staticResourcesBeforeNavigation: bundleSummary.resources.filter(
      (resource) => resource.startAtMs != null && trace.trustedNavigationClickAtMs != null &&
        resource.startAtMs < trace.trustedNavigationClickAtMs,
    ).length,
    staticResourcesAfterNavigation: bundleSummary.resources.filter(
      (resource) => resource.startAtMs != null && trace.trustedNavigationClickAtMs != null &&
        resource.startAtMs >= trace.trustedNavigationClickAtMs &&
        (trace.targetReadyAtMs == null || resource.startAtMs <= trace.targetReadyAtMs),
    ).length,
    resourceTiming: bundleSummary.resources,
    networkRequests: bundleSummary.networkRequests,
  };
  trace.browserMetrics = await collectBrowserMetrics(page, "diagnostic").catch(() => null);
  const classification = classifyTrace(trace);
  Object.assign(trace, classification);
  trace.boundary = {
    dashboardRouteToInitialTargetReadyMs:
      trace.dashboardRouteCommitAtMs != null && trace.initialTargetReadyAtMs != null
        ? roundMs(trace.initialTargetReadyAtMs - trace.dashboardRouteCommitAtMs)
        : null,
    navigationClickToTargetReadyMs:
      trace.trustedNavigationClickAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.trustedNavigationClickAtMs)
        : null,
    routeCommitToTargetReadyMs:
      trace.routeCommitAtMs != null && trace.targetReadyAtMs != null
        ? roundMs(trace.targetReadyAtMs - trace.routeCommitAtMs)
        : null,
    routeCommitToInteractivePaintMs:
      trace.routeCommitAtMs != null && trace.targetInteractivePaintAtMs != null
        ? roundMs(trace.targetInteractivePaintAtMs - trace.routeCommitAtMs)
        : null,
    routeCommitToPanelMountMs:
      trace.routeCommitAtMs != null && panelMounted?.atMs != null
        ? roundMs(panelMounted.atMs - trace.routeCommitAtMs)
        : null,
    dynamicImportToPanelMountMs:
      dynamicResolved?.atMs != null && panelMounted?.atMs != null
        ? roundMs(panelMounted.atMs - dynamicResolved.atMs)
        : null,
  };
  const sanitized = sanitizePhase55H003Evidence(trace);
  checkpoint?.append("experiment.trace.completed", sanitized, { status: "RUNNING" });
  bundleCapture?.dispose();
  apiCapture?.dispose();
  await context.close();
  return sanitized;
}

export function summarizePhase55H003Cycles(traces) {
  const cycles = [];
  for (let cycle = 1; cycle <= PHASE_5_5_H003_CYCLE_COUNT; cycle += 1) {
    const cycleTraces = traces.filter((trace) => trace.cycle === cycle);
    const before = cycleTraces.find((trace) => trace.position === "A_before");
    const variant = cycleTraces.find((trace) => trace.position === "B");
    const after = cycleTraces.find((trace) => trace.position === "A_after");
    const aBoundaryValues = [
      before?.boundary?.routeCommitToTargetReadyMs,
      after?.boundary?.routeCommitToTargetReadyMs,
    ].filter((value) => finite(value) != null);
    const aBoundary = aBoundaryValues.length
      ? aBoundaryValues.sort((left, right) => left - right)[Math.floor(aBoundaryValues.length / 2)]
      : null;
    const bBoundary = variant?.boundary?.routeCommitToTargetReadyMs ?? null;
    const delta = aBoundary != null && bBoundary != null ? roundMs(bBoundary - aBoundary) : null;
    cycles.push({
      cycle,
      traceIds: [before?.traceId, variant?.traceId, after?.traceId].filter(Boolean),
      observationValid: [before, variant, after].every((trace) => trace?.observationValidity === "VALID"),
      aBoundaryMs: aBoundary,
      bBoundaryMs: bBoundary,
      deltaBMinusAMs: delta,
      bPolicyApplied: variant?.bundleObservation?.policyApplied === PHASE_5_5_H003_VARIANTS.B,
      bDynamicImportObserved: variant?.bundleObservation?.dynamicImportResolvedAtMs != null,
      direction: delta == null ? "NOT_EVALUABLE" : delta < 0 ? "B_FASTER" : delta > 0 ? "B_SLOWER" : "EQUAL",
    });
  }
  const directions = cycles.map((cycle) => cycle.direction).filter((direction) => direction !== "NOT_EVALUABLE");
  const repeatable =
    cycles.every((cycle) => cycle.observationValid && cycle.bPolicyApplied && cycle.bDynamicImportObserved) &&
    directions.length === PHASE_5_5_H003_CYCLE_COUNT &&
    directions.every((direction) => direction === directions[0]) &&
    directions[0] !== "EQUAL";
  return {
    cycles,
    repeatable,
    conclusion: repeatable ? "REPEATABLE_PROVISIONAL_EFFECT" : "INCONCLUSIVE",
    noCauseConfirmed: true,
    findingDispositionChanged: false,
    dynamicSplitObservedInAllB: cycles.every((cycle) => cycle.bDynamicImportObserved),
  };
}

function persistedH003RunResult(persisted, prerequisite) {
  const traces = persisted.events
    .filter((event) => event.type === "experiment.trace.completed")
    .map((event) => event.payload);
  const build = persisted.events
    .filter((event) => event.type === "environment.build")
    .at(-1)?.payload ?? null;
  const preflight = persisted.events
    .filter((event) => event.type === "environment.preflight")
    .at(-1)?.payload ?? null;
  const cycleSummary = summarizePhase55H003Cycles(traces);
  const status = persisted.manifest.status === "COMPLETE" ? "COMPLETE" : "BLOCKED";
  return {
    runId: persisted.manifest.runId,
    status,
    outcome: status === "COMPLETE" ? cycleSummary.conclusion : "CANDIDATE_LOOP_BLOCKED",
    traces,
    prerequisite,
    preflight,
    build,
    buildIdentity: preflight?.releases ?? null,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : ["checkpoint_not_complete"],
    checkpoint: phase55H003CheckpointSummary(persisted.manifest.runId),
  };
}

export function buildPhase55H003Evidence(result, {
  generatedAt = new Date().toISOString(),
  sourceIdentity = phase55H003SourceIdentity(),
} = {}) {
  const contract = phase55H003CandidateLoopContract();
  const cycleSummary = result.cycleSummary ?? summarizePhase55H003Cycles(result.traces ?? []);
  const traces = result.traces ?? [];
  const validTraceCount = traces.filter((trace) => trace.observationValidity === "VALID").length;
  const allNineAttempted = traces.length === PHASE_5_5_H003_CYCLE_COUNT * 3;
  const status = result.status ?? (allNineAttempted && validTraceCount === traces.length ? "COMPLETE" : "BLOCKED");
  const outcome = status === "BLOCKED" ? "CANDIDATE_LOOP_BLOCKED" : cycleSummary.conclusion;
  return sanitizePhase55H003Evidence({
    schemaVersion: "aiya-performance-plan1-v3-phase5-5-h003-candidate-loop-evidence-v1",
    planRevision: PHASE_5_5_H003_PLAN_REVISION,
    phase: "5",
    stage: "5.5",
    stageId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Run the pre-registered H-5.1-003 dashboard import/render candidate loop with matched local desktop A -> B -> A cycles.",
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
      revision: PHASE_5_5_H003_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
        "5.2 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
        "5.3 COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE",
        "5.4 COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE",
        "5.5 H-5.1-002 COMPLETE / INCONCLUSIVE",
      ],
      currentStage: "5.5 H-5.1-003",
      nextEligibleStage: cycleSummary.conclusion === "INCONCLUSIVE"
        ? "5.6 finding dispositions after supported candidate coverage"
        : "5.6 finding dispositions",
    },
    sourceIdentity,
    prerequisites: result.prerequisite ?? null,
    experimentContract: contract,
    buildIdentity: result.buildIdentity ?? result.build ?? null,
    inputPreflight: result.preflight ?? null,
    cycleSummary,
    sampleSummary: {
      attemptedTraces: traces.length,
      plannedTraces: PHASE_5_5_H003_CYCLE_COUNT * 3,
      observationValidTraces: validTraceCount,
      observationInvalidTraces: traces.length - validTraceCount,
      allNineAttempted,
      validTracesAreNotOfficialBaseline: true,
    },
    traces,
    blockers: result.blockers ?? [],
    findingDispositionChanges: [],
    deferredToLaterStages: [
      "No exact file/function root cause is confirmed by this candidate loop.",
      "H-5.1-004 warm AI Chat remains deferred until a dedicated journey exercises it.",
      "No Plan 2 remediation is authorized by this evidence.",
    ],
    constraints: [
      "B is a reversible trace-only dynamic split probe and is not an accepted runtime fix.",
      "A and B are diagnostic builds in separate ignored local distDirs; neither is a production artifact.",
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
        ? "Preserve this blocked run and repair only the declared build or trace boundary before resuming."
        : cycleSummary.conclusion === "INCONCLUSIVE"
          ? "Reconcile H-5.1-003 as INCONCLUSIVE and proceed to supported candidate coverage or 5.6 disposition review; do not accept a runtime fix."
          : "Proceed to 5.6 finding dispositions; do not treat the provisional effect as a confirmed cause.",
    },
    checkpointReconciliation: result.checkpoint ?? null,
  });
}

export async function runPhase55H003CandidateLoop({
  baseUrl = process.env.AIYA_PHASE55_H003_BASE_URL || PHASE_5_5_H003_DEFAULT_BASE_URL,
  newRun = false,
  reconcileRunId = null,
} = {}) {
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");
  const parentEvidence = readJson(join(repoRoot, PHASE_5_5_H003_PARENT_EVIDENCE_PATH));
  const safetyEvidence = readJson(join(repoRoot, PHASE_5_5_H003_SAFETY_EVIDENCE_PATH));
  const h002Evidence = readJson(join(repoRoot, PHASE_5_5_H003_H002_EVIDENCE_PATH));
  const prerequisite = phase55H003PrerequisiteCheck(parentEvidence, safetyEvidence, h002Evidence);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = (() => {
    try {
      return parseLocalSupabaseStatus();
    } catch (error) {
      return { status: "BLOCKED", reason: safeErrorClass(error) };
    }
  })();
  const sourceIdentity = phase55H003SourceIdentity();
  const identity = {
    planRevision: PHASE_5_5_H003_PLAN_REVISION,
    candidateId: PHASE_5_5_H003_CANDIDATE_ID,
    variableId: PHASE_5_5_H003_VARIABLE_ID,
    environment: "local_desktop",
    baseOrigin: new URL(normalizedBaseUrl).origin,
    sourceHead: sourceIdentity.head,
    sourceFiles: sourceIdentity.sourceFiles,
    parentEvidenceSha256: prerequisite.parentEvidence.sha256,
    safetyEvidenceSha256: prerequisite.safetyEvidence.sha256,
    h002EvidenceSha256: prerequisite.h002Evidence.sha256,
    buildControl: "same_inputs_two_diagnostic_builds_single_import_boundary",
    cacheMode: "cold_context_service_workers_blocked",
    routeOrder: ["/login?next=/dashboard", "/dashboard", "trusted shell navigation click", PHASE_5_5_H003_TARGET_SELECTOR],
    repetitionOrder: ["A_before", "B", "A_after"],
    targetModule: PHASE_5_5_H003_TARGET_MODULE,
  };
  if (reconcileRunId) {
    if (!new RegExp(`^${PHASE_5_5_H003_CHECKPOINT_PHASE_ID}-[A-Za-z0-9-]+$`).test(reconcileRunId)) {
      throw new Error("phase55_h003_reconciliation_run_id_invalid");
    }
    return persistedH003RunResult(readPhaseRun({
      root: PHASE_5_5_H003_CHECKPOINT_ROOT,
      phaseId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID,
      runId: reconcileRunId,
    }), prerequisite);
  }
  const opened = openPhaseRun({
    root: PHASE_5_5_H003_CHECKPOINT_ROOT,
    phaseId: PHASE_5_5_H003_CHECKPOINT_SCHEMA_VERSION,
    phaseSchemaVersion: PHASE_5_5_H003_CHECKPOINT_SCHEMA_VERSION,
    identity,
    newRun,
    metadata: {
      identitySummary: {
        planRevision: PHASE_5_5_H003_PLAN_REVISION,
        candidateId: PHASE_5_5_H003_CANDIDATE_ID,
        variableId: PHASE_5_5_H003_VARIABLE_ID,
        environment: "local_desktop",
        cycleCount: PHASE_5_5_H003_CYCLE_COUNT,
        countedAsOfficialSample: false,
      },
    },
    redact: sanitizePhase55H003Evidence,
  });
  if (opened.action === "COMPLETE") {
    return persistedH003RunResult(readPhaseRun({
      root: PHASE_5_5_H003_CHECKPOINT_ROOT,
      phaseId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID,
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
      checkpoint: phase55H003CheckpointSummary(opened.manifest.runId),
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
      checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
    };
  }
  if (localStatus.status !== "PASS") {
    const blockers = ["local_supabase_unreachable_or_not_ready"];
    checkpoint.append("environment.preflight", {
      status: "BLOCKED",
      blockers,
      localSupabase: phase55H003LocalStatusSummary(localStatus),
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
      preflight: { status: "BLOCKED", blockers, localSupabase: phase55H003LocalStatusSummary(localStatus) },
      checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
    };
  }
  const buildResults = {};
  for (const variant of ["A", "B"]) {
    buildResults[variant] = runLocalBuild(
      localStatus,
      configuration,
      normalizedBaseUrl,
      variant,
      PHASE_5_5_H003_DIST_DIRS[variant],
    );
  }
  checkpoint.append("environment.build", {
    status: Object.values(buildResults).every((build) => build.status === "PASS") ? "PASS" : "BLOCKED",
    variants: buildResults,
    outputRecorded: false,
  }, { status: Object.values(buildResults).every((build) => build.status === "PASS") ? "RUNNING" : "BLOCKED" });
  if (Object.values(buildResults).some((build) => build.status !== "PASS")) {
    const blockers = Object.values(buildResults)
      .filter((build) => build.status !== "PASS")
      .map((build) => `${build.variant}_${build.reason ?? "local_build_failed"}`);
    checkpoint.markStatus("BLOCKED", { reason: "candidate_loop_variant_build_blocked", blockers });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "CANDIDATE_LOOP_BUILD_BLOCKED",
      traces: [],
      prerequisite,
      blockers,
      build: buildResults,
      checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
    };
  }

  const traces = [];
  const releases = {};
  let server = null;
  let activeVariant = null;
  const browser = await chromium.launch({ headless: true });
  try {
    const ensureVariantServer = async (variant) => {
      if (activeVariant === variant && server?.server?.exitCode == null) return;
      await stopLocalServer(server);
      const baseEnvironment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
        baseUrl: normalizedBaseUrl,
        localStatus,
      });
      const environment = buildVariantEnvironment(
        baseEnvironment,
        variant,
        PHASE_5_5_H003_DIST_DIRS[variant],
      );
      server = startLocalServer(environment, normalizedBaseUrl);
      releases[variant] = await waitForLocalServer(server, normalizedBaseUrl);
      activeVariant = variant;
    };

    await ensureVariantServer("A");
    const preflight = await checkPhase44LocalInputs(normalizedBaseUrl, {
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
      releases,
      localSupabase: phase55H003LocalStatusSummary(localStatus),
    }, { status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED" });
    if (preflight.status !== "PASS") {
      checkpoint.markStatus("BLOCKED", { reason: "candidate_loop_preflight_blocked" });
      checkpoint.close();
      return {
        runId: checkpoint.runId,
        status: "BLOCKED",
        outcome: "CANDIDATE_LOOP_PREFLIGHT_BLOCKED",
        traces,
        prerequisite,
        blockers: preflight.blockers,
        preflight,
        build: buildResults,
        checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
      };
    }

    for (let cycle = 1; cycle <= PHASE_5_5_H003_CYCLE_COUNT; cycle += 1) {
      const cycleTraces = [];
      for (const position of ["A_before", "B", "A_after"]) {
        const variant = position === "B" ? "B" : "A";
        await ensureVariantServer(variant);
        checkpoint.append("experiment.trace.started", {
          cycle,
          position,
          variant,
          bundlePolicy: PHASE_5_5_H003_VARIANTS[variant],
          candidateId: PHASE_5_5_H003_CANDIDATE_ID,
          variableId: PHASE_5_5_H003_VARIABLE_ID,
          countedAsOfficialSample: false,
        });
        const trace = await runPhase55H003Trace({
          browser,
          baseUrl: normalizedBaseUrl,
          email: configuration.email,
          password: configuration.password,
          bundlePolicy: PHASE_5_5_H003_VARIANTS[variant],
          buildVariant: variant,
          buildRelease: releases[variant]?.release ?? null,
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
      build: buildResults,
      checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
    };
  } finally {
    await stopLocalServer(server);
    await browser.close();
  }
  const cycleSummary = summarizePhase55H003Cycles(traces);
  const allValid = traces.length === PHASE_5_5_H003_CYCLE_COUNT * 3 &&
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
    preflight: { status: "PASS", releases },
    build: buildResults,
    buildIdentity: releases,
    cycleSummary,
    blockers: status === "COMPLETE" ? [] : ["invalid_or_incomplete_candidate_trace"],
    checkpoint: phase55H003CheckpointSummary(checkpoint.runId),
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
    baseUrl: process.env.AIYA_PHASE55_H003_BASE_URL || PHASE_5_5_H003_DEFAULT_BASE_URL,
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
    else throw new Error(`phase55_h003_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(sanitizePhase55H003Evidence({
      phase: "5",
      stage: "5.5",
      planRevision: PHASE_5_5_H003_PLAN_REVISION,
      contract: phase55H003CandidateLoopContract(),
      prerequisites: {
        parentEvidencePath: PHASE_5_5_H003_PARENT_EVIDENCE_PATH,
        safetyEvidencePath: PHASE_5_5_H003_SAFETY_EVIDENCE_PATH,
        h002EvidencePath: PHASE_5_5_H003_H002_EVIDENCE_PATH,
      },
      outputContract: "docs/AIYA_PERFORMANCE_PLAN_1_V3_<runId>_EVIDENCE.json",
    }), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(`${JSON.stringify(sanitizePhase55H003Evidence({
      phase: "5",
      stage: "5.5",
      checkpointPhaseId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID,
      runs: inspectPhaseRuns({ root: PHASE_5_5_H003_CHECKPOINT_ROOT, phaseId: PHASE_5_5_H003_CHECKPOINT_PHASE_ID }),
    }), null, 2)}\n`);
    return;
  }
  if (!options.run && !options.reconcileRunId) {
    throw new Error("phase55_h003_run_or_descriptor_or_status_required");
  }
  const result = await runPhase55H003CandidateLoop({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
    reconcileRunId: options.reconcileRunId,
  });
  const evidence = buildPhase55H003Evidence(result);
  let evidencePath = null;
  if (options.writeEvidence) {
    evidencePath = phase55H003EvidencePath(result.runId);
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(sanitizePhase55H003Evidence({
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
