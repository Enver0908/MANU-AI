import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";

export const PHASE_82G_VERSION = "phase82-verification-refresh-v1";

export type Phase82VerificationRefreshStatus = "passed" | "blocked" | "failed";

export type Phase82VerificationRefreshReport = {
  phase82Version: string;
  generatedAt: string;
  verificationStatus: Phase82VerificationRefreshStatus;
  repoLocalClosureComplete: boolean;
  finalReadinessBlocked: boolean;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r406BaselineMitigation: Phase79CurrentRlsEvidence["r406BaselineMitigation"];
  r406CurrentReRunStatus: Phase79CurrentRlsEvidence["r406CurrentReRunStatus"];
  blockingReasons: string[];
  verificationSummary: {
    targetedPhase82TestFileCount: number;
    targetedPhase82TestsPassed: number;
    targetedPhase80RegressionTestsPassed: number;
    targetedPhase81RegressionTestsPassed: number;
    coreTestCount: number;
    appTestPassedCount: number;
    appTestSkippedCount: number;
    rlsTestPassedCount: number;
    rlsTestSkippedCount: number;
    gitDiffCheckPassed: boolean;
    lintPassed: boolean;
    productionBuildPassed: boolean;
    releaseVerifyPassed: boolean;
    productionScaleRehearsalPassed: boolean;
  };
};

export function buildPhase82gVerificationRefreshReport(input: {
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r406BaselineMitigation?: Phase79CurrentRlsEvidence["r406BaselineMitigation"];
  r406CurrentReRunStatus?: Phase79CurrentRlsEvidence["r406CurrentReRunStatus"];
  targetedPhase82TestFileCount: number;
  targetedPhase82TestsPassed: number;
  targetedPhase80RegressionTestsPassed: number;
  targetedPhase81RegressionTestsPassed: number;
  coreTestCount: number;
  appTestPassedCount: number;
  appTestSkippedCount: number;
  rlsTestPassedCount: number;
  rlsTestSkippedCount: number;
  gitDiffCheckPassed: boolean;
  lintPassed: boolean;
  productionBuildPassed: boolean;
  releaseVerifyPassed: boolean;
  productionScaleRehearsalPassed: boolean;
  now?: string;
}): Phase82VerificationRefreshReport {
  const blockingReasons: string[] = [];
  const r406BaselineMitigation =
    input.r406BaselineMitigation ?? "phase_50_52_local_rls_mitigated";
  const r406CurrentReRunStatus = input.r406CurrentReRunStatus ?? input.r406CurrentRlsStatus;

  if (input.targetedPhase82TestsPassed <= 0) {
    blockingReasons.push("targeted Phase 82 tests have not passed");
  }
  if (input.targetedPhase80RegressionTestsPassed <= 0) {
    blockingReasons.push("targeted Phase 80 regression tests have not passed");
  }
  if (input.targetedPhase81RegressionTestsPassed <= 0) {
    blockingReasons.push("targeted Phase 81 regression tests have not passed");
  }
  if (!input.gitDiffCheckPassed) {
    blockingReasons.push("git diff --check did not pass");
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

  const toolchainFailed =
    !input.gitDiffCheckPassed ||
    !input.lintPassed ||
    !input.productionBuildPassed ||
    !input.releaseVerifyPassed ||
    !input.productionScaleRehearsalPassed ||
    input.targetedPhase82TestsPassed <= 0 ||
    input.targetedPhase80RegressionTestsPassed <= 0 ||
    input.targetedPhase81RegressionTestsPassed <= 0;

  const finalReadinessBlocked =
    input.r406CurrentRlsStatus !== "pass" ||
    input.rlsTestSkippedCount > 0 ||
    input.rlsTestPassedCount <= 0;

  const repoLocalClosureComplete = !toolchainFailed;

  const verificationStatus: Phase82VerificationRefreshStatus = toolchainFailed
    ? "failed"
    : finalReadinessBlocked
      ? "blocked"
      : "passed";

  if (repoLocalClosureComplete && finalReadinessBlocked) {
    blockingReasons.push(
      "Phase 82 repo-local closure track completed, but final external readiness remains blocked",
    );
  }

  return {
    phase82Version: PHASE_82G_VERSION,
    generatedAt: input.now ?? new Date().toISOString(),
    verificationStatus,
    repoLocalClosureComplete,
    finalReadinessBlocked,
    r406CurrentRlsStatus: input.r406CurrentRlsStatus,
    r406BaselineMitigation,
    r406CurrentReRunStatus,
    blockingReasons: [...new Set(blockingReasons)],
    verificationSummary: {
      targetedPhase82TestFileCount: input.targetedPhase82TestFileCount,
      targetedPhase82TestsPassed: input.targetedPhase82TestsPassed,
      targetedPhase80RegressionTestsPassed: input.targetedPhase80RegressionTestsPassed,
      targetedPhase81RegressionTestsPassed: input.targetedPhase81RegressionTestsPassed,
      coreTestCount: input.coreTestCount,
      appTestPassedCount: input.appTestPassedCount,
      appTestSkippedCount: input.appTestSkippedCount,
      rlsTestPassedCount: input.rlsTestPassedCount,
      rlsTestSkippedCount: input.rlsTestSkippedCount,
      gitDiffCheckPassed: input.gitDiffCheckPassed,
      lintPassed: input.lintPassed,
      productionBuildPassed: input.productionBuildPassed,
      releaseVerifyPassed: input.releaseVerifyPassed,
      productionScaleRehearsalPassed: input.productionScaleRehearsalPassed,
    },
  };
}

export function buildPhase82gBaselineVerificationRefreshReport(options: { now?: string } = {}) {
  return buildPhase82gVerificationRefreshReport({
    r406CurrentRlsStatus: "pending",
    r406CurrentReRunStatus: "pending",
    targetedPhase82TestFileCount: 5,
    targetedPhase82TestsPassed: 31,
    targetedPhase80RegressionTestsPassed: 29,
    targetedPhase81RegressionTestsPassed: 19,
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
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function summarizePhase82gVerificationRefreshReport(
  report: Phase82VerificationRefreshReport,
) {
  return {
    verificationStatus: report.verificationStatus,
    repoLocalClosureComplete: report.repoLocalClosureComplete,
    finalReadinessBlocked: report.finalReadinessBlocked,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    r406BaselineMitigation: report.r406BaselineMitigation,
    r406CurrentReRunStatus: report.r406CurrentReRunStatus,
    blockingReasonCount: report.blockingReasons.length,
    verificationSummary: report.verificationSummary,
  };
}
