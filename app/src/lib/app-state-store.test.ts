import { describe, expect, it } from "vitest";
import {
  addManualReplyInState,
  approveDraftInState,
  createClientInState,
  dismissDraftInState,
  anonymizeClientDataInState,
  exportClientInState,
  recordClientExportRequestInState,
  releaseHumanTakeoverInState,
  simulateInState,
  updateHandoffStatusInState,
} from "./app-state-store";
import { RETENTION_POLICY_PLACEHOLDERS } from "./data-governance";
import { createInitialState } from "./seed-data";

describe("app state store operations", () => {
  it("creates a client with a conversation", () => {
    const next = createClientInState(createInitialState(), {
      fullName: "Ada Soylu",
      channel: "telegram",
      channelUserId: "ada_tg",
    });

    const client = next.clients.find((item) => item.fullName === "Ada Soylu");
    expect(client?.channel).toBe("telegram");
    expect(next.conversations.some((conversation) => conversation.clientId === client?.id)).toBe(true);
  });

  it("adds manual replies with dietitian provenance", () => {
    const next = addManualReplyInState(createInitialState(), "client-mert", "Tamam, bunu not aldım.");
    const manual = next.messages.find((message) => message.origin === "dietitian_manual");

    expect(manual?.authorDietitianId).toBe(next.dietitian.id);
    expect(manual?.status).toBe("sent");
  });

  it("keeps duplicate simulator events from creating extra records", async () => {
    const first = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "store-duplicate",
    });
    const second = await simulateInState(first, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "store-duplicate",
    });

    expect(second.lastSimulation?.action).toBe("duplicate_ignored");
    expect(second.messages).toHaveLength(first.messages.length);
    expect(second.aiDecisions).toHaveLength(first.aiDecisions.length);
    expect(second.riskAssessments).toHaveLength(first.riskAssessments.length);
  });

  it("resolves only open handoffs", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red",
    });
    const handoffId = withHandoff.handoffCases[0].id;
    const resolved = updateHandoffStatusInState(withHandoff, handoffId, "resolved");

    expect(resolved.handoffCases[0].status).toBe("resolved");
  });

  it("approves AI drafts with dietitian approval provenance", async () => {
    const withDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-approve",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const approved = approveDraftInState(withDraft, draft?.id || "");
    const message = approved.messages.find((item) => item.id === draft?.id);

    expect(message?.status).toBe("sent");
    expect(message?.approvedByDietitianId).toBe(approved.dietitian.id);
    expect(approved.auditEvents.some((event) => event.eventType === "draft_approved")).toBe(true);
  });

  it("edits and dismisses AI drafts without losing AI provenance", async () => {
    const withDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-edit",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const edited = approveDraftInState(withDraft, draft?.id || "", "Bunu birlikte kontrol edip netlestirelim.");
    const editedMessage = edited.messages.find((item) => item.id === draft?.id);

    expect(editedMessage?.body).toBe("Bunu birlikte kontrol edip netlestirelim.");
    expect(editedMessage?.origin).toBe("ai_generated");
    expect(editedMessage?.status).toBe("sent");

    const withSecondDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-dismiss",
    });
    const secondDraft = withSecondDraft.messages.find((message) => message.status === "draft");
    const dismissed = dismissDraftInState(withSecondDraft, secondDraft?.id || "");
    const dismissedMessage = dismissed.messages.find((item) => item.id === secondDraft?.id);

    expect(dismissedMessage?.status).toBe("blocked");
    expect(dismissedMessage?.origin).toBe("ai_generated");
  });

  it("releases human takeover locks with an audit event", () => {
    const state = createInitialState();
    const locked = {
      ...state,
      clients: state.clients.map((client) =>
        client.id === "client-mert" ? { ...client, humanTakeoverLocked: true } : client,
      ),
    };

    const released = releaseHumanTakeoverInState(locked, "client-mert");
    const client = released.clients.find((item) => item.id === "client-mert");

    expect(client?.humanTakeoverLocked).toBe(false);
    expect(released.auditEvents.some((event) => event.eventType === "human_takeover_released")).toBe(true);
  });

  it("keeps client exports scoped to one tenant/client", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "export-scope",
    });

    const bundle = exportClientInState(state, "client-elif");
    const conversationIds = new Set(bundle.conversations.map((conversation) => conversation.id));

    expect(bundle.clientId).toBe("client-elif");
    expect(bundle.client.fullName).toBe("Elif Demir");
    expect(bundle.messages.every((message) => conversationIds.has(message.conversationId))).toBe(true);
    expect(bundle.messages.some((message) => message.conversationId === "conversation-client-mert")).toBe(false);
    expect(bundle.aiDecisions.every((decision) => decision.clientId === "client-elif")).toBe(true);
  });

  it("records client export requests in the legal operations ledger", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "export-ledger",
    });
    const next = recordClientExportRequestInState(state, "client-elif");
    const bundle = exportClientInState(next, "client-elif");

    expect(next.dataRequests).toHaveLength(1);
    expect(next.dataRequests[0]).toMatchObject({
      clientId: "client-elif",
      requestType: "export",
      status: "completed",
      requestedByDietitianId: next.dietitian.id,
    });
    expect(bundle.dataRequests).toEqual(next.dataRequests);
    expect(next.auditEvents.some((event) => event.eventType === "client_data_exported")).toBe(true);
  });

  it("anonymizes client data and invalidates promptable memory", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "anonymize-client",
    });

    const next = anonymizeClientDataInState(state, "client-mert");
    const client = next.clients.find((item) => item.id === "client-mert");
    const conversation = next.conversations.find((item) => item.clientId === "client-mert");
    const promptableMessages = next.messages.filter((message) => message.conversationId === conversation?.id);

    expect(client?.fullName).toBe("Anonymized Client");
    expect(client?.channelUserId).toBe("");
    expect(client?.channelPermission).toBe("blocked");
    expect(client?.aiStatus).toBe("passive");
    expect(conversation?.rollingSummary).toBe("");
    expect(promptableMessages.every((message) => message.body === "[client data anonymized]")).toBe(true);
    expect(next.auditEvents.some((event) => event.eventType === "client_data_anonymized")).toBe(true);
    expect(next.dataRequests).toHaveLength(1);
    expect(next.dataRequests[0]).toMatchObject({
      clientId: "client-mert",
      requestType: "anonymization",
      status: "completed",
    });
  });

  it("keeps retention durations behind legal review placeholders", () => {
    expect(RETENTION_POLICY_PLACEHOLDERS.length).toBeGreaterThan(0);
    expect(
      RETENTION_POLICY_PLACEHOLDERS.every((policy) => policy.retentionDecision === "legal_review_required"),
    ).toBe(true);
  });
});
