#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { chromium } from "playwright";
import {
  inspectPhaseRuns,
  openPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import { parseLocalSupabaseStatus } from "./performance-plan-1-phase-4.mjs";
import {
  PHASE_4_3_JOURNEYS,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  authenticateWithTiming,
  buildPhase44ServerEnvironment,
  resolvePhase44LocalConfiguration,
  runMeasurementUnit,
} from "./performance-plan-1-phase-4-4-local.mjs";
import {
  completedResults,
  FANOUT_BASELINE_CHECKPOINT_ROOT,
  sanitizeFanoutBaselineEvidence,
  startLocalServer,
  stopLocalServer,
  summarizeBaselineSample,
  waitForServer,
} from "./performance-plan-1-j1-fanout-envelope-baseline.mjs";
import {
  classifySecondActionTimeline,
  deriveSecondActionTimeline,
} from "./performance-plan-1-j1-second-action-timeline-analysis.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const DIRTY_VERIFY_PATHS = Object.freeze({ appRoot, repoRoot, nextCliPath });

export const DIRTY_VERIFY_PHASE_ID = "aiya-performance-plan1-j1-dirty-registration-verification-v1";
export const DIRTY_VERIFY_SCHEMA_VERSION = DIRTY_VERIFY_PHASE_ID;
export const DIRTY_SMOKE_ONLY_PHASE_ID = "aiya-performance-plan1-dirty-navigation-smoke-only-v1";
export const DIRTY_SMOKE_ONLY_SCHEMA_VERSION = DIRTY_SMOKE_ONLY_PHASE_ID;
export const DIRTY_VERIFY_PLAN_REVISION = "plan1-final-v3";
export const DIRTY_VERIFY_REPETITIONS = 3;
export const DIRTY_VERIFY_BASE_URL = "http://127.0.0.1:3167";
export const DIRTY_VERIFY_POLICY = "stable";
export const DIRTY_VERIFY_EVIDENCE_PREFIX = "docs/AIYA_PERFORMANCE_PLAN_1_V3_";
const DIRTY_VERIFY_PRIOR_RUN_ID = "aiya-performance-plan1-j1-dirty-registration-verification-v1-20260922T204750028Z-be78a2d5-cc2f-4fdb-9543-8f74559bb628";
export const DIRTY_VERIFY_PRIOR_EVIDENCE_PATH = "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-dirty-registration-verification-v1-20260922T204750028Z-be78a2d5-cc2f-4fdb-9543-8f74559bb628_EVIDENCE.json";
export const DIRTY_VERIFY_PRIOR_EVIDENCE_SHA256 = "82a14522b96fe6757d1b041d89d568c2f1a462c9541ed04d7feede7969c83ca2";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileHash(path) {
  try {
    return hash(readFileSync(path));
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
  const sourcePaths = execFileSync("rg", ["--files", "src", "public"], {
    cwd: appRoot,
    encoding: "utf8",
  }).trim().split(/\r?\n/).filter(Boolean).sort();
  const paths = [
    ...sourcePaths.map((path) => `app/${path.replaceAll("\\", "/")}`),
    "app/next.config.ts",
    "app/package.json",
    "app/package-lock.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-j1-dirty-registration-verification.mjs",
    "app/scripts/performance-plan-1-j1-fanout-envelope-baseline.mjs",
    "app/scripts/performance-plan-1-j1-second-action-timeline-analysis.mjs",
    "tools/phase-execution/checkpoint-store.mjs",
  ];
  const sourceHashes = sourcePaths.map((path) => `${path.replaceAll("\\", "/")}\0${fileHash(join(appRoot, path))}`);
  return {
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    appSourceFileCount: sourcePaths.length,
    appSourceTreeSha256: hash(Buffer.from(sourceHashes.join("\n"))),
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
    sourceFiles: paths.map((path) => ({ path, sha256: fileHash(join(repoRoot, path)) })),
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    supabaseTarget: "127.0.0.1:54321",
    requestedPolicy: "default_stable_empty_build_value",
    configurationIdentity: configuration.identity,
  };
}

async function firstAvailableBaseUrl() {
  for (let port = new URL(DIRTY_VERIFY_BASE_URL).port; Number(port) <= 3170; port = String(Number(port) + 1)) {
    const available = await new Promise((resolvePromise) => {
      const probe = createServer();
      probe.once("error", () => resolvePromise(false));
      probe.listen(Number(port), "127.0.0.1", () => probe.close(() => resolvePromise(true)));
    });
    if (available) return `http://127.0.0.1:${port}`;
  }
  throw new Error("dirty_verify_local_port_range_unavailable");
}

async function isPortFree(baseUrl) {
  const url = new URL(baseUrl);
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.once("error", () => resolvePromise(false));
    probe.listen(Number(url.port), "127.0.0.1", () => probe.close(() => resolvePromise(true)));
  });
}

function phaseEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("dirty_verify_run_id_invalid");
  }
  return join(repoRoot, `${DIRTY_VERIFY_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

function summarizeSample(result) {
  const previous = summarizeBaselineSample(result);
  const trace = result?.trace ?? {};
  const timeline = deriveSecondActionTimeline(trace);
  const policyEvents = trace?.measurement?.longTasks?.phase52Events ?? [];
  const observedStablePolicy = policyEvents.some((event) =>
    event.name === "shell_dirty_registration_policy" && event.policy === "stable",
  );
  const eligible = result?.validSample === true &&
    result?.observationValidity === "VALID" &&
    result?.functionalOutcome === "SUCCESS" &&
    trace?.actions?.second?.secondActionAccepted === true &&
    trace?.actions?.second?.clickAttemptCount === 1 &&
    observedStablePolicy &&
    previous.requiredReads.forms.exactOneCompleted &&
    previous.requiredReads.nutrition.exactOneCompleted &&
    previous.formsLifecycle.status === "PASS" &&
    timeline.status === "COMPLETE";
  return {
    ...previous,
    eligible,
    stablePolicyObserved: observedStablePolicy,
    performanceOutcome: result?.performanceOutcome ?? "NOT_EVALUABLE",
    secondAction: {
      trustedEventAtMs: trace?.actions?.second?.trustedEventAtMs ?? null,
      plannedDispatchAtMs: trace?.actions?.second?.plannedActionAtMs ?? null,
      dispatchAtMs: trace?.actions?.second?.dispatchAtMs ?? null,
      clickAttempts: trace?.actions?.second?.clickAttemptCount ?? null,
      accepted: trace?.actions?.second?.secondActionAccepted ?? null,
      functionalOutcome: trace?.actions?.second?.functionalOutcome ?? null,
      visibleReadyAtMs: trace?.actions?.second?.readyStateAtMs ?? null,
    },
    timelineClassification: classifySecondActionTimeline(timeline),
    timeline,
  };
}

export function analyzeDirtyRegistrationSamples(results) {
  const samples = (results ?? []).map(summarizeSample);
  const valid = samples.filter((sample) => sample.eligible).length;
  return {
    outcome: samples.length !== DIRTY_VERIFY_REPETITIONS
      ? "J1_STABLE_CAPTURE_INCOMPLETE"
      : valid === DIRTY_VERIFY_REPETITIONS
        ? "J1_STABLE_THREE_VALID_FUNCTIONAL_RECORDS"
        : "J1_STABLE_CAPTURE_RECORDED_WITH_INVALID_OR_FAILED_SAMPLES",
    samples,
    counts: {
      attempted: samples.length,
      planned: DIRTY_VERIFY_REPETITIONS,
      observationValid: samples.filter((sample) => sample.observationValidity === "VALID").length,
      functionalSuccess: samples.filter((sample) => sample.functionalOutcome === "SUCCESS").length,
      stablePolicyObserved: samples.filter((sample) => sample.stablePolicyObserved).length,
      formsReadOnce: samples.filter((sample) => sample.requiredReads.forms.exactOneCompleted).length,
      formsLifecyclePass: samples.filter((sample) => sample.formsLifecycle.status === "PASS").length,
      secondClickAccepted: samples.filter((sample) => sample.secondAction.accepted === true).length,
      eligible: valid,
      officialSamples: 0,
    },
  };
}

async function runDirtyNavigationSmoke(browser, baseUrl, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const progress = {
    step: "authentication",
    saveRequestCount: 0,
    saveResponseStatus: null,
    saveActionStarted: false,
  };
  try {
    const auth = await authenticateWithTiming(page, baseUrl, { email, password });
    if (auth.status !== "PASS") throw new Error("dirty_verify_smoke_auth_failed");
    progress.step = "client_workspace";
    await page.goto(`${baseUrl}/dashboard?section=clients`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="client-roster-item"]').first().waitFor({ state: "visible" });
    await page.locator('[data-testid="client-roster-item"]').first().click();
    await page.locator('[data-testid="client-workspace-header"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="tab-tab_personal_form"]:visible').click();
    await page.locator('[data-testid="client-form-panel"]').waitFor({ state: "visible" });
    progress.step = "personal_form_ready";
    const answer = page.locator('[data-testid="client-form-panel"]')
      .locator('[data-testid^="client-form-field-"] textarea:not([disabled]):visible, [data-testid^="client-form-field-"] input[type="text"]:not([disabled]):visible')
      .first();
    await answer.waitFor({ state: "visible" });
    const originalValue = await answer.inputValue();
    const draftValue = `${originalValue} [local synthetic dirty-state check]`;
    await answer.fill(draftValue);
    progress.step = "stay_choice";
    await page.locator('[data-testid="tab-tab_food_rules"]:visible').click();
    await page.locator('[data-testid="shell-dirty-navigation-dialog"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="shell-dirty-stay"]').click();
    await answer.waitFor({ state: "visible" });
    if (await answer.inputValue() !== draftValue) throw new Error("dirty_verify_smoke_stay_lost_draft");

    progress.step = "discard_choice";
    await page.locator('[data-testid="tab-tab_food_rules"]:visible').click();
    await page.locator('[data-testid="shell-dirty-discard"]').click();
    await page.locator('[data-testid="active-nutrition-plan-panel"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="tab-tab_personal_form"]:visible').click();
    await page.locator('[data-testid="client-form-panel"]').waitFor({ state: "visible" });
    await answer.fill(`${originalValue} [local synthetic save check]`);

    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/clients/forms") {
        progress.saveRequestCount += 1;
      }
    });
    const saveResponse = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === "POST" && new URL(response.url()).pathname === "/api/clients/forms";
    });
    progress.step = "save_action_started";
    progress.saveActionStarted = true;
    await page.locator('[data-testid="tab-tab_food_rules"]:visible').click();
    await page.locator('[data-testid="shell-dirty-save-continue"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="shell-dirty-save-continue"]').click();
    const response = await saveResponse;
    progress.saveResponseStatus = response.status();
    progress.step = "save_response_received";
    await page.locator('[data-testid="active-nutrition-plan-panel"]').waitFor({ state: "visible" });
    if (!response.ok() || progress.saveRequestCount !== 1) throw new Error("dirty_verify_smoke_save_contract_failed");
    progress.step = "complete";
    return {
      status: "PASS",
      stayPreservedDraft: true,
      discardAllowedNavigation: true,
      saveAndContinueStatus: response.status(),
      saveRequestCount: progress.saveRequestCount,
      syntheticFormMutationCount: 1,
      responseBodyRecorded: false,
    };
  } catch (error) {
    error.smokeProgress = {
      step: progress.step,
      saveActionStarted: progress.saveActionStarted,
      saveRequestCount: progress.saveRequestCount,
      saveResponseStatus: progress.saveResponseStatus,
      mutationMayHaveReachedServer: progress.saveRequestCount > 0 || progress.saveActionStarted,
      responseBodyRecorded: false,
    };
    throw error;
  } finally {
    await context.close();
  }
}

function buildContainsPublicSupabaseEnvironment(distPath, environment) {
  const expected = [environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY];
  if (expected.some((value) => typeof value !== "string" || !value)) return false;
  const pending = [join(distPath, "static")];
  const found = expected.map(() => false);
  while (pending.length) {
    const currentPath = pending.pop();
    if (!existsSync(currentPath)) continue;
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".js")) {
        const contents = readFileSync(entryPath, "utf8");
        expected.forEach((value, index) => {
          if (!found[index] && contents.includes(value)) found[index] = true;
        });
        if (found.every(Boolean)) return true;
      }
    }
  }
  return found.every(Boolean);
}

function smokeOnlyEvidencePath(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(runId ?? ""))) {
    throw new Error("dirty_smoke_only_run_id_invalid");
  }
  return join(repoRoot, `${DIRTY_VERIFY_EVIDENCE_PREFIX}${runId}_EVIDENCE.json`);
}

export async function runDirtyNavigationSmokeOnly() {
  const priorSmokeOnlyRuns = inspectPhaseRuns({ root: FANOUT_BASELINE_CHECKPOINT_ROOT, phaseId: DIRTY_SMOKE_ONLY_PHASE_ID });
  let preflightRepairRunId = null;
  if (priorSmokeOnlyRuns.length) {
    if (priorSmokeOnlyRuns.length !== 1) throw new Error("dirty_smoke_only_attempt_already_recorded_no_retry");
    const previousAttempt = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: DIRTY_SMOKE_ONLY_PHASE_ID,
      runId: priorSmokeOnlyRuns[0].runId,
    });
    const preflightEvent = previousAttempt.events.find((event) => event.type === "environment.preflight");
    const retrySafeTypes = new Set(["run.created", "execution.started", "environment.preflight", "run.status"]);
    const retrySafe = previousAttempt.manifest?.status === "BLOCKED" &&
      previousAttempt.events.length === 4 &&
      previousAttempt.events.every((event) => retrySafeTypes.has(event.type)) &&
      preflightEvent?.payload?.blockers?.length === 1 &&
      preflightEvent.payload.blockers[0] === "prior_j1_evidence_hash_mismatch";
    if (!retrySafe) throw new Error("dirty_smoke_only_attempt_already_recorded_no_retry");
    preflightRepairRunId = priorSmokeOnlyRuns[0].runId;
  }
  const configuration = resolvePhase44LocalConfiguration();
  const forcedConfiguration = {
    ...configuration,
    environment: {
      ...configuration.environment,
      NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY: "",
    },
  };
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(forcedConfiguration);
  const previousEvidencePath = join(repoRoot, DIRTY_VERIFY_PRIOR_EVIDENCE_PATH);
  const previousEvidenceHash = fileHash(previousEvidencePath);
  const blockers = [];
  let previousEvidence = null;
  let previousCheckpoint = null;
  let buildEnvironment = null;
  let reusedBuild = { status: "BLOCKED", distDir: null, buildIdSha256: null, publicSupabaseEnvironmentMatches: false };
  const credentialPresence = { email: Boolean(forcedConfiguration.email), password: Boolean(forcedConfiguration.password) };

  if (previousEvidenceHash !== DIRTY_VERIFY_PRIOR_EVIDENCE_SHA256) blockers.push("prior_j1_evidence_hash_mismatch");
  if (previousEvidenceHash) {
    try {
      previousEvidence = JSON.parse(readFileSync(previousEvidencePath, "utf8"));
    } catch {
      blockers.push("prior_j1_evidence_unreadable");
    }
  }
  if (!previousEvidence) blockers.push("prior_j1_evidence_missing");
  if (previousEvidence && (previousEvidence.status !== "BLOCKED" || previousEvidence.sampleSummary?.eligible !== 3 || previousEvidence.dirtyNavigationSmoke?.status !== "FAIL")) {
    blockers.push("prior_j1_outcome_not_eligible_for_smoke_only");
  }

  try {
    previousCheckpoint = readPhaseRun({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: DIRTY_VERIFY_PHASE_ID,
      runId: DIRTY_VERIFY_PRIOR_RUN_ID,
    });
    const completeUnits = previousCheckpoint.events.filter((event) => event.type === "measurement.unit.completed").length;
    const smokeStarted = previousCheckpoint.events.filter((event) => event.type === "smoke.dirty_navigation.started").length;
    const smokeFailed = previousCheckpoint.events.filter((event) => event.type === "smoke.dirty_navigation.failed").length;
    if (previousCheckpoint.manifest?.status !== "BLOCKED" || completeUnits !== DIRTY_VERIFY_REPETITIONS || smokeStarted !== 1 || smokeFailed !== 1) {
      blockers.push("prior_j1_checkpoint_not_expected_blocked_state");
    }
  } catch {
    blockers.push("prior_j1_checkpoint_unavailable_or_invalid");
  }

  if (localStatus.status !== "PASS") blockers.push("local_supabase_unreachable_or_not_ready");
  if (!credentialPresence.email || !credentialPresence.password) blockers.push("synthetic_credentials_unavailable");
  if (source.diffCheck !== "PASS") blockers.push("git_diff_check_failed");
  if (previousEvidence) {
    const oldSources = previousEvidence.sourceIdentity?.sourceFiles ?? [];
    const runnerPath = "app/scripts/performance-plan-1-j1-dirty-registration-verification.mjs";
    const changedRuntimeSources = oldSources.filter((entry) =>
      entry.path !== runnerPath && fileHash(join(repoRoot, entry.path)) !== String(entry.sha256 ?? "").toLowerCase(),
    );
    if (source.appSourceTreeSha256 !== previousEvidence.sourceIdentity?.appSourceTreeSha256 || changedRuntimeSources.length) {
      blockers.push("application_or_build_input_source_changed_since_j1");
    }

    const distDir = previousEvidence.build?.distDir;
    const safeDistDir = typeof distDir === "string" && /^\.next-dirty-verify-[A-Za-z0-9-]+$/.test(distDir);
    const distPath = safeDistDir ? resolve(appRoot, distDir) : null;
    const requiredBuildFilesPresent = Boolean(distPath &&
      existsSync(join(distPath, "BUILD_ID")) &&
      existsSync(join(distPath, "server")) &&
      existsSync(join(distPath, "required-server-files.json")));
    if (previousEvidence.build?.status !== "PASS" || !requiredBuildFilesPresent) blockers.push("prior_local_build_missing_or_invalid");

    if (safeDistDir && requiredBuildFilesPresent) {
      buildEnvironment = buildPhase44ServerEnvironment(
        {
          ...forcedConfiguration.environment,
          AIYA_PHASE55_DIST_DIR: distDir,
        },
        "diagnostic",
        { baseUrl: DIRTY_VERIFY_BASE_URL, localStatus },
      );
      const publicSupabaseEnvironmentMatches = buildContainsPublicSupabaseEnvironment(distPath, buildEnvironment);
      let localSupabaseEnvironmentMatches = false;
      try {
        const supabaseUrl = new URL(buildEnvironment.SUPABASE_URL);
        localSupabaseEnvironmentMatches = supabaseUrl.hostname === "127.0.0.1" && supabaseUrl.port === "54321";
      } catch {
        localSupabaseEnvironmentMatches = false;
      }
      reusedBuild = {
        status: publicSupabaseEnvironmentMatches && localSupabaseEnvironmentMatches ? "PASS" : "BLOCKED",
        distDir,
        buildIdSha256: fileHash(join(distPath, "BUILD_ID")),
        publicSupabaseEnvironmentMatches,
        localSupabaseEnvironmentMatches,
        serviceRoleKeyPresent: Boolean(buildEnvironment.SUPABASE_SERVICE_ROLE_KEY),
      };
      if (!publicSupabaseEnvironmentMatches) blockers.push("prior_build_public_supabase_environment_mismatch");
      if (!localSupabaseEnvironmentMatches || !buildEnvironment.SUPABASE_SERVICE_ROLE_KEY) blockers.push("local_supabase_server_environment_invalid");
    }
  }
  const portFree = await isPortFree(DIRTY_VERIFY_BASE_URL);
  if (!portFree) blockers.push("expected_prior_build_port_unavailable");

  const previousCheckpointSummary = previousCheckpoint ? {
    runId: DIRTY_VERIFY_PRIOR_RUN_ID,
    status: previousCheckpoint.manifest?.status ?? null,
    eventCount: previousCheckpoint.events.length,
    hashChainRead: true,
    completedJ1Units: previousCheckpoint.events.filter((event) => event.type === "measurement.unit.completed").length,
    smokeStarted: previousCheckpoint.events.filter((event) => event.type === "smoke.dirty_navigation.started").length,
    smokeFailed: previousCheckpoint.events.filter((event) => event.type === "smoke.dirty_navigation.failed").length,
  } : null;
  const preflight = {
    status: blockers.length ? "BLOCKED" : "PASS",
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    localSupabaseStatus: localStatus.status,
    localSupabaseTarget: "127.0.0.1:54321",
    credentialPresence,
    baseUrl: DIRTY_VERIFY_BASE_URL,
    expectedBuildOriginReused: true,
    priorEvidencePath: DIRTY_VERIFY_PRIOR_EVIDENCE_PATH,
    priorEvidenceSha256: previousEvidenceHash,
    priorJ1Checkpoint: previousCheckpointSummary,
    priorSmokeOnlyPreflightRepairRunId: preflightRepairRunId,
    appSourceTreeMatchesPriorJ1: Boolean(previousEvidence && source.appSourceTreeSha256 === previousEvidence.sourceIdentity?.appSourceTreeSha256),
    nonRunnerBuildInputsMatchPriorJ1: previousEvidence ? !blockers.includes("application_or_build_input_source_changed_since_j1") : false,
    reusedBuild,
    portFree,
    blockers,
  };
  const identity = {
    planRevision: DIRTY_VERIFY_PLAN_REVISION,
    phaseId: DIRTY_SMOKE_ONLY_PHASE_ID,
    phaseSchemaVersion: DIRTY_SMOKE_ONLY_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    sourceIdentity: source,
    priorJ1RunId: DIRTY_VERIFY_PRIOR_RUN_ID,
    priorEvidenceSha256: previousEvidenceHash,
    reusedBuildDistDir: reusedBuild.distDir,
    reusedBuildIdSha256: reusedBuild.buildIdSha256,
    expectedBaseUrl: DIRTY_VERIFY_BASE_URL,
    smokeContract: "stay_preserves_draft_discard_navigates_save_once_then_navigates",
    fieldSelector: "visible_enabled_textarea_or_text_input_within_client_form_field_testid",
    countedAsOfficialSample: false,
  };
  const opened = openPhaseRun({
    root: FANOUT_BASELINE_CHECKPOINT_ROOT,
    phaseId: DIRTY_SMOKE_ONLY_PHASE_ID,
    phaseSchemaVersion: DIRTY_SMOKE_ONLY_SCHEMA_VERSION,
    identity,
    metadata: { identity, countedAsOfficialSample: false },
    newRun: preflightRepairRunId !== null,
    redact: sanitizeFanoutBaselineEvidence,
  });
  if (opened.action !== "RUN" || !opened.run) throw new Error("dirty_smoke_only_checkpoint_not_created");
  const checkpoint = opened.run;
  const blockersForRun = [...blockers];
  const result = { status: "BLOCKED", smoke: { status: "NOT_RUN" }, serverClosed: true };
  let serverHandle = null;
  let browser = null;

  if (preflightRepairRunId) {
    checkpoint.append("environment.preflight_recovered", {
      previousRunId: preflightRepairRunId,
      repairedBlocker: "prior_j1_evidence_hash_mismatch",
      noServerOrSmokeStarted: true,
    });
  }
  checkpoint.append("environment.preflight", preflight, { status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED" });
  try {
    if (preflight.status !== "PASS") throw new Error("dirty_smoke_only_preflight_blocked");
    checkpoint.append("environment.reused_build", reusedBuild, { status: "RUNNING" });
    checkpoint.append("environment.server_starting", { baseUrl: DIRTY_VERIFY_BASE_URL }, { status: "RUNNING" });
    serverHandle = startLocalServer(buildEnvironment, DIRTY_VERIFY_BASE_URL);
    await waitForServer(serverHandle);
    checkpoint.append("environment.server_ready", { status: "PASS" }, { status: "RUNNING" });
    browser = await chromium.launch({ headless: true });
    checkpoint.append("smoke.dirty_navigation.started", {
      fixtureId: "local-normal",
      selectorContract: "visible_enabled_textarea_or_text_input_within_client_form_field_testid",
    });
    try {
      result.smoke = await runDirtyNavigationSmoke(
        browser,
        DIRTY_VERIFY_BASE_URL,
        forcedConfiguration.email,
        forcedConfiguration.password,
      );
      checkpoint.append("smoke.dirty_navigation.completed", result.smoke, {
        status: result.smoke.status === "PASS" ? "RUNNING" : "BLOCKED",
      });
      result.status = result.smoke.status === "PASS" ? "COMPLETE" : "BLOCKED";
    } catch (error) {
      result.smoke = {
        status: "FAIL",
        errorCode: String(error?.message || "dirty_smoke_only_failed").replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 100),
        ...(error?.smokeProgress ?? {}),
        responseBodyRecorded: false,
      };
      blockersForRun.push("dirty_navigation_smoke_failed");
      checkpoint.append("smoke.dirty_navigation.failed", result.smoke, { status: "BLOCKED" });
    }
  } catch (error) {
    if (!blockersForRun.length) blockersForRun.push(String(error?.message || "dirty_smoke_only_blocked").replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 100));
    result.smoke = result.smoke.status === "NOT_RUN" ? {
      status: "NOT_RUN",
      errorCode: String(error?.message || "dirty_smoke_only_blocked").replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 100),
      responseBodyRecorded: false,
    } : result.smoke;
  } finally {
    if (browser) await browser.close();
    await stopLocalServer(serverHandle);
    result.serverClosed = !serverHandle || serverHandle.server.exitCode != null;
    result.portFreeAfterClose = await isPortFree(DIRTY_VERIFY_BASE_URL);
    if (!result.portFreeAfterClose) blockersForRun.push("diagnostic_server_port_still_listening");
    const finalStatus = result.status === "COMPLETE" && result.serverClosed && result.portFreeAfterClose ? "COMPLETE" : "BLOCKED";
    result.status = finalStatus;
    checkpoint.markStatus(finalStatus, {
      reason: finalStatus === "COMPLETE" ? "dirty_navigation_smoke_passed_once" : "dirty_navigation_smoke_only_blocked",
      saveRequestCount: result.smoke.saveRequestCount ?? 0,
      mutationMayHaveReachedServer: result.smoke.mutationMayHaveReachedServer ?? (result.smoke.syntheticFormMutationCount === 1),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
  }

  const persisted = readPhaseRun({ root: FANOUT_BASELINE_CHECKPOINT_ROOT, phaseId: DIRTY_SMOKE_ONLY_PHASE_ID, runId: checkpoint.runId });
  const evidence = sanitizeFanoutBaselineEvidence({
    schemaVersion: DIRTY_SMOKE_ONLY_SCHEMA_VERSION,
    planRevision: DIRTY_VERIFY_PLAN_REVISION,
    phase: "bounded-diagnostic-continuation",
    stage: "dirty-navigation-smoke-only",
    stageId: DIRTY_SMOKE_ONLY_PHASE_ID,
    runId: checkpoint.runId,
    generatedAt: new Date().toISOString(),
    status: persisted.manifest?.status ?? "BLOCKED",
    productionDecision: "NO-GO",
    sourceIdentity: source,
    priorJ1: {
      runId: DIRTY_VERIFY_PRIOR_RUN_ID,
      evidencePath: DIRTY_VERIFY_PRIOR_EVIDENCE_PATH,
      evidenceSha256: previousEvidenceHash,
      eligibleRecords: previousEvidence?.sampleSummary?.eligible ?? 0,
      recordsReplayed: 0,
      checkpoint: previousCheckpointSummary,
    },
    preflight,
    reusedBuild,
    checkpoint: {
      phaseId: DIRTY_SMOKE_ONLY_PHASE_ID,
      runStatus: persisted.manifest?.status ?? null,
      eventCount: persisted.events.length,
      lastSequence: persisted.manifest?.lastSequence ?? null,
      hashChainRead: true,
      smokeStarts: persisted.events.filter((event) => event.type === "smoke.dirty_navigation.started").length,
      smokeCompletions: persisted.events.filter((event) => event.type === "smoke.dirty_navigation.completed").length,
      smokeFailures: persisted.events.filter((event) => event.type === "smoke.dirty_navigation.failed").length,
    },
    smoke: result.smoke,
    server: { closed: result.serverClosed, portFree: result.portFreeAfterClose ?? false },
    blockers: blockersForRun,
    interpretation: {
      j1RerunCount: 0,
      smokeAttemptCount: 1,
      performanceOutcome: "NOT_EVALUABLE_NO_MATCHED_SPEED_CONTROL",
      dirtyRegistrationNavigationContractValidated: result.smoke.status === "PASS",
      rootCauseConfirmed: false,
      globalFreezeResolved: false,
      plan2EntryAuthorized: false,
      findingDispositionChanged: false,
    },
    redaction: {
      status: "PASS",
      credentials: false,
      cookiesOrTokens: false,
      requestBodies: false,
      healthData: false,
      rawClientIdentifiers: false,
      formValues: false,
    },
  });
  const evidencePath = smokeOnlyEvidencePath(checkpoint.runId);
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    runId: checkpoint.runId,
    status: evidence.status,
    smoke: evidence.smoke,
    checkpoint: evidence.checkpoint,
    evidencePath: evidencePath.replaceAll("\\", "/").slice(repoRoot.length + 1),
    evidenceSha256: fileHash(evidencePath),
    serverClosed: result.serverClosed,
    portFree: result.portFreeAfterClose,
  };
}

function sourceCheckpoint(persisted) {
  return {
    phaseId: DIRTY_VERIFY_PHASE_ID,
    schemaVersion: DIRTY_VERIFY_SCHEMA_VERSION,
    status: persisted.manifest?.status ?? null,
    eventCount: persisted.events.length,
    lastSequence: persisted.manifest?.lastSequence ?? null,
    hashChainRead: true,
  };
}

function buildEvidence(result) {
  const analysis = analyzeDirtyRegistrationSamples(result.results ?? []);
  return sanitizeFanoutBaselineEvidence({
    schemaVersion: DIRTY_VERIFY_SCHEMA_VERSION,
    planRevision: DIRTY_VERIFY_PLAN_REVISION,
    phase: "diagnostic-continuation",
    stage: "j1-dirty-registration-verification",
    stageId: DIRTY_VERIFY_PHASE_ID,
    runId: result.runId,
    generatedAt: new Date().toISOString(),
    status: result.status,
    outcome: analysis.outcome,
    productionDecision: "NO-GO",
    sourceIdentity: result.sourceIdentity,
    build: result.build,
    preflight: result.preflight,
    checkpoint: result.checkpoint,
    environment: {
      fixtureId: "local-normal",
      fixtureClass: "synthetic_normal_owner",
      storePath: "real_local_supabase_auth_and_rls",
      supabaseTarget: "127.0.0.1:54321",
      journeyId: "J1",
      mode: "diagnostic",
      repetitions: DIRTY_VERIFY_REPETITIONS,
      secondActionDelayMs: 2_000,
      requestedPolicy: "default_stable_empty_build_value",
      countedAsOfficialSample: false,
      fanoutCountsAreObservationsOnly: true,
      profiler: "not_enabled",
    },
    sampleSummary: analysis.counts,
    samples: analysis.samples,
    dirtyNavigationSmoke: result.dirtyNavigationSmoke ?? { status: "NOT_RUN" },
    blockers: result.blockers ?? [],
    interpretation: {
      dirtyRegistrationFixValidated: analysis.counts.eligible === DIRTY_VERIFY_REPETITIONS,
      secondClickFunctionalInAllSamples: analysis.counts.secondClickAccepted === DIRTY_VERIFY_REPETITIONS,
      globalFreezeResolved: false,
      rootCauseConfirmed: false,
      plan2EntryAuthorized: false,
      findingDispositionChanged: false,
      performanceConclusion: "NOT_EVALUABLE_NO_MATCHED_SPEED_CONTROL",
      productionDecision: "NO-GO",
    },
    redaction: {
      status: "PASS",
      rawIdentifiersIncluded: false,
      rawBodiesIncluded: false,
      credentialsIncluded: false,
      healthDataIncluded: false,
    },
  });
}

export async function runDirtyRegistrationVerification({ baseUrl = null } = {}) {
  const configuration = resolvePhase44LocalConfiguration();
  const forcedConfiguration = {
    ...configuration,
    environment: {
      ...configuration.environment,
      NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY: "",
    },
  };
  const selectedBaseUrl = baseUrl ? new URL(baseUrl).origin : await firstAvailableBaseUrl();
  const localStatus = parseLocalSupabaseStatus();
  const source = sourceIdentity(forcedConfiguration);
  const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === "J1");
  const blockers = [];
  if (localStatus.status !== "PASS") blockers.push("local_supabase_unreachable_or_not_ready");
  if (!forcedConfiguration.email) blockers.push("synthetic_email_unavailable");
  if (!forcedConfiguration.password) blockers.push("synthetic_password_unavailable");
  if (!journey) blockers.push("j1_journey_missing");
  if (source.diffCheck !== "PASS") blockers.push("git_diff_check_failed");

  const identity = {
    planRevision: DIRTY_VERIFY_PLAN_REVISION,
    phaseId: DIRTY_VERIFY_PHASE_ID,
    phaseSchemaVersion: DIRTY_VERIFY_SCHEMA_VERSION,
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    baseOrigin: selectedBaseUrl,
    sourceIdentity: source,
    sourceVariant: "default_stable_dirty_registration",
    policy: DIRTY_VERIFY_POLICY,
    journeyId: "J1",
    repetitions: DIRTY_VERIFY_REPETITIONS,
    secondActionDelayMs: 2_000,
    lifecycleGate: "one_forms_setup_start_success_and_zero_forms_abort",
    localConfigurationIdentity: forcedConfiguration.identity,
    officialMeasurement: false,
    countedAsOfficialSample: false,
  };
  const opened = openPhaseRun({
    root: FANOUT_BASELINE_CHECKPOINT_ROOT,
    phaseId: DIRTY_VERIFY_PHASE_ID,
    phaseSchemaVersion: DIRTY_VERIFY_SCHEMA_VERSION,
    identity,
    metadata: { identity, countedAsOfficialSample: false },
    newRun: false,
    redact: sanitizeFanoutBaselineEvidence,
  });
  if (opened.action !== "RUN" || !opened.run) {
    if (opened.action === "COMPLETE" && opened.manifest?.runId) {
      return {
        runId: opened.manifest.runId,
        status: "COMPLETE",
        outcome: "EXISTING_RUN_ALREADY_COMPLETE_NO_RERUN",
        sampleSummary: null,
        evidencePath: null,
        evidenceSha256: null,
        blockerCount: 0,
        serverClosed: true,
      };
    }
    throw new Error(opened.reason ?? "dirty_verify_checkpoint_not_created");
  }
  const checkpoint = opened.run;
  const results = [];
  let dirtyNavigationSmoke = { status: "SKIPPED", reason: "three_valid_j1_records_required" };
  let preflight = {
    status: blockers.length ? "BLOCKED" : "PASS",
    authentication: "real_password_session_required",
    fixtureId: "local-normal",
    fixtureClass: "synthetic_normal_owner",
    targetOrigin: selectedBaseUrl,
    localSupabaseStatus: localStatus.status,
    credentialPresence: { email: Boolean(forcedConfiguration.email), password: Boolean(forcedConfiguration.password) },
    blockers,
  };
  let build = { status: "NOT_STARTED", mode: "diagnostic", profile: false };
  let serverHandle = null;
  let browser = null;

  checkpoint.append("environment.preflight", preflight, {
    status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED",
  });
  try {
    if (preflight.status !== "PASS") throw new Error("dirty_verify_preflight_blocked");
    if (!existsSync(nextCliPath)) throw new Error("dirty_verify_next_cli_missing");

    const buildEnvironment = buildPhase44ServerEnvironment(
      {
        ...forcedConfiguration.environment,
        AIYA_PHASE55_DIST_DIR: `.next-dirty-verify-${checkpoint.runId.slice(-24)}`,
      },
      "diagnostic",
      { baseUrl: selectedBaseUrl, localStatus },
    );
    const buildResult = spawnSync(process.execPath, [nextCliPath, "build", "--webpack"], {
      cwd: appRoot,
      env: buildEnvironment,
      stdio: "ignore",
      timeout: 600_000,
      windowsHide: true,
    });
    build = {
      status: buildResult.status === 0 ? "PASS" : "BLOCKED",
      timedOut: buildResult.error?.code === "ETIMEDOUT",
      mode: "diagnostic",
      profile: false,
      distDir: buildEnvironment.AIYA_PHASE55_DIST_DIR,
      outputRecorded: false,
    };
    checkpoint.append("environment.build", build, {
      status: build.status === "PASS" ? "RUNNING" : "BLOCKED",
    });
    if (build.status !== "PASS") throw new Error("dirty_verify_build_blocked");

    serverHandle = startLocalServer(buildEnvironment, selectedBaseUrl);
    await waitForServer(serverHandle);
    browser = await chromium.launch({ headless: true });
    const completed = completedResults(checkpoint.events);
    const started = new Set(checkpoint.eventsOf("measurement.unit.started").map((event) => event.payload?.unitKey));
    for (let repetition = 1; repetition <= DIRTY_VERIFY_REPETITIONS; repetition += 1) {
      const unitKey = `stable:diagnostic:J1:r${repetition}`;
      if (completed.some((result) => result.unitKey === unitKey)) continue;
      if (started.has(unitKey)) {
        blockers.push(`incomplete_attempt_not_retried:r${repetition}`);
        break;
      }
      const result = await runMeasurementUnit({
        browser,
        baseUrl: selectedBaseUrl,
        mode: "diagnostic",
        journey,
        repetition,
        unitKey,
        scope: "j1_default_stable_dirty_registration",
        email: forcedConfiguration.email,
        password: forcedConfiguration.password,
        checkpoint,
      });
      results.push(result);
    }
    const allResults = [...completedResults(checkpoint.events)];
    const summary = analyzeDirtyRegistrationSamples(allResults);
    const fullyRecorded = checkpoint.eventsOf("measurement.unit.completed")
      .filter((event) => String(event.payload?.unitKey ?? "").startsWith("stable:diagnostic:J1:r"))
      .length === DIRTY_VERIFY_REPETITIONS;
    if (fullyRecorded && summary.counts.eligible === DIRTY_VERIFY_REPETITIONS) {
      const smokeEvents = checkpoint.events.filter((event) => event.type.startsWith("smoke.dirty_navigation."));
      const previousSmoke = smokeEvents.filter((event) =>
        event.type === "smoke.dirty_navigation.completed" || event.type === "smoke.dirty_navigation.failed",
      ).at(-1);
      if (previousSmoke) {
        dirtyNavigationSmoke = previousSmoke.payload;
      } else if (smokeEvents.length) {
        dirtyNavigationSmoke = { status: "BLOCKED", reason: "interrupted_smoke_not_retried" };
        blockers.push("dirty_navigation_smoke_incomplete_not_retried");
      } else {
        checkpoint.append("smoke.dirty_navigation.started", { fixtureId: "local-normal" });
        try {
          dirtyNavigationSmoke = await runDirtyNavigationSmoke(
            browser,
            selectedBaseUrl,
            forcedConfiguration.email,
            forcedConfiguration.password,
          );
          checkpoint.append("smoke.dirty_navigation.completed", dirtyNavigationSmoke, {
            status: dirtyNavigationSmoke.status === "PASS" ? "RUNNING" : "BLOCKED",
          });
        } catch (error) {
          dirtyNavigationSmoke = {
            status: "FAIL",
            errorCode: String(error?.message || "dirty_verify_smoke_failed").replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 100),
            responseBodyRecorded: false,
          };
          blockers.push("dirty_navigation_smoke_failed");
          checkpoint.append("smoke.dirty_navigation.failed", dirtyNavigationSmoke, { status: "BLOCKED" });
        }
      }
    }
    const accepted = fullyRecorded &&
      summary.counts.eligible === DIRTY_VERIFY_REPETITIONS &&
      dirtyNavigationSmoke.status === "PASS";
    checkpoint.markStatus(accepted ? "COMPLETE" : "BLOCKED", {
      reason: accepted ? "three_valid_j1_records_and_dirty_navigation_smoke_passed" : "verification_acceptance_not_met",
      eligibleSamples: summary.counts.eligible,
      countedAsOfficialSample: false,
    });
  } catch (error) {
    const latestStatus = checkpoint.status;
    if (latestStatus !== "BLOCKED" && latestStatus !== "FAILED") {
      blockers.push(String(error?.message || "dirty_verify_runner_failed").slice(0, 100));
      checkpoint.markStatus("BLOCKED", {
        reason: "dirty_verify_runner_blocked",
        errorClass: String(error?.name || "Error").slice(0, 80),
      });
    } else if (!blockers.length) {
      blockers.push(String(error?.message || "dirty_verify_runner_failed").slice(0, 100));
    }
  } finally {
    if (browser) await browser.close();
    await stopLocalServer(serverHandle);
    if (serverHandle && !(await isPortFree(selectedBaseUrl))) {
      blockers.push("diagnostic_server_port_still_listening");
    }
    checkpoint.close();
  }

  const persisted = readPhaseRun({
    root: FANOUT_BASELINE_CHECKPOINT_ROOT,
    phaseId: DIRTY_VERIFY_PHASE_ID,
    runId: checkpoint.runId,
  });
  const allResults = completedResults(persisted.events);
  const result = {
    runId: checkpoint.runId,
    status: persisted.manifest?.status ?? "BLOCKED",
    sourceIdentity: source,
    preflight,
    build,
    checkpoint: sourceCheckpoint(persisted),
    results: allResults,
    dirtyNavigationSmoke,
    blockers,
  };
  const evidence = buildEvidence(result);
  const evidencePath = phaseEvidencePath(result.runId);
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    runId: result.runId,
    status: result.status,
    outcome: evidence.outcome,
    sampleSummary: evidence.sampleSummary,
    evidencePath: evidencePath.replaceAll("\\", "/").slice(repoRoot.length + 1),
    evidenceSha256: fileHash(evidencePath),
    blockerCount: blockers.length,
    serverClosed: serverHandle?.server?.exitCode != null,
  };
}

export function parseDirtyVerifyArguments(argv) {
  const options = { run: false, status: false, smokeOnly: false, baseUrl: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") options.run = true;
    else if (argument === "--status") options.status = true;
    else if (argument === "--smoke-only") options.smokeOnly = true;
    else if (argument === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`dirty_verify_argument_invalid:${argument}`);
  }
  if (options.smokeOnly && (options.run || options.status || options.baseUrl)) {
    throw new Error("dirty_verify_smoke_only_cannot_combine_with_other_modes");
  }
  return options;
}

async function main() {
  const options = parseDirtyVerifyArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: FANOUT_BASELINE_CHECKPOINT_ROOT,
      phaseId: DIRTY_VERIFY_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    if (options.smokeOnly) {
      process.stdout.write(`${JSON.stringify(await runDirtyNavigationSmokeOnly(), null, 2)}\n`);
      return;
    }
    process.stdout.write("Default-stable J1 dirty registration verification ready. Use --run explicitly.\n");
    return;
  }
  process.stdout.write(`${JSON.stringify(await runDirtyRegistrationVerification({ baseUrl: options.baseUrl }), null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error).slice(0, 160)}\n`);
    process.exitCode = 1;
  });
}
