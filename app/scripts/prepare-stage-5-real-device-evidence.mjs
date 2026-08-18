#!/usr/bin/env node
/**
 * Prepares the dated real-device evidence folder and a draft status file.
 * It does not approve evidence and it never overwrites an existing capture file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { docsRoot } from "./lib/stage-5-evidence.mjs";

const date = process.env.STAGE5_REAL_DEVICE_DATE || new Date().toISOString().slice(0, 10);
const lanUrl = process.env.STAGE5_REAL_DEVICE_BASE_URL || "http://192.168.1.15:3110";
const captureDir = join(docsRoot, "stage-5-real-device", date);
const templatePath = join(docsRoot, "PHASE_85_STAGE_5_REAL_DEVICE_EVIDENCE_TEMPLATE.json");
const evidencePath = join(docsRoot, "PHASE_85_STAGE_5_REAL_DEVICE_EVIDENCE_STATUS.json");
const readmePath = join(captureDir, "README.md");
const draftPath = join(captureDir, "evidence-status-draft.json");

const replacements = [
  ["YYYY-MM-DD", date],
  ['"capturedAt": "2026-08-04T00:00:00.000Z"', `"capturedAt": "${new Date().toISOString()}"`],
];

function readTemplate() {
  let template = readFileSync(templatePath, "utf8");
  for (const [from, to] of replacements) {
    template = template.split(from).join(to);
  }
  return template;
}

mkdirSync(captureDir, { recursive: true });

if (!existsSync(readmePath)) {
  writeFileSync(
    readmePath,
    `# Stage 5 Real Device Evidence - ${date}

Test URL: ${lanUrl}

Required route walk for each browser/PWA capture:

1. /dashboard
2. /dashboard?section=clients
3. /dashboard?section=messages
4. /dashboard/ai-chat
5. /dashboard/settings

Required capture files expected by the template:

- iphone-safari-route-walk.png
- iphone-pwa-route-walk.png
- android-chrome-route-walk.png
- android-pwa-route-walk.png
- offline-privacy-lock-iphone-pwa.png
- offline-privacy-lock-android-pwa.png

Offline privacy lock screenshots must show protected content unmounted and no client names visible.
Emulators, browser device emulation, and desktop screenshots are not accepted as real-device proof.
`,
    "utf8",
  );
}

if (!existsSync(evidencePath)) {
  writeFileSync(evidencePath, readTemplate(), "utf8");
  console.log(`[stage-5-real-device] draft evidence created: ${evidencePath}`);
} else {
  console.log(`[stage-5-real-device] evidence file already exists, not overwritten: ${evidencePath}`);
}

if (!existsSync(draftPath)) {
  writeFileSync(draftPath, readTemplate(), "utf8");
  console.log(`[stage-5-real-device] dated draft created: ${draftPath}`);
} else {
  console.log(`[stage-5-real-device] dated draft already exists, not overwritten: ${draftPath}`);
}

console.log(`[stage-5-real-device] capture folder ready: ${captureDir}`);
console.log(`[stage-5-real-device] test URL: ${lanUrl}`);
