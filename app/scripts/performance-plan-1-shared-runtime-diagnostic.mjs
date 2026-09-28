#!/usr/bin/env node

/**
 * Shared-runtime diagnostic continuation for the Plan 1 desktop hypothesis.
 *
 * This runner reuses the v3 browser capture and checkpoint primitives. It
 * records normal interaction observations, then repeats the highest observed
 * second-action tail with diagnostic instrumentation enabled. It never feeds
 * samples into the official Phase 4 baseline and never treats a faster trace
 * as an accepted runtime fix.
 */

import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
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
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  PHASE_4_4_FIXTURE_ID,
  buildPhase44ServerEnvironment,
  resolvePhase44LocalConfiguration,
  runMeasurementUnit,
  sanitizePhase44Evidence,
} from "./performance-plan-1-phase-4-4-local.mjs";
import { createDiagnosticDbLockSampler } from "./lib/diagnostic-db-lock-sampler.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const SHARED_RUNTIME_PLAN_REVISION = "plan1-final-v3";
export const SHARED_RUNTIME_PHASE_ID = "aiya-performance-plan1-shared-runtime-diagnostic-v3";
export const SHARED_RUNTIME_SCHEMA_VERSION = "aiya-performance-plan1-shared-runtime-diagnostic-v3";
export const SHARED_RUNTIME_FIXTURE_ID = PHASE_4_4_FIXTURE_ID;
export const SHARED_RUNTIME_DEFAULT_BASE_URL = "http://127.0.0.1:3150";
export const SHARED_RUNTIME_NORMAL_REPETITIONS = 3;
export const SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS = 3;
export const SHARED_RUNTIME_CHECKPOINT_ROOT = join(repoRoot, ".manu-runtime", "phase-execution");
export const SHARED_RUNTIME_EVIDENCE_PREFIX =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const SHARED_RUNTIME_DB_DOCKER_CONTAINER = "supabase_db_manu-ai-local";

const SOURCE_PATHS = Object.freeze([
  "app/src/lib/auth-context.ts",
  "app/src/lib/phase-85-stage-5-shell-route.ts",
  "app/src/app/api/shell/bootstrap/route.ts",
  "app/src/app/api/app-state/route.ts",
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/authenticated-shell-boundary.tsx",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/lib/dashboard-server-auth.ts",
  "app/src/lib/phase-52-diagnostic.ts",
  "app/src/lib/use-shell-dirty-registration.ts",
  "app/src/lib/use-aiya-state.ts",
  "app/src/lib/use-stage-4b-inbox.ts",
  "app/src/lib/use-stage-4b2-messaging.ts",
  "app/src/lib/supabase-store.ts",
  "app/src/app/api/clients/[id]/food-rule-profile/route.ts",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/scripts/performance-plan-1-shared-runtime-diagnostic.mjs",
  "app/scripts/lib/diagnostic-db-lock-sampler.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
]);

const STAGE_LEDGER = Object.freeze([
  { stageId: "SRD.1", name: "Identity and local input preflight", prerequisites: [] },
  { stageId: "SRD.2", name: "Normal J1-J3 observations", prerequisites: ["SRD.1 PASS"] },
  { stageId: "SRD.3", name: "Selected journey diagnostic repeat", prerequisites: ["SRD.2 COMPLETE"] },
  { stageId: "SRD.4", name: "Evidence and candidate narrowing", prerequisites: ["SRD.1 COMPLETE"] },
]);

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
  const url = new URL(value || SHARED_RUNTIME_DEFAULT_BASE_URL);
  if (!url.port) url.port = "3150";
  return url.origin;
}

function foodRuleProfileReadPolicy(configuration) {
  return String(configuration?.environment?.AIYA_PERF_FOOD_RULE_PROFILE_READ_POLICY ?? "")
    .trim()
    .toLowerCase() === "narrow"
    ? "narrow"
    : "broad";
}

function shellDirtyRegistrationPolicy(configuration) {
  return String(
    configuration?.environment?.NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY ?? "",
  )
    .trim()
    .toLowerCase() === "stable"
    ? "stable"
    : "legacy";
}

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  const diffCheck = gitOutput(["diff", "--check"]);
  return {
    cwd: repoRoot,
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    statusLineCount: status ? status.split(/\r?\n/).filter(Boolean).length : 0,
    statusHash: hashText(status),
    diffCheck: diffCheck === "" ? "PASS" : "FAIL",
    foodRuleProfileReadPolicy: foodRuleProfileReadPolicy(configuration),
    shellDirtyRegistrationPolicy: shellDirtyRegistrationPolicy(configuration),
    sourceFiles: SOURCE_PATHS.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

function localStatusSummary(localStatus) {
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

function phaseIdentity({ baseUrl, configuration, source }) {
  return {
    planRevision: SHARED_RUNTIME_PLAN_REVISION,
    phaseId: SHARED_RUNTIME_PHASE_ID,
    phaseSchemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
    fixtureId: SHARED_RUNTIME_FIXTURE_ID,
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    storePath: "normal_rls_api_path_required",
    sourceHead: source.head,
    sourceVariant: "current_shared_runtime_diagnostic",
    foodRuleProfileReadPolicy: foodRuleProfileReadPolicy(configuration),
    shellDirtyRegistrationPolicy: shellDirtyRegistrationPolicy(configuration),
    harnessSourceFingerprint: hashText(
      JSON.stringify(source.sourceFiles.filter(({ path }) => path.startsWith("app/"))),
    ),
    configurationIdentity: configuration.identity,
    journeys: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
    normalRepetitions: SHARED_RUNTIME_NORMAL_REPETITIONS,
    diagnosticRepetitions: SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    officialMeasurement: false,
  };
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("shared_runtime_run_id_invalid");
  }
  return join(
    repoRoot,
    `${SHARED_RUNTIME_EVIDENCE_PREFIX}${runId}_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json`,
  );
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

async function waitForServer(handle, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (handle.server.exitCode != null) throw new Error("shared_runtime_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, {
        cache: "no-store",
      });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The server may still be compiling or binding its port.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("shared_runtime_server_timeout");
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

export function secondActionResponseMs(result) {
  const trace = result?.trace;
  const second = trace?.actions?.second;
  const trusted = finite(second?.trustedEventAtMs);
  const ready = finite(second?.readyStateAtMs);
  return trusted != null && ready != null ? roundMs(ready - trusted) : null;
}

export function completedMeasurementResults(events, mode) {
  const latestEventsByUnit = new Map();
  const latestTraceByUnit = new Map();
  for (const event of events ?? []) {
    const unitKey = event.payload?.unitKey;
    if (!unitKey || event.payload?.mode !== mode) continue;
    if (["measurement.unit.started", "measurement.unit.trace", "measurement.unit.completed"].includes(event.type)) {
      latestEventsByUnit.set(unitKey, event);
    }
    if (event.type === "measurement.unit.trace") latestTraceByUnit.set(unitKey, event);
  }
  return [...latestEventsByUnit.entries()]
    .filter(([unitKey, latestEvent]) => {
      const trace = latestTraceByUnit.get(unitKey);
      return latestEvent.type === "measurement.unit.completed" && trace && trace.sequence < latestEvent.sequence;
    })
    .map(([unitKey]) => latestTraceByUnit.get(unitKey).payload)
    .filter((result) => result?.mode === mode);
}

export function chooseDiagnosticJourney(results) {
  const eligible = results
    .filter((result) =>
      result?.observationValidity === "VALID" &&
      result?.validSample === true &&
      result?.functionalOutcome === "SUCCESS",
    )
    .map((result) => ({ journeyId: result.journeyId, tailMs: secondActionResponseMs(result) }))
    .filter((result) => result.tailMs != null);
  if (!eligible.length) {
    return {
      status: "BLOCKED",
      reason: "no_valid_normal_observation_with_second_action_tail",
      journeyId: null,
      observedTailMs: null,
    };
  }
  eligible.sort((left, right) => right.tailMs - left.tailMs);
  return {
    status: "PASS",
    reason: "highest_observed_second_action_tail",
    journeyId: eligible[0].journeyId,
    observedTailMs: eligible[0].tailMs,
    candidates: eligible,
  };
}

function checkpointIdentitySummary(identity) {
  return {
    phaseId: identity.phaseId,
    fixtureId: identity.fixtureId,
    baseOrigin: identity.baseOrigin,
    sourceHead: identity.sourceHead,
    sourceVariant: identity.sourceVariant,
    officialMeasurement: false,
  };
}

function buildPreflight({ baseUrl, localStatus, configuration, dbLockSampler }) {
  const blockers = [];
  if (localStatus.status !== "PASS") blockers.push("local_supabase_unreachable_or_not_ready");
  if (!configuration.email) blockers.push("synthetic_email_unavailable");
  if (!configuration.password) blockers.push("synthetic_password_unavailable");
  return {
    status: blockers.length ? "BLOCKED" : "PASS",
    fixtureId: SHARED_RUNTIME_FIXTURE_ID,
    fixtureClass: "synthetic_normal_owner",
    authentication: "real_password_session_required",
    storePath: "normal_rls_api_path_required",
    fallbackStoreAllowed: false,
    targetOrigin: baseUrl,
    credentialsAvailable: {
      email: Boolean(configuration.email),
      password: Boolean(configuration.password),
    },
    localSupabase: localStatusSummary(localStatus),
    dbLockSampler: dbLockSampler.summary(),
    blockers,
  };
}

function createSharedRuntimeDbLockSampler() {
  return createDiagnosticDbLockSampler({
    env: {
      ...process.env,
      AIYA_DB_DOCKER_CONTAINER:
        process.env.AIYA_DB_DOCKER_CONTAINER || SHARED_RUNTIME_DB_DOCKER_CONTAINER,
    },
  });
}

function createMetadata({ identity, configuration }) {
  return {
    identitySummary: checkpointIdentitySummary(identity),
    measurementContract: {
      normalJourneys: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
      normalRepetitions: SHARED_RUNTIME_NORMAL_REPETITIONS,
      diagnosticRepetitions: SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS,
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      countedAsOfficialSample: false,
      foodRuleProfileReadPolicy: foodRuleProfileReadPolicy(configuration),
      shellDirtyRegistrationPolicy: shellDirtyRegistrationPolicy(configuration),
    },
    configurationSummary: configuration.summary,
  };
}

async function buildLocalArtifact(environment, profile) {
  if (!existsSync(nextCliPath)) {
    return {
      status: "BLOCKED",
      profile,
      timedOut: false,
      failureBoundary: "local_app_build",
      reason: "next_cli_missing",
      artifactPresent: false,
    };
  }
  const args = [nextCliPath, "build", "--webpack"];
  if (profile) args.push("--profile");
  const result = spawnSync(process.execPath, args, {
    cwd: appRoot,
    env: { ...process.env, ...environment },
    stdio: "ignore",
    timeout: 600_000,
    windowsHide: true,
  });
  return {
    status: result.status === 0 ? "PASS" : "BLOCKED",
    profile,
    timedOut: result.error?.code === "ETIMEDOUT",
    exitCode: result.status,
    errorCode: result.error?.code ?? null,
    failureBoundary: result.status === 0 ? null : "local_app_build",
    artifactPresent: existsSync(join(appRoot, ".next", "BUILD_ID")),
  };
}

async function executeSession({
  baseUrl,
  configuration,
  localStatus,
  checkpoint,
  normalResults,
  diagnosticResults,
}) {
  const browser = await chromium.launch({ headless: true });
  const serverState = { handle: null, mode: null };
  const dbLockSampler = createSharedRuntimeDbLockSampler();
  let dbLockSamplerStopped = false;
  const ensureServer = async (mode) => {
    if (serverState.mode === mode && serverState.handle?.server?.exitCode == null) return;
    await stopLocalServer(serverState.handle);
    const environment = buildPhase44ServerEnvironment(configuration.environment, mode, {
      baseUrl,
      localStatus,
    });
    serverState.handle = startLocalServer(environment, baseUrl);
    await waitForServer(serverState.handle);
    serverState.mode = mode;
  };

  try {
    await dbLockSampler.start();
    await ensureServer("normal");
    for (const journey of PHASE_4_3_JOURNEYS) {
      for (let repetition = 1; repetition <= SHARED_RUNTIME_NORMAL_REPETITIONS; repetition += 1) {
        const unitKey = `normal:${journey.journeyId}:r${repetition}`;
        if (normalResults.some((result) => result?.unitKey === unitKey)) continue;
        const result = await runMeasurementUnit({
          browser,
          baseUrl,
          mode: "normal",
          journey,
          repetition,
          unitKey,
          scope: "shared_runtime_normal_observation",
          email: configuration.email,
          password: configuration.password,
          checkpoint,
        });
        normalResults.push(result);
      }
    }

    const selection = chooseDiagnosticJourney(normalResults);
    checkpoint.append("diagnostic.candidate.selected", selection);
    if (selection.status === "PASS") {
      const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === selection.journeyId);
      await dbLockSampler.stop();
      checkpoint.append("db.lock.sampling.paused", {
        reason: "diagnostic_artifact_build",
        countedAsOfficialSample: false,
      });
      await stopLocalServer(serverState.handle);
      serverState.handle = null;
      serverState.mode = null;
      const diagnosticEnvironment = buildPhase44ServerEnvironment(
        configuration.environment,
        "diagnostic",
        { baseUrl, localStatus },
      );
      const diagnosticBuild = await buildLocalArtifact(diagnosticEnvironment, true);
      checkpoint.append("environment.diagnostic_build", diagnosticBuild, {
        status: diagnosticBuild.status === "PASS" ? "RUNNING" : "BLOCKED",
      });
      if (diagnosticBuild.status !== "PASS") throw new Error("shared_runtime_diagnostic_build_blocked");
      await ensureServer("diagnostic");
      await dbLockSampler.start();
      checkpoint.append("db.lock.sampling.resumed", {
        reason: "diagnostic_artifact_ready",
        countedAsOfficialSample: false,
      });
      for (let repetition = 1; repetition <= SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS; repetition += 1) {
        const unitKey = `diagnostic:${journey.journeyId}:r${repetition}`;
        if (diagnosticResults.some((result) => result?.unitKey === unitKey)) continue;
        const result = await runMeasurementUnit({
          browser,
          baseUrl,
          mode: "diagnostic",
          journey,
          repetition,
          unitKey,
          scope: "shared_runtime_selected_diagnostic",
          email: configuration.email,
          password: configuration.password,
          checkpoint,
        });
        diagnosticResults.push(result);
      }
    }
    await dbLockSampler.stop();
    dbLockSamplerStopped = true;
    return { selection, dbLockObservation: dbLockSampler.summary() };
  } catch (error) {
    await dbLockSampler.stop();
    dbLockSamplerStopped = true;
    error.dbLockObservation = dbLockSampler.summary();
    throw error;
  } finally {
    if (!dbLockSamplerStopped) await dbLockSampler.stop();
    await browser.close();
    await stopLocalServer(serverState.handle);
  }
}

export function buildSharedRuntimeEvidence(result, { generatedAt = new Date().toISOString() } = {}) {
  const samples = [...(result.normalResults ?? []), ...(result.diagnosticResults ?? [])];
  const validObservations = samples.filter((sample) => sample.observationValidity === "VALID");
  const blockers = [...new Set([
    ...(result.preflight?.blockers ?? []),
    ...(result.selection?.status === "BLOCKED" ? [result.selection.reason] : []),
    ...(result.runtimeError ? [result.runtimeError] : []),
  ].filter(Boolean))];
  const status = result.status ?? (blockers.length ? "BLOCKED" : "COMPLETE");
  const outcome = result.outcome ?? (status === "BLOCKED"
    ? "SHARED_RUNTIME_DIAGNOSTIC_BLOCKED"
    : "SHARED_RUNTIME_DIAGNOSTIC_RECORDED");
  return sanitizePhase44Evidence({
    schemaVersion: "aiya-performance-plan1-v3-shared-runtime-diagnostic-v1",
    planRevision: SHARED_RUNTIME_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "shared-runtime",
    stageId: SHARED_RUNTIME_PHASE_ID,
    runId: result.runId ?? null,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Local desktop shared-runtime localization around the two-second second-action boundary.",
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      foodRuleProfileReadPolicy: result.sourceIdentity?.foodRuleProfileReadPolicy ?? "broad",
      shellDirtyRegistrationPolicy: result.sourceIdentity?.shellDirtyRegistrationPolicy ?? "legacy",
      normalObservationCount: result.normalResults?.length ?? 0,
      diagnosticObservationCount: result.diagnosticResults?.length ?? 0,
      countedAsOfficialSample: false,
      externalOperations: [],
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: SHARED_RUNTIME_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      currentStage: SHARED_RUNTIME_PHASE_ID,
    },
    sourceIdentity: result.sourceIdentity,
    parentRunReferences: [
      "aiya-performance-plan1-phase5-7-plan1-closure-v3-20260918T125452Z-f5305ee2-b35b-43c5-91df-42f313d0da29",
      "worktree-reconciliation-supplemental-audit-20260918T172214Z",
    ],
    measurementIdentity: {
      checkpointPhaseId: SHARED_RUNTIME_PHASE_ID,
      checkpointSchemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
      checkpointStore: "tools/phase-execution/checkpoint-store.mjs",
      fixtureId: SHARED_RUNTIME_FIXTURE_ID,
      journeyIds: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
      normalRepetitions: SHARED_RUNTIME_NORMAL_REPETITIONS,
      diagnosticRepetitions: SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS,
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      databaseLockSamplingIntervalMs: 50,
      countedAsOfficialSample: false,
      foodRuleProfileReadPolicy: result.sourceIdentity?.foodRuleProfileReadPolicy ?? "broad",
      shellDirtyRegistrationPolicy: result.sourceIdentity?.shellDirtyRegistrationPolicy ?? "legacy",
    },
    stageLedger: STAGE_LEDGER.map((stage) => ({
      ...stage,
      status: result.stageStatuses?.[stage.stageId] ?? "NOT_STARTED",
    })),
    inputPreflight: result.preflight ?? null,
    candidateSelection: result.selection ?? null,
    dbLockObservation: result.dbLockObservation ?? null,
    sampleSummary: {
      attempted: samples.length,
      observationValid: validObservations.length,
      normal: result.normalResults?.length ?? 0,
      diagnostic: result.diagnosticResults?.length ?? 0,
      officialBaselineSamples: 0,
    },
    normalObservations: result.normalResults ?? [],
    diagnosticObservations: result.diagnosticResults ?? [],
    blockers,
    explicitNonClaims: [
      "No root cause or accepted runtime fix is claimed from this trace-only continuation.",
      "The two-second interaction trace is not an official nine-scenario acceptance run.",
      "An unavailable database sampler does not establish absence of session-row lock waits.",
      "A Server-Timing auth span is a contained timing label, not proof that auth alone caused the freeze.",
      "Production remains NO-GO.",
    ],
    closure: {
      status,
      outcome,
      nextAction: status === "COMPLETE"
        ? "Use the measured dominant boundary to define one reversible single-variable A-B-A diagnostic.": "Repair the listed local input or measurement prerequisite before resuming this run.",
    },
  });
}

export async function runSharedRuntimeDiagnostic({
  baseUrl = process.env.AIYA_SHARED_RUNTIME_BASE_URL || SHARED_RUNTIME_DEFAULT_BASE_URL,
  newRun = false,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = phaseIdentity({ baseUrl: normalizedBaseUrl, configuration, source });
  const metadata = createMetadata({ identity, configuration });
  let opened = openPhaseRun({
    root: SHARED_RUNTIME_CHECKPOINT_ROOT,
    phaseId: SHARED_RUNTIME_PHASE_ID,
    phaseSchemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
    identity,
    metadata,
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "STALE" && !newRun) {
    opened = openPhaseRun({
      root: SHARED_RUNTIME_CHECKPOINT_ROOT,
      phaseId: SHARED_RUNTIME_PHASE_ID,
      phaseSchemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
      identity: { ...identity, supersedesRunId: opened.manifest?.runId ?? null },
      metadata: {
        ...metadata,
        identityChange: {
          reason: "shared_runtime_source_or_environment_identity_changed",
          supersedesRunId: opened.manifest?.runId ?? null,
        },
      },
      newRun: true,
      redact: sanitizePhase44Evidence,
    });
  }
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: SHARED_RUNTIME_CHECKPOINT_ROOT,
      phaseId: SHARED_RUNTIME_PHASE_ID,
      runId: opened.manifest.runId,
    });
    const traces = persisted.events
      .filter((event) => event.type === "measurement.unit.trace")
      .map((event) => event.payload);
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "SHARED_RUNTIME_DIAGNOSTIC_RECORDED",
      sourceIdentity: source,
      preflight: persisted.events.find((event) => event.type === "environment.preflight")?.payload ?? null,
      normalResults: traces.filter((trace) => trace?.mode === "normal"),
      diagnosticResults: traces.filter((trace) => trace?.mode === "diagnostic"),
      selection: persisted.events.find((event) => event.type === "diagnostic.candidate.selected")?.payload ?? null,
      dbLockObservation: persisted.events.find((event) => event.type === "db.lock.summary")?.payload ?? null,
      stageStatuses: { "SRD.1": "PASS", "SRD.2": "COMPLETE", "SRD.3": "COMPLETE", "SRD.4": "COMPLETE" },
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      outcome: "SHARED_RUNTIME_CHECKPOINT_NOT_RUN",
      sourceIdentity: source,
      preflight: null,
      normalResults: [],
      diagnosticResults: [],
      selection: null,
      dbLockObservation: null,
      stageStatuses: { "SRD.1": "NOT_STARTED", "SRD.2": "NOT_STARTED", "SRD.3": "NOT_STARTED", "SRD.4": "NOT_STARTED" },
    };
  }

  const checkpoint = opened.run;
  checkpoint.append("diagnostic.contract.bound", {
    phaseId: SHARED_RUNTIME_PHASE_ID,
    schemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
    fixtureId: SHARED_RUNTIME_FIXTURE_ID,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    officialMeasurementStarted: false,
    countedAsOfficialSample: false,
  });

  const dbLockSampler = createSharedRuntimeDbLockSampler();
  const preflight = buildPreflight({
    baseUrl: normalizedBaseUrl,
    localStatus,
    configuration,
    dbLockSampler,
  });
  checkpoint.append("environment.preflight", preflight, { status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED" });
  if (preflight.status !== "PASS") {
    checkpoint.append("db.lock.summary", preflight.dbLockSampler);
    checkpoint.markStatus("BLOCKED", { reason: "local_input_preflight_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "SHARED_RUNTIME_LOCAL_INPUT_BLOCKED",
      sourceIdentity: source,
      preflight,
      normalResults: [],
      diagnosticResults: [],
      selection: null,
      dbLockObservation: preflight.dbLockSampler,
      stageStatuses: { "SRD.1": "BLOCKED", "SRD.2": "BLOCKED", "SRD.3": "BLOCKED", "SRD.4": "COMPLETE" },
    };
  }

  const normalResults = completedMeasurementResults(opened.run.events, "normal");
  const diagnosticResults = completedMeasurementResults(opened.run.events, "diagnostic");
  let selection = null;
  let dbLockObservation = null;
  try {
    const normalEnvironment = buildPhase44ServerEnvironment(configuration.environment, "normal", {
      baseUrl: normalizedBaseUrl,
      localStatus,
    });
    const normalBuild = await buildLocalArtifact(normalEnvironment, false);
    checkpoint.append("environment.build", normalBuild, { status: normalBuild.status === "PASS" ? "RUNNING" : "BLOCKED" });
    if (normalBuild.status !== "PASS") throw new Error("shared_runtime_normal_build_blocked");
    const executed = await executeSession({
      baseUrl: normalizedBaseUrl,
      configuration,
      localStatus,
      checkpoint,
      normalResults,
      diagnosticResults,
    });
    selection = executed.selection;
    dbLockObservation = executed.dbLockObservation;
    checkpoint.append("db.lock.summary", dbLockObservation);
    const normalComplete = normalResults.length === PHASE_4_3_JOURNEYS.length * SHARED_RUNTIME_NORMAL_REPETITIONS;
    const diagnosticComplete =
      selection?.status === "PASS" &&
      diagnosticResults.length === SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS;
    const runComplete = normalComplete && diagnosticComplete;
    checkpoint.markStatus(runComplete ? "COMPLETE" : "BLOCKED", {
      reason: runComplete
        ? "shared_runtime_diagnostic_completed"
        : selection?.status === "BLOCKED"
          ? "shared_runtime_candidate_selection_blocked"
          : "shared_runtime_diagnostic_incomplete",
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: runComplete ? "COMPLETE" : "BLOCKED",
      outcome: runComplete
        ? "SHARED_RUNTIME_DIAGNOSTIC_RECORDED"
        : "SHARED_RUNTIME_DIAGNOSTIC_INCOMPLETE",
      sourceIdentity: source,
      preflight,
      normalResults,
      diagnosticResults,
      selection,
      dbLockObservation,
      stageStatuses: {
        "SRD.1": "PASS",
        "SRD.2": normalResults.length === PHASE_4_3_JOURNEYS.length * SHARED_RUNTIME_NORMAL_REPETITIONS ? "COMPLETE" : "BLOCKED",
        "SRD.3": diagnosticResults.length ? "COMPLETE" : "BLOCKED",
        "SRD.4": "COMPLETE",
      },
    };
  } catch (error) {
    dbLockObservation = dbLockObservation ?? error.dbLockObservation ?? createDiagnosticDbLockSampler().summary();
    checkpoint.append("db.lock.summary", dbLockObservation);
    checkpoint.markStatus("BLOCKED", {
      reason: "shared_runtime_diagnostic_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "SHARED_RUNTIME_DIAGNOSTIC_RUNNER_BLOCKED",
      runtimeError: String(error?.message || "diagnostic_runner_failed").slice(0, 160),
      sourceIdentity: source,
      preflight,
      normalResults,
      diagnosticResults,
      selection,
      dbLockObservation,
      stageStatuses: { "SRD.1": "PASS", "SRD.2": "BLOCKED", "SRD.3": "BLOCKED", "SRD.4": "COMPLETE" },
    };
  }
}

function parseArguments(argv) {
  const options = { run: false, status: false, descriptor: false, writeEvidence: false, newRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`shared_runtime_argument_invalid:${arg}`);
  }
  return options;
}

function descriptorOutput() {
  return {
    phaseId: SHARED_RUNTIME_PHASE_ID,
    schemaVersion: SHARED_RUNTIME_SCHEMA_VERSION,
    planRevision: SHARED_RUNTIME_PLAN_REVISION,
    fixtureId: SHARED_RUNTIME_FIXTURE_ID,
    stageLedger: STAGE_LEDGER,
    journeys: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
    normalRepetitions: SHARED_RUNTIME_NORMAL_REPETITIONS,
    diagnosticRepetitions: SHARED_RUNTIME_DIAGNOSTIC_REPETITIONS,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    officialMeasurement: false,
    dbLockSamplingIntervalMs: 50,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(descriptorOutput(), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: SHARED_RUNTIME_CHECKPOINT_ROOT,
      phaseId: SHARED_RUNTIME_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Shared runtime diagnostic ready. Use --descriptor, --status, or --run.\n");
    return;
  }
  const result = await runSharedRuntimeDiagnostic({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
  });
  const evidence = buildSharedRuntimeEvidence(result);
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
