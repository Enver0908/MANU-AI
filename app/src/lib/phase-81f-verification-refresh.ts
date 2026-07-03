import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";

export const PHASE_81F_VERSION = "phase81-verification-refresh-v1";

export type Phase81VerificationRefreshStatus = "passed" | "blocked" | "failed";

export type Phase81VerificationRefreshReport = {
  phase81Version: string;
  generatedAt: string;
  verificationStatus: Phase81VerificationRefreshStatus;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  goReadyBlocked: boolean;
  blockingReasons: string[];
  verificationSummary: {
    targetedPhase81TestsPassed: number;
    coreTestCount: number;
    appTestPassedCount: number;
    appTestSkippedCount: number;
    rlsTestPassedCount: number;
    rlsTestSkippedCount: number;
    lintPassed: boolean;
    productionBuildPassed: boolean;
    releaseVerifyPassed: boolean;
    productionScaleRehearsalPassed: boolean;
  };
};

export function buildPhase81fVerificationRefreshReport(input: {
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  targetedPhase81TestsPassed: number;
  coreTestCount: number;
  appTestPassedCount: number;
  appTestSkippedCount: number;
  rlsTestPassedCount: number;
  rlsTestSkippedCount: number;
  lintPassed: boolean;
  productionBuildPassed: boolean;
  releaseVerifyPassed: boolean;
  productionScaleRehearsalPassed: boolean;
  now?: string;
}): Phase81VerificationRefreshReport {
  const blockingReasons: string[] = [];

  if (input.targetedPhase81TestsPassed <= 0) {
    blockingReasons.push("targeted Phase 81 tests have not passed");
  }
  if (input.r406CurrentRlsStatus !== "pass") {
    blockingReasons.push(
      `current RLS evidence is ${input.r406CurrentRlsStatus}, expected pass`,
    );
  }
  if (input.rlsTestPassedCount <= 0) {
    blockingReasons.push("current RLS test pass count is missing");
  }
  if (input.rlsTestSkippedCount > 0) {
    blockingReasons.push("current RLS suite still has skipped tests");
  }
  if (!input.lintPassed) blockingReasons.push("lint did not pass");
  if (!input.productionBuildPassed) blockingReasons.push("production build did not pass");
  if (!input.releaseVerifyPassed) blockingReasons.push("release verification did not pass");
  if (!input.productionScaleRehearsalPassed) {
    blockingReasons.push("production-scale rehearsal did not pass");
  }

  const verificationStatus =
    blockingReasons.length === 0
      ? "passed"
      : input.r406CurrentRlsStatus === "fail" ||
          !input.lintPassed ||
          !input.productionBuildPassed ||
          !input.releaseVerifyPassed ||
          !input.productionScaleRehearsalPassed
        ? "failed"
        : "blocked";

  return {
    phase81Version: PHASE_81F_VERSION,
    generatedAt: input.now ?? new Date().toISOString(),
    verificationStatus,
    r406CurrentRlsStatus: input.r406CurrentRlsStatus,
    goReadyBlocked: verificationStatus !== "passed",
    blockingReasons,
    verificationSummary: {
      targetedPhase81TestsPassed: input.targetedPhase81TestsPassed,
      coreTestCount: input.coreTestCount,
      appTestPassedCount: input.appTestPassedCount,
      appTestSkippedCount: input.appTestSkippedCount,
      rlsTestPassedCount: input.rlsTestPassedCount,
      rlsTestSkippedCount: input.rlsTestSkippedCount,
      lintPassed: input.lintPassed,
      productionBuildPassed: input.productionBuildPassed,
      releaseVerifyPassed: input.releaseVerifyPassed,
      productionScaleRehearsalPassed: input.productionScaleRehearsalPassed,
    },
  };
}

export function buildPhase81fBaselineVerificationRefreshReport(options: { now?: string } = {}) {
  return buildPhase81fVerificationRefreshReport({
    r406CurrentRlsStatus: "pending",
    targetedPhase81TestsPassed: 46,
    coreTestCount: 225,
    appTestPassedCount: 564,
    appTestSkippedCount: 4,
    rlsTestPassedCount: 0,
    rlsTestSkippedCount: 20,
    lintPassed: true,
    productionBuildPassed: true,
    releaseVerifyPassed: true,
    productionScaleRehearsalPassed: true,
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function buildPhase81fSyntheticPassedVerificationRefreshReport(
  options: { now?: string } = {},
) {
  return buildPhase81fVerificationRefreshReport({
    r406CurrentRlsStatus: "pass",
    targetedPhase81TestsPassed: 46,
    coreTestCount: 225,
    appTestPassedCount: 564,
    appTestSkippedCount: 4,
    rlsTestPassedCount: 20,
    rlsTestSkippedCount: 0,
    lintPassed: true,
    productionBuildPassed: true,
    releaseVerifyPassed: true,
    productionScaleRehearsalPassed: true,
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function summarizePhase81fVerificationRefreshReport(
  report: Phase81VerificationRefreshReport,
) {
  return {
    verificationStatus: report.verificationStatus,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    goReadyBlocked: report.goReadyBlocked,
    blockingReasonCount: report.blockingReasons.length,
    verificationSummary: report.verificationSummary,
  };
}
