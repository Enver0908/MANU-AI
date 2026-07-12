import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { createInitialState } from "./seed-data";
import {
  activateClientAiWithControlledRiskResolutionInState,
  approveDraftMessageInState,
  runInboundSimulation,
  updateClientInState,
} from "./simulator";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";

describe("phase-85-if-f risk reactivation and concurrency", () => {
  it("resolves yellow hold and restores previous mode through controlled activation", async () => {
    const withDraft = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-if-f-yellow-1",
      now: "2026-05-22T10:30:00.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(withDraft.clients.find((client) => client.id === "client-elif")?.yellowRiskHold.status).toBe("active");

    const conversation = withDraft.conversations.find((item) => item.clientId === "client-elif")!;
    const activated = activateClientAiWithControlledRiskResolutionInState(withDraft, "client-elif", {
      requestedAiMode: "copilot",
      expectedConversationRevision: conversationRevisionOrDefault(conversation),
      expectedClientContextRevision: withDraft.clients.find((item) => item.id === "client-elif")!.contextRevision,
      activationSource: "activate_ai_api",
    });

    const client = activated.clients.find((item) => item.id === "client-elif");
    expect(client?.aiStatus).toBe("active");
    expect(client?.aiMode).toBe("copilot");
    expect(client?.yellowRiskHold).toEqual({ status: "none" });
    expect(activated.messages.find((message) => message.id === draft?.id)?.status).toBe("blocked");
    expect(conversationRevisionOrDefault(activated.conversations.find((item) => item.id === conversation.id)!)).toBe(
      conversationRevisionOrDefault(conversation) + 1,
    );
    expect(
      activated.auditEvents.some((event) => event.eventType === "controlled_ai_activation_completed"),
    ).toBe(true);
  });

  it("resumes manual takeover without clinical resolution evidence", async () => {
    const locked = updateClientInState(createInitialState(), "client-mert", {
      humanTakeoverLocked: true,
      aiStatus: "passive",
      aiMode: "manual",
    });

    const activated = activateClientAiWithControlledRiskResolutionInState(locked, "client-mert", {
      requestedAiMode: "copilot",
      expectedConversationRevision: conversationRevisionOrDefault(
        locked.conversations.find((item) => item.clientId === "client-mert")!,
      ),
      expectedClientContextRevision: locked.clients.find((item) => item.id === "client-mert")!.contextRevision,
    });
    const client = activated.clients.find((item) => item.id === "client-mert");
    expect(client?.humanTakeoverLocked).toBe(false);
    expect(client?.aiStatus).toBe("active");
    expect(activated.riskActivityEvents.some((event) => event.eventType === "risk_resolved")).toBe(false);
    expect(activated.riskActivityEvents.some((event) => event.eventType === "ai_reactivated")).toBe(true);
  });

  it("falls back to copilot when autopilot is requested but safety is incomplete", async () => {
    const locked = updateClientInState(createInitialState(), "client-mert", {
      humanTakeoverLocked: true,
      aiStatus: "passive",
      aiMode: "manual",
      mandatorySafetyComplete: false,
    });

    const activated = activateClientAiWithControlledRiskResolutionInState(locked, "client-mert", {
      requestedAiMode: "autopilot",
      expectedConversationRevision: conversationRevisionOrDefault(
        locked.conversations.find((item) => item.clientId === "client-mert")!,
      ),
      expectedClientContextRevision: locked.clients.find((item) => item.id === "client-mert")!.contextRevision,
    });
    expect(activated.clients.find((item) => item.id === "client-mert")?.aiMode).toBe("copilot");
  });

  it("rejects direct client patch aiStatus active on red lock", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-if-f-red-patch-1",
      now: "2026-05-22T10:31:00.000Z",
    });

    expect(() =>
      updateClientInState(withHandoff, "client-mert", { aiStatus: "active", aiMode: "copilot" }),
    ).toThrowError(/direct_ai_activation_requires_activate_ai_endpoint/);
  });

  it("blocks controlled activation when conversation revision CAS fails", async () => {
    const locked = updateClientInState(createInitialState(), "client-mert", {
      humanTakeoverLocked: true,
      aiStatus: "passive",
      aiMode: "manual",
    });
    const conversation = locked.conversations.find((item) => item.clientId === "client-mert")!;

    expect(() =>
      activateClientAiWithControlledRiskResolutionInState(locked, "client-mert", {
        expectedConversationRevision: conversationRevisionOrDefault(conversation) + 99,
        expectedClientContextRevision: locked.clients.find((item) => item.id === "client-mert")!.contextRevision,
      }),
    ).toThrowError(new AppDomainError(409, "reactivation_conflict_conversation_revision"));
  });

  it("blocks controlled activation when client context revision CAS fails", async () => {
    const locked = updateClientInState(createInitialState(), "client-mert", {
      humanTakeoverLocked: true,
      aiStatus: "passive",
      aiMode: "manual",
    });
    const conversation = locked.conversations.find((item) => item.clientId === "client-mert")!;
    const client = locked.clients.find((item) => item.id === "client-mert")!;

    expect(() =>
      activateClientAiWithControlledRiskResolutionInState(locked, "client-mert", {
        expectedConversationRevision: conversationRevisionOrDefault(conversation),
        expectedClientContextRevision: client.contextRevision + 99,
      }),
    ).toThrowError(new AppDomainError(409, "reactivation_conflict_client_context_revision"));
  });

  it("blocks stale draft send when conversation revision changed after generation", async () => {
    const copilotState = updateClientInState(createInitialState(), "client-mert", {
      aiMode: "copilot",
    });
    const withDraft = await runInboundSimulation(copilotState, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "p85-if-f-stale-revision-1",
      now: "2026-05-22T10:32:00.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const conversation = withDraft.conversations.find((item) => item.clientId === "client-mert")!;
    const staleState = {
      ...withDraft,
      conversations: withDraft.conversations.map((item) =>
        item.id === conversation.id ? { ...item, revision: conversationRevisionOrDefault(item) + 1 } : item,
      ),
    };

    const next = approveDraftMessageInState(staleState, draft?.id || "");
    const blockedDecision = next.aiDecisions.find((decision) => decision.id === draft?.generatedByAiDecisionId);
    expect(blockedDecision?.blockedReason).toBe("context_changed_before_send");
  });
});
