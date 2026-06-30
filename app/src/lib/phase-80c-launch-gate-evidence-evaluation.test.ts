import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  type LaunchGateDefinition,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";
import {
  buildPhase80cLaunchGateEvidenceEvaluationReport,
  buildPhase80cNoArtifactSuppliedReport,
  resolvePhase80ProductionPilotDecision,
} from "./phase-80c-launch-gate-evidence-evaluation";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 80c launch gate evidence evaluation", () => {
  it("records no-artifact intake with every gate open and NO-GO decision", () => {
    const report = buildPhase80cNoArtifactSuppliedReport({
      now: NOW,
      localSupabaseAvailable: false,
    });

    expect(report.intakeStatus).toBe("no_external_artifact_supplied");
    expect(report.evidenceRecordCount).toBe(0);
    expect(report.approvedGateIds).toEqual([]);
    expect(report.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(report.r405Status).toBe("open");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.productionPilotDecision).toBe("NO-GO");
    expect(report.gateResults.every((result) => result.status === "open")).toBe(true);
    expect(report.gateResults[0]?.blockingReasons).toContain("no evidence records supplied");
  });

  it("closes a gate only when approved sanitized evidence covers every required item", () => {
    const providerGate = requireGate("provider_vendor_review");
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: [buildEvidenceRecord(providerGate)],
      now: NOW,
      r405Status: "open",
      r406Evidence: pendingRlsEvidence(),
    });

    const providerResult = report.gateResults.find((result) => result.gateId === "provider_vendor_review");
    expect(providerResult?.status).toBe("approved");
    expect(report.approvedGateIds).toEqual(["provider_vendor_review"]);
    expect(report.productionPilotDecision).toBe("NO-GO");
  });

  it("keeps a gate open when evidence coverage is partial", () => {
    const legalGate = requireGate("legal_privacy_review");
    const [firstEvidenceItem] = legalGate.requiredEvidence;
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: [buildEvidenceRecord(legalGate, { coveredEvidence: [firstEvidenceItem] })],
      now: NOW,
    });
    const legalResult = report.gateResults.find((result) => result.gateId === "legal_privacy_review");

    expect(legalResult?.status).toBe("open");
    expect(legalResult?.missingEvidence.length).toBeGreaterThan(0);
    expect(report.approvedGateIds).toEqual([]);
  });

  it("keeps gates open for conditional, rejected, draft, stale, expired, or unsanitized evidence", () => {
    const providerGate = requireGate("provider_vendor_review");
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: [
        buildEvidenceRecord(providerGate, {
          approvalStatus: "conditional",
          sanitizedReference: false,
          reviewDueAt: "2026-06-29T00:00:00.000Z",
          expiresAt: "2026-06-29T23:59:59.000Z",
        }),
        buildEvidenceRecord(requireGate("channel_policy_review"), {
          approvalStatus: "draft",
        }),
        buildEvidenceRecord(requireGate("incident_response_runbook"), {
          approvalStatus: "rejected",
        }),
        buildEvidenceRecord(requireGate("backup_restore_test"), {
          approvedAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
      now: NOW,
    });

    expect(report.approvedGateIds).toEqual([]);
    expect(report.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    const providerResult = report.gateResults.find((result) => result.gateId === "provider_vendor_review");
    expect(providerResult?.blockingReasons).toContain("evidence is not approved: conditional");
    expect(providerResult?.blockingReasons).toContain("artifact reference is not marked sanitized");
    expect(providerResult?.blockingReasons).toContain("review due date is expired");
    expect(providerResult?.blockingReasons).toContain("approval artifact is expired");
  });

  it("ignores unknown evidence items and unknown gate ids", () => {
    const providerGate = requireGate("provider_vendor_review");
    const legalGate = requireGate("legal_privacy_review");
    const [firstEvidenceItem] = legalGate.requiredEvidence;
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: [
        buildEvidenceRecord(providerGate, {
          coveredEvidence: [...providerGate.requiredEvidence, "unknown evidence item"],
        }),
        buildEvidenceRecord(legalGate, {
          coveredEvidence: [firstEvidenceItem, "unknown evidence item"],
        }),
        {
          ...buildEvidenceRecord(requireGate("secret_rotation_plan")),
          gateId: "unknown_gate",
        },
      ],
      now: NOW,
    });

    expect(report.ignoredEvidenceGateIds).toEqual(["unknown_gate"]);
    expect(report.approvedGateIds).toEqual(["provider_vendor_review"]);
    expect(
      report.gateResults.find((result) => result.gateId === "legal_privacy_review")?.blockingReasons,
    ).toContain("unknown evidence item ignored: unknown evidence item");
  });

  it("does not close dependency_audit_clearance without complete R-405 clearance evidence", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: [
        buildEvidenceRecord(dependencyGate, {
          coveredEvidence: ["production dependency audit report"],
        }),
      ],
      now: NOW,
      r405Status: "open",
    });
    const dependencyResult = report.gateResults.find(
      (result) => result.gateId === "dependency_audit_clearance",
    );

    expect(dependencyResult?.status).toBe("open");
    expect(dependencyResult?.missingEvidence).toContain("R-405 resolution or formal acceptance");
    expect(report.productionPilotDecision).toBe("NO-GO");
  });

  it("returns PHASE_81_ELIGIBLE only when every gate closes, R-405 is resolved, and current RLS passes", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: evidence,
      now: NOW,
      r405Status: "technically_resolved",
      r406Evidence: {
        ...pendingRlsEvidence(),
        status: "pass",
        r406CurrentReRunStatus: "pass",
      },
    });

    expect(report.approvedGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(report.openGateIds).toEqual([]);
    expect(report.productionPilotDecision).toBe("PHASE_81_ELIGIBLE");
  });

  it("keeps NO-GO when gates close but R-405 remains open", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const report = buildPhase80cLaunchGateEvidenceEvaluationReport({
      evidenceRecords: evidence,
      now: NOW,
      r405Status: "open",
      r406Evidence: {
        ...pendingRlsEvidence(),
        status: "pass",
        r406CurrentReRunStatus: "pass",
      },
    });

    expect(report.openGateIds).toEqual([]);
    expect(report.productionPilotDecision).toBe("NO-GO");
  });

  it("never returns GO as a production pilot decision", () => {
    const decision = resolvePhase80ProductionPilotDecision({
      openGateIds: [],
      r405Status: "technically_resolved",
      r406CurrentRlsStatus: "pass",
    });

    expect(decision).toBe("PHASE_81_ELIGIBLE");
    expect(decision).not.toBe("GO");
  });
});

function requireGate(gateId: LaunchGateDefinition["id"]) {
  const gate = PRODUCTION_PILOT_LAUNCH_GATES.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`Missing gate ${gateId}`);
  return gate;
}

function buildEvidenceRecord(
  gate: LaunchGateDefinition,
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

function pendingRlsEvidence() {
  return {
    version: "phase-79f-current-rls-evidence-v0.1.0",
    status: "pending" as const,
    localSupabaseAvailable: false,
    runAttempted: false,
    integrationTestFile: "supabase-rls.integration.test.ts" as const,
    requiredScopeCount: 6,
    coveredScopeCount: 6,
    uncoveredScopeIds: [],
    testsPassed: null,
    testsFailed: null,
    testsSkipped: null,
    r406BaselineMitigation: "phase_50_52_local_rls_mitigated" as const,
    r406CurrentReRunStatus: "pending" as const,
    r406Narrative:
      "Phase 50/52 baseline local RLS mitigation remains valid; current migration/RLS re-run pending because local Supabase is unavailable.",
    aggregateEvidenceOnly: true,
    failures: ["local_supabase_unavailable", "current_migration_rls_re_run_pending"],
  };
}
