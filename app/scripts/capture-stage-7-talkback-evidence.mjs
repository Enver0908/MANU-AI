#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { docsRoot } from "./lib/stage-5-evidence.mjs";

const serial = process.env.STAGE7_REAL_DEVICE_ADB_SERIAL || "R5CXA15KGXA";
const baseUrl = process.env.STAGE7_REAL_DEVICE_BASE_URL || "http://127.0.0.1:3110";
const cdpUrl = process.env.STAGE7_REAL_DEVICE_CDP_URL || "http://127.0.0.1:9222";
const captureDate = process.env.STAGE7_REAL_DEVICE_DATE || new Date().toISOString().slice(0, 10);
const captureRoot = join(docsRoot, "stage-7-real-device", captureDate);

const steps = [
  ["launch", "/dashboard", "android-talkback-01-launch"],
  ["landmarks", "/dashboard", "android-talkback-02-landmarks"],
  ["skip_or_primary_navigation", "/dashboard", "android-talkback-03-navigation"],
  ["purchase_or_login_form", "/purchase", "android-talkback-04-purchase-form"],
  ["dashboard_shell", "/dashboard", "android-talkback-05-dashboard-shell"],
  ["client_workspace", "/dashboard?section=clients&clientId=client-mert", "android-talkback-06-client-workspace"],
  ["messaging", "/dashboard?section=messages&clientId=client-mert", "android-talkback-07-messaging"],
  ["offline_privacy_lock", "/dashboard", "android-talkback-08-offline-privacy-lock"],
];

function adb(args) {
  return execFileSync("adb", ["-s", serial, ...args], { encoding: "utf8" });
}

function adbBinary(args) {
  execFileSync("adb", ["-s", serial, ...args], { stdio: "pipe" });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pull(remote, local) {
  adbBinary(["pull", remote, local]);
}

async function ensureTalkBackEnabled() {
  const enabled = adb(["shell", "settings", "get", "secure", "enabled_accessibility_services"]).trim();
  const accessibility = adb(["shell", "settings", "get", "secure", "accessibility_enabled"]).trim();
  if (!enabled.includes("com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService")) {
    throw new Error(`talkback_service_not_enabled:${enabled}`);
  }
  if (accessibility !== "1") throw new Error(`accessibility_not_enabled:${accessibility}`);
}

async function captureStep(page, step, path, stem) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (step === "offline_privacy_lock") {
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  }
  await page.waitForTimeout(1_200);

  const pngRemote = `/sdcard/${stem}.png`;
  const xmlRemote = `/sdcard/${stem}.xml`;
  const pngLocal = join(captureRoot, `${stem}.png`);
  const xmlLocal = join(captureRoot, `${stem}.uiautomator.xml`);
  const jsonLocal = join(captureRoot, `${stem}.json`);
  const dumpsysLocal = join(captureRoot, `${stem}.accessibility.txt`);

  adbBinary(["shell", "screencap", "-p", pngRemote]);
  pull(pngRemote, pngLocal);
  adbBinary(["shell", "uiautomator", "dump", xmlRemote]);
  pull(xmlRemote, xmlLocal);

  const dumpsys = adb(["shell", "dumpsys", "accessibility"]);
  writeFileSync(dumpsysLocal, dumpsys, "utf8");

  const state = {
    step,
    requestedUrl: `${baseUrl}${path}`,
    finalUrl: page.url(),
    title: await page.title(),
    bodyText: (await page.locator("body").innerText({ timeout: 5_000 })).slice(0, 1_500),
    talkBackEnabledSetting: adb(["shell", "settings", "get", "secure", "enabled_accessibility_services"]).trim(),
    accessibilityEnabledSetting: adb(["shell", "settings", "get", "secure", "accessibility_enabled"]).trim(),
    activeTalkBackServiceBound: dumpsys.includes("Service[label=TalkBack"),
    touchExplorationEnabled: dumpsys.includes("touchExplorationEnabled=true"),
    activeWindowSiriusAI: dumpsys.includes("A11yWindow[AccessibilityWindowInfo[title=SiriusAI"),
    offlineLockVisible:
      step === "offline_privacy_lock" ? (await page.locator("text=İnternet bağlantısı gerekli").count().then(Boolean)) : undefined,
  };
  writeFileSync(jsonLocal, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return [
    { path: `stage-7-real-device/${captureDate}/${stem}.png`, sha256: sha256(pngLocal) },
    { path: `stage-7-real-device/${captureDate}/${stem}.uiautomator.xml`, sha256: sha256(xmlLocal) },
    { path: `stage-7-real-device/${captureDate}/${stem}.json`, sha256: sha256(jsonLocal) },
    { path: `stage-7-real-device/${captureDate}/${stem}.accessibility.txt`, sha256: sha256(dumpsysLocal) },
  ];
}

mkdirSync(captureRoot, { recursive: true });
await ensureTalkBackEnabled();

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

const artifacts = [];
const workflow = [];
for (const [step, path, stem] of steps) {
  workflow.push(step);
  artifacts.push(...(await captureStep(page, step, path, stem)));
}

const summaryPath = join(captureRoot, "android-talkback-accessibility-walk.json");
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      workflow,
      capturedAt: new Date().toISOString(),
      baseUrl,
      cdpUrl,
      serial,
      assistiveTechnology: "TalkBack",
      service: "com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
artifacts.push({
  path: `stage-7-real-device/${captureDate}/android-talkback-accessibility-walk.json`,
  sha256: sha256(summaryPath),
});

await browser.close();
console.log(JSON.stringify({ workflow, artifactCount: artifacts.length, artifacts }, null, 2));
