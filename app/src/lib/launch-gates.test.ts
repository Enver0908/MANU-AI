import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  evaluateProductionPilotLaunchGateEvidence,
  evaluateProductionPilotLaunchGates,
  resolveProductionPilotLaunchGatesForScope,
  type LaunchGateDefinition,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";

describe("production pilot launch gates", () => {
  it("blocks production pilot launch by default", () => {
    const evaluation = evaluateProductionPilotLaunchGates();

    expect(evaluation.blocked).toBe(true);
    expect(evaluation.approvedGateIds).toEqual([]);
    expect(evaluation.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
  });

  it("ignores unknown approval keys", () => {
    const evaluation = evaluateProductionPilotLaunchGates(["legal_privacy_review", "unknown_gate"]);

    expect(evaluation.blocked).toBe(true);
    expect(evaluation.approvedGateIds).toEqual(["legal_privacy_review"]);
    expect(evaluation.ignoredApprovalIds).toEqual(["unknown_gate"]);
    expect(evaluation.openGateIds).not.toContain("legal_privacy_review");
  });

  it("allows production pilot launch only when every known gate is approved", () => {
    const evaluation = evaluateProductionPilotLaunchGates(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));

    expect(evaluation).toEqual({
      blocked: false,
      approvedGateIds: PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id),
      openGateIds: [],
      ignoredApprovalIds: [],
    });
  });

  it("documents required external evidence for every gate", () => {
    expect(PRODUCTION_PILOT_LAUNCH_GATES.every((gate) => gate.sourceOfApproval === "external_review")).toBe(true);
    expect(PRODUCTION_PILOT_LAUNCH_GATES.every((gate) => gate.requiredEvidence.length > 0)).toBe(true);
    expect(
      PRODUCTION_PILOT_LAUNCH_GATES.find((gate) => gate.id === "legal_privacy_review")?.requiredEvidence,
    ).toContain("user-supplied dietitian/client form privacy and prompt-allowlist approval");
    expect(
      PRODUCTION_PILOT_LAUNCH_GATES.find((gate) => gate.id === "clinical_taxonomy_approval")?.requiredEvidence,
    ).toContain("approved official regulation PDF corpus version");
  });

  it("keeps Telegram required in the default historical launch gate scope", () => {
    expect(
      PRODUCTION_PILOT_LAUNCH_GATES.find((gate) => gate.id === "channel_policy_review")?.requiredEvidence,
    ).toContain("Telegram privacy and bot policy review");
    expect(
      resolveProductionPilotLaunchGatesForScope()
        .find((gate) => gate.id === "channel_policy_review")
        ?.requiredEvidence,
    ).toContain("Telegram privacy and bot policy review");
  });

  it("scopes Telegram out of the Turkey-first WhatsApp launch without closing the channel gate", () => {
    const scopedGates = resolveProductionPilotLaunchGatesForScope({
      channels: { whatsapp: true, telegram: false },
    });
    const channelGate = scopedGates.find((gate) => gate.id === "channel_policy_review");

    expect(channelGate?.label).toBe("WhatsApp policy review");
    expect(channelGate?.requiredEvidence).toContain("WhatsApp healthcare feasibility review");
    expect(channelGate?.requiredEvidence).not.toContain("Telegram privacy and bot policy review");

    const evidence = scopedGates.map((gate) => buildEvidenceRecord(gate));
    const evaluation = evaluateProductionPilotLaunchGateEvidence(evidence, {
      now: "2026-06-04T12:00:00.000Z",
      scope: { channels: { whatsapp: true, telegram: false } },
    });

    expect(evaluation.blocked).toBe(false);
    expect(evaluation.approvedGateIds).toEqual(scopedGates.map((gate) => gate.id));
  });

  it("blocks structured launch gate closure by default", () => {
    const evaluation = evaluateProductionPilotLaunchGateEvidence([], { now: "2026-06-04T12:00:00.000Z" });

    expect(evaluation.blocked).toBe(true);
    expect(evaluation.approvedGateIds).toEqual([]);
    expect(evaluation.openGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(evaluation.gateResults[0]?.blockingReasons).toContain("no evidence records supplied");
  });

  it("requires every structured evidence item before a gate closes", () => {
    const legalGate = requireGate("legal_privacy_review");
    const [firstEvidenceItem] = legalGate.requiredEvidence;
    const evaluation = evaluateProductionPilotLaunchGateEvidence(
      [buildEvidenceRecord(legalGate, { coveredEvidence: [firstEvidenceItem] })],
      { now: "2026-06-04T12:00:00.000Z" },
    );
    const legalResult = evaluation.gateResults.find((result) => result.gateId === "legal_privacy_review");

    expect(legalResult?.status).toBe("open");
    expect(legalResult?.coveredEvidence).toEqual([firstEvidenceItem]);
    expect(legalResult?.missingEvidence).toContain(
      "user-supplied dietitian/client form privacy and prompt-allowlist approval",
    );
  });

  it("ignores unknown evidence gate ids", () => {
    const evaluation = evaluateProductionPilotLaunchGateEvidence(
      [
        {
          ...buildEvidenceRecord(requireGate("provider_vendor_review")),
          gateId: "unknown_gate",
        },
      ],
      { now: "2026-06-04T12:00:00.000Z" },
    );

    expect(evaluation.ignoredEvidenceGateIds).toEqual(["unknown_gate"]);
    expect(evaluation.approvedGateIds).toEqual([]);
  });

  it("rejects conditional, stale, unsanitized, or malformed evidence", () => {
    const providerGate = requireGate("provider_vendor_review");
    const evaluation = evaluateProductionPilotLaunchGateEvidence(
      [
        buildEvidenceRecord(providerGate, {
          approvalStatus: "conditional",
          sanitizedReference: false,
          reviewDueAt: "2026-06-03T00:00:00.000Z",
        }),
      ],
      { now: "2026-06-04T12:00:00.000Z" },
    );
    const providerResult = evaluation.gateResults.find((result) => result.gateId === "provider_vendor_review");

    expect(providerResult?.status).toBe("open");
    expect(providerResult?.blockingReasons).toContain("evidence is not approved: conditional");
    expect(providerResult?.blockingReasons).toContain("artifact reference is not marked sanitized");
    expect(providerResult?.blockingReasons).toContain("review due date is expired");
  });

  it("allows production pilot launch only when structured evidence covers every known gate", () => {
    const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildEvidenceRecord(gate));
    const evaluation = evaluateProductionPilotLaunchGateEvidence(evidence, {
      now: "2026-06-04T12:00:00.000Z",
    });

    expect(evaluation.blocked).toBe(false);
    expect(evaluation.approvedGateIds).toEqual(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
    expect(evaluation.openGateIds).toEqual([]);
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
