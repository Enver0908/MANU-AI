import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  type LaunchGateDefinition,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";
import {
  buildPhase82BaselineExternalEvidenceGapLedger,
  buildPhase82ExternalEvidenceGapLedger,
  summarizePhase82ExternalEvidenceGapLedger,
} from "./phase-82b-external-evidence-gap-ledger";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 82b external evidence gap ledger", () => {
  it("records baseline with no external artifacts and every gate open", () => {
    const ledger = buildPhase82BaselineExternalEvidenceGapLedger({ now: NOW });

    expect(ledger.intakeStatus).toBe("no_external_artifact_supplied");
    expect(ledger.externalArtifactsSupplied).toBe(false);
    expect(ledger.evidenceRecordCount).toBe(0);
    expect(ledger.allGatesOpen).toBe(true);
    expect(ledger.approvedGateIds).toEqual([]);
    expect(ledger.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(ledger.ignoredEvidenceGateIds).toEqual([]);
    expect(ledger.gateEntries.every((entry) => entry.status === "open")).toBe(true);
    expect(ledger.gateEntries[0]?.blockerCategories).toContain("no_records");
    expect(ledger.gateEntries[0]?.blockerCategories).toContain("missing_evidence");
    expect(ledger.gateEntries[0]?.blockingReasons).toContain("no evidence records supplied");
    expect(ledger.gateEntries[0]?.sanitizedArtifactRefs).toEqual([]);
  });

  it("closes a gate only when approved sanitized evidence covers every required item", () => {
    const providerGate = requireGate("provider_vendor_review");
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: [buildEvidenceRecord(providerGate)],
      now: NOW,
    });

    const providerEntry = ledger.gateEntries.find((entry) => entry.gateId === "provider_vendor_review");
    expect(providerEntry?.status).toBe("approved");
    expect(providerEntry?.missingEvidence).toEqual([]);
    expect(providerEntry?.blockerCategories).toEqual([]);
    expect(providerEntry?.sanitizedArtifactRefs).toEqual([`external-review://${providerGate.id}`]);
    expect(ledger.approvedGateIds).toEqual(["provider_vendor_review"]);
    expect(ledger.allGatesOpen).toBe(false);
  });

  it("closes all gates only with complete synthetic sanitized evidence in fixtures", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: evidence,
      now: NOW,
    });

    expect(ledger.approvedGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(ledger.openGateIds).toEqual([]);
    expect(ledger.allGatesOpen).toBe(false);
    expect(ledger.gateEntries.every((entry) => entry.status === "approved")).toBe(true);
    expect(ledger.externalArtifactsSupplied).toBe(true);
  });

  it("keeps a gate open when evidence coverage is partial", () => {
    const legalGate = requireGate("legal_privacy_review");
    const [firstEvidenceItem] = legalGate.requiredEvidence;
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: [buildEvidenceRecord(legalGate, { coveredEvidence: [firstEvidenceItem] })],
      now: NOW,
    });
    const legalEntry = ledger.gateEntries.find((entry) => entry.gateId === "legal_privacy_review");

    expect(legalEntry?.status).toBe("open");
    expect(legalEntry?.missingEvidence.length).toBeGreaterThan(0);
    expect(legalEntry?.blockerCategories).toContain("missing_evidence");
    expect(ledger.approvedGateIds).toEqual([]);
  });

  it("categorizes conditional, rejected, draft, stale, expired, and unsanitized blockers", () => {
    const providerGate = requireGate("provider_vendor_review");
    const ledger = buildPhase82ExternalEvidenceGapLedger({
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

    expect(ledger.approvedGateIds).toEqual([]);
    expect(ledger.allGatesOpen).toBe(true);
    const providerEntry = ledger.gateEntries.find((entry) => entry.gateId === "provider_vendor_review");
    expect(providerEntry?.blockerCategories).toContain("conditional");
    expect(providerEntry?.blockerCategories).toContain("unsanitized");
    expect(providerEntry?.blockerCategories).toContain("stale");
    expect(providerEntry?.blockerCategories).toContain("expired");
    expect(
      ledger.gateEntries.find((entry) => entry.gateId === "channel_policy_review")?.blockerCategories,
    ).toContain("draft");
    expect(
      ledger.gateEntries.find((entry) => entry.gateId === "incident_response_runbook")?.blockerCategories,
    ).toContain("rejected");
    expect(
      ledger.gateEntries.find((entry) => entry.gateId === "backup_restore_test")?.blockerCategories,
    ).toContain("stale");
  });

  it("ignores unknown gate ids and records them on the ledger", () => {
    const providerGate = requireGate("provider_vendor_review");
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: [
        buildEvidenceRecord(providerGate),
        {
          ...buildEvidenceRecord(requireGate("secret_rotation_plan")),
          gateId: "unknown_gate",
        },
      ],
      now: NOW,
    });

    expect(ledger.ignoredEvidenceGateIds).toEqual(["unknown_gate"]);
    expect(ledger.approvedGateIds).toEqual(["provider_vendor_review"]);
  });

  it("does not close dependency_audit_clearance without complete R-405 clearance evidence", () => {
    const dependencyGate = requireGate("dependency_audit_clearance");
    const ledger = buildPhase82ExternalEvidenceGapLedger({
      evidenceRecords: [
        buildEvidenceRecord(dependencyGate, {
          coveredEvidence: ["production dependency audit report"],
        }),
      ],
      now: NOW,
    });
    const dependencyEntry = ledger.gateEntries.find(
      (entry) => entry.gateId === "dependency_audit_clearance",
    );

    expect(dependencyEntry?.status).toBe("open");
    expect(dependencyEntry?.missingEvidence).toContain("R-405 resolution or formal acceptance");
    expect(dependencyEntry?.blockerCategories).toContain("missing_evidence");
  });

  it("summarizes aggregate-only metrics without raw artifact content", () => {
    const ledger = buildPhase82BaselineExternalEvidenceGapLedger({ now: NOW });
    const summary = summarizePhase82ExternalEvidenceGapLedger(ledger);
    const serialized = JSON.stringify(summary);

    expect(summary.intakeStatus).toBe("no_external_artifact_supplied");
    expect(summary.allGatesOpen).toBe(true);
    expect(summary.gates).toHaveLength(PRODUCTION_PILOT_LAUNCH_GATES.length);
    expect(serialized).not.toMatch(/\+90\d{10}/);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(serialized).not.toContain("artifactRef");
    expect(serialized).not.toContain("health");
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
