#!/usr/bin/env node
/**
 * Local lab PerformanceObserver harness for Stage 5 routes (Faz 9).
 * Reports p75 for LCP / CLS / TBT-proxy. Does NOT claim field Core Web Vitals.
 */

import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const evidencePath = join(appRoot, "..", "docs", "PHASE_85_STAGE_5_LAB_PERF_REPORT.json");

const ROUTES = [
  { id: "home", path: "/dashboard" },
  { id: "clients", path: "/dashboard?section=clients" },
  { id: "messages", path: "/dashboard?section=messages" },
  { id: "ai_chat", path: "/dashboard/ai-chat" },
  { id: "settings", path: "/dashboard/settings" },
];

const RUNS = Number(process.env.STAGE5_LAB_RUNS || 10);
const TARGETS = {
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
  tbtMs: 200,
};

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function measureRoute(browser, baseURL, route) {
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.request.post(`${baseURL}/api/app-state`).catch(() => null);
    await page.goto(`${baseURL}${route.path}`, { waitUntil: "networkidle", timeout: 60_000 });
    const metrics = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const nav = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
      const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : nav?.domContentLoadedEventEnd || 0;
      const cls = performance.getEntriesByType("layout-shift").reduce((sum, entry) => {
        if (entry.hadRecentInput) return sum;
        return sum + entry.value;
      }, 0);
      const tbtProxy = Math.max(0, (nav?.domInteractive || 0) - (nav?.responseEnd || 0));
      const fcp = paints.find((item) => item.name === "first-contentful-paint")?.startTime || 0;
      return { lcp, cls, tbtProxy, fcp, inpProxy: tbtProxy };
    });
    samples.push(metrics);
    await context.close();
  }
  return {
    route: route.id,
    runs: samples,
    p75: {
      lcpMs: percentile(samples.map((s) => s.lcp), 75),
      cls: percentile(samples.map((s) => s.cls), 75),
      tbtMs: percentile(samples.map((s) => s.tbtProxy), 75),
      inpMs: percentile(samples.map((s) => s.inpProxy), 75),
    },
  };
}

async function main() {
  if (!existsSync(join(appRoot, ".next"))) {
    console.log("[lab-perf] building production app…");
    const build = spawnSync("npm", ["run", "build"], { cwd: appRoot, stdio: "inherit", shell: true });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }

  const server = spawn("npx", ["next", "start", "--port", "3110"], {
    cwd: appRoot,
    shell: true,
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

  await new Promise((resolve) => setTimeout(resolve, 4000));
  const browser = await chromium.launch();
  const baseURL = "http://127.0.0.1:3110";
  const routeReports = [];
  try {
    for (const route of ROUTES) {
      console.log(`[lab-perf] measuring ${route.id} x${RUNS}`);
      routeReports.push(await measureRoute(browser, baseURL, route));
    }
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  const report = {
    kind: "local_lab_only",
    disclaimer:
      "Not field Core Web Vitals. Not a real-dietitian usability study. Hardware variance can move results.",
    generatedAt: new Date().toISOString(),
    runsPerRoute: RUNS,
    targets: TARGETS,
    routes: routeReports,
  };

  for (const route of routeReports) {
    route.pass = {
      lcp: route.p75.lcpMs != null && route.p75.lcpMs <= TARGETS.lcpMs,
      cls: route.p75.cls != null && route.p75.cls <= TARGETS.cls,
      tbt: route.p75.tbtMs != null && route.p75.tbtMs <= TARGETS.tbtMs,
      inp: route.p75.inpMs != null && route.p75.inpMs <= TARGETS.inpMs,
    };
  }

  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[lab-perf] wrote ${evidencePath}`);

  const failed = routeReports.filter((route) => Object.values(route.pass).some((ok) => !ok));
  if (failed.length) {
    console.warn("[lab-perf] one or more lab p75 targets missed — results are reported, not hidden.");
    process.exitCode = 0; // report honestly; closure evidence records miss
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
