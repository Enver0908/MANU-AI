#!/usr/bin/env node

/**
 * Trace-only J1 A-B-A confirmation around active-client preference completion.
 *
 * A1 and A2 use the normal harness sequence. B adds one harness-only gate that
 * waits for the active-client preference PATCH response before dispatching the
 * Forms click. This runner is outside the official baseline and accepts no
 * runtime change as a fix.
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
  PHASE_4_3_READY_TIMEOUT_MS,
  PHASE_4_3_JOURNEYS,
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

export const J1_CONFIRMATION_PHASE_ID =
  "aiya-performance-plan1-j1-active-client-preference-confirmation-v1";
export const J1_CONFIRMATION_SCHEMA_VERSION =
  "aiya-performance-plan1-j1-active-client-preference-confirmation-v1";
export const J1_CONFIRMATION_PLAN_REVISION = "plan1-final-v3";
export const J1_CONFIRMATION_BASE_URL = "http://127.0.0.1:3152";
export const J1_CONFIRMATION_REPETITIONS = 3;
export const J1_CONFIRMATION_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const J1_CONFIRMATION_EVIDENCE_PREFIX =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const J1_CONFIRMATION_GROUPS = Object.freeze([
  Object.freeze({ id: "A1", controlVariant: null }),
  Object.freeze({
    id: "B",
    controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference,
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
  const url = new URL(value || J1_CONFIRMATION_BASE_URL);
  if (!url.port) url.port = "3152";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("j1_confirmation_run_id_invalid");
  }
  return join(
    repoRoot,
    `${J1_CONFIRMATION_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`,
  );
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-active-client-preference-confirmation.mjs",
    "app/src/components/dashboard-app.tsx",
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/lib/phase-85-stage-5-shell-preference-coordinator.ts",
    "app/src/lib/use-stage-6-client-workspace.ts",
  ].map((path) => ({
    path,
    sha256: hashFile(join(repoRoot, path)),
  }));
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
    planRevision: J1_CONFIRMATION_PLAN_REVISION,
    phaseId: J1_CONFIRMATION_PHASE_ID,
    phaseSchemaVersion: J1_CONFIRMATION_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_active_client_preference_a_b_a",
    controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference,
    journeyId: "J1",
    groupOrder: J1_CONFIRMATION_GROUPS.map((group) => group.id),
    repetitionsPerGroup: J1_CONFIRMATION_REPETITIONS,
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
      env: {
        ...process.env,
        ...environment,
        PORT: url.port,
        HOSTNAME: "127.0.0.1",
      },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  return { server, baseUrl };
}

async function waitForServer(handle, timeoutMs = PHASE_4_3_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (handle.server.exitCode != null) throw new Error("j1_confirmation_server_exited");
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
  throw new Error("j1_confirmation_server_timeout");
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

function compactLifecycleEvents(result) {
  const events = result?.trace?.measurement?.longTasks?.phase52Events;
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => String(event?.name ?? "").startsWith("stage6_workspace_"))
    .map((event) => ({
      name: String(event.name).slice(0, 80),
      atMs: roundMs(event.atWallMs - result.trace.startedAtWallMs),
      cleanupSequence: Number.isInteger(event.cleanupSequence) ? event.cleanupSequence : null,
    }));
}

function routeAfterForms(result) {
  const events = result?.trace?.measurement?.routeHistory?.events;
  if (!Array.isArray(events)) return { formsRouteAtMs: null, summaryRouteAfterForms: false };
  const formsIndex = events.findIndex((event) => String(event.route).includes("clientTask=forms"));
  if (formsIndex < 0) return { formsRouteAtMs: null, summaryRouteAfterForms: false };
  const summaryRouteAfterForms = events
    .slice(formsIndex + 1)
    .some((event) =>
      String(event.route) === "/dashboard?section=clients&clientId=%3Cpresent%3E",
    );
  return {
    formsRouteAtMs: events[formsIndex].atMs ?? null,
    summaryRouteAfterForms,
  };
}

function secondActionTailMs(result) {
  const second = result?.trace?.actions?.second;
  const trusted = finite(second?.trustedEventAtMs);
  const ready = finite(second?.readyStateAtMs);
  return trusted != null && ready != null ? roundMs(ready - trusted) : null;
}

export function groupForUnitKey(unitKey) {
  return J1_CONFIRMATION_GROUPS.find((group) =>
    String(unitKey ?? "").startsWith(`${group.id}:J1:r`),
  )?.id ?? null;
}

export function summarizeConfirmationResults(results) {
  return J1_CONFIRMATION_GROUPS.map((group) => {
    const groupResults = (results ?? []).filter((result) => groupForUnitKey(result?.unitKey) === group.id);
    return {
      group: group.id,
      controlVariant: group.controlVariant,
      attempted: groupResults.length,
      planned: J1_CONFIRMATION_REPETITIONS,
      validSample: groupResults.filter((result) => result.validSample === true).length,
      observationValid: groupResults.filter((result) => result.observationValidity === "VALID").length,
      functionalSuccess: groupResults.filter((result) => result.functionalOutcome === "SUCCESS").length,
      summaryRouteAfterFormsCount: groupResults.filter((result) => routeAfterForms(result).summaryRouteAfterForms).length,
      formsAbortCount: groupResults.filter((result) =>
        compactLifecycleEvents(result).some((event) => event.name === "stage6_workspace_load_aborted"),
      ).length,
      preferenceGatePassed: groupResults.filter((result) => result.trace?.control?.status === "PASSED").length,
      secondActionTailMs: groupResults.map(secondActionTailMs),
    };
  });
}

function compactAction(action) {
  if (!action) return null;
  return {
    ...action,
    requiredRequestTimings: Array.isArray(action.requiredRequestTimings)
      ? action.requiredRequestTimings.map((request) => ({
          method: request.method,
          startedAtMs: request.startedAtMs,
          responseHeaderAtMs: request.responseHeaderAtMs,
          bodyFinishedAtMs: request.bodyFinishedAtMs,
          status: request.status,
          failed: request.failed,
          failureReason: request.failureReason,
        }))
      : [],
  };
}

function compactResult(result) {
  const route = routeAfterForms(result);
  return {
    unitKey: result.unitKey,
    mode: result.mode,
    journeyId: result.journeyId,
    repetition: result.repetition,
    group: groupForUnitKey(result.unitKey),
    controlVariant: result.trace?.controlVariant ?? null,
    status: result.status,
    validSample: result.validSample,
    observationValidity: result.observationValidity,
    functionalOutcome: result.functionalOutcome,
    performanceOutcome: result.performanceOutcome,
    failureBoundary: result.failureBoundary,
    control: result.trace?.control ?? null,
    trace: {
      status: result.trace?.status ?? null,
      failures: result.trace?.failures ?? [],
      actions: {
        first: compactAction(result.trace?.actions?.first),
        second: compactAction(result.trace?.actions?.second),
      },
      routeHistory: result.trace?.measurement?.routeHistory ?? null,
      routeAfterForms: route,
      lifecycleEvents: compactLifecycleEvents(result),
      secondActionTailMs: secondActionTailMs(result),
    },
  };
}

function completedResults(events) {
  const traces = new Map();
  const completed = new Map();
  for (const event of events ?? []) {
    const key = event.payload?.unitKey;
    if (!key) continue;
    if (event.type === "measurement.unit.trace") traces.set(key, event);
    if (event.type === "measurement.unit.completed") completed.set(key, event);
  }
  return [...traces.entries()]
    .filter(([key, traceEvent]) =>
      completed.get(key)?.sequence > traceEvent.sequence,
    )
    .map(([, traceEvent]) => traceEvent.payload)
    .filter((result) =>
      J1_CONFIRMATION_GROUPS.some((group) => groupForUnitKey(result?.unitKey) === group.id),
    );
}

function buildEvidence(result, generatedAt = new Date().toISOString()) {
  const results = result.results ?? [];
  const summary = summarizeConfirmationResults(results);
  const attempted = results.length;
  const valid = results.filter((sample) => sample.validSample === true).length;
  const blockers = result.status === "BLOCKED" ? [result.outcome ?? "confirmation_blocked"] : [];
  return sanitizePhase44Evidence({
    schemaVersion: J1_CONFIRMATION_SCHEMA_VERSION,
    planRevision: J1_CONFIRMATION_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-single-variable-confirmation",
    stageId: J1_CONFIRMATION_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt,
    status: result.status,
    outcome: result.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Trace-only local desktop J1 A-B-A confirmation of the active-client preference/navigation race candidate.",
      officialMeasurementStarted: false,
      diagnosticExperimentStarted: attempted > 0,
      runtimeChangeAcceptedAsFix: false,
      controlVariant: PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference,
      groupOrder: J1_CONFIRMATION_GROUPS.map((group) => group.id),
      repetitionsPerGroup: J1_CONFIRMATION_REPETITIONS,
      countedAsOfficialSample: false,
      externalOperations: [],
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: J1_CONFIRMATION_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      currentStage: J1_CONFIRMATION_PHASE_ID,
    },
    sourceIdentity: result.sourceIdentity,
    parentEvidenceReferences: [
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260921T080123439Z-c4d87d92-ce1e-4439-8103-77ec287524b9_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json",
    ],
    measurementIdentity: {
      fixtureId: "local-normal",
      fixtureClass: "synthetic_normal_owner",
      storePath: "normal_rls_api_path_required",
      localSupabaseHost: "127.0.0.1:54321",
      journeyId: "J1",
      secondActionDelayMs: 2_000,
      serverControl: "one_managed_normal_server",
      officialMeasurement: false,
      groups: J1_CONFIRMATION_GROUPS.map((group) => ({
        id: group.id,
        controlVariant: group.controlVariant,
        repetitions: J1_CONFIRMATION_REPETITIONS,
      })),
    },
    sampleSummary: {
      attempted,
      planned: J1_CONFIRMATION_GROUPS.length * J1_CONFIRMATION_REPETITIONS,
      validSamples: valid,
      observationValid: results.filter((sample) => sample.observationValidity === "VALID").length,
      officialBaselineSamples: 0,
      byGroup: summary,
    },
    results: results.map(compactResult),
    blockers,
    interpretation: {
      status: "UNINTERPRETED_PENDING_REVIEW",
      rootCauseConfirmed: false,
      runtimeFixAccepted: false,
      productionGo: false,
      requiredForConfirmation: [
        "three matched valid A1-B-A2 cycles",
        "same route/request/fixture/browser inputs outside the one B gate",
        "direct correlation of summary transition and Forms lifecycle, if reproduced",
        "separate functional and speed results",
      ],
    },
    explicitNonClaims: [
      "This trace-only A-B-A run is not the official nine-scenario baseline.",
      "The active-client preference gate is a harness control, not a product change.",
      "A route transition correlation does not alone prove the global freeze thesis or auth as the root cause.",
      "No finding disposition, Plan 2 eligibility, or production decision changes here.",
      "Production remains NO-GO.",
    ],
    closure: {
      status: result.status,
      outcome: result.outcome,
      runtimeFixAccepted: false,
      plan2Eligible: false,
      nextAction: "Review the three A-B-A groups together with the prior route/lifecycle correlation before any code change.",
    },
  });
}

async function runConfirmation({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = checkpointIdentity({
    baseUrl: normalizedBaseUrl,
    configuration,
    source,
  });
  const metadata = {
    identitySummary: {
      phaseId: J1_CONFIRMATION_PHASE_ID,
      sourceHead: source.head,
      sourceVariant: identity.sourceVariant,
      officialMeasurement: false,
    },
    contract: identity,
    countedAsOfficialSample: false,
  };
  const opened = openPhaseRun({
    root: J1_CONFIRMATION_CHECKPOINT_ROOT,
    phaseId: J1_CONFIRMATION_PHASE_ID,
    phaseSchemaVersion: J1_CONFIRMATION_SCHEMA_VERSION,
    identity,
    metadata,
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: J1_CONFIRMATION_CHECKPOINT_ROOT,
      phaseId: J1_CONFIRMATION_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "J1_SINGLE_VARIABLE_CONFIRMATION_RECORDED",
      sourceIdentity: source,
      results: completedResults(persisted.events),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      outcome: "J1_CONFIRMATION_CHECKPOINT_NOT_RUN",
      sourceIdentity: source,
      results: [],
    };
  }

  const checkpoint = opened.run;
  const j1 = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J1");
  let serverHandle = null;
  let browser = null;
  const results = completedResults(checkpoint.events);
  checkpoint.append("diagnostic.contract.bound", {
    phaseId: J1_CONFIRMATION_PHASE_ID,
    schemaVersion: J1_CONFIRMATION_SCHEMA_VERSION,
    journeyId: "J1",
    groupOrder: J1_CONFIRMATION_GROUPS.map((group) => group.id),
    repetitionsPerGroup: J1_CONFIRMATION_REPETITIONS,
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
      apiUrl: localStatus.apiUrl ? new URL(localStatus.apiUrl).origin : null,
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
    checkpoint.markStatus("BLOCKED", { reason: "j1_confirmation_preflight_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "J1_CONFIRMATION_PREFLIGHT_BLOCKED",
      sourceIdentity: source,
      results,
    };
  }

  try {
    const buildEnvironment = buildPhase44ServerEnvironment(
      configuration.environment,
      "normal",
      { baseUrl: normalizedBaseUrl, localStatus },
    );
    if (!existsSync(nextCliPath)) throw new Error("j1_confirmation_next_cli_missing");
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
    if (build.status !== 0) throw new Error("j1_confirmation_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    for (const group of J1_CONFIRMATION_GROUPS) {
      for (let repetition = 1; repetition <= J1_CONFIRMATION_REPETITIONS; repetition += 1) {
        const unitKey = `${group.id}:J1:r${repetition}`;
        if (results.some((result) => result.unitKey === unitKey)) continue;
        const result = await runMeasurementUnit({
          browser,
          baseUrl: normalizedBaseUrl,
          mode: "normal",
          journey: j1,
          repetition,
          unitKey,
          scope: `j1_single_variable_${group.id.toLowerCase()}`,
          email: configuration.email,
          password: configuration.password,
          controlVariant: group.controlVariant,
          checkpoint,
        });
        results.push(result);
      }
    }
    const complete = results.length === J1_CONFIRMATION_GROUPS.length * J1_CONFIRMATION_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete ? "j1_confirmation_completed" : "j1_confirmation_incomplete",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: complete ? "COMPLETE" : "BLOCKED",
      outcome: complete
        ? "J1_SINGLE_VARIABLE_CONFIRMATION_RECORDED"
        : "J1_SINGLE_VARIABLE_CONFIRMATION_INCOMPLETE",
      sourceIdentity: source,
      results,
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "j1_confirmation_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "J1_CONFIRMATION_RUNNER_BLOCKED",
      runtimeError: String(error?.message || "confirmation_runner_failed").slice(0, 160),
      sourceIdentity: source,
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
    baseUrl: process.env.AIYA_J1_CONFIRMATION_BASE_URL || J1_CONFIRMATION_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`j1_confirmation_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: J1_CONFIRMATION_CHECKPOINT_ROOT,
      phaseId: J1_CONFIRMATION_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 single-variable confirmation ready. Use --run explicitly.\n");
    return;
  }
  const result = await runConfirmation({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
  });
  const evidence = buildEvidence(result);
  if (options.writeEvidence && result.runId) {
    writeFileSync(phaseEvidencePath(result.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
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
