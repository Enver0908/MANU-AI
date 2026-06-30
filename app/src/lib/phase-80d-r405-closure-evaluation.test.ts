import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";
import {
  R405_KNOWN_AUDIT_FINDING_KEYS,
  auditReportsOnlyKnownR405Findings,
  buildPhase80dNoPatchClosureEvaluation,
  buildPhase80dR405ClosureEvaluation,
  evaluateSafeStablePatchPath,
  extractProductionAuditFindingKeys,
  getUnknownProductionAuditFindings,
  isPostcssAtLeast,
  resolvePhase80dR405Status,
  type Phase80dFormalR405Acceptance,
} from "./phase-80d-r405-closure-evaluation";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 80d r405 closure evaluation", () => {
  it("records no safe stable patch when nested postcss remains below 8.5.10", () => {
    const evaluation = buildPhase80dNoPatchClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      now: NOW,
    });

    expect(evaluation.patchPath).toBe("no_safe_stable_patch");
    expect(evaluation.dependencyFilesChanged).toBe(false);
    expect(evaluation.r405Status).toBe("open");
    expect(evaluation.formalAcceptanceArtifactSupplied).toBe(false);
    expect(evaluation.dependencyGateApproved).toBe(false);
    expect(evaluation.productionAuditFindings).toEqual([...R405_KNOWN_AUDIT_FINDING_KEYS]);
    expect(evaluation.blockingReasons).toContain(
      "stable next@latest 16.2.9 still bundles nested postcss@8.4.31",
    );
    expect(evaluation.blockingReasons).toContain(
      "no formal external R-405 risk acceptance artifact supplied",
    );
  });

  it("detects a safe stable patch path when postcss is patched", () => {
    expect(isPostcssAtLeast("8.5.10")).toBe(true);
    expect(
      evaluateSafeStablePatchPath({
        nextLatestVersion: "16.3.0",
        nestedPostcssVersion: "8.5.10",
        eslintConfigNextLatestVersion: "16.3.0",
      }),
    ).toBe("safe_stable_patch_available");
  });

  it("rejects canary next versions as an unsafe pilot baseline", () => {
    expect(
      evaluateSafeStablePatchPath({
        nextLatestVersion: "16.3.0-canary.32",
        nestedPostcssVersion: "8.5.10",
        eslintConfigNextLatestVersion: "16.3.0-canary.32",
      }),
    ).toBe("no_safe_stable_patch");
  });

  it("does not technically resolve R-405 from a remediation flag when stable PostCSS is still vulnerable", () => {
    const evaluation = buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now: NOW,
    });

    expect(evaluation.patchPath).toBe("no_safe_stable_patch");
    expect(evaluation.r405Status).toBe("open");
    expect(evaluation.blockingReasons).toContain(
      "technical remediation cannot be accepted without a safe stable patch path",
    );
  });

  it("marks R-405 technically resolved only with safe stable patch, dependency update, and clean audit", () => {
    const evaluation = buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.3.0",
      nestedPostcssVersion: "8.5.10",
      eslintConfigNextLatestVersion: "16.3.0",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now: NOW,
    });

    expect(evaluation.patchPath).toBe("safe_stable_patch_available");
    expect(evaluation.r405Status).toBe("technically_resolved");
    expect(
      resolvePhase80dR405Status({
        technicalClosureAllowed: true,
        productionAuditFindings: [],
        dependencyGateApproved: false,
        formalAcceptanceArtifactSupplied: false,
      }),
    ).toBe("technically_resolved");
  });

  it("does not close dependency_audit_clearance without complete formal acceptance evidence", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const evaluation = buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      productionAuditFindings: [...R405_KNOWN_AUDIT_FINDING_KEYS],
      evidenceRecords: [
        buildEvidenceRecord(dependencyGate, {
          coveredEvidence: ["production dependency audit report"],
        }),
      ],
      now: NOW,
    });

    expect(evaluation.formalAcceptanceArtifactSupplied).toBe(true);
    expect(evaluation.dependencyGateApproved).toBe(false);
    expect(evaluation.r405Status).toBe("open");
    expect(evaluation.blockingReasons).toContain(
      "dependency_audit_clearance evidence is incomplete or invalid",
    );
  });

  it("does not accept formal R-405 acceptance without rationale and compensating controls", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const evaluation = buildPhase80dR405ClosureEvaluation({
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
      now: NOW,
    });

    expect(evaluation.dependencyGateApproved).toBe(true);
    expect(evaluation.formalAcceptanceValid).toBe(false);
    expect(evaluation.r405Status).toBe("open");
    expect(evaluation.formalAcceptanceBlockingReasons).toContain(
      "missing formal R-405 acceptance rationale",
    );
    expect(evaluation.formalAcceptanceBlockingReasons).toContain(
      "missing formal R-405 acceptance compensating controls",
    );
  });

  it("accepts formal R-405 acceptance only when dependency gate evidence and acceptance details are complete", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const evaluation = buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      productionAuditFindings: [...R405_KNOWN_AUDIT_FINDING_KEYS],
      evidenceRecords: [buildEvidenceRecord(dependencyGate)],
      formalAcceptance: buildFormalAcceptance(),
      now: NOW,
    });

    expect(evaluation.dependencyGateApproved).toBe(true);
    expect(evaluation.formalAcceptanceValid).toBe(true);
    expect(evaluation.r405Status).toBe("formally_accepted");
  });

  it("extracts known R-405 and unknown production audit finding keys from npm audit output", () => {
    const keys = extractProductionAuditFindingKeys({
      vulnerabilities: {
        next: { via: ["postcss"] },
        postcss: {
          via: [
            {
              url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
            },
          ],
        },
        lodash: {
          via: [],
          severity: "high",
        },
      },
    });

    expect(keys).toEqual([...R405_KNOWN_AUDIT_FINDING_KEYS, "lodash:high"]);
    expect(getUnknownProductionAuditFindings(keys)).toEqual(["lodash:high"]);
    expect(auditReportsOnlyKnownR405Findings(keys)).toBe(false);
    expect(auditReportsOnlyKnownR405Findings(["unexpected:finding"])).toBe(false);
  });

  it("keeps formal R-405 acceptance open when unknown production audit findings are present", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const evaluation = buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      productionAuditFindings: [...R405_KNOWN_AUDIT_FINDING_KEYS, "lodash:high"],
      evidenceRecords: [buildEvidenceRecord(dependencyGate)],
      formalAcceptance: buildFormalAcceptance({
        acceptedFindingKeys: [...R405_KNOWN_AUDIT_FINDING_KEYS, "lodash:high"],
      }),
      now: NOW,
    });

    expect(evaluation.r405Status).toBe("open");
    expect(evaluation.unknownProductionAuditFindings).toEqual(["lodash:high"]);
    expect(evaluation.blockingReasons).toContain(
      "unknown production audit findings block R-405 closure: lodash:high",
    );
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
