import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  PHASE_2_BUDGETS,
  PHASE_2_HARNESS_CONTRACT,
  PHASE_2_SCENARIOS,
} from "./measure-aiya-performance-phase-2.mjs";
import {
  PHASE_4_APPROVED_HOSTED_ORIGIN,
  PHASE_4_ENVIRONMENTS,
  PHASE_4_ACTION_CLICK_TIMEOUT_MS,
  clickRealActionableTarget,
  parseAdbDeviceInventory,
  parseInstalledPwaPackages,
  parseResolvedAndroidActivity,
  PHASE_4_SHELL_PREFERENCES_PATCH,
  PHASE_4_SCENARIOS,
  PHASE_4_MAX_ATTEMPTS,
  PHASE_4_SAMPLE_COUNT,
  PHASE_4_WARM_SETUP_MODE,
  selectInstalledPwaPackage,
  navigateAndroidChromeHostedTarget,
  calculateTaskReadyMs,
  classifyPhase4Sample,
  describeHarnessError,
  evaluatePhase4MeasurementStartGate,
  evaluatePhase4Closure,
  hostedConfiguration,
  releaseIdentityIsHealthy,
  routeMatches,
  sanitizePhase4Evidence,
  sanitizeRoute,
  sanitizeTargetUrl,
  summarizeCapturedScenario,
} from "./performance-plan-1-phase-4.mjs";
import {
  collectPhase4MeasurementIdentity,
  loadPhase4HostedInputs,
  PHASE_4_HOSTED_ENV_KEYS,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const repoRoot = join(import.meta.dirname, "..", "..");

function validProfile(profileId = "test-profile") {
  return {
    status: "PASS",
    profileId,
    runsPerScenario: PHASE_4_SAMPLE_COUNT,
    scenarios: PHASE_4_SCENARIOS.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      sampleCount: PHASE_4_SAMPLE_COUNT,
      validityStatus: "PASS",
      freezeStatus: "NOT_REPRODUCED",
    })),
  };
}

function validEnvironment(environment, profileId) {
  return {
    environment,
    status: "PASS",
    profiles: [validProfile(profileId || environment)],
  };
}

test("Phase 4 uses the locked nine-scenario and twenty-sample contract", () => {
  assert.equal(PHASE_2_SCENARIOS.length, 9);
  assert.equal(PHASE_2_HARNESS_CONTRACT.sampleCountPerScenario, 20);
  assert.equal(PHASE_4_SAMPLE_COUNT, 20);
  assert.ok(PHASE_4_MAX_ATTEMPTS >= PHASE_4_SAMPLE_COUNT);
  assert.deepEqual(
    PHASE_4_SCENARIOS.find((scenario) => scenario.scenarioId === "client_roster")
      ?.requiredReads,
    ["/api/shell/bootstrap"],
  );
  assert.deepEqual(
    PHASE_4_SCENARIOS.find((scenario) => scenario.scenarioId === "client_forms_workspace")
      ?.requiredReads,
    ["/api/clients/:clientId/forms"],
  );
  assert.deepEqual(
    PHASE_4_SCENARIOS.find((scenario) => scenario.scenarioId === "nutrition_workspace")
      ?.requiredReads,
    ["/api/clients/:clientId/food-rule-profile"],
  );
  assert.deepEqual(
    PHASE_4_SCENARIOS.find((scenario) => scenario.scenarioId === "menu_workspace")
      ?.requiredReads,
    ["/api/clients/:clientId/menu-plans"],
  );
  assert.deepEqual(PHASE_4_ENVIRONMENTS, [
    "local_desktop",
    "owner_pc_hosted",
    "android_chrome",
    "installed_android_pwa",
  ]);
  assert.equal(PHASE_2_BUDGETS.warmNavigationReadyP75Ms, 1000);
  assert.equal(PHASE_4_ACTION_CLICK_TIMEOUT_MS, 20_000);
  assert.equal(
    PHASE_4_WARM_SETUP_MODE,
    "same_authenticated_context_real_click_without_page_reload",
  );
});

test("Phase 4 accounts for current shell preference persistence on warm navigation", () => {
  for (const scenario of PHASE_4_SCENARIOS) {
    if (scenario.transitionMode === "warm") {
      assert.ok(scenario.allowedMutations.includes(PHASE_4_SHELL_PREFERENCES_PATCH));
    } else {
      assert.ok(!scenario.allowedMutations.includes(PHASE_4_SHELL_PREFERENCES_PATCH));
    }
  }
});

test("Phase 4 loads the approved hosted.env file without exposing its values", () => {
  const loaded = loadPhase4HostedInputs({ repoRoot });
  assert.equal(loaded.status, "READY");
  assert.equal(loaded.filePresent, true);
  assert.equal(loaded.source, "hosted_env_file");
  assert.deepEqual(loaded.requiredKeys, Object.fromEntries(PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, true])));
  const configuration = hostedConfiguration();
  assert.equal(configuration.status, "READY");
  assert.equal(configuration.baseUrl, PHASE_4_APPROVED_HOSTED_ORIGIN);
  assert.equal(JSON.stringify({ filePath: loaded.filePath, requiredKeys: loaded.requiredKeys }).includes("@"), false);
});

test("Phase 4 blocks missing hosted.env and process-environment-only fallback", () => {
  const loaded = loadPhase4HostedInputs({
    repoRoot: join(repoRoot, ".manu-runtime", "performance-phase4", "missing-root"),
    environment: Object.fromEntries(PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, "provided"])),
  });
  assert.equal(loaded.status, "BLOCKED");
  assert.equal(loaded.reason, "hosted_env_file_missing");
});

test("Phase 4 does not fill a missing hosted.env key from process environment", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "aiya-phase4-hosted-env-"));
  const envDirectory = join(temporaryRoot, ".manu-runtime", "performance-phase4");
  const envPath = join(envDirectory, "hosted.env");
  try {
    mkdirSync(envDirectory, { recursive: true });
    writeFileSync(
      envPath,
      "AIYA_PHASE4_HOSTED_BASE_URL=https://65-21-52-249.sslip.io\n" +
        "AIYA_PHASE4_HOSTED_EMAIL=synthetic@example.invalid\n",
      "utf8",
    );
    const loaded = loadPhase4HostedInputs({
      repoRoot: temporaryRoot,
      environment: { AIYA_PHASE4_HOSTED_PASSWORD: "process-only-secret" },
    });
    assert.equal(loaded.status, "BLOCKED");
    assert.equal(loaded.reason, "hosted_env_required_key_missing");
    assert.deepEqual(loaded.missingKeys, ["AIYA_PHASE4_HOSTED_PASSWORD"]);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Phase 4 blocks a process environment value that conflicts with hosted.env", () => {
  const loaded = loadPhase4HostedInputs({
    repoRoot,
    environment: { AIYA_PHASE4_HOSTED_BASE_URL: "https://example.invalid" },
  });
  assert.equal(loaded.status, "BLOCKED");
  assert.equal(loaded.reason, "hosted_env_source_conflict");
  assert.deepEqual(loaded.conflicts, ["AIYA_PHASE4_HOSTED_BASE_URL"]);
});

test("Phase 4 health gate requires HTTP 200 and an ok API status", () => {
  assert.equal(releaseIdentityIsHealthy({ status: 200, apiStatus: "ok" }), true);
  assert.equal(releaseIdentityIsHealthy({ status: 200, apiStatus: "error" }), false);
  assert.equal(releaseIdentityIsHealthy({ status: 503, apiStatus: "ok" }), false);
});

test("Phase 4 classifies ADB authorization states without accepting an unauthorized target", () => {
  const inventory = parseAdbDeviceInventory(
    "List of devices attached\n" +
      "authorized device product:test model:SM-S721B\n" +
      "waiting unauthorized\n" +
      "stale offline\n",
  );
  assert.equal(inventory.entries.length, 3);
  assert.equal(inventory.authorized.length, 1);
  assert.equal(inventory.unauthorized.length, 1);
  assert.equal(inventory.offline.length, 1);
  assert.equal(inventory.authorized[0].serial, "authorized");
});

test("Phase 4 discovers exactly one installed WebAPK and rejects ambiguous candidates", () => {
  const packageList =
    "package:org.chromium.webapk.a7748b3f7b57f800f_v2\n" +
    "package:com.android.chrome\n";
  assert.deepEqual(parseInstalledPwaPackages(packageList), [
    "org.chromium.webapk.a7748b3f7b57f800f_v2",
  ]);
  const selected = selectInstalledPwaPackage(packageList);
  assert.equal(selected.status, "READY_FOR_LAUNCH");
  assert.equal(selected.packageName, "org.chromium.webapk.a7748b3f7b57f800f_v2");
  const ambiguous = selectInstalledPwaPackage(
    "package:org.chromium.webapk.one_v2\npackage:org.chromium.webapk.two_v2\n",
  );
  assert.equal(ambiguous.status, "BLOCKED");
  assert.equal(ambiguous.reason, "multiple_installed_pwa_candidates_ambiguous");
});

test("Phase 4 resolves an installed PWA launch activity from package-manager output", () => {
  assert.equal(
    parseResolvedAndroidActivity(
      "priority=0 preferredOrder=0 match=0x108000\n" +
        "org.chromium.webapk.a7748b3f7b57f800f_v2/org.chromium.webapk.shell_apk.h2o.H2OOpaqueMainActivity\n",
    ),
    "org.chromium.webapk.a7748b3f7b57f800f_v2/org.chromium.webapk.shell_apk.h2o.H2OOpaqueMainActivity",
  );
  assert.equal(parseResolvedAndroidActivity("No activity found"), null);
});

test("Phase 4 opens the hosted origin in a normal Android Chrome tab after an intent leaves new tab", async () => {
  const origin = PHASE_4_APPROVED_HOSTED_ORIGIN;
  let currentUrl = "chrome-native://newtab/";
  const checkpoints = [];
  let context;
  const page = {
    url: () => currentUrl,
    context: () => context,
    goto: async (url) => {
      currentUrl = url;
    },
    evaluate: async () => ({
      origin: currentUrl.startsWith(origin) ? origin : "null",
      displayModeStandalone: false,
      serviceWorkerControlled: currentUrl.startsWith(origin),
      online: true,
    }),
  };
  context = { pages: () => [page] };
  const browser = { contexts: () => [context] };
  const monitor = {
    check(checkpoint) {
      checkpoints.push(checkpoint);
      return { status: "PASS", reason: null };
    },
  };

  const result = await navigateAndroidChromeHostedTarget(
    browser,
    `${origin}/login?next=/dashboard`,
    monitor,
    "android",
  );

  assert.equal(result.status, "PASS");
  assert.equal(result.navigation, "cdp_normal_tab_navigation");
  assert.equal(result.reason, null);
  assert.equal(result.target.page, page);
  assert.deepEqual(checkpoints, [
    "android:before_normal_tab_navigation",
    "android:after_normal_tab_navigation",
  ]);
});

test("Phase 4 preserves the approved target origin while removing URL query data", () => {
  assert.equal(
    sanitizeTargetUrl("https://65-21-52-249.sslip.io/login?next=/dashboard#fragment"),
    "https://65-21-52-249.sslip.io/login",
  );
});

test("Phase 4 source contains the hosted preflight before baseline execution", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /loadPhase4HostedInputs/);
  assert.match(source, /verifyHostedAccess/);
  assert.match(source, /hostedPreflight\.status === "PASS"/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /waitForResponse\(/);
  assert.match(source, /\.catch\(\(\) => null\)/);
  assert.match(source, /password_login_response_not_observed/);
});

test("Phase 4 baseline binds readiness evidence to the measurement start", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /runPhase4ReadinessGate\(\)/);
  assert.match(source, /phase4ReadinessEvidencePath/);
  assert.match(source, /measurementStartGate\.status === "PASS"/);
  assert.match(source, /reuseReadinessBuild\(/);
  assert.match(source, /hostedInputsStable/);
  assert.match(source, /localInputsStable/);
  assert.match(source, /startLocalServer\(build\.env/);
});

test("Phase 4 cannot run a baseline outside an active remeasurement cycle", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /phase4_active_cycle_requires_cycle_id/);
  assert.match(source, /phase4_remeasurement_cycle_not_ready/);
  assert.match(source, /phase\.cycle\.remeasurement\.started/);
});

function completeReadinessEvidence(measurementIdentity) {
  return {
    runId: "aiya-phase4-readiness-test-run",
    status: "COMPLETE",
    outcome: "READY_FOR_PHASE4_BASELINE",
    executionMode: "readiness_only",
    measurementIdentity,
    stageLedger: ["H1", "H2", "H3", "H4"].map((stageId) => ({
      stageId,
      status: "COMPLETE",
      blockingReason: null,
      verificationResults:
        stageId === "H3"
          ? {
              hosted: {
                authentication: {
                  status: "PASS",
                  input: {
                    status: "READY",
                    source: "hosted_env_file",
                    fileSource: "repo_runtime_file",
                    filePath: "C:/workspace/.manu-runtime/performance-phase4/hosted.env",
                    requiredKeys: {
                      AIYA_PHASE4_HOSTED_BASE_URL: true,
                      AIYA_PHASE4_HOSTED_EMAIL: true,
                      AIYA_PHASE4_HOSTED_PASSWORD: true,
                    },
                  },
                  health: { status: "PASS" },
                  login: {
                    status: 200,
                    authenticated: true,
                    workspaceOpened: true,
                    shellVisible: true,
                    loginVisible: false,
                  },
                  requiredRead: {
                    route: "/api/shell/bootstrap",
                    status: "PASS",
                    bodyFinished: true,
                  },
                },
              },
            }
          : stageId === "H4"
            ? { baselineStarted: false }
            : {},
    })),
    environmentMatrix: {
      localDesktop: { status: "PASS", baselineStatus: "NOT_RUN" },
      ownerPcHosted: { status: "PASS", baselineStatus: "NOT_RUN" },
      androidChrome: { status: "PASS", baselineStatus: "NOT_RUN" },
      installedAndroidPwa: { status: "PASS", baselineStatus: "NOT_RUN" },
    },
    tests: [{ status: "PASS" }],
    closure: {
      testsPass: true,
      evidenceIntegrityPass: true,
    },
    evidenceIntegrity: { status: "PASS" },
    constraints: { baselineStarted: false },
  };
}

test("Phase 4 measurement start gate accepts only a complete readiness contract", () => {
  const identity = collectPhase4MeasurementIdentity({ repoRoot });
  const result = evaluatePhase4MeasurementStartGate({
    commandResult: { status: 0, exitCode: 0, timedOut: false },
    readinessEvidence: completeReadinessEvidence(identity),
    measurementIdentityAtStart: identity,
    hostedInputsStable: true,
    localInputsStable: true,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.reason, null);
  assert.equal(result.hostedInputSource, "repo_runtime_file");
  assert.equal(result.baselineStarted, false);
});

test("Phase 4 measurement start gate blocks a readiness stage failure before measurement", () => {
  const identity = collectPhase4MeasurementIdentity({ repoRoot });
  const evidence = completeReadinessEvidence(identity);
  evidence.stageLedger[2].status = "BLOCKED";
  const result = evaluatePhase4MeasurementStartGate({
    commandResult: { status: 0, exitCode: 0, timedOut: false },
    readinessEvidence: evidence,
    measurementIdentityAtStart: identity,
    hostedInputsStable: true,
    localInputsStable: true,
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, "measurement_readiness_stage_gate_failed");
});

test("Phase 4 measurement start gate blocks changed inputs or artifact identity", () => {
  const identity = collectPhase4MeasurementIdentity({ repoRoot });
  const evidence = completeReadinessEvidence(identity);
  const changedIdentity = { ...identity, sourceFingerprint: "changed-after-readiness" };
  const changedHostedInputs = evaluatePhase4MeasurementStartGate({
    commandResult: { status: 0, exitCode: 0, timedOut: false },
    readinessEvidence: evidence,
    measurementIdentityAtStart: identity,
    hostedInputsStable: false,
    localInputsStable: true,
  });
  assert.equal(changedHostedInputs.status, "BLOCKED");
  assert.equal(changedHostedInputs.reason, "measurement_start_hosted_inputs_changed");
  const changedIdentityResult = evaluatePhase4MeasurementStartGate({
    commandResult: { status: 0, exitCode: 0, timedOut: false },
    readinessEvidence: evidence,
    measurementIdentityAtStart: changedIdentity,
    hostedInputsStable: true,
    localInputsStable: true,
  });
  assert.equal(changedIdentityResult.status, "BLOCKED");
  assert.equal(changedIdentityResult.reason, "measurement_start_identity_changed_after_readiness");
});

test("Phase 4 task-ready timing stops at the ready selector and excludes observation windows", () => {
  const actionStartedAt = 1_000;
  const readyAt = 1_350;
  const afterObservation =
    readyAt + PHASE_2_HARNESS_CONTRACT.postReadyObservationWindowMs;
  assert.equal(calculateTaskReadyMs(actionStartedAt, readyAt), 350);
  assert.equal(afterObservation - actionStartedAt, 5_350);
  assert.equal(calculateTaskReadyMs(null, 1_350), null);
});

test("Phase 4 harness uses discard recovery for synthetic dirty navigation", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /function discardDirtyNavigationIfPresent/);
  assert.match(source, /function waitForFirstActionable/);
  assert.match(source, /\[data-testid="shell-dirty-discard"\]/);
  assert.match(source, /clickFirstActionableWithDirtyRecovery/);
  assert.match(source, /\[data-testid="more-item-ai_chat"\]/);
  assert.match(source, /ready_selector_timeout:/);
});

test("Phase 4 Android real click waits for a stable DOM hit target", async () => {
  const states = [
    {
      status: "ready",
      x: 192,
      y: 347,
      width: 303,
      height: 44,
      visible: true,
      inViewport: true,
      enabled: true,
      pointerEvents: "auto",
      visibility: "visible",
      opacity: 1,
      hitTarget: true,
    },
    {
      status: "ready",
      x: 192,
      y: 347,
      width: 303,
      height: 44,
      visible: true,
      inViewport: true,
      enabled: true,
      pointerEvents: "auto",
      visibility: "visible",
      opacity: 1,
      hitTarget: true,
    },
  ];
  const clicks = [];
  const page = {
    waitForTimeout: async () => undefined,
  };
  const locator = {
    evaluate: async () => states.shift(),
    click: async (options) => clicks.push(options),
  };

  const result = await clickRealActionableTarget(page, locator, { timeout: 100 });

  assert.equal(result.hitTarget, true);
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0].force, true);
  assert.equal(typeof clicks[0].timeout, "number");
});

test("Phase 4 Android real click never clicks when the hit target is unstable", async () => {
  const page = {
    waitForTimeout: async () => new Promise((resolve) => setTimeout(resolve, 1)),
  };
  const locator = {
    evaluate: async () => ({
      status: "ready",
      x: 192,
      y: 347,
      width: 303,
      height: 44,
      visible: true,
      inViewport: true,
      enabled: true,
      pointerEvents: "auto",
      visibility: "visible",
      opacity: 1,
      hitTarget: false,
    }),
    click: async () => assert.fail("unstable target must not be clicked"),
  };

  await assert.rejects(
    clickRealActionableTarget(page, locator, { timeout: 10 }),
    /real_click_target_not_stable/,
  );
});

test("Phase 4 waits for login client hydration before synthetic typing", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /function waitForLoginClientReady/);
  assert.match(source, /waitForLoadState\("networkidle"/);
  assert.equal((source.match(/await waitForLoginClientReady\(page\);/g) ?? []).length, 3);
});

test("Phase 4 normalizes dynamic routes without preserving query data", () => {
  assert.equal(
    sanitizeRoute("https://local.test/api/clients/00000000-0000-4000-8000-000000004000/forms?client=secret"),
    "/api/clients/:id/forms",
  );
  assert.equal(
    routeMatches("/api/clients/00000000-0000-4000-8000-000000004000/forms", "/api/clients/:clientId/forms"),
    true,
  );
  assert.equal(
    routeMatches("/api/clients/client-mert/forms", "/api/clients/:clientId/forms"),
    true,
  );
});

test("Phase 4 cannot close when hosted and physical-device environments are absent", () => {
  const result = evaluatePhase4Closure({
    local: {
      environment: "local_desktop",
      status: "PASS",
      profiles: [validProfile("small"), validProfile("normal")],
    },
    hosted: {
      environment: "owner_pc_hosted",
      status: "BLOCKED",
      reason: "hosted_synthetic_account_or_url_not_provided",
    },
    androidChrome: {
      environment: "android_chrome",
      status: "BLOCKED",
      reason: "no_physical_android_device",
    },
    installedPwa: {
      environment: "installed_android_pwa",
      status: "BLOCKED",
      reason: "no_physical_android_device",
    },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.outcome, "PERFORMANCE_BLOCKED");
  assert.equal(result.validEnvironmentCount, 1);
  assert.ok(result.blockers.includes("hosted_synthetic_account_or_url_not_provided"));
});

test("Phase 4 closes only when all four environments have valid baselines", () => {
  const result = evaluatePhase4Closure({
    local: validEnvironment("local_desktop", "local"),
    hosted: validEnvironment("owner_pc_hosted", "hosted"),
    androidChrome: validEnvironment("android_chrome", "android"),
    installedPwa: validEnvironment("installed_android_pwa", "pwa"),
  });
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.outcome, "BASELINE_VALID_NOT_REPRODUCED");
  assert.equal(result.validEnvironmentCount, 4);
});

test("Phase 4 marks a valid long-task sample as a reproduction candidate", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const sample = {
    sampleId: "synthetic-sample",
    authenticated: true,
    fallbackStore: false,
    demoCookieInjected: false,
    measurementMode: "warm",
    readySelectorMatched: true,
    targetUsable: true,
    taskReadyMs: 700,
    eventToNextPaintMs: 120,
    trustedInteraction: true,
    maxLongTaskMs: 500,
    lcpMs: null,
    cls: 0,
    requests: [
      {
        route: "/api/shell/bootstrap",
        method: "GET",
        status: 200,
        headerReceivedMs: 10,
        bodyFinishedMs: 20,
      },
      {
        route: "/api/app-state",
        method: "GET",
        status: 200,
        headerReceivedMs: 11,
        bodyFinishedMs: 21,
      },
      {
        route: "/api/clients",
        method: "GET",
        status: 200,
        headerReceivedMs: 12,
        bodyFinishedMs: 22,
      },
    ],
  };
  const summary = summarizeCapturedScenario([sample], scenario);
  assert.equal(summary.validityStatus, "PASS");
  assert.equal(summary.freezeStatus, "REPRODUCED_CANDIDATE");
  assert.equal(summary.freezeCandidateSampleCount, 1);
});

test("Phase 4 does not treat empty or invalid samples as a valid freeze reproduction", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const empty = summarizeCapturedScenario([], scenario);
  assert.equal(empty.functionalStatus, "FAIL");
  assert.equal(empty.validityStatus, "FAIL");
  assert.equal(empty.budgetStatus, "FAIL");

  const invalid = summarizeCapturedScenario(
    [
      {
        sampleId: "invalid-sample",
        authenticated: true,
        fallbackStore: false,
        demoCookieInjected: false,
        measurementMode: "warm",
        readySelectorMatched: true,
        targetUsable: true,
        taskReadyMs: 7000,
        eventToNextPaintMs: 7000,
        maxLongTaskMs: 900,
        lcpMs: null,
        cls: 0,
        requests: [
          {
            route: "/api/shell/bootstrap",
            method: "GET",
            status: 200,
            headerReceivedMs: 10,
            bodyFinishedMs: 20,
          },
          {
            route: "/api/app-state",
            method: "GET",
            status: 200,
            headerReceivedMs: 11,
            bodyFinishedMs: 21,
          },
          {
            route: "/api/session/activity",
            method: "POST",
            status: 503,
            headerReceivedMs: 12,
            bodyFinishedMs: 22,
          },
        ],
      },
    ],
    scenario,
  );
  assert.equal(invalid.validityStatus, "FAIL");
  assert.equal(invalid.freezeStatus, "NOT_REPRODUCED");
  assert.equal(invalid.freezeCandidateSampleCount, 0);
});

test("Phase 4 rejects a sample error even when the visible target and reads look valid", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const sample = {
    sampleId: "sample-with-error",
    authenticated: true,
    fallbackStore: false,
    demoCookieInjected: false,
    measurementMode: "warm",
    readySelectorMatched: true,
    targetUsable: true,
    taskReadyMs: 100,
    eventToNextPaintMs: 80,
    trustedInteraction: true,
    maxLongTaskMs: 40,
    lcpMs: null,
    cls: 0,
    error: "playwright_timeout",
    requests: [
      {
        route: "/api/shell/bootstrap",
        method: "GET",
        status: 200,
        headerReceivedMs: 10,
        bodyFinishedMs: 20,
      },
    ],
  };
  const classification = classifyPhase4Sample(sample, scenario);
  assert.equal(classification.functionalStatus, "FAIL");
  assert.equal(classification.validityStatus, "FAIL");
  assert.ok(classification.validityProblems.includes("sample_error"));
  assert.equal(summarizeCapturedScenario([sample], scenario).freezeStatus, "NOT_REPRODUCED");
});

test("Phase 4 rejects an unlisted mutation even when no forbidden mutation matches", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const sample = {
    sampleId: "sample-with-unlisted-write",
    authenticated: true,
    fallbackStore: false,
    demoCookieInjected: false,
    measurementMode: "warm",
    readySelectorMatched: true,
    targetUsable: true,
    taskReadyMs: 100,
    eventToNextPaintMs: 80,
    trustedInteraction: true,
    maxLongTaskMs: 40,
    lcpMs: null,
    cls: 0,
    requests: [
      {
        route: "/api/shell/bootstrap",
        method: "GET",
        status: 200,
        headerReceivedMs: 10,
        bodyFinishedMs: 20,
      },
      {
        route: "/api/unlisted-write",
        method: "POST",
        status: 204,
        headerReceivedMs: 10,
        bodyFinishedMs: 10,
      },
    ],
  };
  const classification = classifyPhase4Sample(sample, scenario);
  assert.equal(classification.validityStatus, "FAIL");
  assert.ok(classification.validityProblems.includes("unlisted_mutation_observed"));
  assert.deepEqual(classification.unlistedMutations, ["POST /api/unlisted-write 204"]);
});

test("Phase 4 accepts the expected shell preference persistence mutation", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const classification = classifyPhase4Sample(
    {
      sampleId: "sample-with-shell-preference-write",
      authenticated: true,
      fallbackStore: false,
      demoCookieInjected: false,
      measurementMode: "warm",
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 100,
      eventToNextPaintMs: 80,
      trustedInteraction: true,
      maxLongTaskMs: 40,
      lcpMs: null,
      cls: 0,
      requests: [
        {
          route: "/api/shell/bootstrap",
          method: "GET",
          status: 200,
          headerReceivedMs: 10,
          bodyFinishedMs: 20,
        },
        {
          route: "/api/shell/preferences",
          method: "PATCH",
          status: 200,
          headerReceivedMs: 12,
          bodyFinishedMs: 22,
        },
      ],
    },
    scenario,
  );
  assert.equal(classification.validityStatus, "PASS");
  assert.deepEqual(classification.unlistedMutations, []);
});

test("Phase 4 enforces the required-read body-finish p75 budget after collection", () => {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const samples = Array.from({ length: PHASE_4_SAMPLE_COUNT }, (_, index) => ({
    sampleId: "slow-body-" + index,
    authenticated: true,
    fallbackStore: false,
    demoCookieInjected: false,
    measurementMode: "warm",
    readySelectorMatched: true,
    targetUsable: true,
    taskReadyMs: 100,
    eventToNextPaintMs: 80,
    trustedInteraction: true,
    maxLongTaskMs: 40,
    lcpMs: null,
    cls: 0,
    requests: [
      {
        route: "/api/shell/bootstrap",
        method: "GET",
        status: 200,
        headerReceivedMs: 10,
        bodyFinishedMs: 1_000,
      },
    ],
  }));
  const summary = summarizeCapturedScenario(samples, scenario);
  assert.equal(summary.validityStatus, "PASS");
  assert.equal(summary.budgetStatus, "FAIL");
  assert.equal(summary.p75.requiredReadBodyFinishedMs, 1_000);
  assert.ok(
    summary.budgetProblems.some((problem) => problem.startsWith("requiredReadBodyFinishedP75Ms:")),
  );
});

test("Phase 4 does not close with a stale environment or a profile missing status", () => {
  const stale = evaluatePhase4Closure({
    local: validEnvironment("local_desktop", "local"),
    hosted: { ...validEnvironment("owner_pc_hosted", "hosted"), status: "STALE", stale: true },
    androidChrome: validEnvironment("android_chrome", "android"),
    installedPwa: validEnvironment("installed_android_pwa", "pwa"),
  });
  assert.equal(stale.status, "BLOCKED");
  assert.equal(stale.validEnvironmentCount, 3);

  const profileWithoutStatus = validEnvironment("owner_pc_hosted", "hosted");
  profileWithoutStatus.profiles[0].status = undefined;
  const missingProfileStatus = evaluatePhase4Closure({
    local: validEnvironment("local_desktop", "local"),
    hosted: profileWithoutStatus,
    androidChrome: validEnvironment("android_chrome", "android"),
    installedPwa: validEnvironment("installed_android_pwa", "pwa"),
  });
  assert.equal(missingProfileStatus.status, "BLOCKED");
});

test("Phase 4 evidence sanitization redacts scalar secrets and preserves timing metrics", () => {
  const sanitized = sanitizePhase4Evidence({
    email: "owner@example.test",
    nested: { token: "opaque-token", password: "secret-password", body: "raw-body" },
    request: { bodyFinishedMs: 123, route: "/api/clients/42?email=owner@example.test" },
  });
  assert.equal(sanitized.email, "<redacted>");
  assert.equal(sanitized.nested.token, "<redacted>");
  assert.equal(sanitized.nested.password, "<redacted>");
  assert.equal(sanitized.nested.body, "<redacted>");
  assert.equal(sanitized.request.bodyFinishedMs, 123);
  assert.equal(sanitized.request.route, "/api/clients/42");
});

test("Phase 4 records structured harness errors without sensitive values", () => {
  const details = describeHarnessError(
    new Error(
      "Timeout while loading https://65-21-52-249.sslip.io/api/auth/password-login?email=owner@example.test",
    ),
    { phase: "collect_measurement_round", scenarioId: "ai_chat" },
  );
  assert.equal(details.classification, "playwright_timeout");
  assert.equal(details.phase, "collect_measurement_round");
  assert.equal(details.scenarioId, "ai_chat");
  assert.equal(details.message.includes("owner@example.test"), false);
  assert.equal(details.message.includes("?email="), false);
  assert.equal(details.message.includes("/api/auth/password-login"), true);
});
