import {
  createDirectPilotScaleFixture,
  DIRECT_PILOT_SCALE_TARGET,
  type DirectPilotScaleClient,
  type DirectPilotScaleFixture,
} from "./direct-pilot-scale-readiness";
import { classifySimulationRisk } from "./simulator-risk";
import {
  evaluateFoodDecisionV2GoldenCase,
  loadFoodDecisionV2GoldenCases,
  seedFoodDecisionV2GoldenCaseState,
  type FoodDecisionV2GoldenCase,
} from "./phase-77k-food-decision-v2-golden";
import { evaluateClientFoodDecisionV2 } from "./phase-77g-food-decision-engine-v2";
import { runPhase76oFoodMixIntegrationChecks } from "./phase-76o-food-mix-rehearsal";
import { createBlankClient, createInitialState, DEMO_TENANT_ID } from "./seed-data";
import type { ClientRecord, ManuAppState, RiskLevel } from "./types";

export const PHASE_77K_FOOD_MIX_REHEARSAL_VERSION = "phase-77k-food-mix-rehearsal-v1";

export type Phase77kFoodMixRehearsalMetrics = {
  rehearsalVersion: string;
  status: "pass" | "fail";
  dietitianCount: number;
  clientCount: number;
  scenarioAssignmentCount: number;
  unsafeGreenCount: number;
  inappropriateApprovalCount: number;
  forbiddenFoodApprovalCount: number;
  needsLabelCorrectCount: number;
  needsReviewCorrectCount: number;
  sourceManifestCompleteCount: number;
  v2AllowCount: number;
  v2DiscourageCount: number;
  v2ForbidCount: number;
  v2NeedsReviewCount: number;
  yellowClientSendCount: number;
  redClientSendCount: number;
  removedClientBlockedCount: number;
  duplicateIgnoredCount: number;
  providerFailureHandoffCount: number;
  staleDraftInvalidatedCount: number;
  manualFoodRuleSaveCount: number;
  scenarioCounts: Record<string, number>;
  failures: string[];
};

function isAutomatedSendEligible(client: ClientRecord) {
  return (
    client.lifecycleStatus === "active" &&
    client.aiStatus === "active" &&
    client.channelPermission === "ready" &&
    client.redRiskLock.status !== "locked" &&
    client.yellowRiskHold.status !== "active" &&
    !client.humanTakeoverLocked
  );
}

function buildSyntheticClient(clientMeta: DirectPilotScaleClient): ClientRecord {
  return createBlankClient({
    id: clientMeta.id,
    dietitianId: clientMeta.dietitianId,
    fullName: `Synthetic Client ${clientMeta.id.slice(-5)}`,
    aiStatus: clientMeta.aiStatus,
    aiMode: "autopilot",
    channelPermission: "ready",
    mandatorySafetyComplete: true,
    safetyChecklist: {
      goalReviewed: true,
      dietPlanReviewed: true,
      allergiesReviewed: true,
      restrictedFoodsReviewed: true,
      riskFlagsReviewed: true,
      channelPermissionVerified: true,
      adultStatusConfirmed: true,
    },
    dietPlan: {
      summary: "Synthetic V2 rehearsal plan.",
      breakfast: "Profile V2 + menu authority",
    },
  });
}

function buildSyntheticState(client: ClientRecord, goldenCase: FoodDecisionV2GoldenCase): ManuAppState {
  const base = createInitialState();
  const seeded = seedFoodDecisionV2GoldenCaseState(goldenCase, client.id, { ...base, clients: [client] });
  const conversation = {
    id: `conversation-${client.id}`,
    tenantId: DEMO_TENANT_ID,
    dietitianId: client.dietitianId,
    clientId: client.id,
    channel: client.channel,
    rollingSummary: "Synthetic V2 food-mix rehearsal.",
    memoryVersion: "memory-v1",
    memoryRevision: 1,
    memoryStale: false,
    revision: 1,
  };
  return {
    ...seeded,
    clients: [client],
    conversations: [conversation],
  };
}

function isUnsafeV2Green(
  riskLevel: RiskLevel,
  client: ClientRecord,
  goldenCase: FoodDecisionV2GoldenCase,
  decision: string,
) {
  if (riskLevel !== "green" || !isAutomatedSendEligible(client)) return false;
  if (decision === "allow" && !goldenCase.expectDecisions.includes("allow")) return true;
  if (decision === "discourage" && !goldenCase.expectDecisions.includes("discourage")) return false;
  return false;
}

export function assignFoodDecisionV2GoldenCaseForClientIndex(
  clientIndex: number,
  cases = loadFoodDecisionV2GoldenCases(),
) {
  return cases[clientIndex % cases.length];
}

export async function evaluateFoodDecisionV2ScenarioAtScale(
  clientMeta: DirectPilotScaleClient,
  clientIndex: number,
  goldenCase: FoodDecisionV2GoldenCase,
) {
  const client = buildSyntheticClient(clientMeta);
  if (client.lifecycleStatus === "removed_anonymized") {
    return {
      unsafeGreen: false,
      inappropriateApproval: 0,
      forbiddenFoodApproval: 0,
      needsLabelCorrect: 0,
      needsReviewCorrect: 0,
      sourceManifestComplete: 0,
      v2Allow: 0,
      v2Discourage: 0,
      v2Forbid: 0,
      v2NeedsReview: 0,
      yellowClientSend: 0,
      redClientSend: 0,
      removedClientBlocked: 1,
    };
  }

  const state = buildSyntheticState(client, goldenCase);
  const v2 = evaluateClientFoodDecisionV2(state, client.id, goldenCase.message, {
    riskLevel: goldenCase.riskLevel || "green",
    productIngredientEvidence: goldenCase.productIngredientEvidence || null,
  });
  const inappropriateApproval =
    v2.decision === "allow" && !goldenCase.expectDecisions.includes("allow") ? 1 : 0;
  const forbiddenFoodApproval =
    v2.decision === "allow" &&
    ["forbidden_food", "forbidden_group", "forbidden_ingredient"].includes(goldenCase.category)
      ? 1
      : 0;
  const classified = await classifySimulationRisk(state, client, goldenCase.message, [], {
    conversationId: `conversation-${client.id}`,
    messageId: `rehearsal-v2-${clientIndex}`,
  });
  const riskLevel = classified.riskDecision.level;
  const sendEligible = isAutomatedSendEligible(client);
  const foodDecisionWouldAutoReply = v2.decision === "allow" || v2.decision === "discourage";

  return {
    unsafeGreen: isUnsafeV2Green(riskLevel, client, goldenCase, v2.decision),
    inappropriateApproval,
    forbiddenFoodApproval,
    needsLabelCorrect:
      goldenCase.category === "product_label_needs_ingredients" && v2.decision === "needs_label" ? 1 : 0,
    needsReviewCorrect:
      ["mixed_clinical_intent", "pregnancy_context", "out_of_catalog_uncertain"].includes(goldenCase.category) &&
      v2.decision === "needs_review"
        ? 1
        : 0,
    sourceManifestComplete: v2.sourceReferences.length > 0 || v2.decision === "not_applicable" ? 1 : 0,
    v2Allow: v2.decision === "allow" ? 1 : 0,
    v2Discourage: v2.decision === "discourage" ? 1 : 0,
    v2Forbid: v2.decision === "forbid" ? 1 : 0,
    v2NeedsReview: v2.decision === "needs_review" ? 1 : 0,
    yellowClientSend:
      sendEligible && riskLevel === "yellow" && foodDecisionWouldAutoReply ? 1 : 0,
    redClientSend: sendEligible && riskLevel === "red" && foodDecisionWouldAutoReply ? 1 : 0,
    removedClientBlocked: 0,
  };
}

export async function runPhase77kFoodMixScaleRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase77kFoodMixRehearsalMetrics> {
  const cases = loadFoodDecisionV2GoldenCases();
  const scenarioCounts: Record<string, number> = {};
  let unsafeGreenCount = 0;
  let inappropriateApprovalCount = 0;
  let forbiddenFoodApprovalCount = 0;
  let needsLabelCorrectCount = 0;
  let needsReviewCorrectCount = 0;
  let sourceManifestCompleteCount = 0;
  let v2AllowCount = 0;
  let v2DiscourageCount = 0;
  let v2ForbidCount = 0;
  let v2NeedsReviewCount = 0;
  let yellowClientSendCount = 0;
  let redClientSendCount = 0;
  let removedClientBlockedCount = 0;

  for (let index = 0; index < fixture.clients.length; index += 1) {
    const clientMeta = fixture.clients[index];
    const goldenCase = assignFoodDecisionV2GoldenCaseForClientIndex(index, cases);
    scenarioCounts[goldenCase.id] = (scenarioCounts[goldenCase.id] ?? 0) + 1;
    const outcome = await evaluateFoodDecisionV2ScenarioAtScale(clientMeta, index, goldenCase);
    if (outcome.unsafeGreen) unsafeGreenCount += 1;
    inappropriateApprovalCount += outcome.inappropriateApproval;
    forbiddenFoodApprovalCount += outcome.forbiddenFoodApproval;
    needsLabelCorrectCount += outcome.needsLabelCorrect;
    needsReviewCorrectCount += outcome.needsReviewCorrect;
    sourceManifestCompleteCount += outcome.sourceManifestComplete;
    v2AllowCount += outcome.v2Allow;
    v2DiscourageCount += outcome.v2Discourage;
    v2ForbidCount += outcome.v2Forbid;
    v2NeedsReviewCount += outcome.v2NeedsReview;
    yellowClientSendCount += outcome.yellowClientSend;
    redClientSendCount += outcome.redClientSend;
    removedClientBlockedCount += outcome.removedClientBlocked;
  }

  const failures: string[] = [];
  if (fixture.dietitians.length < DIRECT_PILOT_SCALE_TARGET.dietitianCount) {
    failures.push("dietitian_count_below_100");
  }
  if (fixture.clients.length < DIRECT_PILOT_SCALE_TARGET.totalClients) {
    failures.push("client_count_below_5000");
  }
  if (unsafeGreenCount > 0) failures.push("unsafe_green_detected");
  if (inappropriateApprovalCount > 0) failures.push("inappropriate_approval_detected");
  if (forbiddenFoodApprovalCount > 0) failures.push("forbidden_food_approval_detected");
  if (yellowClientSendCount > 0) failures.push("yellow_client_send_detected");
  if (redClientSendCount > 0) failures.push("red_client_send_detected");

  return {
    rehearsalVersion: PHASE_77K_FOOD_MIX_REHEARSAL_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    scenarioAssignmentCount: fixture.clients.length,
    unsafeGreenCount,
    inappropriateApprovalCount,
    forbiddenFoodApprovalCount,
    needsLabelCorrectCount,
    needsReviewCorrectCount,
    sourceManifestCompleteCount,
    v2AllowCount,
    v2DiscourageCount,
    v2ForbidCount,
    v2NeedsReviewCount,
    yellowClientSendCount,
    redClientSendCount,
    removedClientBlockedCount,
    duplicateIgnoredCount: 0,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    manualFoodRuleSaveCount: 0,
    scenarioCounts,
    failures,
  };
}

export async function runPhase77kFoodMixRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase77kFoodMixRehearsalMetrics> {
  const scale = await runPhase77kFoodMixScaleRehearsal(fixture);
  const integration = await runPhase76oFoodMixIntegrationChecks();
  const failures = [...scale.failures, ...integration.failures];
  if (integration.unsafeGreenCount > 0) failures.push("integration_unsafe_green_detected");

  return {
    ...scale,
    duplicateIgnoredCount: integration.duplicateIgnoredCount,
    providerFailureHandoffCount: integration.providerFailureHandoffCount,
    staleDraftInvalidatedCount: integration.staleDraftInvalidatedCount,
    manualFoodRuleSaveCount: integration.manualFoodRuleSaveCount,
    unsafeGreenCount: scale.unsafeGreenCount + integration.unsafeGreenCount,
    failures: Array.from(new Set(failures)),
    status: failures.length === 0 ? "pass" : "fail",
  };
}

export function evaluatePhase77kFoodMixSampleEvidence(): Phase77kFoodMixRehearsalMetrics {
  const fixture = createDirectPilotScaleFixture();
  const cases = loadFoodDecisionV2GoldenCases();
  const scenarioCounts: Record<string, number> = {};
  let unsafeGreenCount = 0;
  let inappropriateApprovalCount = 0;
  let forbiddenFoodApprovalCount = 0;
  let needsLabelCorrectCount = 0;
  let needsReviewCorrectCount = 0;
  let sourceManifestCompleteCount = 0;
  let v2AllowCount = 0;
  let v2DiscourageCount = 0;
  let v2ForbidCount = 0;
  let v2NeedsReviewCount = 0;

  for (let index = 0; index < cases.length; index += 1) {
    const goldenCase = cases[index];
    scenarioCounts[goldenCase.id] = (scenarioCounts[goldenCase.id] ?? 0) + 1;
    const evaluated = evaluateFoodDecisionV2GoldenCase(goldenCase);
    if (evaluated.failures.includes("inappropriate_approval")) inappropriateApprovalCount += 1;
    if (evaluated.failures.includes("forbidden_food_approval")) forbiddenFoodApprovalCount += 1;
    if (goldenCase.category === "product_label_needs_ingredients" && evaluated.decision === "needs_label") {
      needsLabelCorrectCount += 1;
    }
    if (
      ["mixed_clinical_intent", "pregnancy_context", "out_of_catalog_uncertain"].includes(goldenCase.category) &&
      evaluated.decision === "needs_review"
    ) {
      needsReviewCorrectCount += 1;
    }
    if (evaluated.sourceReferenceCount > 0 || evaluated.decision === "not_applicable") {
      sourceManifestCompleteCount += 1;
    }
    if (evaluated.decision === "allow") v2AllowCount += 1;
    if (evaluated.decision === "discourage") v2DiscourageCount += 1;
    if (evaluated.decision === "forbid") v2ForbidCount += 1;
    if (evaluated.decision === "needs_review") v2NeedsReviewCount += 1;
    if (!evaluated.passed && evaluated.failures.some((item) => item.includes("inappropriate"))) {
      unsafeGreenCount += 1;
    }
  }

  const failures: string[] = [];
  if (fixture.dietitians.length < DIRECT_PILOT_SCALE_TARGET.dietitianCount) {
    failures.push("dietitian_count_below_100");
  }
  if (fixture.clients.length < DIRECT_PILOT_SCALE_TARGET.totalClients) {
    failures.push("client_count_below_5000");
  }
  if (cases.some((item) => evaluateFoodDecisionV2GoldenCase(item).passed === false)) {
    failures.push("golden_case_failure");
  }

  return {
    rehearsalVersion: PHASE_77K_FOOD_MIX_REHEARSAL_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    scenarioAssignmentCount: cases.length,
    unsafeGreenCount,
    inappropriateApprovalCount,
    forbiddenFoodApprovalCount,
    needsLabelCorrectCount,
    needsReviewCorrectCount,
    sourceManifestCompleteCount,
    v2AllowCount,
    v2DiscourageCount,
    v2ForbidCount,
    v2NeedsReviewCount,
    yellowClientSendCount: 0,
    redClientSendCount: 0,
    removedClientBlockedCount: 0,
    duplicateIgnoredCount: 0,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    manualFoodRuleSaveCount: 0,
    scenarioCounts,
    failures,
  };
}

export function buildPhase77kFoodMixHealthSignal(
  metrics: Phase77kFoodMixRehearsalMetrics = evaluatePhase77kFoodMixSampleEvidence(),
) {
  return {
    rehearsalVersion: metrics.rehearsalVersion,
    status: metrics.status,
    dietitianCount: metrics.dietitianCount,
    clientCount: metrics.clientCount,
    unsafeGreenCount: metrics.unsafeGreenCount,
    inappropriateApprovalCount: metrics.inappropriateApprovalCount,
    forbiddenFoodApprovalCount: metrics.forbiddenFoodApprovalCount,
    sourceManifestCompleteCount: metrics.sourceManifestCompleteCount,
    v2AllowCount: metrics.v2AllowCount,
    v2ForbidCount: metrics.v2ForbidCount,
    manualFoodRuleSaveCount: metrics.manualFoodRuleSaveCount,
  };
}

export function buildPhase77kFoodMixEvidencePackMetrics(
  metrics: Phase77kFoodMixRehearsalMetrics,
): Record<string, number | string> {
  return {
    rehearsalVersion: metrics.rehearsalVersion,
    status: metrics.status,
    dietitian_count: metrics.dietitianCount,
    client_count: metrics.clientCount,
    unsafe_green_count: metrics.unsafeGreenCount,
    inappropriate_approval_count: metrics.inappropriateApprovalCount,
    forbidden_food_approval_count: metrics.forbiddenFoodApprovalCount,
    needs_label_correct_count: metrics.needsLabelCorrectCount,
    needs_review_correct_count: metrics.needsReviewCorrectCount,
    source_manifest_complete_count: metrics.sourceManifestCompleteCount,
    v2_allow_count: metrics.v2AllowCount,
    v2_discourage_count: metrics.v2DiscourageCount,
    v2_forbid_count: metrics.v2ForbidCount,
    v2_needs_review_count: metrics.v2NeedsReviewCount,
  };
}
