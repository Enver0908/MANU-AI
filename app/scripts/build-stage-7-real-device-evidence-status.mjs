#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildStage5EvidenceHeader, docsRoot } from "./lib/stage-5-evidence.mjs";

const captureDate = process.env.STAGE7_REAL_DEVICE_DATE || new Date().toISOString().slice(0, 10);
const captureRoot = join(docsRoot, "stage-7-real-device", captureDate);
const evidencePath = join(docsRoot, "PHASE_85_STAGE_7_REAL_DEVICE_EVIDENCE_STATUS.json");

const requiredAndroidSteps = [
  "public_contact",
  "login",
  "purchase_valid",
  "install_guidance",
  "dashboard_shell",
  "client_workspace",
  "forms_dirty_or_save",
  "nutrition_or_menu",
  "messaging",
  "alerts_or_notifications",
  "settings_or_more",
  "offline_privacy_lock",
];

const requiredTalkBackSteps = [
  "launch",
  "landmarks",
  "skip_or_primary_navigation",
  "purchase_or_login_form",
  "dashboard_shell",
  "client_workspace",
  "messaging",
  "offline_privacy_lock",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function artifactsFor(prefix) {
  if (!existsSync(captureRoot)) return [];
  return readdirSync(captureRoot)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .map((name) => {
      const relativePath = `stage-7-real-device/${captureDate}/${name}`;
      return {
        path: relativePath,
        sha256: sha256(join(docsRoot, relativePath)),
      };
    });
}

function readJsonArtifact(name) {
  return JSON.parse(readFileSync(join(captureRoot, name), "utf8"));
}

const chromeWalk = readJsonArtifact("android-chrome-cdp-walk.json");
const pwaWalk = readJsonArtifact("android-pwa-cdp-walk.json");
const talkBackWalk = readJsonArtifact("android-talkback-accessibility-walk.json");

const capturedAt = new Date().toISOString();

const evidence = {
  ...buildStage5EvidenceHeader("stage_7_real_device", "npm run test:stage-7-real-device"),
  schemaVersion: "stage7-real-device-v1",
  status: "APPROVED_WITH_WAIVER",
  productionStatus: "NO-GO",
  approvedBy: "Enver0908 authorized physical Android Stage 7.5 validation on connected SM-S721B and retained the iPhone waiver",
  capturedAt,
  instructions:
    "Physical Android Chrome, installed Android PWA, and Android TalkBack evidence were captured on the connected Samsung SM-S721B. Browser emulation is not used. iPhone Safari/PWA remain WAIVED_NOT_EXECUTED and are not PASS.",
  requiredCaptureIds: ["androidChrome", "androidPwa", "androidTalkBack", "iphoneSafari", "iphonePwa"],
  requiredAndroidSteps,
  requiredTalkBackSteps,
  riskAcceptance: {
    decision: "ACCEPTED_STAGE_7_IOS_WAIVER",
    acceptedBy: "Enver0908",
    acceptedAt: capturedAt,
    waivedCaptureIds: ["iphoneSafari", "iphonePwa"],
    rationale:
      "The owner previously directed that iPhone Safari/PWA validation would not be executed for local Stage 7 closure. Android Chrome, installed Android PWA, and Android TalkBack were executed on physical Android.",
    residualRisk:
      "Stage 7 has no physical iPhone Safari or installed iPhone PWA execution evidence. iOS-specific layout, safe-area, browser, standalone-PWA, and assistive-technology regressions may remain undetected.",
    productionStatus: "NO-GO",
    iosPilotRequirement: "REQUIRED_BEFORE_IOS_PILOT",
  },
  deviceCaptures: {
    androidChrome: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      device: {
        platform: "Android",
        model: "SM-S721B",
        serial: "R5CXA15KGXA",
        osVersion: "16 / SDK 36",
        browser: "Chrome on physical Android via ADB reverse tcp:3110 and on-device CDP",
      },
      workflowWalk: chromeWalk.workflow,
      captureMethod:
        "Physical Android device over USB ADB; Chrome DevTools attached to the on-device Chrome target; screenshots and route state captured from the real device browser target.",
      offlinePrivacyLock: {
        protectedContentUnmounted: chromeWalk.offlinePrivacyLock.protectedContentUnmounted,
        noClientNamesVisible: chromeWalk.offlinePrivacyLock.noClientNamesVisible,
        method: "On-device Chrome target offline event observed; shell blocker unmounted authenticated workspace content.",
      },
      artifacts: artifactsFor("android-chrome-"),
    },
    androidPwa: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      device: {
        platform: "Android",
        model: "SM-S721B",
        serial: "R5CXA15KGXA",
        osVersion: "16 / SDK 36",
        browser: "Installed Android WebAPK/PWA via Chrome",
        packageName: "org.chromium.webapk.a68003d917cc7e3ee_v2",
        foregroundActivity: "com.android.chrome/org.chromium.chrome.browser.webapps.SameTaskWebApkActivity",
      },
      workflowWalk: pwaWalk.workflow,
      captureMethod:
        "Physical Android installed WebAPK/PWA launched from its package; foreground activity confirmed as SameTaskWebApkActivity; screenshots captured from the physical device.",
      offlinePrivacyLock: {
        protectedContentUnmounted: pwaWalk.offlinePrivacyLock.protectedContentUnmounted,
        noClientNamesVisible: pwaWalk.offlinePrivacyLock.noClientNamesVisible,
        method: "Installed PWA target offline event observed; shell blocker unmounted authenticated workspace content.",
      },
      artifacts: artifactsFor("android-pwa-"),
    },
    androidTalkBack: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      assistiveTechnology: "TalkBack",
      device: {
        platform: "Android",
        model: "SM-S721B",
        serial: "R5CXA15KGXA",
        osVersion: "16 / SDK 36",
        service: "com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService",
      },
      workflowWalk: talkBackWalk.workflow,
      captureMethod:
        "Samsung TalkBack was enabled on the physical Android device; each critical route produced screencap, uiautomator hierarchy, and accessibility dumpsys artifacts; TalkBack was then disabled and verified.",
      artifacts: artifactsFor("android-talkback-"),
    },
    iphoneSafari: {
      status: "WAIVED_NOT_EXECUTED",
      executionStatus: "NOT_EXECUTED",
      realDevice: false,
      emulator: false,
      workflowWalk: [],
      artifacts: [],
      note: "No Stage 7 iPhone Safari recording or artifact was captured. This is a documented owner risk acceptance, not a test PASS.",
    },
    iphonePwa: {
      status: "WAIVED_NOT_EXECUTED",
      executionStatus: "NOT_EXECUTED",
      realDevice: false,
      emulator: false,
      workflowWalk: [],
      artifacts: [],
      note: "No Stage 7 installed iPhone PWA recording or artifact was captured. This is a documented owner risk acceptance, not a test PASS.",
    },
  },
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ evidencePath, status: evidence.status }, null, 2));
