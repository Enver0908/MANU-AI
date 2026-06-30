import type { LaunchGateEvidenceRecord, LaunchGateId } from "./launch-gates";
import {
  buildPhase80cLaunchGateEvidenceEvaluationReport,
  resolvePhase80ProductionPilotDecision,
  type Phase80IntakeStatus,
  type Phase80LaunchGateEvidenceEvaluationReport,
  type Phase80ProductionPilotDecision,
  type Phase80R405Status,
} from "./phase-80c-launch-gate-evidence-evaluation";
import {
  buildPhase80dNoPatchClosureEvaluation,
  type Phase80dR405ClosureEvaluation,
} from "./phase-80d-r405-closure-evaluation";
import {
  buildPhase80eCurrentRlsEvidenceReport,
  buildPhase80eR406Narrative,
  type Phase80eCurrentRlsEvidenceReport,
} from "./phase-80e-current-rls-evidence";
import {
  buildPhase79fPendingEvidence,
  type Phase79CurrentRlsEvidence,
} from "./phase-79f-current-rls-evidence";

export const PHASE_80F_VERSION = "phase80-final-readiness-decision-v1";

export type Phase80Outcome =
  | "NO_GO_MISSING_ARTIFACTS"
  | "NO_GO_INCOMPLETE_OR_REJECTED_EVIDENCE"
  | "NO_GO_R405_OPEN"
  | "NO_GO_RLS_CURRENT_RERUN_PENDING"
  | "PHASE_81_ELIGIBLE";

export type Phase80FinalClosureReport = {
  phase80Version: string;
  generatedAt: string;
  phase80Outcome: Phase80Outcome;
  productionPilotDecision: Phase80ProductionPilotDecision;
  productionPilotGo: false;
  phase81StartEligible: boolean;
  intakeStatus: Phase80IntakeStatus;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  gateResults: Phase80LaunchGateEvidenceEvaluationReport["gateResults"];
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  r405Evaluation: Phase80dR405ClosureEvaluation;
  rlsEvidenceReport: Phase80eCurrentRlsEvidenceReport;
  blockingReasons: string[];
};

export function resolvePhase80Outcome(input: {
  intakeStatus: Phase80IntakeStatus;
  openGateIds: LaunchGateId[];
  evidenceRecordCount: number;
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
}): Phase80Outcome {
  if (input.intakeStatus === "no_external_artifact_supplied" || input.evidenceRecordCount === 0) {
    return "NO_GO_MISSING_ARTIFACTS";
  }
  if (input.openGateIds.length > 0) {
    return "NO_GO_INCOMPLETE_OR_REJECTED_EVIDENCE";
  }
  if (input.r405Status === "open") {
    return "NO_GO_R405_OPEN";
  }
  if (input.r406CurrentRlsStatus !== "pass") {
    return "NO_GO_RLS_CURRENT_RERUN_PENDING";
  }
  return "PHASE_81_ELIGIBLE";
}

export function buildPhase80fBlockingReasons(input: {
  phase80Outcome: Phase80Outcome;
  openGateIds: LaunchGateId[];
  r405Evaluation: Phase80dR405ClosureEvaluation;
  rlsEvidenceReport: Phase80eCurrentRlsEvidenceReport;
}) {
  const reasons = new Set<string>();

  if (input.phase80Outcome === "NO_GO_MISSING_ARTIFACTS") {
    reasons.add("no external approval artifacts supplied");
  }
  if (input.openGateIds.length > 0) {
    reasons.add(`open launch gates remain: ${input.openGateIds.join(", ")}`);
  }
  for (const reason of input.r405Evaluation.blockingReasons) {
    reasons.add(reason);
  }
  if (input.rlsEvidenceReport.evidence.status !== "pass") {
    reasons.add(input.rlsEvidenceReport.r406NarrativeForPhase80);
  }
  if (input.phase80Outcome !== "PHASE_81_ELIGIBLE") {
    reasons.add("phase 81 cannot start until Phase 80 records PHASE_81_ELIGIBLE");
  }

  return [...reasons];
}

export function buildPhase80fFinalClosureReport(input: {
  evidenceRecords?: LaunchGateEvidenceRecord[];
  now?: string;
  r405Evaluation?: Phase80dR405ClosureEvaluation;
  rlsEvidenceReport?: Phase80eCurrentRlsEvidenceReport;
} = {}): Phase80FinalClosureReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const r405Evaluation =
    input.r405Evaluation ??
    buildPhase80dNoPatchClosureEvaluation({
      nextLatestVersion: "16.2.9",
      nestedPostcssVersion: "8.4.31",
      eslintConfigNextLatestVersion: "16.2.9",
      now: generatedAt,
    });
  const rlsEvidenceReport =
    input.rlsEvidenceReport ??
    buildPhase80eCurrentRlsEvidenceReport({
      evidence: buildPhase79fPendingEvidence({
        localSupabaseAvailable: false,
        runAttempted: true,
        failures: ["local_supabase_unavailable", "rls_integration_suite_skipped"],
      }),
      generatedAt,
      runAttempted: true,
    });
  const gateReport = buildPhase80cLaunchGateEvidenceEvaluationReport({
    evidenceRecords: input.evidenceRecords ?? [],
    now: generatedAt,
    r405Status: r405Evaluation.r405Status,
    r406Evidence: rlsEvidenceReport.evidence,
  });
  const phase80Outcome = resolvePhase80Outcome({
    intakeStatus: gateReport.intakeStatus,
    openGateIds: gateReport.openGateIds,
    evidenceRecordCount: gateReport.evidenceRecordCount,
    r405Status: gateReport.r405Status,
    r406CurrentRlsStatus: gateReport.r406CurrentRlsStatus,
  });
  const productionPilotDecision = resolvePhase80ProductionPilotDecision({
    openGateIds: gateReport.openGateIds,
    r405Status: gateReport.r405Status,
    r406CurrentRlsStatus: gateReport.r406CurrentRlsStatus,
  });

  return {
    phase80Version: PHASE_80F_VERSION,
    generatedAt,
    phase80Outcome,
    productionPilotDecision,
    productionPilotGo: false,
    phase81StartEligible: productionPilotDecision === "PHASE_81_ELIGIBLE",
    intakeStatus: gateReport.intakeStatus,
    approvedGateIds: gateReport.approvedGateIds,
    openGateIds: gateReport.openGateIds,
    gateResults: gateReport.gateResults,
    r405Status: gateReport.r405Status,
    r406CurrentRlsStatus: gateReport.r406CurrentRlsStatus,
    r405Evaluation,
    rlsEvidenceReport,
    blockingReasons: buildPhase80fBlockingReasons({
      phase80Outcome,
      openGateIds: gateReport.openGateIds,
      r405Evaluation,
      rlsEvidenceReport,
    }),
  };
}

export function buildPhase80fBaselineClosureReport(options: { now?: string } = {}) {
  return buildPhase80fFinalClosureReport({
    evidenceRecords: [],
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function summarizePhase80fFinalDecision(report: Phase80FinalClosureReport) {
  return {
    phase80Outcome: report.phase80Outcome,
    productionPilotDecision: report.productionPilotDecision,
    productionPilotGo: report.productionPilotGo,
    phase81StartEligible: report.phase81StartEligible,
    openGateCount: report.openGateIds.length,
    approvedGateCount: report.approvedGateIds.length,
    r405Status: report.r405Status,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    r406Narrative: buildPhase80eR406Narrative(report.rlsEvidenceReport.evidence),
  };
}
