import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";
import {
  R405_KNOWN_AUDIT_FINDING_KEYS,
  type Phase80dFormalR405Acceptance,
} from "./phase-80d-r405-closure-evaluation";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import {
  buildPhase82BaselineBlockerReconciliationReport,
  buildPhase82BlockerReconciliationReportFromInputs,
  buildPhase82SkippedRlsBlockerReconciliationReport,
  summarizePhase82BlockerReconciliationReport,
} from "./phase-82c-blocker-reconciliation";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 82c blocker reconciliation", () => {
  it("blocks final readiness when no safe stable patch keeps R-405 open", () => {
    const report = buildPhase82BaselineBlockerReconciliationReport({ now: NOW });

    expect(report.reconciliationStatus).toBe("blocked");
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.r405Status).toBe("open");
    expect(report.patchPath).toBe("no_safe_stable_patch");
    expect(report.dependencyFilesChanged).toBe(false);
    expect(report.r405BlockingReasons).toContain(
      "stable next@latest 16.2.9 still bundles nested postcss@8.4.31",
    );
    expect(report.r406BaselineMitigation).toBe("phase_50_52_local_rls_mitigated");
    expect(report.r406CurrentReRunStatus).toBe("pending");
    expect(report.r406Narrative).toContain("Phase 50/52 baseline");
    expect(report.r406Narrative).toContain("re-run pending");
  });

  it("blocks final readiness when formal R-405 acceptance is incomplete", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const report = buildPhase82BlockerReconciliationReportFromInputs({
      now: NOW,
      r405EvaluationInput: {
        nextLatestVersion: "16.2.9",
        nestedPostcssVersion: "8.4.31",
        eslintConfigNextLatestVersion: "16.2.9",
        productionAuditFindings: [...R405_KNOWN_AUDIT_FINDING_KEYS],
        evidenceRecords: [buildEvidenceRecord(dependencyGate)],
        formalAcceptance: {
          owner: "External security reviewer",
          artifactRef: "external-review://dependency_audit_clearance",
          sanitizedReference: true,
          acceptedFindingKeys: [...R405_KNOWN_AUDIT_FINDING_KEYS],
          approvedAt: "2026-06-01T09:00:00.000Z",
          reviewDueAt: "2026-12-01T09:00:00.000Z",
        },
        dependencyFilesChanged: false,
        technicallyRemediated: false,
        now: NOW,
      },
      r406Evidence: passingRlsEvidence(),
    });

    expect(report.r405Status).toBe("open");
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.r405BlockingReasons).toContain("missing formal R-405 acceptance rationale");
    expect(report.r405BlockingReasons).toContain(
      "missing formal R-405 acceptance compensating controls",
    );
  });

  it("blocks final readiness when unknown production audit findings are present", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const report = buildPhase82BlockerReconciliationReportFromInputs({
      now: NOW,
      r405EvaluationInput: {
        nextLatestVersion: "16.2.9",
        nestedPostcssVersion: "8.4.31",
        eslintConfigNextLatestVersion: "16.2.9",
        productionAuditFindings: [...R405_KNOWN_AUDIT_FINDING_KEYS, "lodash:high"],
        evidenceRecords: [buildEvidenceRecord(dependencyGate)],
        formalAcceptance: buildFormalAcceptance({
          acceptedFindingKeys: [...R405_KNOWN_AUDIT_FINDING_KEYS, "lodash:high"],
        }),
        dependencyFilesChanged: false,
        technicallyRemediated: false,
        now: NOW,
      },
      r406Evidence: passingRlsEvidence(),
    });

    expect(report.r405Status).toBe("open");
    expect(report.unknownProductionAuditFindings).toEqual(["lodash:high"]);
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.r405BlockingReasons).toContain(
      "unknown production audit findings block R-405 closure: lodash:high",
    );
  });

  it("blocks final readiness when current RLS evidence is skipped 20/20", () => {
    const report = buildPhase82SkippedRlsBlockerReconciliationReport({ now: NOW });

    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.r406BlockingReasons).toContain(
      "current RLS evidence skipped 20/20; Phase 50/52 baseline mitigated but current rerun pending",
    );
    expect(report.r406Narrative).toContain("Phase 50/52 baseline");
    expect(report.r406Narrative).toContain("re-run pending");
  });

  it("blocks final readiness when current RLS evidence is pending without local Supabase", () => {
    const report = buildPhase82BaselineBlockerReconciliationReport({ now: NOW });

    expect(report.r406BlockingReasons).toContain(
      "current RLS evidence pending; Phase 50/52 baseline mitigated but current rerun pending",
    );
  });

  it("clears reconciliation only when R-405 is resolved and current RLS passes", () => {
    const report = buildPhase82BlockerReconciliationReportFromInputs({
      now: NOW,
      r405EvaluationInput: {
        nextLatestVersion: "16.3.0",
        nestedPostcssVersion: "8.5.10",
        eslintConfigNextLatestVersion: "16.3.0",
        productionAuditFindings: [],
        dependencyFilesChanged: true,
        technicallyRemediated: true,
        now: NOW,
      },
      r406Evidence: passingRlsEvidence(),
    });

    expect(report.r405Status).toBe("technically_resolved");
    expect(report.r406CurrentRlsStatus).toBe("pass");
    expect(report.reconciliationStatus).toBe("clear");
    expect(report.finalReadinessBlocked).toBe(false);
    expect(report.dependencyFilesChanged).toBe(true);
    expect(report.r406Narrative).toContain("re-run complete");
  });

  it("summarizes aggregate-only metrics without secrets or dependency file contents", () => {
    const report = buildPhase82BaselineBlockerReconciliationReport({ now: NOW });
    const summary = summarizePhase82BlockerReconciliationReport(report);
    const serialized = JSON.stringify(summary);

    expect(summary.finalReadinessBlocked).toBe(true);
    expect(summary.dependencyFilesChanged).toBe(false);
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(serialized).not.toMatch(/\+90\d{10}/);
  });
});

function requireGate(gateId: (typeof PRODUCTION_PILOT_LAUNCH_GATES)[number]["id"]) {
  const gate = PRODUCTION_PILOT_LAUNCH_GATES.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`Missing gate ${gateId}`);
  return gate;
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

function buildFormalAcceptance(
  overrides: Partial<Phase80dFormalR405Acceptance> = {},
): Phase80dFormalR405Acceptance {
  return {
    owner: "External security reviewer",
    rationale: "Known moderate transitive R-405 finding accepted for the pilot window.",
    compensatingControls: ["release audit allowlist is restricted to R-405", "review before pilot expiry"],
    acceptedFindingKeys: [...R405_KNOWN_AUDIT_FINDING_KEYS],
    approvedAt: "2026-06-01T09:00:00.000Z",
    reviewDueAt: "2026-12-01T09:00:00.000Z",
    expiresAt: "2027-06-01T09:00:00.000Z",
    artifactRef: "external-review://dependency_audit_clearance",
    sanitizedReference: true,
    ...overrides,
  };
}

function passingRlsEvidence() {
  return buildPhase79fEvidenceFromRunResult({
    exitCode: 0,
    output: "Tests  20 passed (20)",
    localSupabaseAvailable: true,
    runAttempted: true,
  });
}
