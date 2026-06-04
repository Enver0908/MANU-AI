import { afterEach, describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateDefinition } from "./launch-gates";
import { isRealScopeGuardProviderAllowed } from "./scope-guard-provider";

describe("scope guard provider gate", () => {
  const originalFlag = process.env.MANU_ALLOW_REAL_SCOPE_GUARD;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.MANU_ALLOW_REAL_SCOPE_GUARD;
    } else {
      process.env.MANU_ALLOW_REAL_SCOPE_GUARD = originalFlag;
    }
  });

  it("blocks real provider when clinical taxonomy gate is open", () => {
    expect(isRealScopeGuardProviderAllowed([])).toBe(false);
  });

  it("blocks real provider even when legacy gate ids are approved without env flag", () => {
    expect(
      isRealScopeGuardProviderAllowed([
        "legal_privacy_review",
        "clinical_taxonomy_approval",
        "provider_vendor_review",
        "channel_policy_review",
        "incident_response_runbook",
        "backup_restore_test",
        "secret_rotation_plan",
        "dependency_audit_clearance",
      ]),
    ).toBe(false);
  });

  it("blocks real provider when env flag is set but only legacy gate ids are supplied", () => {
    process.env.MANU_ALLOW_REAL_SCOPE_GUARD = "true";

    expect(
      isRealScopeGuardProviderAllowed([
        "legal_privacy_review",
        "clinical_taxonomy_approval",
        "provider_vendor_review",
        "channel_policy_review",
        "incident_response_runbook",
        "backup_restore_test",
        "secret_rotation_plan",
        "dependency_audit_clearance",
      ]),
    ).toBe(false);
  });

  it("allows real provider only with env flag and structured clinical plus provider evidence", () => {
    process.env.MANU_ALLOW_REAL_SCOPE_GUARD = "true";
    const clinicalGate = requireGate("clinical_taxonomy_approval");
    const providerGate = requireGate("provider_vendor_review");

    expect(
      isRealScopeGuardProviderAllowed({
        now: "2026-06-04T12:00:00.000Z",
        launchGateEvidence: [buildEvidenceRecord(clinicalGate), buildEvidenceRecord(providerGate)],
      }),
    ).toBe(true);
  });
});

function requireGate(gateId: LaunchGateDefinition["id"]) {
  const gate = PRODUCTION_PILOT_LAUNCH_GATES.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`Missing gate ${gateId}`);
  return gate;
}

function buildEvidenceRecord(gate: LaunchGateDefinition) {
  return {
    gateId: gate.id,
    artifactTitle: `${gate.label} approval`,
    artifactRef: `external-review://${gate.id}`,
    owner: "External reviewer",
    approvalStatus: "approved" as const,
    approvedAt: "2026-06-01T09:00:00.000Z",
    reviewDueAt: "2026-12-01T09:00:00.000Z",
    coveredEvidence: gate.requiredEvidence,
    sanitizedReference: true,
  };
}
