export const PHASE_81C_VERSION = "phase81-launch-authorization-evidence-v1";

export const PHASE_81C_MINIMUM_DIETITIAN_COUNT = 100;
export const PHASE_81C_MINIMUM_CLIENT_COUNT = 5000;

export type Phase81LaunchAuthorizationApprovalStatus =
  | "approved"
  | "conditional"
  | "rejected"
  | "draft";

export type Phase81LaunchAuthorizationEvidence = {
  artifactTitle?: string;
  artifactRef?: string;
  launchAuthorizationOwner?: string;
  approvalStatus?: Phase81LaunchAuthorizationApprovalStatus;
  approvedAt?: string | null;
  reviewDueAt?: string | null;
  expiresAt?: string | null;
  launchWindowStart?: string | null;
  launchWindowEnd?: string | null;
  rollbackOwner?: string;
  incidentCommander?: string;
  minimumDietitianCount?: number;
  minimumClientCount?: number;
  sanitizedReference?: boolean;
  sensitiveDetailsExternalOnly?: boolean;
};

export type Phase81LaunchAuthorizationIntakeStatus =
  | "no_authorization_supplied"
  | "authorization_supplied";

export type Phase81LaunchAuthorizationStatus =
  | "no_authorization_supplied"
  | "blocked"
  | "approved";

export type Phase81LaunchAuthorizationReport = {
  phase81Version: string;
  generatedAt: string;
  authorizationKind: "phase81_execution_authorization";
  isLaunchGate: false;
  intakeStatus: Phase81LaunchAuthorizationIntakeStatus;
  authorizationStatus: Phase81LaunchAuthorizationStatus;
  goReadyBlocked: boolean;
  productionPilotGoReady: false;
  productionPilotStarted: false;
  blockingReasons: string[];
};

export function evaluatePhase81cLaunchAuthorization(input: {
  evidence?: Phase81LaunchAuthorizationEvidence | null;
  now?: string;
}) {
  const now = new Date(input.now ?? new Date().toISOString());
  const evidence = input.evidence;

  if (!evidence) {
    return {
      intakeStatus: "no_authorization_supplied" as const,
      authorizationStatus: "no_authorization_supplied" as const,
      goReadyBlocked: true,
      blockingReasons: ["no Phase 81 launch authorization evidence supplied"],
    };
  }

  const blockingReasons: string[] = [];

  if (evidence.approvalStatus !== "approved") {
    blockingReasons.push(
      `launch authorization is not approved: ${evidence.approvalStatus ?? "missing"}`,
    );
  }
  if (!evidence.launchAuthorizationOwner?.trim()) {
    blockingReasons.push("missing launch authorization owner");
  }
  if (!evidence.artifactTitle?.trim()) {
    blockingReasons.push("missing launch authorization artifact title");
  }
  if (!evidence.artifactRef?.trim()) {
    blockingReasons.push("missing sanitized launch authorization artifact reference");
  }
  if (evidence.sanitizedReference !== true) {
    blockingReasons.push("launch authorization artifact reference is not marked sanitized");
  }
  if (evidence.sensitiveDetailsExternalOnly !== true) {
    blockingReasons.push(
      "launch authorization must confirm sensitive details live outside the repo",
    );
  }
  if (!evidence.rollbackOwner?.trim()) {
    blockingReasons.push("missing rollback owner");
  }
  if (!evidence.incidentCommander?.trim()) {
    blockingReasons.push("missing incident commander");
  }

  const approvedAt = parseRequiredDate(evidence.approvedAt, "approval timestamp", blockingReasons);
  if (approvedAt && approvedAt.getTime() > now.getTime()) {
    blockingReasons.push("approval timestamp is in the future");
  }

  const reviewDueAt = parseRequiredDate(evidence.reviewDueAt, "review due date", blockingReasons);
  if (reviewDueAt && reviewDueAt.getTime() < now.getTime()) {
    blockingReasons.push("launch authorization review due date is expired");
  }

  if (evidence.expiresAt) {
    const expiresAt = parseOptionalDate(evidence.expiresAt, "expiry date", blockingReasons);
    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      blockingReasons.push("launch authorization approval is expired");
    }
  }

  const launchWindowStart = parseRequiredDate(
    evidence.launchWindowStart,
    "launch window start",
    blockingReasons,
  );
  const launchWindowEnd = parseRequiredDate(
    evidence.launchWindowEnd,
    "launch window end",
    blockingReasons,
  );
  if (launchWindowStart && launchWindowEnd && launchWindowStart.getTime() > launchWindowEnd.getTime()) {
    blockingReasons.push("launch window start is after launch window end");
  }
  if (launchWindowStart && launchWindowEnd) {
    if (now.getTime() < launchWindowStart.getTime()) {
      blockingReasons.push("launch window is not active yet");
    }
    if (now.getTime() > launchWindowEnd.getTime()) {
      blockingReasons.push("launch window has ended");
    }
  }

  if (
    typeof evidence.minimumDietitianCount !== "number" ||
    evidence.minimumDietitianCount < PHASE_81C_MINIMUM_DIETITIAN_COUNT
  ) {
    blockingReasons.push(
      `minimum dietitian count must be at least ${PHASE_81C_MINIMUM_DIETITIAN_COUNT}`,
    );
  }
  if (
    typeof evidence.minimumClientCount !== "number" ||
    evidence.minimumClientCount < PHASE_81C_MINIMUM_CLIENT_COUNT
  ) {
    blockingReasons.push(
      `minimum client count must be at least ${PHASE_81C_MINIMUM_CLIENT_COUNT}`,
    );
  }

  const approved = blockingReasons.length === 0;

  return {
    intakeStatus: "authorization_supplied" as const,
    authorizationStatus: approved ? ("approved" as const) : ("blocked" as const),
    goReadyBlocked: !approved,
    blockingReasons,
  };
}

export function buildPhase81cLaunchAuthorizationReport(input: {
  evidence?: Phase81LaunchAuthorizationEvidence | null;
  now?: string;
}): Phase81LaunchAuthorizationReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const evaluation = evaluatePhase81cLaunchAuthorization({
    evidence: input.evidence,
    now: generatedAt,
  });

  return {
    phase81Version: PHASE_81C_VERSION,
    generatedAt,
    authorizationKind: "phase81_execution_authorization",
    isLaunchGate: false,
    intakeStatus: evaluation.intakeStatus,
    authorizationStatus: evaluation.authorizationStatus,
    goReadyBlocked: evaluation.goReadyBlocked,
    productionPilotGoReady: false,
    productionPilotStarted: false,
    blockingReasons: evaluation.blockingReasons,
  };
}

export function buildPhase81cBaselineAuthorizationReport(options: { now?: string } = {}) {
  return buildPhase81cLaunchAuthorizationReport({
    evidence: null,
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function buildCompletePhase81cLaunchAuthorizationEvidence(
  overrides: Partial<Phase81LaunchAuthorizationEvidence> = {},
): Phase81LaunchAuthorizationEvidence {
  return {
    artifactTitle: "Direct production pilot launch authorization",
    artifactRef: "external-review://phase81-launch-authorization",
    launchAuthorizationOwner: "External launch approver",
    approvalStatus: "approved",
    approvedAt: "2026-06-01T09:00:00.000Z",
    reviewDueAt: "2026-12-01T09:00:00.000Z",
    expiresAt: "2027-06-01T09:00:00.000Z",
    launchWindowStart: "2026-06-01T00:00:00.000Z",
    launchWindowEnd: "2026-12-31T23:59:59.000Z",
    rollbackOwner: "Operations rollback owner",
    incidentCommander: "Incident commander",
    minimumDietitianCount: PHASE_81C_MINIMUM_DIETITIAN_COUNT,
    minimumClientCount: PHASE_81C_MINIMUM_CLIENT_COUNT,
    sanitizedReference: true,
    sensitiveDetailsExternalOnly: true,
    ...overrides,
  };
}

export function summarizePhase81cLaunchAuthorizationReport(report: Phase81LaunchAuthorizationReport) {
  return {
    authorizationKind: report.authorizationKind,
    isLaunchGate: report.isLaunchGate,
    intakeStatus: report.intakeStatus,
    authorizationStatus: report.authorizationStatus,
    goReadyBlocked: report.goReadyBlocked,
    productionPilotGoReady: report.productionPilotGoReady,
    productionPilotStarted: report.productionPilotStarted,
    blockingReasonCount: report.blockingReasons.length,
  };
}

function parseRequiredDate(
  value: string | null | undefined,
  label: string,
  reasons: string[],
) {
  if (!value) {
    reasons.push(`missing ${label}`);
    return null;
  }
  return parseOptionalDate(value, label, reasons);
}

function parseOptionalDate(value: string, label: string, reasons: string[]) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    reasons.push(`invalid ${label}`);
    return null;
  }
  return parsed;
}
