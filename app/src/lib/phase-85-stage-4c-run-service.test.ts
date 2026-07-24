import { beforeEach, describe, expect, it } from "vitest";
import type { AppTenantContext } from "./auth-context";
import { resetInMemoryAiChatStoreForTests, resolveAiChatStore, seedInMemoryClientGatewayFixture } from "./phase-85-stage-4c-store";
import {
  finalizeRunOutcome,
  maybeProcessDeterministicAiChatJobs,
  parseAiChatSendMessageBody,
} from "./phase-85-stage-4c-run-service";
import { INITIAL_AI_CHAT_STREAMING_STATE, reduceAiChatRunEvent } from "./use-ai-chat";

const tenantContext: AppTenantContext = {
  tenantId: "tenant-a",
  userId: "user-a",
  dietitianId: "dietitian-a",
  role: "dietitian",
  capabilities: ["dietitian_ai_chat"],
};

describe("parseAiChatSendMessageBody", () => {
  it("rejects empty bodies", () => {
    expect(() =>
      parseAiChatSendMessageBody({
        requestId: "req-1",
        expectedRevision: 1,
        body: "   ",
      }),
    ).toThrow();
  });
});

describe("reduceAiChatRunEvent", () => {
  it("deduplicates events by sequence number", () => {
    const first = reduceAiChatRunEvent(INITIAL_AI_CHAT_STREAMING_STATE, {
      sequenceNumber: 1,
      eventType: "response.delta",
      payload: { text: "hello" },
    });
    const second = reduceAiChatRunEvent(first, {
      sequenceNumber: 1,
      eventType: "response.delta",
      payload: { text: "ignored" },
    });
    expect(second.streamingText).toBe("hello");
  });
});

describe("finalizeRunOutcome", () => {
  beforeEach(() => {
    resetInMemoryAiChatStoreForTests();
  });

  it("preserves red risk on stopped partial output", async () => {
    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-stop-red",
      scopeType: "general",
      clientId: null,
      title: "Stop red",
    });
    const send = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-stop-red",
      expectedRevision: conversation.revision,
      body: "__fixture:hello__",
    });

    await finalizeRunOutcome({
      store,
      tenantId: tenantContext.tenantId,
      runId: send.runId,
      run: { conversationId: conversation.id, createdByUserId: tenantContext.userId },
      triggerBody: "__fixture:risk:red__",
      conversation: {
        scopeType: "general",
        clientId: null,
        id: conversation.id,
        createdByDietitianId: tenantContext.dietitianId,
        revision: conversation.revision,
      },
      gatewayAccessInput: {
        tenantId: tenantContext.tenantId,
        userId: tenantContext.userId,
        dietitianId: tenantContext.dietitianId,
        role: "dietitian",
        scopeType: "general",
        clientId: null,
        conversationRevision: conversation.revision,
      },
      capturedRevisionToken: null,
      outcome: {
        kind: "stopped",
        partialText: "Partial red answer",
        providerRiskLevel: "red",
      },
    });

    const run = await store.getRunById(tenantContext.tenantId, send.runId);
    expect(run?.status).toBe("stopped");
    expect(run?.riskLevel).toBe("red");
  });

  it("does not create assistant message on empty stop but still records risk", async () => {
    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-stop-empty",
      scopeType: "general",
      clientId: null,
      title: "Stop empty",
    });
    const send = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-stop-empty",
      expectedRevision: conversation.revision,
      body: "__fixture:hello__",
    });

    await finalizeRunOutcome({
      store,
      tenantId: tenantContext.tenantId,
      runId: send.runId,
      run: { conversationId: conversation.id, createdByUserId: tenantContext.userId },
      triggerBody: "__fixture:risk:yellow__",
      conversation: {
        scopeType: "general",
        clientId: null,
        id: conversation.id,
        createdByDietitianId: tenantContext.dietitianId,
        revision: conversation.revision,
      },
      gatewayAccessInput: {
        tenantId: tenantContext.tenantId,
        userId: tenantContext.userId,
        dietitianId: tenantContext.dietitianId,
        role: "dietitian",
        scopeType: "general",
        clientId: null,
        conversationRevision: conversation.revision,
      },
      capturedRevisionToken: null,
      outcome: { kind: "stopped", partialText: "   " },
    });

    const detail = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 20 });
    expect(detail.messages.some((message) => message.role === "assistant")).toBe(false);
    const run = await store.getRunById(tenantContext.tenantId, send.runId);
    expect(run?.status).toBe("stopped");
    expect(run?.riskLevel).toBe("yellow");
  });
});

describe("ai chat run flow (in-memory)", () => {
  beforeEach(() => {
    process.env.AI_CHAT_DETERMINISTIC_MODE = "true";
    resetInMemoryAiChatStoreForTests();
  });

  it("send + deterministic worker completes fixture hello", async () => {
    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-1",
      scopeType: "general",
      clientId: null,
      title: "Fixture chat",
    });

    const send = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-1",
      expectedRevision: conversation.revision,
      body: "__fixture:hello__",
    });
    expect(send.runId).toBeTruthy();

    await maybeProcessDeterministicAiChatJobs(store);

    const run = await store.getRunById(tenantContext.tenantId, send.runId);
    expect(run?.status).toBe("completed");

    const detail = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });
    expect(detail.messages.some((message) => message.role === "assistant")).toBe(true);
  });

  it("rejects edit on non-latest user message", async () => {
    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-2",
      scopeType: "general",
      clientId: null,
      title: "Edit guard",
    });

    const first = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-2a",
      expectedRevision: conversation.revision,
      body: "__fixture:hello__",
    });
    await maybeProcessDeterministicAiChatJobs(store);
    const afterFirst = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });

    await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-2b",
      expectedRevision: afterFirst.revision,
      body: "__fixture:stream__",
    });
    await maybeProcessDeterministicAiChatJobs(store);
    const afterSecond = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });
    const firstUser = afterSecond.messages.find((message) => message.role === "user");
    expect(firstUser).toBeTruthy();

    await expect(
      store.editMessage(tenantContext, firstUser!.id, {
        requestId: "edit-1",
        expectedRevision: afterSecond.revision,
        body: "edited",
      }),
    ).rejects.toMatchObject({ code: "ai_chat_message_not_latest_user" });

    expect(first.runId).toBeTruthy();
  });

  it("client chat run retrieves bounded context and emits source events", async () => {
    const clientId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    resetInMemoryAiChatStoreForTests();
    seedInMemoryClientGatewayFixture({
      id: clientId,
      tenantId: tenantContext.tenantId,
      fullName: "Client Context Fixture",
    });

    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-context",
      scopeType: "client",
      clientId,
      title: "Client context",
    });

    const send = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-context",
      expectedRevision: conversation.revision,
      body: "__fixture:context__",
    });
    await maybeProcessDeterministicAiChatJobs(store);

    const run = await store.getRunById(tenantContext.tenantId, send.runId);
    expect(run?.status).toBe("completed");

    const sources = await store.listRunSources(tenantContext.tenantId, send.runId, tenantContext.userId);
    expect(sources.sources.length).toBeGreaterThan(0);

    const events = await store.listRunEvents(tenantContext, send.runId, 0);
    expect(events.some((event) => event.eventType === "source.available")).toBe(true);
    expect(events.some((event) => event.eventType === "run.status" && event.payload.status === "retrieving")).toBe(
      true,
    );
  });

  it("applies risk pipeline fixtures for client chat runs", async () => {
    const clientId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    resetInMemoryAiChatStoreForTests();
    seedInMemoryClientGatewayFixture({
      id: clientId,
      tenantId: tenantContext.tenantId,
      fullName: "Risk Fixture Client",
    });

    const store = resolveAiChatStore();
    const conversation = await store.createConversation(tenantContext, {
      requestId: "create-risk",
      scopeType: "client",
      clientId,
      title: "Risk fixture",
    });

    const send = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-risk-green",
      expectedRevision: conversation.revision,
      body: "__fixture:risk:green__",
    });
    await maybeProcessDeterministicAiChatJobs(store);

    const run = await store.getRunById(tenantContext.tenantId, send.runId);
    expect(run?.status).toBe("completed");

    const summary = await store.getRunRiskSummary(tenantContext.tenantId, send.runId, tenantContext.userId);
    expect(summary?.riskLevel).toBe("green");
    expect(summary?.canTransferDraft).toBe(true);

    const redSend = await store.sendMessage(tenantContext, conversation.id, {
      requestId: "send-risk-red",
      expectedRevision: (await store.loadConversation(tenantContext, conversation.id, { messageLimit: 10 })).revision,
      body: "__fixture:risk:red__",
    });
    await maybeProcessDeterministicAiChatJobs(store);
    const redSummary = await store.getRunRiskSummary(tenantContext.tenantId, redSend.runId, tenantContext.userId);
    expect(redSummary?.riskLevel).toBe("red");
    expect(redSummary?.canTransferDraft).toBe(false);

    await expect(
      store.transferRunDraft(tenantContext, redSend.runId, {
        sourceConversationId: conversation.id,
        destinationConversationId: "missing",
        destinationRevision: 1,
        clientContextRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "ai_chat_red_draft_blocked" });
  });
});
