import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PHASE_2_HARNESS_CONTRACT,
  PHASE_2_SCENARIOS,
  runControlledHttpNegativeControls,
  runPhase2NegativeControlMatrix,
  validatePhase2HarnessContract,
} from "./measure-aiya-performance-phase-2.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(appRoot, "..");
const evidencePath = join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json");

test("Plan 1 Phase 2 locks cold and warm measurement modes", () => {
  const contract = validatePhase2HarnessContract();
  assert.equal(contract.status, "PASS");
  assert.deepEqual(contract.failures, []);
  assert.equal(PHASE_2_SCENARIOS.length, 9);
  assert.equal(PHASE_2_SCENARIOS.filter((scenario) => scenario.transitionMode === "cold").length, 1);
  assert.equal(PHASE_2_SCENARIOS.filter((scenario) => scenario.transitionMode === "warm").length, 8);
  assert.equal(PHASE_2_HARNESS_CONTRACT.requiredReadTimeoutMs, 30_000);
  assert.equal(PHASE_2_HARNESS_CONTRACT.postReadyObservationWindowMs, 5_000);
  assert.equal(PHASE_2_HARNESS_CONTRACT.backgroundObservationWindowMs, 60_000);
});

test("Plan 1 Phase 2 classifies every in-process negative control honestly", () => {
  const result = runPhase2NegativeControlMatrix();
  assert.equal(result.status, "PASS");
  assert.equal(result.caseCount, 14);
  assert.deepEqual(result.failures, []);
});

test("Plan 1 Phase 2 separates HTTP headers, body completion, failure, and timeout", async () => {
  const result = await runControlledHttpNegativeControls();
  assert.equal(result.status, "PASS");
  assert.equal(result.caseCount, 8);
  assert.deepEqual(result.failures, []);
  const delayedHeader = result.results.find((item) => item.caseId === "delayed-header");
  const delayedBody = result.results.find((item) => item.caseId === "delayed-body");
  assert.ok(delayedHeader.bodyFinishedMs > delayedHeader.headerReceivedMs);
  assert.ok(delayedBody.bodyFinishedMs > delayedBody.headerReceivedMs);
  assert.equal(result.results.find((item) => item.caseId === "request-failed").failure, "request_failed");
  assert.equal(result.results.find((item) => item.caseId === "timeout").timeout, true);
});

test("Plan 1 Phase 2 evidence closes only the harness stages and preserves exclusions", () => {
  assert.equal(existsSync(evidencePath), true);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "HARNESS_READY_WITH_NEGATIVE_CONTROLS");
  assert.deepEqual(evidence.stageLedger.map((stage) => stage.stageId), ["2.1", "2.2", "2.3", "2.4", "2.5"]);
  assert.deepEqual(evidence.stageLedger.map((stage) => stage.status), ["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(evidence.negativeControlMatrix.caseCount, 14);
  assert.equal(evidence.controlledHttpNegativeControls.caseCount, 8);
  assert.equal(evidence.constraints.runtimeUiApiChange, "NOT_EXECUTED");
  assert.equal(evidence.constraints.localSupabaseFixtureOrReset, "NOT_EXECUTED");
  assert.equal(evidence.constraints.externalSystemMutation, "NOT_EXECUTED");
  assert.equal(evidence.productionDecision, "NO-GO");
});

test("Plan 1 Phase 2 evidence has no raw sensitive payloads and preserves historical hashes", () => {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /secret-token|session-cookie|raw prompt|raw response body/);
  assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  for (const item of evidence.historicalEvidence.files) {
    const actualHash = createHash("sha256").update(readFileSync(join(repoRoot, item.path))).digest("hex");
    assert.equal(actualHash, item.sha256, item.path);
  }
});

test("Plan 1 Phase 2 audit and test commands are exposed", () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["audit:performance:plan1:phase2"], "node scripts/performance-plan-1-phase-2.mjs");
  assert.equal(packageJson.scripts["test:performance-plan1-phase2"], "node --test scripts/performance-plan-1-phase-2.test.mjs");
});
