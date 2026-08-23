#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { countOpenBlocking, findingsPath, verifyFindingsGate } from "./lib/stage-7-evidence.mjs";

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

console.log(
  `[verify:stage-7] PASS openBlocking=${countOpenBlocking(findings).length}${phase ? ` phase=${phase}` : ""}`,
);
