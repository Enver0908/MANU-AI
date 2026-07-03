import { describe, expect, it } from "vitest";
import {
  buildPhase83hBaselineVerificationRefreshReport,
  buildPhase83hVerificationRefreshReport,
  summarizePhase83hVerificationRefreshReport,
} from "./phase-83h-verification-refresh";

const NOW = "2026-07-01T12:00:00.000Z";

function completeToolchainInput(
  overrides: Partial<Parameters<typeof buildPhase83hVerificationRefreshReport>[0]> = {},
) {
  return {
    r406CurrentRlsStatus: "pending" as const,
    targetedPhase83TestFileCount: 10,
    targetedPhase83TestsPassed: 63,
    visualTestCount: 16,
    visualTestsPassed: 16,
    coreTestCount: 225,
    appTestPassedCount: 660,
    appTestSkippedCount: 4,
    rlsTestPassedCount: 0,
    rlsTestSkippedCount: 20,
    gitDiffCheckPassed: true,
    lintPassed: true,
    productionBuildPassed: true,
    releaseVerifyPassed: true,
    productionScaleRehearsalPassed: true,
    now: NOW,
    ...overrides,
  };
}

describe("phase 83h verification refresh", () => {
  it("records skipped current RLS as blocked final readiness while Phase 83 track can close locally", () => {
    const report = buildPhase83hVerificationRefreshReport(
      completeToolchainInput({
        r406CurrentRlsStatus: "pending",
        r406CurrentReRunStatus: "pending",
        rlsTestPassedCount: 0,
        rlsTestSkippedCount: 20,
      }),
    );

    expect(report.verificationStatus).toBe("blocked");
    expect(report.phase83TrackClosed).toBe(true);
    expect(report.repoLocalClosureComplete).toBe(true);
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.r406CurrentReRunStatus).toBe("pending");
    expect(report.blockingReasons).toContain("current RLS suite still has skipped tests");
    expect(report.blockingReasons).toContain(
      "Phase 83 repo-local track closed, but production pilot readiness remains blocked",
    );
  });

  it("starts from baseline with failed toolchain and open track", () => {
    const report = buildPhase83hBaselineVerificationRefreshReport({ now: NOW });

    expect(report.verificationStatus).toBe("failed");
    expect(report.phase83TrackClosed).toBe(false);
    expect(report.repoLocalClosureComplete).toBe(false);
    expect(report.blockingReasons).toContain("targeted Phase 83 tests have not passed");
  });

  it("passes only when current RLS and release checks pass", () => {
    const report = buildPhase83hVerificationRefreshReport(
      completeToolchainInput({
        r406CurrentRlsStatus: "pass",
        r406CurrentReRunStatus: "pass",
        rlsTestPassedCount: 21,
        rlsTestSkippedCount: 0,
      }),
    );

    expect(report.verificationStatus).toBe("passed");
    expect(report.phase83TrackClosed).toBe(true);
    expect(report.finalReadinessBlocked).toBe(false);
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.blockingReasons).toEqual([]);
  });

  it("fails when visual tests are incomplete", () => {
    const report = buildPhase83hVerificationRefreshReport(
      completeToolchainInput({
        visualTestCount: 15,
        visualTestsPassed: 12,
      }),
    );

    expect(report.verificationStatus).toBe("failed");
    expect(report.phase83TrackClosed).toBe(false);
    expect(report.blockingReasons).toContain("Playwright visual test count is incomplete");
  });

  it("summarizes report fields for continuity docs", () => {
    const summary = summarizePhase83hVerificationRefreshReport(
      buildPhase83hVerificationRefreshReport(completeToolchainInput()),
    );

    expect(summary.phase83TrackClosed).toBe(true);
    expect(summary.productionPilotGoReady).toBe(false);
    expect(summary.verificationSummary.targetedPhase83TestsPassed).toBe(63);
  });
});
