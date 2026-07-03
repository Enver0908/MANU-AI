import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  evaluateProductionPilotLaunchGateEvidence,
  type LaunchGateEvidenceRecord,
  type LaunchGateId,
} from "./launch-gates";

export const PHASE_82B_VERSION = "phase82-external-evidence-gap-ledger-v1";

export type Phase82EvidenceIntakeStatus = "no_external_artifact_supplied" | "artifacts_supplied";

export type Phase82EvidenceGapBlockerCategory =
  | "missing_evidence"
  | "no_records"
  | "conditional"
  | "rejected"
  | "draft"
  | "stale"
  | "expired"
  | "unsanitized";

export type Phase82GateEvidenceGapEntry = {
  gateId: LaunchGateId;
  label: string;
  status: "approved" | "open";
  missingEvidence: string[];
  sanitizedArtifactRefs: string[];
  blockerCategories: Phase82EvidenceGapBlockerCategory[];
  blockingReasons: string[];
};

export type Phase82ExternalEvidenceGapLedger = {
  phase82Version: string;
  generatedAt: string;
  intakeStatus: Phase82EvidenceIntakeStatus;
  evidenceRecordCount: number;
  externalArtifactsSupplied: boolean;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  ignoredEvidenceGateIds: string[];
  allGatesOpen: boolean;
  gateEntries: Phase82GateEvidenceGapEntry[];
};

export function resolvePhase82EvidenceIntakeStatus(
  evidenceRecords: LaunchGateEvidenceRecord[],
): Phase82EvidenceIntakeStatus {
  return evidenceRecords.length === 0 ? "no_external_artifact_supplied" : "artifacts_supplied";
}

export function categorizePhase82EvidenceGapBlockers(
  blockingReasons: string[],
): Phase82EvidenceGapBlockerCategory[] {
  const categories = new Set<Phase82EvidenceGapBlockerCategory>();

  for (const reason of blockingReasons) {
    if (reason === "no evidence records supplied") {
      categories.add("no_records");
      categories.add("missing_evidence");
      continue;
    }
    if (reason.startsWith("missing required evidence:")) {
      categories.add("missing_evidence");
      continue;
    }
    if (reason.includes("not approved: conditional")) {
      categories.add("conditional");
      continue;
    }
    if (reason.includes("not approved: rejected")) {
      categories.add("rejected");
      continue;
    }
    if (reason.includes("not approved: draft")) {
      categories.add("draft");
      continue;
    }
    if (reason === "review due date is expired" || reason === "approval date is in the future") {
      categories.add("stale");
      continue;
    }
    if (reason === "approval artifact is expired") {
      categories.add("expired");
      continue;
    }
    if (reason === "artifact reference is not marked sanitized") {
      categories.add("unsanitized");
      continue;
    }
  }

  return [...categories];
}

export function buildPhase82ExternalEvidenceGapLedger(input: {
  evidenceRecords?: LaunchGateEvidenceRecord[];
  now?: string;
} = {}): Phase82ExternalEvidenceGapLedger {
  const evidenceRecords = input.evidenceRecords ?? [];
  const generatedAt = input.now ?? new Date().toISOString();
  const evaluation = evaluateProductionPilotLaunchGateEvidence(evidenceRecords, { now: generatedAt });
  const intakeStatus = resolvePhase82EvidenceIntakeStatus(evidenceRecords);

  const gateEntries = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => {
    const gateResult = evaluation.gateResults.find((result) => result.gateId === gate.id);
    const blockingReasons = gateResult?.blockingReasons ?? ["no evidence records supplied"];
    const missingEvidence =
      gateResult?.missingEvidence ??
      (gateResult?.status === "approved" ? [] : gate.requiredEvidence);

    return {
      gateId: gate.id,
      label: gate.label,
      status: gateResult?.status ?? "open",
      missingEvidence,
      sanitizedArtifactRefs: gateResult?.evidenceRefs ?? [],
      blockerCategories:
        gateResult?.status === "approved" ? [] : categorizePhase82EvidenceGapBlockers(blockingReasons),
      blockingReasons: gateResult?.status === "approved" ? [] : blockingReasons,
    };
  });

  return {
    phase82Version: PHASE_82B_VERSION,
    generatedAt,
    intakeStatus,
    evidenceRecordCount: evidenceRecords.length,
    externalArtifactsSupplied: evidenceRecords.length > 0,
    approvedGateIds: evaluation.approvedGateIds,
    openGateIds: evaluation.openGateIds,
    ignoredEvidenceGateIds: evaluation.ignoredEvidenceGateIds,
    allGatesOpen: evaluation.openGateIds.length === PRODUCTION_PILOT_LAUNCH_GATES.length,
    gateEntries,
  };
}

export function buildPhase82BaselineExternalEvidenceGapLedger(options: { now?: string } = {}) {
  return buildPhase82ExternalEvidenceGapLedger({
    evidenceRecords: [],
    now: options.now,
  });
}

export function summarizePhase82ExternalEvidenceGapLedger(ledger: Phase82ExternalEvidenceGapLedger) {
  return {
    phase82Version: ledger.phase82Version,
    intakeStatus: ledger.intakeStatus,
    evidenceRecordCount: ledger.evidenceRecordCount,
    externalArtifactsSupplied: ledger.externalArtifactsSupplied,
    approvedGateCount: ledger.approvedGateIds.length,
    openGateCount: ledger.openGateIds.length,
    allGatesOpen: ledger.allGatesOpen,
    ignoredEvidenceGateIds: ledger.ignoredEvidenceGateIds,
    gates: ledger.gateEntries.map((entry) => ({
      gateId: entry.gateId,
      status: entry.status,
      missingEvidenceCount: entry.missingEvidence.length,
      blockerCategories: entry.blockerCategories,
      sanitizedArtifactRefCount: entry.sanitizedArtifactRefs.length,
    })),
  };
}
