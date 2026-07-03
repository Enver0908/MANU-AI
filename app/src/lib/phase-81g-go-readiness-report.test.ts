import { describe, expect, it } from "vitest";
import {
  buildEligiblePhase80ReportForPhase81g,
  buildPhase81gBaselineGoReadinessReport,
  buildPhase81gBaselineRehearsalEvidenceReport,
  buildPhase81gEligibleRehearsalEvidenceReport,
  buildPhase81gEligibleSyntheticGoReadinessReport,
  buildPhase81gGoReadinessReport,
  summarizePhase81gGoReadinessReport,
} from "./phase-81g-go-readiness-report";
import { buildPhase80fBaselineClosureReport } from "./phase-80f-final-readiness-decision";
import {
  buildCompletePhase81cLaunchAuthorizationEvidence,
  buildPhase81cBaselineAuthorizationReport,
  buildPhase81cLaunchAuthorizationReport,
} from "./phase-81c-launch-authorization-evidence";
import {
  buildCompletePhase81dEnvironmentPreflightInput,
  buildPhase81dBaselineEnvironmentPreflightReport,
  buildPhase81dEnvironmentPreflightReport,
} from "./phase-81d-environment-preflight";
import {
  buildCompletePhase81eRosterQualificationAggregate,
  buildPhase81eBaselineRosterQualificationReport,
  buildPhase81eRosterQualificationReport,
} from "./phase-81e-roster-qualification";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81g go readiness report", () => {
  it("records the current baseline as NO_GO_NOT_ELIGIBLE", () => {
    const report = buildPhase81gBaselineGoReadinessReport({ now: NOW });

    expect(report.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
    expect(report.approvedGateIds).toEqual([]);
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.authorizationStatus).toBe("no_authorization_supplied");
    expect(report.environmentPreflightStatus).toBe("blocked");
    expect(report.rosterQualificationStatus).toBe("blocked");
    expect(report.rehearsalStatus).toBe("blocked");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("records eligible synthetic evidence as GO_READY_FOR_EXTERNAL_EXECUTION", () => {
    const report = buildPhase81gEligibleSyntheticGoReadinessReport({ now: NOW });

    expect(report.phase81Outcome).toBe("GO_READY_FOR_EXTERNAL_EXECUTION");
    expect(report.productionPilotGoReady).toBe(true);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
    expect(report.approvedGateIds).toHaveLength(8);
    expect(report.authorizationStatus).toBe("approved");
    expect(report.environmentPreflightStatus).toBe("ready");
    expect(report.rosterQualificationStatus).toBe("qualified");
    expect(report.rehearsalStatus).toBe("ready");
    expect(report.aggregateEvidenceMetrics.clientCount).toBe(5000);
    expect(report.aggregateEvidenceMetrics.dietitianCount).toBe(100);
  });

  it("derives eligibility from phase 80 and rejects an ineligible snapshot even when phase 81 layers are ready", () => {
    const phase80Report = buildPhase80fBaselineClosureReport({ now: NOW });
    const report = buildPhase81gGoReadinessReport({
      phase80Report,
      authorization: buildPhase81cLaunchAuthorizationReport({
        evidence: buildCompletePhase81cLaunchAuthorizationEvidence(),
        now: NOW,
      }),
      preflight: buildPhase81dEnvironmentPreflightReport({
        preflight: buildCompletePhase81dEnvironmentPreflightInput(),
        now: NOW,
      }),
      roster: buildPhase81eRosterQualificationReport({
        aggregate: buildCompletePhase81eRosterQualificationAggregate(),
        now: NOW,
      }),
      rehearsal: buildPhase81gEligibleRehearsalEvidenceReport({ now: NOW }),
      now: NOW,
    });

    expect(report.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.approvedGateIds).toEqual([]);
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
  });

  it("returns NO_GO_PREFLIGHT_FAILED when eligibility is ready but preflight layers fail", () => {
    const phase80Report = buildEligiblePhase80ReportForPhase81g(NOW);

    const report = buildPhase81gGoReadinessReport({
      phase80Report,
      authorization: buildPhase81cBaselineAuthorizationReport({ now: NOW }),
      preflight: buildPhase81dBaselineEnvironmentPreflightReport({ now: NOW }),
      roster: buildPhase81eBaselineRosterQualificationReport({ now: NOW }),
      rehearsal: buildPhase81gBaselineRehearsalEvidenceReport({ now: NOW }),
      now: NOW,
    });

    expect(report.phase81Outcome).toBe("NO_GO_PREFLIGHT_FAILED");
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
  });

  it("never sets productionPilotStarted to true", () => {
    const baseline = buildPhase81gBaselineGoReadinessReport({ now: NOW });
    const eligible = buildPhase81gEligibleSyntheticGoReadinessReport({ now: NOW });

    expect(baseline.productionPilotStarted).toBe(false);
    expect(eligible.productionPilotStarted).toBe(false);
  });

  it("summarizes the final report without leaking secrets", () => {
    const summary = summarizePhase81gGoReadinessReport(
      buildPhase81gBaselineGoReadinessReport({ now: NOW }),
    );

    expect(summary.phase81Outcome).toBe("NO_GO_NOT_ELIGIBLE");
    expect(summary.productionPilotStarted).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password|primaryPhoneE164/,
    );
  });

  it("keeps aggregate evidence metrics aggregate-only", () => {
    const report = buildPhase81gEligibleSyntheticGoReadinessReport({ now: NOW });
    const serialized = JSON.stringify(report.aggregateEvidenceMetrics);

    expect(serialized).not.toMatch(/clientName|message|healthProfile/);
    expect(report.aggregateEvidenceMetrics.coreTestCount).toBe(225);
    expect(report.aggregateEvidenceMetrics.appTestPassedCount).toBe(564);
  });
});
