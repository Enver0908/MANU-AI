#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertPrivacy,
  countOpenBlocking,
  docsRoot,
  findingsPath,
  verifyFindingsGate,
} from "./lib/stage-7-evidence.mjs";

const selfTest = process.argv.includes("--self-test") || process.argv.includes("--self-test");
const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg ? phaseArg.slice("--phase=".length) : null;

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
  if (lab.status !== "PASS" || lab.summary?.allTargetsMet !== true || lab.bundleBudget?.withinBudget !== true) {
    console.error("[verify:stage-7] FAIL stage_7_4_lab_perf_not_pass");
    process.exit(1);
  }
  if (nvda.status === "BLOCKED" || nvda.status !== "PASS") {
    console.error("[verify:stage-7] FAIL stage_7_4_nvda_not_pass");
    process.exit(1);
  }
  if (lab.kind !== "local_lab_only" || lab.productionStatus !== "NO-GO") {
    console.error("[verify:stage-7] FAIL stage_7_4_perf_claim_invalid");
    process.exit(1);
  }
}

console.log(
  `[verify:stage-7] PASS openBlocking=${countOpenBlocking(findings).length}${phase ? ` phase=${phase}` : ""}`,
);
