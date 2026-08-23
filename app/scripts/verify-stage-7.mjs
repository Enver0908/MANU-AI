#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { countOpenBlocking, findingsPath, verifyFindingsGate } from "./lib/stage-7-evidence.mjs";

const selfTest = process.argv.includes("--self-test") || process.argv.includes("--self-test");

if (selfTest) {
  const synthetic = [
    {
      fingerprint: "synthetic-p1",
      severity: "P1",
      status: "open",
    },
  ];
  const result = verifyFindingsGate(synthetic, {});
  if (result.ok) {
    console.error("[verify:stage-7] self-test expected failure for open P1");
    process.exit(1);
  }
  console.log("[verify:stage-7] self-test correctly failed on open P1");
  process.exit(0);
}

const doc = JSON.parse(readFileSync(findingsPath, "utf8"));
const result = verifyFindingsGate(doc.findings ?? [], {
  skipped: process.env.STAGE7_SKIPPED === "1",
  flaky: process.env.STAGE7_FLAKY === "1",
  timedOut: process.env.STAGE7_TIMEOUT === "1",
  blocked: process.env.STAGE7_BLOCKED === "1",
});

if (!result.ok) {
  console.error(`[verify:stage-7] FAIL ${result.blockers.join(", ")} openBlocking=${result.openBlocking}`);
  process.exit(1);
}

console.log(`[verify:stage-7] PASS openBlocking=${countOpenBlocking(doc.findings ?? []).length}`);
