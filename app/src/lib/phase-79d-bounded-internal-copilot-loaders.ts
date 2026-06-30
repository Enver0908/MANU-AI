import {
  classifyInternalCopilotIntent,
  extractClientQuery,
  resolveVisibleClientByName,
} from "./internal-copilot";
import type {
  InternalCopilotSourceRef,
  InternalCopilotToolCallRecord,
  ManuAppState,
} from "./types";

export const PHASE_79D_VERSION = "phase-79d-bounded-internal-copilot-v0.1.0";

export const INTERNAL_COPILOT_TOOL_BOUNDS = {
  recentMessagesMax: 20,
  handoffsMax: 10,
  aiDecisionsMax: 10,
  formResponsesMax: 10,
  sourceRefLabelMaxChars: 120,
} as const;

export type Phase79BoundedInternalCopilotEvidence = {
  version: string;
  status: "pass" | "fail";
  boundedToolStateReady: boolean;
  visibleClientResolveReady: boolean;
  removedClientBlocked: boolean;
  hiddenStateLeakDetected: boolean;
  sourceRefsBounded: boolean;
  tenantDietitianScopedRecords: boolean;
  failures: string[];
};

export function assembleBoundedInternalCopilotToolState(
  source: ManuAppState,
  question: string,
): ManuAppState {
  const visibleClients = source.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized");
  const shell: ManuAppState = {
    ...source,
    clients: visibleClients,
    messages: [],
    handoffCases: [],
    aiDecisions: [],
    clientFormResponses: [],
    conversations: [],
    internalCopilotMessages: [],
    internalCopilotToolCalls: [],
    auditEvents: [],
  };

  const intent = classifyInternalCopilotIntent(question);
  if (intent === "unsupported") return shell;

  const query = extractClientQuery(question, visibleClients);
  const resolved = resolveVisibleClientByName(shell, query);
  if (resolved.status !== "ok") return shell;

  const clientId = resolved.client.id;
  const conversationIds = new Set(
    source.conversations.filter((conversation) => conversation.clientId === clientId).map((item) => item.id),
  );

  return {
    ...shell,
    conversations: source.conversations.filter((conversation) => conversation.clientId === clientId),
    messages: source.messages
      .filter((message) => conversationIds.has(message.conversationId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, INTERNAL_COPILOT_TOOL_BOUNDS.recentMessagesMax),
    handoffCases: source.handoffCases
      .filter((handoff) => handoff.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, INTERNAL_COPILOT_TOOL_BOUNDS.handoffsMax),
    aiDecisions: source.aiDecisions
      .filter((decision) => decision.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, INTERNAL_COPILOT_TOOL_BOUNDS.aiDecisionsMax),
    clientFormResponses: source.clientFormResponses
      .filter((response) => response.clientId === clientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, INTERNAL_COPILOT_TOOL_BOUNDS.formResponsesMax),
    clientFormSchemas: source.clientFormSchemas.filter((schema) => schema.status === "published"),
  };
}

export function minimizeInternalCopilotSourceRefs(
  refs: InternalCopilotSourceRef[],
): InternalCopilotSourceRef[] {
  return refs.map((ref) => ({
    ...ref,
    label:
      ref.label.length > INTERNAL_COPILOT_TOOL_BOUNDS.sourceRefLabelMaxChars
        ? `${ref.label.slice(0, INTERNAL_COPILOT_TOOL_BOUNDS.sourceRefLabelMaxChars - 3)}...`
        : ref.label,
  }));
}

export function minimizeInternalCopilotToolCallSourceRefs(
  toolCalls: InternalCopilotToolCallRecord[],
): InternalCopilotToolCallRecord[] {
  return toolCalls.map((call) => ({
    ...call,
    sourceRefs: minimizeInternalCopilotSourceRefs(call.sourceRefs),
  }));
}

export function boundedToolStateExcludesHiddenClients(state: ManuAppState) {
  return state.clients.every((client) => client.lifecycleStatus !== "removed_anonymized");
}

export function boundedToolStateExcludesUnrelatedClientMessages(state: ManuAppState) {
  const clientIds = new Set(state.clients.map((client) => client.id));
  return state.messages.every((message) => {
    const conversation = state.conversations.find((item) => item.id === message.conversationId);
    return conversation ? clientIds.has(conversation.clientId) : true;
  });
}

export function mergeInternalCopilotMutationIntoAppState(
  base: ManuAppState,
  mutationResult: ManuAppState,
): ManuAppState {
  const knownMessageIds = new Set(base.internalCopilotMessages.map((message) => message.id));
  const knownToolCallIds = new Set(base.internalCopilotToolCalls.map((call) => call.id));
  const knownAuditIds = new Set(base.auditEvents.map((event) => event.id));

  return {
    ...base,
    internalCopilotMessages: [
      ...base.internalCopilotMessages,
      ...mutationResult.internalCopilotMessages.filter((message) => !knownMessageIds.has(message.id)),
    ],
    internalCopilotToolCalls: [
      ...base.internalCopilotToolCalls,
      ...mutationResult.internalCopilotToolCalls.filter((call) => !knownToolCallIds.has(call.id)),
    ],
    auditEvents: [
      ...base.auditEvents,
      ...mutationResult.auditEvents.filter((event) => !knownAuditIds.has(event.id)),
    ],
  };
}

export function evaluatePhase79dBoundedInternalCopilotEvidence(
  sourceState: ManuAppState,
  question: string,
): Phase79BoundedInternalCopilotEvidence {
  const failures: string[] = [];
  const bounded = assembleBoundedInternalCopilotToolState(sourceState, question);

  const boundedToolStateReady =
    bounded.messages.length <= INTERNAL_COPILOT_TOOL_BOUNDS.recentMessagesMax &&
    bounded.handoffCases.length <= INTERNAL_COPILOT_TOOL_BOUNDS.handoffsMax &&
    bounded.aiDecisions.length <= INTERNAL_COPILOT_TOOL_BOUNDS.aiDecisionsMax &&
    bounded.clientFormResponses.length <= INTERNAL_COPILOT_TOOL_BOUNDS.formResponsesMax;
  if (!boundedToolStateReady) failures.push("bounded_tool_state_limits_exceeded");

  const resolved = resolveVisibleClientByName(bounded, extractClientQuery(question, bounded.clients));
  const visibleClientResolveReady =
    classifyInternalCopilotIntent(question) === "unsupported" || resolved.status === "ok" || resolved.status === "ambiguous";
  if (!visibleClientResolveReady) failures.push("visible_client_resolve_failed");

  const removedClient = sourceState.clients.find((client) => client.lifecycleStatus === "removed_anonymized");
  let removedClientBlocked = true;
  if (removedClient) {
    const removedResolved = resolveVisibleClientByName(bounded, removedClient.fullName);
    removedClientBlocked = removedResolved.status !== "ok";
    if (!removedClientBlocked) failures.push("removed_client_not_blocked");
  }

  const hiddenStateLeakDetected = !boundedToolStateExcludesUnrelatedClientMessages(bounded);
  if (hiddenStateLeakDetected) failures.push("hidden_client_state_leaked");

  const minimized = minimizeInternalCopilotToolCallSourceRefs([
    {
      id: "tool-call-sample",
      tenantId: sourceState.tenant.id,
      dietitianId: sourceState.dietitian.id,
      toolName: "getClientRecentMessages",
      arguments: { clientId: "client-mert" },
      status: "ok",
      sourceRefs: [
        {
          entityType: "message",
          entityId: "message-1",
          clientId: "client-mert",
          label: "x".repeat(INTERNAL_COPILOT_TOOL_BOUNDS.sourceRefLabelMaxChars + 50),
          createdAt: "2026-06-29T00:00:00.000Z",
        },
      ],
      resultSummary: "sample",
      createdAt: "2026-06-29T00:00:00.000Z",
    },
  ]);
  const sourceRefsBounded = minimized[0]?.sourceRefs.every(
    (ref) => ref.label.length <= INTERNAL_COPILOT_TOOL_BOUNDS.sourceRefLabelMaxChars,
  );
  if (!sourceRefsBounded) failures.push("source_refs_not_minimized");

  const tenantDietitianScopedRecords = boundedToolStateExcludesHiddenClients(bounded);
  if (!tenantDietitianScopedRecords) failures.push("tenant_dietitian_scope_violation");

  return {
    version: PHASE_79D_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    boundedToolStateReady,
    visibleClientResolveReady,
    removedClientBlocked,
    hiddenStateLeakDetected,
    sourceRefsBounded: sourceRefsBounded ?? false,
    tenantDietitianScopedRecords,
    failures,
  };
}

export function buildPhase79dBoundedInternalCopilotHealthSignal(
  evidence: Phase79BoundedInternalCopilotEvidence,
) {
  return {
    phase79BoundedInternalCopilotVersion: evidence.version,
    phase79BoundedInternalCopilotStatus: evidence.status,
    phase79BoundedInternalCopilotReady: evidence.status === "pass",
    phase79BoundedInternalCopilotFailures: evidence.failures,
  };
}
