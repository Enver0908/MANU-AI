import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateEvidenceRecord } from "./launch-gates";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import { buildPhase80dR405ClosureEvaluation } from "./phase-80d-r405-closure-evaluation";
import { buildPhase80eCurrentRlsEvidenceReport } from "./phase-80e-current-rls-evidence";
import {
  buildPhase80fBaselineClosureReport,
  buildPhase80fFinalClosureReport,
} from "./phase-80f-final-readiness-decision";
import {
  buildPhase81bBaselineEligibilityReport,
  buildPhase81bEligibilityReport,
  evaluatePhase81bEligibilityFromPhase80,
  summarizePhase81bEligibilityReport,
} from "./phase-81b-phase-80-eligibility";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81b phase 80 eligibility import", () => {
  it("blocks the current repo baseline with NO_GO_NOT_ELIGIBLE", () => {
    const report = buildPhase81bBaselineEligibilityReport({ now: NOW });

    expect(report.eligibilityStatus).toBe("blocked_not_eligible");
    expect(report.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.phase80Outcome).toBe("NO_GO_MISSING_ARTIFACTS");
    expect(report.phase81StartEligible).toBe(false);
    expect(report.openGateCount).toBe(8);
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("allows a fully eligible synthetic Phase 80 report to enter later preflight phases", () => {
    const phase80Report = buildEligiblePhase80Report();
    const report = buildPhase81bEligibilityReport({ phase80Report, now: NOW });

    expect(report.eligibilityStatus).toBe("eligible_for_preflight");
    expect(report.phase81Outcome).toBeNull();
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.phase80Outcome).toBe("PHASE_81_ELIGIBLE");
    expect(report.phase81StartEligible).toBe(true);
    expect(report.openGateCount).toBe(0);
    expect(report.approvedGateCount).toBe(8);
    expect(report.r405Status).toBe("technically_resolved");
    expect(report.r406CurrentRlsStatus).toBe("pass");
    expect(report.blockingReasons).toEqual([]);
  });

  it("blocks when open launch gates remain", () => {
    const phase80Report = buildEligiblePhase80Report();
    phase80Report.openGateIds = ["legal_privacy_review"];
    phase80Report.phase80Outcome = "NO_GO_INCOMPLETE_OR_REJECTED_EVIDENCE";
    phase80Report.productionPilotDecision = "NO-GO";
    phase80Report.phase81StartEligible = false;

    const evaluation = evaluatePhase81bEligibilityFromPhase80(phase80Report);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "open launch gates remain: legal_privacy_review",
    );
  });

  it("blocks when R-405 remains open", () => {
    const phase80Report = buildEligiblePhase80Report();
    phase80Report.r405Status = "open";
    phase80Report.phase80Outcome = "NO_GO_R405_OPEN";
    phase80Report.productionPilotDecision = "NO-GO";
    phase80Report.phase81StartEligible = false;

    const evaluation = evaluatePhase81bEligibilityFromPhase80(phase80Report);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "R-405 status is open, expected technically_resolved or formally_accepted",
    );
  });

  it("blocks when current RLS evidence is pending or skipped", () => {
    const phase80Report = buildEligiblePhase80Report();
    phase80Report.r406CurrentRlsStatus = "pending";
    phase80Report.phase80Outcome = "NO_GO_RLS_CURRENT_RERUN_PENDING";
    phase80Report.productionPilotDecision = "NO-GO";
    phase80Report.phase81StartEligible = false;

    const evaluation = evaluatePhase81bEligibilityFromPhase80(phase80Report);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "current RLS status is pending, expected pass",
    );
  });

  it("never records production GO or started state", () => {
    const blocked = buildPhase81bBaselineEligibilityReport({ now: NOW });
    const eligible = buildPhase81bEligibilityReport({
      phase80Report: buildEligiblePhase80Report(),
      now: NOW,
    });

    for (const report of [blocked, eligible]) {
      expect(report.productionPilotGoReady).toBe(false);
      expect(report.productionPilotStarted).toBe(false);
      expect(report.productionPilotGo).toBe(false);
    }
  });

  it("summarizes eligibility without leaking secrets", () => {
    const summary = summarizePhase81bEligibilityReport(
      buildPhase81bBaselineEligibilityReport({ now: NOW }),
    );

    expect(summary.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(summary.productionPilotStarted).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password/);
  });

  it("imports the current baseline Phase 80 report shape directly", () => {
    const phase80Report = buildPhase80fBaselineClosureReport({ now: NOW });
    const report = buildPhase81bEligibilityReport({ phase80Report, now: NOW });

    expect(report.phase80Outcome).toBe(phase80Report.phase80Outcome);
    expect(report.productionPilotDecision).toBe(phase80Report.productionPilotDecision);
    expect(report.phase81StartEligible).toBe(phase80Report.phase81StartEligible);
    expect(report.eligibilityStatus).toBe("blocked_not_eligible");
  });
});

function buildEligiblePhase80Report() {
  const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
  return buildPhase80fFinalClosureReport({
    evidenceRecords: evidence,
    now: NOW,
    r405Evaluation: buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.3.0",
      nestedPostcssVersion: "8.5.10",
      eslintConfigNextLatestVersion: "16.3.0",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now: NOW,
    }),
    rlsEvidenceReport: buildPhase80eCurrentRlsEvidenceReport({
      evidence: buildPhase79fEvidenceFromRunResult({
        exitCode: 0,
        output: "Tests  20 passed (20)",
        localSupabaseAvailable: true,
        runAttempted: true,
      }),
      generatedAt: NOW,
      runAttempted: true,
    }),
  });
}

function buildEvidenceRecord(
  gate: (typeof PRODUCTION_PILOT_LAUNCH_GATES)[number],
  overrides: Partial<LaunchGateEvidenceRecord> = {},
): LaunchGateEvidenceRecord {
  return {
    gateId: gate.id,
    artifactTitle: `${gate.label} approval`,
    artifactRef: `external-review://${gate.id}`,
    owner: "External reviewer",
    approvalStatus: "approved",
    approvedAt: "2026-06-01T09:00:00.000Z",
    reviewDueAt: "2026-12-01T09:00:00.000Z",
    expiresAt: "2027-06-01T09:00:00.000Z",
    coveredEvidence: gate.requiredEvidence,
    sanitizedReference: true,
    ...overrides,
  };
}
