import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateEvidenceRecord } from "./launch-gates";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import { buildPhase80dR405ClosureEvaluation } from "./phase-80d-r405-closure-evaluation";
import { buildPhase80fBaselineClosureReport } from "./phase-80f-final-readiness-decision";
import {
  buildEligiblePhase80ReportForPhase81g,
  buildPhase81gBaselineRehearsalEvidenceReport,
  buildPhase81gEligibleSyntheticGoReadinessReport,
  buildPhase81gGoReadinessReport,
} from "./phase-81g-go-readiness-report";
import {
  buildPhase81cBaselineAuthorizationReport,
} from "./phase-81c-launch-authorization-evidence";
import {
  buildPhase81dBaselineEnvironmentPreflightReport,
} from "./phase-81d-environment-preflight";
import {
  buildPhase81eBaselineRosterQualificationReport,
} from "./phase-81e-roster-qualification";
import {
  buildPhase82FinalCompletionReport,
  buildPhase82BaselineFinalCompletionReport,
  buildPhase82EligibleSyntheticFinalCompletionReport,
  buildPhase82VerificationBlockedSyntheticFinalCompletionReport,
  summarizePhase82FinalCompletionReport,
} from "./phase-82d-final-completion-report";
import { buildPhase82ExternalEvidenceGapLedger } from "./phase-82b-external-evidence-gap-ledger";
import { buildPhase82BlockerReconciliationReport } from "./phase-82c-blocker-reconciliation";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 82d final completion report", () => {
  it("records the current baseline as NO_GO_EXTERNAL_PREREQUISITES_OPEN", () => {
    const report = buildPhase82BaselineFinalCompletionReport({ now: NOW });

    expect(report.phase82Outcome).toBe("NO_GO_EXTERNAL_PREREQUISITES_OPEN");
    expect(report.repoLocalClosureComplete).toBe(false);
    expect(report.productionPilotGo).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
    expect(report.approvedGateIds).toEqual([]);
    expect(report.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("records eligible synthetic evidence as READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION", () => {
    const report = buildPhase82EligibleSyntheticFinalCompletionReport({ now: NOW });

    expect(report.phase82Outcome).toBe("READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION");
    expect(report.repoLocalClosureComplete).toBe(true);
    expect(report.productionPilotGo).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
    expect(report.approvedGateIds).toHaveLength(8);
    expect(report.openGateIds).toEqual([]);
    expect(report.phase81Outcome).toBe("GO_READY_FOR_EXTERNAL_EXECUTION");
    expect(report.r405Status).toBe("technically_resolved");
    expect(report.r406CurrentRlsStatus).toBe("pass");
  });

  it("returns NO_GO_VERIFICATION_BLOCKED when external prerequisites pass but phase 81 preflight fails", () => {
    const phase80Report = buildEligiblePhase80ReportForPhase81g(NOW);
    const phase81Report = buildPhase81gGoReadinessReport({
      phase80Report,
      authorization: buildPhase81cBaselineAuthorizationReport({ now: NOW }),
      preflight: buildPhase81dBaselineEnvironmentPreflightReport({ now: NOW }),
      roster: buildPhase81eBaselineRosterQualificationReport({ now: NOW }),
      rehearsal: buildPhase81gBaselineRehearsalEvidenceReport({ now: NOW }),
      now: NOW,
    });
    const report = buildPhase82VerificationBlockedSyntheticFinalCompletionReport({
      phase81Report,
      now: NOW,
    });

    expect(phase81Report.phase81Outcome).toBe("NO_GO_PREFLIGHT_FAILED");
    expect(report.phase82Outcome).toBe("NO_GO_VERIFICATION_BLOCKED");
    expect(report.repoLocalClosureComplete).toBe(false);
    expect(report.productionPilotGo).toBe(false);
    expect(report.openGateIds).toEqual([]);
    expect(report.r405Status).toBe("technically_resolved");
    expect(report.r406CurrentRlsStatus).toBe("pass");
  });

  it("keeps NO_GO_EXTERNAL_PREREQUISITES_OPEN when phase 81 layers are ready but phase 80 remains ineligible", () => {
    const phase80Report = buildPhase80fBaselineClosureReport({ now: NOW });
    const phase81Report = buildPhase81gEligibleSyntheticGoReadinessReport({ now: NOW });
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildLaunchGateEvidenceRecord(gate)),
      now: NOW,
    });
    const blockerReport = buildPhase82BlockerReconciliationReport({
      r405Evaluation: buildPhase80dR405ClosureEvaluation({
        nextLatestVersion: "16.3.0",
        nestedPostcssVersion: "8.5.10",
        eslintConfigNextLatestVersion: "16.3.0",
        productionAuditFindings: [],
        dependencyFilesChanged: true,
        technicallyRemediated: true,
        now: NOW,
      }),
      r406Evidence: buildPhase79fEvidenceFromRunResult({
        exitCode: 0,
        output: "Tests  20 passed (20)",
        localSupabaseAvailable: true,
        runAttempted: true,
      }),
      now: NOW,
    });
    const report = buildPhase82FinalCompletionReport({
      phase80Report,
      phase81Report,
      ledger,
      blockerReport,
      now: NOW,
    });

    expect(phase81Report.phase81Outcome).toBe("GO_READY_FOR_EXTERNAL_EXECUTION");
    expect(report.phase82Outcome).toBe("NO_GO_EXTERNAL_PREREQUISITES_OPEN");
    expect(report.repoLocalClosureComplete).toBe(false);
    expect(report.productionPilotGo).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.phase81Outcome).toBe("GO_READY_FOR_EXTERNAL_EXECUTION");
    expect(report.approvedGateIds).toHaveLength(8);
    expect(report.openGateIds).toEqual([]);
    expect(report.r405Status).toBe("technically_resolved");
    expect(report.r406CurrentRlsStatus).toBe("pass");
    expect(report.blockingReasons).toContain(
      "phase 80 outcome is NO_GO_MISSING_ARTIFACTS, expected PHASE_81_ELIGIBLE",
    );
    expect(report.blockingReasons).toContain("phase 80 does not allow Phase 81 start");
    expect(report.blockingReasons).toContain("phase 80 R-405 status remains open");
    expect(report.blockingReasons).toContain(
      "phase 80 R-406 current RLS status is pending, expected pass",
    );
  });

  it("never sets productionPilotStarted to true", () => {
    const baseline = buildPhase82BaselineFinalCompletionReport({ now: NOW });
    const eligible = buildPhase82EligibleSyntheticFinalCompletionReport({ now: NOW });

    expect(baseline.productionPilotStarted).toBe(false);
    expect(eligible.productionPilotStarted).toBe(false);
    expect(buildPhase81gEligibleSyntheticGoReadinessReport({ now: NOW }).productionPilotStarted).toBe(false);
  });

  it("summarizes the final report without leaking secrets", () => {
    const summary = summarizePhase82FinalCompletionReport(
      buildPhase82BaselineFinalCompletionReport({ now: NOW }),
    );

    expect(summary.phase82Outcome).toBe("NO_GO_EXTERNAL_PREREQUISITES_OPEN");
    expect(summary.productionPilotStarted).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password|primaryPhoneE164/,
    );
  });
});

function buildLaunchGateEvidenceRecord(
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
