import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(scriptDir, "..", "..");
const evidence = JSON.parse(readFileSync(join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json"), "utf8"));

const expectedFindingIds = ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003", "PERF-F12-001", "PERF-F12-002"];
const expectedStageIds = ["1.1", "1.2", "1.3", "1.4", "1.5"];
const expectedSelectors = [
  "[data-testid=\"authenticated-shell\"]",
  "[data-testid=\"client-roster\"]",
  "[data-testid=\"client-form-panel\"]",
  "[data-testid=\"active-nutrition-plan-panel\"]",
  "[data-testid=\"menu-workflow-panel\"]",
  "[data-testid=\"messaging-panel\"]",
  "[data-testid=\"alerts-panel\"]",
  "[data-testid=\"notifications-panel\"]",
  "[data-testid=\"ai-chat-workspace\"]",
];

test("Plan 1 Phase 1 is closed only with the complete ordered stage ledger", () => {
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "NO_RUNTIME_CAUSE_CONFIRMED");
  assert.deepEqual(evidence.stageLedger.map((stage) => stage.stageId), expectedStageIds);
  assert.deepEqual(evidence.stageLedger.map((stage) => stage.status), ["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(evidence.finalControls.phaseClosureGate, "PASS");
  assert.equal(evidence.productionDecision, "NO-GO");
});

test("Plan 1 Phase 1 locks the five findings and nine task-specific selectors", () => {
  assert.deepEqual(manifest.findings.map((finding) => finding.id), expectedFindingIds);
  assert.equal(manifest.findings.length, 5);
  assert.deepEqual(evidence.findingManifest.findingIds, expectedFindingIds);
  assert.deepEqual(evidence.scenarioContract.requiredReadySelectors, expectedSelectors);
  assert.equal(evidence.scenarioContract.scenarioCount, 9);
  assert.equal(evidence.scenarioContract.sampleCountPerScenario, 20);
});

test("Plan 1 Phase 1 keeps historical evidence and runtime changes protected", () => {
  assert.equal(evidence.historicalEvidence.unchangedAtPhaseStart, true);
  assert.equal(evidence.findingManifest.runtimeCausesConfirmed, 0);
  assert.equal(evidence.findingManifest.runtimeChangesAuthorized, false);
  assert.equal(evidence.constraints.runtimeUiApiChange, "NOT_EXECUTED");
  assert.equal(evidence.constraints.schemaMigration, "NOT_EXECUTED");
  assert.equal(evidence.constraints.externalSystemMutation, "NOT_EXECUTED");
  assert.equal(evidence.constraints.productionGateChange, "NOT_EXECUTED");
});

test("Plan 1 Phase 1 records zero skipped or failed final controls", () => {
  assert.equal(evidence.finalControls.fullRepoTest.status, "PASS");
  assert.equal(evidence.finalControls.fullRepoTest.testFiles, 288);
  assert.equal(evidence.finalControls.fullRepoTest.passed, 1726);
  assert.equal(evidence.finalControls.fullRepoTest.failed, 0);
  assert.equal(evidence.finalControls.fullRepoTest.skipped, 0);
  assert.equal(evidence.finalControls.enabledPreviouslySkippedSuites.status, "PASS");
  assert.equal(evidence.finalControls.enabledPreviouslySkippedSuites.passed, 53);
  assert.equal(evidence.finalControls.enabledPreviouslySkippedSuites.failed, 0);
  assert.equal(evidence.finalControls.enabledPreviouslySkippedSuites.skipped, 0);
});

test("Plan 1 Phase 1 historical evidence hashes still match the files on disk", () => {
  for (const item of evidence.historicalEvidence.files) {
    const actualHash = createHash("sha256")
      .update(readFileSync(join(repoRoot, item.path), "utf8"))
      .digest("hex");
    assert.equal(actualHash, item.sha256, item.path);
  }
});

test("Plan 1 Phase 1 evidence contains no raw secret, token, cookie, prompt, or clinical payload", () => {
  const serialized = `${JSON.stringify(evidence)}\n${JSON.stringify(manifest)}`;
  assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(serialized, /sb-access-token|refresh_token=|service_role_key\s*:/i);
  assert.equal(evidence.constraints.rawPayloadTraceHarCookieTokenPromptClinicalCapture, "NOT_RECORDED");
});

test("Plan 1 Phase 1 separates local, upstream, and live identities", () => {
  assert.equal(evidence.identitySeparation.localHead, evidence.identitySeparation.upstreamHead);
  assert.notEqual(evidence.identitySeparation.localHead, evidence.identitySeparation.liveCommit);
  assert.equal(evidence.identitySeparation.liveHeadDrift, true);
});
