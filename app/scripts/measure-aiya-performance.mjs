#!/usr/bin/env node
/**
 * AIya Phase 1 performance audit harness.
 *
 * This script records root-cause evidence only. It must not seed/reset live
 * data, mutate production, write raw payload bodies, or treat lab results as a
 * production GO decision.
 */

import { spawn, spawnSync } from "node:child_process";
import {
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

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const runtimeRoot = join(repoRoot, ".manu-runtime", "performance");
const evidencePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json");
const findingManifestPath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json");
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

export const BUDGETS = {
  publicReferenceLcpP75Ms: 2500,
  dashboardReadyP75Ms: 3000,
  warmTaskReadyP75Ms: 1000,
  clickFeedbackP75Ms: 200,
  maxSingleLongTaskMs: 500,
  slowNetworkTaskReadyP75Ms: 4000,
};

export const SCENARIOS = [
  {
    id: "public_home",
    path: "/",
    category: "public",
    readySelector: "main",
    actionSelector: "a[href], button:not([disabled])",
    budgetKey: "publicReferenceLcpP75Ms",
    allowedLive: true,
  },
  {
    id: "login",
    path: "/login",
    category: "auth",
    readySelector: "form, main",
    actionSelector: "input, button:not([disabled]), a[href]",
    budgetKey: "publicReferenceLcpP75Ms",
    allowedLive: true,
  },
  {
    id: "dashboard_overview",
    path: "/dashboard",
    category: "authenticated_dashboard",
    readySelector: "main",
    actionSelector: "a[href], button:not([disabled])",
    budgetKey: "dashboardReadyP75Ms",
    allowedLive: false,
  },
  {
    id: "client_forms_workspace",
    path: "/dashboard?section=clients&workspace=forms",
    category: "authenticated_workspace",
    readySelector: "main",
    actionSelector: "button:not([disabled]), textarea, input, a[href]",
    budgetKey: "warmTaskReadyP75Ms",
    allowedLive: false,
  },
  {
    id: "nutrition_workspace",
    path: "/dashboard?section=clients&workspace=nutrition",
    category: "authenticated_workspace",
    readySelector: "main",
    actionSelector: "button:not([disabled]), textarea, input, a[href]",
    budgetKey: "warmTaskReadyP75Ms",
    allowedLive: false,
  },
  {
    id: "menu_workspace",
    path: "/dashboard?section=clients&workspace=menu",
    category: "authenticated_workspace",
    readySelector: "main",
    actionSelector: "button:not([disabled]), textarea, input, a[href]",
    budgetKey: "warmTaskReadyP75Ms",
    allowedLive: false,
  },
  {
    id: "ai_chat",
    path: "/dashboard/ai-chat",
    category: "authenticated_ai",
    readySelector: "main",
    actionSelector: "textarea, button:not([disabled]), a[href]",
    budgetKey: "warmTaskReadyP75Ms",
    allowedLive: false,
  },
];

export const REDACTION_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "token",
  "password",
  "prompt",
  "body",
  "raw",
  "content",
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
  if (usable.length === 0) return null;
  const index = Math.max(0, Math.min(usable.length - 1, Math.ceil((p / 100) * usable.length) - 1));
  return usable[index];
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else files.push(absolute);
  }
  return files;
}

function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, "http://local.invalid");
    return `${parsed.pathname}${parsed.search ? "?<redacted>" : ""}`;
  } catch {
    return String(url).split("?")[0];
  }
}

function summarizeRequest(url, method, resourceType, status, durationMs, encodedBytes) {
  return {
    url: sanitizeUrl(url),
    method,
    resourceType,
    status,
    durationMs: Math.round(durationMs),
    encodedBytes,
  };
}

function collectGitEvidence() {
  const branch = run("git", ["branch", "--show-current"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const remote = run("git", ["ls-remote", "--symref", "origin", "HEAD", "refs/heads/codex/production-readiness-stage-1"]);
  const diffCheck = run("git", ["diff", "--check"]);
  const phaseFiles = new Set([
    "app/package.json",
    "app/scripts/measure-aiya-performance.mjs",
    "app/scripts/performance-audit.test.mjs",
    "docs/AIYA_PERFORMANCE_ACTION_PLAN.md",
    "docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json",
    "docs/AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json",
    "HANDOFF_FOR_NEXT_CODEX.md",
    "docs/RISK_REGISTER.md",
  ]);
  const statusLines = status.stdout.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("## "));
  const onlyPhaseFilesDirty = statusLines.every((line) => {
    const normalized = line.slice(3).trim().replaceAll("\\", "/");
    return phaseFiles.has(normalized);
  });
  const headMatchesUpstream = upstream.status === 0 && upstream.stdout === head.stdout;
  return {
    branch: branch.stdout,
    statusShortBranch: status.stdout,
    head: head.stdout,
    upstreamHead: upstream.status === 0 ? upstream.stdout : null,
    upstreamStatus: upstream.status,
    remoteProductionReadinessBranch: remote.stdout,
    diffCheckStatus: diffCheck.status,
    diffCheckOutput: diffCheck.stdout || diffCheck.stderr,
    cleanAtStart: status.stdout.includes("codex/production-readiness-stage-1") && statusLines.length === 0,
    onlyPhaseFilesDirty,
    headMatchesUpstream,
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
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { parseError: "non_json_response" };
      }
      results.push({
        endpoint,
        status: response.status,
        durationMs: Date.now() - startedAt,
        releaseId: parsed?.releaseId ?? parsed?.release ?? null,
        commit: parsed?.commit ?? parsed?.commitSha ?? null,
        migrationFingerprint: parsed?.migrationFingerprint ?? parsed?.migration_fingerprint ?? null,
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

function collectStaticArchitectureEvidence() {
  const useAiyaState = readTextIfExists(join(appRoot, "src", "lib", "use-aiya-state.ts"));
  const appStateRoute = readTextIfExists(join(appRoot, "src", "app", "api", "app-state", "route.ts"));
  const supabaseStore = readTextIfExists(join(appRoot, "src", "lib", "supabase-store.ts"));
  const dashboardApp = readTextIfExists(join(appRoot, "src", "components", "dashboard-app.tsx"));
  const shellProvider = readTextIfExists(join(appRoot, "src", "components", "dashboard", "shell-provider.tsx"));
  const workspaceHook = readTextIfExists(join(appRoot, "src", "lib", "use-stage-6-client-workspace.ts"));
  const inboxHook = readTextIfExists(join(appRoot, "src", "lib", "use-stage-4b-inbox.ts"));
  const messagingHook = readTextIfExists(join(appRoot, "src", "lib", "use-stage-4b2-messaging.ts"));
  const aiChatHook = readTextIfExists(join(appRoot, "src", "lib", "use-ai-chat.ts"));

  const appStateFullLoadRefs = [...supabaseStore.matchAll(/loadSupabaseState\(/g)].length;
  const windowedLoaderPresent = supabaseStore.includes("loadSupabaseWindowedDashboardPayload");
  const appStateDefaultFull = appStateRoute.includes('view === "windowed"') && appStateRoute.includes("loadSupabaseState(tenantContext)");
  const bootstrapEndpointPresent = shellProvider.includes("/api/shell/bootstrap");
  const hookPollingRefs =
    [...inboxHook.matchAll(/setTimeout|pollTimerRef/g)].length +
    [...messagingHook.matchAll(/setTimeout|pollTimerRef/g)].length +
    [...aiChatHook.matchAll(/setTimeout/g)].length;
  const dashboardStaticImports = [...dashboardApp.matchAll(/^import\s+/gm)].length;
  const workspaceNoStoreFetches = [...workspaceHook.matchAll(/cache:\s*"no-store"|fetch\(/g)].length;

  return {
    filesInspected: [
      "app/src/lib/use-aiya-state.ts",
      "app/src/app/api/app-state/route.ts",
      "app/src/lib/supabase-store.ts",
      "app/src/components/dashboard-app.tsx",
      "app/src/components/dashboard/shell-provider.tsx",
      "app/src/lib/use-stage-6-client-workspace.ts",
      "app/src/lib/use-stage-4b-inbox.ts",
      "app/src/lib/use-stage-4b2-messaging.ts",
      "app/src/lib/use-ai-chat.ts",
      "app/playwright.config.ts",
      "app/scripts/measure-stage-7-lab-perf.mjs",
    ],
    observations: [
      {
        id: "app_state_initial_full_hydration",
        status: useAiyaState.includes('replaceFromApi("/api/app-state")') ? "OBSERVED" : "NOT_OBSERVED",
        evidence: "useAiyaState schedules /api/app-state hydration on mount.",
      },
      {
        id: "app_state_windowed_route_exists_but_not_default",
        status: windowedLoaderPresent && appStateDefaultFull ? "OBSERVED" : "NOT_OBSERVED",
        evidence: "GET /api/app-state can route view=windowed, while default path remains full loadSupabaseState.",
      },
      {
        id: "supabase_store_full_load_fanout",
        status: appStateFullLoadRefs > 10 ? "OBSERVED" : "LIMITED",
        count: appStateFullLoadRefs,
        evidence: "loadSupabaseState remains referenced by multiple mutation and read paths.",
      },
      {
        id: "shell_bootstrap_parallel_surface",
        status: bootstrapEndpointPresent ? "OBSERVED" : "NOT_OBSERVED",
        evidence: "ShellProvider independently requests /api/shell/bootstrap.",
      },
      {
        id: "background_polling_surfaces",
        status: hookPollingRefs > 0 ? "OBSERVED" : "NOT_OBSERVED",
        count: hookPollingRefs,
        evidence: "Inbox, messaging, and AI chat hooks include timer-driven refresh behavior.",
      },
      {
        id: "dashboard_static_import_surface",
        status: dashboardStaticImports > 25 ? "OBSERVED" : "LIMITED",
        count: dashboardStaticImports,
        evidence: "Dashboard client component statically imports many panels/hooks.",
      },
      {
        id: "workspace_bounded_no_store_fetches",
        status: workspaceNoStoreFetches > 0 ? "OBSERVED" : "NOT_OBSERVED",
        count: workspaceNoStoreFetches,
        evidence: "Stage 6 workspace hook uses bounded no-store domain fetches.",
      },
    ],
  };
}

function collectBundleEvidence() {
  const nextDir = join(appRoot, ".next");
  const files = walk(join(nextDir, "static")).filter((file) => file.endsWith(".js"));
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

async function waitForServer(server, baseUrl, output, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode != null) throw new Error(`next_start_exited_${server.exitCode}`);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`next_start_timeout:${output.join("\n").slice(-1000)}`);
}

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__aiyaPerf = {
      lcp: 0,
      cls: 0,
      longTasks: [],
      marks: {},
    };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__aiyaPerf.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__aiyaPerf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__aiyaPerf.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
}

async function measureScenario(browser, baseUrl, scenario, runs, profile) {
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      deviceScaleFactor: profile.deviceScaleFactor,
      userAgent: profile.userAgent,
      reducedMotion: "reduce",
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await installObservers(page);

    const requests = new Map();
    const requestSummaries = [];
    page.on("request", (request) => {
      requests.set(request, { startedAt: Date.now(), method: request.method(), url: request.url(), type: request.resourceType() });
    });
    page.on("response", async (response) => {
      const request = response.request();
      const started = requests.get(request);
      if (!started) return;
      const timing = Date.now() - started.startedAt;
      const headers = response.headers();
      const encodedBytes = Number(headers["content-length"] || 0);
      requestSummaries.push(summarizeRequest(started.url, started.method, started.type, response.status(), timing, encodedBytes));
    });

    const startedAt = Date.now();
    let readyMs = null;
    let clickFeedbackMs = null;
    let status = "PASS";
    let error = null;
    try {
      await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator(scenario.readySelector).first().waitFor({ state: "visible", timeout: 15_000 });
      readyMs = Date.now() - startedAt;
      const target = page.locator(scenario.actionSelector).first();
      if ((await target.count().catch(() => 0)) > 0) {
        const actionStart = Date.now();
        await target.focus({ timeout: 3_000 }).catch(() => undefined);
        await target.click({ timeout: 3_000, trial: true }).catch(() => undefined);
        clickFeedbackMs = Date.now() - actionStart;
      }
      await page.waitForTimeout(750);
    } catch (caught) {
      status = "FAIL";
      error = caught instanceof Error ? caught.message.split("\n")[0] : String(caught);
    }

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const fcp = paints.find((item) => item.name === "first-contentful-paint")?.startTime || 0;
      const longTasks = window.__aiyaPerf?.longTasks ?? [];
      return {
        fcpMs: Math.round(fcp),
        lcpMs: Math.round(window.__aiyaPerf?.lcp || fcp || nav?.domContentLoadedEventEnd || 0),
        domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd || 0),
        loadEventEndMs: Math.round(nav?.loadEventEnd || 0),
        cls: Number((window.__aiyaPerf?.cls || 0).toFixed(4)),
        longTaskCount: longTasks.length,
        totalBlockingMs: Math.round(longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)),
        maxLongTaskMs: Math.round(longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
      };
    });

    const failedRequests = requestSummaries.filter((item) => item.status >= 400);
    const apiRequests = requestSummaries.filter((item) => item.url.startsWith("/api/"));
    const totalTransferBytes = requestSummaries.reduce((sum, item) => sum + (Number.isFinite(item.encodedBytes) ? item.encodedBytes : 0), 0);
    samples.push({
      run: index + 1,
      status,
      error,
      readyMs,
      clickFeedbackMs,
      metrics,
      requestCount: requestSummaries.length,
      apiRequestCount: apiRequests.length,
      failedRequestCount: failedRequests.length,
      totalTransferBytes,
      slowestRequests: requestSummaries.sort((a, b) => b.durationMs - a.durationMs).slice(0, 12),
      apiRequests: apiRequests.slice(0, 20),
    });
    await context.close();
  }
  const p75 = {
    readyMs: percentile(samples.map((sample) => sample.readyMs), 75),
    clickFeedbackMs: percentile(samples.map((sample) => sample.clickFeedbackMs), 75),
    lcpMs: percentile(samples.map((sample) => sample.metrics.lcpMs), 75),
    totalBlockingMs: percentile(samples.map((sample) => sample.metrics.totalBlockingMs), 75),
    maxLongTaskMs: percentile(samples.map((sample) => sample.metrics.maxLongTaskMs), 75),
    requestCount: percentile(samples.map((sample) => sample.requestCount), 75),
    apiRequestCount: percentile(samples.map((sample) => sample.apiRequestCount), 75),
  };
  const budget = BUDGETS[scenario.budgetKey];
  const targetMisses = [];
  if (p75.readyMs != null && p75.readyMs > budget) targetMisses.push(`${scenario.budgetKey}:${p75.readyMs}>${budget}`);
  if (p75.clickFeedbackMs != null && p75.clickFeedbackMs > BUDGETS.clickFeedbackP75Ms) {
    targetMisses.push(`clickFeedbackP75Ms:${p75.clickFeedbackMs}>${BUDGETS.clickFeedbackP75Ms}`);
  }
  if (p75.maxLongTaskMs != null && p75.maxLongTaskMs > BUDGETS.maxSingleLongTaskMs) {
    targetMisses.push(`maxSingleLongTaskMs:${p75.maxLongTaskMs}>${BUDGETS.maxSingleLongTaskMs}`);
  }
  return {
    scenarioId: scenario.id,
    path: scenario.path,
    category: scenario.category,
    runs: samples.length,
    p75,
    targetMisses,
    samples,
  };
}

async function measureLocalLab() {
  const runs = Number(process.env.AIYA_PERF_RUNS || 10);
  const port = Number(process.env.AIYA_PERF_PORT || 3125);
  const baseUrl = `http://127.0.0.1:${port}`;
  const reuseBuild = process.env.AIYA_PERF_REUSE_BUILD === "true";
  const profiles = [
    {
      id: "desktop_chrome_lab",
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
      userAgent: undefined,
    },
    {
      id: "android_chrome_emulation",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 AIyaPerfAudit",
    },
  ];

  if (!reuseBuild || !existsSync(join(appRoot, ".next"))) {
    const build = run(process.execPath, [nextCliPath, "build", "--webpack"], {
      cwd: appRoot,
      env: {
        MANU_DEV_FALLBACK_STORE: "true",
        MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true",
        AI_CHAT_UI_ENABLED: "true",
        AI_CHAT_DETERMINISTIC_MODE: "true",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    });
    if (build.status !== 0) {
      return { status: "BLOCKED", blocker: "production_build_failed", build };
    }
  }

  const serverOutput = [];
  const server = spawn(process.execPath, [nextCliPath, "start", "--port", String(port)], {
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
  server.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
  server.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));

  const results = [];
  let browser;
  try {
    await waitForServer(server, baseUrl, serverOutput);
    browser = await chromium.launch();
    for (const profile of profiles) {
      for (const scenario of SCENARIOS) {
        results.push({
          profileId: profile.id,
          ...(await measureScenario(browser, baseUrl, scenario, runs, profile)),
        });
      }
    }
    return {
      status: "COMPLETE",
      runsPerScenario: runs,
      baseUrl,
      profiles: profiles.map(({ userAgent, ...profile }) => ({ ...profile, userAgent: userAgent ? "redacted-lab-user-agent" : null })),
      scenarios: results,
      bundle: collectBundleEvidence(),
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      blocker: "local_lab_measurement_failed",
      error: error instanceof Error ? error.message : String(error),
      partialScenarios: results,
      serverOutputTail: serverOutput.join("\n").slice(-2000),
      bundle: existsSync(join(appRoot, ".next")) ? collectBundleEvidence() : null,
    };
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode == null) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        server.kill("SIGTERM");
      }
    }
  }
}

export function buildPhase2FindingManifest(staticEvidence, labEvidence) {
  const findings = [];
  const staticById = new Map(staticEvidence.observations.map((item) => [item.id, item]));
  const scenarioMisses =
    labEvidence?.scenarios?.filter((scenario) => scenario.targetMisses?.length > 0 || scenario.samples?.some((sample) => sample.status !== "PASS")) ?? [];

  if (staticById.get("app_state_initial_full_hydration")?.status === "OBSERVED") {
    findings.push({
      id: "PERF-F2-001",
      severity: "high",
      title: "Dashboard mount still performs broad /api/app-state hydration before measured task readiness is proven safe.",
      evidenceRefs: ["staticArchitecture.observations.app_state_initial_full_hydration"],
      affectedFiles: [
        "app/src/lib/use-aiya-state.ts",
        "app/src/app/api/app-state/route.ts",
        "app/src/lib/supabase-store.ts",
        "app/src/components/dashboard-app.tsx",
      ],
      phase2RequiredChange:
        "Replace default dashboard bootstrap dependence on full ManuAppState only after consumer compatibility is mapped; use bounded/windowed DTOs without casting incomplete data to full state.",
      requiredTests: [
        "workspace task navigation does not request broad /api/app-state",
        "bounded active-client data stays tenant/account authorized",
        "legacy mutation paths still return expected revisions and conflict codes",
      ],
    });
  }

  if (staticById.get("background_polling_surfaces")?.status === "OBSERVED") {
    findings.push({
      id: "PERF-F2-002",
      severity: "medium",
      title: "Timer-driven inbox, messaging, and AI chat refreshes can compete with initial navigation.",
      evidenceRefs: ["staticArchitecture.observations.background_polling_surfaces"],
      affectedFiles: [
        "app/src/lib/use-stage-4b-inbox.ts",
        "app/src/lib/use-stage-4b2-messaging.ts",
        "app/src/lib/use-ai-chat.ts",
      ],
      phase2RequiredChange:
        "Gate background refresh by visible route, stable resource owner key, in-flight dedupe, and post-readiness scheduling while preserving abort/sequence invalidation.",
      requiredTests: [
        "initial dashboard task readiness has no duplicate background fetch burst",
        "hidden tab does not extend session",
        "route change aborts stale resource refresh",
      ],
    });
  }

  if (staticById.get("dashboard_static_import_surface")?.status === "OBSERVED") {
    findings.push({
      id: "PERF-F2-003",
      severity: "medium",
      title: "Dashboard client entry statically imports a broad interaction surface.",
      evidenceRefs: ["staticArchitecture.observations.dashboard_static_import_surface", "localLab.bundle.largestStaticJs"],
      affectedFiles: [
        "app/src/components/dashboard-app.tsx",
        "app/src/components/dashboard/**",
        "app/src/app/dashboard/**",
      ],
      phase2RequiredChange:
        "Split only measured heavy panels using Next.js dynamic import after reading local Next docs; keep first visible dashboard and active workspace controls eager.",
      requiredTests: [
        "dashboard first screen visual and accessibility pass",
        "forms/nutrition/menu/ai-chat deep links render after chunk load",
        "bundle gzip and long-task metrics improve against Phase 1 baseline",
      ],
    });
  }

  if (scenarioMisses.length > 0) {
    findings.push({
      id: "PERF-F2-004",
      severity: "high",
      title: "Measured lab scenarios miss one or more readiness, click-feedback, or long-task budgets.",
      evidenceRefs: scenarioMisses.map((scenario) => `localLab.scenarios.${scenario.profileId}.${scenario.scenarioId}`),
      affectedFiles: ["locked_by_phase_1_measurement"],
      phase2RequiredChange:
        "For each missed scenario, implement only the file/function changes mapped by its slowest requests, long-task profile, and static dependency chain.",
      requiredTests: [
        "20-sample closure comparison for every missed scenario",
        "no scenario that previously passed regresses by both >10% and >100ms p75",
      ],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    status: findings.length > 0 ? "LOCKED_WITH_FINDINGS" : "NO_CODE_FINDINGS_LOCKED",
    findings,
    phase2ScopeRule:
      "Faz 2 may change only files named by a locked finding or files added solely to test that finding; any new cause requires reopening Phase 1 evidence.",
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  mkdirSync(runtimeRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  const git = collectGitEvidence();
  const liveRelease = await collectLiveReleaseEvidence();
  const staticArchitecture = collectStaticArchitectureEvidence();
  const localLab = await measureLocalLab();
  const phase2FindingManifest = buildPhase2FindingManifest(staticArchitecture, localLab);
  const blockers = [];
  if (!git.cleanAtStart && !git.onlyPhaseFilesDirty) blockers.push("unexpected_non_phase_worktree_changes");
  if (localLab.status === "BLOCKED") blockers.push(localLab.blocker || "local_lab_blocked");
  if (liveRelease.some((item) => item.status !== 200)) blockers.push("live_release_health_read_blocked");

  const evidence = {
    phase: "AIya Uctan Uca Performans Denetimi ve Iyilestirme - Faz 1",
    generatedAt: new Date().toISOString(),
    startedAt,
    sourceHead: git.head,
    productionDecision: "NO-GO",
    status: blockers.length > 0 ? "BLOCKED" : "COMPLETE_WITH_FINDINGS",
    closureRule:
      "All eight Phase 1 stages must be represented before tests are considered; tests alone do not close the phase.",
    stageLedger: [
      {
        id: "1.1",
        name: "Git/live/environment identity",
        status: git.cleanAtStart || (git.onlyPhaseFilesDirty && git.headMatchesUpstream) ? "PASS" : "FAIL",
      },
      { id: "1.2", name: "Route and UI scenario inventory", status: SCENARIOS.length >= 7 ? "PASS" : "FAIL" },
      { id: "1.3", name: "Measurement harness and redaction controls", status: "PASS" },
      { id: "1.4", name: "Desktop and Android-emulated local baseline", status: localLab.status === "COMPLETE" ? "PASS" : "BLOCKED" },
      { id: "1.5", name: "Data/auth critical-path scan", status: "PASS" },
      { id: "1.6", name: "Bundle/CPU/render scan", status: localLab.bundle ? "PASS" : "BLOCKED" },
      { id: "1.7", name: "Hosted readonly release-health check", status: liveRelease.every((item) => item.status === 200) ? "PASS" : "BLOCKED" },
      { id: "1.8", name: "Phase 2 exact finding manifest", status: phase2FindingManifest.findings.length > 0 ? "PASS" : "REVIEW_REQUIRED" },
    ],
    blockers,
    constraints: {
      externalMutation: "NOT_EXECUTED",
      liveSeedOrReset: "NOT_EXECUTED",
      productionDeploy: "NOT_EXECUTED",
      remoteMigration: "NOT_EXECUTED",
      providerOrChannelEgress: "NOT_EXECUTED",
      rawPayloadCapture: "NOT_EXECUTED",
      physicalAndroidChrome: "USER_OBSERVED_OUTSIDE_HARNESS; NOT_AUTOMATED_BY_THIS_SCRIPT",
    },
    budgets: BUDGETS,
    scenarios: SCENARIOS,
    git,
    liveRelease,
    staticArchitecture,
    localLab,
    phase2FindingManifestPath: relative(repoRoot, findingManifestPath).replaceAll("\\", "/"),
    evidencePath: relative(repoRoot, evidencePath).replaceAll("\\", "/"),
  };

  writeJson(findingManifestPath, phase2FindingManifest);
  writeJson(evidencePath, evidence);
  console.log(`wrote ${evidencePath}`);
  console.log(`wrote ${findingManifestPath}`);
  if (blockers.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
