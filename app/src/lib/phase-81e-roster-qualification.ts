import {
  PHASE_81C_MINIMUM_CLIENT_COUNT,
  PHASE_81C_MINIMUM_DIETITIAN_COUNT,
} from "./phase-81c-launch-authorization-evidence";

export const PHASE_81E_VERSION = "phase81-roster-qualification-v1";

export type Phase81RosterQualificationAggregate = {
  dietitianCount: number;
  clientCount: number;
  clientsWithChannelPermissionReady: number;
  clientsWithAmbiguousIdentity: number;
  clientsWithUnresolvedAdultGuardianStatus: number;
  clientsWithMissingSafetyFields: number;
  clientsNotReadyForMenuFormProfile: number;
  autopilotCandidateCount: number;
  optOutClientCount: number;
  removedClientCount: number;
  redLockedClientCount: number;
  yellowHeldClientCount: number;
  aggregateEvidenceOnly: boolean;
};

export const PHASE_81E_ALLOWED_AGGREGATE_KEYS: Array<keyof Phase81RosterQualificationAggregate> = [
  "dietitianCount",
  "clientCount",
  "clientsWithChannelPermissionReady",
  "clientsWithAmbiguousIdentity",
  "clientsWithUnresolvedAdultGuardianStatus",
  "clientsWithMissingSafetyFields",
  "clientsNotReadyForMenuFormProfile",
  "autopilotCandidateCount",
  "optOutClientCount",
  "removedClientCount",
  "redLockedClientCount",
  "yellowHeldClientCount",
  "aggregateEvidenceOnly",
];

export type Phase81RosterQualificationStatus = "blocked" | "qualified";

export type Phase81RosterQualificationReport = {
  phase81Version: string;
  generatedAt: string;
  qualificationStatus: Phase81RosterQualificationStatus;
  goReadyBlocked: boolean;
  productionPilotGoReady: false;
  productionPilotStarted: false;
  aggregateEvidenceOnly: boolean;
  metrics: Pick<
    Phase81RosterQualificationAggregate,
    | "dietitianCount"
    | "clientCount"
    | "autopilotCandidateCount"
    | "optOutClientCount"
    | "removedClientCount"
    | "redLockedClientCount"
    | "yellowHeldClientCount"
    | "clientsWithAmbiguousIdentity"
    | "clientsWithMissingSafetyFields"
  >;
  blockingReasons: string[];
};

function detectForbiddenRosterEvidenceFields(aggregate: Record<string, unknown>) {
  const blockingReasons: string[] = [];
  for (const key of Object.keys(aggregate)) {
    if (!PHASE_81E_ALLOWED_AGGREGATE_KEYS.includes(key as keyof Phase81RosterQualificationAggregate)) {
      blockingReasons.push(`forbidden roster evidence field: ${key}`);
    }
  }
  return blockingReasons;
}

function detectRawDataPatterns(serialized: string) {
  const blockingReasons: string[] = [];
  if (/\+90\d{10}/.test(serialized)) {
    blockingReasons.push("raw phone pattern detected in roster evidence");
  }
  if (/"message"\s*:/.test(serialized) || /"healthProfile"\s*:/.test(serialized)) {
    blockingReasons.push("raw message or health detail field detected in roster evidence");
  }
  return blockingReasons;
}

export function evaluatePhase81eRosterQualification(
  aggregate: Phase81RosterQualificationAggregate,
) {
  const blockingReasons = [
    ...detectForbiddenRosterEvidenceFields(aggregate as Record<string, unknown>),
    ...detectRawDataPatterns(JSON.stringify(aggregate)),
  ];

  if (aggregate.aggregateEvidenceOnly !== true) {
    blockingReasons.push("roster evidence must be aggregate-only");
  }
  if (aggregate.dietitianCount < PHASE_81C_MINIMUM_DIETITIAN_COUNT) {
    blockingReasons.push(
      `dietitian count must be at least ${PHASE_81C_MINIMUM_DIETITIAN_COUNT}`,
    );
  }
  if (aggregate.clientCount < PHASE_81C_MINIMUM_CLIENT_COUNT) {
    blockingReasons.push(`client count must be at least ${PHASE_81C_MINIMUM_CLIENT_COUNT}`);
  }
  if (aggregate.clientsWithChannelPermissionReady !== aggregate.clientCount) {
    blockingReasons.push("every client must have channel permission ready");
  }
  if (aggregate.clientsWithAmbiguousIdentity > 0) {
    blockingReasons.push("ambiguous identity clients must be excluded from launch roster");
  }
  if (aggregate.clientsWithUnresolvedAdultGuardianStatus > 0) {
    blockingReasons.push("adult/guardian status must be resolved for every client");
  }
  if (aggregate.clientsWithMissingSafetyFields > 0) {
    blockingReasons.push("required safety fields must be complete for every client");
  }
  if (aggregate.clientsNotReadyForMenuFormProfile > 0) {
    blockingReasons.push("menu/form/profile readiness must be complete where applicable");
  }
  if (aggregate.autopilotCandidateCount <= 0) {
    blockingReasons.push("autopilot candidates must be explicitly declared");
  }
  if (aggregate.autopilotCandidateCount >= aggregate.clientCount) {
    blockingReasons.push("autopilot candidates must be a strict subset of all clients");
  }

  const maxAutopilotCandidates =
    aggregate.clientCount -
    aggregate.optOutClientCount -
    aggregate.removedClientCount -
    aggregate.redLockedClientCount -
    aggregate.yellowHeldClientCount -
    aggregate.clientsWithAmbiguousIdentity;

  if (aggregate.autopilotCandidateCount > maxAutopilotCandidates) {
    blockingReasons.push("autopilot candidates include excluded client categories");
  }

  const qualified = blockingReasons.length === 0;

  return {
    qualificationStatus: qualified ? ("qualified" as const) : ("blocked" as const),
    goReadyBlocked: !qualified,
    blockingReasons,
  };
}

export function buildPhase81eRosterQualificationReport(input: {
  aggregate: Phase81RosterQualificationAggregate;
  now?: string;
}): Phase81RosterQualificationReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const evaluation = evaluatePhase81eRosterQualification(input.aggregate);

  return {
    phase81Version: PHASE_81E_VERSION,
    generatedAt,
    qualificationStatus: evaluation.qualificationStatus,
    goReadyBlocked: evaluation.goReadyBlocked,
    productionPilotGoReady: false,
    productionPilotStarted: false,
    aggregateEvidenceOnly: input.aggregate.aggregateEvidenceOnly === true,
    metrics: {
      dietitianCount: input.aggregate.dietitianCount,
      clientCount: input.aggregate.clientCount,
      autopilotCandidateCount: input.aggregate.autopilotCandidateCount,
      optOutClientCount: input.aggregate.optOutClientCount,
      removedClientCount: input.aggregate.removedClientCount,
      redLockedClientCount: input.aggregate.redLockedClientCount,
      yellowHeldClientCount: input.aggregate.yellowHeldClientCount,
      clientsWithAmbiguousIdentity: input.aggregate.clientsWithAmbiguousIdentity,
      clientsWithMissingSafetyFields: input.aggregate.clientsWithMissingSafetyFields,
    },
    blockingReasons: evaluation.blockingReasons,
  };
}

export function buildPhase81eBaselineRosterQualificationAggregate(): Phase81RosterQualificationAggregate {
  return {
    dietitianCount: 0,
    clientCount: 0,
    clientsWithChannelPermissionReady: 0,
    clientsWithAmbiguousIdentity: 0,
    clientsWithUnresolvedAdultGuardianStatus: 0,
    clientsWithMissingSafetyFields: 0,
    clientsNotReadyForMenuFormProfile: 0,
    autopilotCandidateCount: 0,
    optOutClientCount: 0,
    removedClientCount: 0,
    redLockedClientCount: 0,
    yellowHeldClientCount: 0,
    aggregateEvidenceOnly: true,
  };
}

export function buildPhase81eBaselineRosterQualificationReport(options: { now?: string } = {}) {
  return buildPhase81eRosterQualificationReport({
    aggregate: buildPhase81eBaselineRosterQualificationAggregate(),
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function buildCompletePhase81eRosterQualificationAggregate(
  overrides: Partial<Phase81RosterQualificationAggregate> = {},
): Phase81RosterQualificationAggregate {
  return {
    dietitianCount: PHASE_81C_MINIMUM_DIETITIAN_COUNT,
    clientCount: PHASE_81C_MINIMUM_CLIENT_COUNT,
    clientsWithChannelPermissionReady: PHASE_81C_MINIMUM_CLIENT_COUNT,
    clientsWithAmbiguousIdentity: 0,
    clientsWithUnresolvedAdultGuardianStatus: 0,
    clientsWithMissingSafetyFields: 0,
    clientsNotReadyForMenuFormProfile: 0,
    autopilotCandidateCount: 2500,
    optOutClientCount: 120,
    removedClientCount: 30,
    redLockedClientCount: 45,
    yellowHeldClientCount: 80,
    aggregateEvidenceOnly: true,
    ...overrides,
  };
}

export function summarizePhase81eRosterQualificationReport(
  report: Phase81RosterQualificationReport,
) {
  return {
    qualificationStatus: report.qualificationStatus,
    goReadyBlocked: report.goReadyBlocked,
    productionPilotGoReady: report.productionPilotGoReady,
    productionPilotStarted: report.productionPilotStarted,
    aggregateEvidenceOnly: report.aggregateEvidenceOnly,
    metrics: report.metrics,
    blockingReasonCount: report.blockingReasons.length,
  };
}
