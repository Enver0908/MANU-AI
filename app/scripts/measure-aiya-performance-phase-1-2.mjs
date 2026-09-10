#!/usr/bin/env node
/**
 * AIya Phase 1.2 diagnostic performance harness.
 *
 * This audit validates whether Phase 1 measurements actually exercised the
 * post-login surfaces the owner reported as slow. It records timing evidence,
 * failure propagation, physical Android readiness, and a merged finding
 * manifest. It must not mutate live data, deploy, run migrations, or store raw
 * payload bodies, cookies, prompts, tokens, or clinical content.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { BUDGETS } from "./measure-aiya-performance.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const phase12EvidencePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json");
const combinedManifestPath = join(docsRoot, "AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json");
const phase2ScopePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const PHASE_1_2_BUDGETS = {
  ...BUDGETS,
  inSessionNavigationReadyP75Ms: 1200,
  bodyFinishedApiP75Ms: 900,
  backgroundStabilityWindowMs: 60_000,
};

export const PHASE_1_2_SCENARIOS = [
  {
    id: "post_login_dashboard",
    path: "/dashboard",
    category: "authenticated_dashboard",
    readySelector: '[data-testid="authenticated-shell"], [data-testid="shell-blocker"], main',
    successSelector: '[data-testid="authenticated-shell"]',
    actionSelectors: [
      '[data-testid="shell-wide-nav"] a[href*="section=clients"]',
      '[data-testid="shell-medium-rail"] a[href*="section=clients"]',
      '[data-testid="shell-compact-bottom-nav"] a[href*="section=clients"]',
    ],
    budgetKey: "dashboardReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "client_roster",
    path: "/dashboard?section=clients",
    category: "authenticated_workspace",
    readySelector: '[data-testid="client-roster"], [data-testid="client-workspace"], [data-testid="shell-blocker"]',
    successSelector: '[data-testid="client-roster"]',
    actionSelectors: ['[data-testid="client-roster-item"][data-client-id="client-mert"]', '[data-testid="client-roster-item"]'],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "client_forms_workspace",
    path: "/dashboard?section=clients&clientId=client-mert&clientTask=forms",
    category: "authenticated_workspace",
    readySelector: '[data-testid="client-form-panel"], [data-testid="client-workspace-loading"], [data-testid="client-workspace-error"], [data-testid="shell-blocker"]',
    successSelector: '[data-testid="client-form-panel"]',
    actionSelectors: [
      '[data-testid="client-form-panel"] textarea',
      '[data-testid="client-form-panel"] input',
      '[data-testid="client-form-save"]',
    ],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "nutrition_workspace",
    path: "/dashboard?section=clients&clientId=client-mert&clientTask=nutrition",
    category: "authenticated_workspace",
    readySelector: '[data-testid="active-nutrition-plan-panel"], [data-testid="client-workspace-loading"], [data-testid="client-workspace-error"], [data-testid="shell-blocker"]',
    successSelector: '[data-testid="active-nutrition-plan-panel"]',
    actionSelectors: [
      '[data-testid="active-nutrition-plan-panel"] input',
      '[data-testid="active-nutrition-plan-panel"] textarea',
      '[data-testid="active-nutrition-plan-save"]',
    ],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "menu_workspace",
    path: "/dashboard?section=clients&clientId=client-mert&clientTask=menu",
    category: "authenticated_workspace",
    readySelector: '[data-testid="menu-workflow-panel"], [data-testid="client-workspace-loading"], [data-testid="client-workspace-error"], [data-testid="shell-blocker"]',
    successSelector: '[data-testid="menu-workflow-panel"]',
    actionSelectors: [
      '[data-testid="menu-template-picker"] button',
      '[data-testid="menu-workflow-panel"] button',
      '[data-testid="menu-workflow-save"]',
    ],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "ai_chat",
    path: "/dashboard/ai-chat",
    category: "authenticated_ai",
    readySelector: '[data-testid="ai-chat-workspace"], [data-testid="shell-blocker"], main',
    successSelector: '[data-testid="ai-chat-workspace"]',
    actionSelectors: ['[data-testid="ai-chat-new-chat-button"]', '[data-testid="ai-chat-workspace"] textarea'],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "messages",
    path: "/dashboard?section=messages",
    category: "authenticated_messaging",
    readySelector: '[data-testid="conversation-panel"], [data-testid="shell-blocker"], main',
    successSelector: 'main',
    actionSelectors: ['[data-testid="conversation-panel"] textarea', '[data-testid="messaging-panel"] button'],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "alerts",
    path: "/dashboard?section=alerts",
    category: "authenticated_alerts",
    readySelector: '[data-testid="alerts-panel"], [data-testid="shell-blocker"], main',
    successSelector: 'main',
    actionSelectors: ['[data-testid="alerts-panel"] button', '[data-testid="shell-header-bell"]'],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
  {
    id: "notifications",
    path: "/dashboard?section=notifications",
    category: "authenticated_notifications",
    readySelector: '[data-testid="notifications-panel"], [data-testid="shell-blocker"], main',
    successSelector: 'main',
    actionSelectors: ['[data-testid="notifications-panel"] button', '[data-testid="shell-header-bell"]'],
    budgetKey: "inSessionNavigationReadyP75Ms",
    requiresAuthSurface: true,
  },
];

export const PHASE_1_2_REDACTION_RULES = [
  "url_query_redacted",
  "headers_not_recorded",
  "request_body_not_recorded",
  "response_body_not_recorded",
  "cookies_not_recorded",
  "prompts_not_recorded",
  "raw_clinical_content_not_recorded",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function percentile(values, p) {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const index = Math.max(0, Math.min(usable.length - 1, Math.ceil((p / 100) * usable.length) - 1));
  return usable[index];
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, "http://local.invalid");
    return `${parsed.pathname}${parsed.search ? "?<redacted>" : ""}`;
  } catch {
    return String(url).split("?")[0];
  }
}

function listFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(absolute, files);
    else files.push(absolute);
  }
  return files;
}

function collectGitEvidence() {
  return {
    branch: run("git", ["branch", "--show-current"]).stdout,
    statusShortBranch: run("git", ["status", "--short", "--branch"]).stdout,
    head: run("git", ["rev-parse", "HEAD"]).stdout,
    upstreamHead: run("git", ["rev-parse", "HEAD@{u}"]).stdout || null,
    diffCheck: run("git", ["diff", "--check"]),
  };
}

async function collectLiveReleaseEvidence() {
  const endpoints = [
    "https://aiyaworkspace.com/api/health/release",
    "https://admin.aiyaworkspace.com/api/health/release",
  ];
  const results = [];
  for (const endpoint of endpoints) {
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const text = await response.text();
      const parsed = JSON.parse(text);
      results.push({
        endpoint,
        status: response.status,
        durationMs: Date.now() - startedAt,
        releaseId: parsed.releaseId ?? parsed.release ?? null,
        commit: parsed.commit ?? parsed.commitSha ?? null,
        migrationFingerprint: parsed.migrationFingerprint ?? parsed.migration_fingerprint ?? null,
      });
    } catch (error) {
      results.push({
        endpoint,
        status: "FETCH_FAILED",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

function collectBundleEvidence() {
  const files = listFiles(join(appRoot, ".next", "static")).filter((file) => file.endsWith(".js"));
  const measured = files.map((file) => {
    const source = readFileSync(file);
    return {
      file: relative(appRoot, file).replaceAll("\\", "/"),
      bytes: source.byteLength,
      gzipBytes: gzipSync(source).byteLength,
    };
  });
  measured.sort((a, b) => b.gzipBytes - a.gzipBytes);
  return {
    staticJsFileCount: measured.length,
    totalJsGzipBytes: measured.reduce((sum, item) => sum + item.gzipBytes, 0),
    largestStaticJs: measured.slice(0, 20),
  };
}

function prepareStandaloneAssets() {
  const standaloneRoot = join(appRoot, ".next", "standalone");
  if (!existsSync(standaloneRoot)) return { copied: false, reason: "standalone_root_missing" };
  const sourceStatic = join(appRoot, ".next", "static");
  const targetStatic = join(standaloneRoot, ".next", "static");
  const sourcePublic = join(appRoot, "public");
  const targetPublic = join(standaloneRoot, "public");
  if (existsSync(sourceStatic)) {
    mkdirSync(dirname(targetStatic), { recursive: true });
    cpSync(sourceStatic, targetStatic, { recursive: true, force: true });
  }
  if (existsSync(sourcePublic)) {
    cpSync(sourcePublic, targetPublic, { recursive: true, force: true });
  }
  return {
    copied: true,
    static: existsSync(targetStatic),
    public: existsSync(targetPublic),
  };
}

async function waitForServer(server, baseUrl, output, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode != null) throw new Error(`next_start_exited_${server.exitCode}`);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`next_start_timeout:${output.join("\n").slice(-1000)}`);
}

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__aiyaPhase12Perf = { lcp: null, cls: 0, longTasks: [], marks: {} };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__aiyaPhase12Perf.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__aiyaPhase12Perf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__aiyaPhase12Perf.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
}

async function findFirstActionableLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const [visible, enabled] = await Promise.all([
        candidate.isVisible().catch(() => false),
        candidate.isEnabled().catch(() => false),
      ]);
      if (visible && enabled) return { locator: candidate, selector, index };
    }
  }
  return null;
}

async function measureScenario(page, baseUrl, scenario) {
  const requests = new Map();
  const requestSummaries = [];
  const failures = [];

  const onRequest = (request) => {
    requests.set(request, {
      startedAt: Date.now(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  };
  const onResponse = async (response) => {
    const request = response.request();
    const started = requests.get(request);
    if (!started) return;
    let bodyFinishedMs = null;
    try {
      await response.finished();
      bodyFinishedMs = Date.now() - started.startedAt;
    } catch {
      bodyFinishedMs = Date.now() - started.startedAt;
    }
    const item = {
      url: sanitizeUrl(started.url),
      method: started.method,
      resourceType: started.resourceType,
      status: response.status(),
      responseHeadersDurationMs: Date.now() - started.startedAt,
      bodyFinishedMs,
    };
    requestSummaries.push(item);
    if (response.status() >= 400) failures.push(item);
  };

  page.on("request", onRequest);
  page.on("response", onResponse);

  const startedAt = Date.now();
  let readyMs = null;
  let clickFeedbackMs = null;
  let successSelectorMatched = false;
  let status = "PASS";
  let error = null;
  try {
    await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator(scenario.readySelector).first().waitFor({ state: "visible", timeout: 6_000 });
    await page.locator(scenario.successSelector).first().waitFor({ state: "visible", timeout: 8_000 });
    successSelectorMatched = true;
    readyMs = Date.now() - startedAt;
    const actionSelectors = scenario.actionSelectors ?? [scenario.actionSelector].filter(Boolean);
    const target = await findFirstActionableLocator(page, actionSelectors);
    if (!target) throw new Error(`action_selector_missing:${actionSelectors.join(" | ")}`);
    const actionStart = Date.now();
    await target.locator.click({ timeout: 5_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined);
    clickFeedbackMs = Date.now() - actionStart;
    await page.waitForTimeout(1200);
  } catch (caught) {
    status = "FAIL";
    error = caught instanceof Error ? caught.message.split("\n")[0] : String(caught);
  } finally {
    page.off("request", onRequest);
    page.off("response", onResponse);
  }

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
    const longTasks = window.__aiyaPhase12Perf?.longTasks ?? [];
    return {
      fcpMs: Number.isFinite(fcp) ? Math.round(fcp) : null,
      lcpMs: Number.isFinite(window.__aiyaPhase12Perf?.lcp) ? Math.round(window.__aiyaPhase12Perf.lcp) : null,
      domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd || 0),
      loadEventEndMs: Math.round(nav?.loadEventEnd || 0),
      cls: Number((window.__aiyaPhase12Perf?.cls || 0).toFixed(4)),
      longTaskCount: longTasks.length,
      totalBlockingMs: Math.round(longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)),
      maxLongTaskMs: Math.round(longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
    };
  }).catch((caught) => ({
    fcpMs: null,
    lcpMs: null,
    domContentLoadedMs: null,
    loadEventEndMs: null,
    cls: null,
    longTaskCount: null,
    totalBlockingMs: null,
    maxLongTaskMs: null,
    metricReadError: caught instanceof Error ? caught.message.split("\n")[0] : String(caught),
  }));

  const apiRequests = requestSummaries.filter((item) => item.url.startsWith("/api/"));
  if (scenario.requiresAuthSurface && failures.some((item) => item.url.startsWith("/api/"))) {
    status = "FAIL";
    error ||= "api_failure_observed";
  }

  return {
    scenarioId: scenario.id,
    path: scenario.path,
    finalUrl: page.url(),
    status,
    error,
    readyMs,
    clickFeedbackMs,
    successSelectorMatched,
    metrics,
    requestCount: requestSummaries.length,
    apiRequestCount: apiRequests.length,
    failedRequestCount: failures.length,
    slowestRequests: [...requestSummaries].sort((a, b) => b.bodyFinishedMs - a.bodyFinishedMs).slice(0, 12),
    failedRequests: failures.slice(0, 12),
  };
}

function summarizeScenarioSamples(samples, scenario) {
  const p75 = {
    readyMs: percentile(samples.map((sample) => sample.readyMs), 75),
    clickFeedbackMs: percentile(samples.map((sample) => sample.clickFeedbackMs), 75),
    lcpMs: percentile(samples.map((sample) => sample.metrics.lcpMs), 75),
    maxLongTaskMs: percentile(samples.map((sample) => sample.metrics.maxLongTaskMs), 75),
    bodyFinishedApiMs: percentile(
      samples.flatMap((sample) => sample.slowestRequests.filter((request) => request.url.startsWith("/api/")).map((request) => request.bodyFinishedMs)),
      75,
    ),
  };
  const misses = [];
  const readyBudget = PHASE_1_2_BUDGETS[scenario.budgetKey];
  if (p75.readyMs != null && readyBudget && p75.readyMs > readyBudget) misses.push(`${scenario.budgetKey}:${p75.readyMs}>${readyBudget}`);
  if (p75.clickFeedbackMs != null && p75.clickFeedbackMs > PHASE_1_2_BUDGETS.clickFeedbackP75Ms) {
    misses.push(`clickFeedbackP75Ms:${p75.clickFeedbackMs}>${PHASE_1_2_BUDGETS.clickFeedbackP75Ms}`);
  }
  if (p75.maxLongTaskMs != null && p75.maxLongTaskMs > PHASE_1_2_BUDGETS.maxSingleLongTaskMs) {
    misses.push(`maxSingleLongTaskMs:${p75.maxLongTaskMs}>${PHASE_1_2_BUDGETS.maxSingleLongTaskMs}`);
  }
  if (p75.bodyFinishedApiMs != null && p75.bodyFinishedApiMs > PHASE_1_2_BUDGETS.bodyFinishedApiP75Ms) {
    misses.push(`bodyFinishedApiP75Ms:${p75.bodyFinishedApiMs}>${PHASE_1_2_BUDGETS.bodyFinishedApiP75Ms}`);
  }
  const failedSamples = samples.filter((sample) => sample.status !== "PASS");
  return {
    scenarioId: scenario.id,
    path: scenario.path,
    runs: samples.length,
    status: failedSamples.length ? "FAIL" : "PASS",
    p75,
    targetMisses: misses,
    failedSampleCount: failedSamples.length,
    samples,
  };
}

async function runProfileMeasurements(browser, baseUrl, profile, runs) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    serviceWorkers: profile.serviceWorkers ?? "allow",
  });
  await context.addCookies([
    {
      name: "manu_ai_demo_session",
      value: "active",
      url: baseUrl,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await installObservers(page);
  const scenarios = [];
  try {
    for (const scenario of PHASE_1_2_SCENARIOS) {
      const samples = [];
      for (let index = 0; index < runs; index += 1) {
        samples.push(await measureScenario(page, baseUrl, scenario));
      }
      scenarios.push(summarizeScenarioSamples(samples, scenario));
    }
  } finally {
    await context.close();
  }
  return { profileId: profile.id, scenarios };
}

async function runLocalDiagnostic() {
  const runs = Number(process.env.AIYA_PERF_RUNS || 3);
  const port = Number(process.env.AIYA_PERF_PORT || 3126);
  const baseUrl = `http://127.0.0.1:${port}`;
  const diagnosticEnv = {
    MANU_DEV_FALLBACK_STORE: "true",
    MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true",
    AI_CHAT_UI_ENABLED: "true",
    AI_CHAT_DETERMINISTIC_MODE: "true",
    NEXT_PUBLIC_APP_URL: baseUrl,
    MANU_ADMIN_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
  const build = run(process.execPath, [nextCliPath, "build", "--webpack"], {
    cwd: appRoot,
    env: diagnosticEnv,
  });
  if (build.status !== 0) return { status: "BLOCKED", blocker: "production_build_failed", build };

  const output = [];
  const standaloneServerPath = join(appRoot, ".next", "standalone", "server.js");
  const standaloneAssetPreparation = existsSync(standaloneServerPath)
    ? prepareStandaloneAssets()
    : { copied: false, reason: "non_standalone_server" };
  const serverArgs = existsSync(standaloneServerPath)
    ? [standaloneServerPath]
    : [nextCliPath, "start", "--port", String(port), "--hostname", "0.0.0.0"];
  const serverCwd = existsSync(standaloneServerPath) ? join(appRoot, ".next", "standalone") : appRoot;
  const server = spawn(process.execPath, serverArgs, {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "0.0.0.0",
      ...diagnosticEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => output.push(String(chunk)));
  server.stderr.on("data", (chunk) => output.push(String(chunk)));

  const profiles = [
    {
      id: "desktop_chrome_persistent_warm_session",
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
    },
    {
      id: "android_chrome_emulation_warm_session",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    },
  ];

  let browser;
  const measuredProfiles = [];
  try {
    await waitForServer(server, baseUrl, output);
    browser = await chromium.launch();
    for (const profile of profiles) {
      measuredProfiles.push(await runProfileMeasurements(browser, baseUrl, profile, runs));
    }
    return {
      status: "COMPLETE",
      baseUrl,
      runsPerScenario: runs,
      standaloneAssetPreparation,
      profiles: measuredProfiles,
      bundle: collectBundleEvidence(),
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      blocker: "local_phase_1_2_measurement_failed",
      error: error instanceof Error ? error.message : String(error),
      partialProfiles: measuredProfiles,
      serverOutputTail: output.join("\n").slice(-2000),
      standaloneAssetPreparation,
      bundle: existsSync(join(appRoot, ".next")) ? collectBundleEvidence() : null,
    };
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode == null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      else server.kill("SIGTERM");
    }
  }
}

async function collectPhysicalAndroidEvidence() {
  run("adb", ["start-server"]);
  let adb = run("adb", ["devices", "-l"]);
  for (let attempt = 0; attempt < 3 && !/\bdevice\b/.test(adb.stdout.replace(/^List of devices attached\s*/i, "")); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    adb = run("adb", ["devices", "-l"]);
  }
  const hasDevice = /\bdevice\b/.test(adb.stdout.replace(/^List of devices attached\s*/i, ""));
  const model = hasDevice ? run("adb", ["shell", "getprop", "ro.product.model"]).stdout : null;
  const androidVersion = hasDevice ? run("adb", ["shell", "getprop", "ro.build.version.release"]).stdout : null;
  const chromeVersion = hasDevice ? run("adb", ["shell", "dumpsys", "package", "com.android.chrome"]) : null;
  const devtools = hasDevice ? run("adb", ["shell", "cat", "/proc/net/unix"]) : null;
  const devtoolsRemotePresent = Boolean(devtools?.stdout && /devtools_remote/i.test(devtools.stdout));
  return {
    status: hasDevice && devtoolsRemotePresent ? "READY_FOR_CDP_CAPTURE" : hasDevice ? "CONNECTED_DEBUG_TARGET_NOT_READY" : "BLOCKED_NO_DEVICE",
    adbDevices: adb.stdout,
    model,
    androidVersion,
    chromeVersionName: chromeVersion?.stdout.match(/versionName=([^\r\n]+)/)?.[1] ?? null,
    devtoolsRemotePresent,
    note:
      "Phase 1.2 records physical device readiness without mutating the phone or live production data. CDP trace capture can run only when Chrome/PWA debug target is inspectable.",
  };
}

export function validatePhase12HarnessContract() {
  const failures = [];
  for (const scenario of PHASE_1_2_SCENARIOS) {
    if (!scenario.path.includes("workspace=")) {
      // Expected: Phase 1.2 must not use the obsolete workspace query param.
    } else {
      failures.push(`${scenario.id}:obsolete_workspace_param`);
    }
    if (scenario.id.includes("workspace") && !scenario.path.includes("clientId=")) {
      failures.push(`${scenario.id}:missing_client_id`);
    }
    if (scenario.id.includes("workspace") && !scenario.path.includes("clientTask=")) {
      failures.push(`${scenario.id}:missing_client_task`);
    }
    if (!scenario.successSelector || scenario.successSelector === "main") {
      if (["client_forms_workspace", "nutrition_workspace", "menu_workspace", "ai_chat"].includes(scenario.id)) {
        failures.push(`${scenario.id}:weak_success_selector`);
      }
    }
  }
  return { status: failures.length ? "FAIL" : "PASS", failures };
}

export function mergePhase1AndPhase12Findings(phase1Manifest, phase12Evidence) {
  const phase12Failures = [];
  for (const profile of phase12Evidence.localDiagnostic?.profiles ?? []) {
    for (const scenario of profile.scenarios ?? []) {
      if (scenario.status !== "PASS" || scenario.targetMisses?.length) {
        phase12Failures.push({
          profileId: profile.profileId,
          scenarioId: scenario.scenarioId,
          status: scenario.status,
          targetMisses: scenario.targetMisses ?? [],
          failedSampleCount: scenario.failedSampleCount ?? 0,
          p75: scenario.p75,
        });
      }
    }
  }

  const findings = [
    ...(phase1Manifest?.findings ?? []).map((finding) => ({
      ...finding,
      phase12Classification: "SUPPORTED_UNDER_REVIEW",
      sourcePhases: ["phase_1"],
    })),
  ];

  if (phase12Failures.some((failure) => failure.scenarioId === "ai_chat")) {
    findings.push({
      id: "PERF-F12-001",
      severity: "high",
      title: "AI Chat must not be considered performance-ready when authenticated data requests fail.",
      evidenceRefs: ["phase12.localDiagnostic.ai_chat.failedRequests"],
      affectedFiles: [
        "app/scripts/measure-aiya-performance.mjs",
        "app/scripts/measure-aiya-performance-phase-1-2.mjs",
        "app/src/app/dashboard/ai-chat/page.tsx",
        "app/src/lib/phase-85-stage-4c-route.ts",
      ],
      phase2RequiredChange:
        "Before optimizing AI Chat speed, separate authorization/session failures from render latency and require 2xx authenticated conversation-list reads in the measurement gate.",
      requiredTests: [
        "AI Chat diagnostic marks 401/403/500 API responses as FAIL",
        "AI Chat ready state requires ai-chat-workspace, not only main",
      ],
      phase12Classification: "CONFIRMED_MEASUREMENT_GAP",
      sourcePhases: ["phase_1_2"],
    });
  }

  if (phase12Failures.length > 0) {
    findings.push({
      id: "PERF-F12-002",
      severity: "high",
      title: "Warm authenticated journeys have failing or over-budget samples under the corrected harness.",
      evidenceRefs: phase12Failures.map((failure) => `phase12.localDiagnostic.${failure.profileId}.${failure.scenarioId}`),
      affectedFiles: ["locked_by_phase_1_2_measurement"],
      phase2RequiredChange:
        "Phase 2 may touch runtime code only for scenarios that failed or missed a budget under the corrected Phase 1.2 harness.",
      requiredTests: [
        "repeat corrected warm-session diagnostic after every Phase 2 change",
        "compare against Phase 1.2 p75 values and failed request counts",
      ],
      phase12Classification: "CAUSE_CANDIDATE_MEASURED",
      sourcePhases: ["phase_1_2"],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    status: findings.length ? "LOCKED_WITH_PHASE_1_AND_1_2_FINDINGS" : "NO_FINDINGS_LOCKED",
    productionDecision: "NO-GO",
    physicalAndroidStatus: phase12Evidence.physicalAndroid?.status ?? "UNOBSERVED",
    phase2ScopeRule:
      "Phase 2 can start only from findings in this combined manifest. Runtime fixes must target a confirmed failed request, over-budget scenario, or a Phase 1 finding still supported after Phase 1.2.",
    findings,
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writePhase2Scope(manifest) {
  const lines = [
    "# AIya Performance Phase 2 Execution Scope",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    "Production decision remains `NO-GO`.",
    "",
    "Phase 2 must use this file together with `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`.",
    "",
    "Allowed Phase 2 scope:",
    "",
    "- Reproduce every `CONFIRMED_MEASUREMENT_GAP` and `CAUSE_CANDIDATE_MEASURED` item before editing runtime code.",
    "- Fix only files named in a combined finding or test files that directly verify that finding.",
    "- Preserve tenant/account/actor authorization, RLS assumptions, service-role boundaries, idempotency, no-store/fail-closed behavior, and network-only PWA behavior.",
    "- Do not treat a faster unauthenticated, 401, fallback-only, skipped, simulated, or stale result as a PASS.",
    "",
    "Findings:",
    "",
    ...manifest.findings.flatMap((finding) => [
      `- ${finding.id}: ${finding.title}`,
      `  Classification: ${finding.phase12Classification ?? "UNCLASSIFIED"}`,
      `  Files: ${finding.affectedFiles.join(", ")}`,
    ]),
    "",
  ];
  writeFileSync(phase2ScopePath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const startedAt = new Date().toISOString();
  const git = collectGitEvidence();
  const harnessContract = validatePhase12HarnessContract();
  const liveRelease = await collectLiveReleaseEvidence();
  const physicalAndroid = await collectPhysicalAndroidEvidence();
  const localDiagnostic = await runLocalDiagnostic();
  const phase1Manifest = existsSync(join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json"))
    ? JSON.parse(readFileSync(join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json"), "utf8"))
    : { findings: [] };

  const blockers = [];
  if (harnessContract.status !== "PASS") blockers.push("phase_1_2_harness_contract_failed");
  if (localDiagnostic.status !== "COMPLETE") blockers.push(localDiagnostic.blocker || "local_diagnostic_blocked");
  if (
    localDiagnostic.status === "COMPLETE" &&
    localDiagnostic.profiles?.some((profile) =>
      profile.scenarios?.some((scenario) => scenario.scenarioId === "post_login_dashboard" && scenario.status !== "PASS"),
    )
  ) {
    blockers.push("authenticated_dashboard_journey_not_established");
  }
  if (
    localDiagnostic.status === "COMPLETE" &&
    localDiagnostic.profiles?.some((profile) =>
      profile.scenarios?.some((scenario) =>
        scenario.samples?.some((sample) => String(sample.error || "").includes("ERR_CONNECTION_REFUSED")),
      ),
    )
  ) {
    blockers.push("local_diagnostic_server_connection_refused");
  }
  if (physicalAndroid.status !== "READY_FOR_CDP_CAPTURE") blockers.push("physical_android_cdp_capture_not_executed");
  if (liveRelease.some((item) => item.status !== 200)) blockers.push("live_release_health_read_blocked");

  const localDiagnosticUsable =
    localDiagnostic.status === "COMPLETE" &&
    !blockers.includes("authenticated_dashboard_journey_not_established") &&
    !blockers.includes("local_diagnostic_server_connection_refused");
  const evidence = {
    phase: "AIya Performance Phase 1.2 - Measurement Validity and Causal Diagnosis",
    generatedAt: new Date().toISOString(),
    startedAt,
    sourceHead: git.head,
    productionDecision: "NO-GO",
    status: blockers.length ? "BLOCKED_WITH_EVIDENCE" : "COMPLETE_WITH_FINDINGS",
    closureRule:
      "This phase is not closed by tests alone. All ten planned stages must be represented; physical Android/PWA capture must be complete or explicitly BLOCKED and must not be counted as PASS.",
    stageLedger: [
      { id: "1.2.1", name: "Source and environment identity", status: "PASS" },
      { id: "1.2.2", name: "Correct post-login scenario contract", status: harnessContract.status },
      { id: "1.2.3", name: "Harness validation against obsolete params, weak selectors, trial-click gaps, and failed API propagation", status: harnessContract.status },
      { id: "1.2.4", name: "Desktop warm-session diagnostic", status: localDiagnosticUsable ? "PASS" : "BLOCKED" },
      { id: "1.2.5", name: "Physical Android readiness", status: physicalAndroid.status === "READY_FOR_CDP_CAPTURE" ? "READY" : "BLOCKED" },
      { id: "1.2.6", name: "Browser/API/body-finish correlation", status: localDiagnosticUsable ? "PASS" : "BLOCKED" },
      { id: "1.2.7", name: "Single-variable local browser versus emulated Android comparison", status: localDiagnosticUsable ? "PASS" : "BLOCKED" },
      { id: "1.2.8", name: "Phase 1 finding reclassification", status: "PASS" },
      { id: "1.2.9", name: "Merged Phase 1 plus 1.2 manifest", status: "PASS" },
      { id: "1.2.10", name: "Final checks and handoff update", status: "PENDING_UNTIL_COMMANDS_FINISH" },
    ],
    blockers,
    constraints: {
      productionDeploy: "NOT_EXECUTED",
      remoteMigration: "NOT_EXECUTED",
      externalSystemMutation: "NOT_EXECUTED",
      liveSeedOrReset: "NOT_EXECUTED",
      providerOrChannelEgress: "NOT_EXECUTED",
      rawPayloadCapture: "NOT_EXECUTED",
    },
    redactionRules: PHASE_1_2_REDACTION_RULES,
    scenarios: PHASE_1_2_SCENARIOS,
    git,
    liveRelease,
    physicalAndroid,
    harnessContract,
    localDiagnostic,
  };

  const manifest = mergePhase1AndPhase12Findings(phase1Manifest, evidence);
  evidence.combinedFindingManifestPath = relative(repoRoot, combinedManifestPath).replaceAll("\\", "/");
  evidence.phase2ScopePath = relative(repoRoot, phase2ScopePath).replaceAll("\\", "/");

  writeJson(phase12EvidencePath, evidence);
  writeJson(combinedManifestPath, manifest);
  writePhase2Scope(manifest);
  console.log(`wrote ${phase12EvidencePath}`);
  console.log(`wrote ${combinedManifestPath}`);
  console.log(`wrote ${phase2ScopePath}`);
  if (blockers.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
