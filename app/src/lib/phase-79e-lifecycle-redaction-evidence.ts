import { AppDomainError } from "./app-errors";
import { buildClientPatchValidationState } from "./phase-79c-scoped-client-mutation";
import {
  applyPhase74TransactionalRedactionInState,
  evaluatePhase74RedactionInvariants,
  isClientExcludedFromOperationalPaths,
  type Phase74RedactionEvidence,
} from "./phase-74-data-lifecycle-policy";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import {
  evaluateP85IfILifecycleRedactionDomains,
  PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS,
  type P85IfILifecycleRedactionDomain,
} from "./phase-85-if-i-lifecycle-closure";
import { profileContainsUnredactedFoodRuleData } from "./phase-77e-client-food-rule-profile";
import { menuPlanContainsUnredactedData } from "./phase-77f-client-menu-plan";
import type { ManuAppState } from "./types";

export const PHASE_79E_VERSION = "phase-79e-lifecycle-redaction-v0.1.0";

export const PHASE_79E_LIFECYCLE_REDACTION_DOMAINS = [
  "client_profile_identity",
  "channel_identities",
  "conversation_memories",
  "messages_drafts",
  "form_responses",
  "context_updates",
  "update_proposals",
  "food_rule_profiles",
  "menu_plans",
  "ai_decisions",
  "handoffs_notifications",
  "channel_deliveries",
  "audit_minimization",
] as const;

export type Phase79LifecycleRedactionDomain = (typeof PHASE_79E_LIFECYCLE_REDACTION_DOMAINS)[number];

export type Phase79LifecycleRedactionDomainUnion = Phase79LifecycleRedactionDomain | P85IfILifecycleRedactionDomain;

export type Phase79LifecycleRedactionEvidence = {
  version: string;
  status: "pass" | "fail";
  clientId: string;
  requestType: "deletion" | "anonymization";
  domainsCovered: Phase79LifecycleRedactionDomainUnion[];
  domainFailures: Partial<Record<Phase79LifecycleRedactionDomainUnion, string>>;
  operationalPathsBlocked: boolean;
  channelDeliveriesRemoved: boolean;
  conversationMemoryCleared: boolean;
  foodMenuProfileRedacted: boolean;
  aggregateEvidenceOnly: boolean;
  rawHealthDataInEvidence: boolean;
  failures: string[];
  phase74Evidence: Phase74RedactionEvidence;
};

const RAW_EVIDENCE_PATTERNS =
  /\+\d{10,}|health details|Three meals|primary_phone|prompt|secret|password|token|api_key/i;

function conversationIdsForClient(state: ManuAppState, clientId: string) {
  return new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((item) => item.id),
  );
}

function evaluateLifecycleRedactionDomains(
  state: ManuAppState,
  clientId: string,
): Partial<Record<Phase79LifecycleRedactionDomain, string>> {
  const failures: Partial<Record<Phase79LifecycleRedactionDomain, string>> = {};
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    failures.client_profile_identity = "client_not_found";
    return failures;
  }

  if (client.fullName !== "Anonymized Client" || client.primaryPhoneE164 || client.pinnedNotes.length > 0) {
    failures.client_profile_identity = "client_profile_not_redacted";
  }
  if (client.channelUserId || client.channelPermission !== "blocked") {
    failures.channel_identities = "channel_identity_not_cleared";
  }

  const conversationIds = conversationIdsForClient(state, clientId);
  if (
    state.conversations.some(
      (conversation) => conversationIds.has(conversation.id) && conversation.rollingSummary.trim().length > 0,
    )
  ) {
    failures.conversation_memories = "conversation_memory_not_cleared";
  }

  const clientMessages = state.messages.filter((message) => conversationIds.has(message.conversationId));
  if (clientMessages.some((message) => message.body !== PHASE_74_REDACTION_MARKER)) {
    failures.messages_drafts = "messages_not_redacted";
  }
  if (clientMessages.some((message) => message.status === "draft")) {
    failures.messages_drafts = "draft_messages_remain";
  }

  for (const response of state.clientFormResponses.filter((item) => item.clientId === clientId)) {
    if (response.submittedPhoneE164 || JSON.stringify(response.answers).includes("health details")) {
      failures.form_responses = "form_responses_not_redacted";
      break;
    }
  }

  for (const update of state.clientContextUpdates.filter((item) => item.clientId === clientId)) {
    if (update.title !== PHASE_74_REDACTION_MARKER || update.summary !== PHASE_74_REDACTION_MARKER) {
      failures.context_updates = "context_updates_not_redacted";
      break;
    }
  }

  for (const proposal of state.clientUpdateProposals.filter((item) => item.clientId === clientId)) {
    if (proposal.sourceText !== PHASE_74_REDACTION_MARKER || proposal.proposedPatches.length > 0) {
      failures.update_proposals = "update_proposals_not_redacted";
      break;
    }
  }

  for (const profile of state.clientFoodRuleProfiles.filter((item) => item.clientId === clientId)) {
    if (profileContainsUnredactedFoodRuleData(profile)) {
      failures.food_rule_profiles = "food_rule_profile_not_redacted";
      break;
    }
  }

  for (const plan of state.clientMenuPlans.filter((item) => item.clientId === clientId)) {
    if (menuPlanContainsUnredactedData(plan)) {
      failures.menu_plans = "menu_plan_not_redacted";
      break;
    }
  }

  for (const decision of state.aiDecisions.filter((item) => item.clientId === clientId)) {
    if (decision.model || decision.providerAttempted) {
      failures.ai_decisions = "ai_decisions_not_minimized";
      break;
    }
  }

  for (const handoff of state.handoffCases.filter((item) => item.clientId === clientId)) {
    if (
      handoff.safeAcknowledgement !== PHASE_74_REDACTION_MARKER ||
      handoff.recommendedAction !== PHASE_74_REDACTION_MARKER
    ) {
      failures.handoffs_notifications = "handoffs_not_redacted";
      break;
    }
  }

  if (state.channelDeliveries.some((delivery) => delivery.clientId === clientId)) {
    failures.channel_deliveries = "channel_deliveries_remain";
  }

  const relatedEntityIds = new Set<string>([
    clientId,
    ...conversationIds,
    ...clientMessages.map((message) => message.id),
    ...state.aiDecisions.filter((decision) => decision.clientId === clientId).map((decision) => decision.id),
    ...state.clientUpdateProposals.filter((proposal) => proposal.clientId === clientId).map((proposal) => proposal.id),
  ]);
  const relatedAudits = state.auditEvents.filter((event) => relatedEntityIds.has(event.entityId));
  if (
    relatedAudits.some(
      (event) =>
        event.metadata.minimized !== true &&
        event.eventType !== "client_data_anonymized" &&
        event.eventType !== "client_removed_anonymized",
    )
  ) {
    failures.audit_minimization = "audit_events_not_minimized";
  }

  return failures;
}

export function lifecycleRedactionEvidenceIsAggregateOnly(evidence: Phase79LifecycleRedactionEvidence) {
  const serialized = JSON.stringify({
    version: evidence.version,
    status: evidence.status,
    clientId: evidence.clientId,
    requestType: evidence.requestType,
    domainsCovered: evidence.domainsCovered,
    domainFailures: evidence.domainFailures,
    operationalPathsBlocked: evidence.operationalPathsBlocked,
    channelDeliveriesRemoved: evidence.channelDeliveriesRemoved,
    conversationMemoryCleared: evidence.conversationMemoryCleared,
    foodMenuProfileRedacted: evidence.foodMenuProfileRedacted,
    aggregateEvidenceOnly: evidence.aggregateEvidenceOnly,
    failures: evidence.failures,
    affectedTableCounts: evidence.phase74Evidence.affectedTableCounts,
  });
  return !RAW_EVIDENCE_PATTERNS.test(serialized);
}

export function verifyRemovedClientOperationalPathsBlocked(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  const failures: string[] = [];

  if (!client || client.lifecycleStatus !== "removed_anonymized") {
    failures.push("operational_paths_not_blocked");
  }

  if (state.clients.some((item) => item.id === clientId && item.lifecycleStatus !== "removed_anonymized")) {
    failures.push("removed_client_still_visible");
  }

  try {
    buildClientPatchValidationState(state, clientId);
    failures.push("removed_client_patch_not_blocked");
  } catch (error) {
    if (!(error instanceof AppDomainError) || error.message !== "client_not_found") {
      failures.push("removed_client_patch_wrong_error");
    }
  }

  return {
    blocked: failures.length === 0,
    failures,
  };
}

export function verifyAnonymizedClientOperationalRestrictions(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  const failures: string[] = [];

  if (!client) {
    failures.push("client_not_found");
  } else {
    if (!isClientExcludedFromOperationalPaths(client)) {
      failures.push("anonymized_client_not_operationally_restricted");
    }
    if (client.fullName !== "Anonymized Client") {
      failures.push("client_profile_not_anonymized");
    }
    if (client.channelUserId || client.channelPermission !== "blocked") {
      failures.push("channel_identity_not_cleared");
    }
  }

  return {
    blocked: failures.length === 0,
    failures,
  };
}

export function buildPhase79LifecycleRedactionEvidence(
  state: ManuAppState,
  clientId: string,
  requestType: "deletion" | "anonymization",
  phase74Evidence: Phase74RedactionEvidence,
): Phase79LifecycleRedactionEvidence {
  const domainFailures = {
    ...evaluateLifecycleRedactionDomains(state, clientId),
    ...evaluateP85IfILifecycleRedactionDomains(state, clientId),
  };
  const phase74Invariants = evaluatePhase74RedactionInvariants(state, clientId);
  const operationalCheck =
    requestType === "deletion"
      ? verifyRemovedClientOperationalPathsBlocked(state, clientId)
      : verifyAnonymizedClientOperationalRestrictions(state, clientId);
  const conversationIds = conversationIdsForClient(state, clientId);

  const domainsCovered = [
    ...PHASE_79E_LIFECYCLE_REDACTION_DOMAINS.filter((domain) => domainFailures[domain] === undefined),
    ...PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS.filter((domain) => domainFailures[domain] === undefined),
  ];
  const failures = [
    ...Object.values(domainFailures),
    ...(phase74Invariants.passed ? [] : phase74Invariants.blockingReasons),
    ...operationalCheck.failures,
  ];

  const evidence: Phase79LifecycleRedactionEvidence = {
    version: PHASE_79E_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    clientId,
    requestType,
    domainsCovered,
    domainFailures,
    operationalPathsBlocked: operationalCheck.blocked,
    channelDeliveriesRemoved: !state.channelDeliveries.some((delivery) => delivery.clientId === clientId),
    conversationMemoryCleared: !state.conversations.some(
      (conversation) => conversationIds.has(conversation.id) && conversation.rollingSummary.trim().length > 0,
    ),
    foodMenuProfileRedacted:
      !state.clientFoodRuleProfiles.some(
        (profile) => profile.clientId === clientId && profileContainsUnredactedFoodRuleData(profile),
      ) &&
      !state.clientMenuPlans.some(
        (plan) => plan.clientId === clientId && menuPlanContainsUnredactedData(plan),
      ),
    aggregateEvidenceOnly: true,
    rawHealthDataInEvidence: false,
    failures,
    phase74Evidence,
  };

  evidence.aggregateEvidenceOnly = lifecycleRedactionEvidenceIsAggregateOnly(evidence);
  evidence.rawHealthDataInEvidence = !evidence.aggregateEvidenceOnly;
  if (!evidence.aggregateEvidenceOnly) {
    evidence.failures.push("raw_health_data_in_evidence");
    evidence.status = "fail";
  }

  return evidence;
}

export function applyPhase79LifecycleRedactionContract(
  state: ManuAppState,
  clientId: string,
  requestType: "deletion" | "anonymization" = "deletion",
): { state: ManuAppState; evidence: Phase79LifecycleRedactionEvidence } {
  const { state: redacted, evidence: phase74Evidence } = applyPhase74TransactionalRedactionInState(
    state,
    clientId,
    requestType,
  );
  const evidence = buildPhase79LifecycleRedactionEvidence(redacted, clientId, requestType, phase74Evidence);
  if (evidence.status !== "pass") {
    throw new Error(`phase79_lifecycle_redaction_failed:${evidence.failures.join(",")}`);
  }
  return { state: redacted, evidence };
}

export function evaluatePhase79eLifecycleRedactionEvidence(
  state: ManuAppState,
  clientId: string,
  requestType: "deletion" | "anonymization" = "deletion",
): Phase79LifecycleRedactionEvidence {
  return buildPhase79LifecycleRedactionEvidence(state, clientId, requestType, {
    policyVersion: "phase-74-data-lifecycle-policy-v1",
    redactionVersion: "phase-74-data-lifecycle-policy-v1",
    clientId,
    requestType,
    completedAt: new Date().toISOString(),
    affectedTableCounts: {},
    minimizedEvidenceOnly: true,
  });
}

export function evaluatePhase79eLifecycleRedactionEvidenceForHealth(
  state: ManuAppState,
): Phase79LifecycleRedactionEvidence {
  const clientId =
    state.clients.find((client) => client.lifecycleStatus !== "removed_anonymized")?.id ?? "client-mert";
  const emptyPhase74Evidence: Phase74RedactionEvidence = {
    policyVersion: "phase-74-data-lifecycle-policy-v1",
    redactionVersion: "phase-74-data-lifecycle-policy-v1",
    clientId,
    requestType: "deletion",
    completedAt: new Date().toISOString(),
    affectedTableCounts: {},
    minimizedEvidenceOnly: true,
  };

  try {
    const draft = JSON.parse(JSON.stringify(state)) as ManuAppState;
    const { state: redacted, evidence: phase74Evidence } = applyPhase74TransactionalRedactionInState(
      draft,
      clientId,
      "deletion",
    );
    return buildPhase79LifecycleRedactionEvidence(redacted, clientId, "deletion", phase74Evidence);
  } catch (error) {
    return {
      version: PHASE_79E_VERSION,
      status: "fail",
      clientId,
      requestType: "deletion",
      domainsCovered: [],
      domainFailures: {},
      operationalPathsBlocked: false,
      channelDeliveriesRemoved: false,
      conversationMemoryCleared: false,
      foodMenuProfileRedacted: false,
      aggregateEvidenceOnly: true,
      rawHealthDataInEvidence: false,
      failures: [error instanceof Error ? error.message : "lifecycle_redaction_evaluation_failed"],
      phase74Evidence: emptyPhase74Evidence,
    };
  }
}

export function buildPhase79eLifecycleRedactionHealthSignal(evidence: Phase79LifecycleRedactionEvidence) {
  return {
    phase79LifecycleRedactionVersion: evidence.version,
    phase79LifecycleRedactionStatus: evidence.status,
    phase79LifecycleReady: evidence.status === "pass",
    phase79LifecycleRedactionFailures: evidence.failures,
    phase79LifecycleDomainCoverageCount: evidence.domainsCovered.length,
  };
}
