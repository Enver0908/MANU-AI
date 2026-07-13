import { AppDomainError } from "./app-errors";
import { createEmptyStage4B3MediaCollections } from "./phase-85-stage-4b3-media-contracts";
import type {
  AuditEventRecord,
  ClientRecord,
  ConversationRecord,
  ManuAppState,
} from "./types";

export const PHASE_79C_VERSION = "phase-79c-scoped-client-mutation-v0.1.0";

export type Phase79ScopedClientMutationEvidence = {
  version: string;
  status: "pass" | "fail";
  createValidationReady: boolean;
  patchValidationReady: boolean;
  mergeHelperReady: boolean;
  removedClientPatchBlocked: boolean;
  unrelatedMessagesExcluded: boolean;
  failures: string[];
};

export type Phase79ScopedClientCreateResponse = {
  kind: "client_create";
  client: ClientRecord;
  conversation?: ConversationRecord;
};

export type Phase79ScopedClientPatchResponse = {
  kind: "client_patch";
  client: ClientRecord;
  auditEvents: AuditEventRecord[];
};

export type Phase79ScopedClientMutationResponse =
  | Phase79ScopedClientCreateResponse
  | Phase79ScopedClientPatchResponse;

function emptyMutationShell(base: ManuAppState): ManuAppState {
  return {
    ...base,
    messages: [],
    aiDecisions: [],
    riskAssessments: [],
    handoffCases: [],
    notifications: [],
    auditEvents: [],
    dataRequests: [],
    internalCopilotMessages: [],
    internalCopilotToolCalls: [],
    inboundQuarantines: [],
    channelDeliveries: [],
    clientFormResponses: [],
    clientContextUpdates: [],
    clientUpdateProposals: [],
    clientFoodRuleProfiles: [],
    processedSimulationKeys: [],
    lastSimulation: null,
    ...createEmptyStage4B3MediaCollections(),
  };
}

export function buildClientCreateValidationState(baseState: ManuAppState): ManuAppState {
  return {
    ...emptyMutationShell(baseState),
    clients: baseState.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized"),
    conversations: [],
    clientMenuPlans: [],
  };
}

export function buildClientPatchValidationState(baseState: ManuAppState, clientId: string): ManuAppState {
  const client = baseState.clients.find((item) => item.id === clientId);
  if (!client || client.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(404, "client_not_found");
  }

  return {
    ...emptyMutationShell(baseState),
    clients: baseState.clients.filter((item) => item.lifecycleStatus !== "removed_anonymized"),
    conversations: baseState.conversations.filter((conversation) => conversation.clientId === clientId),
    clientMenuPlans: baseState.clientMenuPlans.filter((plan) => plan.clientId === clientId),
  };
}

export function mergeScopedClientCreateIntoAppState(
  base: ManuAppState,
  newClient: ClientRecord,
  newConversation?: ConversationRecord,
): ManuAppState {
  const existingClientIndex = base.clients.findIndex((client) => client.id === newClient.id);
  const clients =
    existingClientIndex >= 0
      ? base.clients.map((client, index) => (index === existingClientIndex ? newClient : client))
      : [...base.clients, newClient];

  const conversations = newConversation
    ? base.conversations.some((conversation) => conversation.id === newConversation.id)
      ? base.conversations.map((conversation) =>
          conversation.id === newConversation.id ? newConversation : conversation,
        )
      : [...base.conversations, newConversation]
    : base.conversations;

  return {
    ...base,
    clients,
    conversations,
  };
}

export function mergeScopedClientPatchIntoAppState(
  base: ManuAppState,
  patchedClient: ClientRecord,
  additionalAuditEvents: AuditEventRecord[] = [],
): ManuAppState {
  if (!base.clients.some((client) => client.id === patchedClient.id)) {
    throw new AppDomainError(404, "client_not_found");
  }

  const knownAuditIds = new Set(base.auditEvents.map((event) => event.id));
  const mergedAuditEvents = [
    ...base.auditEvents,
    ...additionalAuditEvents.filter((event) => !knownAuditIds.has(event.id)),
  ];

  return {
    ...base,
    clients: base.clients.map((client) => (client.id === patchedClient.id ? patchedClient : client)),
    auditEvents: mergedAuditEvents,
  };
}

export function mergeScopedClientMutationResponseIntoAppState(
  base: ManuAppState,
  response: Phase79ScopedClientMutationResponse,
): ManuAppState {
  if (response.kind === "client_create") {
    return mergeScopedClientCreateIntoAppState(base, response.client, response.conversation);
  }

  return mergeScopedClientPatchIntoAppState(base, response.client, response.auditEvents);
}

export function patchValidationStateExcludesUnrelatedMessages(validationState: ManuAppState, clientId: string) {
  return validationState.messages.every((message) => {
    const conversation = validationState.conversations.find((item) => item.id === message.conversationId);
    return conversation?.clientId === clientId;
  });
}

export function evaluatePhase79cScopedClientMutationEvidence(
  baseState: ManuAppState,
  clientId: string,
): Phase79ScopedClientMutationEvidence {
  const failures: string[] = [];

  let createValidationReady = false;
  try {
    const createState = buildClientCreateValidationState(baseState);
    createValidationReady = createState.messages.length === 0 && createState.aiDecisions.length === 0;
    if (!createValidationReady) failures.push("create_validation_state_not_scoped");
  } catch {
    failures.push("create_validation_state_failed");
  }

  let patchValidationReady = false;
  let unrelatedMessagesExcluded = false;
  try {
    const patchState = buildClientPatchValidationState(baseState, clientId);
    patchValidationReady = patchState.messages.length === 0;
    unrelatedMessagesExcluded = patchValidationStateExcludesUnrelatedMessages(patchState, clientId);
    if (!patchValidationReady) failures.push("patch_validation_state_not_scoped");
    if (!unrelatedMessagesExcluded) failures.push("unrelated_messages_in_patch_validation_state");
  } catch {
    failures.push("patch_validation_state_failed");
  }

  let mergeHelperReady = false;
  try {
    const patched = baseState.clients.find((client) => client.id === clientId);
    if (!patched) {
      failures.push("merge_helper_client_missing");
    } else {
      const merged = mergeScopedClientPatchIntoAppState(baseState, {
        ...patched,
        contextRevision: patched.contextRevision + 1,
      });
      mergeHelperReady =
        merged.clients.length === baseState.clients.length &&
        merged.messages.length === baseState.messages.length &&
        merged.clients.find((client) => client.id === clientId)?.contextRevision === patched.contextRevision + 1;
      if (!mergeHelperReady) failures.push("merge_helper_inconsistent");
    }
  } catch {
    failures.push("merge_helper_failed");
  }

  let removedClientPatchBlocked = false;
  const removedClient = baseState.clients.find((client) => client.lifecycleStatus === "removed_anonymized");
  if (removedClient) {
    try {
      buildClientPatchValidationState(baseState, removedClient.id);
      failures.push("removed_client_patch_not_blocked");
    } catch (error) {
      removedClientPatchBlocked =
        error instanceof AppDomainError && error.message === "client_not_found";
      if (!removedClientPatchBlocked) failures.push("removed_client_patch_wrong_error");
    }
  } else {
    removedClientPatchBlocked = true;
  }

  return {
    version: PHASE_79C_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    createValidationReady,
    patchValidationReady,
    mergeHelperReady,
    removedClientPatchBlocked,
    unrelatedMessagesExcluded,
    failures,
  };
}

export function buildPhase79cScopedClientMutationHealthSignal(
  evidence: Phase79ScopedClientMutationEvidence,
) {
  return {
    phase79ScopedClientMutationVersion: evidence.version,
    phase79ScopedClientMutationStatus: evidence.status,
    phase79ScopedClientMutationReady: evidence.status === "pass",
    phase79ScopedClientMutationFailures: evidence.failures,
  };
}
