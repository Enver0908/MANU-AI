import { describe, expect, it } from "vitest";
import {
  buildPhase82gBaselineVerificationRefreshReport,
  buildPhase82gVerificationRefreshReport,
  summarizePhase82gVerificationRefreshReport,
} from "./phase-82g-verification-refresh";

const NOW = "2026-06-30T12:00:00.000Z";

function completeToolchainInput(
  overrides: Partial<Parameters<typeof buildPhase82gVerificationRefreshReport>[0]> = {},
) {
  return {
    r406CurrentRlsStatus: "pending" as const,
    targetedPhase82TestFileCount: 4,
    targetedPhase82TestsPassed: 27,
    targetedPhase80RegressionTestsPassed: 48,
    targetedPhase81RegressionTestsPassed: 46,
    coreTestCount: 225,
    appTestPassedCount: 595,
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

describe("phase 82g verification refresh", () => {
  it("records skipped current RLS as blocked final readiness while repo-local closure can complete", () => {
    const report = buildPhase82gBaselineVerificationRefreshReport({ now: NOW });

    expect(report.verificationStatus).toBe("blocked");
    expect(report.repoLocalClosureComplete).toBe(true);
    expect(report.finalReadinessBlocked).toBe(true);
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.r406BaselineMitigation).toBe("phase_50_52_local_rls_mitigated");
    expect(report.r406CurrentReRunStatus).toBe("pending");
    expect(report.verificationSummary.rlsTestSkippedCount).toBe(20);
    expect(report.blockingReasons).toContain("current RLS suite still has skipped tests");
    expect(report.blockingReasons).toContain(
      "Phase 82 repo-local closure track completed, but final external readiness remains blocked",
    );
  });

  it("passes only when current RLS and release checks pass", () => {
    const report = buildPhase82gVerificationRefreshReport(
      completeToolchainInput({
        r406CurrentRlsStatus: "pass",
        r406CurrentReRunStatus: "pass",
        rlsTestPassedCount: 20,
        rlsTestSkippedCount: 0,
      }),
    );

    expect(report.verificationStatus).toBe("passed");
    expect(report.repoLocalClosureComplete).toBe(true);
    expect(report.finalReadinessBlocked).toBe(false);
    expect(report.blockingReasons).toEqual([]);
  });

  it("fails when release verification fails", () => {
    const report = buildPhase82gVerificationRefreshReport(
      completeToolchainInput({
        r406CurrentRlsStatus: "pass",
        rlsTestPassedCount: 20,
        rlsTestSkippedCount: 0,
        releaseVerifyPassed: false,
      }),
    );

    expect(report.verificationStatus).toBe("failed");
    expect(report.repoLocalClosureComplete).toBe(false);
    expect(report.blockingReasons).toContain("release verification did not pass");
  });

  it("summarizes without leaking secrets", () => {
    const summary = summarizePhase82gVerificationRefreshReport(
      buildPhase82gVerificationRefreshReport(completeToolchainInput()),
    );

    expect(summary.repoLocalClosureComplete).toBe(true);
    expect(summary.finalReadinessBlocked).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|primaryPhoneE164/);
  });
});
