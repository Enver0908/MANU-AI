import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPhase57ManifestClosure,
  buildPlan2Input,
  determinePlan1Closure,
  phase57PrerequisiteCheck,
  phase57V3EvidencePath,
} from "./performance-plan-1-phase-5-7-plan1-closure.mjs";

const ids = ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003", "PERF-F12-001", "PERF-F12-002"];

function fixture() {
  const dispositions = ids.map((findingId, index) => ({
    findingId,
    disposition: index < 3 ? "INCONCLUSIVE" : "OPEN_BLOCKED",
    affectedJourneys: index < 3 ? ["J2"] : ["ai_chat"],
    affectedEnvironments: index < 3 ? ["local_desktop"] : [],
    exactCauseEvidence: index < 3 ? "NOT_ESTABLISHED" : "UNAVAILABLE",
    measuredEffect: { status: index < 3 ? "INCONCLUSIVE" : "NOT_MEASURED" },
    nextEvidence: "required evidence",
    plan2Eligibility: "NOT_ELIGIBLE",
  }));
  return {
    phase56: {
      runId: "phase56-test",
      status: "COMPLETE",
      outcome: "FINDING_DISPOSITIONS_REVIEWED",
      evidenceIntegrity: { status: "PASS", historicalEvidenceRewritten: false, runtimeFixAccepted: false },
      closure: { plan1Closed: false, plan2EntryAuthorized: false },
      findingDispositions: dispositions,
    },
    manifest: {
      findings: ids.map((id, index) => ({ id, severity: index === 0 ? "high" : "medium", disposition: index < 3 ? "INCONCLUSIVE" : "OPEN_BLOCKED" })),
    },
  };
}

test("requires complete Phase 5.6 evidence and matching manifest dispositions", () => {
  assert.equal(phase57PrerequisiteCheck(fixture()).status, "PASS");
});

test("closes diagnosis as blocked when an open finding remains", () => {
  const closure = determinePlan1Closure(fixture().phase56.findingDispositions);
  assert.equal(closure.outcome, "DIAGNOSIS_BLOCKED");
  assert.equal(closure.plan2EntryAuthorized, false);
  assert.equal(closure.counts.OPEN_BLOCKED, 2);
});

test("prepares all five Plan 2 fields without authorizing a change", () => {
  const input = buildPlan2Input(fixture());
  assert.equal(input.status, "BLOCKED_NO_ELIGIBLE_FINDING");
  assert.deepEqual(input.eligibleFindingIds, []);
  assert.equal(input.entries.length, 5);
  assert.equal(input.entries.every((entry) => entry.proposedLimitedChange === "NONE_AUTHORIZED_UNTIL_CAUSAL_DISPOSITION"), true);
  assert.equal(input.entries.every((entry) => entry.regressionTests.length > 0), true);
  assert.equal(input.entries.every((entry) => entry.rollback.length > 0), true);
});

test("preserves findings when recording closure and rejects unsafe ids", () => {
  const input = fixture();
  const updated = applyPhase57ManifestClosure(input.manifest, {
    runId: "phase57-test",
    evidencePath: "docs/phase57-test.json",
    closedAt: "2026-09-18T00:00:00.000Z",
    closure: { outcome: "DIAGNOSIS_BLOCKED", plan2EntryAuthorized: false },
  });
  assert.equal(updated.findings[0].disposition, "INCONCLUSIVE");
  assert.equal(updated.currentPlan1Closure.outcome, "DIAGNOSIS_BLOCKED");
  assert.equal(updated.currentPlan1Closure.plan2EntryAuthorized, false);
  assert.throws(() => phase57V3EvidencePath("../escape"), /phase57_v3_run_id_invalid/);
});
