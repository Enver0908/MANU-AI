#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  appRoot,
  artifactDir,
  assertPrivacy,
  auditEvidencePath,
  auditReportJsonPath,
  auditReportMdPath,
  collectFindingFiles,
  findingsPath,
  matrixPath,
  mergeByFingerprint,
  repoRelative,
  writeJson,
} from "./lib/stage-7-evidence.mjs";

function run(label, command, args, extraEnv = {}) {
  console.log(`\n[audit:stage-7] ${label}`);
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, STAGE7_MODE: "audit", ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}

function npm() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

const PROJECTS = [
  "stage-7-chromium-desktop",
  "stage-7-chromium-desktop-xl",
  "stage-7-chromium-tablet",
  "stage-7-chromium-android",
  "stage-7-chromium-reflow",
  "stage-7-chromium-landscape",
  "stage-7-webkit-iphone",
  "stage-7-webkit-ipad",
  "stage-7-firefox-desktop",
  "stage-7-pwa",
];

run("stage-7 contract tests", npm(), ["run", "test:stage-7"]);

for (const project of PROJECTS) {
  run(
    `stage-7 playwright ${project}`,
    npx(),
    [
      "playwright",
      "test",
      `--project=${project}`,
      "tests/visual/stage-7/stage-7-audit.spec.ts",
    ],
    { STAGE7_PROJECT_NAME: project },
  );
}

const findings = mergeByFingerprint(collectFindingFiles(artifactDir));
const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const finding of findings) {
  bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
}

const findingsDoc = {
  schemaVersion: "phase-85-stage-7-findings-v2",
  generatedAt: "2026-08-22T06:00:00.000Z",
  status: "STAGE_7_1_BASELINE_RECORDED",
  sourceOfAuthority: "docs/PHASE_85_STAGE_7_VISUAL_QA_POLISH_ACCESSIBILITY_CLOSURE_ACTION_PLAN.md",
  clock: "2026-08-22T09:00:00+03:00",
  timezone: "Europe/Istanbul",
  locale: "tr-TR",
  colorScheme: "light",
  reducedMotion: "reduce",
  productionStatus: "NO-GO",
  physicalIphone: "WAIVED_NOT_EXECUTED",
  allowedStatuses: ["open", "in_remediation", "resolved", "accepted_p3", "not_reproducible"],
  allowedSeverities: ["P0", "P1", "P2", "P3"],
  counts: bySeverity,
  findings,
};
writeJson(findingsPath, findingsDoc);

const report = {
  schemaVersion: "phase-85-stage-7-baseline-audit-v1",
  generatedAt: "2026-08-22T06:00:00.000Z",
  status: "RECORDED",
  productionStatus: "NO-GO",
  physicalIphone: "WAIVED_NOT_EXECUTED",
  findingCount: findings.length,
  counts: bySeverity,
  artifactDir: "app/test-results/stage-7",
};
writeJson(auditReportJsonPath, report);

const markdown = `# Phase 85 Stage 7.1 Baseline Audit Report

Status: RECORDED

Production: NO-GO

Physical iPhone: WAIVED_NOT_EXECUTED

Clock: 2026-08-22T09:00:00+03:00 Europe/Istanbul

Findings: ${findings.length} (P0 ${bySeverity.P0}, P1 ${bySeverity.P1}, P2 ${bySeverity.P2}, P3 ${bySeverity.P3})

\`audit:stage-7\` records product findings and fails only on harness, network, fixture, or privacy errors.

No UI remediation is included in this phase.
`;
assertPrivacy(markdown, auditReportMdPath);
writeFileSync(auditReportMdPath, markdown);

const evidence = `# Phase 85 Stage 7.1 Baseline Audit Evidence

Date: 2026-08-22

Status: STAGE_7_1_COMPLETE_BASELINE_RECORDED

Stage 5: STAGE_5_CLOSED

Stage 6: STAGE_6_CLOSED

Physical iPhone: WAIVED_NOT_EXECUTED

Production: NO-GO

## Result

Stage 7.1 installed the deterministic audit harness, expanded the scenario matrix, and recorded the baseline finding inventory. Application UI, CSS, API, and service-worker files were not changed.

## Commands

- \`npm run test:stage-7\`
- \`npm run audit:stage-7\`
- \`npm run verify:stage-7 -- --self-test\`

## Artifacts

- \`${repoRelative(matrixPath)}\`
- \`${repoRelative(findingsPath)}\`
- \`${repoRelative(auditReportJsonPath)}\`
- \`${repoRelative(auditReportMdPath)}\`
`;
assertPrivacy(evidence, auditEvidencePath);
writeFileSync(auditEvidencePath, evidence);

console.log(`[audit:stage-7] recorded ${findings.length} findings`);
