import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import type { ManuAppState } from "./types";

export const STAGE_4B3_BUNDLE_DECISIONS_VERSION = "p85-stage-4b3-bundle-decisions-v1";

export type BundleDecisionCommitInput = {
  bundleId: string;
  expectedBundleRevision: number;
  expectedConversationRevision: number;
  idempotencyKey: string;
  decisionId: string;
  now?: string;
};

export type BundleDecisionCommitResult =
  | { ok: true; state: ManuAppState }
  | { ok: false; failureCode: string; state: ManuAppState };

export function commitInboundBundleDecision(
  candidateState: ManuAppState,
  input: BundleDecisionCommitInput,
): BundleDecisionCommitResult {
  const now = input.now ?? new Date().toISOString();
  const bundle = candidateState.inboundMessageBundles.find(
    (entry) => entry.tenantId === candidateState.tenant.id && entry.id === input.bundleId,
  );
  if (!bundle) {
    return { ok: false, failureCode: "bundle_not_found", state: candidateState };
  }

  if (candidateState.processedBundleDecisionKeys.includes(input.idempotencyKey)) {
    if (bundle.decisionId === input.decisionId && bundle.status === "completed") {
      return { ok: true, state: candidateState };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state: candidateState };
  }

  if (bundle.decisionId && bundle.decisionId !== input.decisionId) {
    return { ok: false, failureCode: "bundle_decision_already_committed", state: candidateState };
  }

  if (bundle.bundleRevision !== input.expectedBundleRevision) {
    return { ok: false, failureCode: "stale_bundle_revision", state: candidateState };
  }

  const conversation = candidateState.conversations.find((entry) => entry.id === bundle.conversationId);
  if (!conversation) {
    return { ok: false, failureCode: "conversation_not_found", state: candidateState };
  }
  if (conversationRevisionOrDefault(conversation) !== input.expectedConversationRevision) {
    return { ok: false, failureCode: "stale_conversation_revision", state: candidateState };
  }

  const decisionExists = candidateState.aiDecisions.some((entry) => entry.id === input.decisionId);
  if (!decisionExists) {
    return { ok: false, failureCode: "decision_not_found", state: candidateState };
  }

  const nextState: ManuAppState = {
    ...candidateState,
    processedBundleDecisionKeys: [...candidateState.processedBundleDecisionKeys, input.idempotencyKey],
    inboundMessageBundles: candidateState.inboundMessageBundles.map((entry) =>
      entry.id === bundle.id
        ? {
            ...entry,
            status: "completed",
            decisionId: input.decisionId,
            leaseExpiresAt: null,
            updatedAt: now,
          }
        : entry,
    ),
    auditEvents: [
      ...candidateState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: candidateState.tenant.id,
        eventType: "bundle_decision_committed",
        entityType: "inbound_message_bundle",
        entityId: bundle.id,
        metadata: {
          decisionId: input.decisionId,
          bundleRevision: bundle.bundleRevision,
          conversationRevision: input.expectedConversationRevision,
          idempotencyKey: input.idempotencyKey,
        },
        createdAt: now,
      },
    ],
  };

  return { ok: true, state: nextState };
}

export function assertBundleDecisionIdempotent(
  state: ManuAppState,
  bundleId: string,
  bundleRevision: number,
): string | null {
  const bundle = state.inboundMessageBundles.find((entry) => entry.id === bundleId);
  if (!bundle) return "bundle_not_found";
  if (bundle.decisionId) return "bundle_decision_already_committed";
  if (bundle.bundleRevision !== bundleRevision) return "stale_bundle_revision";
  return null;
}
