import { describe, expect, it } from "vitest";
import {
  PHASE_84H_QA_SCENARIOS,
  buildPhase84hVerificationRefreshReport,
  evaluateAllPhase84hQaScenarios,
  evaluatePhase84hQaScenario,
  summarizePhase84hVerificationRefreshReport,
} from "./phase-84h-verification-refresh";

describe("phase 84h verification refresh", () => {
  it("evaluates all locked QA scenarios", () => {
    const results = evaluateAllPhase84hQaScenarios();
    expect(results).toHaveLength(PHASE_84H_QA_SCENARIOS.length);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("blocks non-admin emails on the admin allowlist scenario", () => {
    const result = evaluatePhase84hQaScenario("admin_allowlist_blocks");
    expect(result.passed).toBe(true);
  });

  it("requires dashboard membership profile and active entitlement", () => {
    const result = evaluatePhase84hQaScenario("dashboard_unlock_gate");
    expect(result.passed).toBe(true);
  });

  it("marks repo-local QA complete but VPS blocked when deployment is pending", () => {
    const report = buildPhase84hVerificationRefreshReport({
      targetedPhase84TestFileCount: 8,
      targetedPhase84TestsPassed: 40,
      visualTestCount: 10,
      visualTestsPassed: 10,
      appTestPassedCount: 700,
      appTestSkippedCount: 4,
      lintPassed: true,
      productionBuildPassed: true,
      releaseVerifyPassed: true,
      vpsDeploymentVerified: false,
      now: "2026-07-03T00:00:00.000Z",
    });

    expect(report.repoLocalQaComplete).toBe(true);
    expect(report.verificationStatus).toBe("blocked");
    expect(report.phase84TrackClosed).toBe(false);
    expect(report.productionPilotGoReady).toBe(false);
    expect(summarizePhase84hVerificationRefreshReport(report).qaScenarioPassCount).toBe(8);
  });

  it("fails closed when QA scenarios do not pass", () => {
    const report = buildPhase84hVerificationRefreshReport({
      targetedPhase84TestFileCount: 0,
      targetedPhase84TestsPassed: 0,
      visualTestCount: 0,
      visualTestsPassed: 0,
      appTestPassedCount: 0,
      appTestSkippedCount: 0,
      lintPassed: false,
      productionBuildPassed: false,
      releaseVerifyPassed: false,
      vpsDeploymentVerified: false,
    });

    expect(report.verificationStatus).toBe("failed");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });
});
