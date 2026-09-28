#!/usr/bin/env node

/**
 * Current-source J1 A1 -> B -> A2 comparison for the post-response shell
 * commit-ownership candidate. B changes only the process-scoped dirty
 * registration policy; every variant remains diagnostic-only and outside the
 * official acceptance sample.
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
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  buildPhase44ServerEnvironment,
  resolvePhase44LocalConfiguration,
  runMeasurementUnit,
  sanitizePhase44Evidence,
} from "./performance-plan-1-phase-4-4-local.mjs";
import { createDiagnosticDbLockSampler } from "./lib/diagnostic-db-lock-sampler.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const POST_RESPONSE_COMMIT_PLAN_REVISION = "plan1-final-v3";
export const POST_RESPONSE_COMMIT_PHASE_ID =
  "aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1";
export const POST_RESPONSE_COMMIT_SCHEMA_VERSION = POST_RESPONSE_COMMIT_PHASE_ID;
export const POST_RESPONSE_COMMIT_VARIABLE_ID = "shell_dirty_registration_policy";
export const POST_RESPONSE_COMMIT_DEFAULT_BASE_URL = "http://127.0.0.1:3161";
export const POST_RESPONSE_COMMIT_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const POST_RESPONSE_COMMIT_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const POST_RESPONSE_COMMIT_REPETITIONS = 3;
export const POST_RESPONSE_COMMIT_VARIANTS = Object.freeze([
  Object.freeze({ id: "A1", policy: "legacy" }),
  Object.freeze({ id: "B", policy: "stable" }),
  Object.freeze({ id: "A2", policy: "legacy" }),
]);
export const POST_RESPONSE_COMMIT_SOURCE_PATHS = Object.freeze([
  "app/src/lib/use-shell-dirty-registration.ts",
  "app/src/lib/phase-85-stage-5-shell-dirty-registry.ts",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/components/dashboard/authenticated-shell-boundary.tsx",
  "app/src/lib/phase-52-diagnostic.ts",
  "app/src/lib/performance-diagnostic.ts",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/scripts/lib/diagnostic-db-lock-sampler.mjs",
  "app/scripts/performance-plan-1-j1-post-response-commit-ownership-ab-a.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
]);

const J1_JOURNEY = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J1");
const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_STOP_TIMEOUT_MS = 10_000;
const BUILD_TIMEOUT_MS = 600_000;
const DB_DOCKER_CONTAINER = "supabase_db_manu-ai-local";

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const number = finite(value);
  return number == null ? null : Number(number.toFixed(3));
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

function sourceIdentity(configuration) {
  const status = gitOutput(["status", "--short", "--untracked-files=all"]) ?? "";
  return {
    cwd: repoRoot.replaceAll("\\", "/"),
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    statusLineCount: status ? status.split(/\r?\n/).filter(Boolean).length : 0,
    statusHash: hashText(status),
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
    variableId: POST_RESPONSE_COMMIT_VARIABLE_ID,
    variantPolicies: POST_RESPONSE_COMMIT_VARIANTS.map(({ id, policy }) => ({ id, policy })),
    configurationIdentity: configuration.identity,
    sourceFiles: POST_RESPONSE_COMMIT_SOURCE_PATHS.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

function normalizeBaseUrl(value) {
  const url = new URL(value || POST_RESPONSE_COMMIT_DEFAULT_BASE_URL);
  if (!url.port) url.port = "3161";
  return url.origin;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("post_response_commit_run_id_invalid");
  }
  return join(repoRoot, `${POST_RESPONSE_COMMIT_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
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

async function waitForServer(handle) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (handle.server.exitCode != null) throw new Error("post_response_commit_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The server may still be binding or loading the production artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("post_response_commit_server_timeout");
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

function variantEnvironment(configuration, policy) {
  return {
    ...configuration.environment,
    NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY: policy,
  };
}

function buildDiagnosticArtifact(environment, baseUrl, localStatus) {
  if (!existsSync(nextCliPath)) {
    return {
      status: "BLOCKED",
      reason: "next_cli_missing",
      exitCode: null,
      timedOut: false,
      artifactPresent: false,
    };
  }
  const serverEnvironment = buildPhase44ServerEnvironment(environment, "diagnostic", {
    baseUrl,
    localStatus,
  });
  const build = spawnSync(process.execPath, [nextCliPath, "build", "--webpack", "--profile"], {
    cwd: appRoot,
    env: serverEnvironment,
    stdio: "ignore",
    timeout: BUILD_TIMEOUT_MS,
    windowsHide: true,
  });
  return {
    status: build.status === 0 ? "PASS" : "BLOCKED",
    reason: build.status === 0 ? null : "diagnostic_build_failed",
    exitCode: build.status,
    timedOut: build.error?.code === "ETIMEDOUT",
    errorCode: build.error?.code ?? null,
    artifactPresent: existsSync(join(appRoot, ".next", "BUILD_ID")),
  };
}

function createDbSampler() {
  return createDiagnosticDbLockSampler({
    env: {
      ...process.env,
      AIYA_DB_DOCKER_CONTAINER:
        process.env.AIYA_DB_DOCKER_CONTAINER || DB_DOCKER_CONTAINER,
    },
  });
}

function profilerSummary(trace) {
  const events = Array.isArray(trace?.measurement?.longTasks?.phase52Events)
    ? trace.measurement.longTasks.phase52Events
    : [];
  const commits = events.filter((event) => event.name === "react_commit");
  const countByProfiler = {};
  const durationByProfiler = {};
  for (const event of commits) {
    const profilerId = String(event.profilerId ?? "unknown").slice(0, 80);
    countByProfiler[profilerId] = (countByProfiler[profilerId] ?? 0) + 1;
    durationByProfiler[profilerId] = roundMs(
      (durationByProfiler[profilerId] ?? 0) + (finite(event.actualDurationMs) ?? 0),
    );
  }
  return {
    totalCommitEvents: commits.length,
    countByProfiler,
    durationByProfiler,
    phase52EventCount: events.length,
    contextCommitEvents: events.filter((event) => String(event.name).includes("context_state_committed")).length,
  };
}

function requestSummary(trace) {
  const requests = Array.isArray(trace?.measurement?.requestSummary?.requests)
    ? trace.measurement.requestSummary.requests
    : [];
  return {
    total: requests.length,
    api: requests.filter((request) => String(request.route ?? "").startsWith("/api/")).length,
    document: requests.filter((request) => request.requestKind === "document").length,
    rsc: requests.filter((request) => request.requestKind === "rsc").length,
  };
}

export function summarizeDiagnosticResult(result, variant) {
  const trace = result?.trace ?? null;
  const second = trace?.actions?.second ?? {};
  const profilers = profilerSummary(trace);
  const requests = requestSummary(trace);
  const shellProviderCommits = profilers.countByProfiler["shell-provider"] ?? null;
  const dashboardShellCommits = profilers.countByProfiler["dashboard-shell"] ?? null;
  const authenticatedShellCommits = profilers.countByProfiler["authenticated-shell"] ?? null;
  const aiyaStateProviderCommits = profilers.countByProfiler["aiya-state-provider"] ?? null;
  const dashboardContentCommits = profilers.countByProfiler["dashboard-content"] ?? null;
  const policyMarker = (trace?.measurement?.longTasks?.phase52Events ?? [])
    .find((event) => event.name === "shell_dirty_registration_policy")?.policy ?? variant.policy;
  return {
    variantId: variant.id,
    policy: variant.policy,
    repetition: Number.isInteger(result?.repetition) ? result.repetition : null,
    validSample: result?.validSample === true,
    observationValidity: result?.observationValidity ?? null,
    functionalOutcome: result?.functionalOutcome ?? null,
    failureBoundary: result?.failureBoundary ?? null,
    trustedToReadyMs: finite(second.trustedEventAtMs) != null && finite(second.readyStateAtMs) != null
      ? roundMs(second.readyStateAtMs - second.trustedEventAtMs)
      : null,
    dispatchToReadyMs: finite(second.dispatchAtMs) != null && finite(second.readyStateAtMs) != null
      ? roundMs(second.readyStateAtMs - second.dispatchAtMs)
      : null,
    requestCount: requests.total,
    apiRequestCount: requests.api,
    documentRequestCount: requests.document,
    rscRequestCount: requests.rsc,
    shellProviderCommits,
    dashboardShellCommits,
    authenticatedShellCommits,
    aiyaStateProviderCommits,
    dashboardContentCommits,
    totalReactCommitEvents: profilers.totalCommitEvents,
    phase52EventCount: profilers.phase52EventCount,
    contextCommitEvents: profilers.contextCommitEvents,
    policyMarker: String(policyMarker ?? "").slice(0, 24) || null,
  };
}

function validSuccessfulRows(rows) {
  return rows.filter((row) => row.validSample === true && row.functionalOutcome === "SUCCESS");
}

function groupRows(results) {
  return Object.fromEntries(POST_RESPONSE_COMMIT_VARIANTS.map((variant) => [
    variant.id,
    results.filter((row) => row.variantId === variant.id).sort((left, right) => left.repetition - right.repetition),
  ]));
}

function compareMetric(rows, metric) {
  const a1 = rows.A1 ?? [];
  const b = rows.B ?? [];
  const a2 = rows.A2 ?? [];
  const comparisons = [];
  for (let repetition = 1; repetition <= POST_RESPONSE_COMMIT_REPETITIONS; repetition += 1) {
    const left = a1.find((row) => row.repetition === repetition);
    const middle = b.find((row) => row.repetition === repetition);
    const right = a2.find((row) => row.repetition === repetition);
    comparisons.push({
      repetition,
      a1: left?.[metric] ?? null,
      b: middle?.[metric] ?? null,
      a2: right?.[metric] ?? null,
      allValid: Boolean(
        left?.validSample === true &&
        middle?.validSample === true &&
        right?.validSample === true,
      ),
      bLowerThanBoth: finite(left?.[metric]) != null &&
        finite(middle?.[metric]) != null &&
        finite(right?.[metric]) != null &&
        middle[metric] < left[metric] &&
        middle[metric] < right[metric],
    });
  }
  return comparisons;
}

export function buildMeasuredEffect(results) {
  const rows = groupRows(results);
  const validity = Object.fromEntries(POST_RESPONSE_COMMIT_VARIANTS.map((variant) => {
    const variantRows = rows[variant.id] ?? [];
    const validRows = validSuccessfulRows(variantRows);
    return [variant.id, {
      attempted: `${variantRows.length}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
      validSuccessful: `${validRows.length}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
      observationValid: `${variantRows.filter((row) => row.observationValidity === "VALID").length}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
    }];
  }));
  const commitComparisons = compareMetric(rows, "shellProviderCommits");
  const speedComparisons = compareMetric(rows, "trustedToReadyMs");
  const fanoutComparisons = compareMetric(rows, "requestCount");
  const commitReductionRows = commitComparisons.filter((row) => row.allValid && row.bLowerThanBoth);
  const speedImprovementRows = speedComparisons.filter((row) => row.allValid && row.bLowerThanBoth);
  const fanoutInvariantRows = fanoutComparisons.filter((row) =>
    row.allValid && row.a1 === row.b && row.b === row.a2,
  );
  const bValidCount = validSuccessfulRows(rows.B ?? []).length;
  return {
    validity,
    rows,
    commitOwnership: {
      comparisons: commitComparisons,
      repeatableReductionAcrossFullyValidRows: commitReductionRows.length === POST_RESPONSE_COMMIT_REPETITIONS,
      reductionRowCount: commitReductionRows.length,
    },
    speed: {
      comparisons: speedComparisons,
      repeatableImprovementAcrossFullyValidRows: speedImprovementRows.length === POST_RESPONSE_COMMIT_REPETITIONS,
      improvementRowCount: speedImprovementRows.length,
    },
    requestFanout: {
      comparisons: fanoutComparisons,
      invariantAcrossFullyValidRows: fanoutInvariantRows.length === POST_RESPONSE_COMMIT_REPETITIONS,
      invariantRowCount: fanoutInvariantRows.length,
    },
    selectedJ1DiagnosticValidAndSuccessful: {
      A1: `${validSuccessfulRows(rows.A1 ?? []).length}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
      B: `${bValidCount}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
      A2: `${validSuccessfulRows(rows.A2 ?? []).length}/${POST_RESPONSE_COMMIT_REPETITIONS}`,
    },
  };
}

export function classifyMeasuredEffect(effect) {
  if (
    effect.commitOwnership.repeatableReductionAcrossFullyValidRows &&
    effect.requestFanout.invariantAcrossFullyValidRows
  ) {
    if (effect.speed.repeatableImprovementAcrossFullyValidRows) {
      return "POST_RESPONSE_COMMIT_OWNERSHIP_EFFECT_AND_SPEED_IMPROVEMENT_OBSERVED_GLOBAL_FREEZE_UNRESOLVED";
    }
    return "POST_RESPONSE_COMMIT_OWNERSHIP_EFFECT_OBSERVED_SPEED_UNRESOLVED_GLOBAL_FREEZE_UNRESOLVED";
  }
  if (effect.commitOwnership.reductionRowCount > 0) {
    return "POST_RESPONSE_COMMIT_OWNERSHIP_SIGNAL_OBSERVED_VALIDITY_OR_FANOUT_BOUNDARY_OPEN";
  }
  return "POST_RESPONSE_COMMIT_OWNERSHIP_COMPARISON_INCONCLUSIVE_GLOBAL_FREEZE_UNRESOLVED";
}

function checkpointResults(runId) {
  const persisted = readPhaseRun({
    root: POST_RESPONSE_COMMIT_CHECKPOINT_ROOT,
    phaseId: POST_RESPONSE_COMMIT_PHASE_ID,
    runId,
  });
  return {
    persisted,
    results: persisted.events
      .filter((event) => event.type === "measurement.unit.trace")
      .map((event) => event.payload),
  };
}

function phaseIdentity({ baseUrl, configuration, source }) {
  return {
    planRevision: POST_RESPONSE_COMMIT_PLAN_REVISION,
    phaseId: POST_RESPONSE_COMMIT_PHASE_ID,
    phaseSchemaVersion: POST_RESPONSE_COMMIT_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "current_source_j1_post_response_commit_ownership_ab_a",
    variableId: POST_RESPONSE_COMMIT_VARIABLE_ID,
    variants: POST_RESPONSE_COMMIT_VARIANTS,
    journeyId: "J1",
    repetitionsPerVariant: POST_RESPONSE_COMMIT_REPETITIONS,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    configurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  };
}

function createMetadata(identity, configuration) {
  return {
    identitySummary: {
      phaseId: identity.phaseId,
      fixtureId: identity.fixtureId,
      baseOrigin: identity.baseOrigin,
      sourceHead: identity.sourceHead,
      variableId: identity.variableId,
      variants: identity.variants,
      officialMeasurement: false,
    },
    measurementContract: {
      journeyId: "J1",
      repetitionsPerVariant: POST_RESPONSE_COMMIT_REPETITIONS,
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      variableId: POST_RESPONSE_COMMIT_VARIABLE_ID,
      variants: POST_RESPONSE_COMMIT_VARIANTS,
      countedAsOfficialSample: false,
    },
    configurationSummary: configuration.summary,
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

function preflight(configuration, localStatus, baseUrl) {
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
    credentialsAvailable: {
      email: Boolean(configuration.email),
      password: Boolean(configuration.password),
    },
    localSupabase: localStatusSummary(localStatus),
    blockers,
  };
}

async function runExperiment({ baseUrl, newRun = false } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const configuration = resolvePhase44LocalConfiguration();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(configuration);
  const identity = phaseIdentity({ baseUrl: normalizedBaseUrl, configuration, source });
  const opened = openPhaseRun({
    root: POST_RESPONSE_COMMIT_CHECKPOINT_ROOT,
    phaseId: POST_RESPONSE_COMMIT_PHASE_ID,
    phaseSchemaVersion: POST_RESPONSE_COMMIT_SCHEMA_VERSION,
    identity,
    metadata: createMetadata(identity, configuration),
    newRun,
    redact: sanitizePhase44Evidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = checkpointResults(opened.manifest.runId);
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "POST_RESPONSE_COMMIT_CHECKPOINT_REUSED",
      source,
      configuration,
      preflight: persisted.persisted.events.find((event) => event.type === "environment.preflight")?.payload ?? null,
      results: persisted.results,
      variantBuilds: persisted.persisted.events
        .filter((event) => event.type === "environment.variant_build")
        .map((event) => event.payload),
      dbSampler: persisted.persisted.events.find((event) => event.type === "db.lock.summary")?.payload ?? null,
      checkpoint: {
        status: persisted.persisted.manifest.status,
        eventCount: persisted.persisted.events.length,
        hashChainRead: true,
      },
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`post_response_commit_checkpoint_${String(opened.action ?? "unknown").toLowerCase()}`);
  }
  const checkpoint = opened.run;
  const inputPreflight = preflight(configuration, localStatus, normalizedBaseUrl);
  checkpoint.append("environment.preflight", inputPreflight, {
    status: inputPreflight.status === "PASS" ? "RUNNING" : "BLOCKED",
  });
  if (inputPreflight.status !== "PASS") {
    checkpoint.markStatus("BLOCKED", { reason: "post_response_commit_preflight_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "POST_RESPONSE_COMMIT_PREFLIGHT_BLOCKED",
      source,
      configuration,
      preflight: inputPreflight,
      results: [],
      variantBuilds: [],
      dbSampler: null,
      checkpoint: { status: "BLOCKED", eventCount: null, hashChainRead: false },
    };
  }

  const results = [];
  const variantBuilds = [];
  const dbSamplers = [];
  let serverHandle = null;
  let browser = null;
  let runError = null;
  try {
    browser = await chromium.launch({ headless: true });
    for (const variant of POST_RESPONSE_COMMIT_VARIANTS) {
      const environment = variantEnvironment(configuration, variant.policy);
      const build = buildDiagnosticArtifact(environment, normalizedBaseUrl, localStatus);
      const buildRecord = { variantId: variant.id, policy: variant.policy, ...build };
      variantBuilds.push(buildRecord);
      checkpoint.append("environment.variant_build", buildRecord, {
        status: build.status === "PASS" ? "RUNNING" : "BLOCKED",
      });
      if (build.status !== "PASS") throw new Error(`post_response_commit_${variant.id.toLowerCase()}_build_blocked`);
      await stopLocalServer(serverHandle);
      serverHandle = startLocalServer(
        buildPhase44ServerEnvironment(environment, "diagnostic", {
          baseUrl: normalizedBaseUrl,
          localStatus,
        }),
        normalizedBaseUrl,
      );
      await waitForServer(serverHandle);
      const sampler = createDbSampler();
      await sampler.start();
      for (let repetition = 1; repetition <= POST_RESPONSE_COMMIT_REPETITIONS; repetition += 1) {
        const result = await runMeasurementUnit({
          browser,
          baseUrl: normalizedBaseUrl,
          mode: "diagnostic",
          journey: J1_JOURNEY,
          repetition,
          unitKey: `${variant.id}:diagnostic:J1:r${repetition}`,
          scope: "j1_post_response_commit_ownership_ab_a",
          email: configuration.email,
          password: configuration.password,
          checkpoint,
        });
        results.push({ variantId: variant.id, policy: variant.policy, ...result });
      }
      await sampler.stop();
      const samplerSummary = sampler.summary();
      dbSamplers.push({ variantId: variant.id, policy: variant.policy, ...samplerSummary });
      checkpoint.append("db.lock.summary", {
        variantId: variant.id,
        policy: variant.policy,
        ...samplerSummary,
      });
      await stopLocalServer(serverHandle);
      serverHandle = null;
    }
    checkpoint.markStatus("COMPLETE", {
      reason: "post_response_commit_ab_a_completed",
      countedAsOfficialSample: false,
    });
    return {
      runId: checkpoint.runId,
      status: "COMPLETE",
      source,
      configuration,
      preflight: inputPreflight,
      results,
      variantBuilds,
      dbSampler: dbSamplers,
      checkpoint: { status: "COMPLETE", eventCount: null, hashChainRead: true },
    };
  } catch (error) {
    runError = String(error?.message || "post_response_commit_runner_failed").slice(0, 180);
    checkpoint.markStatus("BLOCKED", {
      reason: "post_response_commit_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 80),
      runtimeError: runError,
      countedAsOfficialSample: false,
    });
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "POST_RESPONSE_COMMIT_RUNNER_BLOCKED",
      runtimeError: runError,
      source,
      configuration,
      preflight: inputPreflight,
      results,
      variantBuilds,
      dbSampler: dbSamplers,
      checkpoint: { status: "BLOCKED", eventCount: null, hashChainRead: true },
    };
  } finally {
    await stopLocalServer(serverHandle);
    if (browser) await browser.close();
    checkpoint.close();
  }
}

export function buildEvidence(result, { generatedAt = new Date().toISOString() } = {}) {
  const summarizedResults = (result.results ?? []).map((item) => {
    const variant = POST_RESPONSE_COMMIT_VARIANTS.find((candidate) => candidate.id === item.variantId) ?? {
      id: item.variantId,
      policy: item.policy,
    };
    return summarizeDiagnosticResult(item, variant);
  });
  const measuredEffect = buildMeasuredEffect(summarizedResults);
  const outcome = result.outcome ?? (
    result.status === "BLOCKED"
      ? "POST_RESPONSE_COMMIT_RUNNER_BLOCKED"
      : classifyMeasuredEffect(measuredEffect)
  );
  const selectedValid = measuredEffect.selectedJ1DiagnosticValidAndSuccessful;
  const sourceMeasurementRunId = result.runId ?? null;
  return sanitizePhase44Evidence({
    schemaVersion: POST_RESPONSE_COMMIT_SCHEMA_VERSION,
    planRevision: POST_RESPONSE_COMMIT_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-post-response-commit-ownership-ab-a",
    stageId: POST_RESPONSE_COMMIT_PHASE_ID,
    runId: sourceMeasurementRunId,
    generatedAt,
    status: result.status ?? "BLOCKED",
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Current-source local diagnostic A1 legacy -> B stable -> A2 legacy comparison of post-response shell commit ownership at the J1 second-action boundary.",
      analysisOnly: false,
      browserRerunStarted: true,
      applicationRuntimeChanged: false,
      processScopedDiagnosticVariable: POST_RESPONSE_COMMIT_VARIABLE_ID,
      officialMeasurementStarted: false,
      causalExperimentStarted: true,
      countedAsOfficialSample: false,
      externalOperations: [],
      fixture: "local-normal synthetic owner",
      targetJourney: "J1",
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: POST_RESPONSE_COMMIT_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    hypothesis: {
      id: "post_response_state_commit_ownership",
      variableId: POST_RESPONSE_COMMIT_VARIABLE_ID,
      A1: "legacy registration dependency",
      B: "stable saveRef dependency",
      A2: "legacy registration dependency",
      heldConstant: [
        "J1 journey and synthetic fixture",
        "diagnostic browser instrumentation",
        "auth/RLS/store path",
        "request fan-out contract",
        "required-read validity gate",
        "local Supabase target",
      ],
    },
    sourceIdentity: result.source,
    measurementIdentity: {
      checkpointPhaseId: POST_RESPONSE_COMMIT_PHASE_ID,
      checkpointSchemaVersion: POST_RESPONSE_COMMIT_SCHEMA_VERSION,
      checkpointStore: "tools/phase-execution/checkpoint-store.mjs",
      fixtureId: "local-normal",
      journeyId: "J1",
      repetitionsPerVariant: POST_RESPONSE_COMMIT_REPETITIONS,
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      variants: POST_RESPONSE_COMMIT_VARIANTS,
      countedAsOfficialSample: false,
    },
    runReferences: {
      sourceMeasurementRunId,
      variantBuilds: result.variantBuilds ?? [],
      checkpoint: result.checkpoint ?? null,
    },
    selectedJ1DiagnosticMetrics: measuredEffect.rows,
    measuredEffect: {
      ...measuredEffect,
      dbSampler: result.dbSampler ?? null,
    },
    validity: {
      A1: selectedValid.A1,
      B: selectedValid.B,
      A2: selectedValid.A2,
      officialSample: false,
      noRetryPromotion: true,
      causalThreeValidRecordGate: selectedValid.B === "3/3" ? "MET_FOR_SELECTED_J1_B" : "NOT_MET_FOR_SELECTED_J1_B",
    },
    conclusion: classifyMeasuredEffect(measuredEffect),
    explicitNonClaims: [
      "A commit-count reversal is a contributing-boundary observation, not proof of the global freeze root cause.",
      "The official nine-scenario acceptance contract is not exercised by this run.",
      "Invalid or failed required-read repetitions are retained and excluded; no retry is promoted.",
      "No production runtime fix, Plan 2 finding, migration, deployment, or production decision changed.",
      "DB sampler results are bounded local observations and do not prove lock absence outside these windows.",
    ],
    redaction: {
      rawBodiesRecorded: false,
      credentialsRecorded: false,
      rawClientIdentifiersRecorded: false,
      policy: "sanitizePhase44Evidence",
    },
    closure: {
      status: result.status ?? "BLOCKED",
      outcome,
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      findingDispositionChanged: false,
      runtimeFixAccepted: false,
      plan2EntryAuthorized: false,
      productionDecision: "NO-GO",
    },
  });
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    writeEvidence: false,
    newRun: false,
    baseUrl: process.env.AIYA_POST_RESPONSE_COMMIT_BASE_URL || POST_RESPONSE_COMMIT_DEFAULT_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`post_response_commit_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: POST_RESPONSE_COMMIT_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_COMMIT_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 post-response commit ownership A-B-A ready. Use --run explicitly.\n");
    return;
  }
  const result = await runExperiment({ baseUrl: options.baseUrl, newRun: options.newRun });
  const evidence = buildEvidence(result);
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
