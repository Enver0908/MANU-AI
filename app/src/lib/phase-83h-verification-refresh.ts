import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";

export const PHASE_83H_VERSION = "phase83-verification-refresh-v1";

export type Phase83VerificationRefreshStatus = "passed" | "blocked" | "failed";

export type Phase83VerificationRefreshReport = {
  phase83Version: string;
  generatedAt: string;
  verificationStatus: Phase83VerificationRefreshStatus;
  phase83TrackClosed: boolean;
  productionPilotGoReady: false;
  repoLocalClosureComplete: boolean;
  finalReadinessBlocked: boolean;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r406BaselineMitigation: Phase79CurrentRlsEvidence["r406BaselineMitigation"];
  r406CurrentReRunStatus: Phase79CurrentRlsEvidence["r406CurrentReRunStatus"];
  blockingReasons: string[];
  verificationSummary: {
    targetedPhase83TestFileCount: number;
    targetedPhase83TestsPassed: number;
    visualTestCount: number;
    visualTestsPassed: number;
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

export function buildPhase83hVerificationRefreshReport(input: {
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r406BaselineMitigation?: Phase79CurrentRlsEvidence["r406BaselineMitigation"];
  r406CurrentReRunStatus?: Phase79CurrentRlsEvidence["r406CurrentReRunStatus"];
  targetedPhase83TestFileCount: number;
  targetedPhase83TestsPassed: number;
  visualTestCount: number;
  visualTestsPassed: number;
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
}): Phase83VerificationRefreshReport {
  const blockingReasons: string[] = [];
  const r406BaselineMitigation =
    input.r406BaselineMitigation ?? "phase_50_52_local_rls_mitigated";
  const r406CurrentReRunStatus = input.r406CurrentReRunStatus ?? input.r406CurrentRlsStatus;

  if (input.targetedPhase83TestsPassed <= 0) {
    blockingReasons.push("targeted Phase 83 tests have not passed");
  }
  if (input.visualTestsPassed <= 0) {
    blockingReasons.push("Playwright visual tests have not passed");
  }
  if (input.visualTestsPassed < input.visualTestCount) {
    blockingReasons.push("Playwright visual test count is incomplete");
  }
  if (!input.gitDiffCheckPassed) {
    blockingReasons.push("git diff --check did not pass");
  }
  if (!input.lintPassed) blockingReasons.push("lint did not pass");
  if (!input.productionBuildPassed) blockingReasons.push("production build did not pass");
  if (!input.releaseVerifyPassed) blockingReasons.push("release verification did not pass");
  if (!input.productionScaleRehearsalPassed) {
    blockingReasons.push("production-scale rehearsal did not pass");
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

  const toolchainFailed =
    !input.gitDiffCheckPassed ||
    !input.lintPassed ||
    !input.productionBuildPassed ||
    !input.releaseVerifyPassed ||
    !input.productionScaleRehearsalPassed ||
    input.targetedPhase83TestsPassed <= 0 ||
    input.visualTestsPassed <= 0 ||
    input.visualTestsPassed < input.visualTestCount;

  const finalReadinessBlocked =
    input.r406CurrentRlsStatus !== "pass" ||
    input.rlsTestSkippedCount > 0 ||
    input.rlsTestPassedCount <= 0;

  const repoLocalClosureComplete = !toolchainFailed;
  const phase83TrackClosed = repoLocalClosureComplete;

  const verificationStatus: Phase83VerificationRefreshStatus = toolchainFailed
    ? "failed"
    : finalReadinessBlocked
      ? "blocked"
      : "passed";

  if (phase83TrackClosed && finalReadinessBlocked) {
    blockingReasons.push(
      "Phase 83 repo-local track closed, but production pilot readiness remains blocked",
    );
  }

  return {
    phase83Version: PHASE_83H_VERSION,
    generatedAt: input.now ?? new Date().toISOString(),
    verificationStatus,
    phase83TrackClosed,
    productionPilotGoReady: false,
    repoLocalClosureComplete,
    finalReadinessBlocked,
    r406CurrentRlsStatus: input.r406CurrentRlsStatus,
    r406BaselineMitigation,
    r406CurrentReRunStatus,
    blockingReasons: [...new Set(blockingReasons)],
    verificationSummary: {
      targetedPhase83TestFileCount: input.targetedPhase83TestFileCount,
      targetedPhase83TestsPassed: input.targetedPhase83TestsPassed,
      visualTestCount: input.visualTestCount,
      visualTestsPassed: input.visualTestsPassed,
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

export function buildPhase83hBaselineVerificationRefreshReport(options: { now?: string } = {}) {
  return buildPhase83hVerificationRefreshReport({
    r406CurrentRlsStatus: "pending",
    r406CurrentReRunStatus: "pending",
    targetedPhase83TestFileCount: 10,
    targetedPhase83TestsPassed: 0,
    visualTestCount: 15,
    visualTestsPassed: 0,
    coreTestCount: 225,
    appTestPassedCount: 0,
    appTestSkippedCount: 4,
    rlsTestPassedCount: 0,
    rlsTestSkippedCount: 20,
    gitDiffCheckPassed: false,
    lintPassed: false,
    productionBuildPassed: false,
    releaseVerifyPassed: false,
    productionScaleRehearsalPassed: false,
    now: options.now ?? "2026-07-01T12:00:00.000Z",
  });
}

export function summarizePhase83hVerificationRefreshReport(
  report: Phase83VerificationRefreshReport,
) {
  return {
    verificationStatus: report.verificationStatus,
    phase83TrackClosed: report.phase83TrackClosed,
    productionPilotGoReady: report.productionPilotGoReady,
    repoLocalClosureComplete: report.repoLocalClosureComplete,
    finalReadinessBlocked: report.finalReadinessBlocked,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    r406BaselineMitigation: report.r406BaselineMitigation,
    r406CurrentReRunStatus: report.r406CurrentReRunStatus,
    blockingReasonCount: report.blockingReasons.length,
    verificationSummary: report.verificationSummary,
  };
}
