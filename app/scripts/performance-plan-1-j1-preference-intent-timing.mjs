#!/usr/bin/env node

/**
 * Trace-only J1 capture for shell-preference intent and completion timing.
 *
 * This runner records only allowlisted preference intent keys and bounded
 * timing/route/lifecycle metadata. It is outside the official baseline and
 * does not change runtime behavior or accept a fix.
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
  PHASE_4_3_TRACE_VARIANTS,
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

export const PREFERENCE_INTENT_PHASE_ID =
  "aiya-performance-plan1-j1-preference-intent-timing-v1";
export const PREFERENCE_INTENT_SCHEMA_VERSION =
  "aiya-performance-plan1-j1-preference-intent-timing-v1";
export const PREFERENCE_INTENT_PLAN_REVISION = "plan1-final-v3";
export const PREFERENCE_INTENT_TRACE_VARIANT =
  PHASE_4_3_TRACE_VARIANTS.preferenceIntentTimingAndCompletion;
export const PREFERENCE_INTENT_BASE_URL = "http://127.0.0.1:3153";
export const PREFERENCE_INTENT_REPETITIONS = 3;
export const PREFERENCE_INTENT_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PREFERENCE_INTENT_EVIDENCE_PREFIX =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_";

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const numeric = finite(value);
  return numeric == null ? null : Number(numeric.toFixed(3));
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
  const url = new URL(value || PREFERENCE_INTENT_BASE_URL);
  if (!url.port) url.port = "3153";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("preference_intent_run_id_invalid");
  }
  return join(
    repoRoot,
    `${PREFERENCE_INTENT_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`,
  );
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-preference-intent-timing.mjs",
    "app/src/components/dashboard-app.tsx",
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/lib/phase-85-stage-5-shell-preference-coordinator.ts",
    "app/src/lib/use-stage-6-client-workspace.ts",
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

function checkpointIdentity({ baseUrl, configuration, source }) {
  return {
    planRevision: PREFERENCE_INTENT_PLAN_REVISION,
    phaseId: PREFERENCE_INTENT_PHASE_ID,
    phaseSchemaVersion: PREFERENCE_INTENT_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_preference_intent_timing_trace_only",
    traceVariant: PREFERENCE_INTENT_TRACE_VARIANT,
    journeyId: "J1",
    repetitions: PREFERENCE_INTENT_REPETITIONS,
    serverControl: "one_managed_normal_server",
    localConfigurationIdentity: configuration.identity,
    officialMeasurement: false,
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
    if (handle.server.exitCode != null) throw new Error("preference_intent_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, {
        cache: "no-store",
      });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next may still be binding or loading the production artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("preference_intent_server_timeout");
}

async function stopLocalServer(handle) {
  const server = handle?.server;
  if (!server || server.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    server.kill("SIGTERM");
  }
  const startedAt = Date.now();
  while (server.exitCode == null && Date.now() - startedAt < 10_000) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
}

function completedResults(events) {
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

function compactLifecycleEvents(result) {
  const longTasks = result?.trace?.measurement?.longTasks;
  const events = [
    ...(Array.isArray(longTasks?.phase52Events) ? longTasks.phase52Events : []),
    ...(Array.isArray(longTasks?.phase55Events) ? longTasks.phase55Events : []),
  ];
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => String(event?.name ?? "").startsWith("stage6_workspace_"))
    .map((event) => ({
      name: String(event.name).slice(0, 80),
      atMs: roundMs(event.atWallMs - result.trace.startedAtWallMs),
      cleanupSequence: Number.isInteger(event.cleanupSequence)
        ? event.cleanupSequence
        : null,
    }));
}

function compactRouteHistory(result) {
  const routeHistory = result?.trace?.measurement?.routeHistory;
  return {
    events: Array.isArray(routeHistory?.events)
      ? routeHistory.events.map((event) => ({
          atMs: roundMs(event.atMs),
          route: event.route,
          source: String(event.source ?? "unknown").slice(0, 40),
        }))
      : [],
    trustedEvents: Array.isArray(routeHistory?.trustedEvents)
      ? routeHistory.trustedEvents.map((event) => ({
          atMs: roundMs(event.atMs),
          testId: event.testId == null ? null : String(event.testId).slice(0, 120),
          href: event.href,
        }))
      : [],
  };
}

function compactPreferenceEvents(result) {
  const events = result?.trace?.measurement?.preferenceIntentTiming?.events;
  if (!Array.isArray(events)) return [];
  return events.map((event) => ({
    sequence: event.sequence,
    bodyShape: event.bodyShape,
    intentKeys: Array.isArray(event.intentKeys) ? event.intentKeys : [],
    intentClass: event.intentClass,
    requestStartedAtMs: roundMs(event.requestStartedAtMs),
    responseHeaderAtMs: roundMs(event.responseHeaderAtMs),
    bodyFinishedAtMs: roundMs(event.bodyFinishedAtMs),
    settledAtMs: roundMs(event.settledAtMs),
    status: event.status,
    failed: event.failed === true,
    failureReason: event.failureReason,
    routeAtRequestStart: event.routeAtRequestStart,
    routeAtResponseHeader: event.routeAtResponseHeader,
    routeAtBodyFinished: event.routeAtBodyFinished,
    routeAtSettled: event.routeAtSettled,
  }));
}

function compactFormsRequests(result) {
  const records = result?.trace?.actions?.first?.requiredRequestTimings;
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    startedAtMs: roundMs(record.startedAtMs),
    responseHeaderAtMs: roundMs(record.responseHeaderAtMs),
    bodyFinishedAtMs: roundMs(record.bodyFinishedAtMs),
    status: record.status,
    failed: record.failed === true,
    failureReason: record.failureReason,
  }));
}

function correlatePreferenceEvents(result) {
  const preferences = compactPreferenceEvents(result);
  const routes = compactRouteHistory(result).events;
  const lifecycle = compactLifecycleEvents(result);
  const forms = compactFormsRequests(result);
  return preferences.map((event) => {
    const start = event.requestStartedAtMs ?? 0;
    const settle = event.settledAtMs ?? event.bodyFinishedAtMs ?? event.responseHeaderAtMs ?? start;
    const windowEnd = settle + 2_000;
    const routeTransitionsAfterStart = routes
      .filter((route) => route.atMs != null && route.atMs >= start && route.atMs <= windowEnd)
      .slice(0, 8);
    const lifecycleAfterStart = lifecycle
      .filter((item) => item.atMs != null && item.atMs >= start && item.atMs <= windowEnd)
      .slice(0, 12);
    const formsAfterStart = forms.filter((record) =>
      record.startedAtMs != null && record.startedAtMs >= start && record.startedAtMs <= windowEnd,
    );
    return {
      ...event,
      correlationWindowEndAtMs: windowEnd,
      routeTransitionsAfterStart,
      lifecycleEventsAfterStart: lifecycleAfterStart,
      formsRequestsAfterStart: formsAfterStart,
      temporalRelations: {
        routeTransitionBeforePreferenceSettled: routeTransitionsAfterStart.some(
          (route) => route.atMs <= settle,
        ),
        cleanupBeforePreferenceSettled: lifecycleAfterStart.some(
          (item) => item.name === "stage6_workspace_effect_cleanup" && item.atMs <= settle,
        ),
        formsAbortAfterPreferenceRequest: formsAfterStart.some(
          (record) => record.failed && record.failureReason === "net::ERR_ABORTED",
        ),
      },
    };
  });
}

function compactResult(result) {
  const preferenceEvents = correlatePreferenceEvents(result);
  const lifecycleEvents = compactLifecycleEvents(result);
  return {
    unitKey: result.unitKey,
    mode: result.mode,
    journeyId: result.journeyId,
    repetition: result.repetition,
    status: result.status,
    validSample: result.validSample,
    observationValidity: result.observationValidity,
    functionalOutcome: result.functionalOutcome,
    failureBoundary: result.failureBoundary,
    trace: {
      traceVariant: result.trace?.traceVariant ?? null,
      routeHistory: compactRouteHistory(result),
      preferenceIntentTiming: {
        traceVariant:
          result.trace?.measurement?.preferenceIntentTiming?.traceVariant ?? null,
        requestCount:
          result.trace?.measurement?.preferenceIntentTiming?.requestCount ?? 0,
        bodyFinishTimedOut:
          result.trace?.measurement?.preferenceIntentTiming?.bodyFinishTimedOut === true,
        events: preferenceEvents,
      },
      lifecycleEvents,
      formsRequests: compactFormsRequests(result),
      firstAction: {
        functionalOutcome: result.trace?.actions?.first?.functionalOutcome ?? null,
        requiredRequestStartAtMs: result.trace?.actions?.first?.requiredRequestStartAtMs ?? null,
        responseHeaderAtMs: result.trace?.actions?.first?.responseHeaderAtMs ?? null,
        responseBodyFinishedAtMs: result.trace?.actions?.first?.responseBodyFinishedAtMs ?? null,
      },
    },
  };
}

function summaryForResults(results) {
  const samples = results.map(compactResult);
  const preferenceEvents = samples.flatMap(
    (sample) => sample.trace.preferenceIntentTiming.events,
  );
  const intentClassCounts = Object.fromEntries(
    [...new Set(preferenceEvents.map((event) => event.intentClass))]
      .sort()
      .map((intentClass) => [
        intentClass,
        preferenceEvents.filter((event) => event.intentClass === intentClass).length,
      ]),
  );
  return {
    attempted: samples.length,
    observationValid: samples.filter((sample) => sample.observationValidity === "VALID").length,
    validFunctionalSamples: samples.filter((sample) => sample.validSample === true).length,
    functionalSuccess: samples.filter((sample) => sample.functionalOutcome === "SUCCESS").length,
    preferencePatchCount: preferenceEvents.length,
    intentClassCounts,
    eventsWithRouteTransitionBeforePreferenceSettled: preferenceEvents.filter(
      (event) => event.temporalRelations.routeTransitionBeforePreferenceSettled,
    ).length,
    eventsWithStage6CleanupBeforePreferenceSettled: preferenceEvents.filter(
      (event) => event.temporalRelations.cleanupBeforePreferenceSettled,
    ).length,
    eventsWithFormsAbortAfterPreferenceRequest: preferenceEvents.filter(
      (event) => event.temporalRelations.formsAbortAfterPreferenceRequest,
    ).length,
    traceVariant: PREFERENCE_INTENT_TRACE_VARIANT,
  };
}

export function buildPreferenceIntentEvidence(result) {
  const samples = (result.results ?? []).map(compactResult);
  const summary = summaryForResults(result.results ?? []);
  return {
    evidenceId: result.runId,
    generatedAt: new Date().toISOString(),
    planRevision: PREFERENCE_INTENT_PLAN_REVISION,
    stage: "shared-runtime-j1-preference-intent-timing",
    status: result.status,
    outcome: result.outcome,
    runId: result.runId,
    sourceIdentity: result.sourceIdentity,
    checkpoint: {
      phaseId: PREFERENCE_INTENT_PHASE_ID,
      schemaVersion: PREFERENCE_INTENT_SCHEMA_VERSION,
      officialMeasurement: false,
      countedAsOfficialSample: false,
      localSupabase: "127.0.0.1:54321",
    },
    preflight: result.preflight ?? null,
    summary,
    samples,
    findings: {
      candidateSurface: [
        "app/src/components/dashboard-app.tsx:selectClient/openClientTask",
        "app/src/lib/phase-85-stage-6-client-selection.ts:persistActiveClient",
        "app/src/components/dashboard/shell-provider.tsx:commitDashboardHref",
        "app/src/lib/phase-85-stage-5-shell-preference-coordinator.ts:update",
        "app/src/lib/use-stage-6-client-workspace.ts:cleanup/load_aborted",
      ],
      candidateNarrowed: false,
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      productionDecision: "NO-GO",
    },
    explicitNonClaims: [
      "This trace-only capture is outside the official nine-scenario baseline.",
      "The trace records intent keys only; preference values and raw request bodies are excluded.",
      "Observed temporal correlation is not causal proof or runtime-fix acceptance.",
      "No external provider, WhatsApp, billing, production worker, migration, deploy, or real health-data path was used.",
    ],
    closure: {
      status: result.status,
      outcome: result.outcome,
      runtimeFixAccepted: false,
      plan2Eligible: false,
      nextAction:
        "Classify whether one sanitized preference intent and transition ordering repeats across valid J1 traces before any new control or code change.",
    },
  };
}

async function runCapture({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = checkpointIdentity({
    baseUrl: normalizedBaseUrl,
    configuration,
    source,
  });
  const opened = openPhaseRun({
    root: PREFERENCE_INTENT_CHECKPOINT_ROOT,
    phaseId: PREFERENCE_INTENT_PHASE_ID,
    phaseSchemaVersion: PREFERENCE_INTENT_SCHEMA_VERSION,
    identity,
    metadata: {
      identitySummary: {
        phaseId: PREFERENCE_INTENT_PHASE_ID,
        sourceHead: source.head,
        sourceVariant: identity.sourceVariant,
        officialMeasurement: false,
      },
      contract: identity,
      countedAsOfficialSample: false,
    },
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: PREFERENCE_INTENT_CHECKPOINT_ROOT,
      phaseId: PREFERENCE_INTENT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "PREFERENCE_INTENT_TIMING_CAPTURE_RECORDED",
      sourceIdentity: source,
      preflight: null,
      results: completedResults(persisted.events),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      outcome: "PREFERENCE_INTENT_CHECKPOINT_NOT_RUN",
      sourceIdentity: source,
      preflight: null,
      results: [],
    };
  }

  const checkpoint = opened.run;
  const j1 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J1");
  let serverHandle = null;
  let browser = null;
  const results = completedResults(checkpoint.events);
  checkpoint.append("diagnostic.contract.bound", {
    phaseId: PREFERENCE_INTENT_PHASE_ID,
    schemaVersion: PREFERENCE_INTENT_SCHEMA_VERSION,
    traceVariant: PREFERENCE_INTENT_TRACE_VARIANT,
    journeyId: "J1",
    repetitions: PREFERENCE_INTENT_REPETITIONS,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  });
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
    checkpoint.markStatus("BLOCKED", { reason: "preference_intent_preflight_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "PREFERENCE_INTENT_PREFLIGHT_BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
    };
  }

  try {
    const buildEnvironment = buildPhase44ServerEnvironment(
      configuration.environment,
      "normal",
      { baseUrl: normalizedBaseUrl, localStatus },
    );
    if (!existsSync(nextCliPath)) throw new Error("preference_intent_next_cli_missing");
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
      outputRecorded: false,
    }, { status: build.status === 0 ? "RUNNING" : "BLOCKED" });
    if (build.status !== 0) throw new Error("preference_intent_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    for (let repetition = 1; repetition <= PREFERENCE_INTENT_REPETITIONS; repetition += 1) {
      const unitKey = `J1:r${repetition}`;
      if (results.some((result) => result.unitKey === unitKey)) continue;
      const result = await runMeasurementUnit({
        browser,
        baseUrl: normalizedBaseUrl,
        mode: "normal",
        journey: j1,
        repetition,
        unitKey,
        scope: "j1_preference_intent_timing",
        email: configuration.email,
        password: configuration.password,
        controlVariant: null,
        traceVariant: PREFERENCE_INTENT_TRACE_VARIANT,
        checkpoint,
      });
      results.push(result);
    }
    const complete = results.length === PREFERENCE_INTENT_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete
        ? "preference_intent_timing_capture_completed"
        : "preference_intent_timing_capture_incomplete",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: complete ? "COMPLETE" : "BLOCKED",
      outcome: complete
        ? "PREFERENCE_INTENT_TIMING_CAPTURE_RECORDED"
        : "PREFERENCE_INTENT_TIMING_CAPTURE_INCOMPLETE",
      sourceIdentity: source,
      preflight,
      results,
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "preference_intent_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "PREFERENCE_INTENT_RUNNER_BLOCKED",
      runtimeError: String(error?.message || "preference_intent_runner_failed").slice(0, 160),
      sourceIdentity: source,
      preflight,
      results,
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
    baseUrl: process.env.AIYA_PREFERENCE_INTENT_BASE_URL || PREFERENCE_INTENT_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`preference_intent_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: PREFERENCE_INTENT_CHECKPOINT_ROOT,
      phaseId: PREFERENCE_INTENT_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 preference intent timing capture ready. Use --run explicitly.\n");
    return;
  }
  const result = await runCapture({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
  });
  const evidence = buildPreferenceIntentEvidence(result);
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
