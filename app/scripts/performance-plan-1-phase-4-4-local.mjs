/**
 * AIya Performance Plan 1 - Phase 4.4 local authenticated reproduction.
 *
 * This runner is intentionally separate from the official nine-scenario
 * baseline and from the Phase 4.3 descriptor. It records the three broad
 * interaction journeys against the local normal fixture only.
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
  PHASE_4_3_CLICK_TIMEOUT_MS,
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_REQUEST_BODY_FINISH_TIMEOUT_MS,
  PHASE_4_3_READY_TIMEOUT_MS,
  PHASE_4_3_REQUIRED_TIMING_FIELDS,
  PHASE_4_3_SECOND_ACTION_DELAY_MS,
  matchesRequiredPattern,
  routeMatchesExpectedRoute,
  runDiagnosticJourney,
  sanitizeRoute,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");
const DEFAULT_MAIN_CHECKOUT_ROOT =
  "C:\\Users\\Dell\\OneDrive\\Masaüstü\\MANU-AI";
const PHASE_4_4_DEFAULT_SYNTHETIC_EMAIL =
  "aiya-phase3-local-normal-owner@manu.local";
const PHASE_4_4_DEFAULT_SYNTHETIC_PASSWORD = "AiyaPhase3LocalOnly!";
const PHASE_4_4_RECORDED_ENV_KEYS = Object.freeze([
  "NEXT_PUBLIC_APP_URL",
  "MANU_ADMIN_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "MANU_DEV_FALLBACK_STORE",
  "MANU_ALLOW_PUBLIC_DEMO_LOGIN",
  "AI_CHAT_UI_ENABLED",
  "AIYA_PERF_FOOD_RULE_PROFILE_READ_POLICY",
  "NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY",
]);

export const PHASE_4_4_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase4-4-local-v3";
export const PHASE_4_4_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-4-local-v3";
export const PHASE_4_4_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PHASE_4_4_PLAN_REVISION = "plan1-final-v3";
export const PHASE_4_4_FIXTURE_ID = "local-normal";
export const PHASE_4_4_REPETITION_COUNT = 3;
export const PHASE_4_4_DEFAULT_BASE_URL = "http://127.0.0.1:3136";
export const PHASE_4_4_SUPABASE_URL = "http://127.0.0.1:54321";
export const PHASE_4_4_EVIDENCE_PATH = join(
  repoRoot,
  "docs",
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_4_EVIDENCE.json",
);
export const PHASE_4_4_EXECUTION_MODES = Object.freeze({
  targetedCaptureProbe: "targeted_capture_probe",
  localNormalObservations: "local_normal_observations",
  diagnosticObservations: "diagnostic_observations",
});

export function phase44V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase44_v3_run_id_invalid");
  }
  return join(
    repoRoot,
    "docs",
    "AIYA_PERFORMANCE_PLAN_1_V3_" + safeRunId + "_EVIDENCE.json",
  );
}

const PHASE_4_4_REFERENCE_SNAPSHOT_ID =
  "phase4-3-reference-snapshot-20260916T194917770Z";
const PHASE_4_4_PARENT_RUN_REFERENCES = Object.freeze([
  "aiya-performance-plan1-phase4-4-local-20260916T232938491Z-c7e89cae-3ff5-4595-ac8f-ed5c3ff9923d",
]);
const PHASE_4_4_REFERENCE_MANIFEST_PATH = join(
  repoRoot,
  ".manu-runtime",
  "phase4-3",
  "reference-snapshot-20260916T194917770Z-manifest.json",
);
const PHASE_4_4_ALLOWED_HTTP_STATUS_MAX = 499;
const PHASE_4_4_PROBE_TIMEOUT_MS = 5_000;
const PHASE_4_4_SERVER_READY_TIMEOUT_MS = 90_000;
const PHASE_4_4_SERVER_STOP_TIMEOUT_MS = 10_000;
const PHASE_4_4_REQUEST_BODY_FINISH_TIMEOUT_MS = 15_000;

export const PHASE_4_4_REQUIRED_CAPTURE_FIELDS = Object.freeze([
  "overlappingRequests",
  "requestCount",
  "requestStatus",
  "bodySizeBytes",
  "authSessionTiming",
  "serverStoreTiming",
  "browserParseRenderTiming",
  "longTasks",
  "failureBoundary",
  "observationValidity",
  "functionalOutcome",
  "performanceOutcome",
]);
export const PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES = Object.freeze([
  "/api/shell/preferences",
]);
export const PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES = Object.freeze([
  "/api/session/activity",
]);

const PHASE_4_4_NO_REQUIRED_READ_TIMING_FIELDS = new Set([
  "requiredRequestStartAtMs",
  "responseHeaderAtMs",
  "responseBodyFinishedAtMs",
]);

export const PHASE_4_4_STAGE_LEDGER = Object.freeze([
  Object.freeze({
    stageId: "4.4.1",
    name: "Local normal fixture and authenticated path preflight",
    prerequisites: ["4.3 COMPLETE"],
  }),
  Object.freeze({
    stageId: "4.4.2",
    name: "Targeted capture verification and one local J1 observation",
    prerequisites: ["4.4.1 PASS"],
  }),
  Object.freeze({
    stageId: "4.4.3",
    name: "Scoped local observations after trustworthy capture",
    prerequisites: ["4.4.2 PASS"],
  }),
  Object.freeze({
    stageId: "4.4.4",
    name: "Trace integrity and failure-boundary reconciliation",
    prerequisites: ["4.4.3 COMPLETE"],
  }),
]);

export const PHASE_4_4_MODES = Object.freeze({
  normal: Object.freeze({
    id: "normal",
    profiler: "off",
    browserObservers: "off",
    serverTiming: "off",
    serverEnvironmentPatch: Object.freeze({ AIYA_PERF_DIAGNOSTIC: "0" }),
  }),
  diagnostic: Object.freeze({
    id: "diagnostic",
    profiler: "on",
    browserObservers: "on",
    serverTiming: "on",
    serverEnvironmentPatch: Object.freeze({ AIYA_PERF_DIAGNOSTIC: "1" }),
  }),
});

const PHASE_4_4_SENSITIVE_KEY_RE =
  /(?:password|token|secret|authorization|cookie|email|phone|prompt|payload|clinical|credential|private.?key|api.?key)/i;
const PHASE_4_4_RAW_BODY_KEY_RE = /^(?:body|requestbody|responsebody|rawbody)$/i;

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const numeric = finiteNumber(value);
  return numeric == null ? null : Math.max(0, Math.round(numeric * 100) / 100);
}

function safeErrorClass(error) {
  return String(error?.name || "Error").slice(0, 120);
}

function isEmail(value) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(String(value));
}

function sanitizeString(value, key) {
  if (PHASE_4_4_SENSITIVE_KEY_RE.test(String(key))) return "<redacted>";
  if (isEmail(value)) return "<redacted-email>";
  if (["baseUrl", "targetOrigin", "supabaseTarget", "origin"].includes(key)) {
    try {
      const parsed = new URL(String(value));
      return parsed.origin;
    } catch {
      return "<invalid-origin>";
    }
  }
  if (/^https?:\/\//i.test(String(value)) || /^\//.test(String(value))) {
    return sanitizeRoute(value);
  }
  const stringValue = String(value);
  return stringValue.length > 400
    ? `${stringValue.slice(0, 400)}<truncated>`
    : stringValue;
}

export function sanitizePhase44Evidence(value, key = "") {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return sanitizeString(value, key);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePhase44Evidence(item, key));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        PHASE_4_4_SENSITIVE_KEY_RE.test(childKey) || PHASE_4_4_RAW_BODY_KEY_RE.test(childKey)
          ? "<redacted>"
          : sanitizePhase44Evidence(childValue, childKey),
      ]),
    );
  }
  return "<unsupported>";
}

function parsePhase44EnvFile(path) {
  if (!existsSync(path)) return {};
  const parsed = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const assignment = line.replace(/^export\s+/, "");
    const separator = assignment.indexOf("=");
    if (separator <= 0) continue;
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = assignment.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function readPhase3FixtureReady() {
  const path = join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json");
  if (!existsSync(path)) return false;
  try {
    const evidence = JSON.parse(readFileSync(path, "utf8"));
    return Boolean(
      evidence.status === "COMPLETE" &&
        evidence.outcome === "SYNTHETIC_AUTH_STORE_READY" &&
        evidence.finalControls?.fixtureReady === true &&
        evidence.finalControls?.authenticatedSessionReady === true,
    );
  } catch {
    return false;
  }
}

function configurationSourceLabel(path, activeEnvPath, mainEnvPath) {
  if (path === activeEnvPath) return "active_worktree_app_env_local";
  if (path === mainEnvPath) return "main_checkout_app_env_local";
  return "process_environment";
}

export function resolvePhase44LocalConfiguration({
  processEnvironment = process.env,
  activeEnvPath = join(appRoot, ".env.local"),
  mainCheckoutRoot = process.env.AIYA_MAIN_CHECKOUT_ROOT || DEFAULT_MAIN_CHECKOUT_ROOT,
} = {}) {
  const mainEnvPath = join(resolve(mainCheckoutRoot), "app", ".env.local");
  const merged = { ...processEnvironment };
  const sourceFiles = [];
  const sourcePaths = [activeEnvPath, mainEnvPath].filter(
    (path, index, paths) => paths.indexOf(path) === index,
  );
  for (const path of sourcePaths) {
    const entries = parsePhase44EnvFile(path);
    if (!Object.keys(entries).length) continue;
    sourceFiles.push({
      source: configurationSourceLabel(path, activeEnvPath, mainEnvPath),
      present: true,
      keys: Object.keys(entries)
        .filter((key) => PHASE_4_4_RECORDED_ENV_KEYS.includes(key))
        .sort(),
    });
    for (const [key, value] of Object.entries(entries)) {
      if (!String(merged[key] ?? "").trim()) merged[key] = value;
    }
  }
  const fixtureReady = readPhase3FixtureReady();
  const email =
    String(merged.MANU_PHASE3_SYNTHETIC_EMAIL ?? "").trim() ||
    (fixtureReady ? PHASE_4_4_DEFAULT_SYNTHETIC_EMAIL : null);
  const password =
    String(merged.MANU_PHASE3_SYNTHETIC_PASSWORD ?? "").trim() ||
    (fixtureReady ? PHASE_4_4_DEFAULT_SYNTHETIC_PASSWORD : null);
  const availableKeys = PHASE_4_4_RECORDED_ENV_KEYS.filter((key) =>
    Boolean(String(merged[key] ?? "").trim()),
  );
  const credentialSource =
    merged.MANU_PHASE3_SYNTHETIC_EMAIL && merged.MANU_PHASE3_SYNTHETIC_PASSWORD
      ? "environment"
      : fixtureReady
        ? "phase3_deterministic_fixture"
        : "unavailable";
  const sourceKinds = sourceFiles.map((source) => source.source);
  return {
    environment: merged,
    email,
    password,
    summary: {
      sourceKinds,
      activeEnvFilePresent: sourceKinds.includes("active_worktree_app_env_local"),
      mainCheckoutEnvFilePresent: sourceKinds.includes("main_checkout_app_env_local"),
      availableKeys,
      credentialSource,
      credentialsAvailable: {
        email: Boolean(email),
        password: Boolean(password),
      },
      phase3FixtureReady: fixtureReady,
      sourceFiles: sourceFiles.map(({ source, present, keys }) => ({ source, present, keys })),
    },
    identity: {
      sourceKinds,
      availableKeys,
      credentialSource,
      phase3FixtureReady: fixtureReady,
    },
  };
}

export function buildPhase44ServerEnvironment(environment, mode, {
  baseUrl = PHASE_4_4_DEFAULT_BASE_URL,
  localStatus = {},
} = {}) {
  const modeContract = PHASE_4_4_MODES[mode];
  if (!modeContract) throw new Error("phase44_mode_invalid");
  return {
    ...environment,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: baseUrl,
    MANU_ADMIN_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
    SUPABASE_URL: localStatus.apiUrl,
    SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
    MANU_DEV_FALLBACK_STORE: "false",
    MANU_ALLOW_PUBLIC_DEMO_LOGIN: "false",
    AI_CHAT_UI_ENABLED: "true",
    ...modeContract.serverEnvironmentPatch,
  };
}

function fileHash(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

function phase44HarnessSourceIdentity() {
  return [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4.mjs",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.test.mjs",
  ].map((path) => ({ path, sha256: fileHash(join(repoRoot, path)) }));
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getSourceIdentity(configurationIdentity = null) {
  const statusOutput = gitOutput(["status", "--short"]) ?? "";
  const statusLines = statusOutput ? statusOutput.split(/\r?\n/).filter(Boolean) : [];
  const remoteOutput = gitOutput([
    "ls-remote",
    "--symref",
    "origin",
    "HEAD",
    "refs/heads/codex/production-readiness-stage-1",
  ]) ?? "";
  const remoteLines = remoteOutput.split(/\r?\n/).filter(Boolean);
  const symref = remoteLines.find((line) => line.startsWith("ref: ")) ?? null;
  const headLine = remoteLines.find((line) => /^[0-9a-f]{40}\s+HEAD$/.test(line));
  const readinessLine = remoteLines.find((line) => line.endsWith("refs/heads/codex/production-readiness-stage-1"));
  const sourceFiles = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.test.mjs",
    "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_3_EVIDENCE.json",
  ].map((relativePath) => ({
    path: relativePath,
    sha256: fileHash(join(repoRoot, relativePath)),
  }));
  let referenceIdentity = null;
  if (existsSync(PHASE_4_4_REFERENCE_MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(readFileSync(PHASE_4_4_REFERENCE_MANIFEST_PATH, "utf8"));
      referenceIdentity = {
        snapshotPath: ".manu-runtime/phase4-3/reference-snapshot-20260916T194917770Z",
        manifestPath: ".manu-runtime/phase4-3/reference-snapshot-20260916T194917770Z-manifest.json",
        currentSourceFingerprint: manifest.currentSourceFingerprint ?? null,
        referenceSourceFingerprint: manifest.referenceSourceFingerprint ?? null,
        currentFileCount: manifest.currentFileCount ?? null,
        referenceFileCount: manifest.referenceFileCount ?? null,
        mismatchCount: manifest.mismatchCount ?? null,
        unrelatedMismatchCount: manifest.unrelatedMismatchCount ?? null,
      };
    } catch {
      referenceIdentity = { status: "UNREADABLE" };
    }
  }
  return {
    worktreePath: repoRoot.replaceAll("\\", "/"),
    branchMode: gitOutput(["symbolic-ref", "--short", "-q", "HEAD"]) ? "ATTACHED" : "DETACHED_HEAD",
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    detachedHeadUpstream: gitOutput(["status", "--short", "--branch"])
      ?.split(/\r?\n/)[0]
      ?.includes("no branch")
      ? "NOT_AVAILABLE_BECAUSE_HEAD_IS_DETACHED"
      : gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]),
    remoteSymbolicHead: symref?.replace(/^ref:\s+/, "") ?? null,
    remoteHeadSha: headLine?.split(/\s+/)[0] ?? null,
    remoteProductionReadinessSha: readinessLine?.split(/\s+/)[0] ?? null,
    modifiedTrackedCount: statusLines.filter((line) => !line.startsWith("??")).length,
    untrackedCount: statusLines.filter((line) => line.startsWith("??")).length,
    dirtyTreePreserved: true,
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
    sourceFiles,
    harnessSourceIdentity: phase44HarnessSourceIdentity(),
    localConfigurationIdentity: configurationIdentity,
    referenceIdentity,
  };
}

export function phase44CheckpointIdentity({
  sourceHead = "unbound",
  sourceVariant = "current",
  referenceSnapshotId = PHASE_4_4_REFERENCE_SNAPSHOT_ID,
  baseUrl = PHASE_4_4_DEFAULT_BASE_URL,
  configurationIdentity = null,
  executionMode = PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe,
} = {}) {
  return {
    planRevision: PHASE_4_4_PLAN_REVISION,
    phase: "4.4",
    checkpointPhaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
    checkpointSchemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
    sourceHead: String(sourceHead),
    sourceVariant: String(sourceVariant),
    referenceSnapshotId: String(referenceSnapshotId),
    fixtureId: PHASE_4_4_FIXTURE_ID,
    baseOrigin: normalizeBaseUrl(baseUrl),
    journeys: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
    normalRepetitions: PHASE_4_4_REPETITION_COUNT,
    diagnosticRepetitions: PHASE_4_4_REPETITION_COUNT,
    countedAsOfficialSample: false,
    serverControl: "managed_same_port_per_mode",
    executionMode,
    harnessSourceIdentity: phase44HarnessSourceIdentity(),
    localConfigurationIdentity: configurationIdentity,
  };
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value));
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("phase44_base_url_protocol_invalid");
  return parsed.toString().replace(/\/$/, "");
}

export function phase44UnitKey({ mode, journeyId, repetition }) {
  return `${mode}:${journeyId}:r${Number(repetition)}`;
}

export function phase44MeasurementUnits({
  journeys = PHASE_4_3_JOURNEYS,
  repetitionCount = PHASE_4_4_REPETITION_COUNT,
  modes = ["normal", "diagnostic"],
} = {}) {
  const units = [];
  for (const mode of modes) {
    for (const journey of journeys) {
      for (let repetition = 1; repetition <= repetitionCount; repetition += 1) {
        units.push({
          unitKey: phase44UnitKey({ mode, journeyId: journey.journeyId, repetition }),
          mode,
          journeyId: journey.journeyId,
          repetition,
          fixtureId: PHASE_4_4_FIXTURE_ID,
          countedAsOfficialSample: false,
        });
      }
    }
  }
  return units;
}

export function phase44TargetedCaptureUnits() {
  return [{
    unitKey: "probe:normal:J1:r1",
    mode: "normal",
    journeyId: "J1",
    repetition: 1,
    fixtureId: PHASE_4_4_FIXTURE_ID,
    scope: "targeted_capture_probe",
    countedAsOfficialSample: false,
  }];
}

export function readPhase44CaptureProbeEvidence(path) {
  if (!path || !existsSync(path)) return [];
  let evidence;
  try {
    evidence = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("phase44_capture_probe_evidence_invalid_json");
  }
  const samples = Array.isArray(evidence?.samples) ? evidence.samples : [];
  const probeUnits = phase44TargetedCaptureUnits();
  const byKey = new Map(samples.map((sample) => [sample?.unitKey, sample]));
  const matched = probeUnits.map((unit) => byKey.get(unit.unitKey)).filter(Boolean);
  if (
    evidence?.planRevision !== PHASE_4_4_PLAN_REVISION ||
    evidence?.stage !== "4.4" ||
    matched.length !== probeUnits.length ||
    matched.some((sample) => sample.observationValidity !== "VALID")
  ) {
    throw new Error("phase44_capture_probe_evidence_not_complete");
  }
  return matched;
}

export function phase44ExecutionUnits(executionMode = PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe) {
  if (executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe) {
    return phase44TargetedCaptureUnits();
  }
  if (executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations) {
    return phase44MeasurementUnits({ modes: ["normal"] });
  }
  if (executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations) {
    return phase44MeasurementUnits({ modes: ["diagnostic"] });
  }
  throw new Error("phase44_execution_mode_invalid");
}

export function verifyPhase44CaptureContract() {
  const failures = [];
  const timerAnchoredToTrustedClick =
    PHASE_4_3_SECOND_ACTION_DELAY_MS === 2_000 &&
    PHASE_4_3_JOURNEYS.every((journey) =>
      journey.secondActionAnchor?.actionId === "first" &&
      typeof journey.secondActionAnchor?.stepLabel === "string",
    );
  if (!timerAnchoredToTrustedClick) failures.push("timer_anchor_contract_invalid");

  const visibleSelectors = PHASE_4_3_JOURNEYS.every((journey) =>
    journey.firstAction.steps
      .filter((step) => step.kind === "click")
      .every((step) =>
        !step.selector.includes("shell-") || step.selector.includes(":visible"),
      ) &&
    journey.secondAction.click.selector.length > 0,
  );
  if (!visibleSelectors) failures.push("visible_selector_contract_invalid");

  const navigationAwayIsRepresentable = PHASE_4_3_JOURNEYS.every((journey) =>
    typeof journey.firstAction.readySelector === "string" &&
    typeof journey.secondAction.readySelector === "string" &&
    journey.firstAction.readySelector !== journey.secondAction.readySelector,
  );
  if (!navigationAwayIsRepresentable) failures.push("navigation_away_contract_invalid");

  const slowResponseObservationBounded =
    PHASE_4_3_REQUEST_BODY_FINISH_TIMEOUT_MS > 0 &&
    PHASE_4_4_REQUEST_BODY_FINISH_TIMEOUT_MS > 0;
  if (!slowResponseObservationBounded) failures.push("request_observation_deadline_invalid");

  const genuineTargetFailureIsObservable = PHASE_4_3_JOURNEYS.every((journey) =>
    journey.autoRetryMissingClick === false,
  );
  if (!genuineTargetFailureIsObservable) failures.push("target_failure_retry_contract_invalid");

  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    checks: {
      timerAnchoredToTrustedClick,
      visibleSelectors,
      navigationAwayIsRepresentable,
      slowResponseObservationBounded,
      genuineTargetFailureIsObservable,
    },
  };
}

function abortAfter(milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return { controller, clear: () => clearTimeout(timer) };
}

async function probeHttp(targetUrl, { expectedPath, label }) {
  const origin = new URL(targetUrl).origin;
  const url = new URL(expectedPath, `${origin}/`).toString();
  const timeout = abortAfter(PHASE_4_4_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: timeout.controller.signal,
    });
    try {
      await response.body?.cancel();
    } catch {
      // The status is sufficient for this network-only preflight.
    }
    return {
      label,
      status: response.status < PHASE_4_4_ALLOWED_HTTP_STATUS_MAX ? "PASS" : "BLOCKED",
      httpStatus: response.status,
      targetOrigin: origin,
      failureBoundary: response.status < PHASE_4_4_ALLOWED_HTTP_STATUS_MAX ? null : "network_preflight",
    };
  } catch (error) {
    return {
      label,
      status: "BLOCKED",
      httpStatus: null,
      targetOrigin: origin,
      failureBoundary: "network_preflight",
      errorClass: safeErrorClass(error),
    };
  } finally {
    timeout.clear();
  }
}

export async function checkPhase44LocalInputs(
  baseUrl,
  { emailAvailable = false, passwordAvailable = false } = {},
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [app, supabase] = await Promise.all([
    probeHttp(normalizedBaseUrl, { expectedPath: "/login?next=/dashboard", label: "local_app" }),
    probeHttp(PHASE_4_4_SUPABASE_URL, { expectedPath: "/rest/v1/", label: "local_supabase" }),
  ]);
  const failures = [
    app.status === "PASS" ? null : "local_app_unreachable_or_not_ready",
    supabase.status === "PASS" ? null : "local_supabase_unreachable_or_not_ready",
    emailAvailable ? null : "synthetic_email_unavailable",
    passwordAvailable ? null : "synthetic_password_unavailable",
  ].filter(Boolean);
  return {
    status: failures.length ? "BLOCKED" : "PASS",
    fixtureId: PHASE_4_4_FIXTURE_ID,
    fixtureClass: "synthetic_normal_owner",
    authentication: "real_password_session_required",
    storePath: "normal_rls_api_path_required",
    fallbackStoreAllowed: false,
    credentialsAvailable: {
      email: emailAvailable,
      password: passwordAvailable,
    },
    app,
    supabase: {
      ...supabase,
      targetOrigin: PHASE_4_4_SUPABASE_URL,
    },
    blockers: failures,
  };
}

function phase44BrowserInstrumentationSource(enableObservers, traceVariant) {
  return {
    enableObservers,
    enableLifecycleTrace:
      enableObservers || traceVariant === "preference_intent_timing_and_completion",
  };
}

export async function installPhase44BrowserInstrumentation(page, mode, { traceVariant = null } = {}) {
  await page.addInitScript(({ enableObservers, enableLifecycleTrace }) => {
    const route = () => `${window.location.pathname}${window.location.search}`;
    const state = (window.__aiyaPhase43 = window.__aiyaPhase43 || {
      trustedEvents: [],
      routeEvents: [],
      perf: { longTaskCount: 0, longTasks: [], eventTimings: [], lcpAtMs: null, cls: 0 },
    });
    window.__aiyaPhase44 = state;
    if (enableLifecycleTrace) {
      window.__aiyaPhase52TraceEnabled = true;
      window.__aiyaPhase55TraceEnabled = true;
    }
    const recordRoute = (source) => {
      state.routeEvents.push({ atWallMs: Date.now(), route: route(), source });
    };
    recordRoute("initial");
    for (const method of ["pushState", "replaceState"]) {
      const original = window.history[method];
      window.history[method] = function phase44HistoryProxy(...args) {
        const result = original.apply(this, args);
        recordRoute(method);
        return result;
      };
    }
    window.addEventListener("popstate", () => recordRoute("popstate"));
    document.addEventListener(
      "click",
      (event) => {
        if (!event.isTrusted) return;
        const target = event.target instanceof Element
          ? event.target.closest("[data-testid],a[href]")
          : null;
        state.trustedEvents.push({
          atWallMs: Date.now(),
          testId: target?.getAttribute("data-testid") ?? null,
          href: target?.getAttribute("href") ?? null,
        });
      },
      true,
    );
    if (enableObservers && typeof PerformanceObserver !== "undefined") {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.perf.longTaskCount += 1;
            state.perf.longTasks.push({
              startTimeMs: Number(entry.startTime.toFixed(3)),
              durationMs: Number(entry.duration.toFixed(3)),
            });
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        state.perf.longTaskObserverUnavailable = true;
      }
      try {
        new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1);
          state.perf.lcpAtMs = last?.startTime ?? null;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        state.perf.lcpObserverUnavailable = true;
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.perf.cls += entry.value || 0;
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        state.perf.clsObserverUnavailable = true;
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!["click", "pointerdown", "keydown", "pointerup"].includes(entry.name)) continue;
            state.perf.eventTimings.push({
              name: entry.name,
              startTimeMs: Number(entry.startTime.toFixed(3)),
              processingStartMs: Number(entry.processingStart.toFixed(3)),
              processingEndMs: Number(entry.processingEnd.toFixed(3)),
              durationMs: Number(entry.duration.toFixed(3)),
              interactionId: Number(entry.interactionId || 0),
            });
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {
        state.perf.eventTimingObserverUnavailable = true;
      }
    }
  }, phase44BrowserInstrumentationSource(
    PHASE_4_4_MODES[mode].browserObservers === "on",
    traceVariant,
  ));
}

export async function waitForReady(page, selector) {
  await page.locator(selector).first().waitFor({
    state: "visible",
    timeout: PHASE_4_3_READY_TIMEOUT_MS,
  });
}

export async function authenticateWithTiming(page, baseUrl, { email, password }) {
  const sessionStartedAtWallMs = Date.now();
  const timing = {
    sessionStartedAtWallMs,
    loginPageResponseStatus: null,
    loginPageReadyAtMs: null,
    passwordLoginRequestStartAtMs: null,
    passwordLoginResponseHeaderAtMs: null,
    passwordLoginResponseBodyFinishedAtMs: null,
    authenticatedShellReadyAtMs: null,
    passwordLoginStatus: null,
  };
  try {
    await page.bringToFront();
    const loginPageResponse = await page.goto(`${baseUrl}/login?next=/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: PHASE_4_3_READY_TIMEOUT_MS,
    });
    timing.loginPageResponseStatus = loginPageResponse?.status() ?? null;
    timing.loginPageReadyAtMs = Date.now() - sessionStartedAtWallMs;
    // The server-rendered form can be visible before React owns its controlled inputs.
    await page.waitForFunction(() => {
      const input = document.querySelector("#customer-login-email");
      return input instanceof HTMLInputElement &&
        Object.prototype.hasOwnProperty.call(input, "_valueTracker");
    }, { timeout: PHASE_4_3_READY_TIMEOUT_MS });
    const requestPromise = page
      .waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/password-login", {
        timeout: PHASE_4_3_READY_TIMEOUT_MS,
      })
      .then((request) => {
        timing.passwordLoginRequestStartAtMs = Date.now() - sessionStartedAtWallMs;
        return request;
      })
      .catch(() => null);
    const responsePromise = page
      .waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/password-login", {
        timeout: PHASE_4_3_READY_TIMEOUT_MS,
      })
      .then((response) => {
        timing.passwordLoginResponseHeaderAtMs = Date.now() - sessionStartedAtWallMs;
        timing.passwordLoginStatus = response.status();
        return response;
      })
      .catch(() => null);
    await page.locator("#customer-login-email").fill(email, {
      timeout: PHASE_4_3_CLICK_TIMEOUT_MS,
    });
    await page.locator("#customer-login-password").fill(password, {
      timeout: PHASE_4_3_CLICK_TIMEOUT_MS,
    });
    await page.locator('[data-testid="customer-login-submit"]').click({
      timeout: PHASE_4_3_CLICK_TIMEOUT_MS,
    });
    const [request, response] = await Promise.all([requestPromise, responsePromise]);
    if (!request || !response || !response.ok()) {
      throw new Error("phase44_password_login_failed");
    }
    await response.finished();
    timing.passwordLoginResponseBodyFinishedAtMs = Date.now() - sessionStartedAtWallMs;
    await waitForReady(page, '[data-testid="authenticated-shell"]');
    timing.authenticatedShellReadyAtMs = Date.now() - sessionStartedAtWallMs;
    return { status: "PASS", timing, failureBoundary: null };
  } catch (error) {
    return {
      status: "FAIL",
      timing,
      failureBoundary: "auth_session",
      errorClass: safeErrorClass(error),
    };
  }
}

function requestPath(value) {
  try {
    return new URL(String(value), "http://phase44.local").pathname;
  } catch {
    return "";
  }
}

function isRscRequest(request) {
  const path = requestPath(request.url());
  if (path.startsWith("/_next/")) return false;
  try {
    const headers = request.headers();
    if (headers.rsc === "1" || headers["next-router-state-tree"]) return true;
  } catch {
    // Request headers are best-effort diagnostic metadata.
  }
  try {
    return new URL(request.url()).searchParams.has("_rsc");
  } catch {
    return false;
  }
}

function isTrackedRequest(request) {
  const resourceType = request.resourceType();
  const path = requestPath(request.url());
  return resourceType === "document" || path.startsWith("/api/") || isRscRequest(request);
}

export function sanitizeRequestFailureReason(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (/^[A-Za-z0-9:_-]{1,120}$/.test(normalized)) return normalized;
  return normalized ? "request_failed" : "request_failed_unknown";
}

function requestFailureReason(request) {
  try {
    return sanitizeRequestFailureReason(request.failure()?.errorText);
  } catch {
    return "request_failed_unknown";
  }
}

function parseBodySize(headers) {
  const value = headers?.["content-length"] ?? headers?.["Content-Length"] ?? null;
  if (value == null || !/^\d+$/.test(String(value))) return null;
  return Number(value);
}

export function parseServerTimingHeader(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const [namePart, ...parameters] = part.split(";").map((item) => item.trim());
      if (!/^[A-Za-z0-9._-]+$/.test(namePart || "")) return null;
      const duration = parameters.find((parameter) => parameter.startsWith("dur="));
      const parsedDuration = duration ? Number(duration.slice(4)) : null;
      return {
        name: namePart,
        durationMs: Number.isFinite(parsedDuration) ? parsedDuration : null,
      };
    })
    .filter(Boolean);
}

export function createRichRequestCapture(page) {
  const captureStartedAtWallMs = Date.now();
  const records = new Map();
  const pendingBodies = new Set();
  const pendingBodyRecords = new Map();
  const onRequest = (request) => {
    if (!isTrackedRequest(request)) return;
    const record = {
      route: sanitizeRoute(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      requestKind: isRscRequest(request)
        ? "rsc"
        : request.resourceType() === "document"
          ? "document"
          : "api_or_other",
      startedAtWallMs: Date.now(),
      status: null,
      responseHeaderAtWallMs: null,
      bodyFinishedAtWallMs: null,
      bodySizeBytes: null,
      bodySizeSource: "content-length-header",
      serverTiming: [],
      failed: false,
      failureReason: null,
    };
    records.set(request, record);
  };
  const onResponse = (response) => {
    const record = records.get(response.request());
    if (!record) return;
    record.status = response.status();
    record.responseHeaderAtWallMs = Date.now();
    try {
      const headers = response.headers();
      record.bodySizeBytes = parseBodySize(headers);
      record.serverTiming = parseServerTimingHeader(headers["server-timing"]);
    } catch {
      record.failed = true;
    }
    const bodySizePromise = record.bodySizeBytes == null
      ? Promise.resolve(response.body())
          .then((body) => {
            if (body && record.bodySizeBytes == null) {
              record.bodySizeBytes = body.length;
              record.bodySizeSource = "playwright-body-length";
            }
          })
          .catch(() => undefined)
      : Promise.resolve();
    const bodyPromise = bodySizePromise
      .then(() => response.finished())
      .then(() => {
        record.bodyFinishedAtWallMs = Date.now();
      })
      .catch(() => {
        record.failed = true;
      });
    pendingBodies.add(bodyPromise);
    pendingBodyRecords.set(bodyPromise, record);
    void bodyPromise.finally(() => {
      pendingBodies.delete(bodyPromise);
      pendingBodyRecords.delete(bodyPromise);
    });
  };
  const onRequestFailed = (request) => {
    const record = records.get(request);
    if (record) {
      record.failed = true;
      record.failureReason = requestFailureReason(request);
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  return {
    async finish() {
      const pending = [...pendingBodies];
      let bodyFinishTimedOut = false;
      if (pending.length) {
        let timeoutHandle;
        const timeout = new Promise((resolvePromise) => {
          timeoutHandle = setTimeout(
            () => resolvePromise(true),
            PHASE_4_4_REQUEST_BODY_FINISH_TIMEOUT_MS,
          );
        });
        bodyFinishTimedOut = await Promise.race([
          Promise.allSettled(pending).then(() => false),
          timeout,
        ]);
        clearTimeout(timeoutHandle);
        if (bodyFinishTimedOut) {
          for (const promise of pending) {
            const record = pendingBodyRecords.get(promise);
            if (record) record.failed = true;
          }
        }
      }
      const finishedAtWallMs = Date.now();
      const output = [...records.values()].map((record) => ({
        route: record.route,
        method: record.method,
        resourceType: record.resourceType,
        requestKind: record.requestKind,
        startedAtMs: roundMs(record.startedAtWallMs - captureStartedAtWallMs),
        responseHeaderAtMs: record.responseHeaderAtWallMs == null
          ? null
          : roundMs(record.responseHeaderAtWallMs - captureStartedAtWallMs),
        bodyFinishedAtMs: record.bodyFinishedAtWallMs == null
          ? null
          : roundMs(record.bodyFinishedAtWallMs - captureStartedAtWallMs),
        status: record.status,
        bodySizeBytes: record.bodySizeBytes,
        bodySizeSource: record.bodySizeSource,
        serverTiming: record.serverTiming,
        failed: record.failed,
        failureReason: record.failureReason,
      }));
      const withEnd = output.map((record) => ({
        ...record,
        endAtMs: record.bodyFinishedAtMs ?? record.responseHeaderAtMs ?? roundMs(finishedAtWallMs - captureStartedAtWallMs),
      }));
      const overlaps = [];
      for (let leftIndex = 0; leftIndex < withEnd.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < withEnd.length; rightIndex += 1) {
          const left = withEnd[leftIndex];
          const right = withEnd[rightIndex];
          if (left.startedAtMs < right.endAtMs && right.startedAtMs < left.endAtMs) {
            overlaps.push({
              leftRoute: left.route,
              leftMethod: left.method,
              rightRoute: right.route,
              rightMethod: right.method,
              overlapStartAtMs: Math.max(left.startedAtMs, right.startedAtMs),
              overlapEndAtMs: Math.min(left.endAtMs, right.endAtMs),
            });
          }
        }
      }
      return {
        captureStartedAtWallMs,
        captureFinishedAtWallMs: finishedAtWallMs,
        requestCount: output.length,
        apiRequestCount: output.filter((record) => record.route.startsWith("/api/")).length,
        documentRequestCount: output.filter((record) => record.resourceType === "document").length,
        requests: output,
        overlappingRequests: overlaps,
        overlapCount: overlaps.length,
        serverTimingResponseCount: output.filter((record) => record.serverTiming.length > 0).length,
        bodySizeAvailableCount: output.filter((record) => record.bodySizeBytes != null).length,
        bodyFinishTimedOut,
      };
    },
    dispose() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

function relativeBrowserEventTime(atWallMs, traceStartedAtWallMs) {
  const eventTime = finiteNumber(atWallMs);
  const traceStart = finiteNumber(traceStartedAtWallMs);
  return eventTime == null || traceStart == null ? null : roundMs(eventTime - traceStart);
}

export function normalizeBrowserRouteEvents(events, traceStartedAtWallMs) {
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      atMs: relativeBrowserEventTime(event?.atWallMs, traceStartedAtWallMs),
      route: sanitizeRoute(event?.route),
      source: String(event?.source ?? "unknown").slice(0, 40),
    }))
    .filter((event) => event.atMs != null);
}

export function normalizeBrowserTrustedEvents(events, traceStartedAtWallMs) {
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      atMs: relativeBrowserEventTime(event?.atWallMs, traceStartedAtWallMs),
      testId: event?.testId == null ? null : String(event.testId).slice(0, 120),
      href: event?.href == null ? null : sanitizeRoute(event.href),
    }))
    .filter((event) => event.atMs != null);
}

export async function collectBrowserMetrics(page, mode, trace = null) {
  const state = await page.evaluate(() => ({
    perf: window.__aiyaPhase44?.perf ?? null,
    trustedEvents: window.__aiyaPhase44?.trustedEvents ?? [],
    routeEvents: window.__aiyaPhase44?.routeEvents ?? [],
    phase52Events: window.__aiyaPhase52Events ?? [],
    phase55Events: window.__aiyaPhase55Events ?? [],
  }));
  const perf = state?.perf;
  return {
    observersEnabled: PHASE_4_4_MODES[mode].browserObservers === "on",
    longTaskCount: finiteNumber(perf?.longTaskCount) ?? 0,
    longTasks: Array.isArray(perf?.longTasks) ? perf.longTasks : [],
    eventTimings: Array.isArray(perf?.eventTimings) ? perf.eventTimings : [],
    routeHistoryEvents: normalizeBrowserRouteEvents(state?.routeEvents, trace?.startedAtWallMs),
    trustedEvents: normalizeBrowserTrustedEvents(state?.trustedEvents, trace?.startedAtWallMs),
    phase52Events: Array.isArray(state?.phase52Events) ? state.phase52Events : [],
    phase55Events: Array.isArray(state?.phase55Events) ? state.phase55Events : [],
    lcpAtMs: finiteNumber(perf?.lcpAtMs),
    cls: finiteNumber(perf?.cls) ?? 0,
    longTaskObserverUnavailable: perf?.longTaskObserverUnavailable === true,
    eventTimingObserverUnavailable: perf?.eventTimingObserverUnavailable === true,
    lcpObserverUnavailable: perf?.lcpObserverUnavailable === true,
    clsObserverUnavailable: perf?.clsObserverUnavailable === true,
  };
}

function relativeRequestRecords(requestSummary) {
  const traceStartOffset = requestSummary.requests[0]?.startedAtMs ?? 0;
  return requestSummary.requests.map((record) => ({
    ...record,
    startedAtMs: roundMs(record.startedAtMs - traceStartOffset),
    responseHeaderAtMs: record.responseHeaderAtMs == null
      ? null
      : roundMs(record.responseHeaderAtMs - traceStartOffset),
    bodyFinishedAtMs: record.bodyFinishedAtMs == null
      ? null
      : roundMs(record.bodyFinishedAtMs - traceStartOffset),
  }));
}

export function requiredReadSummary(trace, journey) {
  return (journey.requiredReads ?? []).map((required) => {
    const matching = trace.requiredRequests.filter((record) =>
      record.requiredFor?.includes(required.actionId) &&
      matchesRequiredPattern(requestPath(record.route), required.pattern),
    );
    return {
      actionId: required.actionId,
      pattern: required.pattern,
      count: matching.length,
      records: matching.map((record) => ({
        route: record.route,
        method: record.method,
        status: record.status,
        responseHeaderAtMs: record.responseHeaderAtMs,
        bodyFinishedAtMs: record.bodyFinishedAtMs,
        failed: record.failed,
      })),
      valid: matching.length > 0 && matching.every((record) =>
        record.method === "GET" &&
        Number.isInteger(record.status) &&
        record.status >= 200 &&
        record.status < 300 &&
        record.bodyFinishedAtMs != null &&
        record.failed !== true,
      ),
    };
  });
}

export function evaluatePhase44J2PreloadedRead({
  journey,
  trace,
  requestSummary,
  auth,
} = {}) {
  if (journey?.journeyId !== "J2") {
    return {
      status: "NOT_APPLICABLE",
      valid: true,
      route: "/api/conversations",
      linkedTo: [],
    };
  }

  const records = (requestSummary?.requests ?? []).filter(
    (record) => record.method === "GET" && record.route === "/api/conversations",
  );
  const completed = records.find(
    (record) =>
      Number.isInteger(record.status) &&
      record.status >= 200 &&
      record.status < 300 &&
      record.bodyFinishedAtMs != null &&
      record.failed !== true,
  );
  const traceStartedAtWallMs = finiteNumber(trace?.startedAtWallMs);
  const captureStartedAtWallMs = finiteNumber(requestSummary?.captureStartedAtWallMs);
  const secondReadyAtMs = finiteNumber(trace?.actions?.second?.readyStateAtMs);
  const completedAtWallMs =
    completed && captureStartedAtWallMs != null
      ? captureStartedAtWallMs + completed.bodyFinishedAtMs
      : null;
  const secondReadyAtWallMs =
    traceStartedAtWallMs != null && secondReadyAtMs != null
      ? traceStartedAtWallMs + secondReadyAtMs
      : null;
  const loadedBeforeSecondAction =
    completedAtWallMs != null && secondReadyAtWallMs != null
      ? completedAtWallMs <= secondReadyAtWallMs
      : false;
  const valid = Boolean(
    auth?.status === "PASS" &&
      completed &&
      loadedBeforeSecondAction &&
      secondReadyAtMs != null,
  );
  return {
    status: valid ? "PASS" : "FAIL",
    valid,
    route: "/api/conversations",
    recordCount: records.length,
    completedRecord: completed
      ? {
          status: completed.status,
          bodyFinishedAtMs: completed.bodyFinishedAtMs,
          failed: completed.failed,
        }
      : null,
    linkedTo: ["authenticated_dashboard_load", "messaging_panel_data_ready"],
    authenticatedDashboardLoadObserved: auth?.status === "PASS",
    dataReadyBoundary: "messaging_panel",
    loadedBeforeSecondAction,
    failureBoundary: valid ? null : "j2_preloaded_inbox_read",
  };
}

export function deriveFailureBoundary({
  auth,
  trace,
  traceValidation = trace?.validation ?? null,
  journey = null,
  j2DataReady = null,
  requiredReads,
  expectedRouteMatched,
  mutationRequests = [],
  expectedMutationRequests = [],
} = {}) {
  if (auth?.status !== "PASS") {
    return { phase: "auth_session", actionId: null, reason: auth?.failureBoundary ?? "auth_failed" };
  }
  if (journey?.journeyId === "J2" && j2DataReady?.status !== "PASS") {
    return {
      phase: "preloaded_data",
      actionId: "first",
      reason: "j2_preloaded_inbox_read_not_linked_to_data_ready",
    };
  }
  if (trace?.actions?.first?.failureClass) {
    return {
      phase: "first_action",
      actionId: "first",
      reason: trace.actions.first.failureClass,
    };
  }
  if (trace?.actions?.first?.functionalOutcome === "ABANDONED") {
    return {
      phase: "first_action",
      actionId: "first",
      reason: "first_target_abandoned_after_navigation",
    };
  }
  if (trace?.actions?.second?.failureClass || trace?.actions?.second?.secondActionAccepted !== true) {
    return {
      phase: "second_action",
      actionId: "second",
      reason: trace?.actions?.second?.failureClass ?? "second_action_not_accepted",
    };
  }
  const invalidRequired = (requiredReads ?? []).find((record) => record.valid !== true);
  if (invalidRequired) {
    return {
      phase: "required_read",
      actionId: invalidRequired.actionId,
      reason: "required_read_incomplete_or_non_2xx",
      pattern: invalidRequired.pattern,
    };
  }
  if (mutationRequests.length) {
    return {
      phase: "forbidden_mutation",
      actionId: null,
      reason: "non_get_api_request_during_journey",
      count: mutationRequests.length,
    };
  }
  const failedExpectedMutation = expectedMutationRequests.find((record) =>
    !Number.isInteger(record.status) ||
    record.status < 200 ||
    record.status >= 300 ||
    record.bodyFinishedAtMs == null ||
    record.failed === true,
  );
  if (failedExpectedMutation) {
    return {
      phase: "expected_navigation_mutation",
      actionId: null,
      reason: "expected_navigation_mutation_failed",
      route: failedExpectedMutation.route,
    };
  }
  if (traceValidation?.status === "FAIL") {
    return {
      phase: "trace_validation",
      actionId: "second",
      reason: "trace_validation_failed",
      failures: traceValidation.failures,
    };
  }
  if (traceValidation?.completenessStatus === "INCOMPLETE") {
    return {
      phase: "trace_validation",
      actionId: "second",
      reason: "required_timing_boundary_missing",
      missingTimingFields: traceValidation.missingTimingFields,
    };
  }
  if (!expectedRouteMatched) {
    return { phase: "route_validation", actionId: "second", reason: "expected_route_not_matched" };
  }
  if (trace?.actions?.second?.parseRenderCompletedAtMs == null) {
    return { phase: "parse_render", actionId: "second", reason: "parse_render_timing_missing" };
  }
  if (trace?.actions?.second?.readyStateAtMs == null) {
    return { phase: "ready_state", actionId: "second", reason: "ready_timing_missing" };
  }
  return { phase: "none", actionId: null, reason: null };
}

export function validatePhase44TraceForJourney(trace, journey) {
  const validation = trace?.validation ?? {
    status: "FAIL",
    failures: ["trace_validation_missing"],
    completenessStatus: "INCOMPLETE",
    missingTimingFields: PHASE_4_3_REQUIRED_TIMING_FIELDS,
  };
  const reportedMissingTimingFields = Array.isArray(validation.missingTimingFields)
    ? validation.missingTimingFields
    : validation.completenessStatus === "COMPLETE"
      ? []
      : PHASE_4_3_REQUIRED_TIMING_FIELDS;
  const missingTimingFields = reportedMissingTimingFields.filter((field) =>
        !(journey?.requiredReads?.length === 0 && PHASE_4_4_NO_REQUIRED_READ_TIMING_FIELDS.has(field)),
      );
  return {
    ...validation,
    completenessStatus: missingTimingFields.length ? "INCOMPLETE" : "COMPLETE",
    missingTimingFields,
    toleratedMissingTimingFields: (validation.missingTimingFields ?? []).filter((field) =>
      journey?.requiredReads?.length === 0 && PHASE_4_4_NO_REQUIRED_READ_TIMING_FIELDS.has(field),
    ),
  };
}

export function classifyPhase44Observation({
  auth,
  trace,
  journey = null,
  j2DataReady = null,
  requiredReads = [],
  expectedRouteMatched = false,
  mutationRequests = [],
  expectedMutationRequests = [],
} = {}) {
  const traceValidation = validatePhase44TraceForJourney(trace, journey);
  const failureBoundary = deriveFailureBoundary({
    auth,
    trace,
    traceValidation,
    journey,
    j2DataReady,
    requiredReads,
    expectedRouteMatched,
    mutationRequests,
    expectedMutationRequests,
  });
  const firstActionOutcome = trace?.actions?.first?.functionalOutcome ?? "INCOMPLETE";
  const secondActionOutcome = trace?.actions?.second?.functionalOutcome ?? "INCOMPLETE";
  const fullSuccess =
    firstActionOutcome === "SUCCESS" &&
    secondActionOutcome === "SUCCESS" &&
    trace?.actions?.second?.secondActionAccepted === true &&
    expectedRouteMatched === true;
  const observedFailure =
    firstActionOutcome === "FAILURE" ||
    firstActionOutcome === "ABANDONED" ||
    secondActionOutcome === "FAILURE" ||
    secondActionOutcome === "INCOMPLETE" ||
    failureBoundary.phase !== "none";
  const observationValidity =
    auth?.status === "PASS" &&
    traceValidation.status === "PASS" &&
    (fullSuccess || observedFailure)
      ? "VALID"
      : "INVALID";
  const functionalOutcome =
    firstActionOutcome === "FAILURE"
      ? "FAILURE"
      : firstActionOutcome === "ABANDONED"
        ? "INCOMPLETE"
        : secondActionOutcome === "SUCCESS" && failureBoundary.phase === "none"
          ? "SUCCESS"
          : secondActionOutcome === "FAILURE" || failureBoundary.phase !== "none"
            ? "FAILURE"
            : "INCOMPLETE";
  const secondReadyAfterDispatchMs =
    trace?.actions?.second?.readyStateAtMs != null &&
    trace?.actions?.second?.dispatchAtMs != null
      ? roundMs(
          trace.actions.second.readyStateAtMs -
          trace.actions.second.dispatchAtMs,
        )
      : null;
  return {
    observationValidity,
    functionalOutcome,
    firstActionOutcome,
    secondActionOutcome,
    performanceOutcome: "NOT_EVALUABLE",
    performanceBoundary: {
      name: "second_action_dispatch_to_ready",
      durationMs: secondReadyAfterDispatchMs,
    },
    failureBoundary,
  };
}

export function isValidPhase44Sample({
  auth,
  trace,
  journey = null,
  j2DataReady = null,
  requiredReads,
  expectedRouteMatched,
  mutationRequests = [],
  expectedMutationRequests = [],
} = {}) {
  const traceValidation = validatePhase44TraceForJourney(trace, journey);
  const noRequiredReads = journey?.requiredReads?.length === 0;
  return Boolean(
    auth?.status === "PASS" &&
    (noRequiredReads || trace?.status === "COMPLETE") &&
    traceValidation?.status === "PASS" &&
    traceValidation?.completenessStatus === "COMPLETE" &&
    trace?.failures?.length === 0 &&
    trace?.actions?.first?.functionalOutcome === "SUCCESS" &&
    trace?.actions?.second?.functionalOutcome === "SUCCESS" &&
    trace?.actions?.second?.secondActionAccepted === true &&
    expectedRouteMatched === true &&
    (journey?.journeyId !== "J2" || j2DataReady?.status === "PASS") &&
    mutationRequests.length === 0 &&
    expectedMutationRequests.every((record) =>
      Number.isInteger(record.status) &&
      record.status >= 200 &&
      record.status < 300 &&
      record.bodyFinishedAtMs != null &&
      record.failed !== true,
    ) &&
    (requiredReads ?? []).every((record) => record.valid === true),
  );
}

export async function runMeasurementUnit({
  browser,
  baseUrl,
  mode,
  journey,
  repetition,
  unitKey: providedUnitKey = null,
  scope = "local_observation",
  email,
  password,
  checkpoint,
  controlVariant = null,
  traceVariant = null,
}) {
  const unitKey = providedUnitKey ?? phase44UnitKey({ mode, journeyId: journey.journeyId, repetition });
  checkpoint.append("measurement.unit.started", {
    unitKey,
    mode,
    journeyId: journey.journeyId,
    repetition,
    scope,
    fixtureId: PHASE_4_4_FIXTURE_ID,
    countedAsOfficialSample: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await installPhase44BrowserInstrumentation(page, mode, { traceVariant });
    const capture = createRichRequestCapture(page);
    const auth = await authenticateWithTiming(page, baseUrl, { email, password });
    if (auth.status !== "PASS") {
      capture.dispose();
      const result = {
        unitKey,
        mode,
        journeyId: journey.journeyId,
        repetition,
        status: "AUTH_FAILED",
        validSample: false,
        observationValidity: "INVALID",
        functionalOutcome: "FAILURE",
        performanceOutcome: "NOT_EVALUABLE",
        auth,
        failureBoundary: deriveFailureBoundary({ auth }),
        countedAsOfficialSample: false,
      };
      checkpoint.append("measurement.unit.trace", result);
      checkpoint.append("measurement.unit.completed", {
        unitKey,
        mode,
        journeyId: journey.journeyId,
        repetition,
        status: result.status,
        validSample: false,
        observationValidity: result.observationValidity,
        failureBoundary: result.failureBoundary,
        countedAsOfficialSample: false,
      });
      return result;
    }
    const startNavigationStartedAt = Date.now();
    await page.goto(`${baseUrl}${journey.startRoute}`, {
      waitUntil: "domcontentloaded",
      timeout: PHASE_4_3_READY_TIMEOUT_MS,
    });
    await waitForReady(page, '[data-testid="authenticated-shell"]');
    const startNavigationReadyAt = Date.now();
    let trace;
    try {
      trace = await runDiagnosticJourney(page, journey, {
        mode,
        checkpoint: null,
        controlVariant,
        traceVariant,
      });
    } finally {
      // runDiagnosticJourney waits for its required bodies; the rich capture
      // waits for all relevant bodies before its final summary.
    }
    const requestSummary = await capture.finish();
    capture.dispose();
    const browserMetrics = await collectBrowserMetrics(page, mode, trace);
    const expectedRouteMatched = routeMatchesExpectedRoute(await page.url(), journey.expectedRoute);
    const requiredReads = requiredReadSummary(trace, journey);
    const allMutationRequests = requestSummary.requests.filter((record) =>
      record.route.startsWith("/api/") &&
      !record.route.startsWith("/api/auth/") &&
      !["GET", "HEAD", "OPTIONS"].includes(record.method),
    );
    const expectedMutationRequests = allMutationRequests.filter((record) =>
      PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES.includes(record.route),
    );
    const backgroundMutationRequests = allMutationRequests.filter((record) =>
      PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES.includes(record.route),
    );
    const mutationRequests = allMutationRequests.filter((record) =>
      !PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES.includes(record.route) &&
      !PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES.includes(record.route),
    );
    const j2DataReady = evaluatePhase44J2PreloadedRead({
      journey,
      trace,
      requestSummary,
      auth,
    });
    const observation = classifyPhase44Observation({
      auth,
      trace,
      requiredReads,
      j2DataReady,
      expectedRouteMatched,
      mutationRequests,
      expectedMutationRequests,
      journey,
    });
    const validSample = isValidPhase44Sample({
      auth,
      trace,
      journey,
      j2DataReady,
      requiredReads,
      expectedRouteMatched,
      mutationRequests,
      expectedMutationRequests,
    });
    trace.measurement = {
      unitKey,
      mode,
      fixtureId: PHASE_4_4_FIXTURE_ID,
      repetition,
      scope,
      countedAsOfficialSample: false,
      controlVariant,
      traceVariant,
      authSessionTiming: {
        ...auth.timing,
        status: auth.status,
      },
      startRouteTiming: {
        navigationStartedAtMs: 0,
        authenticatedShellReadyAtMs: roundMs(startNavigationReadyAt - startNavigationStartedAt),
      },
      requestSummary: {
        ...requestSummary,
        requestTimeOriginWallMs: requestSummary.captureStartedAtWallMs +
          (requestSummary.requests[0]?.startedAtMs ?? 0),
        requestTimebase: "first_request_relative",
        requests: relativeRequestRecords(requestSummary),
      },
      serverStoreTiming: {
        expected: PHASE_4_4_MODES[mode].serverTiming,
        serverEnvironmentPatch: PHASE_4_4_MODES[mode].serverEnvironmentPatch,
        observedResponseCount: requestSummary.serverTimingResponseCount,
        metrics: requestSummary.requests.flatMap((record) => record.serverTiming),
      },
      browserParseRenderTiming: {
        first: trace.actions.first,
        second: trace.actions.second,
      },
      phase44TraceValidation: validatePhase44TraceForJourney(trace, journey),
      longTasks: browserMetrics,
      preferenceIntentTiming: trace.preferenceIntentTiming ?? null,
      routeHistory: {
        events: browserMetrics.routeHistoryEvents,
        trustedEvents: browserMetrics.trustedEvents,
      },
      requiredReads,
      j2DataReady,
      expectedRouteMatched,
      expectedMutationRequests,
      backgroundMutationRequests,
      mutationRequests,
      foregroundBodyFinishTimedOut: Boolean(
        requiredReads.some((record) => record.valid !== true) ||
        (journey.journeyId === "J2" && j2DataReady.status !== "PASS") ||
        expectedMutationRequests.some((record) =>
          !Number.isInteger(record.status) ||
          record.status < 200 ||
          record.status >= 300 ||
          record.bodyFinishedAtMs == null ||
          record.failed === true,
        ),
      ),
      failureBoundary: observation.failureBoundary,
      observationValidity: observation.observationValidity,
      functionalOutcome: observation.functionalOutcome,
      firstActionOutcome: observation.firstActionOutcome,
      secondActionOutcome: observation.secondActionOutcome,
      performanceOutcome: observation.performanceOutcome,
      performanceBoundary: observation.performanceBoundary,
      validSample,
    };
    const result = {
      unitKey,
      mode,
      journeyId: journey.journeyId,
      repetition,
      scope,
      status: validSample ? "VALID" : "INVALID",
      validSample,
      observationValidity: observation.observationValidity,
      functionalOutcome: observation.functionalOutcome,
      performanceOutcome: observation.performanceOutcome,
      auth,
      trace,
      failureBoundary: observation.failureBoundary,
      countedAsOfficialSample: false,
    };
    checkpoint.append("measurement.unit.trace", result);
    checkpoint.append("measurement.unit.completed", {
      unitKey,
      mode,
      journeyId: journey.journeyId,
      repetition,
      status: result.status,
      validSample,
      observationValidity: observation.observationValidity,
      functionalOutcome: observation.functionalOutcome,
      performanceOutcome: observation.performanceOutcome,
      failureBoundary: observation.failureBoundary,
      countedAsOfficialSample: false,
    });
    return result;
  } catch (error) {
    const result = {
      unitKey,
      mode,
      journeyId: journey.journeyId,
      repetition,
      status: "HARNESS_ERROR",
      validSample: false,
      observationValidity: "INVALID",
      functionalOutcome: "INCOMPLETE",
      performanceOutcome: "NOT_EVALUABLE",
      failureBoundary: {
        phase: "harness",
        actionId: null,
        reason: "measurement_unit_exception",
      },
      errorClass: safeErrorClass(error),
      countedAsOfficialSample: false,
    };
    checkpoint.append("measurement.unit.trace", result);
    checkpoint.append("measurement.unit.completed", {
      unitKey,
      mode,
      journeyId: journey.journeyId,
      repetition,
      status: result.status,
      validSample: false,
      observationValidity: result.observationValidity,
      functionalOutcome: result.functionalOutcome,
      performanceOutcome: result.performanceOutcome,
      failureBoundary: result.failureBoundary,
      errorClass: result.errorClass,
      countedAsOfficialSample: false,
    });
    return result;
  } finally {
    await context.close();
  }
}

export function summarizePhase44UnitEvents(
  eventsOrCheckpoint,
  plannedUnits = phase44MeasurementUnits(),
  { completionCriterion = "validSample" } = {},
) {
  if (!["validSample", "observationValidity"].includes(completionCriterion)) {
    throw new Error("phase44_completion_criterion_invalid");
  }
  const events = Array.isArray(eventsOrCheckpoint)
    ? eventsOrCheckpoint
    : eventsOrCheckpoint?.eventsOf?.("measurement.unit.completed") ?? [];
  const completionEvents = Array.isArray(eventsOrCheckpoint)
    ? events.filter((event) => event.type === "measurement.unit.completed")
    : events;
  const latestByUnit = new Map();
  for (const event of completionEvents) {
    const unitKey = event.payload?.unitKey;
    if (unitKey) latestByUnit.set(unitKey, event.payload);
  }
  const plannedKeys = new Set(plannedUnits.map((unit) => unit.unitKey));
  const attemptedKeys = new Set(
    [...latestByUnit.keys()].filter((unitKey) => plannedKeys.has(unitKey)),
  );
  const validKeys = new Set(
    [...latestByUnit.entries()]
      .filter(([unitKey, payload]) => plannedKeys.has(unitKey) && payload.validSample === true)
      .map(([unitKey]) => unitKey),
  );
  const observationValidKeys = new Set(
    [...latestByUnit.entries()]
      .filter(([unitKey, payload]) => plannedKeys.has(unitKey) && payload.observationValidity === "VALID")
      .map(([unitKey]) => unitKey),
  );
  const acceptedKeys = completionCriterion === "observationValidity"
    ? observationValidKeys
    : validKeys;
  const invalidKeys = new Set(
    [...attemptedKeys].filter((unitKey) => !acceptedKeys.has(unitKey)),
  );
  const observationInvalidKeys = new Set(
    [...attemptedKeys].filter((unitKey) => !observationValidKeys.has(unitKey)),
  );
  const remainingKeys = new Set(
    [...plannedKeys].filter((unitKey) => !attemptedKeys.has(unitKey)),
  );
  const status =
    remainingKeys.size === 0 && invalidKeys.size === 0
      ? "COMPLETE"
      : remainingKeys.size === 0
        ? "BLOCKED"
        : "IN_PROGRESS";
  return {
    status,
    plannedCount: plannedKeys.size,
    attemptedCount: attemptedKeys.size,
    validCount: validKeys.size,
    observationValidCount: observationValidKeys.size,
    observationInvalidCount: observationInvalidKeys.size,
    invalidCount: invalidKeys.size,
    remainingCount: remainingKeys.size,
    attemptedKeys,
    acceptedKeys,
    validKeys,
    observationValidKeys,
    invalidKeys,
    observationInvalidKeys,
    remainingKeys,
  };
}

function phase44ResultEvents(results) {
  return (results ?? []).map((result) => ({
    type: "measurement.unit.completed",
    payload: result,
  }));
}

function phase44StatusForResults(results, plannedUnits) {
  return summarizePhase44UnitEvents(
    phase44ResultEvents(results),
    plannedUnits,
    { completionCriterion: "observationValidity" },
  );
}

export function phase44StageStatuses({
  preflightStatus = "NOT_STARTED",
  probeResults = [],
  normalResults = [],
  diagnosticResults = [],
  reconciliationStatus = "NOT_STARTED",
} = {}) {
  const preflightPassed = preflightStatus === "PASS";
  const probeSummary = phase44StatusForResults(
    probeResults,
    phase44TargetedCaptureUnits(),
  );
  const normalUnits = phase44MeasurementUnits({ modes: ["normal"] });
  const diagnosticUnits = phase44MeasurementUnits({ modes: ["diagnostic"] });
  const normalSummary = phase44StatusForResults(normalResults, normalUnits);
  const diagnosticSummary = phase44StatusForResults(diagnosticResults, diagnosticUnits);
  const probeStatus = !preflightPassed
    ? (probeResults.length ? "BLOCKED" : "NOT_STARTED")
    : probeSummary.status === "COMPLETE"
      ? "PASS"
      : probeResults.length && probeSummary.status === "BLOCKED"
        ? "BLOCKED"
        : probeResults.length
          ? "IN_PROGRESS"
          : "NOT_STARTED";
  const normalStatus = probeStatus !== "PASS"
    ? (normalResults.length ? "BLOCKED" : "NOT_STARTED")
    : normalSummary.status === "COMPLETE"
      ? "COMPLETE"
      : normalResults.length && normalSummary.status === "BLOCKED"
        ? "BLOCKED"
        : normalResults.length
          ? "IN_PROGRESS"
          : "NOT_STARTED";
  const reconciliationReady = reconciliationStatus === "PASS";
  const reconciliationStageStatus = normalStatus !== "COMPLETE"
    ? (reconciliationStatus === "BLOCKED" ? "BLOCKED" : "NOT_STARTED")
    : reconciliationReady
      ? "COMPLETE"
      : "NOT_STARTED";
  return {
    "4.4.1": preflightPassed ? "PASS" : preflightStatus === "BLOCKED" ? "BLOCKED" : "NOT_STARTED",
    "4.4.2": probeStatus,
    "4.4.3": normalStatus,
    "4.4.4": reconciliationStageStatus,
    summaries: {
      probe: probeSummary,
      normal: normalSummary,
      diagnostic: diagnosticSummary,
    },
  };
}

function phase44CheckpointSamples(checkpointOrRun) {
  const events = Array.isArray(checkpointOrRun)
    ? checkpointOrRun
    : checkpointOrRun?.eventsOf?.("measurement.unit.trace") ?? [];
  const latestByUnit = new Map();
  for (const event of events
    .filter((event) => event.type === "measurement.unit.trace" || Array.isArray(events) && !event.type)
    ) {
    const payload = event.payload ?? event;
    if (!payload || typeof payload !== "object") continue;
    const unitKey = payload.unitKey ?? `trace:${latestByUnit.size}`;
    latestByUnit.set(unitKey, payload);
  }
  return [...latestByUnit.values()];
}

function phase44LocalStatusSummary(localStatus) {
  const apiOrigin = (() => {
    try {
      return localStatus?.apiUrl ? new URL(localStatus.apiUrl).origin : null;
    } catch {
      return null;
    }
  })();
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

function readPhase44LocalSupabaseStatus() {
  try {
    return parseLocalSupabaseStatus();
  } catch (error) {
    return {
      status: "BLOCKED",
      reason: safeErrorClass(error),
      apiUrl: null,
      urlIsLocal: false,
      anonKey: null,
      serviceRoleKey: null,
      credentialsRecorded: false,
    };
  }
}

function runPhase44Build(localStatus, configuration, baseUrl) {
  if (!existsSync(nextCliPath)) {
    return { status: "BLOCKED", reason: "next_cli_missing", outputRecorded: false };
  }
  const environment = buildPhase44ServerEnvironment(configuration.environment, "normal", {
    baseUrl,
    localStatus,
  });
  const result = spawnSync(
    process.execPath,
    [nextCliPath, "build", "--webpack"],
    {
      cwd: appRoot,
      env: environment,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  return {
    status: result.status === 0 ? "PASS" : "BLOCKED",
    exitCode: result.status,
    timedOut: result.error?.code === "ETIMEDOUT",
    reason: result.status === 0 ? null : "local_build_failed",
    outputRecorded: false,
  };
}

function startPhase44LocalServer(environment, baseUrl) {
  const port = new URL(baseUrl).port || (new URL(baseUrl).protocol === "https:" ? "443" : "80");
  const output = [];
  const server = spawn(
    process.execPath,
    [nextCliPath, "start", "--port", String(port), "--hostname", "0.0.0.0"],
    {
      cwd: appRoot,
      env: { ...environment, PORT: String(port), HOSTNAME: "0.0.0.0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const collect = (chunk) => {
    output.push(String(chunk).slice(-2_000));
    if (output.length > 8) output.shift();
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  return { server, output, mode: environment.AIYA_PERF_DIAGNOSTIC === "1" ? "diagnostic" : "normal" };
}

async function waitForPhase44LocalServer(serverHandle, baseUrl) {
  const startedAt = Date.now();
  const releaseUrl = new URL("/api/health/release", baseUrl).toString();
  while (Date.now() - startedAt < PHASE_4_4_SERVER_READY_TIMEOUT_MS) {
    if (serverHandle.server.exitCode != null) {
      throw new Error("phase44_next_server_exited");
    }
    try {
      const response = await fetch(releaseUrl, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 200 && payload.status === "ok") return;
    } catch {
      // The production server may need several seconds after the process starts.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("phase44_next_server_timeout");
}

async function stopPhase44LocalServer(serverHandle) {
  const server = serverHandle?.server;
  if (!server || server.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  const startedAt = Date.now();
  while (server.exitCode == null && Date.now() - startedAt < PHASE_4_4_SERVER_STOP_TIMEOUT_MS) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
}

async function ensurePhase44Server(controller, mode, configuration, localStatus, baseUrl) {
  if (controller.mode === mode && controller.handle?.server?.exitCode == null) return;
  if (controller.handle) await stopPhase44LocalServer(controller.handle);
  const environment = buildPhase44ServerEnvironment(configuration.environment, mode, {
    baseUrl,
    localStatus,
  });
  const handle = startPhase44LocalServer(environment, baseUrl);
  try {
    await waitForPhase44LocalServer(handle, baseUrl);
  } catch (error) {
    await stopPhase44LocalServer(handle);
    throw error;
  }
  controller.handle = handle;
  controller.mode = mode;
}

export async function runPhase44Session({
  baseUrl = process.env.AIYA_PHASE44_BASE_URL || PHASE_4_4_DEFAULT_BASE_URL,
  email = null,
  password = null,
  sourceHead = gitOutput(["rev-parse", "HEAD"]) || "unbound",
  sourceVariant = "current",
  referenceSnapshotId = PHASE_4_4_REFERENCE_SNAPSHOT_ID,
  newRun = false,
  localConfiguration = resolvePhase44LocalConfiguration(),
  executionMode = PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe,
  captureProbeResults = [],
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const plannedUnits = phase44ExecutionUnits(executionMode);
  if (executionMode !== PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe) {
    const captureGate = phase44StageStatuses({
      preflightStatus: "PASS",
      probeResults: captureProbeResults,
    })["4.4.2"];
    if (captureGate !== "PASS") {
      return {
        status: "BLOCKED",
        outcome: "CAPTURE_PREREQUISITE_BLOCKED",
        reason: "phase44_targeted_capture_probe_required",
        executionMode,
        plannedUnits,
        stageStatuses: phase44StageStatuses({
          preflightStatus: "PASS",
          probeResults: captureProbeResults,
        }),
        runId: null,
        resumed: false,
        results: [],
        samples: [],
        preflight: null,
        countedAsOfficialSample: false,
      };
    }
  }
  const configuration = localConfiguration ?? resolvePhase44LocalConfiguration();
  const effectiveEmail = email ?? configuration.email;
  const effectivePassword = password ?? configuration.password;
  const identity = phase44CheckpointIdentity({
    sourceHead,
    sourceVariant,
    referenceSnapshotId,
    baseUrl: normalizedBaseUrl,
    configurationIdentity: configuration.identity,
    executionMode,
  });
  const metadata = {
    identitySummary: {
      planRevision: PHASE_4_4_PLAN_REVISION,
      sourceVariant,
      fixtureId: PHASE_4_4_FIXTURE_ID,
      baseOrigin: normalizedBaseUrl,
      serverControl: "managed_same_port_per_mode",
      executionMode,
      localConfiguration: configuration.summary,
    },
    measurementContract: {
      journeys: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
      normalRepetitions: PHASE_4_4_REPETITION_COUNT,
      diagnosticRepetitions: PHASE_4_4_REPETITION_COUNT,
      executionMode,
      plannedUnitKeys: plannedUnits.map((unit) => unit.unitKey),
      countedAsOfficialSample: false,
    },
    parentRunReferences: PHASE_4_4_PARENT_RUN_REFERENCES,
  };
  let opened = openPhaseRun({
    root: PHASE_4_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata,
    newRun,
    redact: sanitizePhase44Evidence,
  });
  let supersedesRunId = null;
  if (opened.action === "STALE" && !newRun) {
    supersedesRunId = opened.manifest?.runId ?? null;
    opened = openPhaseRun({
      root: PHASE_4_4_CHECKPOINT_ROOT,
      phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
      phaseSchemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
      identity,
      metadata: {
        ...metadata,
        identityChange: {
          reason: "runner_identity_and_managed_server_contract_changed",
          supersedesRunId,
          priorRunPreserved: true,
        },
      },
      newRun: true,
      redact: sanitizePhase44Evidence,
    });
  }
  if (opened.action === "COMPLETE") {
    const completedRun = readPhaseRun({
      root: PHASE_4_4_CHECKPOINT_ROOT,
      phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    const samples = phase44CheckpointSamples(completedRun.events);
    const progress = summarizePhase44UnitEvents(completedRun.events, plannedUnits, {
      completionCriterion: "observationValidity",
    });
    const preflight = completedRun.eventsOf("environment.preflight").at(-1)?.payload ?? null;
    const stageStatuses = phase44StageStatuses({
      preflightStatus: preflight?.status ?? "PASS",
      probeResults: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe ? samples : captureProbeResults,
      normalResults: executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations ? samples : [],
      diagnosticResults: executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations ? samples : [],
    });
    return {
      status: "IN_PROGRESS",
      outcome: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe
        ? "LOCAL_CAPTURE_PROBE_COMPLETE"
        : "LOCAL_OBSERVATIONS_READY",
      runId: opened.manifest.runId,
      resumed: true,
      countedAsOfficialSample: false,
      executionMode,
      plannedUnits,
      results: samples,
      samples,
      preflight,
      stageStatuses,
      identity,
      configurationIdentity: configuration.identity,
      completedUnitCount: progress.attemptedCount,
      plannedUnitCount: progress.plannedCount,
      observationValidCount: progress.observationValidCount,
      validSampleCount: progress.validCount,
      supersedesRunId,
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      status: opened.action,
      outcome: "LOCAL_DIAGNOSTIC_CHECKPOINT_NOT_RUN",
      runId: opened.manifest?.runId ?? null,
      resumed: opened.resumed === true,
      reason: opened.reason ?? null,
      countedAsOfficialSample: false,
      executionMode,
      plannedUnits,
      results: [],
      samples: [],
      preflight: null,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  }
  const checkpoint = opened.run;
  checkpoint.append("diagnostic.contract.bound", {
    phase: "4.4",
    phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
    schemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
    sourceVariant,
    fixtureId: PHASE_4_4_FIXTURE_ID,
    executionMode,
    plannedUnitKeys: plannedUnits.map((unit) => unit.unitKey),
    normalRepetitions: PHASE_4_4_REPETITION_COUNT,
    diagnosticRepetitions: PHASE_4_4_REPETITION_COUNT,
    countedAsOfficialSample: false,
  });
  const units = plannedUnits;
  let progress = summarizePhase44UnitEvents(checkpoint, units, {
    completionCriterion: "observationValidity",
  });
  if (progress.status === "COMPLETE" || progress.status === "BLOCKED") {
    const samples = phase44CheckpointSamples(checkpoint);
    const preflight = checkpoint.eventsOf("environment.preflight").at(-1)?.payload ?? null;
    const stageStatuses = phase44StageStatuses({
      preflightStatus: preflight?.status ?? "PASS",
      probeResults: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe ? samples : captureProbeResults,
      normalResults: executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations ? samples : [],
      diagnosticResults: executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations ? samples : [],
    });
    checkpoint.close();
    return {
      status: progress.status === "BLOCKED" ? "BLOCKED" : "IN_PROGRESS",
      outcome: progress.status === "BLOCKED"
        ? "LOCAL_CAPTURE_OBSERVATION_BLOCKED"
        : executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe
          ? "LOCAL_CAPTURE_PROBE_COMPLETE"
          : "LOCAL_OBSERVATIONS_READY",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      executionMode,
      plannedUnits,
      results: samples,
      samples,
      preflight,
      stageStatuses,
      observationValidCount: progress.observationValidCount,
      validSampleCount: progress.validCount,
      completedUnitCount: progress.attemptedCount,
      plannedUnitCount: progress.plannedCount,
      countedAsOfficialSample: false,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  }
  const captureChecks = verifyPhase44CaptureContract();
  checkpoint.append("capture.contract.verified", {
    ...captureChecks,
    executionMode,
    countedAsOfficialSample: false,
  }, { status: captureChecks.status === "PASS" ? "RUNNING" : "BLOCKED" });
  if (captureChecks.status !== "PASS") {
    checkpoint.close();
    return {
      status: "BLOCKED",
      outcome: "CAPTURE_CONTRACT_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      executionMode,
      plannedUnits,
      captureChecks,
      preflight: null,
      results: phase44CheckpointSamples(checkpoint),
      samples: phase44CheckpointSamples(checkpoint),
      stageStatuses: phase44StageStatuses({ preflightStatus: "NOT_STARTED" }),
      countedAsOfficialSample: false,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  }
  const localStatus = readPhase44LocalSupabaseStatus();
  const localStatusSummary = phase44LocalStatusSummary(localStatus);
  const basePreflight = {
    status: "BLOCKED",
    fixtureId: PHASE_4_4_FIXTURE_ID,
    fixtureClass: "synthetic_normal_owner",
    authentication: "real_password_session_required",
    storePath: "normal_rls_api_path_required",
    fallbackStoreAllowed: false,
    credentialsAvailable: {
      email: Boolean(effectiveEmail),
      password: Boolean(effectivePassword),
    },
    app: {
      label: "local_app",
      status: "BLOCKED",
      httpStatus: null,
      targetOrigin: new URL(normalizedBaseUrl).origin,
      failureBoundary: "network_preflight",
    },
    supabase: {
      label: "local_supabase",
      status: localStatus.status === "PASS" ? "PASS" : "BLOCKED",
      httpStatus: null,
      targetOrigin: PHASE_4_4_SUPABASE_URL,
      failureBoundary: localStatus.status === "PASS" ? null : "network_preflight",
    },
    runtime: {
      configuration: configuration.summary,
      localSupabase: localStatusSummary,
      serverControl: "managed_same_port_per_mode",
    },
    blockers: [],
  };
  if (localStatus.status !== "PASS") basePreflight.blockers.push("local_supabase_unreachable_or_not_ready");
  if (!effectiveEmail) basePreflight.blockers.push("synthetic_email_unavailable");
  if (!effectivePassword) basePreflight.blockers.push("synthetic_password_unavailable");
  if (basePreflight.blockers.length) {
    checkpoint.append("environment.preflight", basePreflight, { status: "BLOCKED" });
    checkpoint.close();
    const samples = phase44CheckpointSamples(checkpoint);
    return {
      status: "BLOCKED",
      outcome: "LOCAL_INPUT_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      executionMode,
      plannedUnits,
      captureChecks,
      preflight: basePreflight,
      results: samples,
      samples,
      stageStatuses: phase44StageStatuses({ preflightStatus: basePreflight.status }),
      countedAsOfficialSample: false,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  }
  const build = runPhase44Build(localStatus, configuration, normalizedBaseUrl);
  checkpoint.append("environment.build", {
    status: build.status,
    reason: build.reason ?? null,
    timedOut: build.timedOut === true,
    outputRecorded: false,
  }, { status: build.status === "PASS" ? "RUNNING" : "BLOCKED" });
  if (build.status !== "PASS") {
    const preflight = {
      ...basePreflight,
      blockers: ["local_app_build_failed"],
      build,
    };
    checkpoint.close();
    const samples = phase44CheckpointSamples(checkpoint);
    return {
      status: "BLOCKED",
      outcome: "LOCAL_BUILD_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      executionMode,
      plannedUnits,
      captureChecks,
      preflight,
      results: samples,
      samples,
      stageStatuses: phase44StageStatuses({ preflightStatus: "BLOCKED" }),
      countedAsOfficialSample: false,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  }
  const controller = { handle: null, mode: null };
  let preflight = null;
  const results = [];
  let browser;
  try {
    const firstPendingMode = units.find((unit) => progress.remainingKeys.has(unit.unitKey))?.mode ?? "normal";
    await ensurePhase44Server(
      controller,
      firstPendingMode,
      configuration,
      localStatus,
      normalizedBaseUrl,
    );
    preflight = await checkPhase44LocalInputs(normalizedBaseUrl, {
      emailAvailable: Boolean(effectiveEmail),
      passwordAvailable: Boolean(effectivePassword),
    });
    preflight.runtime = {
      configuration: configuration.summary,
      localSupabase: localStatusSummary,
      serverControl: "managed_same_port_per_mode",
      managedServerMode: firstPendingMode,
    };
    checkpoint.append("environment.preflight", preflight, {
      status: preflight.status === "PASS" ? "RUNNING" : "BLOCKED",
    });
    if (preflight.status !== "PASS") {
      checkpoint.close();
      return {
        status: "BLOCKED",
        outcome: "LOCAL_INPUT_BLOCKED",
        runId: checkpoint.runId,
        resumed: opened.resumed,
        executionMode,
        plannedUnits,
        captureChecks,
        preflight,
        results: phase44CheckpointSamples(checkpoint),
        samples: phase44CheckpointSamples(checkpoint),
        stageStatuses: phase44StageStatuses({ preflightStatus: preflight.status }),
        countedAsOfficialSample: false,
        identity,
        configurationIdentity: configuration.identity,
        supersedesRunId,
      };
    }
    browser = await chromium.launch({ headless: true });
    for (const mode of [...new Set(units.map((unit) => unit.mode))]) {
      const modeUnits = units.filter(
        (unit) => unit.mode === mode && progress.remainingKeys.has(unit.unitKey),
      );
      if (!modeUnits.length) continue;
      await ensurePhase44Server(controller, mode, configuration, localStatus, normalizedBaseUrl);
      for (const unit of modeUnits) {
        if (checkpoint.pauseRequested()) {
          checkpoint.applyPause("user_requested");
          break;
        }
        const journey = PHASE_4_3_JOURNEYS.find((candidate) => candidate.journeyId === unit.journeyId);
        results.push(await runMeasurementUnit({
          browser,
          baseUrl: normalizedBaseUrl,
          mode: unit.mode,
          journey,
          repetition: unit.repetition,
          unitKey: unit.unitKey,
          scope: unit.scope ?? executionMode,
          email: effectiveEmail,
          password: effectivePassword,
          checkpoint,
        }));
      }
      if (checkpoint.status === "PAUSED") break;
    }
  } catch (error) {
    const failureBoundary = safeErrorClass(error);
    checkpoint.markStatus("BLOCKED", {
      reason: "local_diagnostic_runner_failed",
      errorClass: failureBoundary,
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    const samples = phase44CheckpointSamples(checkpoint);
    return {
      status: "BLOCKED",
      outcome: "LOCAL_DIAGNOSTIC_RUNNER_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      preflight,
      executionMode,
      plannedUnits,
      captureChecks,
      results,
      samples,
      stageStatuses: phase44StageStatuses({
        preflightStatus: preflight?.status ?? "NOT_STARTED",
        probeResults: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe ? samples : captureProbeResults,
        normalResults: executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations ? samples : [],
        diagnosticResults: executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations ? samples : [],
      }),
      countedAsOfficialSample: false,
      identity,
      configurationIdentity: configuration.identity,
      supersedesRunId,
    };
  } finally {
    await browser?.close();
    await stopPhase44LocalServer(controller.handle);
  }
  progress = summarizePhase44UnitEvents(checkpoint, units, {
    completionCriterion: "observationValidity",
  });
  const paused = checkpoint.status === "PAUSED";
  if (!paused && progress.status === "BLOCKED") {
    checkpoint.markStatus("BLOCKED", {
      reason: "invalid_observation_capture",
      unitCount: progress.plannedCount,
      attemptedUnitCount: progress.attemptedCount,
      validSampleCount: progress.validCount,
      observationValidCount: progress.observationValidCount,
      invalidSampleCount: progress.invalidCount,
      countedAsOfficialSample: false,
    });
  }
  const samples = phase44CheckpointSamples(checkpoint);
  const stageStatuses = phase44StageStatuses({
    preflightStatus: preflight?.status ?? "NOT_STARTED",
    probeResults: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe ? samples : captureProbeResults,
    normalResults: executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations ? samples : [],
    diagnosticResults: executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations ? samples : [],
  });
  checkpoint.append("stage.scheduler.evaluated", {
    executionMode,
    stageStatuses,
    countedAsOfficialSample: false,
  });
  const status = paused
    ? "PAUSED"
    : progress.status === "BLOCKED"
      ? "BLOCKED"
      : "IN_PROGRESS";
  checkpoint.close();
  return {
    status,
    outcome:
      status === "BLOCKED"
        ? "LOCAL_CAPTURE_OBSERVATION_BLOCKED"
        : executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe
          ? "LOCAL_CAPTURE_PROBE_COMPLETE"
          : executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations
            ? "LOCAL_OBSERVATIONS_READY"
            : "LOCAL_DIAGNOSTIC_OBSERVATIONS_CAPTURED",
    runId: checkpoint.runId,
    resumed: opened.resumed,
    executionMode,
    plannedUnits,
    captureChecks,
    preflight,
    results,
    samples,
    stageStatuses,
    observationValidCount: progress.observationValidCount,
    validSampleCount: progress.validCount,
    completedUnitCount: progress.attemptedCount,
    plannedUnitCount: progress.plannedCount,
    countedAsOfficialSample: false,
    identity,
    configurationIdentity: configuration.identity,
    supersedesRunId,
  };
}

function inspectPhase44Runs() {
  return inspectPhaseRuns({
    root: PHASE_4_4_CHECKPOINT_ROOT,
    phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
  });
}

function descriptorOutput() {
  return sanitizePhase44Evidence({
    phase: "4.4",
    planRevision: PHASE_4_4_PLAN_REVISION,
    checkpoint: {
      phaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
      schemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
    },
    fixture: {
      id: PHASE_4_4_FIXTURE_ID,
      kind: "synthetic_normal_owner",
      smallFixtureAllowed: false,
      authentication: "real_password_session_required",
      storePath: "normal_rls_api_path_required",
    },
    modes: PHASE_4_4_MODES,
    journeys: PHASE_4_3_JOURNEYS,
    repetitionContract: {
      targetedCaptureProbe: phase44TargetedCaptureUnits(),
      normal: PHASE_4_4_REPETITION_COUNT,
      diagnostic: PHASE_4_4_REPETITION_COUNT,
      total: phase44MeasurementUnits().length,
    },
    requiredCaptureFields: PHASE_4_4_REQUIRED_CAPTURE_FIELDS,
    requiredTimingFields: PHASE_4_3_REQUIRED_TIMING_FIELDS,
    captureVerification: verifyPhase44CaptureContract(),
    stageLedger: PHASE_4_4_STAGE_LEDGER,
    officialMeasurementStarted: false,
    countedAsOfficialSample: false,
  });
}

export function buildPhase44Evidence(result, {
  generatedAt = new Date().toISOString(),
  sourceIdentity = null,
} = {}) {
  const samples = result.samples ?? result.results ?? [];
  const plannedUnits = result.plannedUnits ?? phase44MeasurementUnits();
  const executionMode = result.executionMode ?? null;
  const isV3Execution = executionMode != null || result.stageStatuses != null || result.captureChecks != null;
  const validSamples = samples.filter((sample) => sample.validSample === true);
  const observationValidSamples = samples.filter((sample) => sample.observationValidity === "VALID");
  const attemptedSamples = samples.length;
  const modeSummary = ["normal", "diagnostic"].reduce((summary, mode) => {
    const modeSamples = samples.filter((sample) => sample.mode === mode);
    summary[mode] = {
      attemptedSamples: modeSamples.length,
      validSamples: modeSamples.filter((sample) => sample.validSample === true).length,
      observationValidSamples: modeSamples.filter((sample) => sample.observationValidity === "VALID").length,
      plannedSamples: plannedUnits.filter((unit) => unit.mode === mode).length,
    };
    return summary;
  }, {});
  const resolvedSourceIdentity = sourceIdentity ?? getSourceIdentity(result.configurationIdentity ?? null);
  const preflightPassed =
    result.preflight?.status === "PASS" ||
    result.stageStatuses?.["4.4.1"] === "PASS";
  const stageStatuses = result.stageStatuses ?? phase44StageStatuses({
    preflightStatus: preflightPassed ? "PASS" : "BLOCKED",
    probeResults: executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe ? samples : [],
    normalResults: executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations ? samples : [],
    diagnosticResults: executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations ? samples : [],
  });
  const parentRunReferences = result.parentRunReferences ?? PHASE_4_4_PARENT_RUN_REFERENCES;
  const phase44Closed = stageStatuses["4.4.4"] === "COMPLETE";
  const evidenceBlockers =
    result.status === "BLOCKED"
      ? [
          ...(result.preflight?.blockers ?? []),
          ...(isV3Execution && attemptedSamples > 0 && observationValidSamples.length < attemptedSamples
            ? ["invalid_observation_capture"]
            : !isV3Execution && attemptedSamples > 0 && validSamples.length < attemptedSamples
              ? ["invalid_measurement_samples"]
            : []),
          ...(attemptedSamples === 0 && !preflightPassed && result.outcome ? [result.outcome] : []),
        ].filter((value, index, values) => values.indexOf(value) === index)
      : [];
  const executionPurpose = executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe
    ? "Verify capture semantics with one authenticated local J1 observation before expansion."
    : executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations
      ? "Collect scoped authenticated local normal observations after the targeted capture gate."
      : executionMode === PHASE_4_4_EXECUTION_MODES.diagnosticObservations
        ? "Collect scoped diagnostic observations after a trustworthy local capture."
        : "Run broad authenticated local journeys against the normal synthetic fixture.";
  const nextAction =
    result.status === "BLOCKED"
      ? "Preserve the blocked observation and repair only the declared capture or input boundary before retrying."
      : executionMode === PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe && stageStatuses["4.4.2"] === "PASS"
        ? "Review the J1 capture trace; expand to three normal observations per J1-J3 only after the capture boundary remains trustworthy."
        : executionMode === PHASE_4_4_EXECUTION_MODES.localNormalObservations && stageStatuses["4.4.3"] === "COMPLETE"
          ? "Reconcile trace integrity and failure boundaries before any diagnostic expansion."
          : "Complete the declared 4.4 prerequisite or observation scope.";
  return sanitizePhase44Evidence({
    schemaVersion: "aiya-performance-plan1-v3-phase4-4-evidence-v1",
    planRevision: PHASE_4_4_PLAN_REVISION,
    phase: "4",
    stage: "4.4",
    stageId: "4.4",
    runId: result.runId ?? null,
    generatedAt,
    status: result.status,
    outcome: result.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: executionPurpose,
      executionMode,
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: attemptedSamples > 0,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      externalOperations: [],
      preservedExistingChanges: true,
      countedAsOfficialSample: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_4_4_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.1 IDENTITY_LOCKED",
        "4.2 REFERENCE_SEPARATED",
        "4.3 GENERAL_DIAGNOSTIC_HARNESS_READY",
      ],
      currentStage: "4.4",
      nextEligibleStage: phase44Closed ? "4.5" : "4.4",
    },
    sourceIdentity: resolvedSourceIdentity,
    parentRunReferences,
    measurementIdentity: {
      checkpointPhaseId: PHASE_4_4_CHECKPOINT_PHASE_ID,
      checkpointSchemaVersion: PHASE_4_4_CHECKPOINT_SCHEMA_VERSION,
      checkpointStore: "tools/phase-execution/checkpoint-store.mjs",
      fixtureId: PHASE_4_4_FIXTURE_ID,
      fixtureClass: "synthetic_normal_owner",
      storePath: "normal_rls_api_path_required",
      journeyIds: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
      normalRepetitions: PHASE_4_4_REPETITION_COUNT,
      diagnosticRepetitions: PHASE_4_4_REPETITION_COUNT,
      executionMode,
      plannedUnitKeys: plannedUnits.map((unit) => unit.unitKey),
      secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
      serverControl: "managed_same_port_per_mode",
      localConfigurationIdentity: result.configurationIdentity ?? null,
      parentRunReferences,
      supersedesRunId: result.supersedesRunId ?? null,
      countedAsOfficialSample: false,
    },
    stageLedger: PHASE_4_4_STAGE_LEDGER.map((stage) => ({
      ...stage,
      status: stageStatuses[stage.stageId] ?? "NOT_STARTED",
    })),
    captureChecks: result.captureChecks ?? null,
    stageScheduler: stageStatuses,
    inputPreflight: result.preflight,
    sampleSummary: {
      attemptedSamples,
      plannedSamples: plannedUnits.length,
      validSamples: validSamples.length,
      invalidSamples: attemptedSamples - validSamples.length,
      observationValidSamples: observationValidSamples.length,
      observationInvalidSamples: attemptedSamples - observationValidSamples.length,
      byMode: modeSummary,
      validSamplesAreNotOfficialBaseline: true,
      commonValidTraceThresholdFor4_7: 3,
    },
    samples,
    blockers: evidenceBlockers,
    deferredToLaterStages: [
      "Phase 4.5 hosted comparison remains out of scope.",
      "Phase 4.6 Android and installed-PWA comparison remains out of scope.",
      "No root cause is claimed from diagnostic traces until Phase 4.7 closure criteria are met.",
    ],
    constraints: [
      "No official nine-scenario baseline was started.",
      "No small fixture run was started because Phase 4.3 did not identify data volume as a candidate variable.",
      "No runtime change is accepted as a Plan 1 fix.",
      "Production remains NO-GO.",
      "No credentials, cookies, tokens, raw bodies, prompts, clinical data, or device serials are recorded.",
    ],
    evidenceIntegrity: {
      status: "PASS",
      redactionCheck: "PASS",
      officialMeasurementStarted: false,
      historicalPhase4EvidenceRewritten: false,
      checkpointIdentitySeparateFromPhase4_3: true,
      incompleteSamplesRemainInvalid: true,
      observedFailuresRemainNonSamples: true,
    },
    closure: {
      status: result.status,
      outcome: result.outcome,
      phase4Closed: false,
      plan1Closed: false,
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: attemptedSamples > 0,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction,
    },
  });
}

function parseArguments(argv) {
  const options = {
    descriptor: false,
    status: false,
    run: false,
    newRun: false,
    writeEvidence: false,
    baseUrl: process.env.AIYA_PHASE44_BASE_URL || PHASE_4_4_DEFAULT_BASE_URL,
    sourceVariant: "current",
    referenceSnapshotId: PHASE_4_4_REFERENCE_SNAPSHOT_ID,
    executionMode: PHASE_4_4_EXECUTION_MODES.targetedCaptureProbe,
    captureProbeEvidencePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--execution-mode") options.executionMode = argv[++index];
    else if (arg === "--capture-probe-evidence") options.captureProbeEvidencePath = argv[++index];
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else if (arg === "--source-variant") options.sourceVariant = argv[++index];
    else if (arg === "--reference-snapshot-id") options.referenceSnapshotId = argv[++index];
    else throw new Error(`phase44_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(descriptorOutput(), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhase44Runs(), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write(
      "Phase 4.4 local authenticated runner ready. Use --descriptor, --status, or explicit --run.\n",
    );
    return;
  }
  const result = await runPhase44Session({
    baseUrl: options.baseUrl,
    sourceVariant: options.sourceVariant,
    referenceSnapshotId: options.referenceSnapshotId,
    newRun: options.newRun,
    executionMode: options.executionMode,
    captureProbeResults:
      options.captureProbeEvidencePath
        ? readPhase44CaptureProbeEvidence(resolve(options.captureProbeEvidencePath))
        : [],
  });
  const evidence = buildPhase44Evidence(result);
  if (options.writeEvidence && result.runId) {
    writeFileSync(
      phase44V3EvidencePath(result.runId),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
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
