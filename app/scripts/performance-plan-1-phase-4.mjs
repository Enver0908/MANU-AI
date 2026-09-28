#!/usr/bin/env node
/**
 * AIya Performance Plan 1 - Phase 4 authenticated baseline and reproduction.
 *
 * This script measures real password-authenticated sessions only. It does not
 * inject the demo cookie, enable the fallback store, capture raw payloads, or
 * change runtime, schema, deployment, or production configuration.
 */

import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";
import {
  createPhaseRun,
  inspectPhaseRuns,
  openPhaseRun,
  readPhaseRun,
  requestPhaseRunPause,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  assertPhaseDefinition,
  PHASE_EXECUTION_SCHEMA_VERSION,
} from "../../tools/phase-execution/phase-runner.mjs";
import {
  getActivePhaseCycle,
  readPhaseCycles,
  transitionPhaseCycle,
} from "../../tools/phase-execution/phase-cycle-store.mjs";
import {
  collectPhase4MeasurementIdentity,
  loadPhase4HostedInputs,
  PHASE_4_HOSTED_ENV_RELATIVE_PATH,
  PHASE_4_READINESS_STAGE_IDS,
  redactionCheck as checkPhase4Redaction,
  sanitizePhase4Evidence as sanitizeEvidence,
} from "./lib/performance-plan-1-phase-4-contract.mjs";
import {
  PHASE_2_BUDGETS,
  PHASE_2_HARNESS_CONTRACT,
  PHASE_2_SCENARIOS,
  validatePhase2HarnessContract,
} from "./measure-aiya-performance-phase-2.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const evidencePath = join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json");
const phase2EvidencePath = join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json");
const phase3EvidencePath = join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json");
const phase4ReadinessCliPath = join(
  appRoot,
  "scripts",
  "performance-plan-1-phase-4-readiness.mjs",
);
const phase4ReadinessEvidencePath = join(
  docsRoot,
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json",
);
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");
const demoCookieName = "manu_ai_demo_session";
const PHASE_4_READINESS_GATE_TIMEOUT_MS = 420_000;

export const PHASE_4_SAMPLE_COUNT = 20;
const configuredMaxAttempts = Number(process.env.AIYA_PHASE4_MAX_ATTEMPTS || 28);
export const PHASE_4_MAX_ATTEMPTS = Number.isFinite(configuredMaxAttempts)
  ? Math.min(28, Math.max(PHASE_4_SAMPLE_COUNT, configuredMaxAttempts))
  : 28;
export const PHASE_4_LOCAL_PORT = Number(process.env.AIYA_PHASE4_PORT || 3136);
export const PHASE_4_RUN_ID =
  "aiya-phase4-" +
  new Date().toISOString().replaceAll(/[-:.]/g, "") +
  "-" +
  randomUUID();
const PHASE_4_CHECKPOINT_PHASE_ID = "aiya-performance-plan1-phase4";
const PHASE_4_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-resume-v1";
const PHASE_4_MIGRATION_REASON =
  "android_cdp_real_click_actionable_target_and_compact_ai_chat_stabilization";
const PHASE_4_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
let activePhase4Checkpoint = null;
let phase4CheckpointMigration = null;
let activePhase4CycleId = null;

function currentPhase4RunId() {
  return activePhase4Checkpoint?.runId || PHASE_4_RUN_ID;
}
export const LOCAL_SUPABASE_URL_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/;
export const SYNTHETIC_PASSWORD =
  process.env.MANU_PHASE3_SYNTHETIC_PASSWORD || "AiyaPhase3LocalOnly!";

export const PHASE_4_FIXTURES = {
  small: {
    id: "small_synthetic",
    email: "aiya-phase3-local-small-owner@manu.local",
    fixtureClass: "small",
  },
  normal: {
    id: "normal_synthetic",
    email: "aiya-phase3-local-normal-owner@manu.local",
    fixtureClass: "normal",
  },
};

export const PHASE_4_ENVIRONMENTS = [
  "local_desktop",
  "owner_pc_hosted",
  "android_chrome",
  "installed_android_pwa",
];
export const PHASE_4_WARM_SETUP_MODE =
  "same_authenticated_context_real_click_without_page_reload";
export const PHASE_4_ACTION_CLICK_TIMEOUT_MS = 20_000;
export const PHASE_4_ANDROID_CLICK_STABILITY_POLL_MS = 80;
export const PHASE_4_LOCAL_SCHEMA_MIGRATION_FILE =
  "app/supabase/migrations/20260911070000_phase_85_stage_5_session_activity_race_fix.sql";
export const PHASE_4_APPROVED_HOSTED_ORIGIN = "https://65-21-52-249.sslip.io";
export const PHASE_4_ANDROID_CDP_URL = "http://127.0.0.1:9222";
export const PHASE_4_ANDROID_CHROME_PACKAGE = "com.android.chrome";
export const PHASE_4_ANDROID_PWA_PACKAGE_HINT =
  "org.chromium.webapk.afb5fefd715bedce7_v2";
export const PHASE_4_ANDROID_PWA_PACKAGE_PATTERN = /^org\.chromium\.webapk\.[a-z0-9._]+$/i;
export const PHASE_4_ANDROID_COMMAND_TIMEOUT_MS = 15_000;
export const PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS = 20_000;
export const PHASE_4_ANDROID_CDP_CONNECT_ATTEMPTS = 4;
export const PHASE_4_ANDROID_CDP_RETRY_DELAY_MS = 1_000;
export const PHASE_4_INTERACTION_EVENT_WALL_KEY =
  "aiya-phase4-trusted-interaction-event-wall-ms";
export const PHASE_4_INTERACTION_PAINT_KEY =
  "aiya-phase4-trusted-interaction-next-paint-ms";

// The current client surface renders the roster from app-state and loads each
// selected task through its domain endpoint; task selection may abort summary.
export const PHASE_4_SHELL_PREFERENCES_PATCH = "/api/shell/preferences:PATCH";
export const PHASE_4_SCENARIOS = PHASE_2_SCENARIOS.map((scenario) => {
  const phase4Scenario = {
    ...scenario,
    ...(scenario.transitionMode === "warm"
      ? {
          allowedMutations: [
            ...new Set([
              ...(scenario.allowedMutations ?? []),
              PHASE_4_SHELL_PREFERENCES_PATCH,
            ]),
          ],
        }
      : {}),
  };

  if (scenario.scenarioId === "client_roster") {
    return { ...phase4Scenario, requiredReads: ["/api/shell/bootstrap"] };
  }
  if (scenario.scenarioId === "client_forms_workspace") {
    return { ...phase4Scenario, requiredReads: ["/api/clients/:clientId/forms"] };
  }
  if (scenario.scenarioId === "nutrition_workspace") {
    return {
      ...phase4Scenario,
      requiredReads: ["/api/clients/:clientId/food-rule-profile"],
    };
  }
  if (scenario.scenarioId === "menu_workspace") {
    return { ...phase4Scenario, requiredReads: ["/api/clients/:clientId/menu-plans"] };
  }
  return phase4Scenario;
});

const REQUIRED_PHASE2_OUTCOME = "HARNESS_READY_WITH_NEGATIVE_CONTROLS";
const REQUIRED_PHASE3_OUTCOME = "SYNTHETIC_AUTH_STORE_READY";
const TASK_TAB_IDS = {
  client_forms_workspace: "tab_personal_form",
  nutrition_workspace: "tab_food_rules",
  menu_workspace: "tab_menu",
};

const PHASE_4_DEFINITION = {
  phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
  phaseSchemaVersion: PHASE_4_CHECKPOINT_SCHEMA_VERSION,
  executionSchemaVersion: PHASE_EXECUTION_SCHEMA_VERSION,
  stages: [
    { stageId: "4.1", prerequisites: [], verify: () => true },
    { stageId: "4.2", prerequisites: ["4.1"], verify: () => true },
    { stageId: "4.3", prerequisites: ["4.2"], verify: () => true },
    { stageId: "4.4", prerequisites: ["4.3"], verify: () => true },
    { stageId: "4.5", prerequisites: ["4.4"], verify: () => true },
  ],
};

function checkpointIdentity(measurementIdentity, harnessContract) {
  return {
    sourceFingerprint: measurementIdentity?.sourceFingerprint ?? null,
    fixture: measurementIdentity?.fixture ?? null,
    buildArtifact: measurementIdentity?.buildArtifact ?? null,
    harnessContract: {
      sampleCount: harnessContract?.sampleCountPerScenario ?? null,
      maxAttempts: PHASE_4_MAX_ATTEMPTS,
      scenarios: PHASE_4_SCENARIOS.map((scenario) => scenario.scenarioId),
      warmSetupMode: PHASE_4_WARM_SETUP_MODE,
    },
  };
}

function checkpointIdentitySummary(measurementIdentity) {
  return {
    sourceFingerprint: measurementIdentity?.sourceFingerprint ?? null,
    fixtureHash: measurementIdentity?.fixture?.phase3EvidenceFixtureHash ?? null,
    buildId: measurementIdentity?.buildArtifact?.buildId ?? null,
  };
}

function checkpointRedact(value) {
  return sanitizePhase4Evidence(value, "", [SYNTHETIC_PASSWORD]);
}

function phase4CheckpointMetadata(measurementIdentity) {
  return {
    phase: "AIya Performance Plan 1 Phase 4",
    identitySummary: checkpointIdentitySummary(measurementIdentity),
    sampleCount: PHASE_4_SAMPLE_COUNT,
    maxAttempts: PHASE_4_MAX_ATTEMPTS,
    scenarioIds: PHASE_4_SCENARIOS.map((scenario) => scenario.scenarioId),
  };
}

function openPhase4Checkpoint(measurementIdentity, harnessContract, options = {}) {
  assertPhaseDefinition(PHASE_4_DEFINITION);
  return openPhaseRun({
    root: PHASE_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_CHECKPOINT_SCHEMA_VERSION,
    identity: checkpointIdentity(measurementIdentity, harnessContract),
    metadata: phase4CheckpointMetadata(measurementIdentity),
    runId: options.runId ?? null,
    newRun: options.newRun === true,
    redact: checkpointRedact,
  });
}

function phase4ScenarioIds() {
  return PHASE_4_SCENARIOS.map((scenario) => scenario.scenarioId);
}

function countMigratablePhase4Events(events, scenarioIds) {
  const allowedTypes = new Set([
    "phase4.preparation",
    "phase4.preparation.failed",
    "phase4.attempt.started",
    "phase4.attempt.discarded",
    "phase4.attempt.failed",
    "phase4.fixture.failed",
    "phase4.round.committed",
  ]);
  const migratable = events.filter((event) => allowedTypes.has(event.type));
  const committedRoundsByGroup = new Map();
  for (const event of migratable) {
    const payload = event.payload ?? {};
    if (!payload.groupKey || typeof payload.groupKey !== "string") {
      throw new Error("phase4_compatible_migration_group_key_missing");
    }
    if (event.type !== "phase4.round.committed") continue;
    const samplesByScenario = payload.samplesByScenario;
    if (!samplesByScenario || typeof samplesByScenario !== "object") {
      throw new Error("phase4_compatible_migration_round_samples_missing");
    }
    for (const scenarioId of scenarioIds) {
      const samples = samplesByScenario[scenarioId];
      if (!Array.isArray(samples) || samples.length !== 1) {
        throw new Error("phase4_compatible_migration_round_shape_invalid");
      }
    }
    const groupRounds = committedRoundsByGroup.get(payload.groupKey) ?? 0;
    committedRoundsByGroup.set(payload.groupKey, groupRounds + 1);
  }
  return {
    migratable,
    committedRoundCount: migratable.filter(
      (event) => event.type === "phase4.round.committed",
    ).length,
    committedRoundsByGroup: Object.fromEntries(committedRoundsByGroup),
  };
}

export function migrateCompatiblePhase4Checkpoint(
  sourceRunId,
  measurementIdentity,
  harnessContract,
) {
  if (!sourceRunId || String(sourceRunId).startsWith("--")) {
    throw new Error("phase4_compatible_migration_source_run_required");
  }
  assertPhaseDefinition(PHASE_4_DEFINITION);
  const source = readPhaseRun({
    root: PHASE_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
    runId: sourceRunId,
  });
  if (source.manifest.phaseId !== PHASE_4_CHECKPOINT_PHASE_ID) {
    throw new Error("phase4_compatible_migration_phase_mismatch");
  }
  if (source.manifest.phaseSchemaVersion !== PHASE_4_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error("phase4_compatible_migration_schema_mismatch");
  }
  if (source.manifest.status === "COMPLETE") {
    throw new Error("phase4_compatible_migration_complete_source_rejected");
  }
  const metadata = source.manifest.metadata ?? {};
  const expectedScenarioIds = phase4ScenarioIds();
  if (
    metadata.sampleCount !== PHASE_4_SAMPLE_COUNT ||
    metadata.maxAttempts !== PHASE_4_MAX_ATTEMPTS ||
    JSON.stringify(metadata.scenarioIds ?? []) !== JSON.stringify(expectedScenarioIds)
  ) {
    throw new Error("phase4_compatible_migration_contract_mismatch");
  }
  const sourceSummary = source.manifest.identitySummary ?? metadata.identitySummary ?? {};
  const currentSummary = checkpointIdentitySummary(measurementIdentity);
  if (!sourceSummary.sourceFingerprint || !currentSummary.sourceFingerprint) {
    throw new Error("phase4_compatible_migration_source_fingerprint_missing");
  }
  if (sourceSummary.sourceFingerprint === currentSummary.sourceFingerprint) {
    throw new Error("phase4_compatible_migration_no_identity_change");
  }
  if (
    sourceSummary.fixtureHash !== currentSummary.fixtureHash ||
    sourceSummary.buildId !== currentSummary.buildId
  ) {
    throw new Error("phase4_compatible_migration_fixture_or_build_changed");
  }
  const eventPlan = countMigratablePhase4Events(source.events, expectedScenarioIds);
  const sourceIdentityFingerprint = source.manifest.identityFingerprint;
  const run = createPhaseRun({
    root: PHASE_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_CHECKPOINT_SCHEMA_VERSION,
    identity: checkpointIdentity(measurementIdentity, harnessContract),
    metadata: phase4CheckpointMetadata(measurementIdentity),
    redact: checkpointRedact,
  });
  try {
    run.append("run.migrated", {
      sourceRunId: source.manifest.runId,
      sourceIdentityFingerprint,
      sourceSourceFingerprint: sourceSummary.sourceFingerprint,
      targetSourceFingerprint: currentSummary.sourceFingerprint,
      reason: PHASE_4_MIGRATION_REASON,
      sourceEventCount: source.events.length,
      copiedEventCount: eventPlan.migratable.length,
      committedRoundCount: eventPlan.committedRoundCount,
      committedRoundsByGroup: eventPlan.committedRoundsByGroup,
    });
    for (const event of eventPlan.migratable) {
      run.append(event.type, {
        ...event.payload,
        migratedFromRunId: source.manifest.runId,
        migratedFromSequence: event.sequence,
        migratedFromEventSha256: event.eventSha256,
      });
    }
    const result = {
      status: "APPLIED",
      sourceRunId: source.manifest.runId,
      targetRunId: run.runId,
      sourceIdentityFingerprint,
      targetIdentityFingerprint: run.manifest.identityFingerprint,
      sourceEventCount: source.events.length,
      copiedEventCount: eventPlan.migratable.length,
      committedRoundCount: eventPlan.committedRoundCount,
      committedRoundsByGroup: eventPlan.committedRoundsByGroup,
      reason: PHASE_4_MIGRATION_REASON,
    };
    phase4CheckpointMigration = result;
    return result;
  } finally {
    run.close();
  }
}

function checkpointEvents(type, groupKey = null) {
  if (!activePhase4Checkpoint) return [];
  return activePhase4Checkpoint.eventsOf(type).filter((event) => {
    return groupKey == null || event.payload?.groupKey === groupKey;
  });
}

function checkpointRecord(type, payload, options = {}) {
  if (!activePhase4Checkpoint) return null;
  return activePhase4Checkpoint.append(type, payload, options);
}

function checkpointGroupKey(environment, profileId, fixtureId) {
  const base = `${environment}/${profileId}/${fixtureId}`;
  return activePhase4CycleId ? `${activePhase4CycleId}/${base}` : base;
}

function checkpointSamplesForGroup(groupKey) {
  const samplesByScenario = new Map(
    PHASE_4_SCENARIOS.map((scenario) => [scenario.scenarioId, []]),
  );
  for (const event of checkpointEvents("phase4.round.committed", groupKey)) {
    const persisted = event.payload?.samplesByScenario;
    if (!persisted || typeof persisted !== "object") {
      throw new Error("checkpoint_round_samples_missing");
    }
    for (const scenario of PHASE_4_SCENARIOS) {
      const samples = persisted[scenario.scenarioId];
      if (!Array.isArray(samples) || samples.length !== 1) {
        throw new Error("checkpoint_round_shape_invalid");
      }
      samplesByScenario.get(scenario.scenarioId).push(samples[0]);
    }
  }
  const counts = [...samplesByScenario.values()].map((samples) => samples.length);
  if (new Set(counts).size > 1) throw new Error("checkpoint_round_count_mismatch");
  return samplesByScenario;
}

function checkpointAttemptCount(groupKey) {
  return checkpointEvents("phase4.attempt.started", groupKey).length;
}

function checkpointDiscardedAttempts(groupKey) {
  return checkpointEvents("phase4.attempt.discarded", groupKey).map(
    (event) => event.payload,
  );
}

function checkpointFailedAttempts(groupKey) {
  return checkpointEvents("phase4.attempt.failed", groupKey).map(
    (event) => event.payload,
  );
}

function checkpointCommittedAttempts(groupKey) {
  return new Set(
    checkpointEvents("phase4.round.committed", groupKey)
      .map((event) => event.payload?.attempt)
      .filter((attempt) => Number.isInteger(attempt)),
  );
}

function checkpointTerminalAttempts(groupKey) {
  return new Set([
    ...checkpointCommittedAttempts(groupKey),
    ...checkpointDiscardedAttempts(groupKey)
      .map((attempt) => attempt?.attempt)
      .filter((attempt) => Number.isInteger(attempt)),
    ...checkpointFailedAttempts(groupKey)
      .map((attempt) => attempt?.attempt)
      .filter((attempt) => Number.isInteger(attempt)),
  ]);
}

function recoverUnfinishedCheckpointAttempts({
  groupKey,
  fixture,
  profile,
  environment,
}) {
  const terminalAttempts = checkpointTerminalAttempts(groupKey);
  const recovered = [];
  for (const event of checkpointEvents("phase4.attempt.started", groupKey)) {
    const attempt = event.payload?.attempt;
    if (!Number.isInteger(attempt) || terminalAttempts.has(attempt)) continue;
    const failure = {
      groupKey,
      fixtureId: fixture.id,
      fixtureClass: fixture.fixtureClass,
      profileId: profile.id,
      environment: environment ?? null,
      attempt,
      reason: "previous_execution_unfinished_attempt",
      recovery: "recovered_on_resume",
      error: {
        classification: "execution_interrupted",
        name: "ExecutionInterrupted",
        message: "The previous execution ended after the attempt started and before a terminal result was committed.",
        stack: null,
        phase: "checkpoint_recovery",
        scenarioId: null,
      },
    };
    checkpointRecord("phase4.attempt.failed", failure);
    terminalAttempts.add(attempt);
    recovered.push(failure);
  }
  return recovered;
}

function checkpointShouldPause() {
  return activePhase4Checkpoint?.pauseRequested() ?? null;
}

function bindPhase4RemeasurementCycle(requestedCycleId) {
  const cycle = getActivePhaseCycle(activePhase4Checkpoint);
  if (!requestedCycleId) {
    if (cycle) throw new Error("phase4_active_cycle_requires_cycle_id");
    return null;
  }
  if (!cycle) throw new Error("phase4_remeasurement_cycle_not_active");
  if (cycle.cycleId !== requestedCycleId) {
    throw new Error("phase4_remeasurement_cycle_id_mismatch");
  }
  if (cycle.state !== "REMEASURE") {
    throw new Error(`phase4_remeasurement_cycle_not_ready:${cycle.state}`);
  }
  activePhase4CycleId = cycle.cycleId;
  checkpointRecord("phase.cycle.remeasurement.started", {
    cycleId: cycle.cycleId,
    cycleNumber: cycle.cycleNumber,
    officialSamplesAdded: 0,
    groupNamespace: cycle.cycleId,
  });
  return cycle;
}

function phase4CycleEvidence() {
  if (!activePhase4Checkpoint) return [];
  return readPhaseCycles({
    root: PHASE_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
    runId: activePhase4Checkpoint.runId,
  }).cycles;
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: options.shell ?? process.platform === "win32",
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: options.timeout ?? 180_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readinessStage(evidence, stageId) {
  return Array.isArray(evidence?.stageLedger)
    ? evidence.stageLedger.find((stage) => stage.stageId === stageId) ?? null
    : null;
}

function readinessStageSummary(evidence) {
  return PHASE_4_READINESS_STAGE_IDS.map((stageId) => {
    const stage = readinessStage(evidence, stageId);
    return {
      stageId,
      status: stage?.status ?? "MISSING",
      blockingReason: stage?.blockingReason ?? null,
    };
  });
}

function measurementIdentityMatches(expected, actual) {
  return Boolean(expected && actual) && JSON.stringify(expected) === JSON.stringify(actual);
}

function hostedConfigurationsMatch(first, second) {
  return (
    first?.status === "READY" &&
    second?.status === "READY" &&
    first.baseUrl === second.baseUrl &&
    first.email === second.email &&
    first.password === second.password
  );
}

function localSupabaseInputsMatch(first, second) {
  return (
    first?.status === "PASS" &&
    second?.status === "PASS" &&
    first.apiUrl === second.apiUrl &&
    first.anonKey === second.anonKey &&
    first.serviceRoleKey === second.serviceRoleKey
  );
}

function hostedInputSourceIsApproved(readinessEvidence) {
  const authentication = readinessStage(readinessEvidence, "H3")?.verificationResults
    ?.hosted?.authentication;
  const input = authentication?.input;
  const normalizedPath = String(input?.filePath ?? "").replaceAll("\\", "/");
  return (
    authentication?.status === "PASS" &&
    input?.status === "READY" &&
    input?.source === "hosted_env_file" &&
    input?.fileSource === "repo_runtime_file" &&
    normalizedPath.endsWith(PHASE_4_HOSTED_ENV_RELATIVE_PATH) &&
    input?.requiredKeys?.AIYA_PHASE4_HOSTED_BASE_URL === true &&
    input?.requiredKeys?.AIYA_PHASE4_HOSTED_EMAIL === true &&
    input?.requiredKeys?.AIYA_PHASE4_HOSTED_PASSWORD === true
  );
}

function readinessHostedPreflight(readinessEvidence) {
  const authentication = readinessStage(readinessEvidence, "H3")?.verificationResults
    ?.hosted?.authentication;
  if (!authentication) {
    return {
      status: "BLOCKED",
      reason: "readiness_hosted_authentication_missing",
      input: null,
      health: null,
      login: {
        status: null,
        authenticated: false,
        workspaceOpened: false,
        shellVisible: false,
        loginVisible: null,
      },
      requiredRead: {
        route: "/api/shell/bootstrap",
        status: "NOT_RUN",
        bodyFinished: false,
      },
    };
  }
  return {
    status: authentication.status === "PASS" ? "PASS" : "BLOCKED",
    reason: authentication.reason ?? null,
    input: authentication.input ?? null,
    health: authentication.health ?? null,
    login: authentication.login ?? null,
    requiredRead: authentication.requiredRead ?? null,
  };
}

export function evaluatePhase4MeasurementStartGate({
  commandResult,
  readinessEvidence,
  measurementIdentityAtStart,
  hostedInputsStable,
  localInputsStable,
} = {}) {
  const commandPass =
    (commandResult?.status === 0 || commandResult?.status === "PASS") &&
    commandResult?.timedOut !== true;
  const stageStatuses = readinessStageSummary(readinessEvidence);
  const stageOrderPass =
    Array.isArray(readinessEvidence?.stageLedger) &&
    readinessEvidence.stageLedger.length === PHASE_4_READINESS_STAGE_IDS.length &&
    readinessEvidence.stageLedger.every(
      (stage, index) =>
        stage.stageId === PHASE_4_READINESS_STAGE_IDS[index] &&
        stage.status === "COMPLETE",
    );
  const environmentKeys = {
    localDesktop: "localDesktop",
    ownerPcHosted: "ownerPcHosted",
    androidChrome: "androidChrome",
    installedAndroidPwa: "installedAndroidPwa",
  };
  const environmentStatuses = Object.fromEntries(
    Object.entries(environmentKeys).map(([environment, key]) => [
      environment,
      readinessEvidence?.environmentMatrix?.[key]?.status ?? "MISSING",
    ]),
  );
  const environmentsPass = Object.values(environmentStatuses).every(
    (status) => status === "PASS",
  );
  const testsPass =
    readinessEvidence?.closure?.testsPass === true &&
    Array.isArray(readinessEvidence?.tests) &&
    readinessEvidence.tests.length > 0 &&
    readinessEvidence.tests.every((testResult) => testResult.status === "PASS");
  const evidenceIntegrityPass =
    readinessEvidence?.closure?.evidenceIntegrityPass === true &&
    readinessEvidence?.evidenceIntegrity?.status === "PASS";
  const baselineNotStarted =
    readinessEvidence?.executionMode === "readiness_only" &&
    readinessEvidence?.constraints?.baselineStarted === false &&
    readinessStage(readinessEvidence, "H4")?.verificationResults?.baselineStarted === false &&
    Object.values(readinessEvidence?.environmentMatrix ?? {}).every(
      (environment) => environment?.baselineStatus === "NOT_RUN",
    );
  const hostedPreflight = readinessHostedPreflight(readinessEvidence);
  const hostedSourcePass = hostedInputSourceIsApproved(readinessEvidence);
  const identityPass = measurementIdentityMatches(
    readinessEvidence?.measurementIdentity,
    measurementIdentityAtStart,
  );
  const readinessOutcomePass =
    readinessEvidence?.status === "COMPLETE" &&
    readinessEvidence?.outcome === "READY_FOR_PHASE4_BASELINE";
  const gatePass =
    commandPass &&
    readinessOutcomePass &&
    stageOrderPass &&
    environmentsPass &&
    testsPass &&
    evidenceIntegrityPass &&
    baselineNotStarted &&
    hostedPreflight.status === "PASS" &&
    hostedSourcePass &&
    hostedInputsStable === true &&
    localInputsStable === true &&
    identityPass;
  let reason = null;
  if (!commandPass) reason = "measurement_readiness_command_failed";
  else if (!readinessEvidence) reason = "measurement_readiness_evidence_missing";
  else if (!readinessOutcomePass) reason = "measurement_readiness_not_complete";
  else if (!stageOrderPass) reason = "measurement_readiness_stage_gate_failed";
  else if (!environmentsPass) reason = "measurement_readiness_environment_gate_failed";
  else if (!testsPass) reason = "measurement_readiness_tests_failed";
  else if (!evidenceIntegrityPass) reason = "measurement_readiness_evidence_integrity_failed";
  else if (!baselineNotStarted) reason = "measurement_readiness_baseline_already_started";
  else if (!hostedSourcePass || hostedPreflight.status !== "PASS") {
    reason = "measurement_readiness_hosted_authentication_gate_failed";
  } else if (hostedInputsStable !== true) {
    reason = "measurement_start_hosted_inputs_changed";
  } else if (localInputsStable !== true) {
    reason = "measurement_start_local_inputs_changed";
  } else if (!identityPass) {
    reason = "measurement_start_identity_changed_after_readiness";
  } else if (!gatePass) {
    reason = "measurement_start_gate_failed";
  }
  return {
    status: gatePass ? "PASS" : "BLOCKED",
    reason,
    command: {
      status: commandPass ? "PASS" : "FAIL",
      exitCode: commandResult?.exitCode ?? null,
      timedOut: commandResult?.timedOut === true,
      outputRecorded: false,
    },
    readiness: {
      runId: readinessEvidence?.runId ?? null,
      status: readinessEvidence?.status ?? "MISSING",
      outcome: readinessEvidence?.outcome ?? null,
      executionMode: readinessEvidence?.executionMode ?? null,
      stageStatuses,
      environmentStatuses,
    },
    hostedPreflight,
    hostedInputSource: hostedSourcePass ? "repo_runtime_file" : "NOT_VERIFIED",
    hostedInputsStable: hostedInputsStable === true,
    localInputsStable: localInputsStable === true,
    baselineStarted: readinessEvidence?.constraints?.baselineStarted === true,
    identity: {
      status: identityPass ? "PASS" : "BLOCKED",
      readinessSourceFingerprint: readinessEvidence?.measurementIdentity?.sourceFingerprint ?? null,
      measurementStartSourceFingerprint: measurementIdentityAtStart?.sourceFingerprint ?? null,
      readinessBuildId: readinessEvidence?.measurementIdentity?.buildArtifact?.buildId ?? null,
      measurementStartBuildId: measurementIdentityAtStart?.buildArtifact?.buildId ?? null,
    },
  };
}

function runPhase4ReadinessGate() {
  const result = run(
    process.execPath,
    [phase4ReadinessCliPath],
    { cwd: appRoot, shell: false, timeout: PHASE_4_READINESS_GATE_TIMEOUT_MS },
  );
  return {
    command: {
      path: relative(repoRoot, phase4ReadinessCliPath).replaceAll("\\", "/"),
      status: result.status === 0 ? "PASS" : "FAIL",
      exitCode: result.status,
      timedOut: result.timedOut,
      outputRecorded: false,
    },
    evidence: readJson(phase4ReadinessEvidencePath),
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeCanonicalPhase4Evidence(value) {
  if (existsSync(evidencePath)) {
    const prior = readJson(evidencePath);
    const archiveToken = String(prior.runId || prior.generatedAt || Date.now())
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const archivePath = join(
      docsRoot,
      `AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE_HISTORY_${archiveToken}.json`,
    );
    if (!existsSync(archivePath)) copyFileSync(evidencePath, archivePath);
  }
  writeJson(evidencePath, value);
}

function percentile(values, p) {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const index = Math.max(0, Math.min(usable.length - 1, Math.ceil((p / 100) * usable.length) - 1));
  return usable[index];
}

export function calculateTaskReadyMs(actionStartAt, readyAt) {
  if (!Number.isFinite(actionStartAt) || !Number.isFinite(readyAt)) return null;
  return Math.max(0, readyAt - actionStartAt);
}

export function sanitizeRoute(input) {
  let pathname = String(input ?? "");
  try {
    pathname = new URL(pathname, "http://local.invalid").pathname;
  } catch {
    pathname = pathname.split("?")[0];
  }
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\bclient-[a-z0-9_-]+\b/gi, ":clientId")
    .replace(/\/[0-9]+(?=\/|$)/g, "/:id");
}

export function routeMatches(actual, expected) {
  const actualPath = sanitizeRoute(actual).replace(/:[^/]+/g, ":id");
  const expectedPath = sanitizeRoute(expected).replace(/:[^/]+/g, ":id");
  return actualPath === expectedPath || actualPath.startsWith(expectedPath + "/");
}

function collectGitEvidence() {
  const branch = run("git", ["branch", "--show-current"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const diffCheck = run("git", ["diff", "--check"]);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    upstreamHead: upstream.status === 0 ? upstream.stdout.trim() : null,
    statusShortBranch: status.stdout.trim(),
    diffCheck: diffCheck.status === 0 ? "PASS" : "FAIL",
  };
}

export function phase2Prerequisite() {
  const evidence = readJson(phase2EvidencePath);
  return {
    present: Boolean(evidence),
    status: evidence?.status ?? null,
    outcome: evidence?.outcome ?? null,
    harnessReady: evidence?.outcome === REQUIRED_PHASE2_OUTCOME,
    phase2Identity: evidence?.sourceIdentity?.head ?? evidence?.sourceHead ?? null,
  };
}

export function phase3Prerequisite() {
  const evidence = readJson(phase3EvidencePath);
  return {
    present: Boolean(evidence),
    status: evidence?.status ?? null,
    outcome: evidence?.outcome ?? null,
    fixtureHash: evidence?.fixture?.hash ?? null,
    localApiUrl: evidence?.localTarget?.apiUrl ?? null,
    fixtureReady: evidence?.finalControls?.fixtureReady === true,
    authenticatedSessionReady: evidence?.finalControls?.authenticatedSessionReady === true,
    phase3Identity: evidence?.sourceIdentity?.head ?? null,
  };
}

export function parseLocalSupabaseStatus() {
  const result = run(npxCommand(), ["supabase", "status", "-o", "json"], { cwd: appRoot });
  if (result.status !== 0) return { status: "BLOCKED", reason: "supabase_status_failed" };
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { status: "BLOCKED", reason: "supabase_status_not_json" };
  }
  const apiUrl = parsed.API_URL ?? null;
  const localUrl = LOCAL_SUPABASE_URL_PATTERN.test(apiUrl || "");
  return {
    status: localUrl && parsed.ANON_KEY && parsed.SERVICE_ROLE_KEY ? "PASS" : "BLOCKED",
    apiUrl,
    urlIsLocal: localUrl,
    anonKey: parsed.ANON_KEY ?? null,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY ?? null,
    credentialsRecorded: false,
    reason: localUrl ? null : "remote_supabase_target_rejected",
  };
}

async function collectReleaseIdentity(baseUrl) {
  const endpoint = String(baseUrl).replace(/\/$/, "") + "/api/health/release";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return {
      endpoint: sanitizeTargetUrl(endpoint),
      status: response.status,
      apiStatus: typeof payload.status === "string" ? payload.status : null,
      releaseId: payload.releaseId ?? payload.release ?? null,
      commit: payload.commit ?? payload.commitSha ?? null,
      migrationFingerprint: payload.migrationFingerprint ?? payload.migration_fingerprint ?? null,
      compatibilityVersion: payload.compatibilityVersion ?? null,
    };
  } catch {
    return {
      endpoint: sanitizeTargetUrl(endpoint),
      status: "FETCH_FAILED",
      apiStatus: null,
      releaseId: null,
      commit: null,
      migrationFingerprint: null,
      compatibilityVersion: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function releaseIdentityIsHealthy(identity) {
  return identity?.status === 200 && identity.apiStatus === "ok";
}

export function sanitizeTargetUrl(input) {
  try {
    const parsed = new URL(String(input));
    return parsed.origin + parsed.pathname;
  } catch {
    return String(input).split("?")[0].split("#")[0];
  }
}

function relevantRequest(request) {
  let pathname = "";
  try {
    pathname = new URL(request.url()).pathname;
  } catch {
    return false;
  }
  return pathname.startsWith("/api/") || request.resourceType() === "document";
}

export function classifyHarnessError(error) {
  const message = String(error ?? "").toLowerCase();
  if (message.includes("target page, context or browser has been closed")) {
    return "browser_context_closed";
  }
  if (message.includes("timeout")) return "playwright_timeout";
  if (message.includes("response")) return "response_capture_failed";
  return "browser_baseline_unclassified_error";
}

function sanitizeHarnessErrorText(value, limit = 600) {
  let text = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const secret of [SYNTHETIC_PASSWORD].filter(Boolean)) {
    text = text.split(String(secret)).join("<redacted>");
  }
  text = text.replace(/Bearer\s+[^\s]+/gi, "Bearer <redacted>");
  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "<redacted-email>",
  );
  text = text.replace(/https?:\/\/[^\s)'\"]+/gi, (url) => sanitizeTargetUrl(url));
  return text.slice(0, limit);
}

export function describeHarnessError(error, context = {}) {
  const errorObject = error && typeof error === "object" ? error : null;
  return {
    classification: classifyHarnessError(error),
    name: sanitizeHarnessErrorText(errorObject?.name || "Error", 120),
    message: sanitizeHarnessErrorText(errorObject?.message || error, 600),
    stack: errorObject?.stack
      ? sanitizeHarnessErrorText(errorObject.stack, 1_600)
      : null,
    phase: context.phase ?? null,
    scenarioId: context.scenarioId ?? null,
  };
}

function annotateHarnessError(error, context) {
  const annotated = error instanceof Error ? error : new Error(String(error));
  Object.defineProperty(annotated, "phase4Context", {
    configurable: true,
    enumerable: false,
    value: context,
  });
  return annotated;
}

function phase4AttemptFailure({
  error,
  groupKey,
  fixture,
  profile,
  environment,
  attempt,
  phase,
}) {
  const errorContext = error?.phase4Context ?? {};
  const classification = classifyHarnessError(error);
  return {
    groupKey,
    fixtureId: fixture.id,
    fixtureClass: fixture.fixtureClass,
    profileId: profile.id,
    environment: environment ?? null,
    attempt,
    reason: `${phase}_${classification}`,
    recovery: "requires_new_measurement_context",
    error: describeHarnessError(error, {
      phase: errorContext.phase ?? phase,
      scenarioId: errorContext.scenarioId ?? null,
    }),
  };
}

function createRequestTracker(page, requiredReads = []) {
  const requestStarted = new Map();
  const summaries = [];
  const pending = new Set();
  const pendingItems = new Map();
  const recordedRequests = new Set();
  const failed = [];

  const recordResponse = (request, item) => {
    if (recordedRequests.has(request)) return;
    recordedRequests.add(request);
    summaries.push(item);
  };

  const shouldAwaitBody = (started) =>
    started.resourceType === "document" ||
    (started.method === "GET" &&
      requiredReads.some((expected) =>
        routeMatches(sanitizeRoute(started.url), expected),
      ));

  const onRequest = (request) => {
    if (!relevantRequest(request)) return;
    requestStarted.set(request, {
      startedAt: Date.now(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  };

  const onResponse = (response) => {
    const request = response.request();
    const started = requestStarted.get(request);
    if (!started) return;
    const item = {
      route: sanitizeRoute(started.url),
      method: started.method,
      resourceType: started.resourceType,
      status: response.status(),
      headerReceivedMs: Date.now() - started.startedAt,
      bodyFinishedMs: null,
    };
    if (!shouldAwaitBody(started)) {
      recordResponse(request, item);
      return;
    }
    pendingItems.set(request, item);
    const work = (async () => {
      try {
        await response.finished();
      } catch {
        item.bodyFinishedMs = null;
        item.failure = "response_body_failed";
      }
      if (!item.failure) item.bodyFinishedMs = Date.now() - started.startedAt;
      recordResponse(request, item);
    })();
    pending.add(work);
    void work
      .finally(() => {
        pending.delete(work);
        pendingItems.delete(request);
      })
      .catch(() => undefined);
  };

  const onRequestFailed = (request) => {
    if (!relevantRequest(request)) return;
    const failure = request.failure()?.errorText;
    failed.push({
      route: sanitizeRoute(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      status: null,
      headerReceivedMs: null,
      bodyFinishedMs: null,
      failure: failure ? String(failure).slice(0, 80) : "transport_failure",
    });
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);

  return {
    async waitForRequiredReads(timeoutMs = PHASE_2_HARNESS_CONTRACT.requiredReadTimeoutMs) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const current = [...summaries, ...failed];
        const missing = requiredReads.filter(
          (expected) => !hasSuccessfulRead(current, expected),
        );
        if (!missing.length) return { status: "PASS", missing: [] };
        await sleep(100);
      }
      const current = [...summaries, ...failed];
      return {
        status: "TIMEOUT",
        missing: requiredReads.filter(
          (expected) => !hasSuccessfulRead(current, expected),
        ),
      };
    },
    async finish() {
      const pendingWork = Promise.allSettled([...pending]).then(() => false);
      const timeout = sleep(PHASE_2_HARNESS_CONTRACT.requiredReadTimeoutMs).then(
        () => true,
      );
      if (await Promise.race([pendingWork, timeout])) {
        for (const [request, item] of pendingItems.entries()) {
          item.bodyFinishedMs = null;
          item.timeout = true;
          item.failure = "response_body_timeout";
          recordResponse(request, item);
        }
      }
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
      return [...summaries, ...failed].sort((a, b) => String(a.route).localeCompare(String(b.route)));
    },
  };
}

export async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    window.__aiyaPhase4Perf ??= {
      lcp: null,
      cls: 0,
      longTasks: [],
      interaction: null,
    };
    const installInteractionObserver = () => {
      if (window.__aiyaPhase4InteractionObserverInstalled) return;
      window.__aiyaPhase4InteractionObserverInstalled = true;
      document.addEventListener(
        "click",
        (event) => {
          const interaction = window.__aiyaPhase4Perf?.interaction;
          if (!interaction || interaction.eventAt != null || event.isTrusted !== true) {
            return;
          }
          const eventAt = performance.now();
          const eventWallMs = Date.now();
          interaction.eventAt = eventAt;
          interaction.trusted = true;
          sessionStorage.setItem(
            "aiya-phase4-trusted-interaction-event-wall-ms",
            String(eventWallMs),
          );
          requestAnimationFrame(() => {
            if (window.__aiyaPhase4Perf?.interaction?.eventAt !== eventAt) return;
            const nextPaintAt = performance.now();
            interaction.nextPaintAt = nextPaintAt;
            sessionStorage.setItem(
              "aiya-phase4-trusted-interaction-next-paint-ms",
              String(Math.max(0, Math.round(nextPaintAt - eventAt))),
            );
          });
        },
        true,
      );
    };
    window.__aiyaPhase4InstallInteractionObserver = installInteractionObserver;
    installInteractionObserver();
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__aiyaPhase4Perf.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__aiyaPhase4Perf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__aiyaPhase4Perf.longTasks.push({ duration: entry.duration });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
  await page
    .evaluate(() => {
      window.__aiyaPhase4Perf ??= {
        lcp: null,
        cls: 0,
        longTasks: [],
        interaction: null,
      };
      window.__aiyaPhase4InstallInteractionObserver?.();
    })
    .catch(() => undefined);
}

async function resetPerformanceObservers(page) {
  await page
    .evaluate(() => {
      if (window.__aiyaPhase4Perf) {
        window.__aiyaPhase4Perf.lcp = null;
        window.__aiyaPhase4Perf.cls = 0;
        window.__aiyaPhase4Perf.longTasks = [];
        window.__aiyaPhase4Perf.interaction = null;
      }
      performance.clearMarks("aiya-phase4-action-start");
      performance.clearMeasures("aiya-phase4-action-to-paint");
      sessionStorage.removeItem("aiya-phase4-trusted-interaction-event-wall-ms");
      sessionStorage.removeItem("aiya-phase4-trusted-interaction-next-paint-ms");
    })
    .catch(() => undefined);
}

async function readPageMetrics(page) {
  return page
    .evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const fcp = paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
      const longTasks = window.__aiyaPhase4Perf?.longTasks ?? [];
      return {
        fcpMs: Number.isFinite(fcp) ? Math.round(fcp) : null,
        lcpMs: Number.isFinite(window.__aiyaPhase4Perf?.lcp)
          ? Math.round(window.__aiyaPhase4Perf.lcp)
          : null,
        cls: Number((window.__aiyaPhase4Perf?.cls || 0).toFixed(4)),
        longTaskCount: longTasks.length,
        totalBlockingMs: Math.round(
          longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
        ),
        maxLongTaskMs: Math.round(longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
        domContentLoadedMs: Number.isFinite(navigation?.domContentLoadedEventEnd)
          ? Math.round(navigation.domContentLoadedEventEnd)
          : null,
        loadEventEndMs: Number.isFinite(navigation?.loadEventEnd)
          ? Math.round(navigation.loadEventEnd)
          : null,
        serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
        displayModeStandalone: window.matchMedia?.("(display-mode: standalone)")?.matches === true,
      };
    })
    .catch(() => ({
      fcpMs: null,
      lcpMs: null,
      cls: null,
      longTaskCount: null,
      totalBlockingMs: null,
      maxLongTaskMs: null,
      domContentLoadedMs: null,
      loadEventEndMs: null,
      serviceWorkerControlled: false,
      displayModeStandalone: false,
    }));
}

async function firstActionable(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      const enabled = await candidate.isEnabled().catch(() => false);
      if (visible && enabled) return { locator: candidate, selector, index };
    }
  }
  return null;
}

export async function clickRealActionableTarget(
  page,
  locator,
  { timeout = PHASE_4_ACTION_CLICK_TIMEOUT_MS } = {},
) {
  const deadline = Date.now() + timeout;
  let previous = null;
  let lastState = null;
  while (Date.now() < deadline) {
    try {
      const state = await locator.evaluate((element) => {
        if (!element?.isConnected) return { status: "missing" };
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        const style = getComputedStyle(element);
        return {
          status: "ready",
          x,
          y,
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0,
          inViewport:
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight,
          enabled: element.disabled !== true && element.getAttribute("aria-disabled") !== "true",
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
          opacity: Number(style.opacity),
          hitTarget: hit === element || Boolean(hit && element.contains(hit)),
        };
      });
      lastState = state;
      const ready =
        state.status === "ready" &&
        state.visible === true &&
        state.inViewport === true &&
        state.enabled === true &&
        state.pointerEvents === "auto" &&
        state.visibility !== "hidden" &&
        state.opacity > 0 &&
        state.hitTarget === true;
      const stable =
        ready &&
        previous &&
        Math.abs(previous.x - state.x) < 0.5 &&
        Math.abs(previous.y - state.y) < 0.5 &&
        Math.abs(previous.width - state.width) < 0.5 &&
        Math.abs(previous.height - state.height) < 0.5;
      if (stable) {
        // Android Chrome CDP accepts Playwright's locator input path here; direct
        // page.mouse coordinates can complete without producing a DOM event.
        await locator.click({
          force: true,
          timeout: Math.max(1, Math.min(timeout, deadline - Date.now())),
        });
        return state;
      }
      if (
        state.status === "ready" &&
        state.visible === true &&
        state.inViewport === false
      ) {
        await locator
          .scrollIntoViewIfNeeded({
            timeout: Math.max(1, Math.min(timeout, deadline - Date.now())),
          })
          .catch(() => undefined);
        previous = null;
        await page.waitForTimeout(PHASE_4_ANDROID_CLICK_STABILITY_POLL_MS);
        continue;
      }
      previous = ready ? state : null;
    } catch (error) {
      lastState = { status: "error", error: String(error).split("\n")[0].slice(0, 160) };
      previous = null;
    }
    await page.waitForTimeout(PHASE_4_ANDROID_CLICK_STABILITY_POLL_MS);
  }
  const detail = lastState?.status === "ready"
    ? JSON.stringify({
        visible: lastState.visible,
        inViewport: lastState.inViewport,
        enabled: lastState.enabled,
        pointerEvents: lastState.pointerEvents,
        visibility: lastState.visibility,
        hitTarget: lastState.hitTarget,
      })
    : lastState?.error || lastState?.status || "unavailable";
  throw new Error("real_click_target_not_stable:" + detail);
}

async function discardDirtyNavigationIfPresent(page) {
  const dialog = page.locator('[data-testid="shell-dirty-navigation-dialog"]');
  if (!(await dialog.isVisible().catch(() => false))) return false;
  await page.locator('[data-testid="shell-dirty-discard"]').click({ timeout: 8_000 });
  await dialog.waitFor({ state: "hidden", timeout: 8_000 }).catch(() => undefined);
  return true;
}

async function waitForFirstActionable(page, selectors, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const target = await firstActionable(page, selectors);
    if (target) return target;
    await page.waitForTimeout(PHASE_4_ANDROID_CLICK_STABILITY_POLL_MS);
  }
  return null;
}

async function clickFirstActionableWithDirtyRecovery(
  page,
  selectors,
  missingError,
  { androidCdp = false, trace = null, traceLabel = null } = {},
) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    tracePhase4Action(trace, "actionable_wait_started", {
      label: traceLabel,
      attempt: attempt + 1,
    });
    await discardDirtyNavigationIfPresent(page);
    const target = await waitForFirstActionable(
      page,
      selectors,
      PHASE_4_ACTION_CLICK_TIMEOUT_MS,
    );
    if (!target) {
      tracePhase4Action(trace, "actionable_wait_timeout", {
        label: traceLabel,
        attempt: attempt + 1,
      });
      throw new Error(missingError);
    }
    tracePhase4Action(trace, "actionable_target_found", {
      label: traceLabel,
      attempt: attempt + 1,
      selector: target.selector,
      index: target.index,
    });
    try {
      if (androidCdp) {
        await page.bringToFront();
        tracePhase4Action(trace, "real_click_started", {
          label: traceLabel,
          attempt: attempt + 1,
        });
        await clickRealActionableTarget(page, target.locator);
      } else {
        await target.locator.scrollIntoViewIfNeeded({ timeout: PHASE_4_ACTION_CLICK_TIMEOUT_MS });
        await target.locator.click({ timeout: PHASE_4_ACTION_CLICK_TIMEOUT_MS });
      }
      await discardDirtyNavigationIfPresent(page);
      tracePhase4Action(trace, "actionable_click_completed", {
        label: traceLabel,
        attempt: attempt + 1,
      });
      return;
    } catch (error) {
      lastError = error;
      tracePhase4Action(trace, "actionable_click_failed", {
        label: traceLabel,
        attempt: attempt + 1,
        error: String(error).split("\n")[0].slice(0, 240),
      });
      if (!(await discardDirtyNavigationIfPresent(page))) break;
    }
  }
  throw lastError;
}

function tracePhase4Action(trace, event, details = {}) {
  if (!Array.isArray(trace)) return;
  if (trace.length >= 500) return;
  trace.push({
    at: new Date().toISOString(),
    event: String(event).slice(0, 80),
    ...details,
  });
}

async function navigationSurfaceSnapshot(page) {
  return page
    .evaluate(() => ({
      pathname: window.location.pathname,
      authenticatedShell: Boolean(document.querySelector('[data-testid="authenticated-shell"]')),
      compactBottomNav: Boolean(document.querySelector('[data-testid="shell-compact-bottom-nav"]')),
      morePage: Boolean(document.querySelector('[data-testid="more-page"]')),
      morePageVisible: Boolean(
        document.querySelector('[data-testid="more-page"]')?.getClientRects().length,
      ),
      aiChatItem: Boolean(document.querySelector('[data-testid="more-item-ai_chat"]')),
      aiChatItemVisible: Boolean(
        document.querySelector('[data-testid="more-item-ai_chat"]')?.getClientRects().length,
      ),
      aiChatItemDisabled: Boolean(
        document.querySelector('[data-testid="more-item-ai_chat-disabled"]'),
      ),
      navigationLocked: Boolean(
        document.querySelector('[data-testid="shell-navigation-lock"]'),
      ),
    }))
    .catch(() => ({
      pathname: null,
      authenticatedShell: false,
      compactBottomNav: false,
      morePage: false,
      morePageVisible: false,
      aiChatItem: false,
      aiChatItemVisible: false,
      aiChatItemDisabled: false,
      navigationLocked: false,
    }));
}

async function clickDestination(page, destination, options = {}) {
  const trace = options.trace;
  tracePhase4Action(trace, "destination_started", {
    destination,
    androidCdp: options.androidCdp === true,
  });
  const href = destination === "ai_chat" ? "/dashboard/ai-chat" : "/dashboard?section=" + destination;
  const compactAndroid =
    destination === "ai_chat" &&
    options.androidCdp === true &&
    (await page.evaluate(() => window.innerWidth < 768).catch(() => false));

  tracePhase4Action(trace, "destination_layout_resolved", {
    destination,
    compactAndroid,
  });

  if (compactAndroid) {
    try {
      tracePhase4Action(trace, "more_navigation_click_started", {});
      await clickFirstActionableWithDirtyRecovery(
        page,
        [
          '[data-testid="shell-compact-bottom-nav"] a[href="/dashboard/more"]',
          '[data-testid="shell-wide-nav"] a[href="/dashboard/more"]',
          'a[href="/dashboard/more"]',
        ],
        "more_destination_selector_missing",
        { ...options, traceLabel: "compact_more_navigation" },
      );
      tracePhase4Action(trace, "more_navigation_click_completed", await navigationSurfaceSnapshot(page));
      tracePhase4Action(trace, "more_page_wait_started", { timeoutMs: 15_000 });
      await page.locator('[data-testid="more-page"]').waitFor({
        state: "visible",
        timeout: 15_000,
      });
      tracePhase4Action(trace, "more_page_ready", await navigationSurfaceSnapshot(page));
      tracePhase4Action(trace, "more_ai_chat_click_started", {});
      await clickFirstActionableWithDirtyRecovery(
        page,
        ['[data-testid="more-item-ai_chat"]'],
        "more_ai_chat_selector_missing",
        { ...options, traceLabel: "compact_ai_chat_item" },
      );
      tracePhase4Action(trace, "more_ai_chat_click_completed", await navigationSurfaceSnapshot(page));
      return;
    } catch (error) {
      tracePhase4Action(trace, "destination_failed", {
        destination,
        error: String(error).split("\n")[0].slice(0, 240),
        ...(await navigationSurfaceSnapshot(page)),
      });
      throw new Error(
        "destination_click_failed:" +
          destination +
          ":" +
          String(error).split("\n")[0].slice(0, 120),
      );
    }
  }

  const selectors = [
    '[data-testid="shell-wide-nav"] a[href="' + href + '"]',
    '[data-testid="shell-medium-rail"] a[href="' + href + '"]',
    '[data-testid="shell-compact-bottom-nav"] a[href="' + href + '"]',
    'a[href="' + href + '"]',
  ];
  if (destination === "notifications") selectors.push('[data-testid="shell-header-bell"]');
  try {
    tracePhase4Action(trace, "desktop_destination_click_started", { destination });
    await clickFirstActionableWithDirtyRecovery(
      page,
      selectors,
      "destination_selector_missing:" + destination,
      options,
    );
    tracePhase4Action(trace, "desktop_destination_click_completed", {
      destination,
      ...(await navigationSurfaceSnapshot(page)),
    });
  } catch (error) {
    tracePhase4Action(trace, "destination_failed", {
      destination,
      error: String(error).split("\n")[0].slice(0, 240),
      ...(await navigationSurfaceSnapshot(page)),
    });
    throw new Error(
      "destination_click_failed:" +
        destination +
        ":" +
        String(error).split("\n")[0].slice(0, 120),
    );
  }
}

async function clickClientTask(page, task, options = {}) {
  await clickDestination(page, "clients", options);
  await page.locator('[data-testid="client-roster"]').waitFor({ state: "visible", timeout: 15_000 });
  try {
    await clickFirstActionableWithDirtyRecovery(
      page,
      ['[data-testid="client-roster-item"]'],
      "client_roster_item_missing",
      options,
    );
  } catch (error) {
    throw new Error(
      "client_task_client_click_failed:" +
        task +
        ":" +
        String(error).split("\n")[0].slice(0, 120),
    );
  }
  await page
    .locator('[data-testid="client-task-hub"], [data-testid="client-detail"]')
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  const tabId = TASK_TAB_IDS[task];
  try {
    await clickFirstActionableWithDirtyRecovery(
      page,
      ['[data-testid="tab-' + tabId + '"]'],
      "client_task_selector_missing:" + tabId,
      options,
    );
  } catch (error) {
    throw new Error(
      "client_task_tab_click_failed:" +
        task +
        ":" +
        String(error).split("\n")[0].slice(0, 120),
    );
  }
}

async function executeWarmAction(page, scenario, options = {}) {
  if (scenario.scenarioId === "client_roster") return clickDestination(page, "clients", options);
  if (scenario.scenarioId === "messages") return clickDestination(page, "messages", options);
  if (scenario.scenarioId === "alerts") return clickDestination(page, "alerts", options);
  if (scenario.scenarioId === "notifications") return clickDestination(page, "notifications", options);
  if (scenario.scenarioId === "ai_chat") return clickDestination(page, "ai_chat", options);
  if (TASK_TAB_IDS[scenario.scenarioId]) return clickClientTask(page, scenario.scenarioId, options);
  throw new Error("warm_action_not_defined:" + scenario.scenarioId);
}

async function pageAuthState(page) {
  const cookies = await page.context().cookies().catch(() => []);
  const demoCookieInjected = cookies.some((cookie) => cookie.name === demoCookieName);
  const shellVisible = await page.locator('[data-testid="authenticated-shell"]').isVisible().catch(() => false);
  const loginVisible = await page.locator("#customer-login-email").isVisible().catch(() => false);
  return {
    authenticated: shellVisible && !loginVisible && !demoCookieInjected,
    demoCookieInjected,
  };
}

function hasSuccessfulRead(requests, expected) {
  return requests.some(
    (request) =>
      request.method === "GET" &&
      routeMatches(request.route, expected) &&
      request.status >= 200 &&
      request.status < 300 &&
      Number.isFinite(request.headerReceivedMs) &&
      Number.isFinite(request.bodyFinishedMs),
  );
}

async function waitForReady(page, selector, timeoutMs, trace = null, traceLabel = null) {
  tracePhase4Action(trace, "ready_wait_started", {
    label: traceLabel || selector,
    timeoutMs,
  });
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: timeoutMs });
    tracePhase4Action(trace, "ready_wait_completed", {
      label: traceLabel || selector,
    });
  } catch (error) {
    const message = String(error).split("\n")[0].slice(0, 120);
    tracePhase4Action(trace, "ready_wait_failed", {
      label: traceLabel || selector,
      error: message,
      ...(await navigationSurfaceSnapshot(page)),
    });
    throw new Error(`ready_selector_timeout:${selector}:${message}`);
  }
}

async function waitForLoginClientReady(page) {
  await page.locator("#customer-login-email").waitFor({ state: "visible", timeout: 30_000 });
  // Hosted Chromium can expose server-rendered inputs before React has attached input handlers.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function armTrustedInteractionMeasurement(page) {
  await page
    .evaluate(() => {
      window.__aiyaPhase4Perf ??= {
        lcp: null,
        cls: 0,
        longTasks: [],
        interaction: null,
      };
      window.__aiyaPhase4InstallInteractionObserver?.();
      window.__aiyaPhase4Perf.interaction = {
        eventAt: null,
        nextPaintAt: null,
        trusted: false,
      };
      sessionStorage.removeItem("aiya-phase4-trusted-interaction-event-wall-ms");
      sessionStorage.removeItem("aiya-phase4-trusted-interaction-next-paint-ms");
    })
    .catch(() => undefined);
}

async function readTrustedEventToNextPaint(page) {
  return page
    .evaluate(
      () =>
        new Promise((resolvePromise) => {
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            resolvePromise(value);
          };
          setTimeout(() => finish(null), 2_000);
          const interaction = window.__aiyaPhase4Perf?.interaction;
          const persistedPaint = Number(
            sessionStorage.getItem("aiya-phase4-trusted-interaction-next-paint-ms"),
          );
          const persistedEventWall = Number(
            sessionStorage.getItem("aiya-phase4-trusted-interaction-event-wall-ms"),
          );
          sessionStorage.removeItem("aiya-phase4-trusted-interaction-next-paint-ms");
          sessionStorage.removeItem("aiya-phase4-trusted-interaction-event-wall-ms");
          if (Number.isFinite(persistedPaint)) {
            finish({ durationMs: persistedPaint, trusted: true });
            return;
          }
          if (Number.isFinite(interaction?.eventAt)) {
            requestAnimationFrame(() => {
              const nextPaintAt = performance.now();
              finish({
                durationMs: Math.max(0, Math.round(nextPaintAt - interaction.eventAt)),
                trusted: interaction.trusted === true,
              });
            });
            return;
          }
          if (Number.isFinite(persistedEventWall)) {
            requestAnimationFrame(() =>
              finish({
                durationMs: Math.max(0, Date.now() - persistedEventWall),
                trusted: true,
              }),
            );
            return;
          }
          finish(null);
        }),
    )
    .catch(() => null);
}

async function buildSample(input) {
  const {
    page,
    scenario,
    tracker,
    actionStartAt,
    readyAt,
    authenticated,
    demoCookieInjected,
    error,
    eventToNextPaintOverride = null,
    trustedInteraction = false,
  } = input;
  const eventToNextPaintMs = eventToNextPaintOverride;
  const requiredReadsPromise = tracker.waitForRequiredReads();
  const observationPromise = sleep(
    PHASE_2_HARNESS_CONTRACT.postReadyObservationWindowMs,
  );
  await Promise.all([requiredReadsPromise, observationPromise]);
  const capturedRequests = await tracker.finish();
  const clientAbortedRequests = capturedRequests.filter(
    (request) => request.failure === "net::ERR_ABORTED",
  );
  const requests = capturedRequests.filter(
    (request) => !clientAbortedRequests.includes(request),
  );
  const metrics = await readPageMetrics(page);
  const missingReads = (scenario.requiredReads ?? []).filter(
    (expected) => !hasSuccessfulRead(requests, expected),
  );
  const failedRequests = requests.filter(
    (request) => request.status == null || request.status < 200 || request.status >= 400,
  );
  const readySelectorMatched =
    !error &&
    (await page.locator(scenario.requiredReadySelector).first().isVisible().catch(() => false));
  const shellBlocked = await page
    .locator('[data-testid="shell-blocker"]')
    .isVisible()
    .catch(() => false);
  const targetUsable = readySelectorMatched && !shellBlocked;
  return {
    sampleId:
      currentPhase4RunId() +
      "-" +
      scenario.scenarioId +
      "-" +
      Date.now(),
    authenticated,
    fallbackStore: false,
    demoCookieInjected,
    measurementMode: scenario.transitionMode,
    readySelectorMatched,
    targetUsable,
    taskReadyMs: calculateTaskReadyMs(actionStartAt, readyAt),
    eventToNextPaintMs,
    trustedInteraction,
    lcpMs: metrics.lcpMs,
    cls: metrics.cls,
    maxLongTaskMs: metrics.maxLongTaskMs,
    observationWindowMs: PHASE_2_HARNESS_CONTRACT.postReadyObservationWindowMs,
    backgroundObservationWindowMs: PHASE_2_HARNESS_CONTRACT.backgroundObservationWindowMs,
    requests,
    clientAbortedRequestSignatures: clientAbortedRequests.map(
      (request) => `${request.method} ${request.route} ${request.failure}`,
    ),
    error: error ? String(error).split("\n")[0] : null,
    serviceWorkerControlled: metrics.serviceWorkerControlled,
    displayModeStandalone: metrics.displayModeStandalone,
    deviceTiming: {
      fcpMs: metrics.fcpMs,
      domContentLoadedMs: metrics.domContentLoadedMs,
      loadEventEndMs: metrics.loadEventEndMs,
    },
    failedRequestCount: failedRequests.length,
    missingReads,
  };
}

async function measureLoginScenario(page, baseUrl, fixture, { androidCdp = false } = {}) {
  const scenario = PHASE_4_SCENARIOS.find(
    (item) => item.scenarioId === "post_login_dashboard",
  );
  let tracker = null;
  let actionStartAt = null;
  let readyAt = null;
  let error = null;
  let loginResponseStatus = null;
  try {
    await page.goto(baseUrl + "/login?next=/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await waitForLoginClientReady(page);
    await page.locator("#customer-login-email").fill(fixture.email);
    await page
      .locator("#customer-login-password")
      .fill(fixture.password || SYNTHETIC_PASSWORD);
    if (androidCdp) await page.bringToFront();
    tracker = createRequestTracker(page, scenario.requiredReads);
    actionStartAt = Date.now();
    await armTrustedInteractionMeasurement(page);
    await page.evaluate(() => {
      performance.mark("aiya-phase4-action-start");
      sessionStorage.setItem("aiya-phase4-action-start-wall-ms", String(Date.now()));
    });
    // Keep the response wait handled even when the click itself fails first.
    const loginResponsePromise = page
      .waitForResponse(
        (response) => sanitizeRoute(response.url()) === "/api/auth/password-login",
        { timeout: 30_000 },
      )
      .catch(() => null);
    const submit = page.locator('[data-testid="customer-login-submit"]');
    if (androidCdp) {
      await clickRealActionableTarget(page, submit, {
        timeout: PHASE_4_ACTION_CLICK_TIMEOUT_MS,
      });
    } else {
      await submit.click({ timeout: 8_000 });
    }
    const loginResponse = await loginResponsePromise;
    loginResponseStatus = loginResponse?.status() ?? null;
    if (!loginResponse) throw new Error("password_login_response_not_observed");
    await waitForReady(page, '[data-testid="authenticated-shell"]', 30_000);
    readyAt = Date.now();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const interaction = error ? null : await readTrustedEventToNextPaint(page);
  tracker ??= createRequestTracker(page, scenario.requiredReads);
  const auth = await pageAuthState(page);
  const sample = await buildSample({
    page,
    scenario,
    tracker,
    actionStartAt,
    readyAt,
    authenticated: auth.authenticated && loginResponseStatus === 200,
    demoCookieInjected: auth.demoCookieInjected,
    error:
      error ||
      (loginResponseStatus !== 200
        ? "password_login_status:" + loginResponseStatus
        : null),
    eventToNextPaintOverride: interaction?.durationMs ?? null,
    trustedInteraction: interaction?.trusted === true,
  });
  sample.loginResponseStatus = loginResponseStatus;
  sample.measurementMode = "cold";
  return sample;
}

export async function measureWarmScenario(
  page,
  baseUrl,
  scenario,
  { androidCdp = false, trace = null } = {},
) {
  void baseUrl;
  let tracker = null;
  let error = null;
  let actionStartAt = null;
  let readyAt = null;
  try {
    await waitForReady(
      page,
      '[data-testid="authenticated-shell"]',
      30_000,
      trace,
      "authenticated_shell_before_warm_action",
    );
    await resetPerformanceObservers(page);
    tracker = createRequestTracker(page, scenario.requiredReads);
    actionStartAt = Date.now();
    await armTrustedInteractionMeasurement(page);
    await page.evaluate(() => performance.mark("aiya-phase4-action-start"));
    tracePhase4Action(trace, "warm_action_started", { scenarioId: scenario.scenarioId });
    await executeWarmAction(page, scenario, { androidCdp, trace });
    await waitForReady(
      page,
      scenario.requiredReadySelector,
      30_000,
      trace,
      `${scenario.scenarioId}_ready_selector`,
    );
    readyAt = Date.now();
    tracePhase4Action(trace, "warm_action_ready", { scenarioId: scenario.scenarioId });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    tracePhase4Action(trace, "warm_action_failed", {
      scenarioId: scenario.scenarioId,
      error: String(error).split("\n")[0].slice(0, 240),
    });
  }
  tracker ??= createRequestTracker(page, scenario.requiredReads);
  const auth = await pageAuthState(page);
  const interaction = error ? null : await readTrustedEventToNextPaint(page);
  return buildSample({
    page,
    scenario,
    tracker,
    actionStartAt,
    readyAt,
    authenticated: auth.authenticated,
    demoCookieInjected: auth.demoCookieInjected,
    error,
    eventToNextPaintOverride: interaction?.durationMs ?? null,
    trustedInteraction: interaction?.trusted === true,
  });
}

export function classifyPhase4Sample(sample, scenario) {
  const requiredReads = scenario.requiredReads ?? [];
  const requests = sample.requests ?? [];
  const mutationRequests = requests.filter((request) =>
    ["POST", "PUT", "PATCH", "DELETE"].includes(String(request.method).toUpperCase()),
  );
  const failedRequests = requests.filter((request) => {
    if (request.timeout === true) return true;
    if (request.failure) return true;
    if (request.status == null) return true;
    return request.status < 200 || request.status >= 400;
  });
  const missingReads = requiredReads.filter(
    (expected) =>
      !requests.some(
        (request) =>
          request.method === "GET" &&
          routeMatches(request.route, expected) &&
          request.status >= 200 &&
          request.status < 300 &&
          Number.isFinite(request.headerReceivedMs) &&
          Number.isFinite(request.bodyFinishedMs),
      ),
  );
  const parseMutationContract = (expected) => {
    const match = String(expected).match(/^(.*?)(?::(POST|PUT|PATCH|DELETE))?$/i);
    return {
      route: match?.[1] || String(expected),
      method: match?.[2]?.toUpperCase() ?? null,
    };
  };
  const mutationMatches = (request, expected) => {
    const contract = parseMutationContract(expected);
    return (
      mutationRequests.includes(request) &&
      routeMatches(request.route, contract.route) &&
      (!contract.method || String(request.method).toUpperCase() === contract.method)
    );
  };
  const forbiddenMutations = (scenario.forbiddenMutations ?? []).filter((expected) =>
    mutationRequests.some((request) => mutationMatches(request, expected)),
  );
  const unlistedMutations = mutationRequests
    .filter(
      (request) =>
        !(scenario.allowedMutations ?? []).some((expected) =>
          mutationMatches(request, expected),
        ),
    )
    .map(
      (request) =>
        `${request.method} ${request.route} ${request.status ?? "NO_STATUS"}`,
    );
  const sampleError = typeof sample.error === "string" && sample.error.trim();
  const functionalStatus =
    !sampleError &&
    sample.readySelectorMatched === true &&
    sample.targetUsable === true &&
    missingReads.length === 0
      ? "PASS"
      : "FAIL";
  const validityProblems = [];
  if (!sample.authenticated) validityProblems.push("not_authenticated");
  if (sample.fallbackStore === true) validityProblems.push("fallback_store_used");
  if (sample.demoCookieInjected === true) validityProblems.push("demo_cookie_used");
  if (sampleError) validityProblems.push("sample_error");
  if (sample.measurementMode !== scenario.transitionMode) {
    validityProblems.push("measurement_mode_mismatch");
  }
  if (sample.readySelectorMatched !== true) {
    validityProblems.push("required_ready_selector_missing");
  }
  if (sample.targetUsable !== true) validityProblems.push("target_not_usable");
  if (missingReads.length) {
    validityProblems.push("required_read_missing_or_non_2xx");
  }
  if (failedRequests.length) validityProblems.push("failed_request_observed");
  if (forbiddenMutations.length) {
    validityProblems.push("forbidden_mutation_observed");
  }
  if (unlistedMutations.length) {
    validityProblems.push("unlisted_mutation_observed");
  }
  if (!Number.isFinite(sample.taskReadyMs)) {
    validityProblems.push("task_ready_missing");
  }
  if (!Number.isFinite(sample.eventToNextPaintMs)) {
    validityProblems.push("event_to_next_paint_missing");
  }
  if (sample.trustedInteraction !== true) {
    validityProblems.push("trusted_interaction_missing");
  }
  if (scenario.requiresPaintMetrics === true && !Number.isFinite(sample.lcpMs)) {
    validityProblems.push("lcp_missing");
  }
  if (scenario.requiresPaintMetrics === true && !Number.isFinite(sample.cls)) {
    validityProblems.push("cls_missing");
  }
  const budgetProblems = [];
  const budgetMs = PHASE_2_BUDGETS[scenario.budget] ?? null;
  if (budgetMs != null && Number.isFinite(sample.taskReadyMs) && sample.taskReadyMs > budgetMs) {
    budgetProblems.push(`${scenario.budget}:${sample.taskReadyMs}>${budgetMs}`);
  }
  if (
    Number.isFinite(sample.eventToNextPaintMs) &&
    sample.eventToNextPaintMs > PHASE_2_BUDGETS.eventToNextPaintP95Ms
  ) {
    budgetProblems.push(
      `eventToNextPaint:${sample.eventToNextPaintMs}>${PHASE_2_BUDGETS.eventToNextPaintP95Ms}`,
    );
  }
  if (
    Number.isFinite(sample.maxLongTaskMs) &&
    sample.maxLongTaskMs > PHASE_2_BUDGETS.maxForegroundLongTaskMs
  ) {
    budgetProblems.push(
      `maxLongTask:${sample.maxLongTaskMs}>${PHASE_2_BUDGETS.maxForegroundLongTaskMs}`,
    );
  }
  if (
    scenario.requiresPaintMetrics === true &&
    Number.isFinite(sample.lcpMs) &&
    sample.lcpMs > PHASE_2_BUDGETS.initialDashboardLcpP75Ms
  ) {
    budgetProblems.push(
      `lcp:${sample.lcpMs}>${PHASE_2_BUDGETS.initialDashboardLcpP75Ms}`,
    );
  }
  if (
    scenario.requiresPaintMetrics === true &&
    Number.isFinite(sample.cls) &&
    sample.cls > PHASE_2_BUDGETS.clsMax
  ) {
    budgetProblems.push(`cls:${sample.cls}>${PHASE_2_BUDGETS.clsMax}`);
  }
  return {
    sampleId: sample.sampleId,
    functionalStatus,
    validityStatus: validityProblems.length ? "FAIL" : "PASS",
    budgetStatus: budgetProblems.length ? "FAIL" : "PASS",
    missingReads,
    failedRequestCount: failedRequests.length,
    forbiddenMutations,
    unlistedMutations,
    validityProblems,
    budgetProblems,
  };
}

function sampleInvalidReason(sample, scenario) {
  if (sample.error) return String(sample.error).slice(0, 160);
  const classification = classifyPhase4Sample(sample, scenario);
  if (classification.functionalStatus !== "PASS") {
    if (classification.missingReads.length) {
      return scenario.scenarioId + "_required_read_failed";
    }
    if (sample.readySelectorMatched !== true) {
      return scenario.scenarioId + "_ready_selector_missing";
    }
    if (sample.targetUsable !== true) {
      return scenario.scenarioId + "_target_invalid";
    }
    return scenario.scenarioId + "_functional_invalid";
  }
  if (classification.validityStatus !== "PASS") {
    return classification.validityProblems[0] || scenario.scenarioId + "_validity_invalid";
  }
  if (sample.failedRequestCount > 0) {
    return scenario.scenarioId + "_request_failed";
  }
  return null;
}

export function summarizePhase4Scenario(samples, scenario) {
  const classifications = samples.map((sample) => classifyPhase4Sample(sample, scenario));
  const requiredReadRequests = samples.flatMap((sample) =>
    (sample.requests ?? []).filter(
      (request) =>
        request.method === "GET" &&
        (scenario.requiredReads ?? []).some((expected) =>
          routeMatches(request.route, expected),
        ),
    ),
  );
  const p75 = {
    taskReadyMs: percentile(samples.map((sample) => sample.taskReadyMs), 75),
    eventToNextPaintMs: percentile(
      samples.map((sample) => sample.eventToNextPaintMs),
      75,
    ),
    lcpMs: percentile(samples.map((sample) => sample.lcpMs), 75),
    cls: percentile(samples.map((sample) => sample.cls), 75),
    requiredReadBodyFinishedMs: percentile(
      requiredReadRequests.map((request) => request.bodyFinishedMs),
      75,
    ),
    requiredReadHeaderReceivedMs: percentile(
      requiredReadRequests.map((request) => request.headerReceivedMs),
      75,
    ),
  };
  const p95 = {
    taskReadyMs: percentile(samples.map((sample) => sample.taskReadyMs), 95),
    eventToNextPaintMs: percentile(
      samples.map((sample) => sample.eventToNextPaintMs),
      95,
    ),
  };
  const budgetProblems = [];
  const taskReadyP75Budget = PHASE_2_BUDGETS[scenario.budget] ?? null;
  if (
    taskReadyP75Budget != null &&
    Number.isFinite(p75.taskReadyMs) &&
    p75.taskReadyMs > taskReadyP75Budget
  ) {
    budgetProblems.push(
      `${scenario.budget}:p75:${p75.taskReadyMs}>${taskReadyP75Budget}`,
    );
  }
  if (
    scenario.transitionMode === "warm" &&
    Number.isFinite(p95.taskReadyMs) &&
    p95.taskReadyMs > PHASE_2_BUDGETS.warmNavigationReadyP95Ms
  ) {
    budgetProblems.push(
      `warmNavigationReadyP95Ms:p95:${p95.taskReadyMs}>${PHASE_2_BUDGETS.warmNavigationReadyP95Ms}`,
    );
  }
  if (
    Number.isFinite(p75.eventToNextPaintMs) &&
    p75.eventToNextPaintMs > PHASE_2_BUDGETS.eventToNextPaintP75Ms
  ) {
    budgetProblems.push(
      `eventToNextPaintP75Ms:p75:${p75.eventToNextPaintMs}>${PHASE_2_BUDGETS.eventToNextPaintP75Ms}`,
    );
  }
  if (
    Number.isFinite(p95.eventToNextPaintMs) &&
    p95.eventToNextPaintMs > PHASE_2_BUDGETS.eventToNextPaintP95Ms
  ) {
    budgetProblems.push(
      `eventToNextPaintP95Ms:p95:${p95.eventToNextPaintMs}>${PHASE_2_BUDGETS.eventToNextPaintP95Ms}`,
    );
  }
  if (
    Number.isFinite(p75.requiredReadBodyFinishedMs) &&
    p75.requiredReadBodyFinishedMs > PHASE_2_BUDGETS.requiredReadBodyFinishedP75Ms
  ) {
    budgetProblems.push(
      `requiredReadBodyFinishedP75Ms:p75:${p75.requiredReadBodyFinishedMs}>${PHASE_2_BUDGETS.requiredReadBodyFinishedP75Ms}`,
    );
  }
  if (
    scenario.requiresPaintMetrics === true &&
    Number.isFinite(p75.lcpMs) &&
    p75.lcpMs > PHASE_2_BUDGETS.initialDashboardLcpP75Ms
  ) {
    budgetProblems.push(
      `initialDashboardLcpP75Ms:p75:${p75.lcpMs}>${PHASE_2_BUDGETS.initialDashboardLcpP75Ms}`,
    );
  }
  if (
    scenario.requiresPaintMetrics === true &&
    Number.isFinite(p75.cls) &&
    p75.cls > PHASE_2_BUDGETS.clsMax
  ) {
    budgetProblems.push(`clsMax:p75:${p75.cls}>${PHASE_2_BUDGETS.clsMax}`);
  }
  return {
    scenarioId: scenario.scenarioId,
    sampleCount: samples.length,
    functionalStatus: classifications.length > 0 && classifications.every((item) => item.functionalStatus === "PASS")
      ? "PASS"
      : "FAIL",
    validityStatus: classifications.length > 0 && classifications.every((item) => item.validityStatus === "PASS")
      ? "PASS"
      : "FAIL",
    budgetStatus:
      classifications.length > 0 &&
      classifications.every((item) => item.budgetStatus === "PASS") &&
      budgetProblems.length === 0
      ? "PASS"
      : "FAIL",
    p75,
    p95,
    budgetProblems,
    classifications,
  };
}

export function summarizeCapturedScenario(samples, scenario) {
  const summary = summarizePhase4Scenario(samples, scenario);
  const clientAbortedRequestSignatures = [
    ...new Set(
      samples.flatMap((sample) => sample.clientAbortedRequestSignatures ?? []),
    ),
  ];
  const failedRequestSignatures = [
    ...new Set(
      samples
        .flatMap((sample) => sample.requests ?? [])
        .filter(
          (request) =>
            request.timeout === true ||
            request.failure ||
            request.status == null ||
            request.status < 200 ||
            request.status >= 400,
        )
        .map(
          (request) =>
            `${request.method} ${request.route} ${request.status ?? "NO_STATUS"}${
              request.failure ? " " + request.failure : ""
            }`,
        ),
    ),
  ];
  const sampleErrorSignatures = [
    ...new Set(
      samples
        .map((sample) => sample.error)
        .filter(Boolean)
        .map((error) => String(error).slice(0, 160)),
    ),
  ];
  const sampleClassifications = samples.map((sample) => ({
    sample,
    classification: classifyPhase4Sample(sample, scenario),
  }));
  const validSamples = sampleClassifications.filter(
    ({ sample, classification }) =>
      sample.authenticated === true &&
      sample.error == null &&
      classification.validityStatus === "PASS",
  );
  const freezeSamples = validSamples.filter(
    ({ sample }) =>
      sample.maxLongTaskMs >= PHASE_2_BUDGETS.maxForegroundLongTaskMs ||
      sample.eventToNextPaintMs >= PHASE_2_BUDGETS.eventToNextPaintP95Ms ||
      sample.taskReadyMs >= 5_000,
  );
  return {
    ...summary,
    validSampleCount: validSamples.length,
    failedRequestSignatures,
    sampleErrorSignatures,
    clientAbortedRequestSignatures,
    freezeCandidateSampleCount: freezeSamples.length,
    freezeStatus: freezeSamples.length
      ? "REPRODUCED_CANDIDATE"
      : "NOT_REPRODUCED",
    p75: {
      ...summary.p75,
      taskReadyMs: percentile(
        samples.map((sample) => sample.taskReadyMs),
        75,
      ),
      eventToNextPaintMs: percentile(
        samples.map((sample) => sample.eventToNextPaintMs),
        75,
      ),
    },
  };
}

async function clearBrowserMeasurementState(context, page, baseUrl) {
  const targetDomain = new URL(baseUrl).hostname;
  await context.clearCookies({ domain: targetDomain });
  await page
    .evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    })
    .catch(() => undefined);
}

function discardedScenarioResults(attemptSamples, invalidScenarioId) {
  return PHASE_4_SCENARIOS.map((scenario) => {
    const sample = attemptSamples.get(scenario.scenarioId);
    if (!sample) {
      return {
        scenarioId: scenario.scenarioId,
        status: "NOT_RUN",
        reason: `attempt_stopped_after:${invalidScenarioId}`,
      };
    }
    const classification = classifyPhase4Sample(sample, scenario);
    return {
      scenarioId: scenario.scenarioId,
      sampleId: sample.sampleId,
      status: "DISCARDED",
      error: sample.error,
      functionalStatus: classification.functionalStatus,
      validityStatus: classification.validityStatus,
      budgetStatus: classification.budgetStatus,
      validityProblems: classification.validityProblems,
      budgetProblems: classification.budgetProblems,
      failedRequestCount: classification.failedRequestCount,
      unlistedMutations: classification.unlistedMutations,
    };
  });
}

export async function collectMeasurementRound(
  page,
  context,
  baseUrl,
  fixture,
  { androidCdp = false, trace = null } = {},
) {
  let scenarioId = "preparation";
  try {
    await clearBrowserMeasurementState(context, page, baseUrl);
    const attemptSamples = new Map();
    scenarioId = "post_login_dashboard";
    const loginSample = await measureLoginScenario(page, baseUrl, fixture, { androidCdp });
    const loginScenario = PHASE_4_SCENARIOS.find(
      (item) => item.scenarioId === "post_login_dashboard",
    );
    attemptSamples.set("post_login_dashboard", loginSample);
    let invalidReason = sampleInvalidReason(loginSample, loginScenario);
    let invalidScenarioId = invalidReason ? "post_login_dashboard" : null;
    if (!invalidReason && loginSample.loginResponseStatus !== 200) {
      invalidReason = "password_login_failed";
      invalidScenarioId = "post_login_dashboard";
    }
    if (!invalidReason) {
      for (const scenario of PHASE_4_SCENARIOS.filter(
        (item) => item.transitionMode === "warm",
      )) {
        scenarioId = scenario.scenarioId;
        const sample = await measureWarmScenario(page, baseUrl, scenario, {
          androidCdp,
          trace,
        });
        attemptSamples.set(scenario.scenarioId, sample);
        invalidReason = sampleInvalidReason(sample, scenario);
        if (invalidReason) {
          invalidScenarioId = scenario.scenarioId;
          break;
        }
      }
    }
    return {
      attemptSamples,
      invalidReason,
      invalidScenarioId,
      scenarioResults: invalidReason
        ? discardedScenarioResults(attemptSamples, invalidScenarioId)
        : null,
    };
  } catch (error) {
    throw annotateHarnessError(error, {
      phase: "collect_measurement_round",
      scenarioId,
    });
  }
}

async function runBrowserFixture(browser, baseUrl, fixture, runs, profile, environment) {
  const groupKey = checkpointGroupKey(environment || "browser", profile.id, fixture.id);
  const samplesByScenario = checkpointSamplesForGroup(groupKey);
  const discardedAttempts = checkpointDiscardedAttempts(groupKey);
  const failedAttempts = [
    ...checkpointFailedAttempts(groupKey),
    ...recoverUnfinishedCheckpointAttempts({
      groupKey,
      fixture,
      profile,
      environment,
    }),
  ];
  const fixtureFailures = checkpointEvents("phase4.fixture.failed", groupKey).map(
    (event) => event.payload,
  );
  const preparationFailures = checkpointEvents(
    "phase4.preparation.failed",
    groupKey,
  ).map((event) => event.payload);
  let attemptCount = checkpointAttemptCount(groupKey);
  const maxAttempts = PHASE_4_MAX_ATTEMPTS;
  let stoppedEarly = false;
  let stopReason = null;
  let preparationStatus = "NOT_RUN";
  let context = null;
  let page = null;

  const closeMeasurementContext = async () => {
    const activeContext = context;
    context = null;
    page = null;
    await activeContext?.close().catch(() => undefined);
  };

  const recordAttemptFailure = (error, attempt, phase) => {
    const failure = phase4AttemptFailure({
      error,
      groupKey,
      fixture,
      profile,
      environment,
      attempt,
      phase,
    });
    failedAttempts.push(failure);
    checkpointRecord("phase4.attempt.failed", failure);
    return failure;
  };

  const recordFixtureFailure = (error, phase) => {
    const errorContext = error?.phase4Context ?? {};
    const failure = {
      groupKey,
      fixtureId: fixture.id,
      fixtureClass: fixture.fixtureClass,
      profileId: profile.id,
      environment: environment ?? null,
      reason: `${phase}_${classifyHarnessError(error)}`,
      error: describeHarnessError(error, {
        phase: errorContext.phase ?? phase,
        scenarioId: errorContext.scenarioId ?? null,
      }),
    };
    fixtureFailures.push(failure);
    checkpointRecord("phase4.fixture.failed", failure);
    return failure;
  };

  try {
    context = await browser.newContext({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      deviceScaleFactor: profile.deviceScaleFactor,
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      serviceWorkers: "allow",
    });
    page = await context.newPage();
    await installPerformanceObservers(page);

    let preparation = null;
    try {
      preparation = await collectMeasurementRound(page, context, baseUrl, fixture);
    } catch (error) {
      const failure = {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: profile.id,
        environment: environment ?? null,
        reason: `preparation_${classifyHarnessError(error)}`,
        error: describeHarnessError(error, {
          phase: error?.phase4Context?.phase ?? "preparation",
          scenarioId: error?.phase4Context?.scenarioId ?? null,
        }),
      };
      preparationFailures.push(failure);
      checkpointRecord("phase4.preparation.failed", failure);
      preparationStatus = "BLOCKED";
      stoppedEarly = true;
      stopReason = failure.reason;
    }

    if (preparation) {
      preparationStatus = preparation.invalidReason ? "BLOCKED" : "PASS";
      checkpointRecord("phase4.preparation", {
        groupKey,
        status: preparationStatus,
        reason: preparation.invalidReason,
        scenarioId: preparation.invalidScenarioId,
        countedAsOfficialSample: false,
        scenarioIds: PHASE_4_SCENARIOS.map((scenario) => scenario.scenarioId),
      });
      if (preparation.invalidReason) {
        stoppedEarly = true;
        stopReason = `preparation_failed:${preparation.invalidReason}`;
      } else if (checkpointShouldPause()) {
        activePhase4Checkpoint.applyPause("pause_requested_after_preparation");
        stoppedEarly = true;
        stopReason = "pause_requested";
      }
    }

    while (
      preparationStatus === "PASS" &&
      !stoppedEarly &&
      (samplesByScenario.get("post_login_dashboard")?.length ?? 0) < runs &&
      attemptCount < maxAttempts
    ) {
      attemptCount += 1;
      checkpointRecord("phase4.attempt.started", {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: profile.id,
        environment: environment ?? null,
        attempt: attemptCount,
        countedAsOfficialSample: true,
      });
      let round = null;
      try {
        round = await collectMeasurementRound(page, context, baseUrl, fixture);
      } catch (error) {
        const failure = recordAttemptFailure(error, attemptCount, "measurement_round");
        console.log(
          `[phase4] ${fixture.id} attempt ${attemptCount}/${maxAttempts} failed: ${failure.error.classification}`,
        );
        stoppedEarly = true;
        stopReason = failure.reason;
        break;
      }
      if (round.invalidReason) {
        const discarded = {
          groupKey,
          attempt: attemptCount,
          reason: round.invalidReason,
          scenarioId: round.invalidScenarioId,
          scenarioResults: round.scenarioResults,
        };
        discardedAttempts.push(discarded);
        checkpointRecord("phase4.attempt.discarded", discarded);
        console.log(
          `[phase4] ${fixture.id} attempt ${attemptCount}/${maxAttempts} discarded: ${round.invalidReason}`,
        );
        if (checkpointShouldPause()) {
          activePhase4Checkpoint.applyPause("pause_requested_after_discarded_attempt");
          stoppedEarly = true;
          stopReason = "pause_requested";
          break;
        }
        continue;
      }

      const samplesObject = Object.fromEntries(
        [...round.attemptSamples.entries()].map(([scenarioId, sample]) => [
          scenarioId,
          [sample],
        ]),
      );
      const nextRoundNumber =
        (samplesByScenario.get("post_login_dashboard")?.length ?? 0) + 1;
      checkpointRecord("phase4.round.committed", {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: profile.id,
        attempt: attemptCount,
        roundNumber: nextRoundNumber,
        samplesByScenario: samplesObject,
        countedAsOfficialSample: true,
      });
      for (const [scenarioId, sample] of round.attemptSamples.entries()) {
        samplesByScenario.get(scenarioId).push(sample);
      }
      console.log(
        `[phase4] ${fixture.id} sample ${
          samplesByScenario.get("post_login_dashboard").length
        }/${runs} complete`,
      );
      if (checkpointShouldPause()) {
        activePhase4Checkpoint.applyPause("pause_requested_after_completed_round");
        stoppedEarly = true;
        stopReason = "pause_requested";
        break;
      }
    }
  } catch (error) {
    const failure = recordFixtureFailure(error, "fixture");
    stoppedEarly = true;
    stopReason = failure.reason;
  } finally {
    await closeMeasurementContext();
  }
  const completedCount = samplesByScenario.get("post_login_dashboard")?.length ?? 0;
  if (!stoppedEarly && completedCount < runs) {
    stoppedEarly = true;
    stopReason =
      failedAttempts.at(-1)?.reason ||
      discardedAttempts.at(-1)?.reason ||
      `valid_sample_count_${completedCount}_below_${runs}`;
  }
  const scenarios = PHASE_4_SCENARIOS.map((scenario) =>
    summarizeCapturedScenario(
      samplesByScenario.get(scenario.scenarioId) ?? [],
      scenario,
    ),
  );
  return {
    fixtureId: fixture.id,
    fixtureClass: fixture.fixtureClass,
    profileId: profile.id,
    groupKey,
    runsPerScenario: runs,
    scenarios,
    preparationStatus,
    attemptCount,
    maxAttempts,
    discardedAttemptCount: discardedAttempts.length,
    discardedAttempts,
    failedAttemptCount: failedAttempts.length,
    failedAttempts,
    fixtureFailureCount: fixtureFailures.length,
    fixtureFailures,
    preparationFailureCount: preparationFailures.length,
    preparationFailures,
    stoppedEarly,
    stopReason,
    status:
      scenarios.every(
        (scenario) =>
          scenario.sampleCount === runs && scenario.validityStatus === "PASS",
      ) && preparationStatus === "PASS"
        ? "PASS"
        : stoppedEarly && stopReason === "pause_requested"
          ? "PAUSED"
          : "BLOCKED",
  };
}

async function waitForServer(server, baseUrl, output, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode != null) {
      throw new Error("next_server_exited:" + server.exitCode);
    }
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("next_server_timeout:" + output.join("\n").slice(-1000));
}

function localBuildEnvironment(localStatus, baseUrl) {
  return {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: baseUrl,
    MANU_ADMIN_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
    MANU_DEV_FALLBACK_STORE: "false",
    MANU_ALLOW_PUBLIC_DEMO_LOGIN: "false",
    AI_CHAT_UI_ENABLED: "true",
  };
}

function buildLocalApp(localStatus, baseUrl) {
  const env = localBuildEnvironment(localStatus, baseUrl);
  const result = run(
    process.execPath,
    [nextCliPath, "build", "--webpack"],
    { cwd: appRoot, env, shell: false, timeout: 240_000 },
  );
  return {
    env,
    result: { status: result.status, timedOut: result.timedOut },
  };
}

function reuseReadinessBuild(
  readinessEvidence,
  localStatus,
  baseUrl,
  readinessRunId = null,
) {
  const local = readinessStage(readinessEvidence, "H3")?.verificationResults?.local;
  const build = local?.build;
  if (
    local?.target?.status !== "PASS" ||
    local?.docker?.status !== "PASS" ||
    build?.status !== "PASS"
  ) {
    return null;
  }
  return {
    env: localBuildEnvironment(localStatus, baseUrl),
    result: { status: 0, timedOut: false },
    reusedFromReadiness: true,
    readinessRunId,
  };
}

function startLocalServer(localEnv, port) {
  const output = [];
  const server = spawn(
    process.execPath,
    [nextCliPath, "start", "--port", String(port), "--hostname", "0.0.0.0"],
    {
      cwd: appRoot,
      env: { ...localEnv, PORT: String(port), HOSTNAME: "0.0.0.0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => output.push(String(chunk)));
  server.stderr.on("data", (chunk) => output.push(String(chunk)));
  return { server, output };
}

function stopLocalServer(server) {
  if (!server || server.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    server.kill("SIGTERM");
  }
}

function collectServerDiagnostics(output) {
  const lines = output.join("\n").split("\n");
  const unhandledErrors = lines.flatMap((line, index) => {
    if (!line.includes("stage5_shell_api_unhandled_error")) return [];
    return lines
      .slice(index, index + 5)
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 240);
  });
  return {
    stage5ShellUnhandledErrorCount: unhandledErrors.length,
    stage5ShellUnhandledErrors: unhandledErrors.map((line) => line.slice(0, 240)),
  };
}

async function runSessionActivityDiagnostic() {
  const localStatus = parseLocalSupabaseStatus();
  const baseUrl = "http://127.0.0.1:" + PHASE_4_LOCAL_PORT;
  const result = {
    diagnostic: "session_activity",
    status: "BLOCKED",
    localTarget: {
      status: localStatus.status,
      apiUrl: localStatus.apiUrl,
      urlIsLocal: localStatus.urlIsLocal === true,
    },
    build: { status: "NOT_RUN" },
    release: null,
    login: { status: null, shellVisible: false, loginVisible: null },
    activityResponses: [],
    requestEvents: [],
    serverDiagnostics: [],
    conclusion: null,
  };
  if (localStatus.status !== "PASS") {
    result.conclusion = "local_supabase_not_ready";
    return sanitizePhase4Evidence(result);
  }

  const build = buildLocalApp(localStatus, baseUrl);
  result.build = build.result;
  if (build.result.status !== 0) {
    result.conclusion = "local_build_failed";
    return sanitizePhase4Evidence(result);
  }

  const started = startLocalServer(build.env, PHASE_4_LOCAL_PORT);
  try {
    await waitForServer(started.server, baseUrl, started.output);
    result.release = await collectReleaseIdentity(baseUrl);

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      page.on("response", (response) => {
        const route = sanitizeRoute(response.url());
        if (
          route === "/api/auth/password-login" ||
          route === "/api/session/activity" ||
          route === "/api/shell/bootstrap" ||
          route === "/api/app-state"
        ) {
          result.requestEvents.push({
            method: response.request().method(),
            route,
            status: response.status(),
          });
        }
      });
      page.on("requestfailed", (request) => {
        const route = sanitizeRoute(request.url());
        if (
          route === "/api/auth/password-login" ||
          route === "/api/session/activity" ||
          route === "/api/shell/bootstrap" ||
          route === "/api/app-state"
        ) {
          result.requestEvents.push({
            method: request.method(),
            route,
            failure: request.failure()?.errorText || "request_failed",
          });
        }
      });

      await page.goto(baseUrl + "/login?next=/dashboard", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await waitForLoginClientReady(page);
      await page.locator("#customer-login-email").fill(PHASE_4_FIXTURES.small.email);
      await page.locator("#customer-login-password").fill(SYNTHETIC_PASSWORD);
      const loginResponsePromise = page.waitForResponse(
        (response) => sanitizeRoute(response.url()) === "/api/auth/password-login",
        { timeout: 30_000 },
      );
      await page.locator('[data-testid="customer-login-submit"]').click({ timeout: 8_000 });
      const loginResponse = await loginResponsePromise.catch(() => null);
      result.login.status = loginResponse?.status() ?? null;
      await page
        .locator('[data-testid="authenticated-shell"]')
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => undefined);
      result.login.shellVisible = await page
        .locator('[data-testid="authenticated-shell"]')
        .isVisible()
        .catch(() => false);
      result.login.loginVisible = await page
        .locator("#customer-login-email")
        .isVisible()
        .catch(() => false);

      if (result.login.shellVisible) {
        for (let index = 0; index < 18; index += 1) {
          const response = await page.evaluate(async () => {
            const activity = await fetch("/api/session/activity", {
              method: "POST",
              cache: "no-store",
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
              body: "{}",
            });
            const body = await activity.json().catch(() => ({}));
            return {
              status: activity.status,
              error: typeof body.error === "string" ? body.error : null,
            };
          });
          result.activityResponses.push({ index: index + 1, ...response });
          await sleep(50);
        }
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    result.conclusion = classifyHarnessError(error);
  } finally {
    result.serverDiagnostics = collectServerDiagnostics(started.output);
    stopLocalServer(started.server);
  }

  const failingStatuses = result.activityResponses.filter(
    (item) => item.status !== 200,
  );
  result.status =
    result.login.status === 200 && result.login.shellVisible ? "COMPLETE" : "BLOCKED";
  result.conclusion =
    result.conclusion ||
    (failingStatuses.length
      ? "session_activity_non_200_reproduced"
      : "session_activity_repeated_calls_all_200");
  return sanitizePhase4Evidence(result);
}

async function runLocalDesktopBaseline(baseUrl, localStatus, runs) {
  let browser = null;
  const profiles = [];
  const profile = {
    id: "local_desktop_authenticated",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  };
  try {
    browser = await chromium.launch();
    for (const fixture of [PHASE_4_FIXTURES.small, PHASE_4_FIXTURES.normal]) {
      try {
        profiles.push(
          await runBrowserFixture(
            browser,
            baseUrl,
            fixture,
            runs,
            profile,
            "local_desktop",
          ),
        );
      } catch (error) {
        const groupKey = checkpointGroupKey(
          "local_desktop",
          profile.id,
          fixture.id,
        );
        let samplesByScenario = new Map(
          PHASE_4_SCENARIOS.map((scenario) => [scenario.scenarioId, []]),
        );
        try {
          samplesByScenario = checkpointSamplesForGroup(groupKey);
        } catch {
          samplesByScenario = new Map(
            PHASE_4_SCENARIOS.map((scenario) => [scenario.scenarioId, []]),
          );
        }
        const failure = {
          groupKey,
          fixtureId: fixture.id,
          fixtureClass: fixture.fixtureClass,
          profileId: profile.id,
          environment: "local_desktop",
          reason: `fixture_${classifyHarnessError(error)}`,
          error: describeHarnessError(error, {
            phase: "fixture_boundary",
            scenarioId: null,
          }),
        };
        profiles.push({
          fixtureId: fixture.id,
          fixtureClass: fixture.fixtureClass,
          profileId: profile.id,
          runsPerScenario: runs,
          groupKey,
          scenarios: PHASE_4_SCENARIOS.map((scenario) =>
            summarizeCapturedScenario(
              samplesByScenario.get(scenario.scenarioId) ?? [],
              scenario,
            ),
          ),
          preparationStatus: "UNKNOWN",
          attemptCount: checkpointAttemptCount(groupKey),
          maxAttempts: PHASE_4_MAX_ATTEMPTS,
          discardedAttemptCount: checkpointDiscardedAttempts(groupKey).length,
          discardedAttempts: checkpointDiscardedAttempts(groupKey),
          failedAttemptCount: checkpointFailedAttempts(groupKey).length,
          failedAttempts: checkpointFailedAttempts(groupKey),
          fixtureFailureCount: 1,
          fixtureFailures: [failure],
          preparationFailureCount: 0,
          preparationFailures: [],
          stoppedEarly: true,
          stopReason: failure.reason,
          status: "BLOCKED",
        });
      }
    }
    return {
      environment: "local_desktop",
      status: profiles.every((item) => item.status === "PASS") ? "PASS" : "BLOCKED",
      baseUrl: sanitizeRoute(baseUrl),
      supabaseApiUrl: localStatus.apiUrl,
      cacheMode: "browser_default",
      serviceWorkerMode: "allow",
      profiler: "off",
      profiles,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export function hostedConfiguration(options = {}) {
  const loaded = loadPhase4HostedInputs({
    repoRoot,
    environment: options.environment ?? process.env,
  });
  if (loaded.status !== "READY") return loaded;

  const { baseUrl, email, password } = loaded;
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return {
      status: "BLOCKED",
      reason: "hosted_base_url_invalid",
      filePresent: loaded.filePresent,
      filePath: loaded.filePath,
      requiredKeys: loaded.requiredKeys,
    };
  }
  if (
    parsedUrl.origin !== PHASE_4_APPROVED_HOSTED_ORIGIN ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    return {
      status: "BLOCKED",
      reason: "hosted_target_not_approved",
      filePresent: loaded.filePresent,
      filePath: loaded.filePath,
      requiredKeys: loaded.requiredKeys,
    };
  }
  return {
    status: "READY",
    source: loaded.source,
    fileSource: loaded.fileSource,
    filePresent: loaded.filePresent,
    filePath: loaded.filePath,
    requiredKeys: loaded.requiredKeys,
    inputPresence: loaded.inputPresence,
    baseUrl,
    email,
    password,
  };
}

export function hostedPrerequisite(configuration) {
  if (configuration.status !== "READY") {
    return { status: "BLOCKED", reason: configuration.reason };
  }
  return {
    status: "READY",
    baseUrl: sanitizeTargetUrl(configuration.baseUrl),
    emailProvided: true,
    passwordProvided: true,
  };
}

function hostedConfigurationSummary(configuration) {
  return {
    status: configuration?.status ?? "BLOCKED",
    source: configuration?.source ?? null,
    fileSource: configuration?.fileSource ?? null,
    filePresent: configuration?.filePresent === true,
    filePath: configuration?.filePath ?? null,
    requiredKeys: configuration?.requiredKeys ?? null,
    inputPresence: configuration?.inputPresence ?? null,
    baseUrl:
      configuration?.status === "READY"
        ? sanitizeTargetUrl(configuration.baseUrl)
        : null,
  };
}

export async function verifyHostedAccess(configuration) {
  const input = hostedConfigurationSummary(configuration);
  if (configuration?.status !== "READY") {
    return {
      status: "BLOCKED",
      reason: configuration?.reason || "hosted_synthetic_account_or_url_not_provided",
      input,
      health: null,
      login: {
        status: null,
        authenticated: false,
        shellVisible: false,
        loginVisible: null,
      },
      requiredRead: {
        route: "/api/shell/bootstrap",
        status: "NOT_RUN",
        bodyFinished: false,
      },
    };
  }

  const health = await collectReleaseIdentity(configuration.baseUrl);
  if (!releaseIdentityIsHealthy(health)) {
    return {
      status: "BLOCKED",
      reason: "hosted_release_health_failed_before_login",
      input,
      health,
      login: {
        status: null,
        authenticated: false,
        shellVisible: false,
        loginVisible: null,
      },
      requiredRead: {
        route: "/api/shell/bootstrap",
        status: "NOT_RUN",
        bodyFinished: false,
      },
    };
  }

  let browser = null;
  let context = null;
  let page = null;
  let tracker = null;
  let trackerFinished = false;
  let loginStatus = null;
  let auth = {
    authenticated: false,
    demoCookieInjected: false,
  };
  let workspaceOpened = false;
  let capturedRequests = [];
  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      serviceWorkers: "allow",
    });
    page = await context.newPage();
    await page.goto(configuration.baseUrl + "/login?next=/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await waitForLoginClientReady(page);
    tracker = createRequestTracker(page, ["/api/shell/bootstrap"]);
    const loginResponsePromise = page.waitForResponse(
      (response) => sanitizeRoute(response.url()) === "/api/auth/password-login",
      { timeout: 30_000 },
    );
    await page.locator("#customer-login-email").fill(configuration.email);
    await page.locator("#customer-login-password").fill(configuration.password);
    await page.locator('[data-testid="customer-login-submit"]').click({ timeout: 8_000 });
    loginStatus = (await loginResponsePromise).status();
    await waitForReady(page, '[data-testid="authenticated-shell"]', 30_000);
    auth = await pageAuthState(page);
    const currentUrl = new URL(page.url());
    workspaceOpened =
      currentUrl.origin === new URL(configuration.baseUrl).origin &&
      currentUrl.pathname === "/dashboard";
    await tracker.waitForRequiredReads();
    capturedRequests = await tracker.finish();
    trackerFinished = true;
    const bootstrapRead = capturedRequests.find(
      (request) =>
        request.method === "GET" && routeMatches(request.route, "/api/shell/bootstrap"),
    );
    const bootstrapPass = hasSuccessfulRead(capturedRequests, "/api/shell/bootstrap");
    const status =
      loginStatus === 200 &&
      auth.authenticated === true &&
      auth.demoCookieInjected === false &&
      workspaceOpened === true &&
      bootstrapPass
        ? "PASS"
        : "BLOCKED";
    return {
      status,
      reason:
        status === "PASS"
          ? null
          : loginStatus !== 200
            ? "hosted_password_login_failed"
            : !auth.authenticated
              ? "hosted_authenticated_shell_not_ready"
              : "hosted_shell_bootstrap_not_ready",
      input,
      health,
      login: {
        status: loginStatus,
        authenticated: auth.authenticated,
        workspaceOpened,
        shellVisible: await page
          .locator('[data-testid="authenticated-shell"]')
          .isVisible()
          .catch(() => false),
        loginVisible: await page
          .locator("#customer-login-email")
          .isVisible()
          .catch(() => false),
      },
      requiredRead: {
        route: "/api/shell/bootstrap",
        status: bootstrapPass ? "PASS" : "FAIL",
        httpStatus: bootstrapRead?.status ?? null,
        bodyFinished: Number.isFinite(bootstrapRead?.bodyFinishedMs),
      },
    };
  } catch (error) {
    if (tracker && !trackerFinished) {
      capturedRequests = await tracker.finish().catch(() => []);
      trackerFinished = true;
    }
    return {
      status: "BLOCKED",
      reason: classifyHarnessError(error),
      input,
      health,
      login: {
        status: loginStatus,
        authenticated: auth.authenticated,
        workspaceOpened,
        shellVisible: false,
        loginVisible: null,
      },
      requiredRead: {
        route: "/api/shell/bootstrap",
        status: hasSuccessfulRead(capturedRequests, "/api/shell/bootstrap")
          ? "PASS"
          : "FAIL",
        httpStatus:
          capturedRequests.find(
            (request) =>
              request.method === "GET" && routeMatches(request.route, "/api/shell/bootstrap"),
          )?.status ?? null,
        bodyFinished: capturedRequests.some(
          (request) =>
            request.method === "GET" &&
            routeMatches(request.route, "/api/shell/bootstrap") &&
            Number.isFinite(request.bodyFinishedMs),
        ),
      },
    };
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function runHostedBaseline(runs, configuration = hostedConfiguration()) {
  const prerequisite = hostedPrerequisite(configuration);
  if (configuration.status !== "READY") {
    return {
      environment: "owner_pc_hosted",
      status: "BLOCKED",
      reason: configuration.reason,
      prerequisite,
    };
  }
  const releaseBefore = await collectReleaseIdentity(configuration.baseUrl);
  if (!releaseIdentityIsHealthy(releaseBefore)) {
    return {
      environment: "owner_pc_hosted",
      status: "BLOCKED",
      reason: "hosted_release_health_failed_before_baseline",
      baseUrl: sanitizeTargetUrl(configuration.baseUrl),
      cacheMode: "browser_default",
      serviceWorkerMode: "allow",
      profiler: "off",
      releaseIdentity: { before: releaseBefore, after: null, status: "BLOCKED" },
      prerequisite,
    };
  }
  const browser = await chromium.launch();
  try {
    const profile = await runBrowserFixture(
      browser,
      configuration.baseUrl,
      {
        id: "hosted_synthetic",
        fixtureClass: "hosted_synthetic",
        email: configuration.email,
        password: configuration.password,
      },
      runs,
      {
        id: "owner_pc_hosted_authenticated",
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
      },
      "owner_pc_hosted",
    );
    const releaseAfter = await collectReleaseIdentity(configuration.baseUrl);
    const releaseChanged =
      !releaseIdentityIsHealthy(releaseAfter) ||
      ["releaseId", "commit", "migrationFingerprint", "compatibilityVersion"].some(
        (field) => releaseBefore[field] !== releaseAfter[field],
      );
    const status = releaseChanged ? "STALE" : profile.status;
    return {
      environment: "owner_pc_hosted",
      status,
      baseUrl: sanitizeTargetUrl(configuration.baseUrl),
      cacheMode: "browser_default",
      serviceWorkerMode: "allow",
      profiler: "off",
      profiles: [profile],
      stale: releaseChanged,
      reason:
        releaseChanged && !releaseIdentityIsHealthy(releaseAfter)
          ? "hosted_release_health_failed_after_baseline"
          : releaseChanged
            ? "hosted_release_changed_during_baseline"
            : null,
      releaseIdentity: {
        before: releaseBefore,
        after: releaseAfter,
        status: releaseChanged ? "STALE" : "PASS",
      },
    };
  } finally {
    await browser.close();
  }
}

export function parseAdbDeviceInventory(stdout = "") {
  const entries = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^List of devices attached/i.test(line) &&
        !/^\* daemon/i.test(line),
    )
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)(?:\s+.*)?$/);
      return match ? { serial: match[1], state: match[2] } : null;
    })
    .filter(Boolean);
  return {
    entries,
    authorized: entries.filter((entry) => entry.state === "device"),
    unauthorized: entries.filter((entry) => entry.state === "unauthorized"),
    offline: entries.filter((entry) => entry.state === "offline"),
    other: entries.filter(
      (entry) => !["device", "unauthorized", "offline"].includes(entry.state),
    ),
  };
}

export function parseInstalledPwaPackages(packageOutput = "") {
  const lines = Array.isArray(packageOutput)
    ? packageOutput
    : String(packageOutput).split(/\r?\n/);
  return [
    ...new Set(
      lines
        .map((line) => String(line).trim().replace(/^package:/, ""))
        .filter((packageName) => PHASE_4_ANDROID_PWA_PACKAGE_PATTERN.test(packageName)),
    ),
  ];
}

export function selectInstalledPwaPackage(
  packageOutput = "",
  preferredPackage = PHASE_4_ANDROID_PWA_PACKAGE_HINT,
) {
  const candidates = parseInstalledPwaPackages(packageOutput);
  if (!candidates.length) {
    return {
      status: "BLOCKED",
      reason: "installed_pwa_package_not_found",
      candidateCount: 0,
      packageName: null,
      candidates: [],
    };
  }
  if (candidates.includes(preferredPackage)) {
    return {
      status: "READY_FOR_LAUNCH",
      reason: null,
      candidateCount: candidates.length,
      packageName: preferredPackage,
      candidates,
      selection: "preferred_installed_webapk",
    };
  }
  if (candidates.length > 1) {
    return {
      status: "BLOCKED",
      reason: "multiple_installed_pwa_candidates_ambiguous",
      candidateCount: candidates.length,
      packageName: null,
      candidates,
    };
  }
  return {
    status: "READY_FOR_LAUNCH",
    reason: null,
    candidateCount: 1,
    packageName: candidates[0],
    candidates,
    selection: "single_installed_webapk",
  };
}

export function parseResolvedAndroidActivity(stdout = "") {
  const components = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z0-9._$]+\/[A-Za-z0-9._$]+$/.test(line));
  return components.at(-1) ?? null;
}

export function stripAndroidTargetRuntime(target) {
  if (!target || typeof target !== "object") return target;
  const safeTarget = { ...target };
  delete safeTarget.runtime;
  return safeTarget;
}

export function checkAndroidConnection(serial) {
  if (!serial) {
    return {
      status: "BLOCKED",
      connected: false,
      reason: "android_connection_identity_missing",
      deviceCount: 0,
      authorizedDeviceCount: 0,
      serialRecorded: false,
    };
  }
  const devices = run("adb", ["devices", "-l"], {
    timeout: PHASE_4_ANDROID_COMMAND_TIMEOUT_MS,
  });
  if (devices.status !== 0) {
    return {
      status: "BLOCKED",
      connected: false,
      reason: "android_connection_inventory_failed",
      deviceCount: 0,
      authorizedDeviceCount: 0,
      serialRecorded: false,
    };
  }
  const inventory = parseAdbDeviceInventory(devices.stdout);
  const selected = inventory.entries.find((entry) => entry.serial === serial);
  if (!selected) {
    return {
      status: "BLOCKED",
      connected: false,
      reason:
        inventory.unauthorized.length > 0
          ? "android_device_not_authorized"
          : "android_device_disconnected",
      deviceCount: inventory.entries.length,
      authorizedDeviceCount: inventory.authorized.length,
      serialRecorded: false,
    };
  }
  if (selected.state !== "device") {
    return {
      status: "BLOCKED",
      connected: false,
      reason: selected.state === "unauthorized" ? "android_device_not_authorized" : "android_device_not_ready",
      deviceCount: inventory.entries.length,
      authorizedDeviceCount: inventory.authorized.length,
      serialRecorded: false,
    };
  }
  const state = run("adb", ["-s", serial, "get-state"], {
    timeout: PHASE_4_ANDROID_COMMAND_TIMEOUT_MS,
  });
  const connected = state.status === 0 && state.stdout.trim() === "device";
  return {
    status: connected ? "PASS" : "BLOCKED",
    connected,
    reason: connected ? null : "android_device_get_state_failed",
    deviceCount: inventory.entries.length,
    authorizedDeviceCount: inventory.authorized.length,
    serialRecorded: false,
  };
}

export function createAndroidConnectionMonitor(serial) {
  const checks = [];
  return {
    check(checkpoint) {
      const result = checkAndroidConnection(serial);
      checks.push({
        checkpoint,
        status: result.status,
        connected: result.connected,
        reason: result.reason,
        deviceCount: result.deviceCount,
        authorizedDeviceCount: result.authorizedDeviceCount,
        serialRecorded: false,
      });
      return result;
    },
    evidence() {
      const status =
        checks.length > 0 && checks.every((check) => check.status === "PASS")
          ? "PASS"
          : checks.length > 0
            ? "BLOCKED"
            : "NOT_RUN";
      return {
        status,
        checkCount: checks.length,
        serialRecorded: false,
        checks: checks.map((check) => ({ ...check })),
      };
    },
  };
}

export async function connectPhase4AndroidCdp() {
  let lastError = null;
  for (let attempt = 1; attempt <= PHASE_4_ANDROID_CDP_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await chromium.connectOverCDP(PHASE_4_ANDROID_CDP_URL, {
        timeout: PHASE_4_ANDROID_COMMAND_TIMEOUT_MS,
      });
    } catch (error) {
      lastError = error;
      if (attempt < PHASE_4_ANDROID_CDP_CONNECT_ATTEMPTS) {
        await sleep(PHASE_4_ANDROID_CDP_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError ?? new Error("android_cdp_unavailable");
}

export function collectAndroidTarget({ includeRuntime = false } = {}) {
  const finish = (result, serial = null, monitor = null) => {
    const safeResult = {
      ...result,
      connectionMonitoring: monitor?.evidence() ?? result.connectionMonitoring ?? null,
    };
    if (!includeRuntime || !serial || !monitor) return safeResult;
    return {
      ...safeResult,
      runtime: { serial, monitor },
    };
  };

  const server = run("adb", ["start-server"], {
    timeout: PHASE_4_ANDROID_COMMAND_TIMEOUT_MS,
  });
  if (server.status !== 0) {
    return finish({
      status: "BLOCKED",
      reason: "adb_server_unavailable",
      deviceCount: 0,
      authorizedDeviceCount: 0,
      serialRecorded: false,
    });
  }
  const devices = run("adb", ["devices", "-l"], {
    timeout: PHASE_4_ANDROID_COMMAND_TIMEOUT_MS,
  });
  if (devices.status !== 0) {
    return finish({
      status: "BLOCKED",
      reason: "adb_device_inventory_failed",
      deviceCount: 0,
      authorizedDeviceCount: 0,
      serialRecorded: false,
    });
  }
  const inventory = parseAdbDeviceInventory(devices.stdout);
  if (!inventory.authorized.length) {
    return finish({
      status: "BLOCKED",
      reason:
        inventory.unauthorized.length > 0
          ? "android_device_not_authorized"
          : "no_physical_android_device",
      deviceCount: inventory.entries.length,
      authorizedDeviceCount: 0,
      unauthorizedDeviceCount: inventory.unauthorized.length,
      offlineDeviceCount: inventory.offline.length,
      serialRecorded: false,
    });
  }
  if (inventory.authorized.length > 1) {
    return finish({
      status: "BLOCKED",
      reason: "multiple_physical_android_devices_ambiguous",
      deviceCount: inventory.entries.length,
      authorizedDeviceCount: inventory.authorized.length,
      serialRecorded: false,
    });
  }

  const serial = inventory.authorized[0].serial;
  const monitor = createAndroidConnectionMonitor(serial);
  const adb = (args, timeout = PHASE_4_ANDROID_COMMAND_TIMEOUT_MS) =>
    run("adb", ["-s", serial, ...args], { timeout });
  const initialConnection = monitor.check("after_adb_authorization");
  const base = {
    deviceCount: inventory.entries.length,
    authorizedDeviceCount: inventory.authorized.length,
    unauthorizedDeviceCount: inventory.unauthorized.length,
    offlineDeviceCount: inventory.offline.length,
    serialRecorded: false,
  };
  if (initialConnection.status !== "PASS") {
    return finish(
      {
        status: "BLOCKED",
        reason: initialConnection.reason,
        ...base,
      },
      serial,
      monitor,
    );
  }

  const modelResult = adb(["shell", "getprop", "ro.product.model"]);
  const androidVersionResult = adb(["shell", "getprop", "ro.build.version.release"]);
  const model = modelResult.stdout.trim() || null;
  const androidVersion = androidVersionResult.stdout.trim() || null;
  const chrome = adb(["shell", "dumpsys", "package", PHASE_4_ANDROID_CHROME_PACKAGE]);
  const chromeVersionName = chrome.stdout.match(/versionName=([^\r\n]+)/)?.[1]?.trim() ?? null;
  if (chrome.status !== 0 || !chromeVersionName) {
    return finish(
      {
        status: "BLOCKED",
        reason: "android_chrome_not_installed_or_unreadable",
        ...base,
        model,
        androidVersion,
        chromeVersionName,
      },
      serial,
      monitor,
    );
  }

  const pwaPackages = adb(["shell", "pm", "list", "packages"]);
  const pwaSelection =
    pwaPackages.status === 0
      ? selectInstalledPwaPackage(pwaPackages.stdout)
      : {
          status: "BLOCKED",
          reason: "installed_pwa_package_list_failed",
          candidateCount: 0,
          packageName: null,
          candidates: [],
        };
  let pwa = { ...pwaSelection, launchActivity: null, launchActivityStatus: "NOT_RUN" };
  if (pwaSelection.status === "READY_FOR_LAUNCH") {
    const resolvedActivity = adb([
      "shell",
      "cmd",
      "package",
      "resolve-activity",
      "--brief",
      "--user",
      "0",
      pwaSelection.packageName,
    ]);
    const launchActivity = parseResolvedAndroidActivity(resolvedActivity.stdout);
    pwa = {
      ...pwaSelection,
      launchActivity,
      launchActivityStatus:
        resolvedActivity.status === 0 && launchActivity ? "PASS" : "BLOCKED",
    };
    if (pwa.launchActivityStatus !== "PASS") {
      pwa.status = "BLOCKED";
      pwa.reason = "installed_pwa_launch_activity_unresolved";
    }
  }

  const chromeLaunch = adb(
    ["shell", "monkey", "-p", PHASE_4_ANDROID_CHROME_PACKAGE, "1"],
    20_000,
  );
  const afterChromeLaunch = monitor.check("after_android_chrome_launch");
  if (chromeLaunch.status !== 0 || afterChromeLaunch.status !== "PASS") {
    return finish(
      {
        status: "BLOCKED",
        reason:
          afterChromeLaunch.status !== "PASS"
            ? afterChromeLaunch.reason
            : "android_chrome_launch_failed",
        ...base,
        model,
        androidVersion,
        chromeVersionName,
        chromeLaunchStatus: chromeLaunch.status === 0 ? "PASS" : "BLOCKED",
        pwa,
      },
      serial,
      monitor,
    );
  }
  const forward = adb([
    "forward",
    "tcp:9222",
    "localabstract:chrome_devtools_remote",
  ]);
  const afterForward = monitor.check("after_cdp_forward");
  if (forward.status !== 0 || afterForward.status !== "PASS") {
    return finish(
      {
        status: "BLOCKED",
        reason:
          afterForward.status !== "PASS" ? afterForward.reason : "adb_cdp_forward_failed",
        ...base,
        model,
        androidVersion,
        chromeVersionName,
        chromeLaunchStatus: "PASS",
        cdpForwardStatus: forward.status === 0 ? "PASS" : "BLOCKED",
        pwa,
      },
      serial,
      monitor,
    );
  }
  return finish(
    {
      status: "READY_FOR_CDP_CAPTURE",
      reason: null,
      ...base,
      model,
      androidVersion,
      chromeVersionName,
      chromeLaunchStatus: "PASS",
      cdpForwardStatus: "PASS",
      pwa,
    },
    serial,
    monitor,
  );
}

export function launchInstalledPwa(androidTarget, runtime) {
  const pwa = androidTarget?.pwa;
  const monitor = runtime?.monitor;
  const serial = runtime?.serial;
  if (androidTarget?.status !== "READY_FOR_CDP_CAPTURE") {
    return {
      status: "BLOCKED",
      reason: androidTarget?.reason || "android_target_not_ready",
      packageFound: false,
      packageLaunchStatus: "NOT_RUN",
      serialRecorded: false,
    };
  }
  if (pwa?.status !== "READY_FOR_LAUNCH" || !pwa.packageName || !pwa.launchActivity) {
    return {
      status: "BLOCKED",
      reason: pwa?.reason || "installed_pwa_not_ready_for_launch",
      packageFound: Boolean(pwa?.packageName),
      packageLaunchStatus: "NOT_RUN",
      launchActivityStatus: pwa?.launchActivityStatus ?? "NOT_RUN",
      serialRecorded: false,
    };
  }
  if (!serial || !monitor) {
    return {
      status: "BLOCKED",
      reason: "android_runtime_handle_missing",
      packageFound: true,
      packageLaunchStatus: "NOT_RUN",
      launchActivityStatus: pwa.launchActivityStatus,
      serialRecorded: false,
    };
  }
  const before = monitor.check("before_independent_pwa_launch");
  if (before.status !== "PASS") {
    return {
      status: "BLOCKED",
      reason: before.reason,
      packageFound: true,
      packageLaunchStatus: "NOT_RUN",
      launchActivityStatus: pwa.launchActivityStatus,
      serialRecorded: false,
    };
  }
  const launch = run(
    "adb",
    ["-s", serial, "shell", "monkey", "-p", pwa.packageName, "1"],
    { timeout: PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS },
  );
  const after = monitor.check("after_independent_pwa_launch");
  const packageLaunchStatus = launch.status === 0 ? "PASS" : "BLOCKED";
  return {
    status: packageLaunchStatus === "PASS" && after.status === "PASS" ? "PASS" : "BLOCKED",
    reason:
      after.status !== "PASS"
        ? after.reason
        : packageLaunchStatus === "PASS"
          ? null
          : "installed_pwa_launch_failed",
    packageFound: true,
    packageLaunchStatus,
    launchActivityStatus: pwa.launchActivityStatus,
    serialRecorded: false,
  };
}

export function launchAndroidChromeTarget(androidTarget, runtime, baseUrl) {
  const monitor = runtime?.monitor;
  const serial = runtime?.serial;
  if (androidTarget?.status !== "READY_FOR_CDP_CAPTURE") {
    return {
      status: "BLOCKED",
      reason: androidTarget?.reason || "android_target_not_ready",
      launchStatus: "NOT_RUN",
      serialRecorded: false,
    };
  }
  if (!serial || !monitor) {
    return {
      status: "BLOCKED",
      reason: "android_runtime_handle_missing",
      launchStatus: "NOT_RUN",
      serialRecorded: false,
    };
  }
  const before = monitor.check("before_android_chrome_view_intent");
  if (before.status !== "PASS") {
    return {
      status: "BLOCKED",
      reason: before.reason,
      launchStatus: "NOT_RUN",
      serialRecorded: false,
    };
  }
  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    return {
      status: "BLOCKED",
      reason: "android_chrome_target_url_invalid",
      launchStatus: "NOT_RUN",
      serialRecorded: false,
    };
  }
  const launch = run(
    "adb",
    [
      "-s",
      serial,
      "shell",
      "am",
      "start",
      "-W",
      "-n",
      `${PHASE_4_ANDROID_CHROME_PACKAGE}/com.google.android.apps.chrome.Main`,
      "-a",
      "android.intent.action.VIEW",
      "-d",
      target.origin,
    ],
    { timeout: PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS },
  );
  const after = monitor.check("after_android_chrome_view_intent");
  return {
    status: launch.status === 0 && after.status === "PASS" ? "PASS" : "BLOCKED",
    reason:
      after.status !== "PASS"
        ? after.reason
        : launch.status === 0
          ? null
          : "android_chrome_view_intent_failed",
    launchStatus: launch.status === 0 ? "PASS" : "BLOCKED",
    serialRecorded: false,
  };
}

async function findCdpPage(browser, standaloneRequired, expectedOrigin) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((context) => context.pages());
  for (const page of pages) {
    const state = await page
      .evaluate(() => ({
        origin: window.location.origin,
        displayModeStandalone:
          window.matchMedia?.("(display-mode: standalone)")?.matches === true,
        serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
        online: navigator.onLine === true,
      }))
      .catch(() => ({ origin: null, displayModeStandalone: false, serviceWorkerControlled: false }));
    if (
      state.origin === expectedOrigin &&
      state.online === true &&
      (standaloneRequired
        ? state.displayModeStandalone && state.serviceWorkerControlled
        : !state.displayModeStandalone)
    ) {
      return { context: page.context(), page };
    }
  }
  return null;
}

export async function navigateAndroidChromeHostedTarget(
  browser,
  expectedOrigin,
  monitor = null,
  environment = "android",
) {
  let targetOrigin;
  try {
    targetOrigin = new URL(expectedOrigin).origin;
  } catch {
    return {
      status: "BLOCKED",
      navigation: "not_run",
      reason: "android_chrome_target_url_invalid",
      target: null,
    };
  }

  const existingTarget = await findCdpPage(browser, false, targetOrigin);
  if (existingTarget) {
    return {
      status: "PASS",
      navigation: "existing_normal_chrome_target",
      reason: null,
      target: existingTarget,
    };
  }

  const pages = browser.contexts().flatMap((context) => context.pages());
  let normalTab = pages.find((page) => page.url().startsWith("chrome-native:"));
  if (!normalTab) {
    for (const page of pages.filter((candidate) => candidate.url().startsWith("chrome-error://"))) {
      const state = await page
        .evaluate(() => ({
          standalone: window.matchMedia?.("(display-mode: standalone)")?.matches === true,
        }))
        .catch(() => ({ standalone: true }));
      if (!state.standalone) {
        normalTab = page;
        break;
      }
    }
  }
  if (!normalTab) {
    return {
      status: "BLOCKED",
      navigation: "not_run",
      reason: "android_chrome_normal_tab_not_found",
      target: null,
    };
  }

  const before = monitor?.check(`${environment}:before_normal_tab_navigation`);
  if (before && before.status !== "PASS") {
    return {
      status: "BLOCKED",
      navigation: "cdp_normal_tab_navigation",
      reason: before.reason || "android_connection_lost_before_normal_tab_navigation",
      target: null,
    };
  }

  try {
    await normalTab.goto(targetOrigin, {
      waitUntil: "domcontentloaded",
      timeout: PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS,
    });
  } catch {
    return {
      status: "BLOCKED",
      navigation: "cdp_normal_tab_navigation",
      reason: "android_chrome_normal_tab_navigation_failed",
      target: null,
    };
  }

  const after = monitor?.check(`${environment}:after_normal_tab_navigation`);
  if (after && after.status !== "PASS") {
    return {
      status: "BLOCKED",
      navigation: "cdp_normal_tab_navigation",
      reason: after.reason || "android_connection_lost_after_normal_tab_navigation",
      target: null,
    };
  }

  const target = await findCdpPage(browser, false, targetOrigin);
  return target
    ? {
        status: "PASS",
        navigation: "cdp_normal_tab_navigation",
        reason: null,
        target,
      }
    : {
        status: "BLOCKED",
        navigation: "cdp_normal_tab_navigation",
        reason: "android_chrome_normal_target_not_verified",
        target: null,
      };
}

function safeAndroidChromeNavigationResult(result) {
  return {
    status: result.status,
    navigation: result.navigation,
    reason: result.reason,
  };
}

async function waitForCdpPage(
  browser,
  standaloneRequired,
  expectedOrigin,
  monitor = null,
  environment = "android",
) {
  const deadline = Date.now() + PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS;
  let pollCount = 0;
  while (Date.now() <= deadline) {
    pollCount += 1;
    const connection = monitor?.check(`${environment}:target_poll_${pollCount}`);
    if (connection && connection.status !== "PASS") {
      return { target: null, reason: "android_connection_lost_while_waiting_for_target" };
    }
    const target = await findCdpPage(browser, standaloneRequired, expectedOrigin);
    if (target) return { target, reason: null };
    await sleep(500);
  }
  return { target: null, reason: null };
}

export function disconnectCdpBrowser(browser) {
  const implementation = browser?._connection?.toImpl?.(browser);
  const connection = implementation?._connection;
  if (!connection || typeof connection.close !== "function") {
    throw new Error("playwright_cdp_disconnect_unavailable");
  }
  connection.close();
}

async function runCdpBaseline(
  environment,
  baseUrl,
  fixture,
  runs,
  standaloneRequired,
  androidRuntime = null,
) {
  const monitor = androidRuntime?.monitor ?? null;
  const blocked = (reason, extra = {}) => ({
    environment,
    status: "BLOCKED",
    reason,
    connectionMonitoring: monitor?.evidence() ?? null,
    ...extra,
  });
  let browser;
  try {
    const beforeConnect = monitor?.check(`${environment}:before_cdp_connect`);
    if (beforeConnect && beforeConnect.status !== "PASS") {
      return blocked("android_connection_lost_before_cdp_connect");
    }
    browser = await connectPhase4AndroidCdp();
    const afterConnect = monitor?.check(`${environment}:after_cdp_connect`);
    if (afterConnect && afterConnect.status !== "PASS") {
      return blocked("android_connection_lost_after_cdp_connect");
    }
    const expectedOrigin = new URL(baseUrl).origin;
    let targetResult = await waitForCdpPage(
      browser,
      standaloneRequired,
      expectedOrigin,
      monitor,
      environment,
    );
    if (targetResult.reason) return blocked(targetResult.reason);
    let targetNavigation = null;
    if (!standaloneRequired && androidRuntime && !targetResult.target) {
      const navigation = await navigateAndroidChromeHostedTarget(
        browser,
        expectedOrigin,
        monitor,
        environment,
      );
      targetNavigation = safeAndroidChromeNavigationResult(navigation);
      if (navigation.status === "PASS") {
        targetResult = { target: navigation.target, reason: null };
      } else {
        return blocked(navigation.reason || "chrome_target_not_found", {
          targetNavigation,
        });
      }
    }
    const target = targetResult.target;
    if (!target) {
      return blocked(
        standaloneRequired ? "installed_pwa_target_not_found" : "chrome_target_not_found",
        { targetNavigation },
      );
    }
    const { context, page } = target;
    if (standaloneRequired) {
      const state = await page
        .evaluate(() => ({
          displayModeStandalone:
            window.matchMedia?.("(display-mode: standalone)")?.matches === true,
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
        }))
        .catch(() => ({ displayModeStandalone: false, serviceWorkerControlled: false }));
      if (!state.displayModeStandalone || !state.serviceWorkerControlled) {
        return blocked("pwa_display_mode_or_service_worker_not_verified");
      }
    }
    const targetOrigin = await page
      .evaluate(() => window.location.origin)
      .catch(() => null);
    if (targetOrigin !== expectedOrigin) {
      return blocked("cdp_target_origin_mismatch");
    }
    let targetFocus = { status: "NOT_RUN" };
    if (androidRuntime) {
      try {
        await page.bringToFront();
        targetFocus = { status: "PASS" };
      } catch {
        targetFocus = { status: "BLOCKED" };
        return blocked("android_cdp_target_focus_failed", { targetFocus });
      }
    }
    await installPerformanceObservers(page);
    const groupKey = checkpointGroupKey(environment, environment, fixture.id);
    const samplesByScenario = checkpointSamplesForGroup(groupKey);
    const discardedAttempts = checkpointDiscardedAttempts(groupKey);
    const failedAttempts = [
      ...checkpointFailedAttempts(groupKey),
      ...recoverUnfinishedCheckpointAttempts({
        groupKey,
        fixture,
        profile: { id: environment },
        environment,
      }),
    ];
    const preparationFailures = checkpointEvents(
      "phase4.preparation.failed",
      groupKey,
    ).map((event) => event.payload);
    let attemptCount = checkpointAttemptCount(groupKey);
    const maxAttempts = PHASE_4_MAX_ATTEMPTS;
    let preparationStatus = "NOT_RUN";
    const preparationConnection = monitor?.check(`${environment}:before_preparation`);
    if (preparationConnection && preparationConnection.status !== "PASS") {
      return blocked("android_connection_lost_before_preparation");
    }
    let preparation = null;
    let stopReason = null;
    try {
      preparation = await collectMeasurementRound(page, context, baseUrl, fixture, {
        androidCdp: Boolean(androidRuntime),
      });
    } catch (error) {
      const failure = {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: environment,
        environment,
        reason: `preparation_${classifyHarnessError(error)}`,
        error: describeHarnessError(error, {
          phase: error?.phase4Context?.phase ?? "preparation",
          scenarioId: error?.phase4Context?.scenarioId ?? null,
        }),
      };
      preparationFailures.push(failure);
      checkpointRecord("phase4.preparation.failed", failure);
      preparationStatus = "BLOCKED";
      stopReason = failure.reason;
    }
    const preparationAfter = monitor?.check(`${environment}:after_preparation`);
    if (preparationAfter && preparationAfter.status !== "PASS") {
      return blocked("android_connection_lost_after_preparation");
    }
    if (preparation) {
      preparationStatus = preparation.invalidReason ? "BLOCKED" : "PASS";
      checkpointRecord("phase4.preparation", {
        groupKey,
        status: preparationStatus,
        reason: preparation.invalidReason,
        scenarioId: preparation.invalidScenarioId,
        countedAsOfficialSample: false,
        environment,
      });
      if (preparation.invalidReason) {
        stopReason = `preparation_failed:${preparation.invalidReason}`;
      }
    }
    if (!stopReason && checkpointShouldPause()) {
      activePhase4Checkpoint.applyPause("pause_requested_after_preparation");
      stopReason = "pause_requested";
    }
    while (
      preparationStatus === "PASS" &&
      !stopReason &&
      (samplesByScenario.get("post_login_dashboard")?.length ?? 0) < runs &&
      attemptCount < maxAttempts
    ) {
      const beforeSample = monitor?.check(`${environment}:before_sample_${attemptCount + 1}`);
      if (beforeSample && beforeSample.status !== "PASS") {
        return blocked("android_connection_lost_during_measurement");
      }
      attemptCount += 1;
      checkpointRecord("phase4.attempt.started", {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: environment,
        attempt: attemptCount,
        countedAsOfficialSample: true,
        environment,
      });
      let round = null;
      try {
        round = await collectMeasurementRound(page, context, baseUrl, fixture, {
          androidCdp: Boolean(androidRuntime),
        });
      } catch (error) {
        const failure = phase4AttemptFailure({
          error,
          groupKey,
          fixture,
          profile: { id: environment },
          environment,
          attempt: attemptCount,
          phase: "measurement_round",
        });
        failedAttempts.push(failure);
        checkpointRecord("phase4.attempt.failed", failure);
        stopReason = failure.reason;
        break;
      }
      const afterSample = monitor?.check(`${environment}:after_sample_${attemptCount}`);
      if (afterSample && afterSample.status !== "PASS") {
        return blocked("android_connection_lost_during_measurement");
      }
      if (round.invalidReason) {
        const discarded = {
          groupKey,
          attempt: attemptCount,
          reason: round.invalidReason,
          scenarioId: round.invalidScenarioId,
          scenarioResults: round.scenarioResults,
        };
        discardedAttempts.push(discarded);
        checkpointRecord("phase4.attempt.discarded", discarded);
        continue;
      }
      const samplesObject = Object.fromEntries(
        [...round.attemptSamples.entries()].map(([scenarioId, sample]) => [
          scenarioId,
          [sample],
        ]),
      );
      const nextRoundNumber =
        (samplesByScenario.get("post_login_dashboard")?.length ?? 0) + 1;
      checkpointRecord("phase4.round.committed", {
        groupKey,
        fixtureId: fixture.id,
        fixtureClass: fixture.fixtureClass,
        profileId: environment,
        attempt: attemptCount,
        roundNumber: nextRoundNumber,
        samplesByScenario: samplesObject,
        countedAsOfficialSample: true,
        environment,
      });
      for (const [scenarioId, sample] of round.attemptSamples.entries()) {
        samplesByScenario.get(scenarioId).push(sample);
      }
      console.log(
        `[phase4] ${environment}/${fixture.id} sample ${
          samplesByScenario.get("post_login_dashboard").length
        }/${runs} complete`,
      );
      const pause = checkpointShouldPause();
      if (pause) {
        activePhase4Checkpoint.applyPause("pause_requested_after_completed_round");
        stopReason = "pause_requested";
        break;
      }
    }
    const completedCount = samplesByScenario.get("post_login_dashboard")?.length ?? 0;
    if (!stopReason && completedCount < runs) {
      stopReason =
        discardedAttempts.at(-1)?.reason ||
        `valid_sample_count_${completedCount}_below_${runs}`;
    }
    const scenarios = PHASE_4_SCENARIOS.map((scenario) =>
      summarizeCapturedScenario(
        samplesByScenario.get(scenario.scenarioId) ?? [],
        scenario,
      ),
    );
    const profile = {
      fixtureId: fixture.id,
      fixtureClass: fixture.fixtureClass,
      profileId: environment,
      runsPerScenario: runs,
      scenarios,
      groupKey,
      preparationStatus,
      attemptCount,
      maxAttempts,
      discardedAttemptCount: discardedAttempts.length,
      discardedAttempts,
      failedAttemptCount: failedAttempts.length,
      failedAttempts,
      preparationFailureCount: preparationFailures.length,
      preparationFailures,
      stoppedEarly: Boolean(stopReason),
      stopReason,
      status: scenarios.every(
        (scenario) =>
          scenario.sampleCount === runs && scenario.validityStatus === "PASS",
      )
        && preparationStatus === "PASS"
        ? "PASS"
        : stopReason === "pause_requested"
          ? "PAUSED"
        : "BLOCKED",
    };
    return {
      environment,
      status: profile.status,
      baseUrl: sanitizeRoute(baseUrl),
      targetOrigin,
      targetOriginVerified: true,
      cacheMode: "device_default",
      serviceWorkerMode: standaloneRequired
        ? "required_and_controlled"
        : "allow",
      profiler: "off",
      targetFocus,
      targetNavigation,
      profiles: [profile],
      connectionMonitoring: monitor?.evidence() ?? null,
    };
  } finally {
    if (browser) disconnectCdpBrowser(browser);
  }
}

async function runPhysicalAndroidBaselines(hostedConfigurationValue, runs) {
  if (hostedConfigurationValue?.status !== "READY") {
    const reason =
      hostedConfigurationValue?.reason ||
      "hosted_synthetic_account_or_url_not_provided";
    return {
      device: { status: "BLOCKED", reason },
      chrome: {
        environment: "android_chrome",
        status: "BLOCKED",
        reason,
      },
      pwa: {
        environment: "installed_android_pwa",
        status: "BLOCKED",
        reason,
      },
    };
  }
  const deviceRuntime = collectAndroidTarget({ includeRuntime: true });
  const runtime = deviceRuntime.runtime ?? null;
  const device = stripAndroidTargetRuntime(deviceRuntime);
  if (device.status !== "READY_FOR_CDP_CAPTURE") {
    return {
      device,
      chrome: {
        environment: "android_chrome",
        status: "BLOCKED",
        reason: device.reason,
      },
      pwa: {
        environment: "installed_android_pwa",
        status: "BLOCKED",
        reason: device.reason,
      },
    };
  }
  const fixture = {
    id: PHASE_4_FIXTURES.normal.id,
    fixtureClass: PHASE_4_FIXTURES.normal.fixtureClass,
    email: hostedConfigurationValue.email,
    password: hostedConfigurationValue.password,
  };
  let chrome = {
    environment: "android_chrome",
    status: "BLOCKED",
    reason: "not_run",
  };
  let pwa = {
    environment: "installed_android_pwa",
    status: "BLOCKED",
    reason: "not_run",
  };
  try {
    const chromeTargetLaunch = launchAndroidChromeTarget(
      device,
      runtime,
      hostedConfigurationValue.baseUrl,
    );
    if (chromeTargetLaunch.status !== "PASS") {
      chrome = {
        environment: "android_chrome",
        status: "BLOCKED",
        reason: chromeTargetLaunch.reason,
        targetLaunch: chromeTargetLaunch,
      };
      pwa = {
        environment: "installed_android_pwa",
        status: "BLOCKED",
        reason: "android_chrome_target_not_ready",
        independentLaunch: { status: "NOT_RUN" },
      };
      return {
        device: runtime?.monitor
          ? stripAndroidTargetRuntime({
              ...device,
              connectionMonitoring: runtime.monitor.evidence(),
            })
          : device,
        chrome,
        pwa,
      };
    }
    chrome = await runCdpBaseline(
      "android_chrome",
      hostedConfigurationValue.baseUrl,
      fixture,
      runs,
      false,
      runtime,
    );
    chrome.targetLaunch = chromeTargetLaunch;
    if (chrome.status !== "PASS") {
      pwa = {
        environment: "installed_android_pwa",
        status: "BLOCKED",
        reason: "android_chrome_baseline_blocked",
        independentLaunch: { status: "NOT_RUN" },
      };
    } else {
      const independentLaunch = launchInstalledPwa(device, runtime);
      pwa =
        independentLaunch.status === "PASS"
          ? await runCdpBaseline(
              "installed_android_pwa",
              hostedConfigurationValue.baseUrl,
              fixture,
              runs,
              true,
              runtime,
            )
          : {
              environment: "installed_android_pwa",
              status: "BLOCKED",
              reason: independentLaunch.reason,
            };
      pwa.independentLaunch = independentLaunch;
    }
  } catch {
    chrome = {
      environment: "android_chrome",
      status: "BLOCKED",
      reason: "cdp_capture_failed",
    };
    pwa = {
      environment: "installed_android_pwa",
      status: "BLOCKED",
      reason: "cdp_capture_failed",
    };
  }
  return {
    device: runtime?.monitor
      ? stripAndroidTargetRuntime({
          ...device,
          connectionMonitoring: runtime.monitor.evidence(),
        })
      : device,
    chrome,
    pwa,
  };
}

function profileHasValidBaseline(profile, runs) {
  return (
    profile?.status === "PASS" &&
    profile?.runsPerScenario === runs &&
    (profile?.scenarios ?? []).length === PHASE_4_SCENARIOS.length &&
    profile.scenarios.every(
      (scenario) =>
        scenario.sampleCount === runs && scenario.validityStatus === "PASS",
    )
  );
}

function environmentHasValidBaseline(environment, runs) {
  return (
    environment?.status === "PASS" &&
    environment?.stale !== true &&
    (environment?.profiles ?? []).length > 0 &&
    environment.profiles.every((profile) => profileHasValidBaseline(profile, runs))
  );
}

export function evaluatePhase4Closure({
  local,
  hosted,
  androidChrome,
  installedPwa,
  runs = PHASE_4_SAMPLE_COUNT,
}) {
  const localReady = environmentHasValidBaseline(local, runs);
  const hostedReady = environmentHasValidBaseline(hosted, runs);
  const androidReady = environmentHasValidBaseline(androidChrome, runs);
  const pwaReady = environmentHasValidBaseline(installedPwa, runs);
  const blockers = [];
  if (!localReady) blockers.push("local_authenticated_baseline_incomplete");
  if (!hostedReady) {
    blockers.push(hosted?.reason || "hosted_authenticated_baseline_incomplete");
  }
  if (!androidReady) {
    blockers.push(
      androidChrome?.reason || "physical_android_chrome_baseline_incomplete",
    );
  }
  if (!pwaReady) {
    blockers.push(
      installedPwa?.reason || "installed_android_pwa_baseline_incomplete",
    );
  }
  const allReady = localReady && hostedReady && androidReady && pwaReady;
  const reproduced = [local, hosted, androidChrome, installedPwa].some(
    (environment) =>
      (environment?.profiles ?? []).some((profile) =>
        (profile?.scenarios ?? []).some(
          (scenario) => scenario.freezeStatus === "REPRODUCED_CANDIDATE",
        ),
      ),
  );
  return {
    status: allReady ? "COMPLETE" : "BLOCKED",
    outcome: allReady
      ? reproduced
        ? "BASELINE_VALID_FREEZE_REPRODUCED"
        : "BASELINE_VALID_NOT_REPRODUCED"
      : "PERFORMANCE_BLOCKED",
    blockers: [...new Set(blockers)],
    validEnvironmentCount: [
      localReady,
      hostedReady,
      androidReady,
      pwaReady,
    ].filter(Boolean).length,
    requiredEnvironmentCount: 4,
    reproduced,
  };
}

export function sanitizePhase4Evidence(value, key = "", secretValues = []) {
  return sanitizeEvidence(value, key, [SYNTHETIC_PASSWORD, ...secretValues]);
}

function redactionCheck(evidence, secretValues = []) {
  return checkPhase4Redaction(evidence, [SYNTHETIC_PASSWORD, ...secretValues]);
}

export async function buildEvidence(options = {}) {
  phase4CheckpointMigration = null;
  activePhase4CycleId = null;
  const startedAt = new Date().toISOString();
  const git = collectGitEvidence();
  const phase2 = phase2Prerequisite();
  const phase3 = phase3Prerequisite();
  const phase3Evidence = readJson(phase3EvidencePath);
  let measurementIdentity = collectPhase4MeasurementIdentity({
    repoRoot,
    phase3Evidence,
  });
  const harnessContract = validatePhase2HarnessContract();
  const checkpointAdmission = openPhase4Checkpoint(
    measurementIdentity,
    harnessContract,
    options,
  );
  if (checkpointAdmission.action !== "RUN") {
    const error = new Error(
      checkpointAdmission.action === "STALE"
        ? "phase4_checkpoint_identity_changed_use_new_run_or_restart_scope"
        : "phase4_checkpoint_already_complete",
    );
    error.checkpoint = {
      action: checkpointAdmission.action,
      runId: checkpointAdmission.manifest?.runId ?? null,
      reason: checkpointAdmission.reason ?? null,
      status: checkpointAdmission.manifest?.status ?? null,
    };
    throw error;
  }
  activePhase4Checkpoint = checkpointAdmission.run;
  checkpointRecord("phase.admission", {
    resumed: checkpointAdmission.resumed === true,
    runId: activePhase4Checkpoint.runId,
    measurementIdentity: checkpointIdentitySummary(measurementIdentity),
    sameRunContinuation: checkpointAdmission.resumed === true,
  });
  try {
    bindPhase4RemeasurementCycle(options.cycleId ?? null);
  } catch (error) {
    checkpointRecord(
      "phase.cycle.remeasurement.blocked",
      {
        cycleId: options.cycleId ?? null,
        reason: error instanceof Error ? error.message : String(error),
        officialSamplesAdded: 0,
      },
      { status: "BLOCKED" },
    );
    throw error;
  }
  const localStatus = parseLocalSupabaseStatus();
  const runs = PHASE_4_SAMPLE_COUNT;
  const baseUrl = "http://127.0.0.1:" + PHASE_4_LOCAL_PORT;
  const hostedConfigurationBeforeGate = hostedConfiguration();
  const blockers = [];
  const stageLedger = [];
  const serverState = { server: null, output: [] };
  let build = null;
  let localRelease = null;
  let local = {
    environment: "local_desktop",
    status: "BLOCKED",
    reason: "local_preflight_not_complete",
  };
  let hosted = {
    environment: "owner_pc_hosted",
    status: "BLOCKED",
    reason: "stage_not_reached",
  };
  let android = {
    device: { status: "BLOCKED", reason: "stage_not_reached" },
    chrome: {
      environment: "android_chrome",
      status: "BLOCKED",
      reason: "stage_not_reached",
    },
    pwa: {
      environment: "installed_android_pwa",
      status: "BLOCKED",
      reason: "stage_not_reached",
    },
  };

  const readinessGateRun = runPhase4ReadinessGate();
  const hostedConfigurationAtGate = hostedConfiguration();
  const localStatusAtGate = parseLocalSupabaseStatus();
  const measurementIdentityAtGate = collectPhase4MeasurementIdentity({
    repoRoot,
    phase3Evidence,
  });
  const hostedInputsStableAtGate = hostedConfigurationsMatch(
    hostedConfigurationBeforeGate,
    hostedConfigurationAtGate,
  );
  const localInputsStableAtGate = localSupabaseInputsMatch(
    localStatus,
    localStatusAtGate,
  );
  let measurementStartGate = evaluatePhase4MeasurementStartGate({
    commandResult: readinessGateRun.command,
    readinessEvidence: readinessGateRun.evidence,
    measurementIdentityAtStart: measurementIdentityAtGate,
    hostedInputsStable: hostedInputsStableAtGate,
    localInputsStable: localInputsStableAtGate,
  });
  const hostedConfigurationValue = hostedConfigurationAtGate;
  const hostedPreflight = readinessHostedPreflight(readinessGateRun.evidence);

  const structuralPrerequisitesReady =
    phase2.harnessReady &&
    phase3.status === "COMPLETE" &&
    phase3.outcome === REQUIRED_PHASE3_OUTCOME &&
    phase3.fixtureReady &&
    phase3.authenticatedSessionReady &&
    localStatus.status === "PASS" &&
    harnessContract.status === "PASS" &&
    git.diffCheck === "PASS";
  const phase4PrerequisiteReady =
    structuralPrerequisitesReady && measurementStartGate.status === "PASS";
  if (!structuralPrerequisitesReady) {
    blockers.push("phase4_prerequisite_gate_failed");
  }
  if (measurementStartGate.status !== "PASS") {
    blockers.push(
      measurementStartGate.reason || "measurement_start_gate_failed",
    );
  }

  if (phase4PrerequisiteReady) {
    build = reuseReadinessBuild(
      readinessGateRun.evidence,
      localStatus,
      baseUrl,
      measurementStartGate.readiness.runId,
    );
    if (!build) {
      blockers.push("readiness_local_build_evidence_missing");
    } else {
      measurementIdentity = collectPhase4MeasurementIdentity({
        repoRoot,
        phase3Evidence,
      });
      const hostedConfigurationAtMeasurementStart = hostedConfiguration();
      const localStatusAtMeasurementStart = parseLocalSupabaseStatus();
      measurementStartGate = evaluatePhase4MeasurementStartGate({
        commandResult: readinessGateRun.command,
        readinessEvidence: readinessGateRun.evidence,
        measurementIdentityAtStart: measurementIdentity,
        hostedInputsStable:
          hostedInputsStableAtGate &&
          hostedConfigurationsMatch(
            hostedConfigurationValue,
            hostedConfigurationAtMeasurementStart,
          ),
        localInputsStable:
          localInputsStableAtGate &&
          localSupabaseInputsMatch(localStatus, localStatusAtMeasurementStart),
      });
      if (measurementStartGate.status !== "PASS") {
        blockers.push(
          measurementStartGate.reason || "measurement_start_gate_failed",
        );
      } else {
        const started = startLocalServer(build.env, PHASE_4_LOCAL_PORT);
        serverState.server = started.server;
        serverState.output = started.output;
        try {
          await waitForServer(serverState.server, baseUrl, serverState.output);
          localRelease = await collectReleaseIdentity(baseUrl);
          if (!releaseIdentityIsHealthy(localRelease)) {
            blockers.push("local_release_health_failed");
          }
        } catch {
          blockers.push("local_production_server_failed");
        }
      }
    }
  }

  const stage41Complete =
    phase4PrerequisiteReady &&
    measurementStartGate.status === "PASS" &&
    build?.result.status === 0 &&
    releaseIdentityIsHealthy(localRelease) &&
    serverState.server?.exitCode == null;
  stageLedger.push({
    stageId: "4.1",
    name: "Prerequisite, identity, build, and local target gate",
    status: stage41Complete ? "COMPLETE" : "BLOCKED",
    prerequisiteEvidence: {
      phase2,
      phase3,
      harnessContract,
      hostedPreflight,
      measurementStartGate,
    },
    performedActions: [
      "Checked Phase 2 harness and Phase 3 synthetic auth/store evidence",
      "Verified the local Supabase URL and credential availability without recording credentials",
      "Executed the readiness command with the same repository runtime hosted.env source and local measurement inputs before stage 4.1",
      "Required the readiness evidence to prove health, real password-login, shell-bootstrap, physical Android Chrome, installed PWA, H1-H4 order, and baselineStarted=false",
      "Reused the readiness-created local production build only after source, fixture, migration, and build artifact identity matched at measurement start",
      "Started the production server on the local measurement process and read its release identity",
    ],
    verificationResults: {
      git,
      localTarget: {
        status: localStatus.status,
        apiUrl: localStatus.apiUrl,
        urlIsLocal: localStatus.urlIsLocal,
      },
      build: build?.result ?? { status: "NOT_RUN" },
      buildReuse: build
        ? {
            reusedFromReadiness: build.reusedFromReadiness === true,
            readinessRunId: build.readinessRunId ?? null,
          }
        : null,
      localRelease,
      hostedInput: hostedConfigurationSummary(hostedConfigurationValue),
      hostedPreflight,
      measurementStartGate,
      productionDecision: "NO-GO",
    },
    outputEvidence: [
      "sourceIdentity",
      "localTarget",
      "localRelease",
      "build",
      "measurementStartGate",
    ],
    blockingReason: stage41Complete ? null : blockers.at(-1) || "phase4_prerequisite_gate_failed",
  });
  checkpointRecord("phase.stage", {
    stageId: "4.1",
    status: stage41Complete ? "COMPLETE" : "BLOCKED",
    blockingReason: stage41Complete
      ? null
      : blockers.at(-1) || "phase4_prerequisite_gate_failed",
  });

  try {
    if (stage41Complete) {
      try {
        local = await runLocalDesktopBaseline(baseUrl, localStatus, runs);
      } catch {
        local = {
          environment: "local_desktop",
          status: "BLOCKED",
          reason: "local_browser_baseline_failed",
        };
      }
    }
    const localComplete = local.status === "PASS";
    const localBlockingReason = localComplete
      ? null
      : local.reason || "local_authenticated_baseline_incomplete";
    if (localBlockingReason) blockers.push(localBlockingReason);
    stageLedger.push({
      stageId: "4.2",
      name: "Local desktop authenticated matched baseline",
      status: localComplete ? "COMPLETE" : "BLOCKED",
      prerequisiteEvidence: ["4.1", "local Phase 3 fixture", "real password session"],
      performedActions: [
        "Submitted the customer login form with local owner accounts",
        "Kept fallback store and demo cookie disabled",
        "Measured cold login and eight warm same-context click journeys",
        "Attempted the locked " + runs + " samples per scenario for each local fixture profile; incomplete profiles remain blocked",
      ],
      verificationResults: local,
      outputEvidence: [
        "localDesktopBaseline",
        "scenarioSummaries",
        "requestTimings",
        "paintMetrics",
      ],
      blockingReason: localBlockingReason,
    });
    checkpointRecord("phase.stage", {
      stageId: "4.2",
      status: localComplete ? "COMPLETE" : "BLOCKED",
      blockingReason: localBlockingReason,
    });

    if (localComplete) {
      hosted = await runHostedBaseline(runs, hostedConfigurationValue);
      if (hosted.status !== "PASS") {
        blockers.push(hosted.reason || "hosted_authenticated_baseline_incomplete");
      }
      stageLedger.push({
        stageId: "4.3",
        name: "Owner-PC hosted authenticated matched baseline",
        status: hosted.status === "PASS" ? "COMPLETE" : "BLOCKED",
        prerequisiteEvidence: [
          "4.2",
          "owner-approved hosted synthetic URL and account",
        ],
        performedActions: [
          "Accepted hosted measurement only through explicit AIYA_PHASE4_HOSTED_* variables",
          "Rejected customer/admin production domains and did not create an account or fixture",
          "Used the same nine scenarios and sample count when the hosted prerequisite existed",
        ],
        verificationResults: hosted,
        outputEvidence: ["hostedBaseline", "scenarioSummaries"],
        blockingReason: hosted.status === "PASS" ? null : hosted.reason,
      });
      checkpointRecord("phase.stage", {
        stageId: "4.3",
        status: hosted.status === "PASS" ? "COMPLETE" : "BLOCKED",
        blockingReason: hosted.status === "PASS" ? null : hosted.reason,
      });

      if (hosted.status === "PASS") {
        android = await runPhysicalAndroidBaselines(hostedConfigurationValue, runs);
        if (android.chrome.status !== "PASS") {
          blockers.push(
            android.chrome.reason || "physical_android_chrome_baseline_incomplete",
          );
        }
        if (android.pwa.status !== "PASS") {
          blockers.push(
            android.pwa.reason || "installed_android_pwa_baseline_incomplete",
          );
        }
        stageLedger.push({
          stageId: "4.4",
          name: "Physical Android Chrome and installed PWA matched baseline",
          status:
            android.chrome.status === "PASS" && android.pwa.status === "PASS"
              ? "COMPLETE"
              : "BLOCKED",
          prerequisiteEvidence: [
            "4.3",
            "physical Android device",
            "ADB/CDP target",
            "installed PWA target",
          ],
          performedActions: [
            "Checked ADB device presence without recording its serial number",
            "Used CDP only for a physical Chrome target",
            "Required standalone display-mode and service-worker control for PWA",
            "Rejected browser emulation as physical-device evidence",
          ],
          verificationResults: android,
          outputEvidence: [
            "deviceIdentity",
            "androidChromeBaseline",
            "installedPwaBaseline",
          ],
          blockingReason:
            android.chrome.status === "PASS" && android.pwa.status === "PASS"
              ? null
              : android.chrome.reason || android.pwa.reason,
        });
        checkpointRecord("phase.stage", {
          stageId: "4.4",
          status:
            android.chrome.status === "PASS" && android.pwa.status === "PASS"
              ? "COMPLETE"
              : "BLOCKED",
          blockingReason:
            android.chrome.status === "PASS" && android.pwa.status === "PASS"
              ? null
              : android.chrome.reason || android.pwa.reason,
        });
      } else {
        android = {
          device: { status: "BLOCKED", reason: "stage_4_3_blocked" },
          chrome: {
            environment: "android_chrome",
            status: "BLOCKED",
            reason: "stage_4_3_blocked",
          },
          pwa: {
            environment: "installed_android_pwa",
            status: "BLOCKED",
            reason: "stage_4_3_blocked",
          },
        };
        stageLedger.push({
          stageId: "4.4",
          name: "Physical Android Chrome and installed PWA matched baseline",
          status: "BLOCKED",
          prerequisiteEvidence: ["4.3"],
          performedActions: [
            "Did not start because the preceding hosted baseline stage was blocked",
          ],
          verificationResults: android,
          outputEvidence: [
            "deviceIdentity",
            "androidChromeBaseline",
            "installedPwaBaseline",
          ],
          blockingReason: "stage_4_3_blocked",
        });
        checkpointRecord("phase.stage", {
          stageId: "4.4",
          status: "BLOCKED",
          blockingReason: "stage_4_3_blocked",
        });
      }
    } else {
      hosted = {
        environment: "owner_pc_hosted",
        status: "BLOCKED",
        reason: "stage_4_2_blocked",
      };
      android = {
        device: { status: "BLOCKED", reason: "stage_4_2_blocked" },
        chrome: {
          environment: "android_chrome",
          status: "BLOCKED",
          reason: "stage_4_2_blocked",
        },
        pwa: {
          environment: "installed_android_pwa",
          status: "BLOCKED",
          reason: "stage_4_2_blocked",
        },
      };
      stageLedger.push({
        stageId: "4.3",
        name: "Owner-PC hosted authenticated matched baseline",
        status: "BLOCKED",
        prerequisiteEvidence: ["4.2"],
        performedActions: ["Did not start because the local baseline stage was blocked"],
        verificationResults: hosted,
        outputEvidence: ["hostedBaseline"],
        blockingReason: "stage_4_2_blocked",
      });
      stageLedger.push({
        stageId: "4.4",
        name: "Physical Android Chrome and installed PWA matched baseline",
        status: "BLOCKED",
        prerequisiteEvidence: ["4.3"],
        performedActions: ["Did not start because an earlier stage was blocked"],
        verificationResults: android,
        outputEvidence: [
          "deviceIdentity",
          "androidChromeBaseline",
          "installedPwaBaseline",
        ],
        blockingReason: "stage_4_3_blocked",
      });
      checkpointRecord("phase.stage", {
        stageId: "4.3",
        status: "BLOCKED",
        blockingReason: "stage_4_2_blocked",
      });
      checkpointRecord("phase.stage", {
        stageId: "4.4",
        status: "BLOCKED",
        blockingReason: "stage_4_3_blocked",
      });
    }
  } finally {
    stopLocalServer(serverState.server);
  }

  const closure = evaluatePhase4Closure({
    local,
    hosted,
    androidChrome: android.chrome,
    installedPwa: android.pwa,
    runs,
  });
  blockers.push(...closure.blockers);
  const stage45Complete = closure.status === "COMPLETE";
  stageLedger.push({
    stageId: "4.5",
    name: "Ordered Phase 4 closure and next-step gate",
    status: stage45Complete ? "COMPLETE" : "BLOCKED",
    prerequisiteEvidence: ["4.1", "4.2", "4.3", "4.4"],
    performedActions: [
      "Checked that every required environment has a valid authenticated baseline",
      "Checked that every scenario has the locked twenty usable samples",
      "Separated reproduction candidates from invalid, blocked, or unreproduced evidence",
      "Kept the production decision NO-GO and rejected any automatic Phase 5 or runtime change",
    ],
    verificationResults: {
      closure,
      productionDecision: "NO-GO",
      nextEligibleAction: stage45Complete
        ? "Plan 1 Phase 5 - layer-by-layer controlled causal experiments"
        : "Resolve blocked Phase 4 prerequisites/environments and rerun Phase 4 from stage 4.1",
    },
    outputEvidence: ["closure", "nextEligibleAction"],
    blockingReason: stage45Complete ? null : closure.blockers[0] || "phase4_closure_blocked",
  });
  checkpointRecord("phase.stage", {
    stageId: "4.5",
    status: stage45Complete ? "COMPLETE" : "BLOCKED",
    blockingReason: stage45Complete
      ? null
      : closure.blockers[0] || "phase4_closure_blocked",
  });
  let phaseCycleTransition = null;
  if (activePhase4CycleId) {
    const nextCycleState = stage45Complete ? "COMPLETE" : "DIAGNOSE";
    const reason = stage45Complete
      ? "phase4_ordered_closure_complete"
      : closure.blockers[0] || "phase4_remeasurement_requires_next_diagnosis";
    transitionPhaseCycle(activePhase4Checkpoint, {
      cycleId: activePhase4CycleId,
      state: nextCycleState,
      reason,
      evidenceRefs: ["docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json"],
      details: {
        officialMeasurementExecuted: true,
        validEnvironmentCount: closure.validEnvironmentCount,
        requiredEnvironmentCount: closure.requiredEnvironmentCount,
      },
    });
    phaseCycleTransition = { cycleId: activePhase4CycleId, state: nextCycleState, reason };
  }
  const evidence = {
    phase: "AIya Performance Plan 1 - Phase 4 Valid Baseline and Freeze Reproduction",
    schemaVersion: "aiya-performance-plan1-phase4-v1",
    runId: currentPhase4RunId(),
    generatedAt: new Date().toISOString(),
    startedAt,
    status: closure.status,
    outcome: closure.outcome,
    productionDecision: "NO-GO",
    sourceIdentity: git,
    measurementIdentity,
    measurementStartGate,
    phaseCycleId: activePhase4CycleId,
    phaseCycles: [],
    phaseCycleTransition,
    checkpoint: {
      phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
      schemaVersion: PHASE_4_CHECKPOINT_SCHEMA_VERSION,
      runId: currentPhase4RunId(),
      resumed: checkpointAdmission.resumed === true,
      eventCount: activePhase4Checkpoint?.eventCount ?? null,
      storage: ".manu-runtime/phase-execution/<phaseId>/<runId>",
      committedRoundPolicy: "one_atomic_event_per_fixture_profile_round",
      preparationRoundPolicy: "one_uncounted_full_round_per_browser_session",
      migration:
        phase4CheckpointMigration ??
        activePhase4Checkpoint?.eventsOf("run.migrated")[0]?.payload ??
        null,
    },
    phase2Prerequisite: phase2,
    phase3Prerequisite: phase3,
    localTarget: {
      apiUrl: localStatus.apiUrl ?? null,
      urlIsLocal: localStatus.urlIsLocal === true,
      credentialsRecorded: false,
      databaseReset: false,
      remoteMigration: false,
    },
    releaseIdentity: {
      local: localRelease,
      hosted: hosted.releaseIdentity ?? null,
      liveReleaseRead: "NOT_REQUIRED_FOR_AUTHENTICATED_BASELINE",
    },
    harnessContract: {
      ...PHASE_2_HARNESS_CONTRACT,
      warmSetupMode: PHASE_4_WARM_SETUP_MODE,
      phase2BudgetContract: PHASE_2_BUDGETS,
      scenarioContract: PHASE_4_SCENARIOS,
      scenarioContractSource: "Phase 2 scenario ids and current-code read reconciliation",
      currentCodeReconciliation: [
        {
          scenarioId: "client_roster",
          decision: "kept only /api/shell/bootstrap for Phase 4 warm roster navigation",
          evidence: "DashboardApp renders the roster from the already-hydrated useAiyaState snapshot; clicking the roster destination refreshes shell bootstrap but does not require a new /api/app-state read in the action window, and /api/clients is mutation-only in the current path",
        },
        {
          scenarioId: "client_forms_workspace",
          decision: "kept only the forms domain read",
          evidence: "Selecting the task can abort the preceding summary /api/clients/:id request; the target workspace loads /api/clients/:clientId/forms",
        },
        {
          scenarioId: "nutrition_workspace",
          decision: "kept only the nutrition domain read",
          evidence: "Selecting the task can abort the preceding summary /api/clients/:id request; the target workspace loads /api/clients/:clientId/food-rule-profile",
        },
        {
          scenarioId: "menu_workspace",
          decision: "kept only the menu domain read",
          evidence: "Selecting the task can abort the preceding summary /api/clients/:id request; the target workspace loads /api/clients/:clientId/menu-plans",
        },
      ],
      validation: harnessContract,
    },
    environments: {
      localDesktop: local,
      ownerPcHosted: hosted,
      androidChrome: android.chrome,
      installedAndroidPwa: android.pwa,
    },
    runtimeDiagnostics: collectServerDiagnostics(serverState.output),
    deviceIdentity: android.device,
    stageLedger,
    closure: {
      ...closure,
      blockers: [...new Set(closure.blockers)],
    },
    blockers: [...new Set(blockers)],
    constraints: {
      fallbackStore: "DISABLED",
      demoCookie: "NOT_USED",
      hostedAccountCreation: "TEST_HOSTED_SYNTHETIC_ACCOUNT_CREATED",
      hostedFixtureSeed: "TEST_HOSTED_SANDBOX_ONLY",
      productionDomainMeasurement: "REJECTED",
      productionDeploy: "NOT_EXECUTED",
      remoteMigration: "PRODUCTION_NOT_EXECUTED",
      schemaMigration: "LOCAL_AND_TEST_HOSTED_SANDBOX_ONLY",
      schemaMigrationFile: PHASE_4_LOCAL_SCHEMA_MIGRATION_FILE,
      schemaMigrationScope: "NON_PRODUCTION_MEASUREMENT_ENVIRONMENTS_ONLY",
      dependencyChange: "NO_REPO_DEPENDENCY_CHANGE_TEST_HOSTED_PLATFORM_PACKAGE_ONLY",
      runtimeChange: "NO_APPLICATION_RUNTIME_CHANGE",
      providerEgress: "NOT_EXECUTED",
      channelTraffic: "NOT_EXECUTED",
      rawPayloadBody: "NOT_RECORDED",
      headersCookiesTokens: "NOT_RECORDED",
      promptsClinicalData: "NOT_RECORDED",
      deviceSerial: "NOT_RECORDED",
      readinessGate: "REQUIRED_BEFORE_STAGE_4_1",
      readinessEvidencePath: "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json",
      baselineStartPolicy:
        "NO_LOCAL_SERVER_OR_20_SAMPLE_MEASUREMENT_UNLESS_READINESS_GATE_PASS",
      productionDecision: "NO-GO",
    },
    nextEligibleAction:
      closure.status === "COMPLETE"
        ? "Plan 1 Phase 5 - layer-by-layer controlled causal experiments; no runtime optimization is authorized."
        : "Resolve the blocked Phase 4 prerequisites/environments and rerun Phase 4 from stage 4.1; do not start Phase 5.",
  };
  const hostedSecret = hostedConfigurationValue.password;
  const redaction = redactionCheck(evidence, [hostedSecret]);
  evidence.evidenceIntegrity = {
    redaction,
    diffCheck: git.diffCheck,
    status: git.diffCheck === "PASS" && redaction.status ? "PASS" : "FAIL",
  };
  const checkpointStatus =
    activePhase4Checkpoint?.status === "PAUSED"
      ? "PAUSED"
      : stage45Complete
        ? "COMPLETE"
        : "BLOCKED";
  activePhase4Checkpoint?.markStatus(checkpointStatus, {
    phaseStatus: evidence.status,
    outcome: evidence.outcome,
    blockerCount: evidence.blockers.length,
  });
  evidence.checkpoint.eventCount = activePhase4Checkpoint?.eventCount ?? null;
  evidence.phaseCycles = phase4CycleEvidence();
  const sanitizedEvidence = sanitizePhase4Evidence(evidence, "", [hostedSecret]);
  activePhase4Checkpoint?.close();
  activePhase4Checkpoint = null;
  activePhase4CycleId = null;
  return sanitizedEvidence;
}

async function main() {
  if (process.argv.includes("--diagnose-session-activity")) {
    const diagnostic = await runSessionActivityDiagnostic();
    console.log(JSON.stringify(diagnostic, null, 2));
    if (diagnostic.status !== "COMPLETE") process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--status")) {
    console.log(
      JSON.stringify(
        inspectPhaseRuns({
          root: PHASE_4_CHECKPOINT_ROOT,
          phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (process.argv.includes("--migrate-compatible")) {
    const migrationIndex = process.argv.indexOf("--migrate-compatible");
    const sourceRunId = process.argv[migrationIndex + 1];
    const phase3Evidence = readJson(phase3EvidencePath);
    const measurementIdentity = collectPhase4MeasurementIdentity({
      repoRoot,
      phase3Evidence,
    });
    const harnessContract = validatePhase2HarnessContract();
    const migration = migrateCompatiblePhase4Checkpoint(
      sourceRunId,
      measurementIdentity,
      harnessContract,
    );
    console.log(JSON.stringify(migration, null, 2));
    return;
  }

  if (process.argv.includes("--pause")) {
    const requestedRunId = process.argv[process.argv.indexOf("--pause") + 1];
    const runs = inspectPhaseRuns({
      root: PHASE_4_CHECKPOINT_ROOT,
      phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
    });
    const selectedRunId =
      requestedRunId && !requestedRunId.startsWith("--")
        ? requestedRunId
        : runs
            .filter((run) => run.status !== "COMPLETE")
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]
            ?.runId;
    if (!selectedRunId) throw new Error("phase4_checkpoint_run_not_found");
    requestPhaseRunPause({
      root: PHASE_4_CHECKPOINT_ROOT,
      phaseId: PHASE_4_CHECKPOINT_PHASE_ID,
      runId: selectedRunId,
      reason: "user_requested",
    });
    console.log(`pause requested for ${selectedRunId}`);
    return;
  }

  const resumeIndex = process.argv.indexOf("--resume");
  const resumeArgument = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
  const cycleIndex = process.argv.indexOf("--cycle");
  const cycleArgument = cycleIndex >= 0 ? process.argv[cycleIndex + 1] : null;
  const options = {
    newRun: process.argv.includes("--new-run"),
    runId:
      resumeArgument && !resumeArgument.startsWith("--")
        ? resumeArgument
        : null,
    cycleId:
      cycleArgument && !cycleArgument.startsWith("--")
        ? cycleArgument
        : null,
  };
  try {
    const evidence = await buildEvidence(options);
    writeCanonicalPhase4Evidence(evidence);
    console.log(
      "wrote " + relative(repoRoot, evidencePath).replaceAll("\\", "/"),
    );
    console.log("status " + evidence.status);
    console.log("outcome " + evidence.outcome);
    console.log(
      "validEnvironments " +
        evidence.closure.validEnvironmentCount +
        "/" +
        evidence.closure.requiredEnvironmentCount,
    );
    console.log("checkpointRunId " + evidence.checkpoint.runId);
    console.log("checkpointResumed " + evidence.checkpoint.resumed);
    console.log("blockers " + (evidence.blockers.join(",") || "none"));
    if (evidence.status !== "COMPLETE") process.exitCode = 1;
  } finally {
    activePhase4Checkpoint?.close();
    activePhase4Checkpoint = null;
    activePhase4CycleId = null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error?.checkpoint) {
      console.error(
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            checkpoint: error.checkpoint,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  });
}
