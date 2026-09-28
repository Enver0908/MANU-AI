/**
 * Current-source J1 A1 -> B -> A2 comparison for the post-response shell
 * commit-ownership candidate, guarded by the established fan-out envelope.
 *
 * B changes only the process-scoped dirty-registration policy. The run is
 * diagnostic-only and remains outside the official nine-scenario sample.
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
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  buildPhase44ServerEnvironment,
  resolvePhase44LocalConfiguration,
  runMeasurementUnit,
} from "./performance-plan-1-phase-4-4-local.mjs";
import {
  FANOUT_BASELINE_ENVELOPE,
  sanitizeFanoutBaselineEvidence,
  summarizeBaselineSample,
} from "./performance-plan-1-j1-fanout-envelope-baseline.mjs";
import { createDiagnosticDbLockSampler } from "./lib/diagnostic-db-lock-sampler.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const POST_RESPONSE_ENVELOPE_PLAN_REVISION = "plan1-final-v3";
export const POST_RESPONSE_ENVELOPE_PHASE_ID =
  "aiya-performance-plan1-j1-post-response-commit-envelope-ab-a-v1";
export const POST_RESPONSE_ENVELOPE_SCHEMA_VERSION = POST_RESPONSE_ENVELOPE_PHASE_ID;
export const POST_RESPONSE_ENVELOPE_VARIABLE_ID = "shell_dirty_registration_policy";
export const POST_RESPONSE_ENVELOPE_DEFAULT_BASE_URL = "http://127.0.0.1:3167";
export const POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const POST_RESPONSE_ENVELOPE_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
export const POST_RESPONSE_ENVELOPE_REPETITIONS = 3;
export const POST_RESPONSE_ENVELOPE_VARIANTS = Object.freeze([
  Object.freeze({ id: "A1", policy: "legacy" }),
  Object.freeze({ id: "B", policy: "stable" }),
  Object.freeze({ id: "A2", policy: "legacy" }),
]);
export const POST_RESPONSE_ENVELOPE_SOURCE_PATHS = Object.freeze([
  "app/src/lib/use-shell-dirty-registration.ts",
  "app/src/lib/phase-85-stage-5-shell-dirty-registry.ts",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/components/dashboard/authenticated-shell-boundary.tsx",
  "app/src/lib/phase-52-diagnostic.ts",
  "app/src/lib/performance-diagnostic.ts",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
  "app/scripts/performance-plan-1-j1-fanout-envelope-baseline.mjs",
  "app/scripts/lib/diagnostic-db-lock-sampler.mjs",
  "app/scripts/performance-plan-1-j1-post-response-commit-envelope-ab-a.mjs",
  "app/package.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
]);

const J1_JOURNEY = PHASE_4_3_JOURNEYS.find((journey) => journey.journeyId === "J1");
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
    variableId: POST_RESPONSE_ENVELOPE_VARIABLE_ID,
    variantPolicies: POST_RESPONSE_ENVELOPE_VARIANTS.map(({ id, policy }) => ({ id, policy })),
    configurationIdentity: configuration.identity,
    sourceFiles: POST_RESPONSE_ENVELOPE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: hashFile(join(repoRoot, path)),
    })),
  };
}

function normalizeBaseUrl(value) {
  const url = new URL(value || POST_RESPONSE_ENVELOPE_DEFAULT_BASE_URL);
  if (!url.port) url.port = "3167";
  return url.origin;
}

export function postResponseEnvelopeDistDir(runId, variantId) {
  const suffix = String(runId ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(-32) || "unknown";
  const variant = String(variantId ?? "unknown")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .toLowerCase();
  return `.next-post-response-envelope-${suffix}-${variant}`;
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("post_response_envelope_run_id_invalid");
  }
  return join(repoRoot, `${POST_RESPONSE_ENVELOPE_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
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

async function waitForServer(handle) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PHASE_4_3_READY_TIMEOUT_MS) {
    if (handle.server.exitCode != null) throw new Error("post_response_envelope_server_exited");
    try {
      const response = await fetch(`${handle.baseUrl}/login?next=/dashboard`, { cache: "no-store" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The server may still be binding or loading the variant artifact.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("post_response_envelope_server_timeout");
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

function buildDiagnosticArtifact(environment, baseUrl, localStatus, distDir) {
  if (!existsSync(nextCliPath)) {
    return {
      status: "BLOCKED",
      reason: "next_cli_missing",
      exitCode: null,
      timedOut: false,
      artifactPresent: false,
      distDir,
    };
  }
  const buildEnvironment = buildPhase44ServerEnvironment(
    { ...environment, AIYA_PHASE55_DIST_DIR: distDir },
    "diagnostic",
    { baseUrl, localStatus },
  );
  const build = spawnSync(process.execPath, [nextCliPath, "build", "--webpack", "--profile"], {
    cwd: appRoot,
    env: buildEnvironment,
    stdio: "ignore",
    timeout: BUILD_TIMEOUT_MS,
    windowsHide: true,
  });
  return {
    status: build.status === 0 && existsSync(join(appRoot, distDir, "BUILD_ID"))
      ? "PASS"
      : "BLOCKED",
    reason: build.status === 0 ? "diagnostic_build_artifact_missing" : "diagnostic_build_failed",
    exitCode: build.status,
    timedOut: build.error?.code === "ETIMEDOUT",
    errorCode: build.error?.code ?? null,
    artifactPresent: existsSync(join(appRoot, distDir, "BUILD_ID")),
    distDir,
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

export function summarizeEnvelopeDiagnosticResult(result, variant) {
  const trace = result?.trace ?? null;
  const second = trace?.actions?.second ?? {};
  const profilers = profilerSummary(trace);
  const requests = requestSummary(trace);
  const baselineValidity = summarizeBaselineSample(result);
  const policyMarker = (trace?.measurement?.longTasks?.phase52Events ?? [])
    .find((event) => event.name === "shell_dirty_registration_policy")?.policy ?? variant.policy;
  return {
    variantId: variant.id,
    policy: variant.policy,
    repetition: Number.isInteger(result?.repetition) ? result.repetition : null,
    validSample: result?.validSample === true,
    observationValidity: result?.observationValidity ?? null,
    functionalOutcome: result?.functionalOutcome ?? null,
    eligible: baselineValidity.eligible,
    fanout: baselineValidity.fanout,
    requiredReads: baselineValidity.requiredReads,
    formsLifecycle: baselineValidity.formsLifecycle,
    failureBoundary: baselineValidity.failureBoundary,
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
    shellProviderCommits: profilers.countByProfiler["shell-provider"] ?? null,
    dashboardShellCommits: profilers.countByProfiler["dashboard-shell"] ?? null,
    authenticatedShellCommits: profilers.countByProfiler["authenticated-shell"] ?? null,
    aiyaStateProviderCommits: profilers.countByProfiler["aiya-state-provider"] ?? null,
    dashboardContentCommits: profilers.countByProfiler["dashboard-content"] ?? null,
    totalReactCommitEvents: profilers.totalCommitEvents,
    phase52EventCount: profilers.phase52EventCount,
    contextCommitEvents: profilers.contextCommitEvents,
    policyMarker: String(policyMarker ?? "").slice(0, 24) || null,
  };
}

function validRows(rows) {
  return rows.filter((row) => row.eligible === true);
}

function groupRows(results) {
  return Object.fromEntries(POST_RESPONSE_ENVELOPE_VARIANTS.map((variant) => [
    variant.id,
    results
      .filter((row) => row.variantId === variant.id)
      .sort((left, right) => left.repetition - right.repetition),
  ]));
}

function rowFor(rows, variantId, repetition) {
  return (rows[variantId] ?? []).find((row) => row.repetition === repetition) ?? null;
}

function sameFanoutShape(left, right) {
  return left?.fanout?.totalRequests === right?.fanout?.totalRequests &&
    left?.fanout?.apiRequests === right?.fanout?.apiRequests &&
    left?.fanout?.documentRequests === right?.fanout?.documentRequests &&
    left?.fanout?.rscRequests === right?.fanout?.rscRequests &&
    JSON.stringify(left?.fanout?.apiRouteCounts ?? {}) ===
      JSON.stringify(right?.fanout?.apiRouteCounts ?? {});
}

export function compareEnvelopeMetric(rows, metric) {
  const comparisons = [];
  for (let repetition = 1; repetition <= POST_RESPONSE_ENVELOPE_REPETITIONS; repetition += 1) {
    const a1 = rowFor(rows, "A1", repetition);
    const b = rowFor(rows, "B", repetition);
    const a2 = rowFor(rows, "A2", repetition);
    const allEligible = Boolean(a1?.eligible && b?.eligible && a2?.eligible);
    comparisons.push({
      repetition,
      a1: a1?.[metric] ?? null,
      b: b?.[metric] ?? null,
      a2: a2?.[metric] ?? null,
      allEligible,
      bLowerThanBoth: allEligible &&
        finite(a1?.[metric]) != null &&
        finite(b?.[metric]) != null &&
        finite(a2?.[metric]) != null &&
        b[metric] < a1[metric] &&
        b[metric] < a2[metric],
    });
  }
  return comparisons;
}

export function buildEnvelopeMeasuredEffect(results) {
  const rows = groupRows(results);
  const validity = Object.fromEntries(POST_RESPONSE_ENVELOPE_VARIANTS.map((variant) => {
    const variantRows = rows[variant.id] ?? [];
    return [variant.id, {
      attempted: `${variantRows.length}/${POST_RESPONSE_ENVELOPE_REPETITIONS}`,
      eligible: `${validRows(variantRows).length}/${POST_RESPONSE_ENVELOPE_REPETITIONS}`,
      observationValid: `${variantRows.filter((row) => row.observationValidity === "VALID").length}/${POST_RESPONSE_ENVELOPE_REPETITIONS}`,
      fanoutEnvelopePass: `${variantRows.filter((row) => row.fanout?.status === "PASS").length}/${POST_RESPONSE_ENVELOPE_REPETITIONS}`,
      formsLifecyclePass: `${variantRows.filter((row) => row.formsLifecycle?.status === "PASS").length}/${POST_RESPONSE_ENVELOPE_REPETITIONS}`,
    }];
  }));
  const fanoutInvariantComparisons = [];
  for (let repetition = 1; repetition <= POST_RESPONSE_ENVELOPE_REPETITIONS; repetition += 1) {
    const a1 = rowFor(rows, "A1", repetition);
    const b = rowFor(rows, "B", repetition);
    const a2 = rowFor(rows, "A2", repetition);
    const allEligible = Boolean(a1?.eligible && b?.eligible && a2?.eligible);
    fanoutInvariantComparisons.push({
      repetition,
      allEligible,
      exactMatch: allEligible && sameFanoutShape(a1, b) && sameFanoutShape(b, a2),
      a1: a1?.fanout ?? null,
      b: b?.fanout ?? null,
      a2: a2?.fanout ?? null,
    });
  }
  const matchedFanoutRows = fanoutInvariantComparisons.filter((row) => row.exactMatch);
  const strictCandidateGate =
    validRows(rows.B ?? []).length === POST_RESPONSE_ENVELOPE_REPETITIONS &&
    matchedFanoutRows.length === POST_RESPONSE_ENVELOPE_REPETITIONS;
  const commitComparisons = compareEnvelopeMetric(rows, "shellProviderCommits");
  const speedComparisons = compareEnvelopeMetric(rows, "trustedToReadyMs");
  const commitReductionRows = commitComparisons.filter((row) => row.bLowerThanBoth);
  const speedImprovementRows = speedComparisons.filter((row) => row.bLowerThanBoth);
  return {
    validity,
    rows,
    requestFanout: {
      comparisons: fanoutInvariantComparisons,
      matchedAcrossEligibleRows: matchedFanoutRows.length === POST_RESPONSE_ENVELOPE_REPETITIONS,
      matchedRowCount: matchedFanoutRows.length,
    },
    candidateGate: {
      BEligible: validity.B?.eligible === "3/3",
      matchedFanoutInvariant: matchedFanoutRows.length === POST_RESPONSE_ENVELOPE_REPETITIONS,
      strictThreeVariantGate: strictCandidateGate,
    },
    commitOwnership: {
      comparisons: commitComparisons,
      repeatableReductionAcrossStrictRows: strictCandidateGate && commitReductionRows.length === POST_RESPONSE_ENVELOPE_REPETITIONS,
      reductionRowCount: commitReductionRows.length,
    },
    speed: {
      comparisons: speedComparisons,
      repeatableImprovementAcrossStrictRows: strictCandidateGate && speedImprovementRows.length === POST_RESPONSE_ENVELOPE_REPETITIONS,
      improvementRowCount: speedImprovementRows.length,
    },
  };
}

export function classifyEnvelopeMeasuredEffect(effect) {
  if (!effect.candidateGate.strictThreeVariantGate) {
    return "POST_RESPONSE_COMMIT_ENVELOPE_VALIDITY_OPEN_GLOBAL_FREEZE_UNRESOLVED";
  }
  if (effect.commitOwnership.repeatableReductionAcrossStrictRows) {
    if (effect.speed.repeatableImprovementAcrossStrictRows) {
      return "POST_RESPONSE_COMMIT_OWNERSHIP_EFFECT_AND_SPEED_IMPROVEMENT_OBSERVED_GLOBAL_FREEZE_UNRESOLVED";
    }
    return "POST_RESPONSE_COMMIT_OWNERSHIP_EFFECT_OBSERVED_SPEED_UNRESOLVED_GLOBAL_FREEZE_UNRESOLVED";
  }
  return "POST_RESPONSE_COMMIT_ENVELOPE_CONTROLLED_COMPARISON_INCONCLUSIVE_GLOBAL_FREEZE_UNRESOLVED";
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

function completedResultsFromEvents(events) {
  const traces = new Map();
  const completed = new Set();
  for (const event of events ?? []) {
    const unitKey = event.payload?.unitKey;
    if (!unitKey) continue;
    if (event.type === "measurement.unit.trace") traces.set(unitKey, event.payload);
    if (event.type === "measurement.unit.completed") completed.add(unitKey);
  }
  return [...completed]
    .filter((unitKey) => traces.has(unitKey))
    .map((unitKey) => {
      const result = traces.get(unitKey);
      const variantId = String(unitKey).split(":", 1)[0];
      const variant = POST_RESPONSE_ENVELOPE_VARIANTS.find((item) => item.id === variantId);
      return {
        variantId,
        policy: variant?.policy ?? null,
        ...result,
      };
    });
}

function phaseIdentity({ baseUrl, configuration, source }) {
  return {
    planRevision: POST_RESPONSE_ENVELOPE_PLAN_REVISION,
    phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
    phaseSchemaVersion: POST_RESPONSE_ENVELOPE_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "current_source_j1_post_response_commit_envelope_ab_a",
    variableId: POST_RESPONSE_ENVELOPE_VARIABLE_ID,
    variants: POST_RESPONSE_ENVELOPE_VARIANTS,
    journeyId: "J1",
    repetitionsPerVariant: POST_RESPONSE_ENVELOPE_REPETITIONS,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    fanoutEnvelope: FANOUT_BASELINE_ENVELOPE,
    lifecycleGate: "one_forms_setup_start_success_and_zero_forms_abort",
    configurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
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
    localSupabase: {
      status: localStatus.status,
      targetHost: "127.0.0.1:54321",
      urlIsLocal: localStatus.urlIsLocal === true,
      credentialsPresent: {
        anonKey: Boolean(localStatus.anonKey),
        serviceRoleKey: Boolean(localStatus.serviceRoleKey),
      },
    },
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
    root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
    phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
    phaseSchemaVersion: POST_RESPONSE_ENVELOPE_SCHEMA_VERSION,
    identity,
    metadata: {
      contract: identity,
      countedAsOfficialSample: false,
    },
    newRun,
    redact: sanitizeFanoutBaselineEvidence,
  });
  if (opened.action === "COMPLETE") {
    const persisted = readPhaseRun({
      root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "POST_RESPONSE_COMMIT_ENVELOPE_CHECKPOINT_REUSED",
      source,
      preflight: persisted.events.find((event) => event.type === "environment.preflight")?.payload ?? null,
      results: completedResultsFromEvents(persisted.events),
      variantBuilds: persisted.events
        .filter((event) => event.type === "environment.variant_build")
        .map((event) => event.payload),
      dbSampler: persisted.events.filter((event) => event.type === "db.lock.summary").map((event) => event.payload),
      checkpoint: checkpointSummary(persisted),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`post_response_envelope_checkpoint_${String(opened.action ?? "unknown").toLowerCase()}`);
  }

  const checkpoint = opened.run;
  const inputPreflight = preflight(configuration, localStatus, normalizedBaseUrl);
  checkpoint.append("environment.preflight", inputPreflight, {
    status: inputPreflight.status === "PASS" ? "RUNNING" : "BLOCKED",
  });
  if (inputPreflight.status !== "PASS") {
    checkpoint.markStatus("BLOCKED", { reason: "post_response_envelope_preflight_blocked" });
    checkpoint.close();
    const persisted = readPhaseRun({
      root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "POST_RESPONSE_COMMIT_ENVELOPE_PREFLIGHT_BLOCKED",
      source,
      preflight: inputPreflight,
      results: [],
      variantBuilds: [],
      dbSampler: [],
      checkpoint: checkpointSummary(persisted),
    };
  }

  const results = completedResultsFromEvents(checkpoint.events);
  const variantBuilds = [];
  const dbSamplers = [];
  let serverHandle = null;
  let browser = null;
  try {
    if (!J1_JOURNEY) throw new Error("post_response_envelope_j1_journey_missing");
    browser = await chromium.launch({ headless: true });
    for (const variant of POST_RESPONSE_ENVELOPE_VARIANTS) {
      const environment = variantEnvironment(configuration, variant.policy);
      const distDir = postResponseEnvelopeDistDir(checkpoint.runId, variant.id);
      const build = buildDiagnosticArtifact(environment, normalizedBaseUrl, localStatus, distDir);
      const buildRecord = { variantId: variant.id, policy: variant.policy, ...build };
      variantBuilds.push(buildRecord);
      checkpoint.append("environment.variant_build", buildRecord, {
        status: build.status === "PASS" ? "RUNNING" : "BLOCKED",
      });
      if (build.status !== "PASS") {
        throw new Error(`post_response_envelope_${variant.id.toLowerCase()}_build_blocked`);
      }
      await stopLocalServer(serverHandle);
      const serverEnvironment = buildPhase44ServerEnvironment(
        { ...environment, AIYA_PHASE55_DIST_DIR: distDir },
        "diagnostic",
        { baseUrl: normalizedBaseUrl, localStatus },
      );
      serverHandle = startLocalServer(serverEnvironment, normalizedBaseUrl);
      await waitForServer(serverHandle);
      const sampler = createDbSampler();
      await sampler.start();
      try {
        for (let repetition = 1; repetition <= POST_RESPONSE_ENVELOPE_REPETITIONS; repetition += 1) {
          const unitKey = `${variant.id}:diagnostic:J1:r${repetition}`;
          if (results.some((result) => result.unitKey === unitKey)) continue;
          const result = await runMeasurementUnit({
            browser,
            baseUrl: normalizedBaseUrl,
            mode: "diagnostic",
            journey: J1_JOURNEY,
            repetition,
            unitKey,
            scope: "j1_post_response_commit_envelope_ab_a",
            email: configuration.email,
            password: configuration.password,
            // A1/B/A2 is runner metadata; phase-4.3 controlVariant only accepts
            // its own journey-control enum and rejects arbitrary experiment IDs.
            controlVariant: null,
            traceVariant: null,
            checkpoint,
          });
          results.push({ variantId: variant.id, policy: variant.policy, ...result });
        }
      } finally {
        await sampler.stop();
      }
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
    const attempted = results.length === POST_RESPONSE_ENVELOPE_VARIANTS.length * POST_RESPONSE_ENVELOPE_REPETITIONS;
    checkpoint.markStatus(attempted ? "COMPLETE" : "BLOCKED", {
      reason: attempted
        ? "post_response_commit_envelope_ab_a_completed"
        : "post_response_commit_envelope_ab_a_incomplete",
      countedAsOfficialSample: false,
    });
    const persisted = readPhaseRun({
      root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: attempted ? "COMPLETE" : "BLOCKED",
      source,
      preflight: inputPreflight,
      results,
      variantBuilds,
      dbSampler: dbSamplers,
      checkpoint: checkpointSummary(persisted),
    };
  } catch (error) {
    const runtimeError = String(error?.message || "post_response_envelope_runner_failed").slice(0, 180);
    checkpoint.markStatus("BLOCKED", {
      reason: "post_response_envelope_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 80),
      runtimeError,
      countedAsOfficialSample: false,
    });
    const persisted = readPhaseRun({
      root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
      runId: checkpoint.runId,
    });
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "POST_RESPONSE_COMMIT_ENVELOPE_RUNNER_BLOCKED",
      runtimeError,
      source,
      preflight: inputPreflight,
      results,
      variantBuilds,
      dbSampler: dbSamplers,
      checkpoint: checkpointSummary(persisted),
    };
  } finally {
    await stopLocalServer(serverHandle);
    if (browser) await browser.close();
    checkpoint.close();
  }
}

export function buildEnvelopeEvidence(result, { generatedAt = new Date().toISOString() } = {}) {
  const summarizedResults = (result.results ?? []).map((item) => {
    const variant = POST_RESPONSE_ENVELOPE_VARIANTS.find((candidate) => candidate.id === item.variantId) ?? {
      id: item.variantId,
      policy: item.policy,
    };
    return summarizeEnvelopeDiagnosticResult(item, variant);
  });
  const measuredEffect = buildEnvelopeMeasuredEffect(summarizedResults);
  const outcome = result.outcome ?? (
    result.status === "BLOCKED"
      ? "POST_RESPONSE_COMMIT_ENVELOPE_RUNNER_BLOCKED"
      : classifyEnvelopeMeasuredEffect(measuredEffect)
  );
  const sourceMeasurementRunId = result.runId ?? null;
  return sanitizeFanoutBaselineEvidence({
    schemaVersion: POST_RESPONSE_ENVELOPE_SCHEMA_VERSION,
    planRevision: POST_RESPONSE_ENVELOPE_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-post-response-commit-envelope-ab-a",
    stageId: POST_RESPONSE_ENVELOPE_PHASE_ID,
    runId: sourceMeasurementRunId,
    generatedAt,
    status: result.status ?? "BLOCKED",
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Current-source local diagnostic A1 legacy -> B stable -> A2 legacy comparison with the established J1 fan-out and Forms lifecycle control gates.",
      analysisOnly: false,
      browserRerunStarted: true,
      applicationRuntimeChanged: false,
      processScopedDiagnosticVariable: POST_RESPONSE_ENVELOPE_VARIABLE_ID,
      officialMeasurementStarted: false,
      causalExperimentStarted: true,
      countedAsOfficialSample: false,
      externalOperations: [],
      fixture: "local-normal synthetic owner",
      targetJourney: "J1",
      diagnosticBuildDistDirPolicy: "run_scoped_variant_specific_separate_dist_dir",
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: POST_RESPONSE_ENVELOPE_PLAN_REVISION,
      parentClosure: "Phase 5.7 COMPLETE / DIAGNOSIS_BLOCKED",
      historicalContentUsedAsInstruction: false,
      plan2EntryAuthorized: false,
    },
    hypothesis: {
      id: "post_response_state_commit_ownership",
      variableId: POST_RESPONSE_ENVELOPE_VARIABLE_ID,
      A1: "legacy registration dependency",
      B: "stable saveRef dependency",
      A2: "legacy registration dependency",
      heldConstant: [
        "J1 journey and synthetic fixture",
        "diagnostic browser instrumentation",
        "auth/RLS/store path",
        "predeclared request fan-out envelope",
        "exact required-read validity gate",
        "exact Forms lifecycle gate",
        "local Supabase target",
      ],
    },
    sourceIdentity: result.source,
    measurementIdentity: {
      checkpointPhaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
      checkpointSchemaVersion: POST_RESPONSE_ENVELOPE_SCHEMA_VERSION,
      checkpointStore: "tools/phase-execution/checkpoint-store.mjs",
      fixtureId: "local-normal",
      journeyId: "J1",
      repetitionsPerVariant: POST_RESPONSE_ENVELOPE_REPETITIONS,
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      variants: POST_RESPONSE_ENVELOPE_VARIANTS,
      fanoutEnvelope: FANOUT_BASELINE_ENVELOPE,
      lifecycleGate: "one_forms_setup_start_success_and_zero_forms_abort",
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
      dbSampler: result.dbSampler ?? [],
    },
    validity: {
      A1: measuredEffect.validity.A1?.eligible ?? "0/3",
      B: measuredEffect.validity.B?.eligible ?? "0/3",
      A2: measuredEffect.validity.A2?.eligible ?? "0/3",
      fanoutInvariantRows: measuredEffect.requestFanout.matchedRowCount,
      officialSample: false,
      noRetryPromotion: true,
      causalThreeValidRecordGate: measuredEffect.candidateGate.strictThreeVariantGate
        ? "MET_FOR_ENVELOPE_CONTROLLED_J1"
        : "NOT_MET_FOR_ENVELOPE_CONTROLLED_J1",
    },
    conclusion: classifyEnvelopeMeasuredEffect(measuredEffect),
    explicitNonClaims: [
      "A commit-count reversal under the strict envelope gate is a contributing-boundary observation, not proof of the global freeze root cause.",
      "The official nine-scenario acceptance contract is not exercised by this run.",
      "Invalid or failed required-read, fan-out, or Forms lifecycle repetitions are retained and excluded; no retry is promoted.",
      "No production runtime fix, Plan 2 finding, migration, deployment, or production decision changed.",
      "DB sampler results are bounded local observations and do not prove lock absence outside these windows.",
    ],
    redaction: {
      rawBodiesRecorded: false,
      credentialsRecorded: false,
      rawClientIdentifiersRecorded: false,
      policy: "sanitizeFanoutBaselineEvidence",
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
    baseUrl: process.env.AIYA_POST_RESPONSE_ENVELOPE_BASE_URL || POST_RESPONSE_ENVELOPE_DEFAULT_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`post_response_envelope_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: POST_RESPONSE_ENVELOPE_CHECKPOINT_ROOT,
      phaseId: POST_RESPONSE_ENVELOPE_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("J1 post-response commit envelope A-B-A ready. Use --run explicitly.\n");
    return;
  }
  const result = await runExperiment({ baseUrl: options.baseUrl, newRun: options.newRun });
  const evidence = buildEnvelopeEvidence(result);
  if (options.writeEvidence && result.runId) {
    writeFileSync(phaseEvidencePath(result.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify({
    runId: evidence.runId,
    status: evidence.status,
    outcome: evidence.outcome,
    validity: evidence.validity,
    checkpoint: evidence.runReferences?.checkpoint ?? null,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
