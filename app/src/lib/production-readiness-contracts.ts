import {
  evaluateProductionPilotLaunchGates,
  type LaunchGateId,
  type ProductionPilotLaunchGateScope,
} from "./launch-gates";

export const PRODUCTION_READINESS_STAGE_1_PHASE_1_VERSION =
  "production-readiness-stage-1-phase-1-v1";

export const TURKEY_FIRST_DIRECT_LAUNCH_SCOPE = {
  geography: "TR",
  targetDietitianCount: 100,
  targetClientCount: 5000,
  channels: {
    whatsapp: true,
    telegram: false,
  },
  paymentRail: "manual_bank_transfer",
  physicalIphoneValidation: "WAIVED_NOT_EXECUTED",
} as const;

export const PRODUCTION_READINESS_OPERATIONS = [
  "whatsapp_connect",
  "whatsapp_receive",
  "whatsapp_send",
  "ai_text_generate",
  "ai_vision_analyze",
  "ocr_extract",
  "audio_transcribe",
] as const;

export const PRODUCTION_READINESS_ERROR_CATEGORIES = [
  "not_configured",
  "not_authorized",
  "timeout",
  "rate_limited",
  "invalid_output",
  "temporarily_unavailable",
] as const;

export type ProductionReadinessEnvironmentProfile = "local" | "hosted_sandbox" | "production";
export type ProductionReadinessOperationId = (typeof PRODUCTION_READINESS_OPERATIONS)[number];
export type ProductionReadinessErrorCategory = (typeof PRODUCTION_READINESS_ERROR_CATEGORIES)[number];
export type ProductionReadinessProvider = "gemini" | "whatsapp" | "telegram" | "vision" | "ocr" | "transcription";
export type ProductionReadinessAuthoritySource = "server_authority" | "client_supplied" | "none";
export type ProductionReadinessContextAuthority = "server" | "client";

export type ProductionReadinessEnv = Partial<Record<string, string | undefined>>;

export type ProductionReadinessBoundaryInput = {
  env?: ProductionReadinessEnv;
  environmentProfile?: ProductionReadinessEnvironmentProfile;
  provider: ProductionReadinessProvider;
  operation: ProductionReadinessOperationId;
  approvedGateIds?: LaunchGateId[];
  approvedGateIdsSource?: ProductionReadinessAuthoritySource;
  launchAuthorizationApproved?: boolean;
  tenantEntitlementActive?: boolean;
  tenantPermissionGranted?: boolean;
  contextAuthority?: ProductionReadinessContextAuthority;
  launchScope?: ProductionPilotLaunchGateScope;
};

export type ProductionReadinessBoundaryDecision = {
  version: typeof PRODUCTION_READINESS_STAGE_1_PHASE_1_VERSION;
  environmentProfile: ProductionReadinessEnvironmentProfile;
  provider: ProductionReadinessProvider;
  operation: ProductionReadinessOperationId;
  realEgressAllowed: boolean;
  errorCategory: ProductionReadinessErrorCategory | null;
  blockingReasons: string[];
  checkedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
};

const REAL_EGRESS_FLAGS_BY_PROVIDER: Record<ProductionReadinessProvider, string[]> = {
  gemini: ["MANU_ALLOW_REAL_GEMINI", "AI_CHAT_REAL_PROVIDER_ENABLED"],
  whatsapp: ["MANU_ALLOW_REAL_WHATSAPP"],
  telegram: ["MANU_ALLOW_REAL_TELEGRAM"],
  vision: ["MANU_ALLOW_REAL_VISION_EGRESS"],
  ocr: ["MANU_ALLOW_REAL_OCR"],
  transcription: ["MANU_ALLOW_REAL_TRANSCRIPTION"],
};

const PRODUCTION_FORBIDDEN_FIXTURE_FLAGS = [
  "MANU_DEV_FALLBACK_STORE",
  "MANU_ALLOW_PUBLIC_DEMO_LOGIN",
  "MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK",
  "MANU_ALLOW_MOCK_VISION",
  "MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION",
  "AI_CHAT_DETERMINISTIC_MODE",
] as const;

const DEFAULT_LAUNCH_SCOPE: ProductionPilotLaunchGateScope =
  TURKEY_FIRST_DIRECT_LAUNCH_SCOPE;

export function resolveProductionReadinessEnvironmentProfile(
  env: ProductionReadinessEnv = process.env,
): ProductionReadinessEnvironmentProfile {
  if (env.MANU_HOSTED_SANDBOX_ACTIVE === "true" || env.MANU_APP_ENV === "hosted_sandbox") {
    return "hosted_sandbox";
  }
  if (env.MANU_APP_ENV === "production" || env.MANU_RELEASE_ENVIRONMENT === "production") {
    return "production";
  }
  if (env.MANU_APP_ENV === "local") {
    return "local";
  }
  return env.NODE_ENV === "production" ? "production" : "local";
}

export function evaluateProductionReadinessBoundary(
  input: ProductionReadinessBoundaryInput,
): ProductionReadinessBoundaryDecision {
  const env = input.env ?? process.env;
  const environmentProfile =
    input.environmentProfile ?? resolveProductionReadinessEnvironmentProfile(env);
  const launchScope = input.launchScope ?? DEFAULT_LAUNCH_SCOPE;
  const approvedGateIds = input.approvedGateIds ?? [];
  const gateEvaluation = evaluateProductionPilotLaunchGates(approvedGateIds, launchScope);
  const blockingReasons: string[] = [];

  if (!isOperationKnown(input.operation)) {
    blockingReasons.push(`unknown operation: ${input.operation}`);
  }

  if (input.provider === "telegram" && launchScope.channels?.telegram === false) {
    blockingReasons.push("telegram is outside the Turkey-first launch scope");
  }

  if (!isProviderRequestedForEgress(input.provider, env)) {
    blockingReasons.push(`real ${input.provider} egress flag is not enabled`);
  }

  if (environmentProfile !== "production") {
    blockingReasons.push(`real egress is blocked in ${environmentProfile} profile`);
  }

  if (input.approvedGateIdsSource !== "server_authority") {
    blockingReasons.push("approved launch gates must come from server authority");
  }

  if (gateEvaluation.blocked) {
    blockingReasons.push(`open launch gates: ${gateEvaluation.openGateIds.join(", ")}`);
  }

  if (input.launchAuthorizationApproved !== true) {
    blockingReasons.push("launch authorization is not approved");
  }

  if (input.tenantEntitlementActive !== true) {
    blockingReasons.push("active tenant entitlement is required");
  }

  if (input.tenantPermissionGranted !== true) {
    blockingReasons.push("tenant operation permission is required");
  }

  if (input.contextAuthority !== "server") {
    blockingReasons.push("production context must be injected by server authority");
  }

  const forbiddenFixtureFlags = PRODUCTION_FORBIDDEN_FIXTURE_FLAGS.filter(
    (flag) => env[flag] === "true",
  );
  if (environmentProfile === "production" && forbiddenFixtureFlags.length > 0) {
    blockingReasons.push(`production fixture/demo flags are enabled: ${forbiddenFixtureFlags.join(", ")}`);
  }

  return {
    version: PRODUCTION_READINESS_STAGE_1_PHASE_1_VERSION,
    environmentProfile,
    provider: input.provider,
    operation: input.operation,
    realEgressAllowed: blockingReasons.length === 0,
    errorCategory: deriveBoundaryErrorCategory(blockingReasons),
    blockingReasons,
    checkedGateIds: [...gateEvaluation.approvedGateIds, ...gateEvaluation.openGateIds],
    openGateIds: gateEvaluation.openGateIds,
  };
}

export function summarizeProductionReadinessStage1Phase1() {
  return {
    version: PRODUCTION_READINESS_STAGE_1_PHASE_1_VERSION,
    launchScope: TURKEY_FIRST_DIRECT_LAUNCH_SCOPE,
    operations: [...PRODUCTION_READINESS_OPERATIONS],
    errorCategories: [...PRODUCTION_READINESS_ERROR_CATEGORIES],
    approvalSource: "server_authority_only",
    productionEgressPolicy:
      "Real egress requires production profile, server-approved launch gates, launch authorization, active entitlement, tenant permission, server context, and no demo or fixture flags.",
    productionPilotGo: false,
  };
}

function isOperationKnown(operation: string): operation is ProductionReadinessOperationId {
  return PRODUCTION_READINESS_OPERATIONS.includes(operation as ProductionReadinessOperationId);
}

function isProviderRequestedForEgress(
  provider: ProductionReadinessProvider,
  env: ProductionReadinessEnv,
) {
  return REAL_EGRESS_FLAGS_BY_PROVIDER[provider].some((flag) => env[flag] === "true");
}

function deriveBoundaryErrorCategory(
  blockingReasons: string[],
): ProductionReadinessErrorCategory | null {
  if (blockingReasons.length === 0) return null;
  if (blockingReasons.some((reason) => reason.includes("flag is not enabled"))) {
    return "not_configured";
  }
  if (
    blockingReasons.some((reason) =>
      /authority|authorization|entitlement|permission|scope|profile|fixture|demo|launch gate/.test(
        reason,
      ),
    )
  ) {
    return "not_authorized";
  }
  return "temporarily_unavailable";
}
