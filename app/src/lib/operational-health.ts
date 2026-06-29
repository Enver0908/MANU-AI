import {
  evaluateDirectPilotScaleReadiness,
  type DirectPilotScaleFixture,
} from "./direct-pilot-scale-readiness";
import {
  evaluateProductionPilotLaunchGateEvidence,
  evaluateProductionPilotLaunchGates,
  type LaunchGateEvidenceRecord,
  type LaunchGateId,
} from "./launch-gates";
import { buildNotificationSlaSnapshot } from "./notification-sla";
import { buildPhase76mGreenCapacityHealthSignal } from "./phase-76m-calibration-metrics";
import { buildPhase76oFoodMixHealthSignal, evaluatePhase76oFoodMixSampleEvidence } from "./phase-76o-food-mix-rehearsal";
import { buildPhase77kCalibrationHealthSignal } from "./phase-77k-calibration-evidence";
import { buildPhase77kFoodMixHealthSignal, evaluatePhase77kFoodMixSampleEvidence } from "./phase-77k-food-mix-rehearsal";
import {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  CLAIM_MANIFEST_V1_VERSION,
  NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
  RESPONSE_PLAN_V1_VERSION,
  STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
  STYLE_DNA_V2_VERSION,
} from "dietitian-ai-assistant-architecture";
import {
  buildPhase77aiProductionOpsDefaultPreparation,
  buildPhase77aiProductionOpsHealthSignal,
  type Phase77aiProductionOperationsPreparation,
} from "./phase-77ai-production-operations-preparation";
import {
  buildPhase77agChannelReplayDefaultMetrics,
  buildPhase77agChannelReplayHealthSignal,
  type Phase77agChannelReplayRehearsalMetrics,
} from "./phase-77ag-channel-replay-rehearsal";
import {
  buildPhase77xAiQualityHealthSignal,
  type Phase77xExpandedAiRehearsalMetrics,
} from "./phase-77x-expanded-ai-rehearsal";
import { buildScopeGuardHealthSignal } from "./scope-guard-runtime";
import { buildChannelAdapterHealthSignal } from "./channel-adapter-health";
import { countActiveChannelAdapterRollbackScopes } from "./channel-adapter-rollback";
import type { ManuAppState } from "./types";

export type OperationalHealthSnapshot = {
  generatedAt: string;
  openHandoffCount: number;
  urgentOpenHandoffCount: number;
  failedProviderDecisionCount: number;
  unreadNotificationCount: number;
  breachedNotificationSlaCount: number;
  urgentEscalationDueCount: number;
  pendingDraftCount: number;
  staleDraftCount: number;
  passiveClientCount: number;
  scopeGuardCorpusActive: boolean;
  scopeGuardApprovedRuleCount: number;
  scopeGuardDraftRuleCount: number;
  launchBlocked: boolean;
  openLaunchGateIds: LaunchGateId[];
  blockedLaunchGateCount: number;
  directPilotScaleReady: boolean;
  directPilotDietitianCount: number;
  directPilotClientCount: number;
  directPilotScaleFailures: string[];
  greenCapacityCalibrationVersion: string;
  greenCapacityMetricsStatus: "pass" | "fail";
  greenCoverageRate: number;
  sourceBackedGreenRate: number;
  foodRuleGreenRate: number;
  falseYellowRate: number;
  unsafeGreenRate: number;
  mixedIntentBlockCount: number;
  ingredientUnknownReviewCount: number;
  providerAttemptedFalseCount: number;
  covenantBlockCount: number;
  foodMixRehearsalVersion: string;
  foodMixRehearsalStatus: "pass" | "fail";
  foodMixRehearsalUnsafeGreenCount: number;
  foodMixRehearsalFoodRuleGreenCount: number;
  foodMixRehearsalNoSourceHandoffCount: number;
  foodMixRehearsalRemovedClientBlockedCount: number;
  foodDecisionV2CalibrationVersion: string;
  foodDecisionV2CalibrationStatus: "pass" | "fail";
  foodMixRehearsalV2Version: string;
  foodMixRehearsalV2Status: "pass" | "fail";
  foodMixRehearsalV2UnsafeGreenCount: number;
  foodMixRehearsalV2InappropriateApprovalCount: number;
  manualSourceAuthorityTrackClosed: boolean;
  whatsappAdapterNext: boolean;
  aiQualityStatus: "pass" | "fail";
  responsePlanVersion: string;
  claimGroundingVersion: string;
  styleDnaVersion: string;
  narrowAutopilotReadinessStatus: "ready" | "not_ready";
  unsafeSendCount: number;
  responsePlanPassRate: number;
  claimGroundingPassRate: number;
  narrowAutopilotEligibleCount: number;
  expandedAiRehearsalVersion: string;
  expandedAiRehearsalCaseCount: number;
  expandedAiRehearsalUnsafeClientSendCount: number;
  expandedAiRehearsalSourceUnsupportedGreenCount: number;
  expandedAiRehearsalForbiddenFoodApprovalCount: number;
  expandedAiRehearsalYellowRedClientSendCount: number;
  expandedAiRehearsalClaimOutsideManifestCount: number;
  expandedAiRehearsalStyleSoftMismatchRate: number;
  channelMockDeliveryFailureCount: number;
  channelQuarantineCount: number;
  channelDuplicateIgnoredCount: number;
  channelOptOutCount: number;
  channelGateBlockedCount: number;
  channelAutomationRollbackActiveScopeCount: number;
  channelReplayRehearsalVersion: string;
  channelReplayRehearsalStatus: "pass" | "fail";
  channelReplayRehearsalDuplicateClientSendCount: number;
  channelReplayRehearsalUnknownIdentityProviderCallCount: number;
  channelReplayRehearsalYellowRedClientSendCount: number;
  channelReplayRehearsalUnsafeGreenCount: number;
  channelReplayRehearsalGroupQuarantineCount: number;
  channelReplayRehearsalDuplicateIgnoredCount: number;
  productionOpsPreparationVersion: string;
  productionOpsPreparationStatus: "pass" | "fail";
  productionOpsOpenGateCount: number;
  productionOpsMissingEvidenceCount: number;
  productionOpsPlaceholderCandidateCount: number;
  productionOpsInternalMockControlCount: number;
  productionOpsLaunchGatesOpen: boolean;
};

const DEFAULT_STALE_DRAFT_HOURS = 24;

export function buildOperationalHealthSnapshot(
  state: ManuAppState,
  options: {
    now?: string;
    approvedLaunchGateIds?: string[];
    launchGateEvidence?: LaunchGateEvidenceRecord[];
    staleDraftHours?: number;
    directPilotScaleFixture?: DirectPilotScaleFixture;
    loadBackpressureIdempotencyEvidence?: boolean;
    foodMixRehearsalPass?: boolean;
    expandedAiRehearsalMetrics?: Phase77xExpandedAiRehearsalMetrics;
    channelReplayRehearsalMetrics?: Phase77agChannelReplayRehearsalMetrics;
    productionOpsPreparation?: Phase77aiProductionOperationsPreparation;
  } = {},
): OperationalHealthSnapshot {
  const now = options.now ? new Date(options.now) : new Date();
  const staleDraftMs = (options.staleDraftHours ?? DEFAULT_STALE_DRAFT_HOURS) * 60 * 60 * 1000;
  const launchGateEvaluation = options.launchGateEvidence
    ? evaluateProductionPilotLaunchGateEvidence(options.launchGateEvidence, { now: now.toISOString() })
    : evaluateProductionPilotLaunchGates(options.approvedLaunchGateIds);
  const notificationSla = buildNotificationSlaSnapshot(
    { notifications: state.notifications, handoffCases: state.handoffCases },
    { now: now.toISOString() },
  );
  const openHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open");
  const pendingDrafts = state.messages.filter((message) => message.status === "draft");
  const scopeGuard = buildScopeGuardHealthSignal(state);
  const scaleReadiness = options.directPilotScaleFixture
    ? evaluateDirectPilotScaleReadiness(options.directPilotScaleFixture, {
        loadBackpressureIdempotencyEvidence: options.loadBackpressureIdempotencyEvidence,
        foodMixRehearsalPass: options.foodMixRehearsalPass,
      })
    : null;
  const greenCapacity = buildPhase76mGreenCapacityHealthSignal();
  const foodMixSample = evaluatePhase76oFoodMixSampleEvidence();
  const foodMix = buildPhase76oFoodMixHealthSignal({
    ...foodMixSample,
    scenarioAssignmentCount: foodMixSample.clientCount,
    duplicateIgnoredCount: 0,
    yellowClientSendCount: 0,
    redClientSendCount: 0,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    manualFoodRuleSaveCount: 0,
  });
  const calibrationV2 = buildPhase77kCalibrationHealthSignal();
  const foodMixV2Sample = evaluatePhase77kFoodMixSampleEvidence();
  const foodMixV2 = buildPhase77kFoodMixHealthSignal(foodMixV2Sample);
  const expandedAiQuality = buildPhase77xAiQualityHealthSignal(
    options.expandedAiRehearsalMetrics ?? buildPhase77xAiQualityDefaultMetrics(),
  );
  const channelAdapterHealth = buildChannelAdapterHealthSignal(state);
  const channelReplay = buildPhase77agChannelReplayHealthSignal(
    options.channelReplayRehearsalMetrics ?? buildPhase77agChannelReplayDefaultMetrics(),
  );
  const productionOps = buildPhase77aiProductionOpsHealthSignal(
    options.productionOpsPreparation ?? buildPhase77aiProductionOpsDefaultPreparation(),
  );

  return {
    generatedAt: now.toISOString(),
    openHandoffCount: openHandoffs.length,
    urgentOpenHandoffCount: openHandoffs.filter((handoff) => handoff.urgency === "urgent").length,
    failedProviderDecisionCount: state.aiDecisions.filter((decision) => decision.providerStatus === "failed").length,
    unreadNotificationCount: state.notifications.filter((notification) => !notification.read).length,
    breachedNotificationSlaCount: notificationSla.breachedNotificationCount,
    urgentEscalationDueCount: notificationSla.urgentEscalationDueCount,
    pendingDraftCount: pendingDrafts.length,
    staleDraftCount: pendingDrafts.filter((message) => now.getTime() - new Date(message.createdAt).getTime() > staleDraftMs)
      .length,
    passiveClientCount: state.clients.filter((client) => client.aiStatus === "passive").length,
    scopeGuardCorpusActive: scopeGuard.corpusActive,
    scopeGuardApprovedRuleCount: scopeGuard.approvedRuleCount,
    scopeGuardDraftRuleCount: scopeGuard.draftRuleCount,
    launchBlocked: launchGateEvaluation.blocked,
    openLaunchGateIds: launchGateEvaluation.openGateIds,
    blockedLaunchGateCount: launchGateEvaluation.openGateIds.length,
    directPilotScaleReady: scaleReadiness?.ready ?? false,
    directPilotDietitianCount: scaleReadiness?.dietitianCount ?? 0,
    directPilotClientCount: scaleReadiness?.totalClientCount ?? 0,
    directPilotScaleFailures: scaleReadiness?.failures ?? ["direct_pilot_scale_fixture_missing"],
    greenCapacityCalibrationVersion: greenCapacity.calibrationVersion,
    greenCapacityMetricsStatus: greenCapacity.status,
    greenCoverageRate: greenCapacity.greenCoverageRate,
    sourceBackedGreenRate: greenCapacity.sourceBackedGreenRate,
    foodRuleGreenRate: greenCapacity.foodRuleGreenRate,
    falseYellowRate: greenCapacity.falseYellowRate,
    unsafeGreenRate: greenCapacity.unsafeGreenRate,
    mixedIntentBlockCount: greenCapacity.mixedIntentBlockCount,
    ingredientUnknownReviewCount: greenCapacity.ingredientUnknownReviewCount,
    providerAttemptedFalseCount: greenCapacity.providerAttemptedFalseCount,
    covenantBlockCount: greenCapacity.covenantBlockCount,
    foodMixRehearsalVersion: foodMix.rehearsalVersion,
    foodMixRehearsalStatus: foodMix.status,
    foodMixRehearsalUnsafeGreenCount: foodMix.unsafeGreenCount,
    foodMixRehearsalFoodRuleGreenCount: foodMix.foodRuleGreenCount,
    foodMixRehearsalNoSourceHandoffCount: foodMix.foodRuleNoSourceHandoffCount,
    foodMixRehearsalRemovedClientBlockedCount: foodMix.removedClientBlockedCount,
    foodDecisionV2CalibrationVersion: calibrationV2.goldenVersion,
    foodDecisionV2CalibrationStatus: calibrationV2.goldenStatus,
    foodMixRehearsalV2Version: foodMixV2.rehearsalVersion,
    foodMixRehearsalV2Status: foodMixV2.status,
    foodMixRehearsalV2UnsafeGreenCount: foodMixV2.unsafeGreenCount,
    foodMixRehearsalV2InappropriateApprovalCount: foodMixV2.inappropriateApprovalCount,
    manualSourceAuthorityTrackClosed: calibrationV2.manualSourceAuthorityTrackClosed,
    whatsappAdapterNext: calibrationV2.whatsappAdapterNext,
    ...expandedAiQuality,
    ...channelAdapterHealth,
    channelAutomationRollbackActiveScopeCount: countActiveChannelAdapterRollbackScopes(state.channelAdapterRollback),
    ...channelReplay,
    ...productionOps,
  };
}

function buildPhase77xAiQualityDefaultMetrics(): Phase77xExpandedAiRehearsalMetrics {
  return {
    rehearsalVersion: AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
    status: "fail",
    clientCount: 0,
    messagesPerClient: 0,
    caseCount: 0,
    turnCount: 0,
    passCount: 0,
    failureCount: 0,
    unsafeClientSendCount: 0,
    sourceUnsupportedGreenCount: 0,
    forbiddenFoodApprovalCount: 0,
    yellowRedClientSendCount: 0,
    claimOutsideManifestCount: 0,
    narrowAutopilotEligibleCount: 0,
    responsePlanVersion: RESPONSE_PLAN_V1_VERSION,
    claimGroundingVersion: CLAIM_MANIFEST_V1_VERSION,
    styleDnaVersion: STYLE_DNA_V2_VERSION,
    narrowAutopilotReadinessVersion: NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
    responsePlanPassRate: 0,
    claimGroundingPassRate: 0,
    styleSoftMismatchRate: 0,
    styleSoftMismatchThreshold: STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
    styleMeasuredCount: 0,
    styleSoftMismatchCount: 0,
    responsePlanApplicableCount: 0,
    responsePlanPassCount: 0,
    claimGroundingApplicableCount: 0,
    claimGroundingPassCount: 0,
    hardZeroFailures: ["expanded_ai_rehearsal_sample_not_run"],
    failures: ["expanded_ai_rehearsal_sample_not_run"],
    elapsedMs: 0,
    aiQualityStatus: "fail",
    narrowAutopilotReadinessStatus: "not_ready",
    unsafeSendCount: 0,
  };
}
