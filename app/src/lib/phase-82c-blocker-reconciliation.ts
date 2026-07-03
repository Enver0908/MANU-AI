import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";
import {
  buildPhase79fEvidenceFromRunResult,
  buildPhase79fPendingEvidence,
} from "./phase-79f-current-rls-evidence";
import {
  buildPhase80dNoPatchClosureEvaluation,
  buildPhase80dR405ClosureEvaluation,
  type Phase80dR405ClosureEvaluation,
} from "./phase-80d-r405-closure-evaluation";
import type { Phase80R405Status } from "./phase-80c-launch-gate-evidence-evaluation";

export const PHASE_82C_VERSION = "phase82-blocker-reconciliation-v1";

export const PHASE_82C_BASELINE_NEXT_VERSION = "16.2.9";
export const PHASE_82C_BASELINE_NESTED_POSTCSS_VERSION = "8.4.31";
export const PHASE_82C_BASELINE_ESLINT_CONFIG_NEXT_VERSION = "16.2.9";

export type Phase82BlockerReconciliationStatus = "blocked" | "clear";

export type Phase82BlockerReconciliationReport = {
  phase82Version: string;
  generatedAt: string;
  reconciliationStatus: Phase82BlockerReconciliationStatus;
  finalReadinessBlocked: boolean;
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r406BaselineMitigation: Phase79CurrentRlsEvidence["r406BaselineMitigation"];
  r406CurrentReRunStatus: Phase79CurrentRlsEvidence["r406CurrentReRunStatus"];
  dependencyFilesChanged: boolean;
  patchPath: Phase80dR405ClosureEvaluation["patchPath"];
  unknownProductionAuditFindings: string[];
  r405BlockingReasons: string[];
  r406BlockingReasons: string[];
  blockingReasons: string[];
  r406Narrative: string;
  r405Narrative: string;
};

export function buildPhase82cR406Narrative(evidence: Phase79CurrentRlsEvidence) {
  if (evidence.status === "pass") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79/80/81 migration/RLS re-run complete.";
  }
  if (evidence.status === "fail") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79/80/81 migration/RLS re-run failed and must be remediated before final readiness.";
  }
  return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79/80/81 migration/RLS re-run pending when local Supabase is unavailable.";
}

export function resolvePhase82R406BlockingReasons(
  evidence: Phase79CurrentRlsEvidence,
): string[] {
  const reasons: string[] = [];

  if (evidence.status !== "pass") {
    if (
      (evidence.testsSkipped === 20 && evidence.testsPassed === 0) ||
      evidence.failures.includes("rls_integration_suite_skipped")
    ) {
      reasons.push(
        "current RLS evidence skipped 20/20; Phase 50/52 baseline mitigated but current rerun pending",
      );
    } else if (!evidence.localSupabaseAvailable && evidence.status === "pending") {
      reasons.push(
        "current RLS evidence pending; Phase 50/52 baseline mitigated but current rerun pending",
      );
    } else {
      reasons.push(`current RLS evidence is ${evidence.status}, expected pass`);
    }
  }

  if (evidence.r406CurrentReRunStatus !== "pass" && reasons.length === 0) {
    reasons.push(
      `R-406 current re-run status is ${evidence.r406CurrentReRunStatus}, expected pass`,
    );
  }

  return reasons;
}

export function resolvePhase82BlockerReconciliationStatus(input: {
  r405Status: Phase80R405Status;
  r406Evidence: Phase79CurrentRlsEvidence;
  unknownProductionAuditFindings: string[];
}): Phase82BlockerReconciliationStatus {
  if (input.r405Status === "open") return "blocked";
  if (input.r406Evidence.status !== "pass") return "blocked";
  if (input.r406Evidence.r406CurrentReRunStatus !== "pass") return "blocked";
  if (input.unknownProductionAuditFindings.length > 0) return "blocked";
  return "clear";
}

export function buildPhase82BlockerReconciliationReport(input: {
  r405Evaluation: Phase80dR405ClosureEvaluation;
  r406Evidence: Phase79CurrentRlsEvidence;
  now?: string;
}): Phase82BlockerReconciliationReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const r406BlockingReasons = resolvePhase82R406BlockingReasons(input.r406Evidence);
  const r405BlockingReasons =
    input.r405Evaluation.r405Status === "open" ? [...input.r405Evaluation.blockingReasons] : [];
  const blockingReasons = [...r405BlockingReasons, ...r406BlockingReasons];
  const reconciliationStatus = resolvePhase82BlockerReconciliationStatus({
    r405Status: input.r405Evaluation.r405Status,
    r406Evidence: input.r406Evidence,
    unknownProductionAuditFindings: input.r405Evaluation.unknownProductionAuditFindings,
  });

  return {
    phase82Version: PHASE_82C_VERSION,
    generatedAt,
    reconciliationStatus,
    finalReadinessBlocked: reconciliationStatus === "blocked",
    r405Status: input.r405Evaluation.r405Status,
    r406CurrentRlsStatus: input.r406Evidence.status,
    r406BaselineMitigation: input.r406Evidence.r406BaselineMitigation,
    r406CurrentReRunStatus: input.r406Evidence.r406CurrentReRunStatus,
    dependencyFilesChanged: input.r405Evaluation.dependencyFilesChanged,
    patchPath: input.r405Evaluation.patchPath,
    unknownProductionAuditFindings: input.r405Evaluation.unknownProductionAuditFindings,
    r405BlockingReasons,
    r406BlockingReasons,
    blockingReasons,
    r406Narrative: buildPhase82cR406Narrative(input.r406Evidence),
    r405Narrative: input.r405Evaluation.narrative,
  };
}

export function buildPhase82BaselineBlockerReconciliationReport(options: { now?: string } = {}) {
  const r405Evaluation = buildPhase80dNoPatchClosureEvaluation({
    nextLatestVersion: PHASE_82C_BASELINE_NEXT_VERSION,
    nestedPostcssVersion: PHASE_82C_BASELINE_NESTED_POSTCSS_VERSION,
    eslintConfigNextLatestVersion: PHASE_82C_BASELINE_ESLINT_CONFIG_NEXT_VERSION,
    now: options.now,
  });
  const r406Evidence = buildPhase79fPendingEvidence({
    localSupabaseAvailable: false,
    runAttempted: false,
    failures: ["local_supabase_unavailable", "current_migration_rls_re_run_pending"],
  });

  return buildPhase82BlockerReconciliationReport({
    r405Evaluation,
    r406Evidence,
    now: options.now,
  });
}

export function buildPhase82SkippedRlsBlockerReconciliationReport(options: { now?: string } = {}) {
  const r405Evaluation = buildPhase80dNoPatchClosureEvaluation({
    nextLatestVersion: PHASE_82C_BASELINE_NEXT_VERSION,
    nestedPostcssVersion: PHASE_82C_BASELINE_NESTED_POSTCSS_VERSION,
    eslintConfigNextLatestVersion: PHASE_82C_BASELINE_ESLINT_CONFIG_NEXT_VERSION,
    now: options.now,
  });
  const r406Evidence = buildPhase79fEvidenceFromRunResult({
    exitCode: 0,
    output: "Test Files  1 skipped (1)\nTests  20 skipped (20)",
    localSupabaseAvailable: true,
    runAttempted: true,
  });

  return buildPhase82BlockerReconciliationReport({
    r405Evaluation,
    r406Evidence,
    now: options.now,
  });
}

export function buildPhase82BlockerReconciliationReportFromInputs(input: {
  r405EvaluationInput?: Parameters<typeof buildPhase80dR405ClosureEvaluation>[0];
  r406Evidence?: Phase79CurrentRlsEvidence;
  now?: string;
}) {
  const r405Evaluation = input.r405EvaluationInput
    ? buildPhase80dR405ClosureEvaluation(input.r405EvaluationInput)
    : buildPhase80dNoPatchClosureEvaluation({
        nextLatestVersion: PHASE_82C_BASELINE_NEXT_VERSION,
        nestedPostcssVersion: PHASE_82C_BASELINE_NESTED_POSTCSS_VERSION,
        eslintConfigNextLatestVersion: PHASE_82C_BASELINE_ESLINT_CONFIG_NEXT_VERSION,
        now: input.now,
      });

  return buildPhase82BlockerReconciliationReport({
    r405Evaluation,
    r406Evidence:
      input.r406Evidence ??
      buildPhase79fPendingEvidence({
        localSupabaseAvailable: false,
        runAttempted: false,
      }),
    now: input.now,
  });
}

export function summarizePhase82BlockerReconciliationReport(
  report: Phase82BlockerReconciliationReport,
) {
  return {
    phase82Version: report.phase82Version,
    reconciliationStatus: report.reconciliationStatus,
    finalReadinessBlocked: report.finalReadinessBlocked,
    r405Status: report.r405Status,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    r406BaselineMitigation: report.r406BaselineMitigation,
    r406CurrentReRunStatus: report.r406CurrentReRunStatus,
    dependencyFilesChanged: report.dependencyFilesChanged,
    patchPath: report.patchPath,
    unknownProductionAuditFindingCount: report.unknownProductionAuditFindings.length,
    blockingReasonCount: report.blockingReasons.length,
  };
}
