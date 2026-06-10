import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClientUpdateProposalInState } from "./client-update-proposals";
import { saveFormResponseInState } from "./app-state-store";
import { createDefaultFoodRuleDashboardState, saveClientFoodRulesInState } from "./phase-76j-food-rule-dashboard";
import { PHASE_77B_CHAT_MUTATION_DISABLED_ERROR } from "./phase-77b-chat-mutation-boundary";
import { evaluateClientFoodRuleDecision } from "./food-rule-runtime";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { classifySimulationRisk } from "./simulator-risk";
import {
  createDirectPilotScaleFixture,
  DIRECT_PILOT_SCALE_TARGET,
  type DirectPilotScaleClient,
  type DirectPilotScaleFixture,
} from "./direct-pilot-scale-readiness";
import { createBlankClient, createInitialState, DEMO_FORM_SCHEMA_ID, DEMO_TENANT_ID } from "./seed-data";
import { runInboundSimulation } from "./simulator";
import type { ClientRecord, ConversationRecord, ManuAppState, RiskLevel } from "./types";

export const PHASE_76O_FOOD_MIX_REHEARSAL_VERSION = "phase-76o-food-mix-rehearsal-v1";

export type FoodMixRehearsalScenario = {
  id: string;
  message: string;
  formOverrides?: Record<string, unknown>;
  clientOverrides?: Partial<ClientRecord>;
  expectFoodRuleDecision: string;
  expectUnsafeGreen: boolean;
  expectClientSend: boolean;
  integrationOnly?: boolean;
};

export type Phase76oFoodMixRehearsalMetrics = {
  rehearsalVersion: string;
  status: "pass" | "fail";
  dietitianCount: number;
  clientCount: number;
  scenarioAssignmentCount: number;
  duplicateIgnoredCount: number;
  unsafeGreenCount: number;
  foodRuleGreenCount: number;
  foodRuleHandoffCount: number;
  foodRuleNoSourceHandoffCount: number;
  yellowClientSendCount: number;
  redClientSendCount: number;
  providerFailureHandoffCount: number;
  staleDraftInvalidatedCount: number;
  manualFoodRuleSaveCount: number;
  removedClientBlockedCount: number;
  scenarioCounts: Record<string, number>;
  failures: string[];
};

const FOOD_RULE_GREEN_DECISIONS = new Set([
  "allowed_food_confirmation",
  "equivalent_substitution_allowed",
  "diet_type_compatible",
  "optional_skip_allowed",
]);

const FOOD_RULE_HANDOFF_DECISIONS = new Set([
  "unknown_food_requires_review",
  "mandatory_skip_blocked",
  "mixed_intent_blocked",
  "product_ingredient_unknown",
  "product_ingredient_conflict",
  "diet_type_conflict",
]);

let cachedScenarios: FoodMixRehearsalScenario[] | null = null;

export function loadFoodMixRehearsalScenarios(): FoodMixRehearsalScenario[] {
  if (cachedScenarios) return cachedScenarios;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(moduleDir, "food-mix-rehearsal-scenarios.jsonl"), "utf8");
  cachedScenarios = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FoodMixRehearsalScenario);
  return cachedScenarios;
}

export function assignFoodMixScenarioForClientIndex(
  clientIndex: number,
  scenarios: FoodMixRehearsalScenario[] = loadFoodMixRehearsalScenarios(),
) {
  return scenarios[clientIndex % scenarios.length];
}

export function buildFoodMixRehearsalClient(
  clientMeta: DirectPilotScaleClient,
  scenario: FoodMixRehearsalScenario,
): ClientRecord {
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
      summary: "Synthetic rehearsal plan with structured food rules.",
      breakfast: "Eggs or approved substitute",
    },
    ...scenario.clientOverrides,
  });
}

export function buildFoodMixRehearsalStateForClient(
  client: ClientRecord,
  scenario: FoodMixRehearsalScenario,
): ManuAppState {
  const base = createInitialState();
  const conversation: ConversationRecord = {
    id: `conversation-${client.id}`,
    tenantId: DEMO_TENANT_ID,
    dietitianId: client.dietitianId,
    clientId: client.id,
    channel: client.channel,
    rollingSummary: "Synthetic food-mix rehearsal conversation.",
    memoryVersion: "memory-v1",
    memoryRevision: 1,
    memoryStale: false,
  };

  let state: ManuAppState = {
    ...base,
    clients: [client],
    conversations: [conversation],
    clientFormResponses: [],
    messages: [],
    processedSimulationKeys: [],
    lastSimulation: null,
  };

  if (client.lifecycleStatus !== "removed_anonymized") {
    state = saveFormResponseInState(state, {
      clientId: client.id,
      schemaId: DEMO_FORM_SCHEMA_ID,
      submittedPhoneE164: "+905550000000",
      answers: {
        ...buildPhase70QualifiedClientAnswers(),
        ...scenario.formOverrides,
      },
    });
  }

  return state;
}

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

function isUnsafeGreen(riskLevel: RiskLevel, client: ClientRecord, foodRuleDecision: string) {
  if (riskLevel !== "green" || !isAutomatedSendEligible(client)) return false;
  if (
    FOOD_RULE_GREEN_DECISIONS.has(foodRuleDecision) ||
    foodRuleDecision === "forbidden_food_rejection" ||
    FOOD_RULE_HANDOFF_DECISIONS.has(foodRuleDecision) ||
    foodRuleDecision === "not_applicable"
  ) {
    return false;
  }
  return true;
}

function countFoodRuleNoSourceHandoff(client: ClientRecord, foodRuleReasons: string[]) {
  if (client.lifecycleStatus === "removed_anonymized") return 0;
  return foodRuleReasons.includes("food_rule_structured_rules_missing") ? 1 : 0;
}

export async function evaluateFoodMixScenarioAtScale(
  clientMeta: DirectPilotScaleClient,
  clientIndex: number,
  scenario: FoodMixRehearsalScenario,
) {
  const client = buildFoodMixRehearsalClient(clientMeta, scenario);
  const state = buildFoodMixRehearsalStateForClient(client, scenario);

  if (scenario.integrationOnly) {
    return {
      unsafeGreen: false,
      foodRuleGreen: false,
      foodRuleHandoff: false,
      foodRuleNoSourceHandoff: 0,
      yellowClientSend: 0,
      redClientSend: 0,
      removedClientBlocked: 0,
    };
  }

  if (client.lifecycleStatus === "removed_anonymized") {
    return {
      unsafeGreen: false,
      foodRuleGreen: false,
      foodRuleHandoff: false,
      foodRuleNoSourceHandoff: 0,
      yellowClientSend: 0,
      redClientSend: 0,
      removedClientBlocked: 1,
    };
  }

  const foodRule = evaluateClientFoodRuleDecision(state, client.id, scenario.message);
  const classified = await classifySimulationRisk(state, client, scenario.message, [], {
    conversationId: `conversation-${client.id}`,
    messageId: `rehearsal-${clientIndex}`,
  });
  const riskLevel = classified.riskDecision.level;
  const unsafeGreen = isUnsafeGreen(riskLevel, client, foodRule.decision);
  const foodRuleGreen = FOOD_RULE_GREEN_DECISIONS.has(foodRule.decision);
  const foodRuleHandoff = FOOD_RULE_HANDOFF_DECISIONS.has(foodRule.decision);
  const foodRuleNoSourceHandoff = countFoodRuleNoSourceHandoff(client, foodRule.reasons);
  const sendEligible = isAutomatedSendEligible(client);

  return {
    unsafeGreen,
    foodRuleGreen,
    foodRuleHandoff,
    foodRuleNoSourceHandoff,
    yellowClientSend: sendEligible && riskLevel === "yellow" ? 1 : 0,
    redClientSend: sendEligible && riskLevel === "red" ? 1 : 0,
    removedClientBlocked: 0,
  };
}

export async function runPhase76oFoodMixScaleRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase76oFoodMixRehearsalMetrics> {
  const scenarios = loadFoodMixRehearsalScenarios();
  const scenarioCounts: Record<string, number> = {};
  let unsafeGreenCount = 0;
  let foodRuleGreenCount = 0;
  let foodRuleHandoffCount = 0;
  let foodRuleNoSourceHandoffCount = 0;
  let yellowClientSendCount = 0;
  let redClientSendCount = 0;
  let removedClientBlockedCount = 0;

  for (let index = 0; index < fixture.clients.length; index += 1) {
    const clientMeta = fixture.clients[index];
    const scenario = assignFoodMixScenarioForClientIndex(index, scenarios);
    scenarioCounts[scenario.id] = (scenarioCounts[scenario.id] ?? 0) + 1;
    const outcome = await evaluateFoodMixScenarioAtScale(clientMeta, index, scenario);
    if (outcome.unsafeGreen) unsafeGreenCount += 1;
    if (outcome.foodRuleGreen) foodRuleGreenCount += 1;
    if (outcome.foodRuleHandoff) foodRuleHandoffCount += 1;
    foodRuleNoSourceHandoffCount += outcome.foodRuleNoSourceHandoff;
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
  if (yellowClientSendCount > 0) failures.push("yellow_client_send_detected");
  if (redClientSendCount > 0) failures.push("red_client_send_detected");

  return {
    rehearsalVersion: PHASE_76O_FOOD_MIX_REHEARSAL_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    scenarioAssignmentCount: fixture.clients.length,
    duplicateIgnoredCount: 0,
    unsafeGreenCount,
    foodRuleGreenCount,
    foodRuleHandoffCount,
    foodRuleNoSourceHandoffCount,
    yellowClientSendCount,
    redClientSendCount,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    manualFoodRuleSaveCount: 0,
    removedClientBlockedCount,
    scenarioCounts,
    failures,
  };
}

export async function runPhase76oFoodMixIntegrationChecks(): Promise<
  Pick<
    Phase76oFoodMixRehearsalMetrics,
    | "duplicateIgnoredCount"
    | "providerFailureHandoffCount"
    | "staleDraftInvalidatedCount"
    | "manualFoodRuleSaveCount"
    | "unsafeGreenCount"
    | "yellowClientSendCount"
    | "redClientSendCount"
    | "failures"
  >
> {
  const failures: string[] = [];
  let duplicateIgnoredCount = 0;
  let providerFailureHandoffCount = 0;
  let staleDraftInvalidatedCount = 0;
  let manualFoodRuleSaveCount = 0;
  let unsafeGreenCount = 0;
  const yellowClientSendCount = 0;
  const redClientSendCount = 0;

  const state = createInitialState();
  const first = await runInboundSimulation(state, {
    clientId: "client-mert",
    body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
    idempotencyKey: "phase76o-duplicate",
    now: "2026-06-08T10:00:00.000Z",
  });
  const second = await runInboundSimulation(first, {
    clientId: "client-mert",
    body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
    idempotencyKey: "phase76o-duplicate",
    now: "2026-06-08T10:01:00.000Z",
  });
  if (second.lastSimulation?.action === "duplicate_ignored") {
    duplicateIgnoredCount += 1;
  } else {
    failures.push("duplicate_inbound_not_ignored");
  }

  const providerState = await runInboundSimulation(state, {
    clientId: "client-mert",
    body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
    idempotencyKey: "phase76o-provider-failure",
    mockProviderFailure: "provider_timeout",
    now: "2026-06-08T10:02:00.000Z",
  });
  if (providerState.lastSimulation?.action === "handoff") {
    providerFailureHandoffCount += 1;
  } else {
    failures.push("provider_failure_not_handoff");
  }
  const providerDecision = providerState.aiDecisions.at(-1);
  if (providerDecision?.risk === "green" && providerDecision.sendStatus === "sent") {
    unsafeGreenCount += 1;
  }

  const withDraft = await runInboundSimulation(state, {
    clientId: "client-elif",
    body: "D vitamini takviyesi kullanayim mi?",
    idempotencyKey: "phase76o-draft-1",
    now: "2026-06-08T10:03:00.000Z",
  });
  const staleDraftState = {
    ...withDraft,
    messages: [
      ...withDraft.messages,
      {
        id: "draft-stale-rehearsal",
        tenantId: DEMO_TENANT_ID,
        conversationId: "conversation-client-elif",
        sender: "assistant" as const,
        origin: "ai_generated" as const,
        body: "Stale draft body",
        status: "draft" as const,
        createdAt: "2026-06-07T00:00:00.000Z",
      },
    ],
    clients: withDraft.clients.map((client) =>
      client.id === "client-elif" ? { ...client, contextRevision: client.contextRevision + 1 } : client,
    ),
  };
  const afterInbound = await runInboundSimulation(staleDraftState, {
    clientId: "client-elif",
    body: "Bugun ogle yemeginde tavuk yerine hindi olur mu?",
    idempotencyKey: "phase76o-stale-draft",
    now: "2026-06-08T10:04:00.000Z",
  });
  const staleDraft = afterInbound.messages.find((message) => message.id === "draft-stale-rehearsal");
  if (staleDraft?.status === "blocked") {
    staleDraftInvalidatedCount += 1;
  } else {
    failures.push("stale_draft_not_invalidated");
  }

  const withForm = saveFormResponseInState(state, {
    clientId: "client-mert",
    schemaId: DEMO_FORM_SCHEMA_ID,
    submittedPhoneE164: "+905551110001",
    answers: buildPhase70QualifiedClientAnswers(),
  });
  try {
    createClientUpdateProposalInState(withForm, "client-mert", {
      sourceText: "Artik sut urunleri yasak.",
    });
    failures.push("chat_mutation_not_blocked");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== PHASE_77B_CHAT_MUTATION_DISABLED_ERROR) {
      failures.push("chat_mutation_wrong_error");
    }
  }

  const saved = saveClientFoodRulesInState(
    withForm,
    "client-mert",
    {
      ...createDefaultFoodRuleDashboardState(),
      forbiddenFoodGroups: ["Sut urunleri"],
    },
    "2026-06-08T10:05:00.000Z",
  );
  const response = saved.clientFormResponses.find((item) => item.clientId === "client-mert");
  if (String(response?.answers.forbidden_food_groups || "").includes("Sut urunleri")) {
    manualFoodRuleSaveCount += 1;
  } else {
    failures.push("manual_food_rule_save_failed");
  }

  return {
    duplicateIgnoredCount,
    providerFailureHandoffCount,
    staleDraftInvalidatedCount,
    manualFoodRuleSaveCount,
    unsafeGreenCount,
    yellowClientSendCount,
    redClientSendCount,
    failures,
  };
}

export async function runPhase76oFoodMixRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase76oFoodMixRehearsalMetrics> {
  const scale = await runPhase76oFoodMixScaleRehearsal(fixture);
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
    yellowClientSendCount: scale.yellowClientSendCount + integration.yellowClientSendCount,
    redClientSendCount: scale.redClientSendCount + integration.redClientSendCount,
    failures: Array.from(new Set(failures)),
    status: failures.length === 0 ? "pass" : "fail",
  };
}

export function buildPhase76oFoodMixEvidencePackMetrics(
  metrics: Phase76oFoodMixRehearsalMetrics,
): Record<string, number | string> {
  return {
    rehearsalVersion: metrics.rehearsalVersion,
    status: metrics.status,
    dietitian_count: metrics.dietitianCount,
    client_count: metrics.clientCount,
    duplicate_ignored_count: metrics.duplicateIgnoredCount,
    unsafe_green_count: metrics.unsafeGreenCount,
    food_rule_green_count: metrics.foodRuleGreenCount,
    food_rule_handoff_count: metrics.foodRuleHandoffCount,
    food_rule_no_source_handoff_count: metrics.foodRuleNoSourceHandoffCount,
    provider_failure_handoff_count: metrics.providerFailureHandoffCount,
    stale_draft_invalidated_count: metrics.staleDraftInvalidatedCount,
    manual_food_rule_save_count: metrics.manualFoodRuleSaveCount,
    removed_client_blocked_count: metrics.removedClientBlockedCount,
  };
}

export function evaluatePhase76oFoodMixSampleEvidence(): Pick<
  Phase76oFoodMixRehearsalMetrics,
  | "rehearsalVersion"
  | "status"
  | "dietitianCount"
  | "clientCount"
  | "unsafeGreenCount"
  | "foodRuleGreenCount"
  | "foodRuleHandoffCount"
  | "foodRuleNoSourceHandoffCount"
  | "removedClientBlockedCount"
  | "scenarioCounts"
  | "failures"
> {
  const fixture = createDirectPilotScaleFixture();
  const scenarios = loadFoodMixRehearsalScenarios();
  const scenarioCounts: Record<string, number> = {};
  let unsafeGreenCount = 0;
  let foodRuleGreenCount = 0;
  let foodRuleHandoffCount = 0;
  let foodRuleNoSourceHandoffCount = 0;
  let removedClientBlockedCount = 0;

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    if (scenario.integrationOnly) continue;
    scenarioCounts[scenario.id] = (scenarioCounts[scenario.id] ?? 0) + 1;
    const clientMeta = fixture.clients[index];
    const client = buildFoodMixRehearsalClient(clientMeta, scenario);
    const state = buildFoodMixRehearsalStateForClient(client, scenario);
    if (client.lifecycleStatus === "removed_anonymized") {
      removedClientBlockedCount += 1;
      continue;
    }
    const foodRule = evaluateClientFoodRuleDecision(state, client.id, scenario.message);
    if (FOOD_RULE_GREEN_DECISIONS.has(foodRule.decision)) foodRuleGreenCount += 1;
    if (FOOD_RULE_HANDOFF_DECISIONS.has(foodRule.decision)) foodRuleHandoffCount += 1;
    foodRuleNoSourceHandoffCount += countFoodRuleNoSourceHandoff(client, foodRule.reasons);
    if (isUnsafeGreen("green", client, foodRule.decision)) {
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
  if (unsafeGreenCount > 0) failures.push("unsafe_green_detected");

  return {
    rehearsalVersion: PHASE_76O_FOOD_MIX_REHEARSAL_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    unsafeGreenCount,
    foodRuleGreenCount,
    foodRuleHandoffCount,
    foodRuleNoSourceHandoffCount,
    removedClientBlockedCount,
    scenarioCounts,
    failures,
  };
}

export function buildPhase76oFoodMixHealthSignal(
  metrics: Phase76oFoodMixRehearsalMetrics = {
    rehearsalVersion: PHASE_76O_FOOD_MIX_REHEARSAL_VERSION,
    status: "fail",
    dietitianCount: 0,
    clientCount: 0,
    scenarioAssignmentCount: 0,
    duplicateIgnoredCount: 0,
    unsafeGreenCount: 0,
    foodRuleGreenCount: 0,
    foodRuleHandoffCount: 0,
    foodRuleNoSourceHandoffCount: 0,
    yellowClientSendCount: 0,
    redClientSendCount: 0,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    manualFoodRuleSaveCount: 0,
    removedClientBlockedCount: 0,
    scenarioCounts: {},
    failures: ["food_mix_rehearsal_not_run"],
  },
) {
  return {
    rehearsalVersion: metrics.rehearsalVersion,
    status: metrics.status,
    dietitianCount: metrics.dietitianCount,
    clientCount: metrics.clientCount,
    duplicateIgnoredCount: metrics.duplicateIgnoredCount,
    unsafeGreenCount: metrics.unsafeGreenCount,
    foodRuleGreenCount: metrics.foodRuleGreenCount,
    foodRuleNoSourceHandoffCount: metrics.foodRuleNoSourceHandoffCount,
    providerFailureHandoffCount: metrics.providerFailureHandoffCount,
    manualFoodRuleSaveCount: metrics.manualFoodRuleSaveCount,
    removedClientBlockedCount: metrics.removedClientBlockedCount,
  };
}
