import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { saveFormResponseInState } from "./app-state-store";
import { processMockChannelInbound, type NormalizedInboundChannelEvent } from "./channel-adapters";
import {
  createDirectPilotScaleFixture,
  DIRECT_PILOT_SCALE_TARGET,
  type DirectPilotScaleClient,
  type DirectPilotScaleFixture,
} from "./direct-pilot-scale-readiness";
import { evaluateClientFoodRuleDecision } from "./food-rule-runtime";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { resetRateLimits } from "./rate-limit";
import { createBlankClient, createInitialState, DEMO_FORM_SCHEMA_ID, DEMO_TENANT_ID } from "./seed-data";
import { runInboundSimulation } from "./simulator";
import type { ClientRecord, ConversationRecord, ManuAppState, RiskLevel } from "./types";

export const PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION = "phase-77ag-channel-replay-rehearsal-v1";

export type ChannelReplayRehearsalScenario = {
  id: string;
  message: string;
  formOverrides?: Record<string, unknown>;
  clientOverrides?: Partial<ClientRecord>;
  channelEventOverrides?: Partial<NormalizedInboundChannelEvent>;
  expectUnsafeGreen: boolean;
  expectClientSend: boolean;
  integrationOnly?: boolean;
};

export type Phase77agChannelReplayRehearsalMetrics = {
  rehearsalVersion: string;
  status: "pass" | "fail";
  dietitianCount: number;
  clientCount: number;
  scenarioAssignmentCount: number;
  duplicateClientSendCount: number;
  unknownIdentityProviderCallCount: number;
  yellowRedClientSendCount: number;
  unsafeGreenCount: number;
  duplicateIgnoredCount: number;
  quarantineCount: number;
  optOutBlockedCount: number;
  providerFailureHandoffCount: number;
  staleDraftInvalidatedCount: number;
  groupQuarantineCount: number;
  removedClientBlockedCount: number;
  scenarioCounts: Record<string, number>;
  hardZeroFailures: string[];
  failures: string[];
  elapsedMs: number;
};

const FOOD_RULE_GREEN_DECISIONS = new Set([
  "allowed_food_confirmation",
  "equivalent_substitution_allowed",
  "approved_substitution",
  "diet_type_compatible",
  "optional_skip_allowed",
  "allowed",
]);

const FOOD_RULE_HANDOFF_DECISIONS = new Set([
  "unknown_food_requires_review",
  "mandatory_skip_blocked",
  "mixed_intent_blocked",
  "product_ingredient_unknown",
  "product_ingredient_conflict",
  "diet_type_conflict",
  "forbidden_food_rejection",
]);

let cachedScenarios: ChannelReplayRehearsalScenario[] | null = null;

export function loadChannelReplayRehearsalScenarios(): ChannelReplayRehearsalScenario[] {
  if (cachedScenarios) return cachedScenarios;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(moduleDir, "channel-replay-scenarios.jsonl"), "utf8");
  cachedScenarios = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChannelReplayRehearsalScenario);
  return cachedScenarios;
}

export function assignChannelReplayScenarioForClientIndex(
  clientIndex: number,
  scenarios: ChannelReplayRehearsalScenario[] = loadChannelReplayRehearsalScenarios(),
) {
  return scenarios[clientIndex % scenarios.length];
}

export function syntheticChannelUserId(clientIndex: number) {
  return `+9055${String(1_000_000 + clientIndex).slice(-7)}`;
}

export function buildChannelReplayRehearsalClient(
  clientMeta: DirectPilotScaleClient,
  clientIndex: number,
  scenario: ChannelReplayRehearsalScenario,
): ClientRecord {
  const channelUserId = syntheticChannelUserId(clientIndex);
  return createBlankClient({
    id: clientMeta.id,
    dietitianId: clientMeta.dietitianId,
    fullName: `Synthetic Client ${clientMeta.id.slice(-5)}`,
    primaryPhoneE164: channelUserId,
    aiStatus: clientMeta.aiStatus,
    aiMode: "autopilot",
    channel: "whatsapp",
    channelUserId,
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
      summary: "Synthetic channel replay rehearsal plan with structured food rules.",
      breakfast: "Eggs or approved substitute",
    },
    ...scenario.clientOverrides,
  });
}

export function buildChannelReplayRehearsalStateForClient(
  client: ClientRecord,
  scenario: ChannelReplayRehearsalScenario,
): ManuAppState {
  const base = createInitialState();
  const conversation: ConversationRecord = {
    id: `conversation-${client.id}`,
    tenantId: DEMO_TENANT_ID,
    dietitianId: client.dietitianId,
    clientId: client.id,
    channel: client.channel,
    rollingSummary: "Synthetic channel replay rehearsal conversation.",
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
      submittedPhoneE164: client.primaryPhoneE164 ?? "+905550000000",
      answers: {
        ...buildPhase70QualifiedClientAnswers(),
        ...scenario.formOverrides,
      },
    });
  }

  return state;
}

function buildChannelReplayEvent(
  client: ClientRecord,
  clientIndex: number,
  scenario: ChannelReplayRehearsalScenario,
): NormalizedInboundChannelEvent {
  const event: NormalizedInboundChannelEvent = {
    channel: "whatsapp",
    providerEventId: `phase77ag-${scenario.id}-${clientIndex}`,
    channelUserId: client.channelUserId,
    body: scenario.message,
    receivedAt: "2026-06-08T10:00:00.000Z",
    sourceConversationType: "direct",
    ...scenario.channelEventOverrides,
  };

  if (scenario.id === "unknown_identity") {
    event.channelUserId = `+9000${String(1_000_000 + clientIndex).slice(-7)}`;
  }

  return event;
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

function isUnsafeGreen(riskLevel: RiskLevel | null, client: ClientRecord, foodRuleDecision: string) {
  if (riskLevel !== "green" || !isAutomatedSendEligible(client)) return false;
  if (
    FOOD_RULE_GREEN_DECISIONS.has(foodRuleDecision) ||
    FOOD_RULE_HANDOFF_DECISIONS.has(foodRuleDecision) ||
    foodRuleDecision === "not_applicable"
  ) {
    return false;
  }
  return true;
}

function countYellowRedClientSend(client: ClientRecord, after: ManuAppState) {
  const simulation = after.lastSimulation;
  if (simulation?.action !== "sent") return 0;
  if (client.yellowRiskHold.status === "active" || client.redRiskLock.status === "locked") return 1;
  if (simulation.risk === "yellow" || simulation.risk === "red") return 1;
  return 0;
}

function collectHardZeroFailures(metrics: Pick<
  Phase77agChannelReplayRehearsalMetrics,
  | "duplicateClientSendCount"
  | "unknownIdentityProviderCallCount"
  | "yellowRedClientSendCount"
  | "unsafeGreenCount"
>) {
  const failures: string[] = [];
  if (metrics.duplicateClientSendCount > 0) failures.push("duplicate_client_send_detected");
  if (metrics.unknownIdentityProviderCallCount > 0) failures.push("unknown_identity_provider_call_detected");
  if (metrics.yellowRedClientSendCount > 0) failures.push("yellow_red_client_send_detected");
  if (metrics.unsafeGreenCount > 0) failures.push("unsafe_green_detected");
  return failures;
}

export async function evaluateChannelReplayScenarioAtScale(
  clientMeta: DirectPilotScaleClient,
  clientIndex: number,
  scenario: ChannelReplayRehearsalScenario,
) {
  if (scenario.integrationOnly) {
    return {
      duplicateClientSend: 0,
      unknownIdentityProviderCall: 0,
      yellowRedClientSend: 0,
      unsafeGreen: 0,
      groupQuarantine: 0,
      optOutBlocked: 0,
      removedClientBlocked: 0,
    };
  }

  const client = buildChannelReplayRehearsalClient(clientMeta, clientIndex, scenario);
  const state = buildChannelReplayRehearsalStateForClient(client, scenario);

  if (client.lifecycleStatus === "removed_anonymized") {
    return {
      duplicateClientSend: 0,
      unknownIdentityProviderCall: 0,
      yellowRedClientSend: 0,
      unsafeGreen: 0,
      groupQuarantine: 0,
      optOutBlocked: 0,
      removedClientBlocked: 1,
    };
  }

  const beforeDecisions = state.aiDecisions.length;
  const beforeMessages = state.messages.length;
  const event = buildChannelReplayEvent(client, clientIndex, scenario);
  const after = await processMockChannelInbound(state, event);
  const simulation = after.lastSimulation;

  const unknownIdentityProviderCall =
    scenario.id === "unknown_identity" && after.aiDecisions.length > beforeDecisions ? 1 : 0;
  const yellowRedClientSend = countYellowRedClientSend(client, after);
  const groupQuarantine = simulation?.blockedReason === "whatsapp_group_unsupported" ? 1 : 0;
  const optOutBlocked =
    client.channelPermission === "opted_out" && simulation?.action === "no_ai" ? 1 : 0;

  const foodRule = evaluateClientFoodRuleDecision(after, client.id, scenario.message);
  const unsafeGreen =
    simulation?.action === "sent" && simulation.risk === "green"
      ? isUnsafeGreen("green", client, foodRule.decision)
        ? 1
        : 0
      : 0;

  const duplicateClientSend =
    simulation?.action === "duplicate_ignored" &&
    (after.messages.length > beforeMessages || after.aiDecisions.length > beforeDecisions)
      ? 1
      : 0;

  return {
    duplicateClientSend,
    unknownIdentityProviderCall,
    yellowRedClientSend,
    unsafeGreen,
    groupQuarantine,
    optOutBlocked,
    removedClientBlocked: 0,
  };
}

export async function runPhase77agChannelReplayScaleRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase77agChannelReplayRehearsalMetrics> {
  const startedAt = Date.now();
  resetRateLimits();
  const scenarios = loadChannelReplayRehearsalScenarios();
  const scenarioCounts: Record<string, number> = {};
  let duplicateClientSendCount = 0;
  let unknownIdentityProviderCallCount = 0;
  let yellowRedClientSendCount = 0;
  let unsafeGreenCount = 0;
  let groupQuarantineCount = 0;
  let optOutBlockedCount = 0;
  let removedClientBlockedCount = 0;

  for (let index = 0; index < fixture.clients.length; index += 1) {
    const clientMeta = fixture.clients[index];
    const scenario = assignChannelReplayScenarioForClientIndex(index, scenarios);
    scenarioCounts[scenario.id] = (scenarioCounts[scenario.id] ?? 0) + 1;
    const outcome = await evaluateChannelReplayScenarioAtScale(clientMeta, index, scenario);
    duplicateClientSendCount += outcome.duplicateClientSend;
    unknownIdentityProviderCallCount += outcome.unknownIdentityProviderCall;
    yellowRedClientSendCount += outcome.yellowRedClientSend;
    unsafeGreenCount += outcome.unsafeGreen;
    groupQuarantineCount += outcome.groupQuarantine;
    optOutBlockedCount += outcome.optOutBlocked;
    removedClientBlockedCount += outcome.removedClientBlocked;
  }

  const failures: string[] = [];
  if (fixture.dietitians.length < DIRECT_PILOT_SCALE_TARGET.dietitianCount) {
    failures.push("dietitian_count_below_100");
  }
  if (fixture.clients.length < DIRECT_PILOT_SCALE_TARGET.totalClients) {
    failures.push("client_count_below_5000");
  }

  const hardZeroFailures = collectHardZeroFailures({
    duplicateClientSendCount,
    unknownIdentityProviderCallCount,
    yellowRedClientSendCount,
    unsafeGreenCount,
  });

  return {
    rehearsalVersion: PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
    status: failures.length === 0 && hardZeroFailures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    scenarioAssignmentCount: fixture.clients.length,
    duplicateClientSendCount,
    unknownIdentityProviderCallCount,
    yellowRedClientSendCount,
    unsafeGreenCount,
    duplicateIgnoredCount: 0,
    quarantineCount: 0,
    optOutBlockedCount,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    groupQuarantineCount,
    removedClientBlockedCount,
    scenarioCounts,
    hardZeroFailures,
    failures: [...failures, ...hardZeroFailures],
    elapsedMs: Date.now() - startedAt,
  };
}

export async function runPhase77agChannelReplayIntegrationChecks(): Promise<
  Pick<
    Phase77agChannelReplayRehearsalMetrics,
    | "duplicateIgnoredCount"
    | "duplicateClientSendCount"
    | "unknownIdentityProviderCallCount"
    | "quarantineCount"
    | "providerFailureHandoffCount"
    | "staleDraftInvalidatedCount"
    | "yellowRedClientSendCount"
    | "unsafeGreenCount"
    | "failures"
  >
> {
  resetRateLimits();
  const failures: string[] = [];
  let duplicateIgnoredCount = 0;
  let duplicateClientSendCount = 0;
  let unknownIdentityProviderCallCount = 0;
  let quarantineCount = 0;
  let providerFailureHandoffCount = 0;
  let staleDraftInvalidatedCount = 0;
  let unsafeGreenCount = 0;
  const yellowRedClientSendCount = 0;

  const state = createInitialState();
  const first = await processMockChannelInbound(state, {
    channel: "whatsapp",
    providerEventId: "phase77ag-duplicate",
    channelUserId: "+905551110001",
    body: "Ara ogun icin ne yiyebilirim?",
    receivedAt: "2026-06-08T10:00:00.000Z",
  });
  const second = await processMockChannelInbound(first, {
    channel: "whatsapp",
    providerEventId: "phase77ag-duplicate",
    channelUserId: "+905551110001",
    body: "Ara ogun icin ne yiyebilirim?",
    receivedAt: "2026-06-08T10:01:00.000Z",
  });
  if (second.lastSimulation?.action === "duplicate_ignored") {
    duplicateIgnoredCount += 1;
  } else {
    failures.push("duplicate_inbound_not_ignored");
  }
  if (second.messages.length > first.messages.length || second.aiDecisions.length > first.aiDecisions.length) {
    duplicateClientSendCount += 1;
    failures.push("duplicate_client_send_detected");
  }

  const unknownState = createInitialState();
  const unknownBefore = unknownState.aiDecisions.length;
  const unknownAfter = await processMockChannelInbound(unknownState, {
    channel: "whatsapp",
    providerEventId: "phase77ag-unknown",
    channelUserId: "+900000000000",
    body: "Merhaba planim ne?",
    receivedAt: "2026-06-08T10:02:00.000Z",
  });
  if (unknownAfter.lastSimulation?.blockedReason === "identity_quarantine_unknown_channel_identity") {
    quarantineCount += 1;
  } else {
    failures.push("unknown_identity_not_quarantined");
  }
  if (unknownAfter.aiDecisions.length > unknownBefore) {
    unknownIdentityProviderCallCount += 1;
    failures.push("unknown_identity_provider_call_detected");
  }

  const ambiguousState = {
    ...createInitialState(),
    clients: [
      ...createInitialState().clients,
      {
        ...createInitialState().clients[0],
        id: "client-duplicate-rehearsal",
        fullName: "Duplicate Rehearsal",
      },
    ],
  };
  const ambiguousBefore = ambiguousState.aiDecisions.length;
  const ambiguousAfter = await processMockChannelInbound(ambiguousState, {
    channel: "whatsapp",
    providerEventId: "phase77ag-ambiguous",
    channelUserId: "+905551110001",
    body: "Bugun ne yemeliyim?",
    receivedAt: "2026-06-08T10:03:00.000Z",
  });
  if (ambiguousAfter.lastSimulation?.blockedReason !== "identity_quarantine_ambiguous_channel_identity") {
    failures.push("ambiguous_identity_not_quarantined");
  }
  if (ambiguousAfter.aiDecisions.length > ambiguousBefore) {
    unknownIdentityProviderCallCount += 1;
    failures.push("ambiguous_identity_provider_call_detected");
  }

  const providerState = await runInboundSimulation(state, {
    clientId: "client-mert",
    body: "Izinli alternatif olarak lor peyniri olur mu?",
    idempotencyKey: "phase77ag-provider-failure",
    mockProviderFailure: "provider_timeout",
    now: "2026-06-08T10:04:00.000Z",
  });
  if (providerState.lastSimulation?.action === "handoff") {
    providerFailureHandoffCount += 1;
  } else {
    failures.push("provider_failure_not_handoff");
  }
  const providerDecision = providerState.aiDecisions.at(-1);
  if (providerDecision?.risk === "green" && providerDecision.sendStatus === "sent") {
    unsafeGreenCount += 1;
    failures.push("provider_failure_unsafe_green_detected");
  }

  const withDraft = await runInboundSimulation(state, {
    clientId: "client-elif",
    body: "D vitamini takviyesi kullanayim mi?",
    idempotencyKey: "phase77ag-draft-1",
    now: "2026-06-08T10:05:00.000Z",
  });
  const staleDraftState = {
    ...withDraft,
    messages: [
      ...withDraft.messages,
      {
        id: "draft-stale-channel-rehearsal",
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
  const afterInbound = await processMockChannelInbound(staleDraftState, {
    channel: "telegram",
    providerEventId: "phase77ag-stale-draft",
    channelUserId: "elif_telegram",
    body: "Bugun ogle yemeginde tavuk yerine hindi olur mu?",
    receivedAt: "2026-06-08T10:06:00.000Z",
  });
  const staleDraft = afterInbound.messages.find((message) => message.id === "draft-stale-channel-rehearsal");
  if (staleDraft?.status === "blocked") {
    staleDraftInvalidatedCount += 1;
  } else {
    failures.push("stale_draft_not_invalidated");
  }

  const stopState = createInitialState();
  const stopAfter = await processMockChannelInbound(stopState, {
    channel: "whatsapp",
    providerEventId: "phase77ag-stop",
    channelUserId: "+905551110001",
    body: "STOP",
    receivedAt: "2026-06-08T10:07:00.000Z",
  });
  if (stopAfter.lastSimulation?.blockedReason !== "channel_policy_opt_out_received") {
    failures.push("opt_out_command_not_blocked");
  }

  return {
    duplicateIgnoredCount,
    duplicateClientSendCount,
    unknownIdentityProviderCallCount,
    quarantineCount,
    providerFailureHandoffCount,
    staleDraftInvalidatedCount,
    yellowRedClientSendCount,
    unsafeGreenCount,
    failures,
  };
}

export async function runPhase77agChannelReplayRehearsal(
  fixture: DirectPilotScaleFixture = createDirectPilotScaleFixture(),
): Promise<Phase77agChannelReplayRehearsalMetrics> {
  const scale = await runPhase77agChannelReplayScaleRehearsal(fixture);
  const integration = await runPhase77agChannelReplayIntegrationChecks();
  const hardZeroFailures = collectHardZeroFailures({
    duplicateClientSendCount: scale.duplicateClientSendCount + integration.duplicateClientSendCount,
    unknownIdentityProviderCallCount:
      scale.unknownIdentityProviderCallCount + integration.unknownIdentityProviderCallCount,
    yellowRedClientSendCount: scale.yellowRedClientSendCount + integration.yellowRedClientSendCount,
    unsafeGreenCount: scale.unsafeGreenCount + integration.unsafeGreenCount,
  });
  const failures = Array.from(new Set([...scale.failures, ...integration.failures, ...hardZeroFailures]));

  return {
    ...scale,
    duplicateClientSendCount: scale.duplicateClientSendCount + integration.duplicateClientSendCount,
    unknownIdentityProviderCallCount:
      scale.unknownIdentityProviderCallCount + integration.unknownIdentityProviderCallCount,
    yellowRedClientSendCount: scale.yellowRedClientSendCount + integration.yellowRedClientSendCount,
    unsafeGreenCount: scale.unsafeGreenCount + integration.unsafeGreenCount,
    duplicateIgnoredCount: integration.duplicateIgnoredCount,
    quarantineCount: integration.quarantineCount,
    providerFailureHandoffCount: integration.providerFailureHandoffCount,
    staleDraftInvalidatedCount: integration.staleDraftInvalidatedCount,
    hardZeroFailures,
    failures,
    status: failures.length === 0 ? "pass" : "fail",
    elapsedMs: scale.elapsedMs,
  };
}

export async function runPhase77agChannelReplaySampleEvidence(): Promise<Phase77agChannelReplayRehearsalMetrics> {
  const startedAt = Date.now();
  resetRateLimits();
  const fixture = createDirectPilotScaleFixture();
  const scenarios = loadChannelReplayRehearsalScenarios();
  const scenarioCounts: Record<string, number> = {};
  let duplicateClientSendCount = 0;
  let unknownIdentityProviderCallCount = 0;
  let yellowRedClientSendCount = 0;
  let unsafeGreenCount = 0;
  let groupQuarantineCount = 0;
  let optOutBlockedCount = 0;
  let removedClientBlockedCount = 0;

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    if (scenario.integrationOnly) continue;
    scenarioCounts[scenario.id] = (scenarioCounts[scenario.id] ?? 0) + 1;
    const clientMeta = fixture.clients[index];
    const outcome = await evaluateChannelReplayScenarioAtScale(clientMeta, index, scenario);
    duplicateClientSendCount += outcome.duplicateClientSend;
    unknownIdentityProviderCallCount += outcome.unknownIdentityProviderCall;
    yellowRedClientSendCount += outcome.yellowRedClientSend;
    unsafeGreenCount += outcome.unsafeGreen;
    groupQuarantineCount += outcome.groupQuarantine;
    optOutBlockedCount += outcome.optOutBlocked;
    removedClientBlockedCount += outcome.removedClientBlocked;
  }

  const integration = await runPhase77agChannelReplayIntegrationChecks();
  const mergedDuplicateClientSendCount = duplicateClientSendCount + integration.duplicateClientSendCount;
  const mergedUnknownIdentityProviderCallCount =
    unknownIdentityProviderCallCount + integration.unknownIdentityProviderCallCount;
  const mergedYellowRedClientSendCount = yellowRedClientSendCount + integration.yellowRedClientSendCount;
  const mergedUnsafeGreenCount = unsafeGreenCount + integration.unsafeGreenCount;

  const failures: string[] = [];
  if (fixture.dietitians.length < DIRECT_PILOT_SCALE_TARGET.dietitianCount) {
    failures.push("dietitian_count_below_100");
  }
  if (fixture.clients.length < DIRECT_PILOT_SCALE_TARGET.totalClients) {
    failures.push("client_count_below_5000");
  }
  failures.push(...integration.failures);

  const hardZeroFailures = collectHardZeroFailures({
    duplicateClientSendCount: mergedDuplicateClientSendCount,
    unknownIdentityProviderCallCount: mergedUnknownIdentityProviderCallCount,
    yellowRedClientSendCount: mergedYellowRedClientSendCount,
    unsafeGreenCount: mergedUnsafeGreenCount,
  });

  return {
    rehearsalVersion: PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
    status: failures.length === 0 && hardZeroFailures.length === 0 ? "pass" : "fail",
    dietitianCount: fixture.dietitians.length,
    clientCount: fixture.clients.length,
    scenarioAssignmentCount: fixture.clients.length,
    duplicateClientSendCount: mergedDuplicateClientSendCount,
    unknownIdentityProviderCallCount: mergedUnknownIdentityProviderCallCount,
    yellowRedClientSendCount: mergedYellowRedClientSendCount,
    unsafeGreenCount: mergedUnsafeGreenCount,
    duplicateIgnoredCount: integration.duplicateIgnoredCount,
    quarantineCount: integration.quarantineCount,
    optOutBlockedCount,
    providerFailureHandoffCount: integration.providerFailureHandoffCount,
    staleDraftInvalidatedCount: integration.staleDraftInvalidatedCount,
    groupQuarantineCount,
    removedClientBlockedCount,
    scenarioCounts,
    hardZeroFailures,
    failures: Array.from(new Set([...failures, ...hardZeroFailures])),
    elapsedMs: Date.now() - startedAt,
  };
}

export function buildPhase77agChannelReplayEvidencePackMetrics(
  metrics: Phase77agChannelReplayRehearsalMetrics,
): Record<string, number | string | string[]> {
  return {
    phase: metrics.rehearsalVersion,
    status: metrics.status,
    dietitian_count: metrics.dietitianCount,
    client_count: metrics.clientCount,
    duplicate_client_send_count: metrics.duplicateClientSendCount,
    unknown_identity_provider_call_count: metrics.unknownIdentityProviderCallCount,
    yellow_red_client_send_count: metrics.yellowRedClientSendCount,
    unsafe_green_count: metrics.unsafeGreenCount,
    duplicate_ignored_count: metrics.duplicateIgnoredCount,
    quarantine_count: metrics.quarantineCount,
    provider_failure_handoff_count: metrics.providerFailureHandoffCount,
    stale_draft_invalidated_count: metrics.staleDraftInvalidatedCount,
    group_quarantine_count: metrics.groupQuarantineCount,
    hard_zero_failures: metrics.hardZeroFailures,
    elapsed_ms: metrics.elapsedMs,
  };
}

export function buildPhase77agChannelReplayHealthSignal(
  metrics: Phase77agChannelReplayRehearsalMetrics = buildPhase77agChannelReplayDefaultMetrics(),
) {
  return {
    channelReplayRehearsalVersion: metrics.rehearsalVersion,
    channelReplayRehearsalStatus: metrics.status,
    channelReplayRehearsalDuplicateClientSendCount: metrics.duplicateClientSendCount,
    channelReplayRehearsalUnknownIdentityProviderCallCount: metrics.unknownIdentityProviderCallCount,
    channelReplayRehearsalYellowRedClientSendCount: metrics.yellowRedClientSendCount,
    channelReplayRehearsalUnsafeGreenCount: metrics.unsafeGreenCount,
    channelReplayRehearsalGroupQuarantineCount: metrics.groupQuarantineCount,
    channelReplayRehearsalDuplicateIgnoredCount: metrics.duplicateIgnoredCount,
  };
}

export function buildPhase77agChannelReplayDefaultMetrics(): Phase77agChannelReplayRehearsalMetrics {
  return {
    rehearsalVersion: PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
    status: "fail",
    dietitianCount: 0,
    clientCount: 0,
    scenarioAssignmentCount: 0,
    duplicateClientSendCount: 0,
    unknownIdentityProviderCallCount: 0,
    yellowRedClientSendCount: 0,
    unsafeGreenCount: 0,
    duplicateIgnoredCount: 0,
    quarantineCount: 0,
    optOutBlockedCount: 0,
    providerFailureHandoffCount: 0,
    staleDraftInvalidatedCount: 0,
    groupQuarantineCount: 0,
    removedClientBlockedCount: 0,
    scenarioCounts: {},
    hardZeroFailures: ["channel_replay_rehearsal_sample_not_run"],
    failures: ["channel_replay_rehearsal_sample_not_run"],
    elapsedMs: 0,
  };
}
