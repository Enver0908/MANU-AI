import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  type LaunchGateId,
} from "./launch-gates";

export const PHASE_81D_VERSION = "phase81-environment-preflight-v1";

const PHASE_81D_OPS_GATE_IDS: LaunchGateId[] = [
  "incident_response_runbook",
  "backup_restore_test",
  "secret_rotation_plan",
];

export type Phase81EnvironmentPreflightInput = {
  productionEnvIdentity?: string;
  secretValuesExposed?: boolean;
  allowRealZaiFlag?: string;
  allowRealWhatsappFlag?: string;
  allowRealTelegramFlag?: string;
  approvedGateIds?: LaunchGateId[];
  launchAuthorizationApproved?: boolean;
  webhookApprovedExternalEvidence?: boolean;
  globalRollbackControlDeclared?: boolean;
  globalAutopilotEnablement?: boolean;
};

export type Phase81EnvironmentPreflightChecks = {
  productionEnvIdentityDeclared: boolean;
  secretsNotExposed: boolean;
  allLaunchGatesApproved: boolean;
  launchAuthorizationApproved: boolean;
  opsGatesApproved: boolean;
  webhookApprovedExternalEvidence: boolean;
  globalRollbackControlDeclared: boolean;
  conservativeClientAiPosture: boolean;
  realZaiEgressAllowed: boolean;
  realWhatsappEgressAllowed: boolean;
  realTelegramEgressAllowed: boolean;
};

export type Phase81EnvironmentPreflightStatus = "blocked" | "ready";

export type Phase81EnvironmentPreflightReport = {
  phase81Version: string;
  generatedAt: string;
  preflightMode: "dry_run_only";
  preflightStatus: Phase81EnvironmentPreflightStatus;
  goReadyBlocked: boolean;
  productionPilotGoReady: false;
  productionPilotStarted: false;
  checks: Phase81EnvironmentPreflightChecks;
  blockingReasons: string[];
};

function hasApprovedGate(approvedGateIds: LaunchGateId[], gateId: LaunchGateId) {
  return approvedGateIds.includes(gateId);
}

function resolveRealZaiEgressAllowed(input: {
  allowRealZaiFlag?: string;
  approvedGateIds: LaunchGateId[];
}) {
  if (input.allowRealZaiFlag !== "true") {
    return false;
  }
  return (
    hasApprovedGate(input.approvedGateIds, "legal_privacy_review") &&
    hasApprovedGate(input.approvedGateIds, "provider_vendor_review")
  );
}

function resolveRealWhatsappEgressAllowed(input: {
  allowRealWhatsappFlag?: string;
  approvedGateIds: LaunchGateId[];
  launchAuthorizationApproved: boolean;
}) {
  if (input.allowRealWhatsappFlag !== "true") {
    return false;
  }
  return (
    hasApprovedGate(input.approvedGateIds, "channel_policy_review") &&
    input.launchAuthorizationApproved === true
  );
}

function resolveRealTelegramEgressAllowed(input: {
  allowRealTelegramFlag?: string;
  approvedGateIds: LaunchGateId[];
  launchAuthorizationApproved: boolean;
}) {
  if (input.allowRealTelegramFlag !== "true") {
    return false;
  }
  return (
    hasApprovedGate(input.approvedGateIds, "channel_policy_review") &&
    input.launchAuthorizationApproved === true
  );
}

export function evaluatePhase81dEnvironmentPreflight(input: Phase81EnvironmentPreflightInput = {}) {
  const approvedGateIds = input.approvedGateIds ?? [];
  const blockingReasons: string[] = [];

  const productionEnvIdentityDeclared = Boolean(input.productionEnvIdentity?.trim());
  if (!productionEnvIdentityDeclared) {
    blockingReasons.push("production environment identity is not declared");
  }

  const secretsNotExposed = input.secretValuesExposed !== true;
  if (!secretsNotExposed) {
    blockingReasons.push("secret values must not be exposed in preflight evidence");
  }

  const requiredGateIds = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id);
  const missingGateIds = requiredGateIds.filter((gateId) => !approvedGateIds.includes(gateId));
  const allLaunchGatesApproved = missingGateIds.length === 0;
  if (!allLaunchGatesApproved) {
    blockingReasons.push(`missing approved launch gate evidence: ${missingGateIds.join(", ")}`);
  }

  const launchAuthorizationApproved = input.launchAuthorizationApproved === true;
  if (!launchAuthorizationApproved) {
    blockingReasons.push("Phase 81 launch authorization is not approved");
  }

  const missingOpsGateIds = PHASE_81D_OPS_GATE_IDS.filter(
    (gateId) => !approvedGateIds.includes(gateId),
  );
  const opsGatesApproved = missingOpsGateIds.length === 0;
  if (!opsGatesApproved) {
    blockingReasons.push(
      `missing approved ops gate evidence: ${missingOpsGateIds.join(", ")}`,
    );
  }

  const webhookApprovedExternalEvidence = input.webhookApprovedExternalEvidence === true;
  if (!webhookApprovedExternalEvidence) {
    blockingReasons.push("webhook readiness is not represented by approved external evidence");
  }

  const globalRollbackControlDeclared = input.globalRollbackControlDeclared === true;
  if (!globalRollbackControlDeclared) {
    blockingReasons.push("global rollback control is not declared and auditable");
  }

  const conservativeClientAiPosture = input.globalAutopilotEnablement !== true;
  if (!conservativeClientAiPosture) {
    blockingReasons.push("global autopilot enablement is not allowed for production preflight");
  }

  const realZaiEgressAllowed = resolveRealZaiEgressAllowed({
    allowRealZaiFlag: input.allowRealZaiFlag,
    approvedGateIds,
  });
  const realWhatsappEgressAllowed = resolveRealWhatsappEgressAllowed({
    allowRealWhatsappFlag: input.allowRealWhatsappFlag,
    approvedGateIds,
    launchAuthorizationApproved,
  });
  const realTelegramEgressAllowed = resolveRealTelegramEgressAllowed({
    allowRealTelegramFlag: input.allowRealTelegramFlag,
    approvedGateIds,
    launchAuthorizationApproved,
  });

  if (input.allowRealZaiFlag === "true" && !realZaiEgressAllowed) {
    blockingReasons.push(
      "MANU_ALLOW_REAL_ZAI cannot bypass missing Phase 75/provider launch gate evidence",
    );
  }
  if (input.allowRealWhatsappFlag === "true" && !realWhatsappEgressAllowed) {
    blockingReasons.push(
      "real WhatsApp egress cannot bypass missing channel gate or launch authorization evidence",
    );
  }
  if (input.allowRealTelegramFlag === "true" && !realTelegramEgressAllowed) {
    blockingReasons.push(
      "real Telegram egress cannot bypass missing channel gate or launch authorization evidence",
    );
  }

  const ready = blockingReasons.length === 0;

  return {
    preflightStatus: ready ? ("ready" as const) : ("blocked" as const),
    goReadyBlocked: !ready,
    checks: {
      productionEnvIdentityDeclared,
      secretsNotExposed,
      allLaunchGatesApproved,
      launchAuthorizationApproved,
      opsGatesApproved,
      webhookApprovedExternalEvidence,
      globalRollbackControlDeclared,
      conservativeClientAiPosture,
      realZaiEgressAllowed,
      realWhatsappEgressAllowed,
      realTelegramEgressAllowed,
    },
    blockingReasons,
  };
}

export function buildPhase81dEnvironmentPreflightReport(input: {
  preflight?: Phase81EnvironmentPreflightInput;
  now?: string;
}): Phase81EnvironmentPreflightReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const evaluation = evaluatePhase81dEnvironmentPreflight(input.preflight ?? {});

  return {
    phase81Version: PHASE_81D_VERSION,
    generatedAt,
    preflightMode: "dry_run_only",
    preflightStatus: evaluation.preflightStatus,
    goReadyBlocked: evaluation.goReadyBlocked,
    productionPilotGoReady: false,
    productionPilotStarted: false,
    checks: evaluation.checks,
    blockingReasons: evaluation.blockingReasons,
  };
}

export function buildPhase81dBaselineEnvironmentPreflightInput(): Phase81EnvironmentPreflightInput {
  return {
    productionEnvIdentity: undefined,
    secretValuesExposed: false,
    allowRealZaiFlag: undefined,
    allowRealWhatsappFlag: undefined,
    allowRealTelegramFlag: undefined,
    approvedGateIds: [],
    launchAuthorizationApproved: false,
    webhookApprovedExternalEvidence: false,
    globalRollbackControlDeclared: false,
    globalAutopilotEnablement: false,
  };
}

export function buildPhase81dBaselineEnvironmentPreflightReport(options: { now?: string } = {}) {
  return buildPhase81dEnvironmentPreflightReport({
    preflight: buildPhase81dBaselineEnvironmentPreflightInput(),
    now: options.now ?? "2026-06-30T12:00:00.000Z",
  });
}

export function buildCompletePhase81dEnvironmentPreflightInput(
  overrides: Partial<Phase81EnvironmentPreflightInput> = {},
): Phase81EnvironmentPreflightInput {
  return {
    productionEnvIdentity: "production",
    secretValuesExposed: false,
    allowRealZaiFlag: "true",
    allowRealWhatsappFlag: "true",
    allowRealTelegramFlag: undefined,
    approvedGateIds: PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id),
    launchAuthorizationApproved: true,
    webhookApprovedExternalEvidence: true,
    globalRollbackControlDeclared: true,
    globalAutopilotEnablement: false,
    ...overrides,
  };
}

export function summarizePhase81dEnvironmentPreflightReport(
  report: Phase81EnvironmentPreflightReport,
) {
  return {
    preflightMode: report.preflightMode,
    preflightStatus: report.preflightStatus,
    goReadyBlocked: report.goReadyBlocked,
    productionPilotGoReady: report.productionPilotGoReady,
    productionPilotStarted: report.productionPilotStarted,
    checks: report.checks,
    blockingReasonCount: report.blockingReasons.length,
  };
}
