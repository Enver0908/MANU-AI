import type { LaunchGateId } from "./launch-gates";
import type { Phase79CurrentRlsEvidence } from "./phase-79f-current-rls-evidence";
import type { Phase80R405Status } from "./phase-80c-launch-gate-evidence-evaluation";
import {
  buildPhase80fBaselineClosureReport,
  buildPhase80fFinalClosureReport,
  type Phase80FinalClosureReport,
} from "./phase-80f-final-readiness-decision";
import { PRODUCTION_PILOT_LAUNCH_GATES, type LaunchGateEvidenceRecord } from "./launch-gates";
import { buildPhase79fEvidenceFromRunResult } from "./phase-79f-current-rls-evidence";
import { buildPhase80dR405ClosureEvaluation } from "./phase-80d-r405-closure-evaluation";
import { buildPhase80eCurrentRlsEvidenceReport } from "./phase-80e-current-rls-evidence";
import {
  buildPhase81bEligibilityReport,
  type Phase81EligibilityReport,
  type Phase81Outcome,
} from "./phase-81b-phase-80-eligibility";
import {
  buildCompletePhase81cLaunchAuthorizationEvidence,
  buildPhase81cBaselineAuthorizationReport,
  buildPhase81cLaunchAuthorizationReport,
  type Phase81LaunchAuthorizationReport,
} from "./phase-81c-launch-authorization-evidence";
import {
  buildCompletePhase81dEnvironmentPreflightInput,
  buildPhase81dBaselineEnvironmentPreflightReport,
  buildPhase81dEnvironmentPreflightReport,
  type Phase81EnvironmentPreflightReport,
} from "./phase-81d-environment-preflight";
import {
  buildCompletePhase81eRosterQualificationAggregate,
  buildPhase81eBaselineRosterQualificationReport,
  buildPhase81eRosterQualificationReport,
  type Phase81RosterQualificationReport,
} from "./phase-81e-roster-qualification";
import {
  buildPhase81fBaselineVerificationRefreshReport,
  buildPhase81fSyntheticPassedVerificationRefreshReport,
  type Phase81VerificationRefreshReport,
} from "./phase-81f-verification-refresh";

export const PHASE_81G_VERSION = "phase81-go-readiness-report-v1";

export type Phase81RehearsalStatus = "blocked" | "ready";

export type Phase81RehearsalEvidenceReport = Phase81VerificationRefreshReport & {
  rehearsalStatus: Phase81RehearsalStatus;
  r405Status: Phase80R405Status;
};

export type Phase81GoReadinessReport = {
  phase81Version: string;
  generatedAt: string;
  phase81Outcome: Phase81Outcome;
  productionPilotGoReady: boolean;
  productionPilotStarted: false;
  realProviderConnected: false;
  realChannelConnected: false;
  approvedGateIds: LaunchGateId[];
  r405Status: Phase80R405Status;
  r406CurrentRlsStatus: Phase79CurrentRlsEvidence["status"];
  authorizationStatus: Phase81LaunchAuthorizationReport["authorizationStatus"];
  environmentPreflightStatus: Phase81EnvironmentPreflightReport["preflightStatus"];
  rosterQualificationStatus: Phase81RosterQualificationReport["qualificationStatus"];
  rehearsalStatus: Phase81RehearsalStatus;
  blockingReasons: string[];
  aggregateEvidenceMetrics: {
    dietitianCount: number;
    clientCount: number;
    autopilotCandidateCount: number;
    openGateCount: number;
    approvedGateCount: number;
    targetedPhase81TestsPassed: number;
    coreTestCount: number;
    appTestPassedCount: number;
    appTestSkippedCount: number;
  };
};

export function buildPhase81gBaselineRehearsalEvidenceReport(options: { now?: string } = {}) {
  const refresh = buildPhase81fBaselineVerificationRefreshReport(options);
  return {
    ...refresh,
    rehearsalStatus: refresh.verificationStatus === "passed" ? ("ready" as const) : ("blocked" as const),
    r405Status: "open" as const,
  } satisfies Phase81RehearsalEvidenceReport;
}

export function buildPhase81gEligibleRehearsalEvidenceReport(options: { now?: string } = {}) {
  const refresh = buildPhase81fSyntheticPassedVerificationRefreshReport(options);
  return {
    ...refresh,
    rehearsalStatus: "ready" as const,
    r405Status: "technically_resolved" as const,
  } satisfies Phase81RehearsalEvidenceReport;
}

export function resolvePhase81gOutcome(input: {
  eligibility: Phase81EligibilityReport;
  authorization: Phase81LaunchAuthorizationReport;
  preflight: Phase81EnvironmentPreflightReport;
  roster: Phase81RosterQualificationReport;
  rehearsal: Phase81RehearsalEvidenceReport;
}): Phase81Outcome {
  if (input.eligibility.eligibilityStatus === "blocked_not_eligible") {
    return "NO_GO_NOT_ELIGIBLE";
  }

  const preflightFailed =
    input.authorization.goReadyBlocked ||
    input.preflight.goReadyBlocked ||
    input.roster.goReadyBlocked ||
    input.rehearsal.goReadyBlocked;

  if (preflightFailed) {
    return "NO_GO_PREFLIGHT_FAILED";
  }

  return "GO_READY_FOR_EXTERNAL_EXECUTION";
}

export function collectPhase81gBlockingReasons(input: {
  eligibility: Phase81EligibilityReport;
  authorization: Phase81LaunchAuthorizationReport;
  preflight: Phase81EnvironmentPreflightReport;
  roster: Phase81RosterQualificationReport;
  rehearsal: Phase81RehearsalEvidenceReport;
}) {
  const reasons = new Set<string>();

  for (const reason of input.eligibility.blockingReasons) reasons.add(reason);
  for (const reason of input.authorization.blockingReasons) reasons.add(reason);
  for (const reason of input.preflight.blockingReasons) reasons.add(reason);
  for (const reason of input.roster.blockingReasons) reasons.add(reason);
  for (const reason of input.rehearsal.blockingReasons) reasons.add(reason);

  const outcome = resolvePhase81gOutcome(input);
  if (outcome === "NO_GO_NOT_ELIGIBLE") {
    reasons.add("phase 81 eligibility hard stop is active");
  }
  if (outcome === "NO_GO_PREFLIGHT_FAILED") {
    reasons.add("phase 81 preflight or verification evidence failed");
  }

  return [...reasons];
}

export function buildPhase81gGoReadinessReport(input: {
  phase80Report: Phase80FinalClosureReport;
  authorization: Phase81LaunchAuthorizationReport;
  preflight: Phase81EnvironmentPreflightReport;
  roster: Phase81RosterQualificationReport;
  rehearsal: Phase81RehearsalEvidenceReport;
  now?: string;
}): Phase81GoReadinessReport {
  const generatedAt = input.now ?? input.phase80Report.generatedAt;
  const eligibility = buildPhase81bEligibilityReport({
    phase80Report: input.phase80Report,
    now: generatedAt,
  });
  const phase81Outcome = resolvePhase81gOutcome({
    eligibility,
    authorization: input.authorization,
    preflight: input.preflight,
    roster: input.roster,
    rehearsal: input.rehearsal,
  });

  return {
    phase81Version: PHASE_81G_VERSION,
    generatedAt,
    phase81Outcome,
    productionPilotGoReady: phase81Outcome === "GO_READY_FOR_EXTERNAL_EXECUTION",
    productionPilotStarted: false,
    realProviderConnected: false,
    realChannelConnected: false,
    approvedGateIds: input.phase80Report.approvedGateIds,
    r405Status: input.phase80Report.r405Status,
    r406CurrentRlsStatus: input.phase80Report.r406CurrentRlsStatus,
    authorizationStatus: input.authorization.authorizationStatus,
    environmentPreflightStatus: input.preflight.preflightStatus,
    rosterQualificationStatus: input.roster.qualificationStatus,
    rehearsalStatus: input.rehearsal.rehearsalStatus,
    blockingReasons: collectPhase81gBlockingReasons({
      eligibility,
      authorization: input.authorization,
      preflight: input.preflight,
      roster: input.roster,
      rehearsal: input.rehearsal,
    }),
    aggregateEvidenceMetrics: {
      dietitianCount: input.roster.metrics.dietitianCount,
      clientCount: input.roster.metrics.clientCount,
      autopilotCandidateCount: input.roster.metrics.autopilotCandidateCount,
      openGateCount: eligibility.openGateCount,
      approvedGateCount: eligibility.approvedGateCount,
      targetedPhase81TestsPassed: input.rehearsal.verificationSummary.targetedPhase81TestsPassed,
      coreTestCount: input.rehearsal.verificationSummary.coreTestCount,
      appTestPassedCount: input.rehearsal.verificationSummary.appTestPassedCount,
      appTestSkippedCount: input.rehearsal.verificationSummary.appTestSkippedCount,
    },
  };
}

export function buildPhase81gBaselineGoReadinessReport(options: { now?: string } = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  const phase80Report = buildPhase80fBaselineClosureReport({ now });

  return buildPhase81gGoReadinessReport({
    phase80Report,
    authorization: buildPhase81cBaselineAuthorizationReport({ now }),
    preflight: buildPhase81dBaselineEnvironmentPreflightReport({ now }),
    roster: buildPhase81eBaselineRosterQualificationReport({ now }),
    rehearsal: buildPhase81gBaselineRehearsalEvidenceReport({ now }),
    now,
  });
}

export function buildEligiblePhase80ReportForPhase81g(now: string) {
  const evidence = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => buildLaunchGateEvidenceRecord(gate));
  return buildPhase80fFinalClosureReport({
    evidenceRecords: evidence,
    now,
    r405Evaluation: buildPhase80dR405ClosureEvaluation({
      nextLatestVersion: "16.3.0",
      nestedPostcssVersion: "8.5.10",
      eslintConfigNextLatestVersion: "16.3.0",
      productionAuditFindings: [],
      dependencyFilesChanged: true,
      technicallyRemediated: true,
      now,
    }),
    rlsEvidenceReport: buildPhase80eCurrentRlsEvidenceReport({
      evidence: buildPhase79fEvidenceFromRunResult({
        exitCode: 0,
        output: "Tests  20 passed (20)",
        localSupabaseAvailable: true,
        runAttempted: true,
      }),
      generatedAt: now,
      runAttempted: true,
    }),
  });
}

export function buildPhase81gEligibleSyntheticGoReadinessReport(options: { now?: string } = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  const phase80Report = buildEligiblePhase80ReportForPhase81g(now);

  return buildPhase81gGoReadinessReport({
    phase80Report,
    authorization: buildPhase81cLaunchAuthorizationReport({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence(),
      now,
    }),
    preflight: buildPhase81dEnvironmentPreflightReport({
      preflight: buildCompletePhase81dEnvironmentPreflightInput(),
      now,
    }),
    roster: buildPhase81eRosterQualificationReport({
      aggregate: buildCompletePhase81eRosterQualificationAggregate(),
      now,
    }),
    rehearsal: buildPhase81gEligibleRehearsalEvidenceReport({ now }),
    now,
  });
}

export function summarizePhase81gGoReadinessReport(report: Phase81GoReadinessReport) {
  return {
    phase81Outcome: report.phase81Outcome,
    productionPilotGoReady: report.productionPilotGoReady,
    productionPilotStarted: report.productionPilotStarted,
    realProviderConnected: report.realProviderConnected,
    realChannelConnected: report.realChannelConnected,
    authorizationStatus: report.authorizationStatus,
    environmentPreflightStatus: report.environmentPreflightStatus,
    rosterQualificationStatus: report.rosterQualificationStatus,
    rehearsalStatus: report.rehearsalStatus,
    aggregateEvidenceMetrics: report.aggregateEvidenceMetrics,
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
