import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  CLAIM_MANIFEST_V1_VERSION,
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_SAMPLE_CLIENT_COUNT,
  EXPANDED_REHEARSAL_SAMPLE_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
  RESPONSE_PLAN_V1_VERSION,
  STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
  STYLE_DNA_V2_VERSION,
  expandHarnessCasesForClientScale,
  loadHarnessCasesFromJsonl,
  runExpandedRehearsalBatch,
} from "dietitian-ai-assistant-architecture";
import { handleInboundMessage } from "dietitian-ai-assistant-architecture";

export type ExpandedRehearsalMetrics = Awaited<
  ReturnType<typeof runExpandedRehearsalBatch>
>["metrics"];

const moduleDir = dirname(fileURLToPath(import.meta.url));
const coreTestsDir = join(moduleDir, "../../../dietitian-ai-assistant/tests");

export const PHASE_77X_EXPANDED_AI_REHEARSAL_VERSION = "phase-77x-expanded-ai-rehearsal-v1";

export type Phase77xExpandedAiRehearsalMetrics = ExpandedRehearsalMetrics & {
  aiQualityStatus: "pass" | "fail";
  narrowAutopilotReadinessStatus: "ready" | "not_ready";
  unsafeSendCount: number;
  responsePlanVersion: string;
  claimGroundingVersion: string;
  styleDnaVersion: string;
  narrowAutopilotReadinessVersion: string;
  rehearsalVersion: string;
  status: "pass" | "fail";
  clientCount: number;
  messagesPerClient: number;
  caseCount: number;
  turnCount: number;
  unsafeClientSendCount: number;
  sourceUnsupportedGreenCount: number;
  forbiddenFoodApprovalCount: number;
  yellowRedClientSendCount: number;
  claimOutsideManifestCount: number;
  narrowAutopilotEligibleCount: number;
  responsePlanPassRate: number;
  claimGroundingPassRate: number;
  styleSoftMismatchRate: number;
  styleSoftMismatchThreshold: number;
  hardZeroFailures: string[];
  failures: string[];
  elapsedMs: number;
};

export function loadAiQualityHarnessSeedCases() {
  return loadHarnessCasesFromJsonl(
    readFileSync(join(coreTestsDir, "ai-quality-harness-seed-cases.jsonl"), "utf8"),
  );
}

export async function runPhase77xExpandedAiRehearsalSampleEvidence(): Promise<Phase77xExpandedAiRehearsalMetrics> {
  const seedCases = loadAiQualityHarnessSeedCases();
  const sampleCases = expandHarnessCasesForClientScale(
    seedCases,
    EXPANDED_REHEARSAL_SAMPLE_CLIENT_COUNT,
    EXPANDED_REHEARSAL_SAMPLE_MESSAGES_PER_CLIENT,
  );
  const { metrics } = await runExpandedRehearsalBatch(sampleCases, {
    handleInboundMessage,
    clientCount: EXPANDED_REHEARSAL_SAMPLE_CLIENT_COUNT,
    messagesPerClient: EXPANDED_REHEARSAL_SAMPLE_MESSAGES_PER_CLIENT,
  });
  return decoratePhase77xMetrics(metrics);
}

export async function runPhase77xExpandedAiRehearsalFullEvidence(): Promise<Phase77xExpandedAiRehearsalMetrics> {
  const seedCases = loadAiQualityHarnessSeedCases();
  const fullCases = expandHarnessCasesForClientScale(
    seedCases,
    EXPANDED_REHEARSAL_CLIENT_COUNT,
    EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  );
  const { metrics } = await runExpandedRehearsalBatch(fullCases, {
    handleInboundMessage,
    clientCount: EXPANDED_REHEARSAL_CLIENT_COUNT,
    messagesPerClient: EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  });
  return decoratePhase77xMetrics(metrics);
}

export function buildPhase77xAiQualityHealthSignal(metrics: Phase77xExpandedAiRehearsalMetrics) {
  return {
    aiQualityStatus: metrics.aiQualityStatus,
    responsePlanVersion: String(metrics.responsePlanVersion),
    claimGroundingVersion: String(metrics.claimGroundingVersion),
    styleDnaVersion: String(metrics.styleDnaVersion),
    narrowAutopilotReadinessStatus: metrics.narrowAutopilotReadinessStatus,
    unsafeSendCount: metrics.unsafeSendCount,
    responsePlanPassRate: metrics.responsePlanPassRate,
    claimGroundingPassRate: metrics.claimGroundingPassRate,
    narrowAutopilotEligibleCount: metrics.narrowAutopilotEligibleCount,
    expandedAiRehearsalVersion: String(metrics.rehearsalVersion),
    expandedAiRehearsalClientCount: metrics.clientCount,
    expandedAiRehearsalMessagesPerClient: metrics.messagesPerClient,
    expandedAiRehearsalCaseCount: metrics.caseCount,
    expandedAiRehearsalUnsafeClientSendCount: metrics.unsafeClientSendCount,
    expandedAiRehearsalSourceUnsupportedGreenCount: metrics.sourceUnsupportedGreenCount,
    expandedAiRehearsalForbiddenFoodApprovalCount: metrics.forbiddenFoodApprovalCount,
    expandedAiRehearsalYellowRedClientSendCount: metrics.yellowRedClientSendCount,
    expandedAiRehearsalClaimOutsideManifestCount: metrics.claimOutsideManifestCount,
    expandedAiRehearsalStyleSoftMismatchRate: metrics.styleSoftMismatchRate,
    expandedAiRehearsalStyleSoftMismatchThreshold: metrics.styleSoftMismatchThreshold,
  };
}

export function buildPhase77xExpandedAiRehearsalEvidencePackMetrics(
  metrics: Phase77xExpandedAiRehearsalMetrics,
) {
  return {
    phase: PHASE_77X_EXPANDED_AI_REHEARSAL_VERSION,
    rehearsal_version: metrics.rehearsalVersion,
    status: metrics.aiQualityStatus,
    client_count: metrics.clientCount,
    messages_per_client: metrics.messagesPerClient,
    case_count: metrics.caseCount,
    turn_count: metrics.turnCount,
    response_plan_version: metrics.responsePlanVersion,
    claim_grounding_version: metrics.claimGroundingVersion,
    style_dna_version: metrics.styleDnaVersion,
    narrow_autopilot_readiness_status: metrics.narrowAutopilotReadinessStatus,
    narrow_autopilot_readiness_version: metrics.narrowAutopilotReadinessVersion,
    unsafe_send_count: metrics.unsafeSendCount,
    unsafe_client_send_count: metrics.unsafeClientSendCount,
    source_unsupported_green_count: metrics.sourceUnsupportedGreenCount,
    forbidden_food_approval_count: metrics.forbiddenFoodApprovalCount,
    yellow_red_client_send_count: metrics.yellowRedClientSendCount,
    claim_outside_manifest_count: metrics.claimOutsideManifestCount,
    response_plan_pass_rate: metrics.responsePlanPassRate,
    claim_grounding_pass_rate: metrics.claimGroundingPassRate,
    narrow_autopilot_eligible_count: metrics.narrowAutopilotEligibleCount,
    style_soft_mismatch_rate: metrics.styleSoftMismatchRate,
    style_soft_mismatch_threshold: metrics.styleSoftMismatchThreshold,
    hard_zero_failures: metrics.hardZeroFailures,
    production_gate_closed: true,
    evidence_only: metrics.clientCount < EXPANDED_REHEARSAL_CLIENT_COUNT,
  };
}

function decoratePhase77xMetrics(metrics: ExpandedRehearsalMetrics): Phase77xExpandedAiRehearsalMetrics {
  const hardZerosClear =
    Number(metrics.unsafeClientSendCount ?? 0) === 0 &&
    Number(metrics.sourceUnsupportedGreenCount ?? 0) === 0 &&
    Number(metrics.forbiddenFoodApprovalCount ?? 0) === 0 &&
    Number(metrics.yellowRedClientSendCount ?? 0) === 0 &&
    Number(metrics.claimOutsideManifestCount ?? 0) === 0 &&
    Number(metrics.styleSoftMismatchRate ?? 0) <= STYLE_DNA_SOFT_MISMATCH_THRESHOLD;

  return {
    ...metrics,
    rehearsalVersion: String(metrics.rehearsalVersion ?? AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION),
    status: metrics.status === "pass" ? "pass" : "fail",
    clientCount: Number(metrics.clientCount ?? 0),
    messagesPerClient: Number(metrics.messagesPerClient ?? 0),
    caseCount: Number(metrics.caseCount ?? 0),
    turnCount: Number(metrics.turnCount ?? 0),
    unsafeClientSendCount: Number(metrics.unsafeClientSendCount ?? 0),
    sourceUnsupportedGreenCount: Number(metrics.sourceUnsupportedGreenCount ?? 0),
    forbiddenFoodApprovalCount: Number(metrics.forbiddenFoodApprovalCount ?? 0),
    yellowRedClientSendCount: Number(metrics.yellowRedClientSendCount ?? 0),
    claimOutsideManifestCount: Number(metrics.claimOutsideManifestCount ?? 0),
    narrowAutopilotEligibleCount: Number(metrics.narrowAutopilotEligibleCount ?? 0),
    responsePlanPassRate: Number(metrics.responsePlanPassRate ?? 0),
    claimGroundingPassRate: Number(metrics.claimGroundingPassRate ?? 0),
    styleSoftMismatchRate: Number(metrics.styleSoftMismatchRate ?? 0),
    styleSoftMismatchThreshold: Number(metrics.styleSoftMismatchThreshold ?? STYLE_DNA_SOFT_MISMATCH_THRESHOLD),
    hardZeroFailures: Array.isArray(metrics.hardZeroFailures) ? metrics.hardZeroFailures.map(String) : [],
    failures: Array.isArray(metrics.failures) ? metrics.failures.map(String) : [],
    elapsedMs: Number(metrics.elapsedMs ?? 0),
    aiQualityStatus: metrics.status === "pass" && hardZerosClear ? "pass" : "fail",
    narrowAutopilotReadinessStatus:
      hardZerosClear && Number(metrics.narrowAutopilotEligibleCount ?? 0) > 0 ? "ready" : "not_ready",
    unsafeSendCount:
      Number(metrics.unsafeClientSendCount ?? 0) + Number(metrics.yellowRedClientSendCount ?? 0),
    responsePlanVersion: String(metrics.responsePlanVersion || RESPONSE_PLAN_V1_VERSION),
    claimGroundingVersion: String(metrics.claimGroundingVersion || CLAIM_MANIFEST_V1_VERSION),
    styleDnaVersion: String(metrics.styleDnaVersion || STYLE_DNA_V2_VERSION),
    narrowAutopilotReadinessVersion: String(
      metrics.narrowAutopilotReadinessVersion || NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
    ),
  };
}

export {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT,
};
