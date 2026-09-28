#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  collectPhase4MeasurementIdentity,
  PHASE_4_FINDING_IDS,
  PHASE_4_READINESS_SCHEMA_VERSION,
  phase4ReadinessClosure,
  redactionCheck,
  sanitizePhase4Evidence,
} from "./lib/performance-plan-1-phase-4-contract.mjs";
import {
  collectAndroidTarget,
  launchInstalledPwa,
  launchAndroidChromeTarget,
  navigateAndroidChromeHostedTarget,
  connectPhase4AndroidCdp,
  disconnectCdpBrowser,
  hostedConfiguration,
  verifyHostedAccess,
  parseLocalSupabaseStatus,
  phase2Prerequisite,
  phase3Prerequisite,
  PHASE_4_LOCAL_SCHEMA_MIGRATION_FILE,
  PHASE_4_LOCAL_PORT,
  PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS,
  stripAndroidTargetRuntime,
} from "./performance-plan-1-phase-4.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const evidencePath = join(
  docsRoot,
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json",
);
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");
const readinessPlanPath = join(
  docsRoot,
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_ACTION_PLAN.md",
);
const phase4EvidencePath = join(
  docsRoot,
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json",
);
const phase4BaselineScriptPath = join(
  appRoot,
  "scripts",
  "performance-plan-1-phase-4.mjs",
);
const findingManifestPath = join(
  docsRoot,
  "AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json",
);

export const PHASE_4_READINESS_HEALTH_TARGETS = [
  { id: "customer_live", baseUrl: "https://aiyaworkspace.com" },
  { id: "admin_live", baseUrl: "https://admin.aiyaworkspace.com" },
  { id: "test_vps", baseUrl: "https://65-21-52-249.sslip.io" },
];

const AUTHORITY_PATHS = [
  "codex.md",
  "app/AGENTS.md",
  "HANDOFF_FOR_NEXT_CODEX.md",
  "docs/AIYA_PERFORMANCE_ACTION_PLAN.md",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  "docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json",
  "docs/NEXT_PHASE_EXECUTION_PLAN.md",
  "docs/RISK_REGISTER.md",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: options.shell ?? process.platform === "win32",
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: options.timeout ?? 300_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function collectGitIdentity() {
  const branch = run("git", ["branch", "--show-current"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const diffCheck = run("git", ["diff", "--check"]);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    upstreamHead: upstream.status === 0 ? upstream.stdout.trim() : null,
    worktreeStatus: status.stdout.trim(),
    diffCheck: diffCheck.status === 0 ? "PASS" : "FAIL",
  };
}

function authorityEvidence() {
  const files = AUTHORITY_PATHS.map((path) => ({
    path,
    exists: existsSync(join(repoRoot, path)),
  }));
  return {
    files,
    status: files.every((file) => file.exists) ? "PASS" : "FAIL",
    missing: files.filter((file) => !file.exists).map((file) => file.path),
  };
}

function measurementStartBindingEvidence() {
  if (!existsSync(phase4BaselineScriptPath)) {
    return {
      status: "BLOCKED",
      sourcePath: "app/scripts/performance-plan-1-phase-4.mjs",
      requiredMarkers: {},
      failures: ["phase4_baseline_script_missing"],
    };
  }
  const source = readFileSync(phase4BaselineScriptPath, "utf8");
  const requiredMarkers = {
    readinessCommandGate: source.includes("runPhase4ReadinessGate()"),
    readinessEvidencePath: source.includes("phase4ReadinessEvidencePath"),
    measurementStartPassGate: source.includes('measurementStartGate.status === "PASS"'),
    hostedInputStability: source.includes("hostedInputsStable"),
    localInputStability: source.includes("localInputsStable"),
    identityRecheck: source.includes("evaluatePhase4MeasurementStartGate("),
    readinessBuildReuse: source.includes("reuseReadinessBuild("),
    serverAfterGate: source.includes("startLocalServer(build.env"),
  };
  const failures = Object.entries(requiredMarkers)
    .filter(([, present]) => !present)
    .map(([marker]) => marker);
  return {
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    sourcePath: "app/scripts/performance-plan-1-phase-4.mjs",
    requiredMarkers,
    failures,
  };
}

function findingEvidence() {
  const manifest = readJson(findingManifestPath);
  const findings = Array.isArray(manifest?.findings) ? manifest.findings : [];
  const ids = findings.map((finding) => finding.id);
  const exactIds =
    ids.length === PHASE_4_FINDING_IDS.length &&
    PHASE_4_FINDING_IDS.every((id, index) => ids[index] === id);
  return {
    status: manifest && exactIds ? "PASS" : "FAIL",
    manifestVersion: manifest?.manifestVersion ?? null,
    ids,
    findings: findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      phase1Status: finding.phase1Status,
      historicalClassification: finding.historicalClassification,
      reproductionScenarios: finding.reproductionScenarios,
      closureEvidence: finding.closureEvidence,
      plan2Eligibility: finding.plan2Eligibility,
    })),
    failures: [
      ...(manifest ? [] : ["finding_manifest_missing_or_invalid"]),
      ...(exactIds ? [] : ["finding_ids_not_equal_to_locked_five"]),
    ],
  };
}

function runCheck(command, args, cwd = appRoot) {
  const result = run(command, args, {
    cwd,
    shell: command === process.execPath ? false : undefined,
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    outputRecorded: false,
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function localDockerStatus() {
  const result = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  return {
    status: result.status === 0 && result.stdout.trim() ? "PASS" : "BLOCKED",
    serverVersionPresent: Boolean(result.stdout.trim()),
    outputRecorded: false,
  };
}

function localBuild(localStatus) {
  if (localStatus.status !== "PASS") {
    return {
      status: "BLOCKED",
      reason: "local_supabase_not_ready",
      outputRecorded: false,
    };
  }
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:" + PHASE_4_LOCAL_PORT,
    MANU_ADMIN_APP_URL: "http://127.0.0.1:" + PHASE_4_LOCAL_PORT,
    NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
    MANU_DEV_FALLBACK_STORE: "false",
    MANU_ALLOW_PUBLIC_DEMO_LOGIN: "false",
    AI_CHAT_UI_ENABLED: "true",
  };
  if (!existsSync(nextCliPath)) {
    return { status: "BLOCKED", reason: "next_cli_missing", outputRecorded: false };
  }
  const result = run(process.execPath, [nextCliPath, "build", "--webpack"], {
    cwd: appRoot,
    env,
    shell: false,
    timeout: 300_000,
  });
  return {
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    outputRecorded: false,
  };
}

async function releaseHealth(target) {
  const endpoint = new URL("/api/health/release", target.baseUrl).toString();
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return {
      id: target.id,
      endpoint,
      status: response.status === 200 && payload.status === "ok" ? "PASS" : "FAIL",
      httpStatus: response.status,
      apiStatus: typeof payload.status === "string" ? payload.status : null,
      releaseId: payload.releaseId ?? payload.release ?? null,
      commit: payload.commit ?? payload.commitSha ?? null,
      migrationFingerprint:
        payload.migrationFingerprint ?? payload.migration_fingerprint ?? null,
      compatibilityVersion: payload.compatibilityVersion ?? null,
    };
  } catch {
    return {
      id: target.id,
      endpoint,
      status: "BLOCKED",
      httpStatus: null,
      apiStatus: null,
      releaseId: null,
      commit: null,
      migrationFingerprint: null,
      compatibilityVersion: null,
      reason: "release_health_fetch_failed",
    };
  }
}

async function collectCdpTargetStates(browser) {
  const targets = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const state = await page
        .evaluate(() => ({
          origin: window.location.origin,
          displayModeStandalone:
            window.matchMedia?.("(display-mode: standalone)")?.matches === true,
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          online: navigator.onLine === true,
        }))
        .catch(() => null);
      if (state) targets.push({ context, page, state });
    }
  }
  return targets;
}

async function inspectCdpTargets(baseUrl, androidTargetRuntime = null) {
  const expectedOrigin = new URL(baseUrl).origin;
  const runtime = androidTargetRuntime?.runtime ?? null;
  const monitor = runtime?.monitor ?? null;
  const blocked = (reason, extra = {}) => ({
    status: "BLOCKED",
    expectedOrigin,
    hostedChromeTarget: extra.hostedChromeTarget ?? "BLOCKED",
    installedPwaTarget: extra.installedPwaTarget ?? "BLOCKED",
    targetCount: extra.targetCount ?? 0,
    cdpConnection: extra.cdpConnection ?? "NOT_VERIFIED",
    reason,
    ...extra,
    connectionMonitoring: monitor?.evidence() ?? null,
  });
  let browser;
  try {
    const beforeConnect = monitor?.check("readiness:before_cdp_connect");
    if (beforeConnect && beforeConnect.status !== "PASS") {
      return blocked("android_connection_lost_before_cdp_connect");
    }
    browser = await connectPhase4AndroidCdp();
    const afterConnect = monitor?.check("readiness:after_cdp_connect");
    if (afterConnect && afterConnect.status !== "PASS") {
      return blocked("android_connection_lost_after_cdp_connect");
    }

    const safeAndroidTarget = stripAndroidTargetRuntime(androidTargetRuntime);
    const chromeLaunch = launchAndroidChromeTarget(
      safeAndroidTarget,
      runtime,
      baseUrl,
    );
    let targets = await collectCdpTargetStates(browser);
    let chromeTarget = null;
    let chromePollCount = 0;
    let chromeNavigation =
      chromeLaunch.status === "PASS"
        ? "android_explicit_view_intent"
        : "android_view_intent_failed";
    let chromeNavigationEvidence = null;
    const chromeDeadline = Date.now() + PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS;
    while (Date.now() <= chromeDeadline) {
      chromePollCount += 1;
      const pollConnection = monitor?.check(`readiness:chrome_target_poll_${chromePollCount}`);
      if (pollConnection && pollConnection.status !== "PASS") {
        return blocked("android_connection_lost_during_chrome_target_poll", {
          cdpConnection: "PASS",
          chromeLaunch,
          targetCount: targets.length,
        });
      }
      targets = await collectCdpTargetStates(browser);
      chromeTarget =
        targets.find(
          (target) =>
            target.state.origin === expectedOrigin &&
            target.state.displayModeStandalone === false &&
            target.state.online === true,
        ) ?? null;
      if (chromeTarget) break;
      await sleep(500);
    }
    if (!chromeTarget && chromeLaunch.status === "PASS") {
      const normalTabNavigation = await navigateAndroidChromeHostedTarget(
        browser,
        expectedOrigin,
        monitor,
        "readiness",
      );
      chromeNavigationEvidence = {
        status: normalTabNavigation.status,
        navigation: normalTabNavigation.navigation,
        reason: normalTabNavigation.reason,
      };
      chromeNavigation = normalTabNavigation.navigation;
      chromeTarget = normalTabNavigation.target;
      targets = await collectCdpTargetStates(browser);
    }
    const chromeTargetPass = Boolean(chromeLaunch.status === "PASS" && chromeTarget);
    const afterChromeTarget = monitor?.check("readiness:after_android_chrome_target");
    if (afterChromeTarget && afterChromeTarget.status !== "PASS") {
      return blocked("android_connection_lost_after_android_chrome_target", {
        hostedChromeTarget: chromeTargetPass ? "PASS" : "BLOCKED",
        cdpConnection: "PASS",
        chromeNavigation,
        chromeNavigationEvidence,
        chromeLaunch,
        chromePollCount,
        targetCount: targets.length,
      });
    }

    const pwaLaunch = launchInstalledPwa(safeAndroidTarget, runtime);
    if (pwaLaunch.status !== "PASS") {
      return blocked(pwaLaunch.reason || "installed_pwa_independent_launch_failed", {
        hostedChromeTarget: chromeTargetPass ? "PASS" : "BLOCKED",
        cdpConnection: "PASS",
        chromeNavigation,
        chromeNavigationEvidence,
        chromeLaunch,
        chromePollCount,
        pwaLaunch,
        targetCount: targets.length,
      });
    }

    const pwaDeadline = Date.now() + PHASE_4_ANDROID_PWA_LAUNCH_TIMEOUT_MS;
    let pwaTarget = null;
    let pollCount = 0;
    while (Date.now() <= pwaDeadline) {
      pollCount += 1;
      const pollConnection = monitor?.check(`readiness:pwa_target_poll_${pollCount}`);
      if (pollConnection && pollConnection.status !== "PASS") {
        return blocked("android_connection_lost_during_pwa_target_poll", {
          hostedChromeTarget: chromeTargetPass ? "PASS" : "BLOCKED",
          cdpConnection: "PASS",
          chromeNavigation,
          chromeNavigationEvidence,
          chromeLaunch,
          chromePollCount,
          pwaLaunch,
          targetCount: targets.length,
        });
      }
      targets = await collectCdpTargetStates(browser);
      pwaTarget =
        targets.find(
          (target) =>
            target.state.origin === expectedOrigin &&
            target.state.displayModeStandalone === true &&
            target.state.serviceWorkerControlled === true &&
            target.state.online === true,
        ) ?? null;
      if (pwaTarget) break;
      await sleep(500);
    }
    const pwaTargetPass = Boolean(pwaTarget);
    const afterPwaTarget = monitor?.check("readiness:after_installed_pwa_target");
    if (afterPwaTarget && afterPwaTarget.status !== "PASS") {
      return blocked("android_connection_lost_after_installed_pwa_target", {
        hostedChromeTarget: chromeTargetPass ? "PASS" : "BLOCKED",
        installedPwaTarget: pwaTargetPass ? "PASS" : "BLOCKED",
        cdpConnection: "PASS",
        chromeNavigation,
        pwaLaunch,
        targetCount: targets.length,
        pwaPollCount: pollCount,
      });
    }
    return {
      status: chromeTargetPass && pwaTargetPass ? "PASS" : "BLOCKED",
      expectedOrigin,
      cdpConnection: "PASS",
      hostedChromeTarget: chromeTargetPass ? "PASS" : "BLOCKED",
      chromeNavigation,
      chromeNavigationEvidence,
      chromeLaunch,
      chromePollCount,
      installedPwaTarget: pwaTargetPass ? "PASS" : "BLOCKED",
      pwaLaunch,
      pwaPollCount: pollCount,
      targetCount: targets.length,
      reason: !chromeTargetPass
        ? "android_chrome_target_not_verified"
        : pwaTargetPass
          ? null
          : "installed_pwa_target_not_found_after_independent_launch",
      connectionMonitoring: monitor?.evidence() ?? null,
    };
  } catch {
    return blocked("android_cdp_unavailable");
  } finally {
    if (browser) {
      disconnectCdpBrowser(browser);
    }
  }
}

function maskedHostedInputState(configuration) {
  return {
    baseUrlProvided: configuration.status === "READY",
    emailProvided: configuration.status === "READY",
    passwordProvided: configuration.status === "READY",
    target: configuration.status === "READY" ? configuration.baseUrl : null,
    status: configuration.status,
    reason: configuration.status === "READY" ? null : configuration.reason,
  };
}

export async function buildReadinessEvidence() {
  const generatedAt = new Date().toISOString();
  const git = collectGitIdentity();
  const authority = authorityEvidence();
  const findings = findingEvidence();
  const phase2 = phase2Prerequisite();
  const phase3 = phase3Prerequisite();
  const phase4Evidence = readJson(phase4EvidencePath);
  const h1Status =
    authority.status === "PASS" &&
    findings.status === "PASS" &&
    phase2.harnessReady &&
    phase3.status === "COMPLETE" &&
    Boolean(phase3.fixtureHash) &&
    existsSync(readinessPlanPath)
      ? "COMPLETE"
      : "BLOCKED";
  const tests =
    h1Status === "COMPLETE"
      ? [
          runCheck(process.execPath, ["--check", "scripts/performance-plan-1-phase-4.mjs"]),
          runCheck(process.execPath, ["--check", "scripts/performance-plan-1-phase-4-readiness.mjs"]),
          runCheck(process.execPath, ["--test", "scripts/performance-plan-1-phase-4.test.mjs"]),
          runCheck(process.execPath, ["--test", "scripts/performance-plan-1-phase-4-readiness.test.mjs"]),
        ]
      : [];
  const h2Status =
    h1Status !== "COMPLETE"
      ? "BLOCKED"
      : tests.every((test) => test.status === "PASS")
        ? "COMPLETE"
        : "FAILED";
  let localStatus = { status: "NOT_RUN", reason: "H1_or_H2_not_complete" };
  let localTarget = {
    status: "NOT_RUN",
    apiUrl: null,
    urlIsLocal: false,
    anonKeyPresent: false,
    serviceRoleKeyPresent: false,
    credentialsRecorded: false,
    databaseReset: false,
    remoteMigration: false,
  };
  let docker = { status: "NOT_RUN", serverVersionPresent: false };
  let localBuildResult = { status: "NOT_RUN", reason: "H1_or_H2_not_complete" };
  let configuredHosted = { status: "NOT_RUN", reason: "H1_or_H2_not_complete" };
  let hostedInput = maskedHostedInputState(configuredHosted);
  let health = [];
  let hostedHealth = { id: "configured_hosted", status: "NOT_RUN", reason: "H1_or_H2_not_complete" };
  let hostedAuthentication = {
    status: "NOT_RUN",
    reason: "H1_or_H2_not_complete",
  };
  let device = { status: "NOT_RUN", reason: "H1_or_H2_not_complete" };
  let cdp = { status: "NOT_RUN", hostedChromeTarget: "NOT_RUN", installedPwaTarget: "NOT_RUN" };
  if (h2Status === "COMPLETE") {
    localStatus = parseLocalSupabaseStatus();
    localTarget = {
      status: localStatus.status,
      apiUrl: localStatus.apiUrl,
      urlIsLocal: localStatus.urlIsLocal === true,
      anonKeyPresent: Boolean(localStatus.anonKey),
      serviceRoleKeyPresent: Boolean(localStatus.serviceRoleKey),
      credentialsRecorded: false,
      databaseReset: false,
      remoteMigration: false,
    };
    docker = localDockerStatus();
    localBuildResult = localBuild(localStatus);
    configuredHosted = hostedConfiguration();
    hostedInput = maskedHostedInputState(configuredHosted);
    health = await Promise.all(PHASE_4_READINESS_HEALTH_TARGETS.map(releaseHealth));
    hostedHealth =
      configuredHosted.status === "READY"
        ? await releaseHealth({ id: "configured_hosted", baseUrl: configuredHosted.baseUrl })
        : { id: "configured_hosted", status: "BLOCKED", reason: configuredHosted.reason };
    hostedAuthentication = await verifyHostedAccess(configuredHosted);
    const deviceRuntime = collectAndroidTarget({ includeRuntime: true });
    device = stripAndroidTargetRuntime(deviceRuntime);
    cdp =
      device.status === "READY_FOR_CDP_CAPTURE" && configuredHosted.status === "READY"
        ? await inspectCdpTargets(configuredHosted.baseUrl, deviceRuntime)
        : {
            status: "BLOCKED",
            hostedChromeTarget: "BLOCKED",
            installedPwaTarget: "BLOCKED",
            reason:
              configuredHosted.status !== "READY"
                ? configuredHosted.reason
                : device.reason,
          };
  }
  const localReady =
    h2Status === "COMPLETE" &&
    localTarget.status === "PASS" &&
    docker.status === "PASS" &&
    localBuildResult.status === "PASS";
  const hostedReady =
    h2Status === "COMPLETE" &&
    configuredHosted.status === "READY" &&
    hostedHealth.status === "PASS" &&
    hostedAuthentication.status === "PASS";
  const androidReady =
    h2Status === "COMPLETE" &&
    device.status === "READY_FOR_CDP_CAPTURE" &&
    cdp.hostedChromeTarget === "PASS";
  const pwaReady =
    h2Status === "COMPLETE" &&
    device.status === "READY_FOR_CDP_CAPTURE" &&
    cdp.installedPwaTarget === "PASS";
  const h3Status =
    h2Status === "COMPLETE" && localReady && hostedReady && androidReady && pwaReady
      ? "COMPLETE"
      : "BLOCKED";
  const measurementStartBinding = measurementStartBindingEvidence();
  const h4Status =
    h3Status === "COMPLETE" && measurementStartBinding.status === "PASS"
      ? "COMPLETE"
      : "BLOCKED";
  const stageLedger = [
    {
      stageId: "H1",
      name: "Requirements, finding, and identity contract lock",
      status: h1Status,
      performedActions: [
        "Recorded authority documents and the locked five-finding matrix",
        "Recorded Git identity and source/artifact/fixture/migration hashes",
        "Recorded the four-environment and validity contracts",
        "Recorded production, secret, provider, channel, and runtime exclusions",
      ],
      verificationResults: {
        authority,
        findings,
        phase2,
        phase3,
        phase4CanonicalRun: {
          runId: phase4Evidence?.runId ?? null,
          status: phase4Evidence?.status ?? null,
          outcome: phase4Evidence?.outcome ?? null,
        },
      },
      outputEvidence: ["authority", "findings", "measurementIdentity", "stageLedger"],
      blockingReason: h1Status === "COMPLETE" ? null : "requirements_or_identity_contract_incomplete",
    },
    {
      stageId: "H2",
      name: "Measurement harness reliability and negative controls",
      status: h2Status,
      prerequisiteEvidence: ["H1"],
      performedActions:
        h1Status === "COMPLETE"
          ? [
              "Applied trusted interaction, request-body, mutation, sample-error, percentile, retry, stale, and redaction gates",
              "Ran syntax and Phase 4 contract tests without recording command output",
            ]
          : ["Did not start because H1 is not complete"],
      verificationResults: { tests },
      outputEvidence: ["tests", "harnessContract"],
      blockingReason:
        h2Status === "COMPLETE"
          ? null
          : h1Status !== "COMPLETE"
            ? "H1_not_complete"
            : "harness_contract_test_failed",
    },
    {
      stageId: "H3",
      name: "Local, hosted, Android Chrome, and installed PWA readiness",
      status: h3Status,
      prerequisiteEvidence: ["H1", "H2"],
      performedActions:
        h2Status === "COMPLETE"
          ? [
              "Checked local Supabase URL and Docker status without reset or seed",
              "Built the local standalone app with local Supabase values in a child process",
              "Loaded hosted.env, checked hosted release health, and completed real password-login plus shell-bootstrap preflight without recording credentials",
              "Checked one authorized physical ADB device, launched Chrome through an explicit Android intent, verified the physical CDP connection, discovered and launched the existing WebAPK, verified standalone/service-worker/online PWA state, and monitored the connection at each gate without emulation or installation",
            ]
          : ["Did not start because H2 is not complete"],
      verificationResults: {
        local: { target: localTarget, docker, build: localBuildResult },
        hosted: {
          input: hostedInput,
          health: hostedHealth,
          authentication: hostedAuthentication,
        },
        android: { device, cdp },
        health,
      },
      outputEvidence: ["environmentMatrix", "releaseHealth", "deviceIdentity"],
      blockingReason:
        h3Status === "COMPLETE"
          ? null
          : h2Status !== "COMPLETE"
            ? "H2_not_complete"
            : "one_or_more_measurement_environments_not_ready",
    },
    {
      stageId: "H4",
      name: "Short readiness rehearsal before Phase 4 baseline",
      status: h4Status,
      prerequisiteEvidence: ["H1", "H2", "H3"],
      performedActions:
        h3Status === "COMPLETE"
          ? [
              "Verified that the baseline command contains the readiness gate and can start only after all four target gates pass",
              "Verified that hosted/local inputs and measurement identity are rechecked before the local server starts",
              "Kept the 20-sample Phase 4 baseline itself unstarted",
            ]
          : ["Did not start because H3 is blocked"],
      verificationResults: {
        baselineStarted: false,
        measurementStartBinding,
        measurementMode: "readiness_only",
        nextAction:
          h4Status === "COMPLETE"
            ? "Run Phase 4 from stage 4.1 with the locked 20-sample contract"
            : h3Status !== "COMPLETE"
              ? "Resolve H3 blockers before starting Phase 4 stage 4.1"
              : "Restore the Phase 4 measurement-start binding before starting stage 4.1",
      },
      outputEvidence: ["rehearsal", "closure"],
      blockingReason:
        h4Status === "COMPLETE"
          ? null
          : h3Status !== "COMPLETE"
            ? "H3_not_complete"
            : "measurement_start_binding_incomplete",
    },
  ];
  const measurementIdentity = collectPhase4MeasurementIdentity({
    repoRoot,
    phase3Evidence: readJson(join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json")),
  });
  const environmentMatrix = {
    localDesktop: {
      environment: "local_desktop",
      status: localReady ? "PASS" : "BLOCKED",
      baselineStatus: "NOT_RUN",
      reason: localReady ? null : "local_target_or_build_not_ready",
    },
    ownerPcHosted: {
      environment: "owner_pc_hosted",
      status: hostedReady ? "PASS" : "BLOCKED",
      baselineStatus: "NOT_RUN",
      reason: hostedReady
        ? null
        : hostedAuthentication.reason ||
          hostedHealth.reason ||
          configuredHosted.reason ||
          "hosted_input_or_authentication_not_ready",
    },
    androidChrome: {
      environment: "android_chrome",
      status: androidReady ? "PASS" : "BLOCKED",
      baselineStatus: "NOT_RUN",
      reason: androidReady ? null : cdp.reason || device.reason || "android_cdp_target_not_ready",
    },
    installedAndroidPwa: {
      environment: "installed_android_pwa",
      status: pwaReady ? "PASS" : "BLOCKED",
      baselineStatus: "NOT_RUN",
      reason: pwaReady ? null : cdp.reason || device.reason || "installed_pwa_target_not_ready",
    },
  };
  const blockers = stageLedger
    .filter((stage) => stage.status !== "COMPLETE")
    .map((stage) => stage.blockingReason)
    .filter(Boolean);
  blockers.push(
    ...Object.values(environmentMatrix)
      .filter((environment) => environment.status !== "PASS")
      .map((environment) => environment.reason)
      .filter(Boolean),
  );
  const rawEvidence = {
    phase: "AIya Performance Plan 1 Phase 4 Readiness",
    schemaVersion: PHASE_4_READINESS_SCHEMA_VERSION,
    runId: "aiya-phase4-readiness-" + generatedAt.replaceAll(/[-:.]/g, ""),
    generatedAt,
    status: "BLOCKED",
    outcome: "READINESS_BLOCKED",
    productionDecision: "NO-GO",
    executionMode: "readiness_only",
    sourceIdentity: git,
    measurementIdentity,
    authority,
    findingMatrix: findings,
    phase2Prerequisite: phase2,
    phase3Prerequisite: phase3,
    canonicalPhase4: {
      runId: phase4Evidence?.runId ?? null,
      status: phase4Evidence?.status ?? null,
      outcome: phase4Evidence?.outcome ?? null,
      preserved: true,
    },
    environmentMatrix,
    stageLedger,
    tests,
    constraints: {
      baselineStarted: false,
      measurementStartGate: "REQUIRED_BEFORE_BASELINE_STAGE_4_1",
      baselineLauncherBinding: measurementStartBinding.status,
      runtimeChange: "NOT_EXECUTED",
      productionDeploy: "NOT_EXECUTED",
      remoteMigration: "NOT_EXECUTED",
      schemaMigrationFile: PHASE_4_LOCAL_SCHEMA_MIGRATION_FILE,
      schemaMigrationAppliedByReadiness: false,
      hostedAccountCreation: "NOT_EXECUTED",
      hostedFixtureSeed: "NOT_EXECUTED",
      fallbackStore: "DISABLED",
      demoCookie: "NOT_USED",
      providerEgress: "NOT_EXECUTED",
      channelTraffic: "NOT_EXECUTED",
      billing: "NOT_EXECUTED",
      rawPayloadBody: "NOT_RECORDED",
      credentials: "NOT_RECORDED",
      deviceSerial: "NOT_RECORDED",
    },
    blockers: [...new Set(blockers)],
    nextEligibleAction:
      h4Status === "COMPLETE"
        ? "Run npm run audit:performance:plan1:phase4 from stage 4.1; do not start Plan 1 Phase 5."
        : configuredHosted.status !== "READY"
          ? "Load the approved hosted.env inputs without logging their values, then rerun this readiness command before Phase 4 stage 4.1."
          : hostedAuthentication.status !== "PASS"
            ? "Resolve hosted release, password-login, and shell-bootstrap preflight, then rerun this readiness command before Phase 4 stage 4.1."
          : cdp.hostedChromeTarget !== "PASS"
            ? "Resolve the normal physical Android Chrome hosted-origin target and the remaining local environment blocker, then rerun this readiness command before Phase 4 stage 4.1."
            : cdp.installedPwaTarget !== "PASS"
            ? "Open the existing installed AIya PWA in standalone mode with active service-worker control, then rerun this readiness command before Phase 4 stage 4.1."
            : measurementStartBinding.status !== "PASS"
              ? "Restore the Phase 4 measurement-start binding, then rerun this readiness command before Phase 4 stage 4.1."
              : "Resolve the remaining H3 environment blocker and rerun this readiness command before Phase 4 stage 4.1.",
  };
  const safeSecret = configuredHosted.status === "READY" ? configuredHosted.password : null;
  const sanitizedBeforeIntegrity = sanitizePhase4Evidence(rawEvidence, "", [safeSecret]);
  const evidenceIntegrity = {
    redaction: redactionCheck(sanitizedBeforeIntegrity, [safeSecret]),
    diffCheck: git.diffCheck,
    status:
      git.diffCheck === "PASS" &&
      redactionCheck(sanitizedBeforeIntegrity, [safeSecret]).status
        ? "PASS"
        : "FAIL",
  };
  rawEvidence.evidenceIntegrity = evidenceIntegrity;
  const closure = phase4ReadinessClosure({
    stageLedger,
    tests,
    evidenceIntegrity,
  });
  rawEvidence.closure = closure;
  rawEvidence.status = closure.status;
  rawEvidence.outcome = closure.outcome;
  return sanitizePhase4Evidence(rawEvidence, "", [safeSecret]);
}

async function main() {
  const evidence = await buildReadinessEvidence();
  writeJson(evidencePath, evidence);
  console.log("wrote " + relative(repoRoot, evidencePath).replaceAll("\\", "/"));
  console.log("status " + evidence.status);
  console.log("outcome " + evidence.outcome);
  console.log("blockers " + (evidence.blockers.join(",") || "none"));
  if (evidence.status !== "COMPLETE") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
