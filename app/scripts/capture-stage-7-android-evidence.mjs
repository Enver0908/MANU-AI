#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { docsRoot } from "./lib/stage-5-evidence.mjs";

const baseUrl = process.env.STAGE7_REAL_DEVICE_BASE_URL || "http://127.0.0.1:3110";
const cdpUrl = process.env.STAGE7_REAL_DEVICE_CDP_URL || "http://127.0.0.1:9222";
const captureDate = process.env.STAGE7_REAL_DEVICE_DATE || new Date().toISOString().slice(0, 10);
const captureRoot = join(docsRoot, "stage-7-real-device", captureDate);
const capturePrefix = process.env.STAGE7_REAL_DEVICE_CAPTURE_PREFIX || "android-chrome";
const adbSerial = process.env.STAGE7_REAL_DEVICE_ADB_SERIAL;

const surfaces = [
  ["public_contact", "/#iletisim", `${capturePrefix}-01-public-contact.png`],
  ["login", "/login", `${capturePrefix}-02-login.png`],
  ["purchase_valid", "/purchase", `${capturePrefix}-03-purchase-valid.png`],
  ["install_guidance", "/app-install", `${capturePrefix}-04-install-guidance.png`],
  ["dashboard_shell", "/dashboard", `${capturePrefix}-05-dashboard-shell.png`],
  ["client_workspace", "/dashboard?section=clients&clientId=client-mert", `${capturePrefix}-06-client-workspace.png`],
  ["forms_dirty_or_save", "/dashboard?section=forms&clientId=client-mert", `${capturePrefix}-07-forms.png`],
  ["nutrition_or_menu", "/dashboard?section=nutrition&clientId=client-mert", `${capturePrefix}-08-nutrition-menu.png`],
  ["messaging", "/dashboard?section=messages&clientId=client-mert", `${capturePrefix}-09-messaging.png`],
  ["alerts_or_notifications", "/dashboard?section=alerts", `${capturePrefix}-10-alerts-notifications.png`],
  ["settings_or_more", "/dashboard/more", `${capturePrefix}-11-settings-more.png`],
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function ensureDemoSession(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.evaluate(async () => {
    await fetch("/api/demo-login", { method: "POST", credentials: "include", redirect: "follow" });
  });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  if ((await page.locator("text=Operasyon paneli").count()) > 0) return;

  await page.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(500);
  const form = page.locator('form[action="/api/demo-login"]');
  if ((await form.count()) === 0) {
    throw new Error("demo_login_form_missing");
  }
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
    form.locator('button, input[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(1_000);
}

async function captureSurface(page, step, path, fileName) {
  const target = `${baseUrl}${path}`;
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const screenshotPath = join(captureRoot, fileName);
  await captureScreenshot(page, screenshotPath, fileName);
  const state = {
    step,
    requestedUrl: target,
    finalUrl: page.url(),
    title: await page.title(),
    viewport: page.viewportSize(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    standalone: await page.evaluate(() => window.matchMedia("(display-mode: standalone)").matches),
    serviceWorkerController: await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)).catch(() => false),
    bodyText: (await page.locator("body").innerText({ timeout: 5_000 })).slice(0, 1_500),
  };
  const statePath = join(captureRoot, fileName.replace(/\.png$/, ".json"));
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return [
    { path: `stage-7-real-device/${captureDate}/${fileName}`, sha256: sha256(screenshotPath) },
    { path: `stage-7-real-device/${captureDate}/${fileName.replace(/\.png$/, ".json")}`, sha256: sha256(statePath) },
  ];
}

async function captureOfflineLock(page) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const before = {
    onLine: await page.evaluate(() => navigator.onLine),
    url: page.url(),
    shellBlocker: await page.locator("text=İnternet bağlantısı gerekli").count().then(Boolean),
  };
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });
  await page.waitForTimeout(1_000);
  const after = {
    onLine: await page.evaluate(() => navigator.onLine),
    url: page.url(),
    shellBlocker: await page.locator("text=İnternet bağlantısı gerekli").count().then(Boolean),
    authenticatedShell: await page.locator('[data-testid="authenticated-shell"]').count().then(Boolean),
    clientWorkspace: await page.locator('[data-testid="client-workspace"]').count().then(Boolean),
    bodyText: (await page.locator("body").innerText({ timeout: 5_000 })).slice(0, 1_500),
  };
  const screenshotPath = join(captureRoot, `${capturePrefix}-12-offline-privacy-lock.png`);
  await captureScreenshot(page, screenshotPath, `${capturePrefix}-12-offline-privacy-lock.png`);
  const statePath = join(captureRoot, `${capturePrefix}-12-offline-privacy-lock.json`);
  writeFileSync(
    statePath,
    `${JSON.stringify(
      {
        before,
        after,
        method: "physical_android_chrome_cdp_offline_event_observed_on_real_device_target",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return {
    protectedContentUnmounted: after.shellBlocker === true && after.authenticatedShell === false && after.clientWorkspace === false,
    noClientNamesVisible: !/Mert|Ayşe|Aylin|Danışan/i.test(after.bodyText),
    artifacts: [
      { path: `stage-7-real-device/${captureDate}/${capturePrefix}-12-offline-privacy-lock.png`, sha256: sha256(screenshotPath) },
      { path: `stage-7-real-device/${captureDate}/${capturePrefix}-12-offline-privacy-lock.json`, sha256: sha256(statePath) },
    ],
  };
}

async function captureScreenshot(page, screenshotPath, fileName) {
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 10_000 });
    return;
  } catch (error) {
    if (!adbSerial) throw error;
    const remotePath = `/sdcard/${fileName}`;
    execFileSync("adb", ["-s", adbSerial, "shell", "screencap", "-p", remotePath], { stdio: "pipe" });
    execFileSync("adb", ["-s", adbSerial, "pull", remotePath, screenshotPath], { stdio: "pipe" });
  }
}

mkdirSync(captureRoot, { recursive: true });
const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());
await ensureDemoSession(page);

const artifacts = [];
const walk = [];
for (const [step, path, fileName] of surfaces) {
  walk.push(step);
  artifacts.push(...(await captureSurface(page, step, path, fileName)));
}
walk.push("offline_privacy_lock");
const offlinePrivacyLock = await captureOfflineLock(page);
artifacts.push(...offlinePrivacyLock.artifacts);

const summaryPath = join(captureRoot, `${capturePrefix}-cdp-walk.json`);
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      workflow: walk,
      baseUrl,
      cdpUrl,
      capturePrefix,
      capturedAt: new Date().toISOString(),
      checks: {
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport: await page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        })),
        standalone: await page.evaluate(() => window.matchMedia("(display-mode: standalone)").matches),
      },
      offlinePrivacyLock,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
artifacts.push({ path: `stage-7-real-device/${captureDate}/${capturePrefix}-cdp-walk.json`, sha256: sha256(summaryPath) });

await browser.close();

console.log(JSON.stringify({ captureRoot, workflow: walk, artifactCount: artifacts.length, artifacts, offlinePrivacyLock }, null, 2));
