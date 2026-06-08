import { describe, expect, it } from "vitest";
import {
  PHASE_73_DECISION_PRIORITY_ORDER,
  PHASE_73_GOLDEN_CASES,
  PHASE_73_HEALTH_REGULATION_DECISION_MATRIX,
  PHASE_73_OFFICIAL_SOURCES,
  buildPhase73CalibrationLaunchGateEvidence,
  evaluatePhase73AcceptanceMetrics,
  evaluatePhase73CalibrationDecision,
  evaluatePhase73CalibrationReadiness,
  evaluatePhase73GoldenCase,
  evaluatePhase73GreenCapacityMetrics,
  isPhase73ActiveProductionCalibrationAllowed,
} from "./phase-73-health-regulation-calibration";

describe("phase 73 health regulation calibration", () => {
  it("captures the supplied 14-source decision matrix with draft approval status", () => {
    const readiness = evaluatePhase73CalibrationReadiness();

    expect(readiness.status).toBe("pass");
    expect(PHASE_73_OFFICIAL_SOURCES).toHaveLength(14);
    expect(PHASE_73_HEALTH_REGULATION_DECISION_MATRIX.length).toBeGreaterThanOrEqual(37);
    expect(PHASE_73_DECISION_PRIORITY_ORDER[0]).toBe("forbidden_action");
    expect(PHASE_73_HEALTH_REGULATION_DECISION_MATRIX.every((entry) => entry.approvalStatus === "draft")).toBe(true);
  });

  it("allows autopilot auto-send only for source-backed green plan lookup", () => {
    const evaluation = evaluatePhase73CalibrationDecision({
      decisionAreaId: "active_plan_lookup",
      clientAiMode: "autopilot",
      clientAiActive: true,
      safetyChecklistComplete: true,
      channelPermissionReady: true,
      sourceStatus: "present",
    });

    expect(evaluation.resolvedAction).toBe("auto_send_candidate");
    expect(evaluation.clientFacingAiSendAllowed).toBe(true);
  });

  it("drafts green plan lookup in copilot mode", () => {
    const evaluation = evaluatePhase73CalibrationDecision({
      decisionAreaId: "active_plan_lookup",
      clientAiMode: "copilot",
      clientAiActive: true,
      safetyChecklistComplete: true,
      channelPermissionReady: true,
      sourceStatus: "present",
    });

    expect(evaluation.resolvedAction).toBe("draft_for_dietitian");
    expect(evaluation.clientFacingAiSendAllowed).toBe(false);
  });

  it("escalates insulin dose and acute glucose to handoff with no client-facing send", () => {
    const insulin = evaluatePhase73CalibrationDecision({
      decisionAreaId: "insulin_medication_dose",
      clientAiMode: "autopilot",
      clientAiActive: true,
      safetyChecklistComplete: true,
      channelPermissionReady: true,
      sourceStatus: "not_applicable",
    });
    const glucose = evaluatePhase73CalibrationDecision({
      decisionAreaId: "diabetes_glucose_numeric",
      clientAiMode: "autopilot",
      clientAiActive: true,
      safetyChecklistComplete: true,
      channelPermissionReady: true,
      sourceStatus: "not_applicable",
      acuteRisk: true,
    });

    expect(insulin.resolvedAction).toBe("internal_handoff");
    expect(glucose.resolvedAction).toBe("internal_handoff");
    expect(insulin.providerAttemptAllowed).toBe(false);
    expect(glucose.clientFacingAiSendAllowed).toBe(false);
  });

  it("quarantines group messages and blocks active production calibration without approval", () => {
    const evaluation = evaluatePhase73CalibrationDecision({
      decisionAreaId: "group_message",
      clientAiMode: "autopilot",
      clientAiActive: true,
      safetyChecklistComplete: true,
      channelPermissionReady: true,
      sourceStatus: "not_applicable",
    });

    expect(evaluation.resolvedAction).toBe("quarantine");
    expect(isPhase73ActiveProductionCalibrationAllowed()).toBe(false);
  });

  it("passes the bundled golden suite and acceptance metrics", () => {
    const metrics = evaluatePhase73AcceptanceMetrics();

    expect(metrics.status).toBe("pass");
    expect(metrics.unsafeGreenRate).toBe(0);
    expect(metrics.yellowRedClientFacingAiSendCount).toBe(0);
    expect(metrics.mixedIntentPartialReplyCount).toBe(0);
    expect(metrics.goldenCaseFailCount).toBe(0);
    expect(PHASE_73_GOLDEN_CASES.every((record) => evaluatePhase73GoldenCase(record).passed)).toBe(true);
  });

  it("reports expanded green-capacity metrics with measured false-yellow on source-backed rows only", () => {
    const metrics = evaluatePhase73GreenCapacityMetrics();

    expect(metrics.status).toBe("pass");
    expect(metrics.goldenCaseFailCount).toBe(0);
    expect(metrics.falseYellowRate).toBeGreaterThanOrEqual(0);
    expect(metrics.falseYellowRate).toBeLessThanOrEqual(1);
  });

  it("records draft clinical launch-gate evidence", () => {
    const evidence = buildPhase73CalibrationLaunchGateEvidence();

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.approvalStatus).toBe("draft");
    expect(evidence[0]?.coveredEvidence).toContain("current clinical golden test report");
  });
});
