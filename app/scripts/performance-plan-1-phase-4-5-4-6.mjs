#!/usr/bin/env node

/**
 * Plan 1 v3 environment observations for hosted and physical Android targets.
 *
 * This runner reuses the v3 journey, capture, and validation contracts. It is
 * exploratory environment evidence, never the locked official baseline and
 * never a runtime-fix acceptance run.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  openPhaseRun,
  readPhaseRun,
  inspectPhaseRuns,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  loadPhase4HostedInputs,
  redactionCheck,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";
import {
  PHASE_4_3_JOURNEYS,
  PHASE_4_3_READY_TIMEOUT_MS,
  runDiagnosticJourney,
  routeMatchesExpectedRoute,
  sanitizeDiagnosticEvidence,
} from "./performance-plan-1-phase-4-3-diagnostic.mjs";
import {
  PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES,
  PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES,
  PHASE_4_4_FIXTURE_ID,
  PHASE_4_4_PLAN_REVISION,
  PHASE_4_4_REPETITION_COUNT,
  PHASE_4_4_MODES,
  authenticateWithTiming,
  collectBrowserMetrics,
  createRichRequestCapture,
  evaluatePhase44J2PreloadedRead,
  installPhase44BrowserInstrumentation,
  isValidPhase44Sample,
  requiredReadSummary,
  classifyPhase44Observation,
  validatePhase44TraceForJourney,
  waitForReady,
} from "./performance-plan-1-phase-4-4-local.mjs";
import {
  collectAndroidTarget,
  connectPhase4AndroidCdp,
  disconnectCdpBrowser,
  launchAndroidChromeTarget,
  launchInstalledPwa,
  navigateAndroidChromeHostedTarget,
} from "./performance-plan-1-phase-4.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const DEFAULT_MAIN_CHECKOUT_ROOT =
  "C:\\Users\\Dell\\OneDrive\\Masaüstü\\MANU-AI";
const APPROVED_HOSTED_ORIGIN = "https://65-21-52-249.sslip.io";
const NORMAL_MODE = "normal";
const ENVIRONMENT_TIMEOUT_MS = PHASE_4_3_READY_TIMEOUT_MS;
const ENVIRONMENT_UNIT_TIMEOUT_MS = 90_000;
const ANDROID_TARGET_WAIT_MS = 45_000;

export const PHASE_4_5_4_6_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase4-5-4-6-v3";
export const PHASE_4_5_4_6_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-5-4-6-v3";
export const PHASE_4_5_4_6_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PHASE_4_5_4_6_PLAN_REVISION = PHASE_4_4_PLAN_REVISION;
export const PHASE_4_5_4_6_ENVIRONMENTS = Object.freeze([
  "hosted",
  "android_chrome",
  "android_pwa",
]);

export function phase45V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase45_46_run_id_invalid");
  }
  return join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_ENVIRONMENT_EVIDENCE.json`,
  );
}

export function phase45EnvironmentUnits({
  environments = PHASE_4_5_4_6_ENVIRONMENTS,
  journeys = PHASE_4_3_JOURNEYS,
  repetitionCount = PHASE_4_4_REPETITION_COUNT,
} = {}) {
  const units = [];
  for (const environment of environments) {
    for (const journey of journeys) {
      for (let repetition = 1; repetition <= repetitionCount; repetition += 1) {
        units.push({
          unitKey: `${environment}:${journey.journeyId}:r${repetition}`,
          environment,
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

function safeErrorClass(error) {
  return String(error?.name || "Error").slice(0, 120);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const numeric = finiteNumber(value);
  return numeric == null ? null : Math.max(0, Math.round(numeric * 100) / 100);
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function runWithDeadline(task, timeoutMs = ENVIRONMENT_UNIT_TIMEOUT_MS) {
  let timeoutHandle;
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new Error("phase45_environment_unit_deadline_exceeded");
      error.code = "PHASE45_ENVIRONMENT_UNIT_DEADLINE";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(task), timeout]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

function timedOutEnvironmentResult({ unit, environment }) {
  return {
    unitKey: unit.unitKey,
    environment,
    journeyId: unit.journeyId,
    repetition: unit.repetition,
    status: "ENVIRONMENT_TIMEOUT",
    validSample: false,
    observationValidity: "INVALID",
    functionalOutcome: "INCOMPLETE",
    performanceOutcome: "NOT_EVALUABLE",
    failureBoundary: {
      phase: "environment_timeout",
      actionId: null,
      reason: "environment_unit_deadline_exceeded",
    },
    countedAsOfficialSample: false,
  };
}

function normalizeOrigin(value) {
  const parsed = new URL(String(value));
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("phase45_46_base_url_protocol_invalid");
  }
  return parsed.origin;
}

function gitOutput(args) {
  try {
    return String(execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    return null;
  }
}

function sourceIdentity({ hostedOrigin, release = null, device = null } = {}) {
  const sourcePaths = [
    "app/package.json",
    "app/scripts/performance-plan-1-phase-4.mjs",
    "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-phase-4-5-4-6.mjs",
    "app/scripts/performance-plan-1-phase-4-5-4-6.test.mjs",
    "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  ];
  return {
    worktreePath: repoRoot.replaceAll("\\", "/"),
    branchMode: gitOutput(["symbolic-ref", "--short", "-q", "HEAD"])
      ? "ATTACHED"
      : "DETACHED_HEAD",
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    detachedHeadUpstream: "NOT_AVAILABLE_BECAUSE_HEAD_IS_DETACHED",
    hostedOrigin,
    release: release
      ? {
          status: release.status,
          releaseId: release.releaseId,
          commit: release.commit,
          commitMatchesLocalHead: release.commitMatchesLocalHead,
        }
      : null,
    device: device
      ? {
          status: device.status,
          model: device.model,
          androidVersion: device.androidVersion,
          chromeVersionName: device.chromeVersionName,
          pwaStatus: device.pwa?.status ?? null,
        }
      : null,
    sourceFiles: sourcePaths.map((path) => ({
      path,
      exists: existsSync(join(repoRoot, path)),
      sha256: sha256File(join(repoRoot, path)),
    })),
    dirtyTreePreserved: true,
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
  };
}

function stripAndroidRuntime(value) {
  if (!value || typeof value !== "object") return value;
  const { runtime: ignoredRuntime, ...safe } = value;
  return safe;
}

function stripDeviceTarget(value) {
  const safe = stripAndroidRuntime(value);
  if (!safe || typeof safe !== "object") return safe;
  return {
    status: safe.status ?? "BLOCKED",
    reason: safe.reason ?? null,
    deviceCount: safe.deviceCount ?? null,
    authorizedDeviceCount: safe.authorizedDeviceCount ?? null,
    unauthorizedDeviceCount: safe.unauthorizedDeviceCount ?? null,
    offlineDeviceCount: safe.offlineDeviceCount ?? null,
    model: safe.model ?? null,
    androidVersion: safe.androidVersion ?? null,
    chromeVersionName: safe.chromeVersionName ?? null,
    chromeLaunchStatus: safe.chromeLaunchStatus ?? null,
    cdpForwardStatus: safe.cdpForwardStatus ?? null,
    pwa: safe.pwa
      ? {
          status: safe.pwa.status ?? null,
          reason: safe.pwa.reason ?? null,
          packageFound: safe.pwa.packageFound ?? null,
          candidateCount: safe.pwa.candidateCount ?? null,
          launchActivityStatus: safe.pwa.launchActivityStatus ?? null,
        }
      : null,
    connectionMonitoring: safe.connectionMonitoring ?? null,
    serialRecorded: false,
  };
}

export function androidSurfaceIsReady(state, {
  expectedOrigin,
  standaloneRequired = false,
} = {}) {
  return Boolean(
    state?.origin === expectedOrigin &&
      state?.online === true &&
      (standaloneRequired
        ? state.displayModeStandalone === true && state.serviceWorkerControlled === true
        : state.displayModeStandalone === false),
  );
}

async function readSurfaceState(page) {
  return page.evaluate(() => ({
    origin: window.location.origin,
    online: navigator.onLine === true,
    displayModeStandalone:
      window.matchMedia?.("(display-mode: standalone)")?.matches === true,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  })).catch(() => ({
    origin: null,
    online: false,
    displayModeStandalone: false,
    serviceWorkerControlled: false,
    userAgent: null,
    viewport: null,
  }));
}

async function checkHostedHealth(baseUrl, localHead) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(new URL("/api/health/release", baseUrl), {
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const commit = typeof payload.commit === "string" ? payload.commit : null;
    const status = typeof payload.status === "string" ? payload.status : null;
    return {
      status: response.status === 200 && status === "ok" ? "PASS" : "BLOCKED",
      httpStatus: response.status,
      serviceStatus: status,
      releaseId:
        typeof payload.releaseId === "string"
          ? payload.releaseId
          : typeof payload.release === "string"
            ? payload.release
            : null,
      commit,
      commitMatchesLocalHead: commit == null || commit === localHead,
      failureBoundary:
        response.status === 200 && status === "ok" ? null : "hosted_health",
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      httpStatus: null,
      serviceStatus: null,
      releaseId: null,
      commit: null,
      commitMatchesLocalHead: false,
      failureBoundary: "hosted_health",
      errorClass: safeErrorClass(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function hostedPreflight({ mainCheckoutRoot, baseUrl }) {
  let origin;
  try {
    origin = normalizeOrigin(baseUrl);
  } catch (error) {
    return {
      status: "BLOCKED",
      reason: "hosted_origin_invalid",
      origin: null,
      inputs: null,
      health: null,
      credentials: null,
      errorClass: safeErrorClass(error),
    };
  }
  const inputs = loadPhase4HostedInputs({ repoRoot: mainCheckoutRoot });
  if (
    inputs.status !== "READY" ||
    origin !== APPROVED_HOSTED_ORIGIN ||
    (inputs.status === "READY" && normalizeOrigin(inputs.baseUrl) !== origin)
  ) {
    return {
      status: "BLOCKED",
      reason:
        inputs.status !== "READY"
          ? inputs.reason
          : inputs.baseUrl && normalizeOrigin(inputs.baseUrl) !== origin
            ? "hosted_input_origin_mismatch"
          : "hosted_origin_not_approved",
      origin,
      inputs: {
        status: inputs.status,
        filePresent: inputs.filePresent,
        filePath: inputs.filePath,
        requiredKeys: inputs.requiredKeys,
        source: inputs.source ?? null,
      },
      health: null,
      credentials: {
        emailAvailable: Boolean(inputs.email),
        passwordAvailable: Boolean(inputs.password),
      },
    };
  }
  const localHead = gitOutput(["rev-parse", "HEAD"]);
  const health = await checkHostedHealth(origin, localHead);
  return {
    status: health.status === "PASS" && health.commitMatchesLocalHead ? "PASS" : "BLOCKED",
    reason:
      health.status !== "PASS"
        ? health.failureBoundary
        : health.commitMatchesLocalHead
          ? null
          : "hosted_release_commit_mismatch",
    origin,
    inputs: {
      status: inputs.status,
      filePresent: inputs.filePresent,
      filePath: inputs.filePath,
      requiredKeys: inputs.requiredKeys,
      source: inputs.source,
    },
    health,
    credentials: {
      emailAvailable: Boolean(inputs.email),
      passwordAvailable: Boolean(inputs.password),
    },
    email: inputs.email,
    password: inputs.password,
  };
}

async function findAndroidPage(browser, expectedOrigin, standaloneRequired) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((context) => context.pages());
  for (const page of pages) {
    const state = await readSurfaceState(page);
    if (androidSurfaceIsReady(state, { expectedOrigin, standaloneRequired })) {
      return { context: page.context(), page, state };
    }
  }
  return null;
}

async function waitForAndroidPage(browser, expectedOrigin, standaloneRequired) {
  const deadline = Date.now() + ANDROID_TARGET_WAIT_MS;
  while (Date.now() <= deadline) {
    const target = await findAndroidPage(browser, expectedOrigin, standaloneRequired);
    if (target) return { status: "PASS", target };
    await sleep(500);
  }
  return {
    status: "BLOCKED",
    reason: standaloneRequired
      ? "android_pwa_target_not_verified"
      : "android_chrome_target_not_verified",
    target: null,
  };
}

async function navigateAndroidPwaHostedTarget(browser, expectedOrigin, monitor) {
  const existingTarget = await findAndroidPage(browser, expectedOrigin, true);
  if (existingTarget) {
    return {
      status: "PASS",
      navigation: "existing_pwa_target",
      reason: null,
      target: existingTarget,
    };
  }

  const pages = browser.contexts().flatMap((context) => context.pages());
  let pwaTab = null;
  for (const page of pages.filter((candidate) => candidate.url().startsWith("chrome-error://"))) {
    const state = await page
      .evaluate(() => ({
        standalone: window.matchMedia?.("(display-mode: standalone)")?.matches === true,
      }))
      .catch(() => ({ standalone: false }));
    if (state.standalone) {
      pwaTab = page;
      break;
    }
  }
  if (!pwaTab) {
    return {
      status: "BLOCKED",
      navigation: "not_run",
      reason: "android_pwa_error_tab_not_found",
      target: null,
    };
  }

  const before = monitor?.check("android_pwa:before_error_tab_navigation");
  if (before && before.status !== "PASS") {
    return {
      status: "BLOCKED",
      navigation: "cdp_pwa_error_tab_navigation",
      reason: before.reason || "android_connection_lost_before_pwa_navigation",
      target: null,
    };
  }
  try {
    await pwaTab.goto(expectedOrigin, {
      waitUntil: "domcontentloaded",
      timeout: ENVIRONMENT_TIMEOUT_MS,
    });
  } catch {
    return {
      status: "BLOCKED",
      navigation: "cdp_pwa_error_tab_navigation",
      reason: "android_pwa_error_tab_navigation_failed",
      target: null,
    };
  }
  const after = monitor?.check("android_pwa:after_error_tab_navigation");
  if (after && after.status !== "PASS") {
    return {
      status: "BLOCKED",
      navigation: "cdp_pwa_error_tab_navigation",
      reason: after.reason || "android_connection_lost_after_pwa_navigation",
      target: null,
    };
  }
  const target = await waitForAndroidPage(browser, expectedOrigin, true);
  return target.status === "PASS"
    ? {
        status: "PASS",
        navigation: "cdp_pwa_error_tab_navigation",
        reason: null,
        target: target.target,
      }
    : {
        status: "BLOCKED",
        navigation: "cdp_pwa_error_tab_navigation",
        reason: target.reason || "android_pwa_target_not_verified",
        target: null,
      };
}

function mutationBuckets(requestSummary) {
  const all = (requestSummary?.requests ?? []).filter(
    (record) =>
      record.route.startsWith("/api/") &&
      !record.route.startsWith("/api/auth/") &&
      !["GET", "HEAD", "OPTIONS"].includes(record.method),
  );
  const expectedNavigation = all.filter((record) =>
    PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES.includes(record.route),
  );
  const expectedBackground = all.filter((record) =>
    PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES.includes(record.route),
  );
  return {
    expectedNavigation,
    expectedBackground,
    unexpected: all.filter(
      (record) =>
        !PHASE_4_4_EXPECTED_NAVIGATION_MUTATION_ROUTES.includes(record.route) &&
        !PHASE_4_4_EXPECTED_BACKGROUND_MUTATION_ROUTES.includes(record.route),
    ),
  };
}

function foregroundBodyFinishTimedOut({
  journey,
  requiredReads,
  expectedNavigation,
  j2DataReady,
}) {
  return Boolean(
    requiredReads.some((record) => record.valid !== true) ||
      (journey.journeyId === "J2" && j2DataReady.status !== "PASS") ||
      expectedNavigation.some(
        (record) =>
          !Number.isInteger(record.status) ||
          record.status < 200 ||
          record.status >= 300 ||
          record.bodyFinishedAtMs == null ||
          record.failed === true,
      ),
  );
}

async function runEnvironmentJourney({
  page,
  context,
  baseUrl,
  environment,
  journey,
  repetition,
  email,
  password,
  standaloneRequired,
  sourceSurfaceState,
  existingAuth = null,
  reuseSession = false,
}) {
  const unitKey = `${environment}:${journey.journeyId}:r${repetition}`;
  const capture = createRichRequestCapture(page);
  let trace = null;
  let requestSummary = null;
  let auth = null;
  let startNavigationReadyAt = null;
  const startedAtWallMs = Date.now();
  try {
    if (!reuseSession) await context.clearCookies();
    auth = existingAuth ?? await authenticateWithTiming(page, baseUrl, { email, password });
    if (existingAuth) {
      auth = {
        ...existingAuth,
        timing: { ...existingAuth.timing, reusedSurfaceSession: true },
      };
    }
    if (auth.status === "PASS") {
      const navigationStartedAt = Date.now();
      await page.goto(`${baseUrl}${journey.startRoute}`, {
        waitUntil: "domcontentloaded",
        timeout: ENVIRONMENT_TIMEOUT_MS,
      });
      await waitForReady(page, '[data-testid="authenticated-shell"]');
      startNavigationReadyAt = roundMs(Date.now() - navigationStartedAt);
      trace = await runDiagnosticJourney(page, journey, {
        mode: NORMAL_MODE,
        checkpoint: null,
      });
    }
    requestSummary = await capture.finish();
  } catch (error) {
    requestSummary = await capture.finish().catch(() => null);
    const result = {
      unitKey,
      environment,
      journeyId: journey.journeyId,
      repetition,
      status: "HARNESS_ERROR",
      validSample: false,
      observationValidity: "INVALID",
      functionalOutcome: "INCOMPLETE",
      performanceOutcome: "NOT_EVALUABLE",
      auth,
      targetSurface: sourceSurfaceState ?? null,
      failureBoundary: {
        phase: "harness",
        actionId: null,
        reason: "environment_journey_exception",
      },
      errorClass: safeErrorClass(error),
      elapsedMs: roundMs(Date.now() - startedAtWallMs),
      countedAsOfficialSample: false,
    };
    capture.dispose();
    return result;
  }
  capture.dispose();

  if (auth?.status !== "PASS" || !trace || !requestSummary) {
    return {
      unitKey,
      environment,
      journeyId: journey.journeyId,
      repetition,
      status: "AUTH_FAILED",
      validSample: false,
      observationValidity: "INVALID",
      functionalOutcome: "FAILURE",
      performanceOutcome: "NOT_EVALUABLE",
      auth,
      targetSurface: sourceSurfaceState ?? null,
      requestSummary,
      failureBoundary: {
        phase: "auth_session",
        actionId: null,
        reason: auth?.failureBoundary ?? "auth_failed",
      },
      countedAsOfficialSample: false,
    };
  }

  const targetSurface = await readSurfaceState(page);
  const surfaceReady = androidSurfaceIsReady(targetSurface, {
    expectedOrigin: normalizeOrigin(baseUrl),
    standaloneRequired,
  });
  const expectedRouteMatched = routeMatchesExpectedRoute(await page.url(), journey.expectedRoute);
  const requiredReads = requiredReadSummary(trace, journey);
  const buckets = mutationBuckets(requestSummary);
  const j2DataReady = evaluatePhase44J2PreloadedRead({
    journey,
    trace,
    requestSummary,
    auth,
  });
  const observation = classifyPhase44Observation({
    auth,
    trace,
    journey,
    j2DataReady,
    requiredReads,
    expectedRouteMatched,
    mutationRequests: buckets.unexpected,
    expectedMutationRequests: buckets.expectedNavigation,
  });
  const baseValidSample = isValidPhase44Sample({
    auth,
    trace,
    journey,
    j2DataReady,
    requiredReads,
    expectedRouteMatched,
    mutationRequests: buckets.unexpected,
    expectedMutationRequests: buckets.expectedNavigation,
  });
  const failureBoundary = surfaceReady
    ? observation.failureBoundary
    : {
        phase: "target_surface",
        actionId: null,
        reason: standaloneRequired
          ? "android_pwa_surface_not_verified"
          : "android_chrome_surface_not_verified",
      };
  const observationValidity = surfaceReady ? observation.observationValidity : "INVALID";
  const validSample = surfaceReady && baseValidSample;
  const foregroundTimeout = foregroundBodyFinishTimedOut({
    journey,
    requiredReads,
    expectedNavigation: buckets.expectedNavigation,
    j2DataReady,
  });
  const browserMetrics = await collectBrowserMetrics(page, NORMAL_MODE);
  trace.measurement = {
    unitKey,
    environment,
    mode: NORMAL_MODE,
    fixtureId: PHASE_4_4_FIXTURE_ID,
    repetition,
    scope: "phase4_5_4_6_environment_observation",
    countedAsOfficialSample: false,
    authSessionTiming: { ...auth.timing, status: auth.status },
    startRouteTiming: {
      navigationStartedAtMs: 0,
      authenticatedShellReadyAtMs: startNavigationReadyAt,
    },
    requestSummary: {
      ...requestSummary,
      requests: requestSummary.requests,
    },
    serverStoreTiming: {
      expected: PHASE_4_4_MODES[NORMAL_MODE].serverTiming,
      serverEnvironmentPatch: PHASE_4_4_MODES[NORMAL_MODE].serverEnvironmentPatch,
      observedResponseCount: requestSummary.serverTimingResponseCount,
      metrics: requestSummary.requests.flatMap((record) => record.serverTiming),
    },
    browserParseRenderTiming: {
      first: trace.actions.first,
      second: trace.actions.second,
    },
    phase44TraceValidation: validatePhase44TraceForJourney(trace, journey),
    longTasks: browserMetrics,
    targetSurface: {
      ...targetSurface,
      sourceSurfaceState: sourceSurfaceState ?? null,
      verified: surfaceReady,
    },
    requiredReads,
    j2DataReady,
    expectedRouteMatched,
    expectedMutationRequests: buckets.expectedNavigation,
    backgroundMutationRequests: buckets.expectedBackground,
    mutationRequests: buckets.unexpected,
    foregroundBodyFinishTimedOut: foregroundTimeout,
    failureBoundary,
    observationValidity,
    functionalOutcome: observation.functionalOutcome,
    firstActionOutcome: observation.firstActionOutcome,
    secondActionOutcome: observation.secondActionOutcome,
    performanceOutcome: observation.performanceOutcome,
    performanceBoundary: observation.performanceBoundary,
    validSample,
  };
  return {
    unitKey,
    environment,
    journeyId: journey.journeyId,
    repetition,
    status: validSample ? "VALID" : "INVALID",
    validSample,
    observationValidity,
    functionalOutcome: observation.functionalOutcome,
    performanceOutcome: observation.performanceOutcome,
    auth,
    targetSurface: trace.measurement.targetSurface,
    trace,
    failureBoundary,
    countedAsOfficialSample: false,
  };
}

function completedResultsFromEvents(events) {
  const latest = new Map();
  for (const event of events ?? []) {
    if (event.type !== "environment.unit.trace") continue;
    const result = event.payload;
    if (result?.unitKey) latest.set(result.unitKey, result);
  }
  return [...latest.values()];
}

function unitSummary(results, environment) {
  const samples = results.filter((result) => result.environment === environment);
  const observationValid = samples.filter((result) => result.observationValidity === "VALID");
  const valid = samples.filter((result) => result.validSample === true);
  const functional = samples.reduce(
    (summary, result) => {
      const key = result.functionalOutcome ?? "UNKNOWN";
      summary[key] = (summary[key] ?? 0) + 1;
      return summary;
    },
    {},
  );
  return {
    environment,
    plannedCount: phase45EnvironmentUnits({ environments: [environment] }).length,
    attemptedCount: samples.length,
    observationValidCount: observationValid.length,
    validSampleCount: valid.length,
    invalidObservationCount: samples.length - observationValid.length,
    functionalOutcomes: functional,
    status:
      samples.length === 9 && observationValid.length === samples.length
        ? "COMPLETE"
        : samples.length === 0
          ? "NOT_STARTED"
          : "BLOCKED",
  };
}

export function phase45StageStatuses({
  hostedPreflightStatus = "NOT_STARTED",
  devicePreflightStatus = "NOT_STARTED",
  results = [],
} = {}) {
  const hosted = unitSummary(results, "hosted");
  const chrome = unitSummary(results, "android_chrome");
  const pwa = unitSummary(results, "android_pwa");
  const hostedStatus =
    hostedPreflightStatus !== "PASS"
      ? hostedPreflightStatus === "BLOCKED" ? "BLOCKED" : "NOT_STARTED"
      : hosted.status;
  const deviceStatus =
    devicePreflightStatus !== "PASS"
      ? devicePreflightStatus === "BLOCKED" ? "BLOCKED" : "NOT_STARTED"
      : chrome.status === "COMPLETE" && pwa.status === "COMPLETE"
        ? "COMPLETE"
        : chrome.status === "NOT_STARTED" && pwa.status === "NOT_STARTED"
          ? "BLOCKED"
          : "BLOCKED";
  return {
    "4.5": hostedStatus,
    "4.6": deviceStatus,
    environmentSummaries: { hosted, android_chrome: chrome, android_pwa: pwa },
  };
}

function collectBlockers({ stageStatuses, preflights, results }) {
  const blockers = [];
  if (stageStatuses["4.5"] !== "COMPLETE") {
    blockers.push(preflights.hosted.reason || "hosted_observation_incomplete");
  }
  if (stageStatuses["4.6"] !== "COMPLETE") {
    blockers.push(
      preflights.device.reason ||
        (preflights.androidPwa.reason ?? null) ||
        "android_environment_observation_incomplete",
    );
  }
  for (const result of results) {
    if (result.observationValidity !== "VALID") {
      blockers.push(`invalid_observation:${result.unitKey}`);
    }
  }
  return [...new Set(blockers.filter(Boolean))];
}

function safeEnvironmentPreflights(preflights = {}) {
  const androidPwa = preflights.androidPwa?.status !== "NOT_RUN"
    ? preflights.androidPwa
    : preflights.device?.androidPwa;
  return {
    hosted: {
      status: preflights.hosted?.status ?? "BLOCKED",
      reason: preflights.hosted?.reason ?? null,
      origin: preflights.hosted?.origin ?? null,
      inputs: preflights.hosted?.inputs ?? null,
      health: preflights.hosted?.health ?? null,
      credentialsAvailable: preflights.hosted?.credentials ?? null,
    },
    device: {
      status: preflights.device?.status ?? "BLOCKED",
      reason: preflights.device?.reason ?? null,
      target: stripDeviceTarget(preflights.device?.target ?? preflights.device?.deviceTarget),
      connectionMonitoring: preflights.device?.connectionMonitoring ?? null,
      chromeLaunch: preflights.device?.chromeLaunch ?? null,
      chromeTarget: preflights.device?.chromeTarget ?? null,
      pwaTarget: preflights.device?.pwaTarget ?? null,
    },
    androidPwa: {
      status: androidPwa?.status ?? "NOT_RUN",
      reason: androidPwa?.reason ?? null,
      packageFound: androidPwa?.packageFound ?? null,
      packageLaunchStatus: androidPwa?.packageLaunchStatus ?? null,
      launchActivityStatus: androidPwa?.launchActivityStatus ?? null,
      target: androidPwa?.target ?? null,
      serialRecorded: false,
    },
  };
}

export function buildPhase45Evidence(result, {
  generatedAt = new Date().toISOString(),
  secretValues = [],
} = {}) {
  const results = result.results ?? [];
  const stageStatuses = result.stageStatuses ?? phase45StageStatuses({
    hostedPreflightStatus: result.preflights?.hosted?.status,
    devicePreflightStatus: result.preflights?.device?.status,
    results,
  });
  const rawEvidence = {
    schemaVersion: "aiya-performance-plan1-v3-phase4-5-4-6-evidence-v1",
    planRevision: PHASE_4_5_4_6_PLAN_REVISION,
    phase: "4",
    stage: "4.5-4.6",
    stageId: "4.5-4.6",
    runId: result.runId ?? null,
    generatedAt,
    status: result.status ?? "BLOCKED",
    outcome: result.outcome ?? null,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Capture matched hosted and physical Android/PWA observations for the expanded claim scope.",
      claimScope: "local_hosted_physical_android_chrome_pwa_common_interaction",
      environments: PHASE_4_5_4_6_ENVIRONMENTS,
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: results.length > 0,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      countedAsOfficialSample: false,
      preservedExistingChanges: true,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_4_5_4_6_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.1 IDENTITY_LOCKED",
        "4.2 REFERENCE_SEPARATED",
        "4.3 GENERAL_DIAGNOSTIC_HARNESS_READY",
        "4.4 LOCAL_CAPTURE_AND_OBSERVATION_CONTRACT",
      ],
      currentStages: ["4.5", "4.6"],
      nextEligibleStage: stageStatuses["4.5"] === "COMPLETE" && stageStatuses["4.6"] === "COMPLETE"
        ? "4.7"
        : "4.5-4.6",
    },
    sourceIdentity: result.sourceIdentity ?? null,
    parentRunReferences: [
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_PHASE_4_5_4_6_SCOPE_EVIDENCE.json",
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T075911349Z-64dd47c1-4cc0-4b6f-b1ff-6fe3b3373512_EVIDENCE.json",
    ],
    measurementIdentity: {
      checkpointPhaseId: PHASE_4_5_4_6_CHECKPOINT_PHASE_ID,
      checkpointSchemaVersion: PHASE_4_5_4_6_CHECKPOINT_SCHEMA_VERSION,
      checkpointStore: "tools/phase-execution/checkpoint-store.mjs",
      fixtureId: PHASE_4_4_FIXTURE_ID,
      fixtureClass: "authorized_hosted_synthetic_owner",
      journeyIds: PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
      repetitionsPerEnvironment: PHASE_4_4_REPETITION_COUNT,
      plannedUnitCount: phase45EnvironmentUnits().length,
      secondActionDelayMs: 2_000,
      mode: NORMAL_MODE,
      countedAsOfficialSample: false,
      supersedesRunId: result.supersedesRunId ?? null,
    },
    stageLedger: [
      {
        stageId: "4.5",
        name: "Hosted comparison observations",
        prerequisites: ["4.4 trustworthy local observation"],
        status: stageStatuses["4.5"],
      },
      {
        stageId: "4.6",
        name: "Physical Android Chrome and installed PWA observations",
        prerequisites: ["4.4 trustworthy local observation"],
        status: stageStatuses["4.6"],
      },
    ],
    stageScheduler: stageStatuses,
    environmentPreflight: safeEnvironmentPreflights(result.preflights),
    environmentSummary: stageStatuses.environmentSummaries,
    samples: results,
    sampleSummary: {
      attemptedSamples: results.length,
      plannedSamples: phase45EnvironmentUnits().length,
      observationValidSamples: results.filter((sample) => sample.observationValidity === "VALID").length,
      validSamples: results.filter((sample) => sample.validSample === true).length,
      functionalOutcomes: results.reduce((summary, sample) => {
        const key = sample.functionalOutcome ?? "UNKNOWN";
        summary[key] = (summary[key] ?? 0) + 1;
        return summary;
      }, {}),
      validSamplesAreNotOfficialBaseline: true,
      performanceOutcome: "NOT_EVALUABLE",
    },
    blockers: collectBlockers({
      stageStatuses,
      preflights: result.preflights ?? { hosted: {}, device: {}, androidPwa: {} },
      results,
    }),
    deferredEnvironments: [],
    constraints: [
      "No official nine-scenario baseline was started.",
      "No runtime change is accepted as a Plan 1 fix.",
      "Production remains NO-GO.",
      "No credentials, cookies, tokens, raw bodies, prompts, clinical data, or device serials are recorded.",
      "Historical v2 Android and Phase 4 evidence remains reference-only.",
    ],
    evidenceIntegrity: {
      historicalPhase4EvidenceRewritten: false,
      incompleteSamplesRemainInvalid: true,
      observedFailuresRemainNonSamples: true,
      officialMeasurementStarted: false,
      runtimeFixAccepted: false,
      redactionCheck: "PENDING",
    },
    closure: {
      status: result.status ?? "BLOCKED",
      outcome: result.outcome ?? null,
      phase4Closed: false,
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction:
        stageStatuses["4.5"] === "COMPLETE" && stageStatuses["4.6"] === "COMPLETE"
          ? "Proceed to 4.7 coverage and finding reconciliation; do not infer causality from environment observations."
          : "Preserve the blocked environment boundary and repair only the declared preflight or capture gap.",
    },
  };
  const evidence = sanitizeDiagnosticEvidence(rawEvidence);
  const redaction = redactionCheck(evidence, secretValues);
  evidence.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  evidence.evidenceIntegrity.redactionFailures = redaction.forbiddenValuesFound;
  return evidence;
}

async function runHostedUnits({ checkpoint, pendingKeys, preflight, units, results }) {
  if (preflight.status !== "PASS") return;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await installPhase44BrowserInstrumentation(page, NORMAL_MODE);
    let surfaceAuth = null;
    for (const unit of units.filter((item) => item.environment === "hosted")) {
      if (!pendingKeys.has(unit.unitKey)) continue;
      checkpoint.append("environment.unit.started", {
        unitKey: unit.unitKey,
        environment: unit.environment,
        journeyId: unit.journeyId,
        repetition: unit.repetition,
        countedAsOfficialSample: false,
      });
      let stopSurfaceAfterTimeout = false;
      try {
        const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === unit.journeyId);
        const result = await runWithDeadline(() => runEnvironmentJourney({
            page,
            context,
            baseUrl: preflight.origin,
            environment: unit.environment,
            journey,
            repetition: unit.repetition,
            email: preflight.email,
            password: preflight.password,
            standaloneRequired: false,
            sourceSurfaceState: { kind: "hosted_desktop_browser" },
            existingAuth: surfaceAuth,
            reuseSession: Boolean(surfaceAuth),
          }));
        if (result.auth?.status === "PASS") surfaceAuth = result.auth;
        results.push(result);
        checkpoint.append("environment.unit.trace", result);
        checkpoint.append("environment.unit.completed", {
          unitKey: unit.unitKey,
          environment: unit.environment,
          journeyId: unit.journeyId,
          repetition: unit.repetition,
          status: result.status,
          observationValidity: result.observationValidity,
          validSample: result.validSample,
          functionalOutcome: result.functionalOutcome,
          countedAsOfficialSample: false,
        });
      } catch (error) {
        const timedOut = error?.code === "PHASE45_ENVIRONMENT_UNIT_DEADLINE";
        const result = timedOut
          ? timedOutEnvironmentResult({ unit, environment: unit.environment })
          : {
              unitKey: unit.unitKey,
              environment: unit.environment,
              journeyId: unit.journeyId,
              repetition: unit.repetition,
              status: "ENVIRONMENT_BLOCKED",
              validSample: false,
              observationValidity: "INVALID",
              functionalOutcome: "INCOMPLETE",
              performanceOutcome: "NOT_EVALUABLE",
              failureBoundary: {
                phase: "hosted_capture",
                actionId: null,
                reason: "hosted_capture_failed",
                errorClass: safeErrorClass(error),
              },
              countedAsOfficialSample: false,
            };
        stopSurfaceAfterTimeout = timedOut;
        results.push(result);
        checkpoint.append("environment.unit.trace", result);
        checkpoint.append("environment.unit.completed", result);
      }
      if (stopSurfaceAfterTimeout) break;
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

async function runAndroidUnits({
  checkpoint,
  pendingKeys,
  units,
  results,
  baseUrl,
  email,
  password,
  deviceTarget,
  runtime,
  environment,
  browser,
  target,
  standaloneRequired,
  surfaceAuth = null,
}) {
  if (!target) return;
  const page = target.page;
  const context = target.context;
  await installPhase44BrowserInstrumentation(page, NORMAL_MODE);
  let currentSurfaceAuth = surfaceAuth;
  for (const unit of units.filter((item) => item.environment === environment)) {
    if (!pendingKeys.has(unit.unitKey)) continue;
    checkpoint.append("environment.unit.started", {
      unitKey: unit.unitKey,
      environment: unit.environment,
      journeyId: unit.journeyId,
      repetition: unit.repetition,
      countedAsOfficialSample: false,
    });
    const monitorState = runtime?.monitor?.check(`${environment}:${unit.unitKey}`);
    if (monitorState && monitorState.status !== "PASS") {
      const result = {
        unitKey: unit.unitKey,
        environment,
        journeyId: unit.journeyId,
        repetition: unit.repetition,
        status: "ENVIRONMENT_BLOCKED",
        validSample: false,
        observationValidity: "INVALID",
        functionalOutcome: "INCOMPLETE",
        performanceOutcome: "NOT_EVALUABLE",
        failureBoundary: {
          phase: "android_connection",
          actionId: null,
          reason: monitorState.reason || "android_connection_lost",
        },
        countedAsOfficialSample: false,
      };
      results.push(result);
      checkpoint.append("environment.unit.trace", result);
      checkpoint.append("environment.unit.completed", result);
      continue;
    }
    const journey = PHASE_4_3_JOURNEYS.find((item) => item.journeyId === unit.journeyId);
    let result;
    let stopSurfaceAfterTimeout = false;
    try {
      result = await runWithDeadline(() => runEnvironmentJourney({
          page,
          context,
          baseUrl,
          environment,
          journey,
          repetition: unit.repetition,
          email,
          password,
          standaloneRequired,
          sourceSurfaceState: {
            kind: environment === "android_pwa" ? "installed_android_pwa" : "android_chrome",
            device: stripDeviceTarget(deviceTarget),
          },
          existingAuth: currentSurfaceAuth,
          reuseSession: Boolean(currentSurfaceAuth),
        }));
    } catch (error) {
      const timedOut = error?.code === "PHASE45_ENVIRONMENT_UNIT_DEADLINE";
      result = timedOut
        ? timedOutEnvironmentResult({ unit, environment })
        : {
            unitKey: unit.unitKey,
            environment,
            journeyId: unit.journeyId,
            repetition: unit.repetition,
            status: "ENVIRONMENT_BLOCKED",
            validSample: false,
            observationValidity: "INVALID",
            functionalOutcome: "INCOMPLETE",
            performanceOutcome: "NOT_EVALUABLE",
            failureBoundary: {
              phase: "android_capture",
              actionId: null,
              reason: "android_capture_failed",
              errorClass: safeErrorClass(error),
            },
            countedAsOfficialSample: false,
          };
      stopSurfaceAfterTimeout = timedOut;
    }
    if (result.auth?.status === "PASS") currentSurfaceAuth = result.auth;
    results.push(result);
    checkpoint.append("environment.unit.trace", result);
    checkpoint.append("environment.unit.completed", {
      unitKey: unit.unitKey,
      environment,
      journeyId: unit.journeyId,
      repetition: unit.repetition,
      status: result.status,
      observationValidity: result.observationValidity,
      validSample: result.validSample,
      functionalOutcome: result.functionalOutcome,
      countedAsOfficialSample: false,
    });
    if (stopSurfaceAfterTimeout) break;
  }
}

async function runAndroidSurfaces({
  checkpoint,
  pendingKeys,
  units,
  results,
  baseUrl,
  preflight,
  deviceTarget,
  runtime,
}) {
  if (preflight.status !== "PASS" || !runtime) return;
  const origin = normalizeOrigin(baseUrl);
  let browser = null;
  try {
    const chromeLaunch = launchAndroidChromeTarget(deviceTarget, runtime, baseUrl);
    preflight.chromeLaunch = {
      status: chromeLaunch.status,
      reason: chromeLaunch.reason ?? null,
      launchStatus: chromeLaunch.launchStatus ?? null,
      serialRecorded: false,
    };
    if (chromeLaunch.status === "PASS") {
      browser = await connectPhase4AndroidCdp();
      const navigation = await navigateAndroidChromeHostedTarget(
        browser,
        origin,
        runtime.monitor,
        "phase45_android_chrome",
      );
      preflight.chromeTarget = {
        status: navigation.status,
        navigation: navigation.navigation,
        reason: navigation.reason ?? null,
      };
      if (navigation.status === "PASS") {
        await runAndroidUnits({
          checkpoint,
          pendingKeys,
          units,
          results,
          baseUrl,
          email: preflight.email,
          password: preflight.password,
          deviceTarget,
          runtime,
          environment: "android_chrome",
          browser,
          target: navigation.target,
          standaloneRequired: false,
        });
      }
    }
  } catch (error) {
    preflight.chromeTarget = {
      status: "BLOCKED",
      reason: "android_chrome_capture_connection_failed",
      errorClass: safeErrorClass(error),
    };
  } finally {
    if (browser) {
      try {
        disconnectCdpBrowser(browser);
      } catch {
        // The connection is best-effort closed without closing the phone app.
      }
      browser = null;
    }
  }

  const independentLaunch = launchInstalledPwa(deviceTarget, runtime);
  preflight.androidPwa = {
    status: independentLaunch.status,
    reason: independentLaunch.reason ?? null,
    packageFound: independentLaunch.packageFound ?? false,
    packageLaunchStatus: independentLaunch.packageLaunchStatus ?? null,
    launchActivityStatus: independentLaunch.launchActivityStatus ?? null,
    serialRecorded: false,
  };
  if (independentLaunch.status !== "PASS") return;

  try {
    browser = await connectPhase4AndroidCdp();
    const targetResult = await navigateAndroidPwaHostedTarget(
      browser,
      origin,
      runtime.monitor,
    );
    preflight.pwaTarget = {
      status: targetResult.status,
      reason: targetResult.reason ?? null,
    };
    if (targetResult.status === "PASS") {
      await runAndroidUnits({
        checkpoint,
        pendingKeys,
        units,
        results,
        baseUrl,
        email: preflight.email,
        password: preflight.password,
        deviceTarget,
        runtime,
        environment: "android_pwa",
        browser,
        target: targetResult.target,
        standaloneRequired: true,
      });
    }
  } catch (error) {
    preflight.pwaTarget = {
      status: "BLOCKED",
      reason: "android_pwa_capture_connection_failed",
      errorClass: safeErrorClass(error),
    };
  } finally {
    if (browser) {
      try {
        disconnectCdpBrowser(browser);
      } catch {
        // Best effort only; device state remains untouched.
      }
    }
  }
}

async function runPhase45And46({
  newRun = false,
  mainCheckoutRoot = DEFAULT_MAIN_CHECKOUT_ROOT,
  baseUrl = APPROVED_HOSTED_ORIGIN,
} = {}) {
  const normalizedBaseUrl = normalizeOrigin(baseUrl);
  const localHead = gitOutput(["rev-parse", "HEAD"]);
  const hosted = await hostedPreflight({
    mainCheckoutRoot,
    baseUrl: normalizedBaseUrl,
  });
  const rawDeviceTarget = collectAndroidTarget({ includeRuntime: true });
  const deviceTarget = stripDeviceTarget(rawDeviceTarget);
  const runtime = rawDeviceTarget?.runtime ?? null;
  const device = {
    status: rawDeviceTarget?.status ?? "BLOCKED",
    reason: rawDeviceTarget?.reason ?? null,
    target: deviceTarget,
    connectionMonitoring: deviceTarget?.connectionMonitoring ?? null,
  };
  const preflights = {
    hosted,
    device: {
      status: device.status === "READY_FOR_CDP_CAPTURE" ? "PASS" : "BLOCKED",
      reason: device.reason,
      target: deviceTarget,
      connectionMonitoring: deviceTarget?.connectionMonitoring ?? null,
      deviceTarget,
      runtime,
      email: hosted.email,
      password: hosted.password,
    },
    androidPwa: { status: "NOT_RUN", reason: null },
  };
  const identity = sourceIdentity({
    hostedOrigin: normalizedBaseUrl,
    release: hosted.health,
    device: deviceTarget,
  });
  const units = phase45EnvironmentUnits();
  const metadata = {
    identitySummary: {
      planRevision: PHASE_4_5_4_6_PLAN_REVISION,
      hostedOrigin: normalizedBaseUrl,
      environments: PHASE_4_5_4_6_ENVIRONMENTS,
      repetitionCount: PHASE_4_4_REPETITION_COUNT,
      officialMeasurementStarted: false,
    },
    plannedUnitKeys: units.map((unit) => unit.unitKey),
    countedAsOfficialSample: false,
  };
  let opened = openPhaseRun({
    root: PHASE_4_5_4_6_CHECKPOINT_ROOT,
    phaseId: PHASE_4_5_4_6_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_5_4_6_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata,
    newRun,
    redact: sanitizeDiagnosticEvidence,
  });
  let supersedesRunId = null;
  if (opened.action === "STALE" && !newRun) {
    supersedesRunId = opened.manifest?.runId ?? null;
    opened = openPhaseRun({
      root: PHASE_4_5_4_6_CHECKPOINT_ROOT,
      phaseId: PHASE_4_5_4_6_CHECKPOINT_PHASE_ID,
      phaseSchemaVersion: PHASE_4_5_4_6_CHECKPOINT_SCHEMA_VERSION,
      identity,
      metadata: {
        ...metadata,
        identityChange: {
          reason: "environment_runner_or_target_identity_changed",
          supersedesRunId,
          priorRunPreserved: true,
        },
      },
      newRun: true,
      redact: sanitizeDiagnosticEvidence,
    });
  }

  if (opened.action === "COMPLETE") {
    const existing = readPhaseRun({
      root: PHASE_4_5_4_6_CHECKPOINT_ROOT,
      phaseId: PHASE_4_5_4_6_CHECKPOINT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    const results = completedResultsFromEvents(existing.events);
    const stageStatuses = phase45StageStatuses({
      hostedPreflightStatus: "PASS",
      devicePreflightStatus: "PASS",
      results,
    });
    return {
      status: "COMPLETE",
      outcome: "ENVIRONMENT_OBSERVATIONS_CAPTURED",
      runId: opened.manifest.runId,
      resumed: true,
      sourceIdentity: identity,
      preflights,
      results,
      stageStatuses,
      supersedesRunId,
      secretValues: [hosted.email, hosted.password],
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      status: "BLOCKED",
      outcome: "ENVIRONMENT_CHECKPOINT_NOT_RUN",
      runId: opened.manifest?.runId ?? null,
      resumed: opened.resumed === true,
      sourceIdentity: identity,
      preflights,
      results: [],
      stageStatuses: phase45StageStatuses({
        hostedPreflightStatus: hosted.status,
        devicePreflightStatus: preflights.device.status,
      }),
      supersedesRunId,
      secretValues: [hosted.email, hosted.password],
    };
  }
  const checkpoint = opened.run;
  checkpoint.append("environment.contract.bound", {
    phase: "4",
    stages: ["4.5", "4.6"],
    planRevision: PHASE_4_5_4_6_PLAN_REVISION,
    environments: PHASE_4_5_4_6_ENVIRONMENTS,
    plannedUnitKeys: units.map((unit) => unit.unitKey),
    countedAsOfficialSample: false,
  });
  checkpoint.append("environment.preflight", {
    hosted: { ...hosted, email: undefined, password: undefined },
    device: { ...preflights.device, runtime: undefined, email: undefined, password: undefined },
    countedAsOfficialSample: false,
  });
  const existingResults = completedResultsFromEvents(checkpoint.events);
  const completedKeys = new Set(existingResults.map((result) => result.unitKey));
  const pendingKeys = new Set(units.map((unit) => unit.unitKey).filter((key) => !completedKeys.has(key)));
  const results = [...existingResults];
  try {
    await runHostedUnits({
      checkpoint,
      pendingKeys,
      preflight: hosted,
      units,
      results,
    });
    await runAndroidSurfaces({
      checkpoint,
      pendingKeys,
      units,
      results,
      baseUrl: normalizedBaseUrl,
      preflight: preflights.device,
      deviceTarget: rawDeviceTarget,
      runtime,
    });
    if (preflights.device.androidPwa) {
      preflights.androidPwa = preflights.device.androidPwa;
    }
    const stageStatuses = phase45StageStatuses({
      hostedPreflightStatus: hosted.status,
      devicePreflightStatus: preflights.device.status,
      results,
    });
    const allComplete = stageStatuses["4.5"] === "COMPLETE" && stageStatuses["4.6"] === "COMPLETE";
    checkpoint.markStatus(allComplete ? "COMPLETE" : "BLOCKED", {
      reason: allComplete
        ? "phase45_46_environment_observations_captured"
        : "phase45_46_environment_observations_incomplete",
      stageStatuses,
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      status: allComplete ? "COMPLETE" : "BLOCKED",
      outcome: allComplete
        ? "ENVIRONMENT_OBSERVATIONS_CAPTURED"
        : "ENVIRONMENT_OBSERVATIONS_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      sourceIdentity: identity,
      preflights,
      results,
      stageStatuses,
      supersedesRunId,
      secretValues: [hosted.email, hosted.password],
    };
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "environment_runner_exception",
      errorClass: safeErrorClass(error),
      countedAsOfficialSample: false,
    });
    checkpoint.close();
    return {
      status: "BLOCKED",
      outcome: "ENVIRONMENT_RUN_BLOCKED",
      runId: checkpoint.runId,
      resumed: opened.resumed,
      sourceIdentity: identity,
      preflights,
      results,
      stageStatuses: phase45StageStatuses({
        hostedPreflightStatus: hosted.status,
        devicePreflightStatus: preflights.device.status,
        results,
      }),
      reason: "environment_runner_exception",
      errorClass: safeErrorClass(error),
      supersedesRunId,
      secretValues: [hosted.email, hosted.password],
    };
  }
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    newRun: false,
    writeEvidence: false,
    baseUrl: process.env.AIYA_PHASE45_HOSTED_BASE_URL || APPROVED_HOSTED_ORIGIN,
    mainCheckoutRoot:
      process.env.AIYA_MAIN_CHECKOUT_ROOT || DEFAULT_MAIN_CHECKOUT_ROOT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else if (arg === "--main-checkout-root") options.mainCheckoutRoot = argv[++index];
    else throw new Error(`phase45_46_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify(inspectPhaseRuns({
      root: PHASE_4_5_4_6_CHECKPOINT_ROOT,
      phaseId: PHASE_4_5_4_6_CHECKPOINT_PHASE_ID,
    }), null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write(
      "Plan 1 v3 hosted/device runner ready. Use --run for explicit 4.5/4.6 observations.\n",
    );
    return;
  }
  const result = await runPhase45And46(options);
  const evidence = buildPhase45Evidence(result, {
    secretValues: result.secretValues,
  });
  if (options.writeEvidence && result.runId) {
    writeFileSync(
      phase45V3EvidencePath(result.runId),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  }
  process.stdout.write(`${JSON.stringify({
    runId: evidence.runId,
    status: evidence.status,
    outcome: evidence.outcome,
    stageLedger: evidence.stageLedger,
    environmentSummary: evidence.environmentSummary,
    sampleSummary: evidence.sampleSummary,
    blockers: evidence.blockers,
    evidenceIntegrity: evidence.evidenceIntegrity,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
