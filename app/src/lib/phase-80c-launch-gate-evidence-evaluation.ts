import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  evaluateProductionPilotLaunchGateEvidence,
  type LaunchGateEvidenceGateResult,
  type LaunchGateEvidenceRecord,
  type LaunchGateId,
} from "./launch-gates";
import {
  buildPhase79fPendingEvidence,
  evaluatePhase79fCurrentRlsEvidenceForHealth,
  type Phase79CurrentRlsEvidence,
} from "./phase-79f-current-rls-evidence";

export const PHASE_80C_VERSION = "phase80-launch-gate-evidence-evaluation-v1";

export type Phase80IntakeStatus = "no_external_artifact_supplied" | "artifacts_supplied";

export type Phase80R405Status = "open" | "technically_resolved" | "formally_accepted";

export type Phase80ProductionPilotDecision = "NO-GO" | "PHASE_81_ELIGIBLE";

export type Phase80LaunchGateEvidenceEvaluationReport = {
  phase80Version: string;
  generatedAt: string;
  intakeStatus: Phase80IntakeStatus;
  evidenceRecordCount: number;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  gateResults: LaunchGateEvidenceGateResult[];
  ignoredEvidenceGateIds: string[];
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  productionPilotDecision: Phase80ProductionPilotDecision;
};

export function resolvePhase80IntakeStatus(
  evidenceRecords: LaunchGateEvidenceRecord[],
): Phase80IntakeStatus {
  return evidenceRecords.length === 0 ? "no_external_artifact_supplied" : "artifacts_supplied";
}

export function resolvePhase80ProductionPilotDecision(input: {
  openGateIds: LaunchGateId[];
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
}): Phase80ProductionPilotDecision {
  if (input.openGateIds.length > 0) return "NO-GO";
  if (input.r405Status === "open") return "NO-GO";
  if (input.r406CurrentRlsStatus !== "pass") return "NO-GO";
  return "PHASE_81_ELIGIBLE";
}

export function buildPhase80cLaunchGateEvidenceEvaluationReport(input: {
  evidenceRecords?: LaunchGateEvidenceRecord[];
  now?: string;
  r405Status?: Phase80R405Status;
  r406Evidence?: Phase79CurrentRlsEvidence;
} = {}): Phase80LaunchGateEvidenceEvaluationReport {
  const evidenceRecords = input.evidenceRecords ?? [];
  const generatedAt = input.now ?? new Date().toISOString();
  const evaluation = evaluateProductionPilotLaunchGateEvidence(evidenceRecords, { now: generatedAt });
  const r406Evidence = input.r406Evidence ?? evaluatePhase79fCurrentRlsEvidenceForHealth();
  const r405Status = input.r405Status ?? "open";

  return {
    phase80Version: PHASE_80C_VERSION,
    generatedAt,
    intakeStatus: resolvePhase80IntakeStatus(evidenceRecords),
    evidenceRecordCount: evidenceRecords.length,
    approvedGateIds: evaluation.approvedGateIds,
    openGateIds: evaluation.openGateIds,
    gateResults: evaluation.gateResults,
    ignoredEvidenceGateIds: evaluation.ignoredEvidenceGateIds,
    r405Status,
    r406CurrentRlsStatus: r406Evidence.status,
    productionPilotDecision: resolvePhase80ProductionPilotDecision({
      openGateIds: evaluation.openGateIds,
      r405Status,
      r406CurrentRlsStatus: r406Evidence.status,
    }),
  };
}

export function buildPhase80cNoArtifactSuppliedReport(options: {
  now?: string;
  r405Status?: Phase80R405Status;
  localSupabaseAvailable?: boolean;
} = {}): Phase80LaunchGateEvidenceEvaluationReport {
  const r406Evidence =
    options.localSupabaseAvailable === undefined
      ? evaluatePhase79fCurrentRlsEvidenceForHealth()
      : buildPhase79fPendingEvidence({
          localSupabaseAvailable: options.localSupabaseAvailable,
          runAttempted: false,
        });

  return buildPhase80cLaunchGateEvidenceEvaluationReport({
    evidenceRecords: [],
    now: options.now,
    r405Status: options.r405Status ?? "open",
    r406Evidence,
  });
}

export function summarizePhase80cGateEvaluation(report: Phase80LaunchGateEvidenceEvaluationReport) {
  return PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => {
    const gateResult = report.gateResults.find((result) => result.gateId === gate.id);
    return {
      gateId: gate.id,
      label: gate.label,
      status: gateResult?.status ?? "open",
      missingEvidence: gateResult?.missingEvidence ?? gate.requiredEvidence,
      blockingReasons: gateResult?.blockingReasons ?? ["no evidence records supplied"],
    };
  });
}
