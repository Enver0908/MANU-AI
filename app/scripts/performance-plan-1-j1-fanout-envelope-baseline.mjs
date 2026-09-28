/**
 * Current-source J1 legacy baseline with a predeclared request fan-out
 * envelope and a strict Forms lifecycle validity gate.
 *
 * This is a single-condition capture. It does not repeat the prior dirty-
 * registration A-B-A and does not alter application runtime behavior.
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

export const FANOUT_BASELINE_PLAN_REVISION = "plan1-final-v3";
export const FANOUT_BASELINE_PHASE_ID =
  "aiya-performance-plan1-j1-fanout-envelope-baseline-v1";
export const FANOUT_BASELINE_SCHEMA_VERSION = FANOUT_BASELINE_PHASE_ID;
export const FANOUT_BASELINE_BASE_URL = "http://127.0.0.1:3166";
export const FANOUT_BASELINE_REPETITIONS = 3;
export const FANOUT_BASELINE_POLICY = "legacy";
export const FANOUT_BASELINE_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const FANOUT_BASELINE_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";

export const FANOUT_BASELINE_ENVELOPE = Object.freeze({
  totalRequests: Object.freeze({ min: 53, max: 56 }),
  apiRequests: Object.freeze({ min: 24, max: 27 }),
  documentRequests: Object.freeze({ exact: 3 }),
  rscRequests: Object.freeze({ exact: 26 }),
  apiRouteCounts: Object.freeze({
    "/api/auth/password-login": Object.freeze({ exact: 1 }),
    "/api/shell/bootstrap": Object.freeze({ min: 7, max: 9 }),
    "/api/session/activity": Object.freeze({ exact: 2 }),
    "/api/shell/version": Object.freeze({ exact: 2 }),
    "/api/app-state": Object.freeze({ exact: 2 }),
    "/api/alerts": Object.freeze({ min: 2, max: 3 }),
    "/api/notifications": Object.freeze({ min: 2, max: 3 }),
    "/api/conversations": Object.freeze({ min: 2, max: 3 }),
    "/api/shell/preferences": Object.freeze({ exact: 1 }),
    "/api/clients/:clientId": Object.freeze({ min: 1, max: 2 }),
    "/api/clients/:clientId/forms": Object.freeze({ exact: 1 }),
    "/api/clients/:clientId/food-rule-profile": Object.freeze({ exact: 1 }),
  }),
});

const UUID_PATH_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SOURCE_FILES = Object.freeze([
  "app/package.json",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/scripts/performance-plan-1-j1-fanout-envelope-baseline.mjs",
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/components/dashboard/client-workspace.tsx",
  "app/src/lib/use-stage-6-client-workspace.ts",
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

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function fanoutBaselineDistDir(runId) {
  const suffix = String(runId ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(-32) || "unknown";
  return `.next-fanout-baseline-${suffix}`;
}

function sanitizeRoute(value) {
  try {
    const parsed = new URL(String(value), "http://fanout-baseline.local");
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

function replaceIdentifiers(value) {
  if (typeof value === "string") return value.replace(UUID_PATH_RE, "<uuid>");
  if (Array.isArray(value)) return value.map(replaceIdentifiers);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceIdentifiers(child)]),
    );
  }
  return value;
}

export function sanitizeFanoutBaselineEvidence(value) {
  return replaceIdentifiers(sanitizePhase44Evidence(value));
}

function normalizeBaseUrl(value) {
  const url = new URL(value || FANOUT_BASELINE_BASE_URL);
  if (!url.port) url.port = "3166";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("fanout_baseline_run_id_invalid");
  }
  return join(repoRoot, `${FANOUT_BASELINE_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
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
    shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
    sourceFiles: SOURCE_FILES.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
    configurationIdentity: configuration.identity,
  };
}

export function startLocalServer(environment, baseUrl) {
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

export async function waitForServer(handle, timeoutMs = PHASE_4_3_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (handle.server.exitCode != null) throw new Error("fanout_baseline_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next may still be binding or loading the diagnostic artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("fanout_baseline_server_timeout");
}

export async function stopLocalServer(handle) {
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

export function completedResults(events) {
  const traces = new Map();
  const completed = new Map();
  for (const event of events ?? []) {
    const key = event.payload?.unitKey;
    if (!key) continue;
    if (event.type === "measurement.unit.trace") traces.set(key, event.payload);
    if (event.type === "measurement.unit.completed") completed.set(key, event.payload);
  }
  return [...completed.entries()]
    .filter(([key]) => traces.has(key))
    .map(([key]) => traces.get(key));
}

function requestRecords(result) {
  return Array.isArray(result?.trace?.measurement?.requestSummary?.requests)
    ? result.trace.measurement.requestSummary.requests
    : [];
}

function routeCounts(result) {
  const counts = {};
  for (const request of requestRecords(result)) {
    const route = sanitizeRoute(request.route);
    if (!route.startsWith("/api/")) continue;
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function requestShape(result) {
  const requests = requestRecords(result);
  const api = requests.filter((request) => sanitizeRoute(request.route).startsWith("/api/"));
  return {
    totalRequests: requests.length,
    apiRequests: api.length,
    documentRequests: requests.filter((request) => request.requestKind === "document").length,
    rscRequests: requests.filter((request) => request.requestKind === "rsc").length,
    apiRouteCounts: routeCounts(result),
  };
}

function rangePass(value, range) {
  return finite(value) != null && value >= range.min && value <= range.max;
}

function exactPass(value, range) {
  return finite(value) != null && value === range.exact;
}

export function checkFanoutEnvelope(shape, envelope = FANOUT_BASELINE_ENVELOPE) {
  const failures = [];
  if (!rangePass(shape.totalRequests, envelope.totalRequests)) failures.push("total_request_count_outside_envelope");
  if (!rangePass(shape.apiRequests, envelope.apiRequests)) failures.push("api_request_count_outside_envelope");
  if (!exactPass(shape.documentRequests, envelope.documentRequests)) failures.push("document_request_count_outside_envelope");
  if (!exactPass(shape.rscRequests, envelope.rscRequests)) failures.push("rsc_request_count_outside_envelope");
  for (const [route, rule] of Object.entries(envelope.apiRouteCounts)) {
    const count = shape.apiRouteCounts?.[route] ?? 0;
    const matches = rule.exact != null ? count === rule.exact : count >= rule.min && count <= rule.max;
    if (!matches) failures.push(`route_count_outside_envelope:${route}`);
  }
  const unexpectedRoutes = Object.keys(shape.apiRouteCounts ?? {})
    .filter((route) => !Object.prototype.hasOwnProperty.call(envelope.apiRouteCounts, route));
  if (unexpectedRoutes.length) failures.push("unexpected_api_route");
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    unexpectedRoutes,
    envelope,
  };
}

function requiredRead(result, actionId) {
  const reads = Array.isArray(result?.trace?.measurement?.requiredReads)
    ? result.trace.measurement.requiredReads
    : [];
  const read = reads.find((item) => item.actionId === actionId) ?? null;
  const records = Array.isArray(read?.records) ? read.records : [];
  const completed = records.filter((record) =>
    record.method === "GET" &&
    Number.isInteger(record.status) &&
    record.status >= 200 &&
    record.status < 300 &&
    record.bodyFinishedAtMs != null &&
    record.failed !== true,
  );
  return {
    actionId,
    pattern: String(read?.pattern ?? "").slice(0, 120),
    count: Number.isInteger(read?.count) ? read.count : records.length,
    recordCount: records.length,
    valid: read?.valid === true,
    completedRecordCount: completed.length,
    exactOneCompleted: records.length === 1 && completed.length === 1 && read?.valid === true,
  };
}

export function checkFormsLifecycle(result) {
  const events = Array.isArray(result?.trace?.measurement?.longTasks?.phase55Events)
    ? result.trace.measurement.longTasks.phase55Events
    : [];
  const forms = events.filter((event) => event.domain === "forms");
  const count = (name) => forms.filter((event) => event.name === name).length;
  const summary = {
    effectSetup: count("stage6_workspace_effect_setup"),
    effectCleanup: count("stage6_workspace_effect_cleanup"),
    loadStarted: count("stage6_workspace_load_started"),
    loadSucceeded: count("stage6_workspace_load_succeeded"),
    loadAborted: count("stage6_workspace_load_aborted"),
  };
  const failures = [];
  if (summary.effectSetup !== 1) failures.push("forms_effect_setup_not_exactly_one");
  if (summary.loadStarted !== 1) failures.push("forms_load_start_not_exactly_one");
  if (summary.loadSucceeded !== 1) failures.push("forms_load_success_not_exactly_one");
  if (summary.loadAborted !== 0) failures.push("forms_load_abort_observed");
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    summary,
  };
}

export function summarizeBaselineSample(result) {
  const shape = requestShape(result);
  const fanout = checkFanoutEnvelope(shape);
  const forms = requiredRead(result, "first");
  const nutrition = requiredRead(result, "second");
  const lifecycle = checkFormsLifecycle(result);
  const observationValid = result?.observationValidity === "VALID";
  const functionalSuccess = result?.functionalOutcome === "SUCCESS";
  const eligible = result?.validSample === true &&
    observationValid &&
    functionalSuccess &&
    forms.exactOneCompleted &&
    nutrition.exactOneCompleted &&
    lifecycle.status === "PASS" &&
    fanout.status === "PASS";
  return {
    unitKey: String(result?.unitKey ?? ""),
    repetition: Number.isInteger(result?.repetition) ? result.repetition : null,
    sourceValidSample: result?.validSample === true,
    observationValidity: String(result?.observationValidity ?? "UNKNOWN"),
    functionalOutcome: String(result?.functionalOutcome ?? "UNKNOWN"),
    eligible,
    fanout: {
      totalRequests: shape.totalRequests,
      apiRequests: shape.apiRequests,
      documentRequests: shape.documentRequests,
      rscRequests: shape.rscRequests,
      apiRouteCounts: shape.apiRouteCounts,
      status: fanout.status,
      failures: fanout.failures,
      unexpectedRoutes: fanout.unexpectedRoutes,
    },
    requiredReads: { forms, nutrition },
    formsLifecycle: lifecycle,
    failureBoundary: result?.failureBoundary
      ? {
          phase: String(result.failureBoundary.phase ?? "unknown"),
          actionId: result.failureBoundary.actionId == null ? null : String(result.failureBoundary.actionId),
          reason: result.failureBoundary.reason == null ? null : String(result.failureBoundary.reason).slice(0, 120),
        }
      : null,
  };
}

export function analyzeBaselineResults(results) {
  const samples = (results ?? []).map(summarizeBaselineSample);
  const planned = FANOUT_BASELINE_REPETITIONS;
  const eligible = samples.filter((sample) => sample.eligible).length;
  const outcome = samples.length !== planned
    ? "J1_LEGACY_FANOUT_ENVELOPE_CAPTURE_INCOMPLETE"
    : eligible === planned
      ? "J1_LEGACY_FORMS_AND_FANOUT_ENVELOPE_REPEATED_VALID"
      : "J1_LEGACY_FORMS_OR_FANOUT_ENVELOPE_NOT_MET";
  return {
    outcome,
    samples,
    counts: {
      attempted: samples.length,
      planned,
      observationValid: samples.filter((sample) => sample.observationValidity === "VALID").length,
      sourceValidFunctional: samples.filter((sample) =>
        sample.sourceValidSample && sample.functionalOutcome === "SUCCESS",
      ).length,
      fanoutEnvelopePass: samples.filter((sample) => sample.fanout.status === "PASS").length,
      formsRequiredReadPass: samples.filter((sample) => sample.requiredReads.forms.exactOneCompleted).length,
      formsLifecyclePass: samples.filter((sample) => sample.formsLifecycle.status === "PASS").length,
      eligible,
      officialBaselineSamples: 0,
    },
  };
}

function checkpointSummary(persisted) {
  return {
    status: persisted.manifest?.status ?? null,
    eventCount: persisted.events.length,
    lastSequence: persisted.manifest?.lastSequence ?? null,
    lastEventType: persisted.events.at(-1)?.type ?? null,
    hashChainRead: true,
  };
}

function sourceCheckpoint(persisted) {
  return {
    phaseId: FANOUT_BASELINE_PHASE_ID,
    schemaVersion: FANOUT_BASELINE_SCHEMA_VERSION,
    status: persisted.manifest?.status ?? null,
    eventCount: persisted.events.length,
    lastSequence: persisted.manifest?.lastSequence ?? null,
    hashChainRead: true,
  };
}

function buildIdentity(baseUrl, configuration, source) {
  return {
    planRevision: FANOUT_BASELINE_PLAN_REVISION,
    phaseId: FANOUT_BASELINE_PHASE_ID,
    phaseSchemaVersion: FANOUT_BASELINE_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_legacy_single_condition_fanout_envelope_baseline",
    shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
    controlVariant: null,
    journeyId: "J1",
    repetitions: FANOUT_BASELINE_REPETITIONS,
    secondActionDelayMs: 2_000,
    fanoutEnvelope: FANOUT_BASELINE_ENVELOPE,
    lifecycleGate: "one_forms_setup_start_success_and_zero_forms_abort",
    localConfigurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  };
}

function buildPreflight(configuration, localStatus, baseUrl) {
  const blockers = [];
  if (localStatus.status !== "PASS") blockers.push("local_supabase_unreachable_or_not_ready");
  if (!configuration.email) blockers.push("synthetic_email_unavailable");
  if (!configuration.password) blockers.push("synthetic_password_unavailable");
  return {
    status: blockers.length ? "BLOCKED" : "PASS",
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    authentication: "real_password_session_required",
    storePath: "normal_rls_api_path_required",
    fallbackStoreAllowed: false,
    targetOrigin: baseUrl,
    shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
    controlVariant: null,
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
    blockers,
  };
}

async function runCapture({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const forcedConfiguration = {
    ...configuration,
    environment: {
      ...configuration.environment,
      NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY: FANOUT_BASELINE_POLICY,
    },
  };
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(forcedConfiguration);
  const identity = buildIdentity(normalizedBaseUrl, forcedConfiguration, source);
  const opened = openPhaseRun({
    root: FANOUT_BASELINE_CHECKPOINT_ROOT,
    phaseId: FANOUT_BASELINE_PHASE_ID,
    phaseSchemaVersion: FANOUT_BASELINE_SCHEMA_VERSION,
    identity,
    metadata: { contract: identity, countedAsOfficialSample: false },
    newRun,
    redact: sanitizeFanoutBaselineEvidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: FANOUT_BASELINE_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      sourceIdentity: source,
      preflight: null,
      results: completedResults(persisted.events),
      checkpoint: sourceCheckpoint(persisted),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight: null,
      results: [],
      checkpoint: null,
      runtimeError: "fanout_baseline_checkpoint_not_run",
    };
  }

  const checkpoint = opened.run;
  const results = completedResults(checkpoint.events);
  const preflight = buildPreflight(forcedConfiguration, localStatus, normalizedBaseUrl);
  checkpoint.append("environment.preflight", preflight, {
    status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED",
  });
  if (preflight.status !== "PASS") {
    checkpoint.markStatus("BLOCKED", { reason: "fanout_baseline_preflight_blocked" });
    checkpoint.close();
    const persisted = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: FANOUT_BASELINE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
      checkpoint: sourceCheckpoint(persisted),
    };
  }

  let serverHandle = null;
  let browser = null;
  const diagnosticDistDir = fanoutBaselineDistDir(checkpoint.runId);
  try {
    const buildEnvironment = buildPhase44ServerEnvironment(
      {
        ...forcedConfiguration.environment,
        AIYA_PHASE55_DIST_DIR: diagnosticDistDir,
      },
      "diagnostic",
      { baseUrl: normalizedBaseUrl, localStatus },
    );
    if (!existsSync(nextCliPath)) throw new Error("fanout_baseline_next_cli_missing");
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
      shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
      distDir: diagnosticDistDir,
      outputRecorded: false,
    }, { status: build.status === 0 ? "RUNNING" : "BLOCKED" });
    if (build.status !== 0) throw new Error("fanout_baseline_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
    if (!journey) throw new Error("fanout_baseline_j1_journey_missing");
    for (let repetition = 1; repetition <= FANOUT_BASELINE_REPETITIONS; repetition += 1) {
      const unitKey = `legacy:diagnostic:J1:r${repetition}`;
      if (results.some((result) => result.unitKey === unitKey)) continue;
      results.push(await runMeasurementUnit({
        browser,
        baseUrl: normalizedBaseUrl,
        mode: "diagnostic",
        journey,
        repetition,
        unitKey,
        scope: "j1_legacy_fanout_envelope_baseline",
        email: forcedConfiguration.email,
        password: forcedConfiguration.password,
        controlVariant: null,
        traceVariant: null,
        checkpoint,
      }));
    }
    const complete = results.length === FANOUT_BASELINE_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete
        ? "fanout_baseline_capture_completed"
        : "fanout_baseline_capture_incomplete",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    const persisted = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: FANOUT_BASELINE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: complete ? "COMPLETE" : "BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
      checkpoint: checkpointSummary(persisted),
      diagnosticDistDir,
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "fanout_baseline_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    const persisted = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: FANOUT_BASELINE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
      checkpoint: checkpointSummary(persisted),
      diagnosticDistDir,
      runtimeError: String(error?.message || "fanout_baseline_runner_failed").slice(0, 160),
    };
  } finally {
    if (browser) await browser.close();
    await stopLocalServer(serverHandle);
  }
}

function buildEvidence(result) {
  const analysis = analyzeBaselineResults(result.results ?? []);
  const blockers = [...new Set([
    ...(result.preflight?.blockers ?? []),
    ...(result.runtimeError ? [result.runtimeError] : []),
  ].filter(Boolean))];
  return sanitizeFanoutBaselineEvidence({
    schemaVersion: FANOUT_BASELINE_SCHEMA_VERSION,
    planRevision: FANOUT_BASELINE_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-fanout-envelope-baseline",
    stageId: FANOUT_BASELINE_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt: new Date().toISOString(),
    status: result.status,
    outcome: analysis.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Establish a current-source legacy J1 request fan-out and Forms lifecycle control envelope before any new candidate comparison.",
      analysisOnly: false,
      browserRerunStarted: true,
      applicationRuntimeChanged: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      diagnosticBuildDistDir: result.diagnosticDistDir ?? null,
      diagnosticBuildDistDirPolicy: "run_scoped_separate_dist_dir",
      shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
      controlVariant: null,
      countedAsOfficialSample: false,
      externalOperations: [],
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: FANOUT_BASELINE_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      currentStage: FANOUT_BASELINE_PHASE_ID,
      plan2EntryAuthorized: false,
    },
    sourceIdentity: result.sourceIdentity,
    measurementIdentity: {
      fixtureId: "local-normal",
      fixtureClass: "synthetic_normal_owner",
      storePath: "normal_rls_api_path_required",
      localSupabaseHost: "127.0.0.1:54321",
      journeyId: "J1",
      mode: "diagnostic",
      repetitions: FANOUT_BASELINE_REPETITIONS,
      secondActionDelayMs: 2_000,
      shellDirtyRegistrationPolicy: FANOUT_BASELINE_POLICY,
      controlVariant: null,
      officialMeasurement: false,
      diagnosticBuildDistDir: result.diagnosticDistDir ?? null,
      fanoutEnvelope: FANOUT_BASELINE_ENVELOPE,
      lifecycleGate: "one_forms_setup_start_success_and_zero_forms_abort",
    },
    checkpoint: result.checkpoint ?? null,
    preflight: result.preflight ?? null,
    sampleSummary: analysis.counts,
    samples: analysis.samples,
    blockers,
    interpretation: {
      baselineControl: "legacy policy held constant; no settlement gate or runtime patch applied",
      requiredReadGate: "exactly one completed Forms record and exactly one completed Nutrition record",
      lifecycleGate: "exactly one Forms setup/start/success sequence and zero Forms load aborts",
      requestFanoutGate: "all request and API route counts must remain inside the predeclared envelope",
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      conclusion: analysis.outcome === "J1_LEGACY_FORMS_AND_FANOUT_ENVELOPE_REPEATED_VALID"
        ? "The current legacy baseline repeated inside the declared Forms and fan-out envelope; this establishes a control boundary only and does not prove a candidate cause."
        : "The current legacy baseline did not repeat inside the declared Forms and fan-out envelope; the control boundary is not established and no candidate comparison should proceed."
    },
    explicitNonClaims: [
      "This is outside the official nine-scenario acceptance baseline.",
      "A valid legacy envelope does not prove that the global freeze comes from auth, fan-out, React commits, or any single component.",
      "An envelope miss is a validity boundary, not a product defect or root-cause finding.",
      "No runtime fix, finding disposition, Plan 2 entry, migration, deployment, or production decision changed.",
      "No external provider, WhatsApp, billing, production worker, or real health-data path was used.",
    ],
    redaction: {
      status: "PASS",
      rawIdentifiersIncluded: false,
      rawBodiesIncluded: false,
      credentialsIncluded: false,
      healthDataIncluded: false,
    },
    closure: {
      status: result.status,
      outcome: analysis.outcome,
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
      nextAction: analysis.outcome === "J1_LEGACY_FORMS_AND_FANOUT_ENVELOPE_REPEATED_VALID"
        ? "Use this envelope as the control contract for a separately identified candidate capture; do not repeat this baseline or combine it with another variable."
        : "Do not start a candidate comparison; first repair or separately diagnose the legacy Forms/fan-out validity boundary."
    },
  });
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    writeEvidence: false,
    newRun: false,
    baseUrl: process.env.AIYA_FANOUT_BASELINE_BASE_URL || FANOUT_BASELINE_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`fanout_baseline_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: FANOUT_BASELINE_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 legacy fan-out envelope baseline ready. Use --run explicitly.\n");
    return;
  }
  const result = await runCapture({ baseUrl: options.baseUrl, newRun: options.newRun });
  const evidence = buildEvidence(result);
  const summary = {
    runId: result.runId,
    status: result.status,
    outcome: evidence.outcome,
    sampleSummary: evidence.sampleSummary,
    evidencePath: options.writeEvidence && result.runId ? phaseEvidencePath(result.runId) : null,
  };
  if (options.writeEvidence && result.runId) {
    writeFileSync(summary.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
