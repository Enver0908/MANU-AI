#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appRoot,
  artifactDir,
  assertPrivacy,
  auditReportJsonPath,
  auditReportMdPath,
  collectFindingFiles,
  docsRoot,
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

const stableArtifactDir = join(appRoot, ".stage-7r-baseline-artifacts");
const stage7rGeneratedAt = "2026-08-24T09:00:00+03:00";
const stage7rEvidencePath = join(docsRoot, "PHASE_85_STAGE_7R_PHASE_2_TRUSTED_BASELINE_RUN_EVIDENCE.md");
const projectSummaries = [];
const allFindings = [];

rmSync(artifactDir, { recursive: true, force: true });
rmSync(stableArtifactDir, { recursive: true, force: true });
mkdirSync(stableArtifactDir, { recursive: true });

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
  const projectFindings = collectFindingFiles(artifactDir);
  allFindings.push(...projectFindings);
  const projectArtifactDir = join(stableArtifactDir, project);
  mkdirSync(projectArtifactDir, { recursive: true });
  const screenshotNames = existsSync(artifactDir)
    ? readdirSync(artifactDir).filter((name) => name.endsWith(".png"))
    : [];
  for (const name of screenshotNames) {
    copyFileSync(join(artifactDir, name), join(projectArtifactDir, name));
  }
  projectSummaries.push({
    project,
    findingCount: projectFindings.length,
    screenshotCount: screenshotNames.length,
  });
}

const findings = mergeByFingerprint(allFindings);
const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const finding of findings) {
  bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
}

const findingsDoc = {
  schemaVersion: "phase-85-stage-7-findings-v2",
  generatedAt: stage7rGeneratedAt,
  status: "STAGE_7R_2_TRUSTED_BASELINE_RECORDED",
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
  generatedAt: stage7rGeneratedAt,
  status: "STAGE_7R_2_TRUSTED_BASELINE_RECORDED",
  productionStatus: "NO-GO",
  physicalIphone: "WAIVED_NOT_EXECUTED",
  findingCount: findings.length,
  counts: bySeverity,
  artifactDir: "app/test-results/stage-7",
  stableArtifactDir: "app/.stage-7r-baseline-artifacts",
  projects: projectSummaries,
};
writeJson(auditReportJsonPath, report);

const markdown = `# Phase 85 Stage 7R.2 Trusted Baseline Rerun Report

Status: STAGE_7R_2_TRUSTED_BASELINE_RECORDED

Production: NO-GO

Physical iPhone: WAIVED_NOT_EXECUTED

Clock: 2026-08-22T09:00:00+03:00 Europe/Istanbul

Findings: ${findings.length} (P0 ${bySeverity.P0}, P1 ${bySeverity.P1}, P2 ${bySeverity.P2}, P3 ${bySeverity.P3})

\`audit:stage-7\` records product findings and fails on harness, network, fixture, or privacy errors.

No UI remediation is included in this phase.
`;
assertPrivacy(markdown, auditReportMdPath);
writeFileSync(auditReportMdPath, markdown);

const evidence = `# Phase 85 Stage 7R.2 Trusted Baseline Rerun Evidence

Date: 2026-08-24

Status: STAGE_7R_2_TRUSTED_BASELINE_RECORDED_VISUAL_APPROVAL_PENDING

Stage 5: STAGE_5_CLOSED

Stage 6: STAGE_6_CLOSED

Physical iPhone: WAIVED_NOT_EXECUTED

Production: NO-GO

## Result

Stage 7R.2 reran the rebuilt deterministic audit harness across the Stage 7 project matrix and recorded the trusted baseline finding inventory. Application UI, CSS, API, migrations, RLS, and service-worker files were not changed.

## Commands

- \`npm run test:stage-7\`
- \`npm run audit:stage-7\`
- representative visual approval manifest generation

## Artifacts

- \`${repoRelative(matrixPath)}\`
- \`${repoRelative(findingsPath)}\`
- \`${repoRelative(auditReportJsonPath)}\`
- \`${repoRelative(auditReportMdPath)}\`
- \`docs/PHASE_85_STAGE_7R_VISUAL_APPROVAL_MANIFEST.json\`
`;
assertPrivacy(evidence, stage7rEvidencePath);
writeFileSync(stage7rEvidencePath, evidence);

console.log(`[audit:stage-7] recorded ${findings.length} findings`);
