import { beforeEach, describe, expect, it } from "vitest";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import { inMemoryAiChatStore } from "./phase-85-stage-4c-in-memory-store";
import { maybeProcessDeterministicAiChatJobs } from "./phase-85-stage-4c-run-service";
import { resetInMemoryAiChatStoreForTests } from "./phase-85-stage-4c-store";
import type { AiChatStore } from "./phase-85-stage-4c-store";
import { isSupabaseStoreConfigured } from "./supabase-store";
import { assertSupabaseAiChatCoreContractReady, supabaseAiChatStore } from "./phase-85-stage-4c-supabase-store";

const tenantContext: AppTenantContext = {
  tenantId: "tenant-conformance",
  userId: "user-conformance",
  dietitianId: "dietitian-conformance",
  role: "dietitian",
  capabilities: ["dietitian_ai_chat"],
};

const adapters: Array<{ name: string; getStore: () => AiChatStore; enabled: boolean }> = [
  { name: "in-memory", getStore: () => inMemoryAiChatStore, enabled: true },
  {
    name: "supabase",
    getStore: () => {
      assertSupabaseAiChatCoreContractReady();
      return supabaseAiChatStore;
    },
    enabled: isSupabaseStoreConfigured(),
  },
];

async function runCoreChatConformance(store: AiChatStore) {
  const conversation = await store.createConversation(tenantContext, {
    requestId: `create-${Date.now()}`,
    scopeType: "general",
    clientId: null,
    title: "Conformance chat",
  });

  const requestId = `send-${Date.now()}`;
  const send = await store.sendMessage(tenantContext, conversation.id, {
    requestId,
    expectedRevision: conversation.revision,
    body: "__fixture:hello__",
  });

  expect(send.runId).toBeTruthy();
  expect(send.messageId).toBeTruthy();
  expect(send.messageVersionId).toBeTruthy();
  expect(send.conversationRevision).toBeGreaterThan(conversation.revision);

  const replay = await store.sendMessage(tenantContext, conversation.id, {
    requestId,
    expectedRevision: conversation.revision,
    body: "__fixture:hello__",
  });
  expect(replay.runId).toBe(send.runId);
  expect(replay.messageId).toBe(send.messageId);

  await maybeProcessDeterministicAiChatJobs(store);

  const run = await store.getRunById(tenantContext.tenantId, send.runId);
  expect(run?.status).toBe("completed");

  const detail = await store.loadConversation(tenantContext, conversation.id, { messageLimit: 50 });
  const assistant = detail.messages.find((message) => message.role === "assistant");
  expect(assistant).toBeTruthy();

  const regenerate = await store.regenerateMessage(tenantContext, assistant!.id, {
    requestId: `regen-${Date.now()}`,
    expectedRevision: detail.revision,
  });
  expect(regenerate.runId).toBeTruthy();
  expect(regenerate.branchId).toBeTruthy();
}

describe.each(adapters.filter((adapter) => adapter.enabled))(
  "Stage 4C store conformance (%s)",
  ({ name, getStore }) => {
    beforeEach(() => {
      if (name === "in-memory") {
        process.env.AI_CHAT_DETERMINISTIC_MODE = "true";
        resetInMemoryAiChatStoreForTests();
      }
    });

    it("creates, sends, idempotently replays, and regenerates on the core chat path", async () => {
      await runCoreChatConformance(getStore());
    });

    it("maps stale revision to conflict", async () => {
      const store = getStore();
      const conversation = await store.createConversation(tenantContext, {
        requestId: `stale-create-${Date.now()}`,
        scopeType: "general",
        clientId: null,
        title: "Stale revision",
      });

      await expect(
        store.sendMessage(tenantContext, conversation.id, {
          requestId: `stale-send-${Date.now()}`,
          expectedRevision: conversation.revision - 1,
          body: "__fixture:hello__",
        }),
      ).rejects.toBeInstanceOf(AppRequestError);
    });
  },
);

describe("Stage 4C store conformance (supabase blocked)", () => {
  it("documents when the Supabase adapter is unavailable in this environment", () => {
    if (isSupabaseStoreConfigured()) return;
    expect(adapters.find((adapter) => adapter.name === "supabase")?.enabled).toBe(false);
  });
});
