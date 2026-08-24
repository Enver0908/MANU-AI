#!/usr/bin/env node
/**
 * Stage 7.4 local-lab performance harness.
 * Reuses Stage 5 p75 budgets and gzip multiplier. This is not field CWV evidence.
 */

import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { appRoot, buildStage5EvidenceHeader, docsRoot, npmCommand } from "./lib/stage-5-evidence.mjs";

const evidencePath = join(docsRoot, "PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json");
const baselinePath = join(docsRoot, "PHASE_85_STAGE_5_SHELL_BUNDLE_BASELINE.json");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");
const PORT = Number(process.env.STAGE7_LAB_PORT || 3111);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const shellGzipMaxMultiplierAgainstStage5Baseline = 1.1; // shellGzipMaxMultiplierAgainstStage5Baseline: 1.1

const ROUTES = [
  { id: "public_home", path: "/" },
  { id: "login", path: "/login" },
  { id: "purchase", path: "/purchase" },
  { id: "app_install", path: "/app-install" },
  { id: "admin", path: "/admin" },
  { id: "dashboard", path: "/dashboard" },
  { id: "clients", path: "/dashboard?section=clients" },
  { id: "messages", path: "/dashboard?section=messages" },
  { id: "alerts", path: "/dashboard?section=alerts" },
  { id: "notifications", path: "/dashboard?section=notifications" },
  { id: "ai_chat", path: "/dashboard/ai-chat" },
  { id: "settings", path: "/dashboard/settings" },
];

const DENSE_DASHBOARD_IDS = new Set(["dashboard", "clients", "messages", "alerts", "notifications"]);
const RUNS = Number(process.env.STAGE7_LAB_RUNS || 10);
const STRICT = process.env.STAGE7_LAB_STRICT !== "false";
const REUSE_BUILD = process.env.STAGE7_LAB_REUSE_BUILD === "true";
const TARGETS = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  interactionProxyMs: 200,
};

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function cleanNextBuildOutput() {
  const nextDir = join(appRoot, ".next");
  if (!existsSync(nextDir)) return;
  rmSync(nextDir, { force: true, recursive: true, maxRetries: 10, retryDelay: 500 });
}

function writeReport(report) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[stage-7-lab-perf] wrote ${evidencePath}`);
}

function stopServer(server) {
  if (server.exitCode != null || server.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  server.kill("SIGTERM");
}

function measureShellEntryGzipBytes(nextDir) {
  const buildManifestPath = join(nextDir, "build-manifest.json");
  if (!existsSync(buildManifestPath)) return { totalGzipBytes: 0, files: [] };
  const buildManifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
  const candidates = new Set([...(buildManifest.rootMainFiles || [])]);
  for (const files of Object.values(buildManifest.pages || {})) {
    for (const file of files) {
      if (String(file).includes("dashboard") || String(file).includes("main-app") || String(file).includes("webpack")) {
        candidates.add(file);
      }
    }
  }
  let total = 0;
  const measured = [];
  for (const relative of candidates) {
    if (!String(relative).endsWith(".js")) continue;
    const absolute = join(nextDir, relative);
    const staticPath = join(nextDir, "static", String(relative).replace(/^static\//, ""));
    const sourcePath = existsSync(absolute) ? absolute : existsSync(staticPath) ? staticPath : null;
    if (!sourcePath) continue;
    const gzipBytes = gzipSync(readFileSync(sourcePath)).byteLength;
    measured.push({ file: relative, gzipBytes });
    total += gzipBytes;
  }
  return { totalGzipBytes: total, files: measured };
}

async function waitForServer(server, output, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode != null) {
      throw new Error(`next_start_exited_${server.exitCode}: ${output.join("\n").slice(-4_000)}`);
    }
    try {
      const response = await fetch(BASE_URL, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // Server is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`next_start_timeout: ${output.join("\n").slice(-4_000)}`);
}

async function launchBrowser() {
  const attempts = [
    { name: "playwright-chromium", options: {} },
    { name: "installed-msedge", options: { channel: "msedge" } },
    { name: "installed-chrome", options: { channel: "chrome" } },
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.options);
      return { browser, source: attempt.name, attempts: [...failures, { name: attempt.name, status: "PASS" }] };
    } catch (error) {
      failures.push({
        name: attempt.name,
        status: "FAIL",
        error: error instanceof Error ? error.message.split("\n")[0] : String(error),
      });
    }
  }
  const details = failures.map((failure) => `${failure.name}:${failure.error}`).join("; ");
  throw new Error(`playwright_browser_launch_blocked: ${details}`);
}

async function installPerfObservers(page) {
  await page.addInitScript(() => {
    window.__stage7Perf = {
      lcp: 0,
      cls: 0,
      longTaskBlockingMs: 0,
      longTaskCount: 0,
    };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__stage7Perf.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Older engines may not expose LCP in local lab mode.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__stage7Perf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Older engines may not expose layout shift in local lab mode.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__stage7Perf.longTaskCount += 1;
          window.__stage7Perf.longTaskBlockingMs += Math.max(0, entry.duration - 50);
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older engines may not expose long tasks in local lab mode.
    }
  });
}

async function measureRoute(browser, route) {
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Stage7Lab",
      reducedMotion: "reduce",
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
    });
    const page = await context.newPage();
    await installPerfObservers(page);
    if (DENSE_DASHBOARD_IDS.has(route.id) || route.path.startsWith("/dashboard")) {
      await page.request.post(`${BASE_URL}/api/app-state`).catch(() => null);
    }
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
    const interactionStartedAt = Date.now();
    const firstControl = page
      .locator("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])")
      .first();
    const hasInteractionTarget = (await firstControl.count().catch(() => 0)) > 0;
    const interactionTarget = hasInteractionTarget
      ? await firstControl
          .evaluate((element) => {
            const tag = element.tagName.toLowerCase();
            const testId = element.getAttribute("data-testid");
            const role = element.getAttribute("role");
            return [tag, testId ? `testid:${testId}` : null, role ? `role:${role}` : null].filter(Boolean).join(" ");
          })
          .catch(() => "none")
      : "none";
    if (interactionTarget !== "none") {
      await firstControl.focus({ timeout: 3_000 }).catch(() => undefined);
      await firstControl.click({ timeout: 3_000, trial: true }).catch(() => undefined);
    }
    const fixedInteractionMs = Date.now() - interactionStartedAt;
    const metrics = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const nav = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const fcp = paints.find((item) => item.name === "first-contentful-paint")?.startTime || 0;
      const fallbackLcp = fcp || nav?.domContentLoadedEventEnd || 0;
      const longTaskBlockingMs = window.__stage7Perf?.longTaskBlockingMs ?? 0;
      return {
        lcpMs: window.__stage7Perf?.lcp || fallbackLcp,
        cls: window.__stage7Perf?.cls ?? 0,
        tbtMs: longTaskBlockingMs,
        interactionProxyMs: longTaskBlockingMs,
        fcpMs: fcp,
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? 0,
        longTaskCount: window.__stage7Perf?.longTaskCount ?? 0,
      };
    });
    metrics.interactionProxyMs = Math.max(metrics.interactionProxyMs, fixedInteractionMs);
    metrics.fixedInteractionMs = fixedInteractionMs;
    metrics.interactionTarget = interactionTarget;
    samples.push(metrics);
    await context.close();
  }
  const p75 = {
    lcpMs: percentile(samples.map((sample) => sample.lcpMs), 75),
    cls: percentile(samples.map((sample) => sample.cls), 75),
    tbtMs: percentile(samples.map((sample) => sample.tbtMs), 75),
    interactionProxyMs: percentile(samples.map((sample) => sample.interactionProxyMs), 75),
    fcpMs: percentile(samples.map((sample) => sample.fcpMs), 75),
  };
  const pass = {
    lcp: p75.lcpMs != null && p75.lcpMs <= TARGETS.lcpMs,
    cls: p75.cls != null && p75.cls <= TARGETS.cls,
    tbt: p75.tbtMs != null && p75.tbtMs <= TARGETS.tbtMs,
    interactionProxy: p75.interactionProxyMs != null && p75.interactionProxyMs <= TARGETS.interactionProxyMs,
  };
  return {
    route: route.id,
    path: route.path,
    sampleCount: samples.length,
    denseSeeded: DENSE_DASHBOARD_IDS.has(route.id),
    runs: samples,
    p75,
    pass,
  };
}

function measureBundleBudget() {
  const measured = measureShellEntryGzipBytes(join(appRoot, ".next"));
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, "utf8"))
    : { shellEntryGzipBytes: measured.totalGzipBytes || 1 };
  const baselineBytes = baseline.shellEntryGzipBytes || baseline.shellEntryGzipBytes || 1;
  const limitBytes = Math.floor(baselineBytes * shellGzipMaxMultiplierAgainstStage5Baseline);
  return {
    currentGzipBytes: measured.totalGzipBytes,
    baselineGzipBytes: baselineBytes,
    limitGzipBytes: limitBytes,
    withinBudget: measured.totalGzipBytes > 0 && measured.totalGzipBytes <= limitBytes,
    files: measured.files,
    shellGzipMaxMultiplierAgainstStage5Baseline,
  };
}

function baseReport(status, blockers = []) {
  return {
    ...buildStage5EvidenceHeader("performance", "npm run test:stage-7-lab-perf"),
    kind: "local_lab_only",
    status,
    productionStatus: "NO-GO",
    disclaimer:
      "Local lab measurement only. This is not field CWV, not real-device evidence, and not a production launch approval.",
    runsPerRoute: RUNS,
    strictMode: STRICT,
    targets: TARGETS,
    measurement: {
      baseUrl: BASE_URL,
      routeCountRequired: ROUTES.length,
      routeSet: ROUTES,
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
      waitAfterLoadMs: 1500,
      observerTypes: ["largest-contentful-paint", "layout-shift", "longtask"],
      interactionProtocol: "focus_first_enabled_control_then_trial_click",
      platform: process.platform,
    },
    blockers,
    evidencePath,
  };
}

async function main() {
  if (!REUSE_BUILD || !existsSync(join(appRoot, ".next"))) {
    console.log("[stage-7-lab-perf] building production app...");
    cleanNextBuildOutput();
    const build = spawnSync(npmCommand(), ["run", "build"], {
      cwd: appRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const server = spawn(process.execPath, [nextCliPath, "start", "--port", String(PORT)], {
    cwd: appRoot,
    env: {
      ...process.env,
      MANU_DEV_FALLBACK_STORE: "true",
      MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true",
      AI_CHAT_UI_ENABLED: "true",
      AI_CHAT_DETERMINISTIC_MODE: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverOutput = [];
  server.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
  server.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));

  let browser = null;
  let launch = null;
  const routeReports = [];
  try {
    await waitForServer(server, serverOutput);
    launch = await launchBrowser();
    browser = launch.browser;
    for (const route of ROUTES) {
      console.log(`[stage-7-lab-perf] measuring ${route.id} x${RUNS}`);
      routeReports.push(await measureRoute(browser, route));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocker = message.includes("playwright_browser_launch_blocked")
      ? "playwright_browser_launch_blocked"
      : "lab_perf_harness_failed";
    writeReport({
      ...baseReport("BLOCKED", [blocker]),
      routes: routeReports,
      summary: {
        routeCount: routeReports.length,
        failedRouteIds: ROUTES.map((route) => route.id),
        allTargetsMet: false,
      },
      bundleBudget: measureBundleBudget(),
      error: message,
      serverOutputTail: serverOutput.join("\n").slice(-4_000),
    });
    throw error;
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }

  const failed = routeReports.filter((route) => Object.values(route.pass).some((ok) => !ok));
  const bundleBudget = measureBundleBudget();
  const allTargetsMet = failed.length === 0 && bundleBudget.withinBudget;
  const status = allTargetsMet ? "PASS" : "TARGET_MISS_REPORTED";
  const report = {
    ...baseReport(status, allTargetsMet ? [] : ["lab_perf_target_miss"]),
    measurement: {
      ...baseReport(status).measurement,
      browser: {
        engine: "chromium",
        source: launch.source,
        headless: true,
        launchAttempts: launch.attempts,
      },
    },
    routes: routeReports,
    bundleBudget,
    summary: {
      routeCount: routeReports.length,
      failedRouteIds: failed.map((route) => route.route),
      allTargetsMet,
      bundleWithinBudget: bundleBudget.withinBudget,
    },
  };

  writeReport(report);

  if (!allTargetsMet) {
    console.warn("[stage-7-lab-perf] one or more lab p75 or gzip targets missed; results are reported, not hidden.");
    process.exitCode = STRICT ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
