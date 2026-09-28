#!/usr/bin/env node

/**
 * Trace-only J1 A-B-A confirmation for the late initial-summary navigation
 * candidate. A1 and A2 use the existing timing. B adds one harness-only gate
 * that waits for the client-selection summary navigation request to settle
 * before the Forms click. No product scheduling or route behavior is changed.
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
  PHASE_4_3_CONTROL_VARIANTS,
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

export const SUMMARY_REENTRY_PHASE_ID =
  "aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-v1";
export const SUMMARY_REENTRY_SCHEMA_VERSION = SUMMARY_REENTRY_PHASE_ID;
export const SUMMARY_REENTRY_PLAN_REVISION = "plan1-final-v3";
export const SUMMARY_REENTRY_BASE_URL = "http://127.0.0.1:3155";
export const SUMMARY_REENTRY_REPETITIONS = 3;
export const SUMMARY_REENTRY_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const SUMMARY_REENTRY_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const SUMMARY_REENTRY_GROUPS = Object.freeze([
  Object.freeze({ id: "A1", controlVariant: null }),
  Object.freeze({
    id: "B",
    controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitInitialSummaryNavigation,
  }),
  Object.freeze({ id: "A2", controlVariant: null }),
]);

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
  const url = new URL(value || SUMMARY_REENTRY_BASE_URL);
  if (!url.port) url.port = "3155";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("summary_reentry_run_id_invalid");
  }
  return join(repoRoot, `${SUMMARY_REENTRY_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-summary-reentry-settlement-confirmation.mjs",
    "app/src/components/dashboard-app.tsx",
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/lib/phase-85-stage-6-client-selection.ts",
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
    planRevision: SUMMARY_REENTRY_PLAN_REVISION,
    phaseId: SUMMARY_REENTRY_PHASE_ID,
    phaseSchemaVersion: SUMMARY_REENTRY_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_initial_summary_navigation_settlement_a_b_a",
    controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitInitialSummaryNavigation,
    journeyId: "J1",
    groupOrder: SUMMARY_REENTRY_GROUPS.map((group) => group.id),
    repetitionsPerGroup: SUMMARY_REENTRY_REPETITIONS,
    serverControl: "one_managed_diagnostic_server",
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
    if (handle.server.exitCode != null) throw new Error("summary_reentry_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next may still be binding or loading the production artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("summary_reentry_server_timeout");
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

function groupForUnitKey(unitKey) {
  return SUMMARY_REENTRY_GROUPS.find((group) =>
    String(unitKey ?? "").startsWith(`${group.id}:J1:r`),
  )?.id ?? null;
}

function isSummaryRoute(route) {
  try {
    const url = new URL(String(route), "http://phase43.local");
    return (
      url.pathname === "/dashboard" &&
      url.searchParams.get("section") === "clients" &&
      url.searchParams.has("clientId") &&
      !url.searchParams.has("clientTask")
    );
  } catch {
    return false;
  }
}

function routeAfterForms(result) {
  const events = result?.trace?.measurement?.routeHistory?.events;
  if (!Array.isArray(events)) return { formsRouteAtMs: null, summaryRouteAfterForms: false };
  const formsIndex = events.findIndex((event) => String(event.route).includes("clientTask=forms"));
  if (formsIndex < 0) return { formsRouteAtMs: null, summaryRouteAfterForms: false };
  const summaryEvent = events.slice(formsIndex + 1).find((event) => isSummaryRoute(event.route));
  return {
    formsRouteAtMs: events[formsIndex].atMs ?? null,
    summaryRouteAfterForms: Boolean(summaryEvent),
    summaryRouteAfterFormsAtMs: summaryEvent?.atMs ?? null,
  };
}

function formsRequests(result) {
  return (result?.trace?.requiredRequests ?? []).filter((record) =>
    String(record?.route ?? "").includes("/forms"),
  );
}

function formsRequestAbort(result) {
  return formsRequests(result).some(
    (record) => record?.failed === true || record?.failureReason === "net::ERR_ABORTED",
  );
}

function lifecycleEvents(result) {
  return (result?.trace?.measurement?.longTasks?.phase55Events ?? [])
    .filter((event) => String(event?.name ?? "").startsWith("stage6_workspace_"))
    .map((event) => ({
      name: event.name,
      domain: event.domain ?? null,
      sequence: event.sequence ?? null,
    }));
}

function formsLifecycleAbort(result) {
  return lifecycleEvents(result).some(
    (event) => event.name === "stage6_workspace_load_aborted" && event.domain === "forms",
  );
}

function secondActionTailMs(result) {
  const second = result?.trace?.actions?.second;
  const trusted = finite(second?.trustedEventAtMs);
  const ready = finite(second?.readyStateAtMs);
  return trusted != null && ready != null ? roundMs(ready - trusted) : null;
}

function compactResult(result) {
  return {
    unitKey: result.unitKey,
    repetition: result.repetition,
    group: groupForUnitKey(result.unitKey),
    controlVariant: result.trace?.controlVariant ?? null,
    status: result.status,
    validSample: result.validSample,
    observationValidity: result.observationValidity,
    functionalOutcome: result.functionalOutcome,
    performanceOutcome: result.performanceOutcome,
    routeAfterForms: routeAfterForms(result),
    formsRequestCount: formsRequests(result).length,
    formsRequestAbort: formsRequestAbort(result),
    formsLifecycleAbort: formsLifecycleAbort(result),
    lifecycleEvents: lifecycleEvents(result),
    summarySettlementControl: result.trace?.control ?? null,
    secondActionTailMs: secondActionTailMs(result),
  };
}

function summarizeGroup(results, group) {
  const groupResults = results.filter((result) => groupForUnitKey(result.unitKey) === group.id);
  return {
    group: group.id,
    controlVariant: group.controlVariant,
    attempted: groupResults.length,
    planned: SUMMARY_REENTRY_REPETITIONS,
    observationValid: groupResults.filter((result) => result.observationValidity === "VALID").length,
    validFunctional: groupResults.filter((result) => result.validSample === true).length,
    functionalSuccess: groupResults.filter((result) => result.functionalOutcome === "SUCCESS").length,
    summaryRouteAfterForms: groupResults.filter((result) => routeAfterForms(result).summaryRouteAfterForms).length,
    formsRequestAbort: groupResults.filter(formsRequestAbort).length,
    formsLifecycleAbort: groupResults.filter(formsLifecycleAbort).length,
    controlPassed: groupResults.filter((result) => result.trace?.control?.status === "PASSED").length,
    secondActionTailMs: groupResults.map(secondActionTailMs),
  };
}

function analyzeResults(results) {
  const groups = SUMMARY_REENTRY_GROUPS.map((group) => summarizeGroup(results, group));
  const planned = SUMMARY_REENTRY_GROUPS.length * SUMMARY_REENTRY_REPETITIONS;
  const complete = results.length === planned && groups.every((group) => group.attempted === group.planned);
  const allObservationValid = groups.every((group) => group.observationValid === group.planned);
  const allFunctional = groups.every((group) => group.validFunctional === group.planned);
  const a1 = groups.find((group) => group.group === "A1");
  const b = groups.find((group) => group.group === "B");
  const a2 = groups.find((group) => group.group === "A2");
  const baselineSummaryReentry = (a1?.summaryRouteAfterForms ?? 0) + (a2?.summaryRouteAfterForms ?? 0);
  const baselineFormsAbort = (a1?.formsRequestAbort ?? 0) + (a2?.formsRequestAbort ?? 0);
  const reproduced = Boolean(
    complete &&
      allObservationValid &&
      allFunctional &&
      a1?.summaryRouteAfterForms === 3 &&
      a2?.summaryRouteAfterForms === 3 &&
      baselineFormsAbort >= 3 &&
      b?.controlPassed === 3 &&
      b?.summaryRouteAfterForms === 0 &&
      b?.formsRequestAbort === 0 &&
      b?.formsLifecycleAbort === 0,
  );
  return {
    outcome: !complete || !allObservationValid || !allFunctional
      ? "SUMMARY_REENTRY_CONFIRMATION_CAPTURE_INCOMPLETE"
      : reproduced
        ? "SUMMARY_REENTRY_BOUNDARY_REPRODUCED_CANDIDATE"
        : "SUMMARY_REENTRY_BOUNDARY_CONFIRMATION_INCONCLUSIVE",
    counts: {
      attempted: results.length,
      planned,
      observationValid: results.filter((result) => result.observationValidity === "VALID").length,
      validFunctional: results.filter((result) => result.validSample === true).length,
      officialBaselineSamples: 0,
    },
    groups,
    comparison: {
      baselineSummaryReentry: `${baselineSummaryReentry}/6 A1+A2 samples`,
      baselineFormsRequestAbort: `${baselineFormsAbort}/6 A1+A2 samples`,
      controlSummaryReentry: `${b?.summaryRouteAfterForms ?? 0}/3 B samples`,
      controlFormsRequestAbort: `${b?.formsRequestAbort ?? 0}/3 B samples`,
      controlFormsLifecycleAbort: `${b?.formsLifecycleAbort ?? 0}/3 B samples`,
      speedResult: "SECOND_ACTION_TAIL_CAPTURED_NOT_EVALUABLE_FOR_PERFORMANCE_ACCEPTANCE",
    },
    reproduced,
  };
}

function buildEvidence(result) {
  const analysis = analyzeResults(result.results ?? []);
  const blockers = [...new Set([
    ...(result.preflight?.blockers ?? []),
    ...(result.runtimeError ? [result.runtimeError] : []),
  ].filter(Boolean))];
  return sanitizePhase44Evidence({
    schemaVersion: "aiya-performance-plan1-v3-j1-summary-reentry-settlement-confirmation-v1",
    planRevision: SUMMARY_REENTRY_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-summary-reentry-settlement-confirmation",
    stageId: SUMMARY_REENTRY_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt: new Date().toISOString(),
    status: result.status,
    outcome: analysis.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Trace-only local desktop J1 A-B-A confirmation of the late initial-summary navigation candidate.",
      officialMeasurementStarted: false,
      causalExperimentStarted: true,
      runtimeChangeAcceptedAsFix: false,
      controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitInitialSummaryNavigation,
      groupOrder: SUMMARY_REENTRY_GROUPS.map((group) => group.id),
      repetitionsPerGroup: SUMMARY_REENTRY_REPETITIONS,
      countedAsOfficialSample: false,
      externalOperations: [],
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: SUMMARY_REENTRY_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      currentStage: SUMMARY_REENTRY_PHASE_ID,
    },
    sourceIdentity: result.sourceIdentity,
    parentEvidenceReferences: [
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-analysis-20260921T131935Z-e026a6cf-2f81-4bdd-82c2-c0dfefb19c31_EVIDENCE.json",
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-active-client-preference-route-correlation-20260921T085203Z-862ac27d-4543-486f-b1eb-f7d6f6fbce9a_EVIDENCE.json",
    ],
    measurementIdentity: {
      fixtureId: "local-normal",
      fixtureClass: "synthetic_normal_owner",
      storePath: "normal_rls_api_path_required",
      localSupabaseHost: "127.0.0.1:54321",
      journeyId: "J1",
      mode: "diagnostic",
      secondActionDelayMs: 2_000,
      serverControl: "one_managed_diagnostic_server",
      officialMeasurement: false,
      groups: SUMMARY_REENTRY_GROUPS.map((group) => ({
        id: group.id,
        controlVariant: group.controlVariant,
        repetitions: SUMMARY_REENTRY_REPETITIONS,
      })),
    },
    sampleSummary: {
      ...analysis.counts,
      byGroup: analysis.groups,
    },
    comparison: analysis.comparison,
    results: (result.results ?? []).map(compactResult),
    blockers,
    interpretation: {
      singleVariable: "B waits for initial client-selection summary navigation request settlement before Forms click",
      rootCauseConfirmed: false,
      candidateBoundaryReproduced: analysis.reproduced,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      functionalResult: "Report per-group observation and functional validity separately from speed.",
      speedResult: "Second-action tails are captured, but this diagnostic run is not a performance acceptance run.",
    },
    explicitNonClaims: [
      "This trace-only A-B-A confirmation is outside the official nine-scenario baseline.",
      "The B settlement gate is a harness control, not a product change or accepted fix.",
      "A reproduced route boundary does not prove the global freeze thesis or auth as the root cause.",
      "No finding disposition, Plan 2 eligibility, or production decision changes here.",
      "No external provider, WhatsApp, billing, production worker, migration, deploy, or real health-data path was used.",
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
      runtimeFixAccepted: false,
      plan2Eligible: false,
      nextAction: analysis.reproduced
        ? "Retain the boundary as a contributing candidate only; no runtime fix is accepted and global performance remains unresolved."
        : "Preserve the A-B-A result and do not repeat the same gate automatically; global diagnosis remains blocked.",
      productionDecision: "NO-GO",
    },
  });
}

async function runCapture({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = checkpointIdentity({ baseUrl: normalizedBaseUrl, configuration, source });
  const opened = openPhaseRun({
    root: SUMMARY_REENTRY_CHECKPOINT_ROOT,
    phaseId: SUMMARY_REENTRY_PHASE_ID,
    phaseSchemaVersion: SUMMARY_REENTRY_SCHEMA_VERSION,
    identity,
    metadata: { contract: identity, countedAsOfficialSample: false },
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: SUMMARY_REENTRY_CHECKPOINT_ROOT,
      phaseId: SUMMARY_REENTRY_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      sourceIdentity: source,
      preflight: null,
      results: completedResults(persisted.events),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      sourceIdentity: source,
      preflight: null,
      results: [],
      runtimeError: "summary_reentry_checkpoint_not_run",
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
    checkpoint.markStatus("BLOCKED", { reason: "summary_reentry_preflight_blocked" });
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
    if (!existsSync(nextCliPath)) throw new Error("summary_reentry_next_cli_missing");
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
    if (build.status !== 0) throw new Error("summary_reentry_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
    for (const group of SUMMARY_REENTRY_GROUPS) {
      for (let repetition = 1; repetition <= SUMMARY_REENTRY_REPETITIONS; repetition += 1) {
        const unitKey = `${group.id}:J1:r${repetition}`;
        if (results.some((result) => result.unitKey === unitKey)) continue;
        results.push(await runMeasurementUnit({
          browser,
          baseUrl: normalizedBaseUrl,
          mode: "diagnostic",
          journey,
          repetition,
          unitKey,
          scope: `j1_summary_reentry_${group.id.toLowerCase()}`,
          email: configuration.email,
          password: configuration.password,
          controlVariant: group.controlVariant,
          checkpoint,
        }));
      }
    }
    const complete = results.length === SUMMARY_REENTRY_GROUPS.length * SUMMARY_REENTRY_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete ? "summary_reentry_confirmation_completed" : "summary_reentry_confirmation_incomplete",
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
      reason: "summary_reentry_confirmation_runner_blocked",
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
      runtimeError: String(error?.message || "summary_reentry_confirmation_runner_failed").slice(0, 160),
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
    baseUrl: process.env.AIYA_SUMMARY_REENTRY_BASE_URL || SUMMARY_REENTRY_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`summary_reentry_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: SUMMARY_REENTRY_CHECKPOINT_ROOT,
      phaseId: SUMMARY_REENTRY_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 summary-reentry settlement confirmation ready. Use --run explicitly.\n");
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
      sampleSummary: evidence.sampleSummary,
      comparison: evidence.comparison,
      evidencePath: path,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    runId: result.runId,
    status: result.status,
    outcome: evidence.outcome,
    sampleSummary: evidence.sampleSummary,
    comparison: evidence.comparison,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
