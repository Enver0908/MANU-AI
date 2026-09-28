#!/usr/bin/env node

/**
 * Trace-only J1 continuation for isolating the Stage 6 route/state trigger
 * that can precede a Forms request abort.
 *
 * The runner uses the existing diagnostic journey and local normal fixture.
 * It records no client identifiers, request bodies, credentials, or health
 * data, never enters the official baseline, and changes no runtime behavior.
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

export const TRIGGER_ISOLATION_PHASE_ID =
  "aiya-performance-plan1-j1-stage6-trigger-isolation-v1";
export const TRIGGER_ISOLATION_SCHEMA_VERSION = TRIGGER_ISOLATION_PHASE_ID;
export const TRIGGER_ISOLATION_PLAN_REVISION = "plan1-final-v3";
export const TRIGGER_ISOLATION_BASE_URL = "http://127.0.0.1:3154";
export const TRIGGER_ISOLATION_REPETITIONS = 3;
export const TRIGGER_ISOLATION_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const TRIGGER_ISOLATION_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";

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

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-stage6-trigger-isolation.mjs",
    "app/src/components/dashboard-app.tsx",
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/components/dashboard/client-workspace.tsx",
    "app/src/lib/phase-85-stage-4b-dashboard-routing.ts",
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

function normalizeBaseUrl(value) {
  const url = new URL(value || TRIGGER_ISOLATION_BASE_URL);
  if (!url.port) url.port = "3154";
  return url.origin;
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
    if (handle.server.exitCode != null) throw new Error("trigger_isolation_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next may still be binding or loading the production artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("trigger_isolation_server_timeout");
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

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("trigger_isolation_run_id_invalid");
  }
  return join(repoRoot, `${TRIGGER_ISOLATION_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
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

function routeStateFromEvent(event) {
  return {
    pathname: event?.routePathname ?? null,
    section: event?.routeSection ?? null,
    clientTask: event?.routeClientTask ?? null,
    hasClientId: event?.routeHasClientId === true,
  };
}

function routeStateComplete(state) {
  return Boolean(
    state &&
      typeof state.pathname === "string" &&
      (state.section == null || typeof state.section === "string") &&
      (state.clientTask == null || typeof state.clientTask === "string") &&
      typeof state.hasClientId === "boolean",
  );
}

function stage6LifecycleEvents(sample) {
  return (sample?.trace?.measurement?.longTasks?.phase55Events ?? [])
    .filter((event) => String(event?.name ?? "").startsWith("stage6_workspace_"))
    .map((event) => ({
      name: event.name,
      atPerformanceMs: event.atPerformanceMs,
      domain: event.domain ?? null,
      sequence: event.sequence ?? null,
      route: routeStateFromEvent(event),
    }));
}

function formsRequestRecords(sample) {
  return (sample?.trace?.requiredRequests ?? []).filter((record) =>
    String(record?.route ?? "").includes("/forms"),
  );
}

function hasFormsAbort(sample) {
  return formsRequestRecords(sample).some(
    (record) => record?.failed === true || record?.failureReason === "net::ERR_ABORTED",
  );
}

function setupSequence(events) {
  return events
    .filter((event) => event.name === "stage6_workspace_effect_setup" && event.route.hasClientId)
    .map((event) => `${event.domain}:${event.route.section}:${event.route.clientTask ?? "none"}`);
}

function analyzeSamples(samples) {
  const perSample = samples.map((sample) => {
    const events = stage6LifecycleEvents(sample);
    const complete = events.every((event) => routeStateComplete(event.route));
    const abort = hasFormsAbort(sample);
    return {
      unitKey: sample.unitKey,
      repetition: sample.repetition,
      observationValidity: sample.observationValidity,
      functionalOutcome: sample.functionalOutcome,
      validSample: sample.validSample === true,
      formsAbort: abort,
      formsRequestCount: formsRequestRecords(sample).length,
      routeStateCapture: complete ? "COMPLETE" : "INCOMPLETE",
      setupSequence: setupSequence(events),
      lifecycle: events,
    };
  });
  const observationValid = perSample.filter((sample) => sample.observationValidity === "VALID");
  const completeCapture = observationValid.filter((sample) => sample.routeStateCapture === "COMPLETE");
  const abortSamples = completeCapture.filter((sample) => sample.formsAbort);
  const signatureCounts = new Map();
  for (const sample of abortSamples) {
    const signature = sample.setupSequence.join(" > ") || "<empty>";
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  }
  const signatures = [...signatureCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([signature, count]) => ({ signature, count }));
  let outcome = "TRIGGER_ISOLATION_CAPTURE_INCOMPLETE";
  if (completeCapture.length === TRIGGER_ISOLATION_REPETITIONS) {
    if (abortSamples.length === TRIGGER_ISOLATION_REPETITIONS && signatures.length === 1) {
      outcome = "TRIGGER_PATTERN_OBSERVED_NOT_CAUSAL";
    } else if (abortSamples.length === 0) {
      outcome = "TRIGGER_NOT_REPRODUCED_ROUTE_STATE_CAPTURE_VALID";
    } else {
      outcome = "TRIGGER_ISOLATION_INCONCLUSIVE";
    }
  }
  return {
    outcome,
    perSample,
    counts: {
      attempted: samples.length,
      observationValid: observationValid.length,
      completeRouteStateCapture: completeCapture.length,
      formsAbort: abortSamples.length,
      validFunctional: samples.filter((sample) => sample.validSample === true).length,
    },
    abortSetupSignatures: signatures,
  };
}

function buildEvidence(result) {
  const analysis = analyzeSamples(result.results ?? []);
  const blockers = [...new Set([
    ...(result.preflight?.blockers ?? []),
    ...(result.runtimeError ? [result.runtimeError] : []),
  ].filter(Boolean))];
  return sanitizePhase44Evidence({
    schemaVersion: "aiya-performance-plan1-v3-j1-stage6-trigger-isolation-v1",
    planRevision: TRIGGER_ISOLATION_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-stage6-trigger-isolation",
    stageId: TRIGGER_ISOLATION_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt: new Date().toISOString(),
    status: result.status,
    outcome: analysis.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Isolate the route/state transition that precedes a Stage 6 Forms request abort.",
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      countedAsOfficialSample: false,
      externalOperations: [],
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: TRIGGER_ISOLATION_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      currentStage: TRIGGER_ISOLATION_PHASE_ID,
    },
    sourceIdentity: result.sourceIdentity,
    checkpoint: {
      phaseId: TRIGGER_ISOLATION_PHASE_ID,
      schemaVersion: TRIGGER_ISOLATION_SCHEMA_VERSION,
      executionMode: "diagnostic",
      journeyId: "J1",
      repetitions: TRIGGER_ISOLATION_REPETITIONS,
      fixtureId: "local-normal",
      localSupabase: "127.0.0.1:54321",
      officialMeasurement: false,
      countedAsOfficialSample: false,
    },
    preflight: result.preflight ?? null,
    sampleSummary: analysis.counts,
    routeStateAnalysis: {
      capturedFields: ["pathname", "section", "clientTask", "hasClientId"],
      transitionUnit: "stage6_workspace_effect_setup sequence per observation",
      perSample: analysis.perSample.map((sample) => ({
        unitKey: sample.unitKey,
        repetition: sample.repetition,
        observationValidity: sample.observationValidity,
        functionalOutcome: sample.functionalOutcome,
        validSample: sample.validSample,
        formsAbort: sample.formsAbort,
        formsRequestCount: sample.formsRequestCount,
        routeStateCapture: sample.routeStateCapture,
        setupSequence: sample.setupSequence,
        lifecycle: sample.lifecycle,
      })),
      abortSetupSignatures: analysis.abortSetupSignatures,
    },
    samples: result.results ?? [],
    blockers,
    interpretation: {
      routeStateCaptureIsObservational: true,
      triggerReproducibilityRequiresThreeMatchingValidRecords: true,
      rootCauseConfirmed: analysis.outcome === "TRIGGER_PATTERN_OBSERVED_NOT_CAUSAL" ? false : false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      conclusion:
        analysis.outcome === "TRIGGER_PATTERN_OBSERVED_NOT_CAUSAL"
          ? "A repeated route/state sequence was observed alongside Forms aborts, but no causal or single-variable confirmation was run."
          : "The route/state capture does not establish a reproducible Forms-abort trigger in this continuation.",
    },
    explicitNonClaims: [
      "This trace-only continuation is outside the official nine-scenario baseline.",
      "A Forms abort remains a lifecycle observation, not proof that route state caused the abort.",
      "No performance fix, root-cause closure, Plan 2 entry, or production readiness change is claimed.",
      "No external provider, WhatsApp, billing, production worker, migration, deploy, or real health-data path was used.",
    ],
    closure: {
      status: result.status,
      outcome: analysis.outcome,
      runtimeFixAccepted: false,
      plan2Eligible: false,
      nextAction:
        analysis.outcome === "TRIGGER_PATTERN_OBSERVED_NOT_CAUSAL"
          ? "Obtain separate authorization for one reversible single-variable confirmation of the repeated route/state transition; do not change runtime behavior in this evidence."
          : "Preserve this route-state capture and do not repeat the same matched run automatically; isolate a distinct reproducible trigger or obtain a controlled operator capture.",
    },
  });
}

async function runCapture({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = {
    planRevision: TRIGGER_ISOLATION_PLAN_REVISION,
    phaseId: TRIGGER_ISOLATION_PHASE_ID,
    phaseSchemaVersion: TRIGGER_ISOLATION_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: normalizedBaseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_stage6_route_state_trigger_isolation_trace_only",
    journeyId: "J1",
    repetitions: TRIGGER_ISOLATION_REPETITIONS,
    executionMode: "diagnostic",
    localConfigurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  };
  const opened = openPhaseRun({
    root: TRIGGER_ISOLATION_CHECKPOINT_ROOT,
    phaseId: TRIGGER_ISOLATION_PHASE_ID,
    phaseSchemaVersion: TRIGGER_ISOLATION_SCHEMA_VERSION,
    identity,
    metadata: { contract: identity, countedAsOfficialSample: false },
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: TRIGGER_ISOLATION_CHECKPOINT_ROOT,
      phaseId: TRIGGER_ISOLATION_PHASE_ID,
      runId: opened.manifest.runId,
    });
    const results = completedResults(persisted.events);
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      sourceIdentity: source,
      preflight: null,
      results,
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight: null,
      results: [],
      runtimeError: "trigger_isolation_checkpoint_not_run",
    };
  }

  const checkpoint = opened.run;
  const results = completedResults(checkpoint.events);
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
    checkpoint.markStatus("BLOCKED", { reason: "trigger_isolation_preflight_blocked" });
    checkpoint.close();
    return { runId: checkpoint.runId, status: "BLOCKED", sourceIdentity: source, preflight, results };
  }

  let serverHandle = null;
  let browser = null;
  try {
    const buildEnvironment = buildPhase44ServerEnvironment(configuration.environment, "diagnostic", {
      baseUrl: normalizedBaseUrl,
      localStatus,
    });
    if (!existsSync(nextCliPath)) throw new Error("trigger_isolation_next_cli_missing");
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
    if (build.status !== 0) throw new Error("trigger_isolation_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
    for (let repetition = 1; repetition <= TRIGGER_ISOLATION_REPETITIONS; repetition += 1) {
      const unitKey = `diagnostic:J1:r${repetition}`;
      if (results.some((result) => result.unitKey === unitKey)) continue;
      results.push(await runMeasurementUnit({
        browser,
        baseUrl: normalizedBaseUrl,
        mode: "diagnostic",
        journey,
        repetition,
        unitKey,
        scope: "j1_stage6_route_state_trigger_isolation",
        email: configuration.email,
        password: configuration.password,
        checkpoint,
      }));
    }
    const complete = results.length === TRIGGER_ISOLATION_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete
        ? "j1_stage6_trigger_isolation_completed"
        : "j1_stage6_trigger_isolation_incomplete",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: complete ? "COMPLETE" : "BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "trigger_isolation_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
      runtimeError: String(error?.message || "trigger_isolation_runner_failed").slice(0, 160),
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
    baseUrl: process.env.AIYA_TRIGGER_ISOLATION_BASE_URL || TRIGGER_ISOLATION_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`trigger_isolation_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: TRIGGER_ISOLATION_CHECKPOINT_ROOT,
      phaseId: TRIGGER_ISOLATION_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Stage 6 trigger-isolation diagnostic ready. Use --run explicitly.\n");
    return;
  }
  const result = await runCapture({ baseUrl: options.baseUrl, newRun: options.newRun });
  const evidence = buildEvidence(result);
  if (options.writeEvidence && result.runId) {
    const path = phaseEvidencePath(result.runId);
    writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({
      runId: result.runId,
      status: result.status,
      outcome: evidence.outcome,
      evidencePath: path.replaceAll("\\", "/").replace(`${repoRoot.replaceAll("\\", "/")}/`, ""),
      sampleSummary: evidence.sampleSummary,
      abortSetupSignatures: evidence.routeStateAnalysis.abortSetupSignatures,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    runId: result.runId,
    status: result.status,
    outcome: evidence.outcome,
    sampleSummary: evidence.sampleSummary,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
