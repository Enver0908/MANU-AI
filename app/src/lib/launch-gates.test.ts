import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, evaluateProductionPilotLaunchGates } from "./launch-gates";

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
  });
});
