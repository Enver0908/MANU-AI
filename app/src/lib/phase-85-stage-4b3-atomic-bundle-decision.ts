import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import {
  extractBundleDecisionOutcome,
  validateBundleDecisionOutcome,
  type BundleDecisionAction,
} from "./phase-85-stage-4b3-atomic-outcomes";
import { applyStage4B3BundleDecisionNotifications } from "./phase-85-stage-4b3-bundle-notifications";
import { bundleHasDietitianReply } from "./phase-85-stage-4b3-message-bundles";
import { appendInboundCoreResult, type InboundCoreResult } from "./simulator";
import type { ClientRecord, ConversationRecord, ManuAppState, MessageRecord } from "./types";

export const STAGE_4B3_ATOMIC_BUNDLE_DECISION_VERSION = "p85-stage-4b3-atomic-bundle-decision-v2";

export type AtomicBundleDecisionCommitInput = {
  bundleId: string;
  idempotencyKey: string;
  expectedBundleRevision: number;
  expectedConversationRevision: number;
  preparedState: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  coreResult: InboundCoreResult;
  channelPolicyMock?: Parameters<typeof appendInboundCoreResult>[0]["channelPolicyMock"];
  now?: string;
};

export type AtomicBundleDecisionCommitResult =
  | { ok: true; state: ManuAppState; decisionId: string; replay: boolean }
  | { ok: false; failureCode: string; state: ManuAppState };

function readReplayDecisionId(state: ManuAppState, idempotencyKey: string): string | null {
  return state.bundleDecisionReplayByKey[idempotencyKey]?.decisionId ?? null;
}

export function assertBundleDecisionLocks(
  state: ManuAppState,
  input: Pick<AtomicBundleDecisionCommitInput, "bundleId" | "expectedBundleRevision" | "expectedConversationRevision">,
): string | null {
  const bundle = state.inboundMessageBundles.find(
    (entry) => entry.tenantId === state.tenant.id && entry.id === input.bundleId,
  );
  if (!bundle) return "bundle_not_found";
  if (bundleHasDietitianReply(state, input.bundleId)) return "bundle_human_handled";
  if (bundle.bundleRevision !== input.expectedBundleRevision) return "stale_bundle_revision";
  if (bundle.decisionId) return "bundle_decision_already_committed";
  if (bundle.status !== "processing" && bundle.status !== "ready") {
    return bundle.status === "review_required" ? "bundle_review_required" : "bundle_not_processable";
  }

  const conversation = state.conversations.find((entry) => entry.id === bundle.conversationId);
  if (!conversation) return "conversation_not_found";
  if (conversationRevisionOrDefault(conversation) !== input.expectedConversationRevision) {
    return "stale_conversation_revision";
  }

  return null;
}

export function commitAtomicBundleDecisionV2(
  baseState: ManuAppState,
  input: AtomicBundleDecisionCommitInput,
): AtomicBundleDecisionCommitResult {
  const now = input.now ?? new Date().toISOString();
  const replayDecisionId = readReplayDecisionId(baseState, input.idempotencyKey);
  if (replayDecisionId) {
    const bundle = baseState.inboundMessageBundles.find((entry) => entry.id === input.bundleId);
    if (bundle?.decisionId === replayDecisionId) {
      return { ok: true, state: baseState, decisionId: replayDecisionId, replay: true };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state: baseState };
  }

  if (baseState.processedBundleDecisionKeys.includes(input.idempotencyKey)) {
    const bundle = baseState.inboundMessageBundles.find((entry) => entry.id === input.bundleId);
    const decisionId = bundle?.decisionId;
    if (decisionId) {
      return { ok: true, state: baseState, decisionId, replay: true };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state: baseState };
  }

  const lockFailure = assertBundleDecisionLocks(baseState, input);
  if (lockFailure) {
    return { ok: false, failureCode: lockFailure, state: baseState };
  }

  const candidateState = appendInboundCoreResult({
    state: input.preparedState,
    client: input.client,
    conversation: input.conversation,
    inboundMessage: input.inboundMessage,
    coreResult: input.coreResult,
    now,
    channelPolicyMock: input.channelPolicyMock,
  });

  const decisionId = candidateState.lastSimulation?.decisionId;
  if (!decisionId) {
    return { ok: false, failureCode: "bundle_decision_missing", state: baseState };
  }

  const action = (candidateState.lastSimulation?.action ?? input.coreResult.action) as BundleDecisionAction;
  const risk = candidateState.lastSimulation?.risk ?? input.coreResult.risk;

  let nextState = applyStage4B3BundleDecisionNotifications(candidateState, {
    bundleId: input.bundleId,
    clientId: input.client.id,
    conversationId: input.conversation.id,
    anchorMessageId: input.inboundMessage.id,
    action,
    risk,
    clientName: input.client.fullName,
    now,
  });

  const outcome = extractBundleDecisionOutcome({
    baseState,
    candidateState: nextState,
    bundleId: input.bundleId,
    decisionId,
    expectedBundleRevision: input.expectedBundleRevision,
    expectedConversationRevision: input.expectedConversationRevision,
    action,
    risk,
    clientId: input.client.id,
    conversationId: input.conversation.id,
  });

  const validation = validateBundleDecisionOutcome(outcome);
  if (!validation.ok) {
    return { ok: false, failureCode: validation.code, state: baseState };
  }

  const raceFailure = assertBundleDecisionLocks(baseState, input);
  if (raceFailure) {
    return { ok: false, failureCode: raceFailure, state: baseState };
  }

  nextState = {
    ...nextState,
    processedBundleDecisionKeys: [...nextState.processedBundleDecisionKeys, input.idempotencyKey],
    bundleDecisionReplayByKey: {
      ...nextState.bundleDecisionReplayByKey,
      [input.idempotencyKey]: {
        decisionId,
        bundleId: input.bundleId,
        bundleRevision: input.expectedBundleRevision,
        conversationRevision: input.expectedConversationRevision,
      },
    },
    inboundMessageBundles: nextState.inboundMessageBundles.map((entry) =>
      entry.id === input.bundleId
        ? {
            ...entry,
            status: "decided",
            decisionId,
            leaseExpiresAt: null,
            updatedAt: now,
          }
        : entry,
    ),
    auditEvents: [
      ...nextState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: baseState.tenant.id,
        eventType: "bundle_decision_committed_atomic_v2",
        entityType: "inbound_message_bundle",
        entityId: input.bundleId,
        metadata: {
          decisionId,
          idempotencyKey: input.idempotencyKey,
          action,
          risk,
        },
        createdAt: now,
      },
    ],
  };

  return { ok: true, state: nextState, decisionId, replay: false };
}
