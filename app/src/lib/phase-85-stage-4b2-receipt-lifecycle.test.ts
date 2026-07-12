import { describe, expect, it } from "vitest";
import { anonymizeClientInState, removeClientInState } from "./data-governance";
import { createInitialState } from "./seed-data";
import type { ConversationReadReceiptRecord } from "./phase-85-stage-4b2-contracts";
import { DEMO_DIETITIAN_ID, DEMO_TENANT_ID } from "./seed-data";

function receipt(conversationId: string, dietitianId = DEMO_DIETITIAN_ID): ConversationReadReceiptRecord {
  const now = "2026-07-12T12:00:00.000Z";
  return {
    tenantId: DEMO_TENANT_ID,
    conversationId,
    dietitianId,
    actorRole: "dietitian",
    lastReadSequence: 2,
    readAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("phase-85-stage-4b-2 receipt lifecycle", () => {
  it("removes conversation read receipts when a client is anonymized or removed", () => {
    const state = createInitialState();
    const conversationId = state.conversations[0]?.id;
    expect(conversationId).toBeTruthy();

    const withReceipt = {
      ...state,
      conversationReadReceipts: [receipt(conversationId!)],
    };

    const anonymized = anonymizeClientInState(withReceipt, state.clients[0]!.id);
    expect(anonymized.conversationReadReceipts).toEqual([]);

    const removed = removeClientInState(withReceipt, state.clients[0]!.id);
    expect(removed.conversationReadReceipts).toEqual([]);
  });

  it("keeps receipts for unrelated conversations", () => {
    const state = createInitialState();
    const untouchedConversationId = "conv-unrelated";
    const withReceipt = {
      ...state,
      conversationReadReceipts: [receipt(untouchedConversationId)],
    };

    const anonymized = anonymizeClientInState(withReceipt, state.clients[0]!.id);
    expect(anonymized.conversationReadReceipts).toEqual([receipt(untouchedConversationId)]);
  });
});
