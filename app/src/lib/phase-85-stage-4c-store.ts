import { randomUUID } from "node:crypto";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import {
  clientReferenceMatchesQuery,
  encodeClientReferenceCode,
  formatClientReferenceShort,
} from "./client-reference-code";
import { isSupabaseStoreConfigured } from "./supabase-store";
import { getSupabaseAdminClient } from "./supabase";
import type {
  AiChatBranchDto,
  AiChatClientSearchItem,
  AiChatConversationDetail,
  AiChatConversationListResponse,
  AiChatConversationSummary,
  AiChatScopeType,
  AiChatTitleSource,
} from "./phase-85-stage-4c-contracts";
import {
  buildListResponse,
  canonicalAiChatBodyHash,
  decodeAiChatListCursor,
  mapConversationDetail,
  mapConversationListItem,
  mapConversationSummary,
  mapRpcError,
  type AiChatActivateBranchInput,
  type AiChatClientSearchQuery,
  type AiChatCreateInput,
  type AiChatListQuery,
  type AiChatLoadQuery,
  type AiChatRenameInput,
} from "./phase-85-stage-4c-service";

export interface AiChatStore {
  createConversation(context: AppTenantContext, input: AiChatCreateInput): Promise<AiChatConversationSummary>;
  listConversations(context: AppTenantContext, input: AiChatListQuery): Promise<AiChatConversationListResponse>;
  loadConversation(
    context: AppTenantContext,
    chatId: string,
    input: AiChatLoadQuery,
  ): Promise<AiChatConversationDetail>;
  renameConversation(
    context: AppTenantContext,
    chatId: string,
    input: AiChatRenameInput,
  ): Promise<AiChatConversationSummary>;
  listBranches(context: AppTenantContext, chatId: string): Promise<AiChatBranchDto[]>;
  activateBranch(
    context: AppTenantContext,
    chatId: string,
    input: AiChatActivateBranchInput,
  ): Promise<AiChatConversationSummary>;
  searchAccessibleClients(
    context: AppTenantContext,
    input: AiChatClientSearchQuery,
  ): Promise<AiChatClientSearchItem[]>;
}

type InMemoryConversation = {
  id: string;
  tenantId: string;
  createdByUserId: string;
  createdByDietitianId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  title: string;
  titleSource: AiChatTitleSource;
  status: AiChatConversationSummary["status"];
  activeBranchId: string;
  revision: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientFullName: string | null;
  preview: string | null;
};

type InMemoryBranch = AiChatBranchDto;
type InMemoryMessage = AiChatConversationDetail["messages"][number];

type InMemoryState = {
  conversations: InMemoryConversation[];
  branches: InMemoryBranch[];
  messages: InMemoryMessage[];
  ledger: Array<{
    tenantId: string;
    requestId: string;
    createdByUserId: string;
    bodyHash: string;
    responseDigest: string;
  }>;
  clients: Array<{ id: string; tenantId: string; fullName: string; channel: string | null; accessible: boolean }>;
};

let inMemoryState: InMemoryState = {
  conversations: [],
  branches: [],
  messages: [],
  ledger: [],
  clients: [],
};

export function resetInMemoryAiChatStoreForTests(state: Partial<InMemoryState> = {}) {
  inMemoryState = {
    conversations: [],
    branches: [],
    messages: [],
    ledger: [],
    clients: [],
    ...state,
  };
}

function canUseInMemoryAiChatStore() {
  return process.env.NODE_ENV === "test" || process.env.AI_CHAT_DETERMINISTIC_MODE === "true";
}

export function resolveAiChatStore(): AiChatStore {
  if (isSupabaseStoreConfigured()) {
    return supabaseAiChatStore;
  }
  if (canUseInMemoryAiChatStore()) {
    return inMemoryAiChatStore;
  }
  throw new AppRequestError(503, "ai_chat_store_unavailable");
}

function assertInMemoryClientAccess(context: AppTenantContext, clientId: string | null) {
  if (!clientId) return;
  const client = inMemoryState.clients.find(
    (item) => item.tenantId === context.tenantId && item.id === clientId && item.accessible,
  );
  if (!client) {
    throw new AppRequestError(404, "ai_chat_not_found", "clientId");
  }
}

function getInMemoryConversation(context: AppTenantContext, chatId: string) {
  const conversation = inMemoryState.conversations.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.id === chatId &&
      item.createdByUserId === context.userId,
  );
  if (!conversation) {
    throw new AppRequestError(404, "ai_chat_not_found");
  }
  if (conversation.scopeType === "client") {
    assertInMemoryClientAccess(context, conversation.clientId);
  }
  return conversation;
}

function readLedger(
  context: AppTenantContext,
  requestId: string,
  bodyHash: string,
) {
  const existing = inMemoryState.ledger.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.requestId === requestId &&
      item.createdByUserId === context.userId,
  );
  if (!existing) return null;
  if (existing.bodyHash !== bodyHash) {
    throw new AppRequestError(409, "ai_chat_idempotency_conflict");
  }
  return existing.responseDigest;
}

function writeLedger(
  context: AppTenantContext,
  requestId: string,
  bodyHash: string,
  responseDigest: string,
) {
  inMemoryState.ledger.push({
    tenantId: context.tenantId,
    requestId,
    createdByUserId: context.userId,
    bodyHash,
    responseDigest,
  });
}

const inMemoryAiChatStore: AiChatStore = {
  async createConversation(context, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const conversation = getInMemoryConversation(context, existingDigest);
      return {
        id: conversation.id,
        tenantId: conversation.tenantId,
        createdByUserId: conversation.createdByUserId,
        createdByDietitianId: conversation.createdByDietitianId,
        scopeType: conversation.scopeType,
        clientId: conversation.clientId,
        title: conversation.title,
        titleSource: conversation.titleSource,
        status: conversation.status,
        activeBranchId: conversation.activeBranchId,
        revision: conversation.revision,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    }

    if (input.scopeType === "client") {
      assertInMemoryClientAccess(context, input.clientId);
    }

    const now = new Date().toISOString();
    const conversationId = randomUUID();
    const branchId = randomUUID();
    const client = input.clientId
      ? inMemoryState.clients.find((item) => item.id === input.clientId) ?? null
      : null;

    const conversation: InMemoryConversation = {
      id: conversationId,
      tenantId: context.tenantId,
      createdByUserId: context.userId,
      createdByDietitianId: context.dietitianId,
      scopeType: input.scopeType,
      clientId: input.clientId,
      title: input.title,
      titleSource: "user",
      status: "active",
      activeBranchId: branchId,
      revision: 1,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
      clientFullName: client?.fullName ?? null,
      preview: null,
    };

    const branch: InMemoryBranch = {
      id: branchId,
      tenantId: context.tenantId,
      conversationId,
      createdByUserId: context.userId,
      parentBranchId: null,
      forkedFromMessageVersionId: null,
      activeLeafVersionId: null,
      forkReason: "initial",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryState.conversations.push(conversation);
    inMemoryState.branches.push(branch);
    writeLedger(context, input.requestId, bodyHash, conversationId);

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      createdByUserId: conversation.createdByUserId,
      createdByDietitianId: conversation.createdByDietitianId,
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      title: conversation.title,
      titleSource: conversation.titleSource,
      status: conversation.status,
      activeBranchId: conversation.activeBranchId,
      revision: conversation.revision,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  },

  async listConversations(context, input) {
    const cursor = input.cursor
      ? decodeAiChatListCursor(input.cursor, { scope: input.scope, query: input.query })
      : null;

    const items = inMemoryState.conversations
      .filter((item) => item.tenantId === context.tenantId && item.createdByUserId === context.userId)
      .filter((item) => input.scope === "all" || item.scopeType === input.scope)
      .filter((item) => {
        if (item.scopeType === "client") {
          try {
            assertInMemoryClientAccess(context, item.clientId);
            return true;
          } catch {
            return false;
          }
        }
        return true;
      })
      .filter((item) => {
        if (!input.query) return true;
        const haystack = `${item.title} ${item.clientFullName ?? ""}`.toLowerCase();
        return haystack.includes(input.query.toLowerCase());
      })
      .filter((item) => {
        if (!cursor) return true;
        const sortAt = item.lastMessageAt ?? item.createdAt;
        const cursorAt = cursor.lastMessageAt ?? "";
        return (sortAt < cursorAt) || (sortAt === cursorAt && item.id < cursor.id);
      })
      .sort((a, b) => {
        const aAt = a.lastMessageAt ?? a.createdAt;
        const bAt = b.lastMessageAt ?? b.createdAt;
        if (aAt === bAt) return b.id.localeCompare(a.id);
        return bAt.localeCompare(aAt);
      })
      .slice(0, input.limit)
      .map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        createdByUserId: item.createdByUserId,
        createdByDietitianId: item.createdByDietitianId,
        scopeType: item.scopeType,
        clientId: item.clientId,
        title: item.title,
        titleSource: item.titleSource,
        status: item.status,
        activeBranchId: item.activeBranchId,
        revision: item.revision,
        lastMessageAt: item.lastMessageAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        preview: item.preview,
        clientFullName: item.clientFullName,
        clientReferenceCode: item.clientId ? encodeClientReferenceCode(item.clientId) : null,
        clientReferenceShort: item.clientId
          ? formatClientReferenceShort(encodeClientReferenceCode(item.clientId))
          : null,
      }));

    const last = items.at(-1);
    return buildListResponse(
      items,
      last ? { lastMessageAt: last.lastMessageAt, id: last.id } : null,
      input.scope,
      input.query,
    );
  },

  async loadConversation(context, chatId, input) {
    const conversation = getInMemoryConversation(context, chatId);
    const branches = inMemoryState.branches.filter(
      (item) => item.tenantId === context.tenantId && item.conversationId === chatId,
    );
    const messages = inMemoryState.messages
      .filter((item) => item.tenantId === context.tenantId && item.conversationId === chatId)
      .slice(0, input.messageLimit);

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      createdByUserId: conversation.createdByUserId,
      createdByDietitianId: conversation.createdByDietitianId,
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      title: conversation.title,
      titleSource: conversation.titleSource,
      status: conversation.status,
      activeBranchId: conversation.activeBranchId,
      revision: conversation.revision,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      preview: conversation.preview,
      clientFullName: conversation.clientFullName,
      clientReferenceCode: conversation.clientId ? encodeClientReferenceCode(conversation.clientId) : null,
      clientReferenceShort: conversation.clientId
        ? formatClientReferenceShort(encodeClientReferenceCode(conversation.clientId))
        : null,
      branches,
      messages,
    };
  },

  async renameConversation(context, chatId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const conversation = getInMemoryConversation(context, existingDigest);
      return {
        id: conversation.id,
        tenantId: conversation.tenantId,
        createdByUserId: conversation.createdByUserId,
        createdByDietitianId: conversation.createdByDietitianId,
        scopeType: conversation.scopeType,
        clientId: conversation.clientId,
        title: conversation.title,
        titleSource: conversation.titleSource,
        status: conversation.status,
        activeBranchId: conversation.activeBranchId,
        revision: conversation.revision,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    }

    const conversation = getInMemoryConversation(context, chatId);
    if (conversation.status !== "active") {
      throw new AppRequestError(409, "ai_chat_conversation_locked");
    }
    if (conversation.revision !== input.expectedRevision) {
      throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
    }

    conversation.title = input.title;
    conversation.titleSource = "user";
    conversation.revision += 1;
    conversation.updatedAt = new Date().toISOString();
    writeLedger(context, input.requestId, bodyHash, chatId);

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      createdByUserId: conversation.createdByUserId,
      createdByDietitianId: conversation.createdByDietitianId,
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      title: conversation.title,
      titleSource: conversation.titleSource,
      status: conversation.status,
      activeBranchId: conversation.activeBranchId,
      revision: conversation.revision,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  },

  async listBranches(context, chatId) {
    getInMemoryConversation(context, chatId);
    return inMemoryState.branches.filter(
      (item) => item.tenantId === context.tenantId && item.conversationId === chatId,
    );
  },

  async activateBranch(context, chatId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const conversation = getInMemoryConversation(context, existingDigest);
      return {
        id: conversation.id,
        tenantId: conversation.tenantId,
        createdByUserId: conversation.createdByUserId,
        createdByDietitianId: conversation.createdByDietitianId,
        scopeType: conversation.scopeType,
        clientId: conversation.clientId,
        title: conversation.title,
        titleSource: conversation.titleSource,
        status: conversation.status,
        activeBranchId: conversation.activeBranchId,
        revision: conversation.revision,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    }

    const conversation = getInMemoryConversation(context, chatId);
    if (conversation.status !== "active") {
      throw new AppRequestError(409, "ai_chat_conversation_locked");
    }
    if (conversation.revision !== input.expectedRevision) {
      throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
    }
    const branch = inMemoryState.branches.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.conversationId === chatId &&
        item.id === input.branchId,
    );
    if (!branch) {
      throw new AppRequestError(404, "ai_chat_not_found");
    }

    conversation.activeBranchId = input.branchId;
    conversation.revision += 1;
    conversation.updatedAt = new Date().toISOString();
    writeLedger(context, input.requestId, bodyHash, chatId);

    return {
      id: conversation.id,
      tenantId: conversation.tenantId,
      createdByUserId: conversation.createdByUserId,
      createdByDietitianId: conversation.createdByDietitianId,
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      title: conversation.title,
      titleSource: conversation.titleSource,
      status: conversation.status,
      activeBranchId: conversation.activeBranchId,
      revision: conversation.revision,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  },

  async searchAccessibleClients(context, input) {
    return inMemoryState.clients
      .filter((item) => item.tenantId === context.tenantId && item.accessible)
      .filter((item) => {
        if (!input.query) return true;
        const reference = encodeClientReferenceCode(item.id);
        return (
          item.fullName.toLowerCase().includes(input.query.toLowerCase()) ||
          clientReferenceMatchesQuery(reference, input.query)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id))
      .slice(0, input.limit)
      .map((item) => {
        const displayReference = encodeClientReferenceCode(item.id);
        return {
          id: item.id,
          fullName: item.fullName,
          displayReference,
          shortDisplay: formatClientReferenceShort(displayReference),
          channel: item.channel,
        };
      });
  },
};

function requireSupabaseAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppRequestError(503, "ai_chat_store_unavailable");
  }
  return supabase;
}

const supabaseAiChatStore: AiChatStore = {
  async createConversation(context, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_create_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_scope_type: input.scopeType,
      p_client_id: input.clientId,
      p_title: input.title,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async listConversations(context, input) {
    const supabase = requireSupabaseAdmin();
    const cursor = input.cursor
      ? decodeAiChatListCursor(input.cursor, { scope: input.scope, query: input.query })
      : null;
    const { data, error } = await supabase.rpc("p85_stage_4c_list_conversations_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_scope_filter: input.scope,
      p_query: input.query,
      p_cursor_last_message_at: cursor?.lastMessageAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: input.limit,
    });
    if (error) mapRpcError(error);
    const payload = data as {
      items: never[];
      next_cursor: { last_message_at: string | null; id: string } | null;
    };
    const items = (payload.items ?? []).map((row) => mapConversationListItem(row));
    return buildListResponse(
      items,
      payload.next_cursor
        ? {
            lastMessageAt: payload.next_cursor.last_message_at,
            id: payload.next_cursor.id,
          }
        : null,
      input.scope,
      input.query,
    );
  },

  async loadConversation(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_load_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_message_limit: input.messageLimit,
    });
    if (error) mapRpcError(error);
    const payload = data as {
      conversation: never;
      branches: Record<string, unknown>[];
      messages: Record<string, unknown>[];
    };
    return mapConversationDetail(payload);
  },

  async renameConversation(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_rename_conversation_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_expected_revision: input.expectedRevision,
      p_title: input.title,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async listBranches(context, chatId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_branches_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
    });
    if (error) mapRpcError(error);
    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      conversationId: String(row.conversation_id),
      createdByUserId: String(row.created_by_user_id),
      parentBranchId: (row.parent_branch_id as string | null) ?? null,
      forkedFromMessageVersionId: (row.forked_from_message_version_id as string | null) ?? null,
      activeLeafVersionId: (row.active_leaf_version_id as string | null) ?? null,
      forkReason: (row.fork_reason as string | null) ?? null,
      revision: Number(row.revision),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async activateBranch(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_activate_branch_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_branch_id: input.branchId,
      p_expected_revision: input.expectedRevision,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    return mapConversationSummary(data as never);
  },

  async searchAccessibleClients(context, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_search_accessible_clients_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_query: input.query,
      p_limit: input.limit,
    });
    if (error) mapRpcError(error);
    return (data as Array<{ id: string; full_name: string; primary_channel: string | null }>).map((row) => {
      const displayReference = encodeClientReferenceCode(row.id);
      return {
        id: row.id,
        fullName: row.full_name,
        displayReference,
        shortDisplay: formatClientReferenceShort(displayReference),
        channel: row.primary_channel,
      };
    });
  },
};
