#!/usr/bin/env node

/**
 * Matched trace-only J1 capture for preference timing and Forms abort lifecycle.
 *
 * This runner uses the existing diagnostic server mode and the existing J1
 * journey. It changes no runtime behavior, never enters the official baseline,
 * and keeps the preference body/value redaction boundary from the existing
 * preference-intent trace variant.
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
import { buildPreferenceIntentEvidence } from "./performance-plan-1-j1-preference-intent-timing.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const MATCHED_ABORT_PHASE_ID =
  "aiya-performance-plan1-j1-preference-intent-abort-matched-v1";
export const MATCHED_ABORT_SCHEMA_VERSION = MATCHED_ABORT_PHASE_ID;
export const MATCHED_ABORT_PLAN_REVISION = "plan1-final-v3";
export const MATCHED_ABORT_TRACE_VARIANT =
  PHASE_4_3_TRACE_VARIANTS.preferenceIntentTimingAndCompletion;
export const MATCHED_ABORT_BASE_URL = "http://127.0.0.1:3153";
export const MATCHED_ABORT_REPETITIONS = 3;
export const MATCHED_ABORT_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const MATCHED_ABORT_EVIDENCE_PREFIX =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_";

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
    "app/scripts/performance-plan-1-j1-preference-intent-timing.mjs",
    "app/scripts/performance-plan-1-j1-preference-intent-abort-matched.mjs",
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

function normalizeBaseUrl(value) {
  const url = new URL(value || MATCHED_ABORT_BASE_URL);
  if (!url.port) url.port = "3153";
  return url.origin;
}

function checkpointIdentity({ baseUrl, configuration, source }) {
  return {
    planRevision: MATCHED_ABORT_PLAN_REVISION,
    phaseId: MATCHED_ABORT_PHASE_ID,
    phaseSchemaVersion: MATCHED_ABORT_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: baseUrl,
    sourceHead: source.head,
    sourceVariant: "j1_preference_intent_abort_matched_trace_only",
    traceVariant: MATCHED_ABORT_TRACE_VARIANT,
    journeyId: "J1",
    repetitions: MATCHED_ABORT_REPETITIONS,
    executionMode: "diagnostic",
    serverControl: "one_managed_diagnostic_server",
    localConfigurationIdentity: configuration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
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
    if (handle.server.exitCode != null) throw new Error("matched_abort_server_exited");
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
  throw new Error("matched_abort_server_timeout");
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

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("matched_abort_run_id_invalid");
  }
  return join(
    repoRoot,
    `${MATCHED_ABORT_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`,
  );
}

function buildMatchedEvidence(result) {
  const evidence = buildPreferenceIntentEvidence(result);
  evidence.stage = "shared-runtime-j1-preference-intent-abort-matched";
  evidence.outcome = result.outcome;
  evidence.runId = result.runId;
  evidence.sourceIdentity = result.sourceIdentity;
  evidence.checkpoint = {
    phaseId: MATCHED_ABORT_PHASE_ID,
    schemaVersion: MATCHED_ABORT_SCHEMA_VERSION,
    executionMode: "diagnostic",
    traceVariant: MATCHED_ABORT_TRACE_VARIANT,
    officialMeasurement: false,
    countedAsOfficialSample: false,
    localSupabase: "127.0.0.1:54321",
  };
  evidence.findings = {
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
  };
  evidence.explicitNonClaims = [
    "This matched diagnostic capture is outside the official nine-scenario baseline.",
    "The trace records preference intent keys only; preference values and raw request bodies are excluded.",
    "The same-sample preference/lifecycle ordering is observational and is not causal proof or runtime-fix acceptance.",
    "No external provider, WhatsApp, billing, production worker, migration, deploy, or real health-data path was used.",
  ];
  evidence.closure = {
    status: result.status,
    outcome: result.outcome,
    runtimeFixAccepted: false,
    plan2Eligible: false,
    abortSamplesObserved: (evidence.samples ?? []).filter((sample) =>
      sample.trace.preferenceIntentTiming.events.some((event) =>
        event.temporalRelations.formsAbortAfterPreferenceRequest,
      ),
    ).length,
    nextAction:
      "Compare same-sample preference timing with the observed Forms abort lifecycle; treat absent aborts or invalid samples as non-confirmation and do not promote this diagnostic to the official baseline.",
  };
  return evidence;
}

async function runMatchedCapture({ baseUrl, newRun = false } = {}) {
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
    root: MATCHED_ABORT_CHECKPOINT_ROOT,
    phaseId: MATCHED_ABORT_PHASE_ID,
    phaseSchemaVersion: MATCHED_ABORT_SCHEMA_VERSION,
    identity,
    metadata: {
      identitySummary: {
        phaseId: MATCHED_ABORT_PHASE_ID,
        sourceHead: source.head,
        sourceVariant: identity.sourceVariant,
        executionMode: "diagnostic",
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
      root: MATCHED_ABORT_CHECKPOINT_ROOT,
      phaseId: MATCHED_ABORT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      runId: opened.manifest.runId,
      status: "COMPLETE",
      outcome: "MATCHED_PREFERENCE_ABORT_TRACE_RECORDED",
      sourceIdentity: source,
      preflight: null,
      results: completedResults(persisted.events),
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      runId: opened.manifest?.runId ?? null,
      status: "BLOCKED",
      outcome: "MATCHED_ABORT_CHECKPOINT_NOT_RUN",
      sourceIdentity: source,
      preflight: null,
      results: [],
    };
  }

  const checkpoint = opened.run;
  const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
  const results = completedResults(checkpoint.events);
  let serverHandle = null;
  let browser = null;
  checkpoint.append("diagnostic.contract.bound", {
    phaseId: MATCHED_ABORT_PHASE_ID,
    schemaVersion: MATCHED_ABORT_SCHEMA_VERSION,
    traceVariant: MATCHED_ABORT_TRACE_VARIANT,
    executionMode: "diagnostic",
    journeyId: "J1",
    repetitions: MATCHED_ABORT_REPETITIONS,
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
    checkpoint.markStatus("BLOCKED", { reason: "matched_abort_preflight_blocked" });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "MATCHED_ABORT_PREFLIGHT_BLOCKED",
      sourceIdentity: source,
      preflight,
      results,
    };
  }

  try {
    const buildEnvironment = buildPhase44ServerEnvironment(
      configuration.environment,
      "diagnostic",
      { baseUrl: normalizedBaseUrl, localStatus },
    );
    if (!existsSync(nextCliPath)) throw new Error("matched_abort_next_cli_missing");
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
    if (build.status !== 0) throw new Error("matched_abort_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, normalizedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    for (let repetition = 1; repetition <= MATCHED_ABORT_REPETITIONS; repetition += 1) {
      const unitKey = `diagnostic:J1:r${repetition}`;
      if (results.some((result) => result.unitKey === unitKey)) continue;
      const result = await runMeasurementUnit({
        browser,
        baseUrl: normalizedBaseUrl,
        mode: "diagnostic",
        journey,
        repetition,
        unitKey,
        scope: "j1_preference_intent_abort_matched",
        email: configuration.email,
        password: configuration.password,
        controlVariant: null,
        traceVariant: MATCHED_ABORT_TRACE_VARIANT,
        checkpoint,
      });
      results.push(result);
    }
    const complete = results.length === MATCHED_ABORT_REPETITIONS;
    checkpoint.markStatus(complete ? "COMPLETE" : "BLOCKED", {
      reason: complete
        ? "matched_preference_abort_trace_completed"
        : "matched_preference_abort_trace_incomplete",
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: complete ? "COMPLETE" : "BLOCKED",
      outcome: complete
        ? "MATCHED_PREFERENCE_ABORT_TRACE_RECORDED"
        : "MATCHED_PREFERENCE_ABORT_TRACE_INCOMPLETE",
      sourceIdentity: source,
      preflight,
      results,
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "matched_abort_runner_blocked",
      errorClass: String(error?.name || "Error").slice(0, 120),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      runId: checkpoint.runId,
      status: "BLOCKED",
      outcome: "MATCHED_ABORT_RUNNER_BLOCKED",
      runtimeError: String(error?.message || "matched_abort_runner_failed").slice(0, 160),
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
    baseUrl: process.env.AIYA_MATCHED_ABORT_BASE_URL || MATCHED_ABORT_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`matched_abort_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: MATCHED_ABORT_CHECKPOINT_ROOT,
      phaseId: MATCHED_ABORT_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Matched diagnostic J1 preference/abort capture ready. Use --run explicitly.\n");
    return;
  }
  const result = await runMatchedCapture({
    baseUrl: options.baseUrl,
    newRun: options.newRun,
  });
  const evidence = buildMatchedEvidence(result);
  if (options.writeEvidence && result.runId) {
    const path = phaseEvidencePath(result.runId);
    writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({
      runId: result.runId,
      status: result.status,
      outcome: result.outcome,
      evidencePath: path.replaceAll("\\", "/").replace(`${repoRoot.replaceAll("\\", "/")}/`, ""),
      summary: evidence.summary,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    runId: result.runId,
    status: result.status,
    outcome: result.outcome,
    summary: evidence.summary,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
