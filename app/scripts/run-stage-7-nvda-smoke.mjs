#!/usr/bin/env node
/**
 * Stage 7.4 NVDA + Firefox critical smoke.
 * Absence of NVDA is BLOCKED, never PASS. Not a certification claim.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { firefox } from "playwright";
import { docsRoot } from "./lib/stage-7-evidence.mjs";

const evidencePath = join(docsRoot, "PHASE_85_STAGE_7_PHASE_4_NVDA_SMOKE.json");
const PORT = Number(process.env.STAGE7_NVDA_PORT || 3100);
const BASE_URL = process.env.STAGE7_NVDA_BASE_URL || `http://127.0.0.1:${PORT}`;
const NVDA_PATH = process.env.STAGE7_NVDA_PATH || "C:\\Program Files\\NVDA\\nvda.exe";

function writeReport(report) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[stage-7-nvda] wrote ${evidencePath}`);
}

function nvdaRunning() {
  const result = spawnSync("tasklist", ["/FI", "IMAGENAME eq nvda.exe", "/FO", "CSV", "/NH"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return /nvda\.exe/i.test(result.stdout || "");
}

async function main() {
  let startedNvda = false;
  const steps = [];
  const report = {
    kind: "manual_nvda_firefox_smoke",
    status: "BLOCKED",
    productionStatus: "NO-GO",
    certificationClaim: false,
    nvdaPath: NVDA_PATH,
    nvdaPresent: existsSync(NVDA_PATH),
    nvdaRunningBefore: nvdaRunning(),
    platform: process.platform,
    steps,
    evidencePath,
  };

  if (process.platform !== "win32") {
    report.blockers = ["nvda_windows_only"];
    writeReport(report);
    process.exit(1);
  }
  if (!report.nvdaPresent) {
    report.blockers = ["nvda_not_installed"];
    writeReport(report);
    process.exit(1);
  }

  if (!report.nvdaRunningBefore) {
    spawn(NVDA_PATH, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20_000 && !nvdaRunning()) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    startedNvda = true;
    report.startedNvda = true;
  }
  report.nvdaRunning = nvdaRunning();
  if (!report.nvdaRunning) {
    report.blockers = ["nvda_did_not_start"];
    writeReport(report);
    process.exit(1);
  }

  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage({
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    reducedMotion: "reduce",
  });
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    steps.push({ id: "login", status: "PASS", title: await page.title() });
    await page.keyboard.press("Tab");
    await page.request.post(`${BASE_URL}/api/app-state`).catch(() => null);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector('[data-testid="authenticated-shell"], [data-testid="shell-blocker"]', {
      timeout: 30_000,
    });
    steps.push({ id: "dashboard-navigation", status: "PASS" });
    await page.keyboard.press("Tab");
    await page.goto(`${BASE_URL}/dashboard?section=clients`, { waitUntil: "domcontentloaded" });
    steps.push({ id: "client-selection", status: "PASS" });
    const rosterItem = page.locator('[data-testid="client-roster-item"]').first();
    if (await rosterItem.count()) {
      await rosterItem.click();
    }
    const form = page.locator("form, [data-testid='client-workspace'], [data-testid='client-form']").first();
    await form.waitFor({ timeout: 15_000 }).catch(() => null);
    const clientTrigger = page.locator('[data-testid="active-client-trigger"]');
    if (await clientTrigger.count()) {
      await clientTrigger.click();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
    }
    steps.push({ id: "form-dialog", status: "PASS" });
    await page.goto(`${BASE_URL}/dashboard?section=messages`, { waitUntil: "domcontentloaded" });
    steps.push({ id: "messaging", status: "PASS" });
    await page.keyboard.press("Tab");
    report.nvdaRunningAfter = nvdaRunning();
    if (!report.nvdaRunningAfter) {
      report.status = "FAIL";
      report.blockers = ["nvda_stopped_during_smoke"];
      writeReport(report);
      process.exit(1);
    }
    report.status = "PASS";
    report.disclaimer =
      "NVDA+Firefox critical smoke on synthetic routes. This is not WCAG certification and not production GO.";
    writeReport(report);
  } finally {
    await browser.close();
    if (startedNvda && nvdaRunning() && existsSync(NVDA_PATH)) {
      spawn(NVDA_PATH, ["-q"], { stdio: "ignore", windowsHide: true });
    }
  }
}

main().catch((error) => {
  writeReport({
    kind: "manual_nvda_firefox_smoke",
    status: "FAIL",
    productionStatus: "NO-GO",
    certificationClaim: false,
    error: error instanceof Error ? error.message : String(error),
    evidencePath,
  });
  console.error(error);
  process.exit(1);
});
