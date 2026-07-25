import { beforeEach, describe, expect, it } from "vitest";
import { AppRequestError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import {
  assertAiChatClientExportHasNoLeaks,
  countRetainedAiChatRowsForConversation,
  replayDeletionLedgerInMemory,
  setAiChatLegalHoldForTests,
} from "./phase-85-stage-4c-lifecycle";
import { maybeProcessDeterministicAiChatJobs } from "./phase-85-stage-4c-run-service";
import {
  buildInMemoryAiChatClientExportSlice,
  readInMemoryAiChatLifecycleStateForTests,
  readInMemoryAiChatStateForLifecycle,
  resetInMemoryAiChatStoreForTests,
  resolveAiChatStore,
  seedInMemoryClientGatewayFixture,
} from "./phase-85-stage-4c-store";

const tenantContext: AppTenantContext = {
  tenantId: "tenant-a",
  userId: "user-a",
  dietitianId: "dietitian-a",
  role: "dietitian",
  capabilities: ["dietitian_ai_chat"],
};

async function seedConversationWithMessages(store: ReturnType<typeof resolveAiChatStore>) {
  const conversation = await store.createConversation(tenantContext, {
    requestId: crypto.randomUUID(),
    scopeType: "general",
    clientId: null,
    title: "Lifecycle chat",
  });
  await store.sendMessage(tenantContext, conversation.id, {
    requestId: crypto.randomUUID(),
    expectedRevision: conversation.revision,
    body: "__fixture:hello__",
  });
  await maybeProcessDeterministicAiChatJobs(store);
  const afterFirst = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });
  await store.sendMessage(tenantContext, conversation.id, {
    requestId: crypto.randomUUID(),
    expectedRevision: afterFirst.revision,
    body: "__fixture:stream__",
  });
  await maybeProcessDeterministicAiChatJobs(store);
  return store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });
}

describe("phase 85 stage 4c lifecycle", () => {
  beforeEach(() => {
    process.env.AI_CHAT_DETERMINISTIC_MODE = "true";
    resetInMemoryAiChatStoreForTests();
  });

  it("full chat delete hides from history and purges retained rows", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);

    const result = await store.deleteConversation(tenantContext, detail.id, {
      requestId: crypto.randomUUID(),
      expectedRevision: detail.revision,
    });
    expect(result.status).toBe("deleting");

    const list = await store.listConversations(tenantContext, { scope: "all", query: "", limit: 30 });
    expect(list.items.some((item) => item.id === detail.id)).toBe(false);

    while ((await store.processLifecycleDeletionBatch(8)) > 0) {
      // drain purge jobs
    }

    expect(countRetainedAiChatRowsForConversation(readInMemoryAiChatStateForLifecycle(), tenantContext.tenantId, detail.id)).toBe(0);
    const ledger = readInMemoryAiChatLifecycleStateForTests().deletionLedger.find(
      (item) => item.entityType === "conversation",
    );
    expect(ledger?.completedAt).toBeTruthy();
    expect(ledger?.entityIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(ledger)).not.toContain(detail.title);
  });

  it("rejects delete on non-latest user message and assistant-only delete", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);
    const firstUser = detail.messages.find((message) => message.role === "user");
    const assistant = detail.messages.find((message) => message.role === "assistant");
    expect(firstUser).toBeTruthy();
    expect(assistant).toBeTruthy();

    await expect(
      store.deleteMessage(tenantContext, firstUser!.id, {
        requestId: crypto.randomUUID(),
        expectedRevision: detail.revision,
      }),
    ).rejects.toMatchObject({ code: "ai_chat_message_not_latest_user" });

    await expect(
      store.deleteMessage(tenantContext, assistant!.id, {
        requestId: crypto.randomUUID(),
        expectedRevision: detail.revision,
      }),
    ).rejects.toMatchObject({ code: "ai_chat_assistant_delete_forbidden" });
  });

  it("deletes latest user message and dependent assistant artifacts", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);
    const latestUser = [...detail.messages].reverse().find((message) => message.role === "user");
    expect(latestUser).toBeTruthy();

    await store.deleteMessage(tenantContext, latestUser!.id, {
      requestId: crypto.randomUUID(),
      expectedRevision: detail.revision,
    });
    while ((await store.processLifecycleDeletionBatch(8)) > 0) {
      // drain
    }

    const after = await store.loadConversation(tenantContext, detail.id, { messageLimit: 50 });
    expect(after.messages.some((message) => message.id === latestUser!.id)).toBe(false);
    expect(after.messages.some((message) => message.role === "assistant")).toBe(true);
  });

  it("blocks delete under legal hold with 423", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);
    setAiChatLegalHoldForTests(readInMemoryAiChatLifecycleStateForTests(), {
      tenantId: tenantContext.tenantId,
      active: true,
    });

    await expect(
      store.deleteConversation(tenantContext, detail.id, {
        requestId: crypto.randomUUID(),
        expectedRevision: detail.revision,
      }),
    ).rejects.toBeInstanceOf(AppRequestError);

    await expect(
      store.deleteConversation(tenantContext, detail.id, {
        requestId: crypto.randomUUID(),
        expectedRevision: detail.revision,
      }),
    ).rejects.toMatchObject({ status: 423, code: "ai_chat_legal_hold" });
  });

  it("client export includes client-scope ai chat only", async () => {
    const clientId = "client-mert";
    seedInMemoryClientGatewayFixture({
      id: clientId,
      tenantId: tenantContext.tenantId,
      fullName: "Mert",
    });
    const store = resolveAiChatStore();
    const general = await store.createConversation(tenantContext, {
      requestId: crypto.randomUUID(),
      scopeType: "general",
      clientId: null,
      title: "General",
    });
    const clientChat = await store.createConversation(tenantContext, {
      requestId: crypto.randomUUID(),
      scopeType: "client",
      clientId,
      title: "Client chat",
    });
    await store.sendMessage(tenantContext, clientChat.id, {
      requestId: crypto.randomUUID(),
      expectedRevision: clientChat.revision,
      body: "__fixture:hello__",
    });
    await maybeProcessDeterministicAiChatJobs(store);

    const slice = buildInMemoryAiChatClientExportSlice(clientId);
    expect(slice?.conversations.some((item) => item.id === clientChat.id)).toBe(true);
    expect(slice?.conversations.some((item) => item.id === general.id)).toBe(false);
    assertAiChatClientExportHasNoLeaks(slice!);
    expect(JSON.stringify(slice)).not.toContain("toolArguments");
  });

  it("client removal queues client-scoped chat purge", async () => {
    const clientId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    seedInMemoryClientGatewayFixture({
      id: clientId,
      tenantId: tenantContext.tenantId,
      fullName: "Ayse",
    });
    const store = resolveAiChatStore();
    const clientChat = await store.createConversation(tenantContext, {
      requestId: crypto.randomUUID(),
      scopeType: "client",
      clientId,
      title: "Client purge",
    });
    const general = await store.createConversation(tenantContext, {
      requestId: crypto.randomUUID(),
      scopeType: "general",
      clientId: null,
      title: "General stays",
    });

    await store.enqueueClientScopedDeletions(tenantContext, clientId, "client_removal");
    while ((await store.processLifecycleDeletionBatch(8)) > 0) {
      // drain
    }

    const list = await store.listConversations(tenantContext, { scope: "all", query: "", limit: 30 });
    expect(list.items.some((item) => item.id === clientChat.id)).toBe(false);
    expect(list.items.some((item) => item.id === general.id)).toBe(true);
  });

  it("account membership removal queues account-scoped chat purge", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);

    await store.enqueueAccountScopedDeletions(
      tenantContext.tenantId,
      tenantContext.userId,
      "account_membership_removed",
    );
    const queued = readInMemoryAiChatLifecycleStateForTests().deletionJobs.find(
      (item) =>
        item.jobKind === "account_chats_purge" &&
        item.tenantId === tenantContext.tenantId &&
        item.targetUserId === tenantContext.userId,
    );

    expect(queued).toBeTruthy();
    while ((await store.processLifecycleDeletionBatch(8)) > 0) {
      // drain
    }

    const list = await store.listConversations(tenantContext, { scope: "all", query: "", limit: 30 });
    expect(list.items.some((item) => item.id === detail.id)).toBe(false);
  });

  it("replays deletion ledger after restore rehearsal", async () => {
    const store = resolveAiChatStore();
    const detail = await seedConversationWithMessages(store);
    await store.deleteConversation(tenantContext, detail.id, {
      requestId: crypto.randomUUID(),
      expectedRevision: detail.revision,
    });
    while ((await store.processLifecycleDeletionBatch(8)) > 0) {
      // drain
    }

    const replay = replayDeletionLedgerInMemory(readInMemoryAiChatStateForLifecycle());
    expect(replay.reapplied).toBeGreaterThan(0);
    expect(
      readInMemoryAiChatLifecycleStateForTests().deletionLedger.every((item) => item.replayStatus === "verified"),
    ).toBe(true);
  });
});
