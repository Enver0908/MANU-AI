import { describe, expect, it } from "vitest";
import type { ConversationMessageDto, ConversationPermissions } from "./phase-85-stage-4b2-contracts";
import type { ClientRecord } from "./types";
import {
  buildConversationTimelineItems,
  isGreenDraftMessage,
  isYellowDraftReviewMessage,
  mergeConversationDetailMessages,
  resolveConversationDetailMutationVisibility,
  resolveConversationMessageBody,
  resolveConversationMessageProvenance,
} from "./conversation-detail-helpers";

function buildMessage(overrides: Partial<ConversationMessageDto> = {}): ConversationMessageDto {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    sender: "client",
    origin: "client_inbound",
    body: "Merhaba",
    contentStatus: "available",
    status: "sent",
    isDraft: false,
    sourceMessageId: null,
    createdAt: "2026-07-12T10:00:00.000Z",
    conversationSequence: 1,
    ...overrides,
  };
}

function buildClient(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id: "client-1",
    yellowRiskHold: { status: "inactive" },
    redRiskLock: { status: "unlocked" },
    lifecycleStatus: "active",
    ...overrides,
  } as ClientRecord;
}

const permissions: ConversationPermissions = {
  canRead: true,
  canViewTranscript: true,
  canMarkRead: true,
  canSendManualReply: true,
  canReviewDraft: true,
  canControlAi: true,
  canResolveRisk: true,
  canMutateConversation: true,
  isReadOnly: false,
  assignmentLevel: "primary",
  scope: "assigned",
};

describe("conversation-detail-helpers", () => {
  it("merges older and newer pages without duplicates", () => {
    const current = [buildMessage({ id: "message-2", createdAt: "2026-07-12T11:00:00.000Z", conversationSequence: 2 })];
    const older = [buildMessage({ id: "message-1" })];
    const newer = [buildMessage({ id: "message-3", createdAt: "2026-07-12T12:00:00.000Z", conversationSequence: 3 })];
    expect(mergeConversationDetailMessages(current, older, "older").map((item) => item.id)).toEqual([
      "message-1",
      "message-2",
    ]);
    expect(mergeConversationDetailMessages(current, newer, "newer").map((item) => item.id)).toEqual([
      "message-2",
      "message-3",
    ]);
  });

  it("builds date separators and resolves unavailable bodies", () => {
    const timeline = buildConversationTimelineItems([
      buildMessage({ id: "message-1", createdAt: "2026-07-12T10:00:00.000Z" }),
      buildMessage({ id: "message-2", createdAt: "2026-07-13T10:00:00.000Z" }),
    ]);
    expect(timeline.filter((item) => item.type === "date")).toHaveLength(2);
    expect(resolveConversationMessageBody(buildMessage({ body: null, contentStatus: "revoked" }))).toContain(
      "kullanilamiyor",
    );
    expect(resolveConversationMessageProvenance(buildMessage({ origin: "ai_generated", sender: "assistant" }))).toEqual({
      i18nKey: "provenanceAi",
      tone: "emerald",
    });
  });

  it("resolves yellow draft and mutation visibility by role", () => {
    const yellowClient = buildClient({ yellowRiskHold: { status: "active" } });
    const draft = buildMessage({ isDraft: true, origin: "ai_generated", sender: "assistant", status: "draft" });
    expect(isYellowDraftReviewMessage(draft, yellowClient)).toBe(true);
    expect(isGreenDraftMessage(draft, buildClient())).toBe(true);
    expect(
      resolveConversationDetailMutationVisibility(
        { ...permissions, canSendManualReply: false, canReviewDraft: false, canControlAi: false, isReadOnly: true },
        yellowClient,
      ),
    ).toEqual({
      showComposer: false,
      showDraftControls: false,
      showAiControls: false,
      showYellowDraftReview: false,
    });
    expect(resolveConversationDetailMutationVisibility(permissions, yellowClient).showYellowDraftReview).toBe(true);
  });
});
