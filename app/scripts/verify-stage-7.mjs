#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertPrivacy,
  assertPrivacyForTextArtifacts,
  auditReportJsonPath,
  countOpenBlocking,
  docsRoot,
  findingsPath,
  stableArtifactDir,
  verifyFindingsGate,
} from "./lib/stage-7-evidence.mjs";

const selfTest = process.argv.includes("--self-test") || process.argv.includes("--self-test");
const closure = process.argv.includes("--closure");
const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg ? phaseArg.slice("--phase=".length) : null;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runClosureStep(label, args) {
  console.log(`[verify:stage-7:closure] ${label}`);
  const result = spawnSync(npmCommand(), args, {
    cwd: join(docsRoot, "..", "app"),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, STAGE7_CLOSURE_GATE: "1" },
  });
  if (result.status !== 0) {
    console.error(`[verify:stage-7:closure] FAIL ${label} exit=${result.status}`);
    process.exit(result.status ?? 1);
  }
}

if (selfTest) {
  const synthetic = [
    {
      fingerprint: "synthetic-p1",
      severity: "P1",
      status: "open",
      remediationPhase: "7.3",
    },
  ];
  const unfiltered = verifyFindingsGate(synthetic, {});
  if (unfiltered.ok) {
    console.error("[verify:stage-7] self-test expected failure for open P1");
    process.exit(1);
  }
  const phaseFiltered = verifyFindingsGate(
    synthetic.filter((finding) => finding.remediationPhase === "7.2"),
    {},
  );
  if (!phaseFiltered.ok) {
    console.error("[verify:stage-7] self-test expected 7.2 phase filter to pass");
    process.exit(1);
  }
  console.log("[verify:stage-7] self-test correctly failed on open P1 and passed 7.2 phase filter");
  process.exit(0);
}

if (closure) {
  const steps = [
    ["build", ["run", "build"]],
    ["typecheck", ["run", "typecheck"]],
    ["lint", ["run", "lint"]],
    ["audit:stage-7", ["run", "audit:stage-7"]],
    ["test:stage-7-lab-perf", ["run", "test:stage-7-lab-perf"]],
    ["verify:stage-7:7.4", ["run", "verify:stage-7:7.4"]],
  ];
  for (const [label, args] of steps) {
    runClosureStep(label, args);
  }
  console.log("[verify:stage-7:closure] PASS");
  process.exit(0);
}

const doc = JSON.parse(readFileSync(findingsPath, "utf8"));
const findings = (doc.findings ?? []).filter((finding) => !phase || finding.remediationPhase === phase);
const result = verifyFindingsGate(findings, {
  skipped: process.env.STAGE7_SKIPPED === "1",
  flaky: process.env.STAGE7_FLAKY === "1",
  timedOut: process.env.STAGE7_TIMEOUT === "1",
  blocked: process.env.STAGE7_BLOCKED === "1",
});

if (!result.ok) {
  console.error(
    `[verify:stage-7] FAIL ${result.blockers.join(", ")} openBlocking=${result.openBlocking}${phase ? ` phase=${phase}` : ""}`,
  );
  process.exit(1);
}

if (phase === "7.4") {
  const required = [
    "PHASE_85_STAGE_7_PHASE_4_A11Y_BROWSER_PERF_EVIDENCE.md",
    "PHASE_85_STAGE_7_PHASE_4_ACCESSIBILITY_REPORT.json",
    "PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json",
    "PHASE_85_STAGE_7_PHASE_4_NVDA_SMOKE.json",
  ];
  for (const name of required) {
    const path = join(docsRoot, name);
    if (!existsSync(path)) {
      console.error(`[verify:stage-7] FAIL missing_7_4_evidence ${name}`);
      process.exit(1);
    }
    assertPrivacy(readFileSync(path, "utf8"), path);
  }
  const lab = JSON.parse(readFileSync(join(docsRoot, "PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json"), "utf8"));
  const nvda = JSON.parse(readFileSync(join(docsRoot, "PHASE_85_STAGE_7_PHASE_4_NVDA_SMOKE.json"), "utf8"));
  const auditReport = JSON.parse(readFileSync(auditReportJsonPath, "utf8"));
  const allFindings = doc.findings ?? [];
  if (auditReport.findingCount !== allFindings.length) {
    console.error("[verify:stage-7] FAIL stage_7_audit_report_findings_mismatch");
    process.exit(1);
  }
  if ((auditReport.projects ?? []).length !== 10) {
    console.error("[verify:stage-7] FAIL stage_7_project_coverage_incomplete");
    process.exit(1);
  }
  if ((auditReport.projects ?? []).some((project) => project.findingCount !== 0 || project.screenshotCount <= 0)) {
    console.error("[verify:stage-7] FAIL stage_7_project_findings_or_missing_screenshots");
    process.exit(1);
  }
  if (lab.status !== "PASS" || lab.summary?.allTargetsMet !== true || lab.bundleBudget?.withinBudget !== true) {
    console.error("[verify:stage-7] FAIL stage_7_4_lab_perf_not_pass");
    process.exit(1);
  }
  if (
    lab.measurement?.interactionProtocol !== "focus_first_enabled_control_then_trial_click" ||
    (lab.routes ?? []).some((route) => route.sampleCount <= 0 || route.p75?.interactionProxyMs == null)
  ) {
    console.error("[verify:stage-7] FAIL stage_7_4_lab_perf_interaction_protocol_invalid");
    process.exit(1);
  }
  if (typeof lab.sourceRevision !== "string" || lab.sourceRevision.length < 7 || typeof lab.sourceTreeClean !== "boolean") {
    console.error("[verify:stage-7] FAIL stage_7_4_lab_perf_source_freshness_invalid");
    process.exit(1);
  }
  if (nvda.status === "BLOCKED" || nvda.status !== "PASS") {
    console.error("[verify:stage-7] FAIL stage_7_4_nvda_not_pass");
    process.exit(1);
  }
  if (nvda.certificationClaim !== false || nvda.productionStatus !== "NO-GO") {
    console.error("[verify:stage-7] FAIL stage_7_4_nvda_claim_invalid");
    process.exit(1);
  }
  if (lab.kind !== "local_lab_only" || lab.productionStatus !== "NO-GO") {
    console.error("[verify:stage-7] FAIL stage_7_4_perf_claim_invalid");
    process.exit(1);
  }
  const stage7EvidenceFiles = [
    "PHASE_85_STAGE_7_FINDINGS.json",
    "PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.json",
    "PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.md",
    "PHASE_85_STAGE_7R_BASELINE_RUN_EVIDENCE.md",
    "PHASE_85_STAGE_7R_PHASE_4_DASHBOARD_PWA_REMEDIATION_EVIDENCE.md",
    "PHASE_85_STAGE_7_PHASE_4_A11Y_BROWSER_PERF_EVIDENCE.md",
    "PHASE_85_STAGE_7_PHASE_4_ACCESSIBILITY_REPORT.json",
    "PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json",
    "PHASE_85_STAGE_7_PHASE_4_NVDA_SMOKE.json",
  ];
  for (const name of stage7EvidenceFiles) {
    const path = join(docsRoot, name);
    if (existsSync(path)) assertPrivacy(readFileSync(path, "utf8"), path);
  }
  assertPrivacyForTextArtifacts(stableArtifactDir);
}

console.log(
  `[verify:stage-7] PASS openBlocking=${countOpenBlocking(findings).length}${phase ? ` phase=${phase}` : ""}`,
);
