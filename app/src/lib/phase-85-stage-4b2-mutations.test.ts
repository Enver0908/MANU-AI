import { beforeEach, describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import {
  addFallbackManualReplyWithResponse,
  applyFallbackDraftMutationWithResponse,
  getFallbackState,
  resetFallbackState,
  saveFallbackState,
} from "./app-state-store";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import {
  parseConversationDraftMutationRequest,
  parseConversationManualReplyRequest,
  resetFallbackConversationMutationIdempotency,
} from "./phase-85-stage-4b2-mutations";
import {
  approveDraftMessageInState,
  appendDietitianManualReplyByConversation,
  reviewSendManualFromYellowDraftInState,
  runInboundSimulation,
  updateClientInState,
} from "./simulator";
import { createInitialState } from "./seed-data";

const REQUEST_ID = "00000000-0000-4000-8000-000000000101";

describe("phase-85-stage-4b2-mutations", () => {
  beforeEach(() => {
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    resetFallbackState();
    resetFallbackConversationMutationIdempotency();
  });

  it("parses manual reply requests with conversation id and revision", () => {
    const parsed = parseConversationManualReplyRequest(
      {
        conversationId: "conversation-client-mert",
        body: "Tamam.",
        requestId: REQUEST_ID,
        expectedConversationRevision: 1,
      },
      () => "conversation-client-mert",
    );
    expect(parsed.conversationId).toBe("conversation-client-mert");
    expect(parsed.body).toBe("Tamam.");
  });

  it("returns bounded manual reply mutation responses", () => {
    const state = getFallbackState();
    const conversation = state.conversations.find((item) => item.clientId === "client-mert");
    expect(conversation).toBeTruthy();

    const response = addFallbackManualReplyWithResponse({
      conversationId: conversation!.id,
      body: "Elle yanit.",
      requestId: REQUEST_ID,
      expectedConversationRevision: conversationRevisionOrDefault(conversation!),
    });

    expect(response.version).toBe("p85-stage-4b-2-api-v3");
    expect(response.operation).toBe("manual_reply");
    expect(response.message?.origin).toBe("dietitian_manual");
    expect(response.message?.status).toBe("sent");
    expect((response as { clients?: unknown }).clients).toBeUndefined();
  });

  it("replays manual reply idempotency by request id", () => {
    const state = getFallbackState();
    const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
    const request = {
      conversationId: conversation.id,
      body: "Tekrar deneme.",
      requestId: REQUEST_ID,
      expectedConversationRevision: conversationRevisionOrDefault(conversation),
    };
    const first = addFallbackManualReplyWithResponse(request);
    const second = addFallbackManualReplyWithResponse(request);
    expect(second).toEqual(first);
    expect(getFallbackState().messages.filter((item) => item.origin === "dietitian_manual")).toHaveLength(1);
  });

  it("rejects stale manual reply revisions with 409", () => {
    const conversation = getFallbackState().conversations.find((item) => item.clientId === "client-mert")!;
    expect(() =>
      addFallbackManualReplyWithResponse({
        conversationId: conversation.id,
        body: "Gecikmis.",
        requestId: "00000000-0000-4000-8000-000000000102",
        expectedConversationRevision: conversationRevisionOrDefault(conversation) + 99,
      }),
    ).toThrowError(new AppDomainError(409, "reactivation_conflict_conversation_revision"));
  });

  it("keeps red lock active after manual reply", async () => {
    const withRed = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum.",
      idempotencyKey: "p85-4b2-phase5-red-manual",
      now: "2026-05-22T10:30:00.000Z",
    });
    const conversation = withRed.conversations.find((item) => item.clientId === "client-mert")!;
    const { nextState } = appendDietitianManualReplyByConversation(withRed, {
      conversationId: conversation.id,
      body: "Ben devraldim.",
      expectedConversationRevision: conversationRevisionOrDefault(conversation),
    });
    const client = nextState.clients.find((item) => item.id === "client-mert");
    expect(client?.redRiskLock.status).toBe("locked");
    expect(nextState.messages.some((item) => item.origin === "dietitian_manual" && item.status === "sent")).toBe(true);
  });

  it("sends yellow drafts through reviewed manual provenance without marking AI draft sent", async () => {
    const withDraft = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b2-phase5-yellow",
      now: "2026-05-22T10:31:00.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const conversation = withDraft.conversations.find((item) => item.clientId === "client-elif")!;
    expect(draft).toBeTruthy();

    const { nextState, message } = reviewSendManualFromYellowDraftInState(withDraft, draft!.id, {
      expectedConversationRevision: conversationRevisionOrDefault(conversation),
    });
    const originalDraft = nextState.messages.find((item) => item.id === draft!.id);
    const manual = nextState.messages.find((item) => item.id === message.id);

    expect(originalDraft?.status).toBe("blocked");
    expect(manual?.origin).toBe("dietitian_manual");
    expect(manual?.status).toBe("sent");
    expect(manual?.sourceMessageId).toBe(draft!.id);
    expect(nextState.clients.find((client) => client.id === "client-elif")?.yellowRiskHold).toEqual({
      status: "none",
    });
  });

  it("blocks direct green approve path for yellow drafts while review_send_manual succeeds via API helper", async () => {
    const withDraft = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b2-phase5-yellow-api",
      now: "2026-05-22T10:32:00.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeTruthy();
    const blocked = approveDraftMessageInState(withDraft, draft!.id);
    expect(blocked.messages.find((item) => item.id === draft!.id)?.status).toBe("blocked");

    resetFallbackState();
    const simulated = await runInboundSimulation(getFallbackState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b2-phase5-yellow-fallback",
      now: "2026-05-22T10:33:00.000Z",
    });
    const fallbackDraft = simulated.messages.find((message) => message.status === "draft");
    const fallbackConversation = simulated.conversations.find((item) => item.clientId === "client-elif")!;
    saveFallbackState(simulated);

    const response = applyFallbackDraftMutationWithResponse(fallbackDraft!.id, {
      action: "review_send_manual",
      requestId: "00000000-0000-4000-8000-000000000103",
      expectedConversationRevision: conversationRevisionOrDefault(fallbackConversation),
    });
    expect(response.operation).toBe("draft_review");
    expect(response.message?.origin).toBe("dietitian_manual");
    expect(response.message?.sourceMessageId).toBe(fallbackDraft!.id);
  });

  it("rejects review_send_manual for green drafts", async () => {
    const copilotState = updateClientInState(createInitialState(), "client-mert", { aiMode: "copilot" });
    const withDraft = await runInboundSimulation(copilotState, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "p85-4b2-phase5-green",
      now: "2026-05-22T10:34:00.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const conversation = withDraft.conversations.find((item) => item.clientId === "client-mert")!;
    expect(() =>
      reviewSendManualFromYellowDraftInState(withDraft, draft!.id, {
        expectedConversationRevision: conversationRevisionOrDefault(conversation),
      }),
    ).toThrowError(new AppDomainError(400, "draft_not_yellow_review_candidate"));
  });

  it("parses draft mutation requests and requires edit_send body", () => {
    expect(() =>
      parseConversationDraftMutationRequest({
        action: "edit_send",
        requestId: REQUEST_ID,
        expectedConversationRevision: 1,
      }),
    ).toThrowError(new AppDomainError(400, "invalid_message_body"));

    expect(() =>
      parseConversationDraftMutationRequest({
        action: "review_send_manual",
        requestId: REQUEST_ID,
        expectedConversationRevision: 1,
      }),
    ).toThrowError(new AppDomainError(400, "expected_client_context_revision_required"));

    expect(
      parseConversationDraftMutationRequest({
        action: "review_send_manual",
        requestId: REQUEST_ID,
        expectedConversationRevision: 1,
        expectedClientContextRevision: 2,
      }).expectedClientContextRevision,
    ).toBe(2);
  });
});
