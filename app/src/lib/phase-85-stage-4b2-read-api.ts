import { NextResponse } from "next/server";
import { AppAuthError, type AppTenantContext } from "./auth-context";
import { AppDomainError } from "./app-errors";
import type { ManuAppState } from "./types";
import type {
  ConversationActorContext,
  ConversationAssignmentInput,
  ConversationMutationResponse,
  ConversationProjectionSource,
  ConversationReadReceiptRecord,
} from "./phase-85-stage-4b2-contracts";
import { PHASE_85_STAGE_4B_2_API_VERSION } from "./phase-85-stage-4b2-contracts";
import {
  assertConversationOperationAllowed,
  countConversationUnreadMessages,
  resolveConversationPermissions,
} from "./phase-85-stage-4b2-api";
import {
  conversationProjectionSourceFromAppState,
} from "./phase-85-stage-4b2-messaging";

export const CONVERSATION_API_CACHE_CONTROL = "no-store";

export function conversationApiJsonResponse<T>(payload: T) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": CONVERSATION_API_CACHE_CONTROL,
    },
  });
}

export function requireConversationApiActor(context: AppTenantContext) {
  if (context.role === "auditor") {
    throw new AppAuthError(403, "conversation_read_forbidden");
  }
}

export function parseConversationMarkReadBody(body: unknown): { throughSequence: number } {
  if (!body || typeof body !== "object") {
    throw new AppDomainError(400, "invalid_request_body");
  }
  const throughSequence = (body as { throughSequence?: unknown }).throughSequence;
  if (typeof throughSequence !== "number" || !Number.isInteger(throughSequence) || throughSequence < 1) {
    throw new AppDomainError(400, "conversation_read_sequence_invalid");
  }
  return { throughSequence };
}

export function markConversationReadInState(
  state: ManuAppState,
  actor: ConversationActorContext,
  conversationId: string,
  throughSequence: number,
  assignments: readonly ConversationAssignmentInput[] = [],
): ManuAppState {
  const source = conversationProjectionSourceFromAppState(state);
  const conversation = source.conversations.find(
    (item) => item.tenantId === actor.tenantId && item.id === conversationId,
  );
  const client = conversation
    ? source.clients.find(
        (item) =>
          item.tenantId === actor.tenantId &&
          item.id === conversation.clientId &&
          item.lifecycleStatus === "active",
      )
    : undefined;

  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }

  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  assertConversationOperationAllowed(permissions, "mark_read");

  if (!Number.isInteger(throughSequence) || throughSequence < 1) {
    throw new AppDomainError(400, "conversation_read_sequence_invalid");
  }

  const messages = source.messages.filter(
    (message) => message.tenantId === actor.tenantId && message.conversationId === conversationId,
  );
  const maxSequence = messages.reduce(
    (max, message) => Math.max(max, message.conversationSequence ?? 0),
    0,
  );
  if (throughSequence > maxSequence) {
    throw new AppDomainError(400, "conversation_read_sequence_invalid");
  }

  const now = new Date().toISOString();
  const existingIndex = state.conversationReadReceipts.findIndex(
    (receipt) =>
      receipt.tenantId === actor.tenantId &&
      receipt.conversationId === conversationId &&
      receipt.dietitianId === actor.dietitianId,
  );
  const existing = existingIndex >= 0 ? state.conversationReadReceipts[existingIndex]! : null;
  const nextSequence = Math.max(existing?.lastReadSequence ?? 0, throughSequence);
  const nextReceipt: ConversationReadReceiptRecord = {
    tenantId: actor.tenantId,
    conversationId,
    dietitianId: actor.dietitianId,
    actorRole: actor.role,
    lastReadSequence: nextSequence,
    readAt: nextSequence > (existing?.lastReadSequence ?? 0) ? now : existing?.readAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const receipts = [...state.conversationReadReceipts];
  if (existingIndex >= 0) {
    receipts[existingIndex] = nextReceipt;
  } else {
    receipts.push(nextReceipt);
  }

  return {
    ...state,
    conversationReadReceipts: receipts,
  };
}

export function buildConversationMarkReadMutationResponse(
  source: ConversationProjectionSource,
  actor: ConversationActorContext,
  assignments: readonly ConversationAssignmentInput[],
  conversationId: string,
  receipt: ConversationReadReceiptRecord,
  generatedAt = new Date().toISOString(),
): ConversationMutationResponse {
  const conversation = source.conversations.find(
    (item) => item.tenantId === actor.tenantId && item.id === conversationId,
  );
  const client = conversation
    ? source.clients.find(
        (item) =>
          item.tenantId === actor.tenantId &&
          item.id === conversation.clientId &&
          item.lifecycleStatus === "active",
      )
    : undefined;

  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }

  const permissions = resolveConversationPermissions({ actor, conversation, client, assignments });
  const messages = source.messages.filter(
    (message) => message.tenantId === actor.tenantId && message.conversationId === conversationId,
  );

  return {
    version: PHASE_85_STAGE_4B_2_API_VERSION,
    generatedAt,
    operation: "mark_read",
    conversationId,
    conversationRevision: conversation.revision,
    message: null,
    receipt,
    unreadCount: countConversationUnreadMessages(messages, receipt),
    permissions,
  };
}
