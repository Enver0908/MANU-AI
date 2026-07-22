import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeClientReferenceCode,
  encodeClientReferenceCode,
  formatClientReferenceShort,
} from "./client-reference-code";
import {
  buildListResponse,
  canonicalAiChatBodyHash,
  decodeAiChatListCursor,
  encodeAiChatListCursor,
  parseAiChatActivateBranchBody,
  parseAiChatCreateBody,
  parseAiChatListQuery,
  parseAiChatRenameBody,
} from "./phase-85-stage-4c-service";
import { resetInMemoryAiChatStoreForTests, resolveAiChatStore } from "./phase-85-stage-4c-store";
import type { AppTenantContext } from "./auth-context";

const CLIENT_A = "00000000-0000-4000-8000-000000000901";
const CLIENT_B = "00000000-0000-4000-8000-000000000902";

describe("client reference code", () => {
  it("round-trips a client UUID through Crockford Base32", () => {
    const encoded = encodeClientReferenceCode(CLIENT_A);
    expect(decodeClientReferenceCode(encoded)).toBe(CLIENT_A);
    expect(formatClientReferenceShort(encoded)).toBe(encoded.slice(0, 8));
  });

  it("accepts UUID input directly during decode", () => {
    expect(decodeClientReferenceCode(CLIENT_A)).toBe(CLIENT_A);
  });
});

describe("ai chat parsers", () => {
  it("rejects unknown fields in create body", () => {
    expect(() =>
      parseAiChatCreateBody({
        requestId: "req-1",
        scopeType: "general",
        title: "Plan review",
        tenantId: "forbidden",
      }),
    ).toThrow();
  });

  it("requires non-empty title", () => {
    expect(() =>
      parseAiChatCreateBody({
        requestId: "req-1",
        scopeType: "general",
        title: "   ",
      }),
    ).toThrow();
  });

  it("validates list cursor against active filters", () => {
    const cursor = encodeAiChatListCursor({
      v: 1,
      scope: "general",
      query: "plan",
      lastMessageAt: "2026-07-22T10:00:00.000Z",
      id: CLIENT_A,
    });

    expect(() =>
      decodeAiChatListCursor(cursor, {
        scope: "client",
        query: "plan",
      }),
    ).toThrow();
  });

  it("parses rename and activate branch mutations", () => {
    expect(
      parseAiChatRenameBody({
        requestId: "req-2",
        expectedRevision: 3,
        title: "Updated title",
      }),
    ).toEqual({
      requestId: "req-2",
      expectedRevision: 3,
      title: "Updated title",
    });

    expect(
      parseAiChatActivateBranchBody({
        requestId: "req-3",
        expectedRevision: 4,
        branchId: CLIENT_B,
      }),
    ).toEqual({
      requestId: "req-3",
      expectedRevision: 4,
      branchId: CLIENT_B,
    });
  });

  it("builds stable body hashes for idempotency", () => {
    const first = canonicalAiChatBodyHash({
      requestId: "req-4",
      scopeType: "general",
      clientId: null,
      title: "Same title",
    });
    const second = canonicalAiChatBodyHash({
      requestId: "req-4",
      scopeType: "general",
      clientId: null,
      title: "Same title",
    });
    const different = canonicalAiChatBodyHash({
      requestId: "req-4",
      scopeType: "general",
      clientId: null,
      title: "Different title",
    });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });
});

describe("in-memory ai chat store", () => {
  const context: AppTenantContext = {
    tenantId: "tenant-a",
    dietitianId: "dietitian-a",
    userId: "user-a",
    role: "dietitian",
  };

  beforeEach(() => {
    process.env.AI_CHAT_DETERMINISTIC_MODE = "true";
    resetInMemoryAiChatStoreForTests({
      clients: [
        {
          id: CLIENT_A,
          tenantId: "tenant-a",
          fullName: "Ayse Yilmaz",
          channel: "whatsapp",
          accessible: true,
        },
        {
          id: CLIENT_B,
          tenantId: "tenant-a",
          fullName: "Ayse Demir",
          channel: "telegram",
          accessible: true,
        },
        {
          id: "00000000-0000-4000-8000-000000000903",
          tenantId: "tenant-b",
          fullName: "Hidden Client",
          channel: "whatsapp",
          accessible: true,
        },
      ],
    });
  });

  it("creates idempotent conversations and lists them with cursor", async () => {
    const store = resolveAiChatStore();
    const input = {
      requestId: "create-1",
      scopeType: "client" as const,
      clientId: CLIENT_A,
      title: "Ayse follow-up",
    };

    const first = await store.createConversation(context, input);
    const second = await store.createConversation(context, input);
    expect(second.id).toBe(first.id);

    const listed = await store.listConversations(
      context,
      parseAiChatListQuery({ scope: "client", query: "Ayse", limit: "10" }),
    );
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.clientReferenceCode).toBe(encodeClientReferenceCode(CLIENT_A));

    const paged = buildListResponse(listed.items, listed.items[0] ? { lastMessageAt: listed.items[0].lastMessageAt, id: listed.items[0].id } : null, "client", "Ayse");
    expect(paged.nextCursor).toBeTruthy();
  });

  it("rejects stale revision on rename", async () => {
    const store = resolveAiChatStore();
    const created = await store.createConversation(context, {
      requestId: "create-2",
      scopeType: "general",
      clientId: null,
      title: "General planning",
    });

    await expect(
      store.renameConversation(context, created.id, {
        requestId: "rename-1",
        expectedRevision: created.revision + 1,
        title: "Renamed",
      }),
    ).rejects.toMatchObject({ code: "ai_chat_revision_conflict" });
  });

  it("returns only accessible tenant clients in search", async () => {
    const store = resolveAiChatStore();
    const results = await store.searchAccessibleClients(context, {
      query: "Ayse",
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results.every((item) => item.id !== "00000000-0000-4000-8000-000000000903")).toBe(true);
    expect(results[0]?.shortDisplay).toHaveLength(8);
  });
});

describe("ai chat store resolution", () => {
  it("fails closed when Supabase is unavailable outside deterministic mode", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDeterministic = process.env.AI_CHAT_DETERMINISTIC_MODE;
    const previousFallback = process.env.MANU_DEV_FALLBACK_STORE;
    const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    process.env.NODE_ENV = "production";
    delete process.env.AI_CHAT_DETERMINISTIC_MODE;
    delete process.env.MANU_DEV_FALLBACK_STORE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => resolveAiChatStore()).toThrowError(
      expect.objectContaining({ code: "ai_chat_store_unavailable", status: 503 }),
    );

    process.env.NODE_ENV = previousNodeEnv;
    if (previousDeterministic) {
      process.env.AI_CHAT_DETERMINISTIC_MODE = previousDeterministic;
    } else {
      delete process.env.AI_CHAT_DETERMINISTIC_MODE;
    }
    if (previousFallback) {
      process.env.MANU_DEV_FALLBACK_STORE = previousFallback;
    }
    if (previousSupabaseUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
    if (previousSupabaseKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousSupabaseKey;
    }
  });
});
