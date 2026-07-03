import { describe, expect, it } from "vitest";
import {
  PHASE_81C_MINIMUM_CLIENT_COUNT,
  PHASE_81C_MINIMUM_DIETITIAN_COUNT,
} from "./phase-81c-launch-authorization-evidence";
import {
  buildCompletePhase81eRosterQualificationAggregate,
  buildPhase81eBaselineRosterQualificationReport,
  buildPhase81eRosterQualificationReport,
  evaluatePhase81eRosterQualification,
  summarizePhase81eRosterQualificationReport,
} from "./phase-81e-roster-qualification";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81e roster qualification", () => {
  it("blocks the baseline when roster counts are below launch minimums", () => {
    const report = buildPhase81eBaselineRosterQualificationReport({ now: NOW });

    expect(report.qualificationStatus).toBe("blocked");
    expect(report.goReadyBlocked).toBe(true);
    expect(report.aggregateEvidenceOnly).toBe(true);
    expect(report.metrics.dietitianCount).toBe(0);
    expect(report.metrics.clientCount).toBe(0);
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("qualifies a complete sanitized aggregate roster", () => {
    const report = buildPhase81eRosterQualificationReport({
      aggregate: buildCompletePhase81eRosterQualificationAggregate(),
      now: NOW,
    });

    expect(report.qualificationStatus).toBe("qualified");
    expect(report.goReadyBlocked).toBe(false);
    expect(report.metrics.dietitianCount).toBe(PHASE_81C_MINIMUM_DIETITIAN_COUNT);
    expect(report.metrics.clientCount).toBe(PHASE_81C_MINIMUM_CLIENT_COUNT);
    expect(report.metrics.autopilotCandidateCount).toBeLessThan(report.metrics.clientCount);
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
  });

  it("blocks when dietitian count is under 100", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        dietitianCount: 99,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      `dietitian count must be at least ${PHASE_81C_MINIMUM_DIETITIAN_COUNT}`,
    );
  });

  it("blocks when client count is under 5,000", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        clientCount: 4999,
        clientsWithChannelPermissionReady: 4999,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      `client count must be at least ${PHASE_81C_MINIMUM_CLIENT_COUNT}`,
    );
  });

  it("blocks ambiguous identity clients", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        clientsWithAmbiguousIdentity: 3,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "ambiguous identity clients must be excluded from launch roster",
    );
  });

  it("blocks opt-out and removed clients from being counted as autopilot candidates", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        optOutClientCount: 500,
        removedClientCount: 500,
        autopilotCandidateCount: 4500,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "autopilot candidates include excluded client categories",
    );
  });

  it("blocks missing safety fields", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        clientsWithMissingSafetyFields: 12,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "required safety fields must be complete for every client",
    );
  });

  it("blocks overbroad autopilot enablement", () => {
    const evaluation = evaluatePhase81eRosterQualification(
      buildCompletePhase81eRosterQualificationAggregate({
        autopilotCandidateCount: PHASE_81C_MINIMUM_CLIENT_COUNT,
      }),
    );

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "autopilot candidates must be a strict subset of all clients",
    );
  });

  it("keeps roster evidence aggregate-only during serialization", () => {
    const aggregate = {
      ...buildCompletePhase81eRosterQualificationAggregate(),
      clientName: "Should not be stored",
      primaryPhoneE164: "+905551112233",
    } as unknown as ReturnType<typeof buildCompletePhase81eRosterQualificationAggregate>;

    const evaluation = evaluatePhase81eRosterQualification(aggregate);

    expect(evaluation.qualificationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain("forbidden roster evidence field: clientName");
    expect(evaluation.blockingReasons).toContain("forbidden roster evidence field: primaryPhoneE164");
    expect(evaluation.blockingReasons).toContain("raw phone pattern detected in roster evidence");
  });

  it("summarizes roster qualification without leaking raw roster content", () => {
    const summary = summarizePhase81eRosterQualificationReport(
      buildPhase81eBaselineRosterQualificationReport({ now: NOW }),
    );

    expect(summary.aggregateEvidenceOnly).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/clientName|primaryPhoneE164|healthProfile/);
  });
});
