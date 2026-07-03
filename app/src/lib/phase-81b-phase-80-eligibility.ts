import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";
import type { Phase80R405Status } from "./phase-80c-launch-gate-evidence-evaluation";
import {
  buildPhase80fBaselineClosureReport,
  type Phase80FinalClosureReport,
  type Phase80Outcome,
} from "./phase-80f-final-readiness-decision";

export const PHASE_81B_VERSION = "phase81-phase-80-eligibility-v1";

export type Phase81Outcome =
  | "NO_GO_NOT_ELIGIBLE"
  | "NO_GO_PREFLIGHT_FAILED"
  | "GO_READY_FOR_EXTERNAL_EXECUTION";

export type Phase81EligibilityStatus = "blocked_not_eligible" | "eligible_for_preflight";

export type Phase81EligibilityReport = {
  phase81Version: string;
  generatedAt: string;
  eligibilityStatus: Phase81EligibilityStatus;
  phase81Outcome: "NO_GO_NOT_ELIGIBLE" | null;
  productionPilotGoReady: false;
  productionPilotStarted: false;
  phase80Outcome: Phase80Outcome;
  productionPilotDecision: Phase80FinalClosureReport["productionPilotDecision"];
  productionPilotGo: false;
  phase81StartEligible: boolean;
  openGateCount: number;
  approvedGateCount: number;
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  blockingReasons: string[];
};

function isR405AcceptableForPhase81(status: Phase80R405Status) {
  return status === "technically_resolved" || status === "formally_accepted";
}

export function evaluatePhase81bEligibilityFromPhase80(phase80: Phase80FinalClosureReport) {
  const blockingReasons: string[] = [];

  if (phase80.phase80Outcome !== "PHASE_81_ELIGIBLE") {
    blockingReasons.push(
      `phase80Outcome is ${phase80.phase80Outcome}, expected PHASE_81_ELIGIBLE`,
    );
  }
  if (phase80.productionPilotDecision !== "PHASE_81_ELIGIBLE") {
    blockingReasons.push(
      `productionPilotDecision is ${phase80.productionPilotDecision}, expected PHASE_81_ELIGIBLE`,
    );
  }
  if (phase80.productionPilotGo !== false) {
    blockingReasons.push("productionPilotGo must remain false");
  }
  if (phase80.phase81StartEligible !== true) {
    blockingReasons.push("phase81StartEligible must be true");
  }
  if (phase80.openGateIds.length > 0) {
    blockingReasons.push(`open launch gates remain: ${phase80.openGateIds.join(", ")}`);
  }
  if (!isR405AcceptableForPhase81(phase80.r405Status)) {
    blockingReasons.push(
      `R-405 status is ${phase80.r405Status}, expected technically_resolved or formally_accepted`,
    );
  }
  if (phase80.r406CurrentRlsStatus !== "pass") {
    blockingReasons.push(
      `current RLS status is ${phase80.r406CurrentRlsStatus}, expected pass`,
    );
  }

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function buildPhase81bEligibilityReport(input: {
  phase80Report: Phase80FinalClosureReport;
  now?: string;
}): Phase81EligibilityReport {
  const evaluation = evaluatePhase81bEligibilityFromPhase80(input.phase80Report);

  return {
    phase81Version: PHASE_81B_VERSION,
    generatedAt: input.now ?? input.phase80Report.generatedAt,
    eligibilityStatus: evaluation.eligible ? "eligible_for_preflight" : "blocked_not_eligible",
    phase81Outcome: evaluation.eligible ? null : "NO_GO_NOT_ELIGIBLE",
    productionPilotGoReady: false,
    productionPilotStarted: false,
    phase80Outcome: input.phase80Report.phase80Outcome,
    productionPilotDecision: input.phase80Report.productionPilotDecision,
    productionPilotGo: false,
    phase81StartEligible: input.phase80Report.phase81StartEligible,
    openGateCount: input.phase80Report.openGateIds.length,
    approvedGateCount: input.phase80Report.approvedGateIds.length,
    r405Status: input.phase80Report.r405Status,
    r406CurrentRlsStatus: input.phase80Report.r406CurrentRlsStatus,
    blockingReasons: evaluation.blockingReasons,
  };
}

export function buildPhase81bBaselineEligibilityReport(options: { now?: string } = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  return buildPhase81bEligibilityReport({
    phase80Report: buildPhase80fBaselineClosureReport({ now }),
    now,
  });
}

export function summarizePhase81bEligibilityReport(report: Phase81EligibilityReport) {
  return {
    eligibilityStatus: report.eligibilityStatus,
    phase81Outcome: report.phase81Outcome,
    productionPilotGoReady: report.productionPilotGoReady,
    productionPilotStarted: report.productionPilotStarted,
    phase80Outcome: report.phase80Outcome,
    productionPilotDecision: report.productionPilotDecision,
    phase81StartEligible: report.phase81StartEligible,
    openGateCount: report.openGateCount,
    approvedGateCount: report.approvedGateCount,
    r405Status: report.r405Status,
    r406CurrentRlsStatus: report.r406CurrentRlsStatus,
    blockingReasonCount: report.blockingReasons.length,
  };
}
