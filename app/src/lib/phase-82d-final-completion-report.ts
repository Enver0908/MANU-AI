import type { LaunchGateId } from "./launch-gates";
import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";
import type { Phase80R405Status } from "./phase-80c-launch-gate-evidence-evaluation";
import type { Phase80FinalClosureReport } from "./phase-80f-final-readiness-decision";
import { buildPhase80fBaselineClosureReport } from "./phase-80f-final-readiness-decision";
import type { Phase81GoReadinessReport } from "./phase-81g-go-readiness-report";
import type { Phase81Outcome } from "./phase-81b-phase-80-eligibility";
import {
  buildEligiblePhase80ReportForPhase81g,
  buildPhase81gBaselineGoReadinessReport,
  buildPhase81gEligibleSyntheticGoReadinessReport,
} from "./phase-81g-go-readiness-report";
import {
  buildPhase82BaselineExternalEvidenceGapLedger,
  buildPhase82ExternalEvidenceGapLedger,
  type Phase82ExternalEvidenceGapLedger,
} from "./phase-82b-external-evidence-gap-ledger";
import {
  buildPhase82BaselineBlockerReconciliationReport,
  buildPhase82BlockerReconciliationReport,
  type Phase82BlockerReconciliationReport,
} from "./phase-82c-blocker-reconciliation";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateEvidenceRecord } from "./launch-gates";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import {
  buildPhase80dR405ClosureEvaluation,
} from "./phase-80d-r405-closure-evaluation";

export const PHASE_82D_VERSION = "phase82-final-completion-report-v1";

export type Phase82Outcome =
  | "NO_GO_EXTERNAL_PREREQUISITES_OPEN"
  | "NO_GO_VERIFICATION_BLOCKED"
  | "READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION";

export type Phase82FinalCompletionReport = {
  phase82Version: string;
  generatedAt: string;
  phase82Outcome: Phase82Outcome;
  repoLocalClosureComplete: boolean;
  productionPilotGo: false;
  productionPilotStarted: false;
  realProviderConnected: false;
  realChannelConnected: false;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  phase81Outcome: Phase81Outcome;
  blockingReasons: string[];
};

export function resolvePhase82Outcome(input: {
  phase80Report: Phase80FinalClosureReport;
  ledger: Phase82ExternalEvidenceGapLedger;
  blockerReport: Phase82BlockerReconciliationReport;
  phase81Report: Phase81GoReadinessReport;
}): Phase82Outcome {
  const externalPrerequisitesOpen =
    !isPhase80EligibleForPhase82(input.phase80Report) ||
    input.ledger.openGateIds.length > 0 ||
    input.blockerReport.r405Status === "open" ||
    input.blockerReport.r406CurrentRlsStatus !== "pass" ||
    input.phase81Report.phase81Outcome === "NO_GO_NOT_ELIGIBLE";

  if (externalPrerequisitesOpen) {
    return "NO_GO_EXTERNAL_PREREQUISITES_OPEN";
  }

  if (
    input.phase81Report.phase81Outcome === "NO_GO_PREFLIGHT_FAILED" ||
    input.blockerReport.finalReadinessBlocked
  ) {
    return "NO_GO_VERIFICATION_BLOCKED";
  }

  if (input.phase81Report.phase81Outcome === "GO_READY_FOR_EXTERNAL_EXECUTION") {
    return "READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION";
  }

  return "NO_GO_EXTERNAL_PREREQUISITES_OPEN";
}

export function collectPhase82BlockingReasons(input: {
  phase80Report: Phase80FinalClosureReport;
  ledger: Phase82ExternalEvidenceGapLedger;
  blockerReport: Phase82BlockerReconciliationReport;
  phase81Report: Phase81GoReadinessReport;
  phase82Outcome: Phase82Outcome;
}) {
  const reasons = new Set<string>();

  if (input.ledger.allGatesOpen) {
    reasons.add("no external approval artifacts supplied");
    reasons.add(`open launch gates remain: ${input.ledger.openGateIds.join(", ")}`);
  } else if (input.ledger.openGateIds.length > 0) {
    reasons.add(`open launch gates remain: ${input.ledger.openGateIds.join(", ")}`);
  }

  for (const reason of collectPhase80PrerequisiteBlockingReasons(input.phase80Report)) {
    reasons.add(reason);
  }
  for (const reason of input.blockerReport.blockingReasons) reasons.add(reason);
  for (const reason of input.phase81Report.blockingReasons) reasons.add(reason);

  if (input.phase82Outcome === "NO_GO_EXTERNAL_PREREQUISITES_OPEN") {
    reasons.add("final external readiness prerequisites remain open");
  }
  if (input.phase82Outcome === "NO_GO_VERIFICATION_BLOCKED") {
    reasons.add("refreshed verification or preflight evidence blocks final readiness");
  }

  return [...reasons];
}

export function buildPhase82FinalCompletionReport(input: {
  phase80Report: Phase80FinalClosureReport;
  phase81Report: Phase81GoReadinessReport;
  ledger: Phase82ExternalEvidenceGapLedger;
  blockerReport: Phase82BlockerReconciliationReport;
  now?: string;
}): Phase82FinalCompletionReport {
  const generatedAt = input.now ?? input.phase81Report.generatedAt;
  const phase82Outcome = resolvePhase82Outcome({
    phase80Report: input.phase80Report,
    ledger: input.ledger,
    blockerReport: input.blockerReport,
    phase81Report: input.phase81Report,
  });

  return {
    phase82Version: PHASE_82D_VERSION,
    generatedAt,
    phase82Outcome,
    repoLocalClosureComplete:
      phase82Outcome === "READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION",
    productionPilotGo: false,
    productionPilotStarted: false,
    realProviderConnected: false,
    realChannelConnected: false,
    approvedGateIds: input.ledger.approvedGateIds,
    openGateIds: input.ledger.openGateIds,
    r405Status: input.blockerReport.r405Status,
    r406CurrentRlsStatus: input.blockerReport.r406CurrentRlsStatus,
    phase81Outcome: input.phase81Report.phase81Outcome,
    blockingReasons: collectPhase82BlockingReasons({
      phase80Report: input.phase80Report,
      ledger: input.ledger,
      blockerReport: input.blockerReport,
      phase81Report: input.phase81Report,
      phase82Outcome,
    }),
  };
}

function isPhase80EligibleForPhase82(report: Phase80FinalClosureReport) {
  return (
    report.phase80Outcome === "PHASE_81_ELIGIBLE" &&
    report.productionPilotDecision === "PHASE_81_ELIGIBLE" &&
    report.productionPilotGo === false &&
    report.phase81StartEligible === true &&
    report.openGateIds.length === 0 &&
    report.r405Status !== "open" &&
    report.r406CurrentRlsStatus === "pass"
  );
}

function collectPhase80PrerequisiteBlockingReasons(report: Phase80FinalClosureReport) {
  const reasons = new Set<string>();

  if (report.phase80Outcome !== "PHASE_81_ELIGIBLE") {
    reasons.add(`phase 80 outcome is ${report.phase80Outcome}, expected PHASE_81_ELIGIBLE`);
  }
  if (report.productionPilotDecision !== "PHASE_81_ELIGIBLE") {
    reasons.add(
      `phase 80 production pilot decision is ${report.productionPilotDecision}, expected PHASE_81_ELIGIBLE`,
    );
  }
  if (report.phase81StartEligible !== true) {
    reasons.add("phase 80 does not allow Phase 81 start");
  }
  if (report.openGateIds.length > 0) {
    reasons.add(`phase 80 open launch gates remain: ${report.openGateIds.join(", ")}`);
  }
  if (report.r405Status === "open") {
    reasons.add("phase 80 R-405 status remains open");
  }
  if (report.r406CurrentRlsStatus !== "pass") {
    reasons.add(`phase 80 R-406 current RLS status is ${report.r406CurrentRlsStatus}, expected pass`);
  }
  for (const reason of report.blockingReasons) reasons.add(reason);

  return [...reasons];
}

export function buildPhase82BaselineFinalCompletionReport(options: { now?: string } = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  const phase80Report = buildPhase80fBaselineClosureReport({ now });
  const phase81Report = buildPhase81gBaselineGoReadinessReport({ now });
  const ledger = buildPhase82BaselineExternalEvidenceGapLedger({ now });
  const blockerReport = buildPhase82BaselineBlockerReconciliationReport({ now });

  return buildPhase82FinalCompletionReport({
    phase80Report,
    phase81Report,
    ledger,
    blockerReport,
    now,
  });
}

export function buildPhase82EligibleSyntheticFinalCompletionReport(options: { now?: string } = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  const phase80Report = buildEligiblePhase80ReportForPhase81g(now);
  const phase81Report = buildPhase81gEligibleSyntheticGoReadinessReport({ now });
  const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildLaunchGateEvidenceRecord(gate));
  const ledger = buildPhase82ExternalEvidenceGapLedger({ evidenceRecords: evidence, now });
  const blockerReport = buildPhase82BlockerReconciliationReport({
    r405Evaluation: buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.3.0",
      nestedPostcssVersion: "8.5.10",
      eslintConfigNextLatestVersion: "16.3.0",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now,
    }),
    r406Evidence: buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Tests  20 passed (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    }),
    now,
  });

  return buildPhase82FinalCompletionReport({
    phase80Report,
    phase81Report,
    ledger,
    blockerReport,
    now,
  });
}

export function summarizePhase82FinalCompletionReport(report: Phase82FinalCompletionReport) {
  return {
    phase82Outcome: report.phase82Outcome,
    repoLocalClosureComplete: report.repoLocalClosureComplete,
    productionPilotGo: report.productionPilotGo,
    productionPilotStarted: report.productionPilotStarted,
    realProviderConnected: report.realProviderConnected,
    realChannelConnected: report.realChannelConnected,
    approvedGateCount: report.approvedGateIds.length,
    openGateCount: report.openGateIds.length,
    r405Status: report.r405Status,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    phase81Outcome: report.phase81Outcome,
    blockingReasonCount: report.blockingReasons.length,
  };
}

function buildLaunchGateEvidenceRecord(
  gate: (typeof PRODUCTION_PILOT_LAUNCH_GATES)[number],
  overrides: Partial<LaunchGateEvidenceRecord> = {},
): LaunchGateEvidenceRecord {
  return {
    gateId: gate.id,
    artifactTitle: `${gate.label} approval`,
    artifactRef: `external-review://${gate.id}`,
    owner: "External reviewer",
    approvalStatus: "approved",
    approvedAt: "2026-06-01T09:00:00.000Z",
    reviewDueAt: "2026-12-01T09:00:00.000Z",
    expiresAt: "2027-06-01T09:00:00.000Z",
    coveredEvidence: gate.requiredEvidence,
    sanitizedReference: true,
    ...overrides,
  };
}

export function buildPhase82VerificationBlockedSyntheticFinalCompletionReport(input: {
  phase81Report: Phase81GoReadinessReport;
  now?: string;
}) {
  const now = input.now ?? "2026-06-30T12:00:00.000Z";
  const phase80Report = buildEligiblePhase80ReportForPhase81g(now);
  const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildLaunchGateEvidenceRecord(gate));
  const ledger = buildPhase82ExternalEvidenceGapLedger({ evidenceRecords: evidence, now });
  const blockerReport = buildPhase82BlockerReconciliationReport({
    r405Evaluation: buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.3.0",
      nestedPostcssVersion: "8.5.10",
      eslintConfigNextLatestVersion: "16.3.0",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now,
    }),
    r406Evidence: buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Tests  20 passed (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    }),
    now,
  });

  return buildPhase82FinalCompletionReport({
    phase80Report,
    phase81Report: input.phase81Report,
    ledger,
    blockerReport,
    now,
  });
}
