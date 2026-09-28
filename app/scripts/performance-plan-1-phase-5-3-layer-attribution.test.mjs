import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PHASE_5_3_INPUT_RUN_ID,
  PHASE_5_3_RUN_ID,
  analyzePhase53Layers,
  buildPhase53Evidence,
  phase53PrerequisiteCheck,
  phase53V3EvidencePath,
} from "./performance-plan-1-phase-5-3-layer-attribution.mjs";

const INPUT_PATH = "../../docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-2-single-variable-experiment-v3-20260917T134123969Z-21e8c635-0129-4a48-aca8-45831367a057_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json";

function inputEvidence() {
  return JSON.parse(readFileSync(new URL(INPUT_PATH, import.meta.url), "utf8"));
}

test("requires the complete valid Phase 5.2 experiment", () => {
  const input = inputEvidence();
  const pass = phase53PrerequisiteCheck(input);
  assert.equal(pass.status, "PASS");
  assert.equal(pass.inputEvidence.runId, PHASE_5_3_INPUT_RUN_ID);

  const blocked = phase53PrerequisiteCheck({ ...input, status: "BLOCKED" });
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.failures.includes("phase52_not_complete"));
});

test("keeps attribution analysis-only and preserves all measured layers", () => {
  const analysis = analyzePhase53Layers(inputEvidence());
  assert.equal(analysis.observations.attempted, 9);
  assert.equal(analysis.observations.valid, 9);
  assert.equal(analysis.matchedComparisons.length, 3);
  assert.ok(analysis.layerAssessments.some((item) => item.layerId === "server_store_fanout"));
  assert.ok(analysis.layerAssessments.some((item) => item.layerId === "dns_tls_ttfb"));
  assert.equal(analysis.conclusion.causeConfirmed, false);
  assert.equal(analysis.conclusion.findingDispositionChanged, false);
});

test("records co-moving signals without confirming a layer cause", () => {
  const evidence = buildPhase53Evidence({
    inputEvidence: inputEvidence(),
    generatedAt: "2026-09-17T00:00:00.000Z",
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(evidence.status, "COMPLETE");
  assert.equal(evidence.outcome, "LAYER_ATTRIBUTION_INCONCLUSIVE");
  assert.equal(evidence.attribution.code, "NO_CAUSE_CONFIRMED");
  assert.equal(evidence.attribution.causeConfirmed, false);
  assert.equal(evidence.executionScope.analysisOnly, true);
  assert.equal(evidence.executionScope.newMeasurementStarted, false);
  assert.equal(evidence.executionScope.newCausalExperimentStarted, false);
  assert.ok(evidence.provisionalSignals.some((signal) => signal.status === "PROVISIONAL_COVARIATION"));
});

test("does not treat the input checkpoint as a new Phase 5.3 measurement", () => {
  const evidence = buildPhase53Evidence({
    inputEvidence: inputEvidence(),
    generatedAt: "2026-09-17T00:00:00.000Z",
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(evidence.checkpointReconciliation.source, "phase5-2-input-checkpoint-read-only");
  assert.equal(evidence.checkpointReconciliation.newCheckpointCreated, false);
  assert.equal(evidence.checkpointReconciliation.hashChainRead, true);
  assert.equal(evidence.evidenceIntegrity.inputCheckpointHashChain, true);
});

test("keeps evidence redacted and output paths safe", () => {
  const evidence = buildPhase53Evidence({
    inputEvidence: inputEvidence(),
    generatedAt: "2026-09-17T00:00:00.000Z",
    sourceIdentity: { diffCheck: "PASS", sourceFiles: [] },
  });
  assert.equal(evidence.evidenceIntegrity.status, "PASS");
  assert.equal(evidence.evidenceIntegrity.redactionCheck, "PASS");
  assert.equal(evidence.productionDecision, "NO-GO");
  assert.deepEqual(evidence.findingDispositionChanges, []);
  assert.throws(() => phase53V3EvidencePath("../escape"), /phase53_v3_run_id_invalid/);
  assert.ok(phase53V3EvidencePath(PHASE_5_3_RUN_ID).endsWith("_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json"));
});

