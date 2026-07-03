import { describe, expect, it } from "vitest";
import {
  buildPhase81fBaselineVerificationRefreshReport,
  buildPhase81fSyntheticPassedVerificationRefreshReport,
  buildPhase81fVerificationRefreshReport,
  summarizePhase81fVerificationRefreshReport,
} from "./phase-81f-verification-refresh";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81f verification refresh", () => {
  it("records skipped current RLS as refreshed but blocked", () => {
    const report = buildPhase81fBaselineVerificationRefreshReport({ now: NOW });

    expect(report.verificationStatus).toBe("blocked");
    expect(report.r406CurrentRlsStatus).toBe("pending");
    expect(report.goReadyBlocked).toBe(true);
    expect(report.verificationSummary.rlsTestSkippedCount).toBe(20);
    expect(report.blockingReasons).toContain("current RLS suite still has skipped tests");
  });

  it("passes only when current RLS and release checks pass", () => {
    const report = buildPhase81fSyntheticPassedVerificationRefreshReport({ now: NOW });

    expect(report.verificationStatus).toBe("passed");
    expect(report.goReadyBlocked).toBe(false);
    expect(report.r406CurrentRlsStatus).toBe("pass");
    expect(report.blockingReasons).toEqual([]);
  });

  it("fails when release verification fails", () => {
    const report = buildPhase81fVerificationRefreshReport({
      r406CurrentRlsStatus: "pass",
      targetedPhase81TestsPassed: 46,
      coreTestCount: 225,
      appTestPassedCount: 564,
      appTestSkippedCount: 4,
      rlsTestPassedCount: 20,
      rlsTestSkippedCount: 0,
      lintPassed: true,
      productionBuildPassed: true,
      releaseVerifyPassed: false,
      productionScaleRehearsalPassed: true,
      now: NOW,
    });

    expect(report.verificationStatus).toBe("failed");
    expect(report.blockingReasons).toContain("release verification did not pass");
  });

  it("summarizes without leaking secrets", () => {
    const summary = summarizePhase81fVerificationRefreshReport(
      buildPhase81fBaselineVerificationRefreshReport({ now: NOW }),
    );

    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|primaryPhoneE164/);
  });
});
