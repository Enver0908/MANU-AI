import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateEvidenceRecord } from "./launch-gates";
import {
  buildPhase80fBaselineClosureReport,
  buildPhase80fFinalClosureReport,
  resolvePhase80Outcome,
  summarizePhase80fFinalDecision,
} from "./phase-80f-final-readiness-decision";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import { buildPhase80eCurrentRlsEvidenceReport } from "./phase-80e-current-rls-evidence";
import { buildPhase80dR405ClosureEvaluation } from "./phase-80d-r405-closure-evaluation";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 80f final readiness decision", () => {
  it("records the Phase 80A-80E baseline as NO-GO with missing artifacts", () => {
    const report = buildPhase80fBaselineClosureReport({ now: NOW });

    expect(report.phase80Outcome).toBe("NO_GO_MISSING_ARTIFACTS");
    expect(report.productionPilotDecision).toBe("NO-GO");
    expect(report.productionPilotGo).toBe(false);
    expect(report.phase81StartEligible).toBe(false);
    expect(report.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.blockingReasons).toContain("no external approval artifacts supplied");
    expect(report.blockingReasons).toContain("phase 81 cannot start until Phase 80 records PHASE_81_ELIGIBLE");
  });

  it("never records production GO", () => {
    const report = buildPhase80fBaselineClosureReport({ now: NOW });
    expect(report.productionPilotGo).toBe(false);
    expect(report.productionPilotDecision).not.toBe("GO");
  });

  it("returns PHASE_81_ELIGIBLE only when gates, R-405, and current RLS evidence all pass", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const report = buildPhase80fFinalClosureReport({
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

    expect(report.phase80Outcome).toBe("PHASE_81_ELIGIBLE");
    expect(report.productionPilotDecision).toBe("PHASE_81_ELIGIBLE");
    expect(report.phase81StartEligible).toBe(true);
    expect(report.productionPilotGo).toBe(false);
  });

  it("keeps NO-GO when gates would close but R-405 remains open", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const outcome = resolvePhase80Outcome({
      intakeStatus: "artifacts_supplied",
      openGateIds: [],
      evidenceRecordCount: evidence.length,
      r405Status: "open",
      r406CurrentRlsStatus: "pass",
    });

    expect(outcome).toBe("NO_GO_R405_OPEN");
  });

  it("summarizes the final decision without leaking secrets", () => {
    const summary = summarizePhase80fFinalDecision(buildPhase80fBaselineClosureReport({ now: NOW }));

    expect(summary.phase80Outcome).toBe("NO_GO_MISSING_ARTIFACTS");
    expect(summary.openGateCount).toBe(8);
    expect(summary.approvedGateCount).toBe(0);
    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password/);
  });
});

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
