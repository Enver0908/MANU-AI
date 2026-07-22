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
  AiChatJobRecord,
  AiChatMessageVersionRecord,
  AiChatMutationRunResult,
  AiChatRunDto,
  AiChatRunEventDto,
  AiChatScopeType,
  AiChatSendMessageResult,
  AiChatStopRunResult,
  AiChatTitleSource,
} from "./phase-85-stage-4c-contracts";
import { isNonTerminalAiChatRunStatus } from "./phase-85-stage-4c-contracts";
import type {
  AiChatEditMessageInput,
  AiChatRegenerateMessageInput,
  AiChatSendMessageInput,
  AiChatStopRunInput,
} from "./phase-85-stage-4c-run-service";
import {
  assertUserActiveRunBudget,
  buildAcceptedRunEvent,
  hashMessageBody,
  runEventExpiryIso,
} from "./phase-85-stage-4c-run-service";
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
import type {
  AccessibleClientIdentity,
  AiChatContextSnapshotInput,
  ContextGatewayAccessState,
  ContextToolExecutionResult,
} from "./phase-85-stage-4c-context-gateway";
import {
  createDefaultClientGatewayFixture,
  executeInMemoryContextTool,
  toAccessibleClientIdentity,
  type ClientGatewayFixture,
} from "./phase-85-stage-4c-context-fixtures";
import type { AiChatContextTool, AiChatConversationRecord } from "./phase-85-stage-4c-contracts";

export type BranchMessageChainItem = {
  messageId: string;
  role: "user" | "assistant";
  activeBody: string;
  versionId: string;
};

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
  sendMessage(
    context: AppTenantContext,
    chatId: string,
    input: AiChatSendMessageInput,
  ): Promise<AiChatSendMessageResult>;
  editMessage(
    context: AppTenantContext,
    messageId: string,
    input: AiChatEditMessageInput,
  ): Promise<AiChatMutationRunResult>;
  regenerateMessage(
    context: AppTenantContext,
    messageId: string,
    input: AiChatRegenerateMessageInput,
  ): Promise<AiChatMutationRunResult>;
  stopRun(context: AppTenantContext, runId: string, input: AiChatStopRunInput): Promise<AiChatStopRunResult>;
  listRunEvents(
    context: AppTenantContext,
    runId: string,
    afterSequence: number,
  ): Promise<AiChatRunEventDto[]>;
  getRunById(tenantId: string, runId: string): Promise<AiChatRunDto | null>;
  getMessageVersionById(tenantId: string, versionId: string): Promise<AiChatMessageVersionRecord | null>;
  getBranchMessageChain(tenantId: string, branchId: string): Promise<BranchMessageChainItem[]>;
  claimNextAiChatJob(workerId: string, leaseMs: number): Promise<AiChatJobRecord | null>;
  completeAiChatJob(jobId: string, workerId: string, leaseToken: string): Promise<void>;
  failAiChatJob(jobId: string, workerId: string, leaseToken: string, errorCode: string): Promise<void>;
  renewJobLease(jobId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<void>;
  shouldAbortRun(tenantId: string, runId: string): Promise<boolean>;
  updateRunStatus(tenantId: string, runId: string, status: AiChatRunDto["status"]): Promise<void>;
  appendRunEvent(
    tenantId: string,
    runId: string,
    input: { eventType: string; payload: Record<string, unknown> },
  ): Promise<AiChatRunEventDto>;
  finalizeRun(
    tenantId: string,
    runId: string,
    input: {
      status: AiChatRunDto["status"];
      answerability?: AiChatRunDto["answerability"];
      riskLevel?: AiChatRunDto["riskLevel"];
      errorCode?: string | null;
    },
  ): Promise<void>;
  commitAssistantMessage(
    tenantId: string,
    runId: string,
    input: {
      body: string;
      answerability: AiChatRunDto["answerability"];
      riskLevel: AiChatRunDto["riskLevel"];
      completionState?: "complete" | "incomplete";
    },
  ): Promise<void>;
  enqueueTitleJob(tenantId: string, conversationId: string, userId: string): Promise<void>;
  applyAutoTitleIfEligible(tenantId: string, conversationId: string, maxLength: number): Promise<void>;
  getConversationRecord(tenantId: string, conversationId: string): Promise<AiChatConversationRecord | null>;
  getContextGatewayAccess(input: {
    tenantId: string;
    userId: string;
    dietitianId: string;
    role: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    conversationRevision: number;
  }): Promise<ContextGatewayAccessState>;
  listContextGatewayAccessibleClients(tenantId: string): Promise<AccessibleClientIdentity[]>;
  executeContextGatewayTool(input: {
    tenantId: string;
    clientId: string;
    tool: AiChatContextTool;
    args: Record<string, unknown>;
    options?: { failRisk?: boolean; delayMs?: number };
  }): Promise<ContextToolExecutionResult>;
  saveContextSnapshot(input: AiChatContextSnapshotInput): Promise<void>;
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

type InMemoryRun = AiChatRunDto;
type InMemoryRunEvent = AiChatRunEventDto & { createdByUserId: string; expiresAt: string };
type InMemoryJob = AiChatJobRecord;
type InMemoryMessageVersion = AiChatMessageVersionRecord;

type InMemoryState = {
  conversations: InMemoryConversation[];
  branches: InMemoryBranch[];
  messages: InMemoryMessage[];
  messageVersions: InMemoryMessageVersion[];
  runs: InMemoryRun[];
  runEvents: InMemoryRunEvent[];
  jobs: InMemoryJob[];
  memorySummaries: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    branchId: string;
    createdByUserId: string;
    summaryText: string;
    isAuthoritative: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  ledger: Array<{
    tenantId: string;
    requestId: string;
    createdByUserId: string;
    bodyHash: string;
    responseDigest: string;
  }>;
  clients: Array<{ id: string; tenantId: string; fullName: string; channel: string | null; accessible: boolean }>;
  clientGatewayFixtures: Record<string, ClientGatewayFixture>;
  clientRevisionOverrides: Record<string, string>;
  contextSnapshots: Array<AiChatContextSnapshotInput & { id: string; createdAt: string }>;
};

let inMemoryState: InMemoryState = {
  conversations: [],
  branches: [],
  messages: [],
  messageVersions: [],
  runs: [],
  runEvents: [],
  jobs: [],
  memorySummaries: [],
  ledger: [],
  clients: [],
  clientGatewayFixtures: {},
  clientRevisionOverrides: {},
  contextSnapshots: [],
};

export function resetInMemoryAiChatStoreForTests(state: Partial<InMemoryState> = {}) {
  inMemoryState = {
    conversations: [],
    branches: [],
    messages: [],
    messageVersions: [],
    runs: [],
    runEvents: [],
    jobs: [],
    memorySummaries: [],
    ledger: [],
    clients: [],
    clientGatewayFixtures: {},
    clientRevisionOverrides: {},
    contextSnapshots: [],
    ...state,
  };
}

export function seedInMemoryClientGatewayFixture(client: {
  id: string;
  tenantId: string;
  fullName: string;
  accessible?: boolean;
  fixture?: ClientGatewayFixture;
}) {
  const existing = inMemoryState.clients.find((item) => item.id === client.id);
  if (!existing) {
    inMemoryState.clients.push({
      id: client.id,
      tenantId: client.tenantId,
      fullName: client.fullName,
      channel: "whatsapp",
      accessible: client.accessible ?? true,
    });
  }
  inMemoryState.clientGatewayFixtures[client.id] =
    client.fixture ?? createDefaultClientGatewayFixture(client.id, client.fullName);
}

export function setInMemoryClientRevisionToken(clientId: string, revisionToken: string) {
  inMemoryState.clientRevisionOverrides[clientId] = revisionToken;
}

function getInMemoryClientGatewayFixture(clientId: string, fullName: string) {
  if (!inMemoryState.clientGatewayFixtures[clientId]) {
    inMemoryState.clientGatewayFixtures[clientId] = createDefaultClientGatewayFixture(clientId, fullName);
  }
  return inMemoryState.clientGatewayFixtures[clientId]!;
}

function resolveInMemoryClientRevisionToken(clientId: string, fixture: ClientGatewayFixture) {
  return inMemoryState.clientRevisionOverrides[clientId] ?? fixture.revisionToken;
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

function countActiveRunsForUser(tenantId: string, userId: string) {
  return inMemoryState.runs.filter(
    (run) =>
      run.tenantId === tenantId &&
      run.createdByUserId === userId &&
      isNonTerminalAiChatRunStatus(run.status),
  ).length;
}

function countActiveRunsForConversation(tenantId: string, conversationId: string) {
  return inMemoryState.runs.filter(
    (run) =>
      run.tenantId === tenantId &&
      run.conversationId === conversationId &&
      isNonTerminalAiChatRunStatus(run.status),
  ).length;
}

function supersedeActiveRuns(tenantId: string, conversationId: string) {
  const now = new Date().toISOString();
  for (const run of inMemoryState.runs) {
    if (
      run.tenantId === tenantId &&
      run.conversationId === conversationId &&
      isNonTerminalAiChatRunStatus(run.status)
    ) {
      run.status = "superseded";
      run.updatedAt = now;
    }
  }
}

function getBranch(tenantId: string, branchId: string) {
  return inMemoryState.branches.find((item) => item.tenantId === tenantId && item.id === branchId) ?? null;
}

function buildBranchMessageChain(tenantId: string, branchId: string): BranchMessageChainItem[] {
  const branch = getBranch(tenantId, branchId);
  if (!branch?.activeLeafVersionId) return [];

  const chain: BranchMessageChainItem[] = [];
  let currentVersionId: string | null = branch.activeLeafVersionId;
  const visited = new Set<string>();

  while (currentVersionId && !visited.has(currentVersionId)) {
    visited.add(currentVersionId);
    const version =
      inMemoryState.messageVersions.find(
        (item) => item.tenantId === tenantId && item.id === currentVersionId,
      ) ??
      inMemoryState.messages
        .flatMap((message) => message.versions)
        .find((item) => item.id === currentVersionId);
    if (!version) break;
    const message =
      inMemoryState.messages.find(
        (item) => item.tenantId === tenantId && item.id === version.messageId,
      ) ?? null;
    if (!message) break;
    chain.unshift({
      messageId: message.id,
      role: message.role,
      activeBody: version.body,
      versionId: version.id,
    });
    currentVersionId = version.parentVersionId;
  }

  return chain;
}

function materializeBranchMessages(
  tenantId: string,
  conversationId: string,
  branchId: string,
  limit: number,
): InMemoryMessage[] {
  const chain = buildBranchMessageChain(tenantId, branchId).slice(-limit);
  return chain.map((item) => {
    const message = inMemoryState.messages.find(
      (entry) => entry.tenantId === tenantId && entry.id === item.messageId,
    );
    const versions =
      inMemoryState.messageVersions.filter(
        (entry) => entry.tenantId === tenantId && entry.messageId === item.messageId,
      ) ?? message?.versions ??
      [];
    const mergedVersions = versions.length > 0 ? versions : message?.versions ?? [];
    return {
      id: item.messageId,
      tenantId,
      conversationId,
      createdByUserId: message?.createdByUserId ?? "",
      role: item.role,
      authorUserId: message?.authorUserId ?? null,
      deletedAt: message?.deletedAt ?? null,
      createdAt: message?.createdAt ?? new Date().toISOString(),
      updatedAt: message?.updatedAt ?? new Date().toISOString(),
      versions: mergedVersions.map((version) => ({
        ...version,
        contentStatus: version.id === item.versionId ? "active" : version.contentStatus,
      })),
    };
  });
}

function nextRunEventSequence(tenantId: string, runId: string) {
  const existing = inMemoryState.runEvents.filter((item) => item.tenantId === tenantId && item.runId === runId);
  return existing.reduce((max, item) => Math.max(max, item.sequenceNumber), 0) + 1;
}

function createInMemoryRunEvent(
  tenantId: string,
  runId: string,
  conversationId: string,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): InMemoryRunEvent {
  const event: InMemoryRunEvent = {
    id: randomUUID(),
    tenantId,
    runId,
    conversationId,
    createdByUserId: userId,
    sequenceNumber: nextRunEventSequence(tenantId, runId),
    eventType,
    payload,
    expiresAt: runEventExpiryIso(),
    createdAt: new Date().toISOString(),
  };
  inMemoryState.runEvents.push(event);
  return event;
}

function createGenerationRun(input: {
  tenantId: string;
  conversationId: string;
  userId: string;
  triggerVersionId: string;
}) {
  const now = new Date().toISOString();
  const run: InMemoryRun = {
    id: randomUUID(),
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    createdByUserId: input.userId,
    triggerMessageVersionId: input.triggerVersionId,
    status: "queued",
    answerability: null,
    riskLevel: null,
    safetyOutcome: null,
    cancelRequestedAt: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryState.runs.push(run);
  return run;
}

function enqueueGenerationJob(input: {
  tenantId: string;
  conversationId: string;
  userId: string;
  runId: string;
}) {
  const now = new Date().toISOString();
  const job: InMemoryJob = {
    id: randomUUID(),
    tenantId: input.tenantId,
    jobType: "generation",
    runId: input.runId,
    conversationId: input.conversationId,
    createdByUserId: input.userId,
    status: "queued",
    payload: {},
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    retryCount: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryState.jobs.push(job);
  return job;
}

function createUserMessageVersion(input: {
  tenantId: string;
  conversationId: string;
  userId: string;
  branchId: string;
  body: string;
  parentVersionId: string | null;
  supersedesVersionId?: string | null;
}) {
  const now = new Date().toISOString();
  const messageId = randomUUID();
  const versionId = randomUUID();
  const version: InMemoryMessageVersion = {
    id: versionId,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    messageId,
    branchId: input.branchId,
    createdByUserId: input.userId,
    body: input.body,
    bodySha256: hashMessageBody(input.body),
    parentVersionId: input.parentVersionId,
    supersedesVersionId: input.supersedesVersionId ?? null,
    runId: null,
    contentStatus: "active",
    createdAt: now,
  };
  const message: InMemoryMessage = {
    id: messageId,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    createdByUserId: input.userId,
    role: "user",
    authorUserId: input.userId,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    versions: [version],
  };
  inMemoryState.messages.push(message);
  inMemoryState.messageVersions.push(version);
  const branch = getBranch(input.tenantId, input.branchId);
  if (branch) {
    branch.activeLeafVersionId = versionId;
    branch.updatedAt = now;
  }
  return { messageId, versionId };
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
    const messages = materializeBranchMessages(
      context.tenantId,
      chatId,
      conversation.activeBranchId,
      input.messageLimit,
    );

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

  async sendMessage(context, chatId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const [runId, messageId, messageVersionId, revision] = existingDigest.split("|");
      return {
        runId,
        messageId,
        messageVersionId,
        conversationRevision: Number(revision),
      };
    }

    const conversation = getInMemoryConversation(context, chatId);
    if (conversation.status !== "active") {
      throw new AppRequestError(409, "ai_chat_conversation_locked");
    }
    if (conversation.revision !== input.expectedRevision) {
      throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
    }

    const targetBranchId = input.branchId ?? conversation.activeBranchId;
    if (input.branchId && input.branchId !== conversation.activeBranchId) {
      conversation.activeBranchId = input.branchId;
    }
    const branch = getBranch(context.tenantId, targetBranchId);
    if (!branch) throw new AppRequestError(404, "ai_chat_not_found");

    if (countActiveRunsForConversation(context.tenantId, chatId) > 0) {
      throw new AppRequestError(409, "ai_chat_active_run_conflict");
    }
    assertUserActiveRunBudget(countActiveRunsForUser(context.tenantId, context.userId));

    const parentVersionId = branch.activeLeafVersionId;
    const { messageId, versionId } = createUserMessageVersion({
      tenantId: context.tenantId,
      conversationId: chatId,
      userId: context.userId,
      branchId: targetBranchId,
      body: input.body,
      parentVersionId,
    });

    const run = createGenerationRun({
      tenantId: context.tenantId,
      conversationId: chatId,
      userId: context.userId,
      triggerVersionId: versionId,
    });
    enqueueGenerationJob({
      tenantId: context.tenantId,
      conversationId: chatId,
      userId: context.userId,
      runId: run.id,
    });
    createInMemoryRunEvent(
      context.tenantId,
      run.id,
      chatId,
      context.userId,
      buildAcceptedRunEvent(run).eventType,
      buildAcceptedRunEvent(run).payload,
    );

    conversation.revision += 1;
    conversation.lastMessageAt = new Date().toISOString();
    conversation.preview = input.body.slice(0, 120);
    conversation.updatedAt = conversation.lastMessageAt;
    writeLedger(
      context,
      input.requestId,
      bodyHash,
      `${run.id}|${messageId}|${versionId}|${conversation.revision}`,
    );

    return {
      runId: run.id,
      messageId,
      messageVersionId: versionId,
      conversationRevision: conversation.revision,
    };
  },

  async editMessage(context, messageId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const [runId, branchId, revision] = existingDigest.split("|");
      return { runId, branchId, conversationRevision: Number(revision) };
    }

    const message = inMemoryState.messages.find(
      (item) => item.tenantId === context.tenantId && item.id === messageId,
    );
    if (!message || message.role !== "user") {
      throw new AppRequestError(404, "ai_chat_message_not_found");
    }

    const conversation = getInMemoryConversation(context, message.conversationId);
    if (conversation.revision !== input.expectedRevision) {
      throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
    }

    const chain = buildBranchMessageChain(context.tenantId, conversation.activeBranchId);
    const latestUser = [...chain].reverse().find((item) => item.role === "user");
    if (!latestUser || latestUser.messageId !== messageId) {
      throw new AppRequestError(409, "ai_chat_message_not_latest_user");
    }

    supersedeActiveRuns(context.tenantId, conversation.id);
    const currentVersion = inMemoryState.messageVersions.find(
      (item) => item.id === latestUser.versionId,
    );
    const now = new Date().toISOString();
    const branchId = randomUUID();
    const branch: InMemoryBranch = {
      id: branchId,
      tenantId: context.tenantId,
      conversationId: conversation.id,
      createdByUserId: context.userId,
      parentBranchId: conversation.activeBranchId,
      forkedFromMessageVersionId: currentVersion?.parentVersionId ?? null,
      activeLeafVersionId: null,
      forkReason: "edit",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryState.branches.push(branch);
    conversation.activeBranchId = branchId;

    const { messageId: newMessageId, versionId } = createUserMessageVersion({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      userId: context.userId,
      branchId,
      body: input.body,
      parentVersionId: currentVersion?.parentVersionId ?? null,
      supersedesVersionId: latestUser.versionId,
    });

    const run = createGenerationRun({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      userId: context.userId,
      triggerVersionId: versionId,
    });
    enqueueGenerationJob({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      userId: context.userId,
      runId: run.id,
    });
    createInMemoryRunEvent(
      context.tenantId,
      run.id,
      conversation.id,
      context.userId,
      buildAcceptedRunEvent(run).eventType,
      buildAcceptedRunEvent(run).payload,
    );

    conversation.revision += 1;
    conversation.preview = input.body.slice(0, 120);
    conversation.lastMessageAt = now;
    conversation.updatedAt = now;
    writeLedger(context, input.requestId, bodyHash, `${run.id}|${branchId}|${conversation.revision}`);

    return {
      runId: run.id,
      branchId,
      messageId: newMessageId,
      messageVersionId: versionId,
      conversationRevision: conversation.revision,
    };
  },

  async regenerateMessage(context, messageId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      const [runId, branchId, revision] = existingDigest.split("|");
      return { runId, branchId, conversationRevision: Number(revision) };
    }

    const message = inMemoryState.messages.find(
      (item) => item.tenantId === context.tenantId && item.id === messageId,
    );
    if (!message || message.role !== "assistant") {
      throw new AppRequestError(409, "ai_chat_regenerate_not_latest_assistant");
    }

    const conversation = getInMemoryConversation(context, message.conversationId);
    if (conversation.revision !== input.expectedRevision) {
      throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
    }

    const chain = buildBranchMessageChain(context.tenantId, conversation.activeBranchId);
    const latest = chain.at(-1);
    if (!latest || latest.messageId !== messageId || latest.role !== "assistant") {
      throw new AppRequestError(409, "ai_chat_regenerate_not_latest_assistant");
    }

    const assistantVersion = inMemoryState.messageVersions.find((item) => item.id === latest.versionId);
    const parentUserVersionId = assistantVersion?.parentVersionId;
    if (!parentUserVersionId) {
      throw new AppRequestError(409, "ai_chat_regenerate_not_latest_assistant");
    }

    supersedeActiveRuns(context.tenantId, conversation.id);
    const now = new Date().toISOString();
    const branchId = randomUUID();
    const branch: InMemoryBranch = {
      id: branchId,
      tenantId: context.tenantId,
      conversationId: conversation.id,
      createdByUserId: context.userId,
      parentBranchId: conversation.activeBranchId,
      forkedFromMessageVersionId: parentUserVersionId,
      activeLeafVersionId: parentUserVersionId,
      forkReason: "regenerate",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryState.branches.push(branch);
    conversation.activeBranchId = branchId;

    const run = createGenerationRun({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      userId: context.userId,
      triggerVersionId: parentUserVersionId,
    });
    enqueueGenerationJob({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      userId: context.userId,
      runId: run.id,
    });
    createInMemoryRunEvent(
      context.tenantId,
      run.id,
      conversation.id,
      context.userId,
      buildAcceptedRunEvent(run).eventType,
      buildAcceptedRunEvent(run).payload,
    );

    conversation.revision += 1;
    conversation.updatedAt = now;
    writeLedger(context, input.requestId, bodyHash, `${run.id}|${branchId}|${conversation.revision}`);

    return {
      runId: run.id,
      branchId,
      conversationRevision: conversation.revision,
    };
  },

  async stopRun(context, runId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const existingDigest = readLedger(context, input.requestId, bodyHash);
    if (existingDigest) {
      return { runId, status: existingDigest as AiChatStopRunResult["status"] };
    }

    const run = inMemoryState.runs.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.id === runId &&
        item.createdByUserId === context.userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    if (!isNonTerminalAiChatRunStatus(run.status)) {
      writeLedger(context, input.requestId, bodyHash, run.status);
      return { runId, status: run.status };
    }

    run.status = "cancel_requested";
    run.cancelRequestedAt = new Date().toISOString();
    run.updatedAt = run.cancelRequestedAt;
    writeLedger(context, input.requestId, bodyHash, run.status);
    return { runId, status: run.status };
  },

  async listRunEvents(context, runId, afterSequence) {
    const run = inMemoryState.runs.find(
      (item) =>
        item.tenantId === context.tenantId &&
        item.id === runId &&
        item.createdByUserId === context.userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    return inMemoryState.runEvents
      .filter(
        (item) =>
          item.tenantId === context.tenantId &&
          item.runId === runId &&
          item.sequenceNumber > afterSequence,
      )
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        runId: item.runId,
        conversationId: item.conversationId,
        sequenceNumber: item.sequenceNumber,
        eventType: item.eventType,
        payload: item.payload,
        createdAt: item.createdAt,
      }));
  },

  async getRunById(tenantId, runId) {
    return inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId) ?? null;
  },

  async getMessageVersionById(tenantId, versionId) {
    return (
      inMemoryState.messageVersions.find((item) => item.tenantId === tenantId && item.id === versionId) ??
      null
    );
  },

  async getBranchMessageChain(tenantId, branchId) {
    return buildBranchMessageChain(tenantId, branchId);
  },

  async claimNextAiChatJob(workerId, leaseMs) {
    const now = Date.now();
    const job = inMemoryState.jobs
      .filter((item) => item.status === "queued" || (item.leaseExpiresAt && new Date(item.leaseExpiresAt).getTime() <= now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return null;
    const leaseToken = randomUUID();
    job.status = "processing";
    job.leaseOwner = workerId;
    job.leaseToken = leaseToken;
    job.leaseExpiresAt = new Date(now + leaseMs).toISOString();
    job.heartbeatAt = new Date().toISOString();
    job.updatedAt = job.heartbeatAt;
    return { ...job };
  },

  async completeAiChatJob(jobId, workerId, leaseToken) {
    const job = inMemoryState.jobs.find((item) => item.id === jobId);
    if (!job || job.leaseOwner !== workerId || job.leaseToken !== leaseToken) return;
    job.status = "completed";
    job.updatedAt = new Date().toISOString();
  },

  async failAiChatJob(jobId, workerId, leaseToken, errorCode) {
    const job = inMemoryState.jobs.find((item) => item.id === jobId);
    if (!job || job.leaseOwner !== workerId || job.leaseToken !== leaseToken) return;
    job.retryCount += 1;
    job.status = job.retryCount >= 3 ? "permanently_failed" : "retryable_failed";
    job.payload = { ...job.payload, lastError: errorCode };
    job.leaseOwner = null;
    job.leaseToken = null;
    job.updatedAt = new Date().toISOString();
  },

  async renewJobLease(jobId, workerId, leaseToken, leaseMs) {
    const job = inMemoryState.jobs.find((item) => item.id === jobId);
    if (!job || job.leaseOwner !== workerId || job.leaseToken !== leaseToken) return;
    job.leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
    job.heartbeatAt = new Date().toISOString();
    job.updatedAt = job.heartbeatAt;
  },

  async shouldAbortRun(tenantId, runId) {
    const run = inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId);
    if (!run) return true;
    return ["cancel_requested", "superseded", "stopped", "failed", "completed"].includes(run.status);
  },

  async updateRunStatus(tenantId, runId, status) {
    const run = inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId);
    if (!run) return;
    run.status = status;
    run.updatedAt = new Date().toISOString();
  },

  async appendRunEvent(tenantId, runId, input) {
    const run = inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId);
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    const event = createInMemoryRunEvent(
      tenantId,
      runId,
      run.conversationId,
      run.createdByUserId,
      input.eventType,
      input.payload,
    );
    return {
      id: event.id,
      tenantId: event.tenantId,
      runId: event.runId,
      conversationId: event.conversationId,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt,
    };
  },

  async finalizeRun(tenantId, runId, input) {
    const run = inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId);
    if (!run) return;
    run.status = input.status;
    run.answerability = input.answerability ?? run.answerability;
    run.riskLevel = input.riskLevel ?? run.riskLevel;
    run.errorCode = input.errorCode ?? run.errorCode;
    run.updatedAt = new Date().toISOString();
  },

  async commitAssistantMessage(tenantId, runId, input) {
    const run = inMemoryState.runs.find((item) => item.tenantId === tenantId && item.id === runId);
    if (!run) return;
    const triggerVersion = inMemoryState.messageVersions.find(
      (item) => item.tenantId === tenantId && item.id === run.triggerMessageVersionId,
    );
    if (!triggerVersion) return;

    const existing = inMemoryState.messageVersions.find(
      (item) => item.tenantId === tenantId && item.runId === runId,
    );
    if (existing) return;

    const now = new Date().toISOString();
    const messageId = randomUUID();
    const versionId = randomUUID();
    const version: InMemoryMessageVersion = {
      id: versionId,
      tenantId,
      conversationId: run.conversationId,
      messageId,
      branchId: triggerVersion.branchId,
      createdByUserId: run.createdByUserId,
      body: input.body,
      bodySha256: hashMessageBody(input.body),
      parentVersionId: run.triggerMessageVersionId,
      supersedesVersionId: null,
      runId,
      contentStatus: "active",
      createdAt: now,
    };
    const message: InMemoryMessage = {
      id: messageId,
      tenantId,
      conversationId: run.conversationId,
      createdByUserId: run.createdByUserId,
      role: "assistant",
      authorUserId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      versions: [version],
    };
    inMemoryState.messages.push(message);
    inMemoryState.messageVersions.push(version);
    const branch = getBranch(tenantId, triggerVersion.branchId);
    if (branch) {
      branch.activeLeafVersionId = versionId;
      branch.updatedAt = now;
    }
    const conversation = inMemoryState.conversations.find(
      (item) => item.tenantId === tenantId && item.id === run.conversationId,
    );
    if (conversation) {
      conversation.preview = input.body.slice(0, 120);
      conversation.lastMessageAt = now;
      conversation.updatedAt = now;
    }
  },

  async enqueueTitleJob(tenantId, conversationId, userId) {
    const conversation = inMemoryState.conversations.find(
      (item) => item.tenantId === tenantId && item.id === conversationId,
    );
    if (!conversation || conversation.titleSource === "user") return;
    const now = new Date().toISOString();
    inMemoryState.jobs.push({
      id: randomUUID(),
      tenantId,
      jobType: "title",
      runId: null,
      conversationId,
      createdByUserId: userId,
      status: "queued",
      payload: {},
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      retryCount: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },

  async applyAutoTitleIfEligible(tenantId, conversationId, maxLength) {
    const conversation = inMemoryState.conversations.find(
      (item) => item.tenantId === tenantId && item.id === conversationId,
    );
    if (!conversation || conversation.titleSource === "user") return;
    const chain = buildBranchMessageChain(tenantId, conversation.activeBranchId);
    const firstUser = chain.find((item) => item.role === "user");
    if (!firstUser?.activeBody) return;
    conversation.title = firstUser.activeBody.slice(0, maxLength);
    conversation.titleSource = "auto";
    conversation.updatedAt = new Date().toISOString();
  },

  async getConversationRecord(tenantId, conversationId) {
    const conversation = inMemoryState.conversations.find(
      (item) => item.tenantId === tenantId && item.id === conversationId,
    );
    if (!conversation) return null;
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

  async getContextGatewayAccess(input) {
    const checkedAt = new Date().toISOString();
    if (input.scopeType === "general") {
      return {
        authorized: true,
        clientId: null,
        revisionToken: `conversation:${input.conversationRevision}`,
        checkedAt,
      };
    }
    if (!input.clientId) {
      return {
        authorized: false,
        clientId: null,
        revisionToken: "",
        checkedAt,
      };
    }
    const client = inMemoryState.clients.find(
      (item) => item.tenantId === input.tenantId && item.id === input.clientId && item.accessible,
    );
    if (!client) {
      return {
        authorized: false,
        clientId: input.clientId,
        revisionToken: "",
        checkedAt,
      };
    }
    const fixture = getInMemoryClientGatewayFixture(client.id, client.fullName);
    return {
      authorized: true,
      clientId: input.clientId,
      revisionToken: resolveInMemoryClientRevisionToken(input.clientId, fixture),
      checkedAt,
    };
  },

  async listContextGatewayAccessibleClients(tenantId) {
    return inMemoryState.clients
      .filter((item) => item.tenantId === tenantId && item.accessible)
      .map((item) => toAccessibleClientIdentity(item));
  },

  async executeContextGatewayTool(input) {
    const client = inMemoryState.clients.find(
      (item) => item.tenantId === input.tenantId && item.id === input.clientId,
    );
    const fixture = getInMemoryClientGatewayFixture(
      input.clientId,
      client?.fullName ?? "Client",
    );
    return executeInMemoryContextTool(fixture, input.tool, input.args, input.options);
  },

  async saveContextSnapshot(input) {
    inMemoryState.contextSnapshots.push({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
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

  async sendMessage(context, chatId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_send_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_chat_id: chatId,
      p_expected_revision: input.expectedRevision,
      p_body: input.body,
      p_branch_id: input.branchId,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      messageId: String(row.message_id),
      messageVersionId: String(row.message_version_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async editMessage(context, messageId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_edit_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_message_id: messageId,
      p_expected_revision: input.expectedRevision,
      p_body: input.body,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      branchId: String(row.branch_id),
      messageId: String(row.message_id),
      messageVersionId: String(row.message_version_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async regenerateMessage(context, messageId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_regenerate_message_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_message_id: messageId,
      p_expected_revision: input.expectedRevision,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error, input.expectedRevision);
    const row = data as Record<string, unknown>;
    return {
      runId: String(row.run_id),
      branchId: String(row.branch_id),
      conversationRevision: Number(row.conversation_revision),
    };
  },

  async stopRun(context, runId, input) {
    const supabase = requireSupabaseAdmin();
    const bodyHash = canonicalAiChatBodyHash(input);
    const { data, error } = await supabase.rpc("p85_stage_4c_stop_run_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_run_id: runId,
      p_request_id: input.requestId,
      p_body_hash: bodyHash,
    });
    if (error) mapRpcError(error);
    const row = data as Record<string, unknown>;
    return { runId, status: row.status as AiChatStopRunResult["status"] };
  },

  async listRunEvents(context, runId, afterSequence) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_run_events_v1", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_run_id: runId,
      p_after_sequence: afterSequence,
    });
    if (error) mapRpcError(error);
    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      runId: String(row.run_id),
      conversationId: String(row.conversation_id),
      sequenceNumber: Number(row.sequence_number),
      eventType: String(row.event_type),
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    }));
  },

  async getRunById(tenantId, runId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", runId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      conversationId: String(data.conversation_id),
      createdByUserId: String(data.created_by_user_id),
      triggerMessageVersionId: String(data.trigger_message_version_id),
      status: data.status,
      answerability: data.answerability,
      riskLevel: data.risk_level,
      safetyOutcome: data.safety_outcome,
      cancelRequestedAt: data.cancel_requested_at,
      errorCode: data.error_code,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  },

  async getMessageVersionById(tenantId, versionId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_message_versions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", versionId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      conversationId: String(data.conversation_id),
      messageId: String(data.message_id),
      branchId: String(data.branch_id),
      createdByUserId: String(data.created_by_user_id),
      body: String(data.body),
      bodySha256: String(data.body_sha256),
      parentVersionId: data.parent_version_id,
      supersedesVersionId: data.supersedes_version_id,
      runId: data.run_id,
      contentStatus: data.content_status,
      createdAt: String(data.created_at),
    };
  },

  async getBranchMessageChain(tenantId, branchId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_get_branch_chain_v1", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
    });
    if (error) mapRpcError(error);
    return (data as Array<Record<string, unknown>>).map((row) => ({
      messageId: String(row.message_id),
      role: row.role as "user" | "assistant",
      activeBody: String(row.body),
      versionId: String(row.version_id),
    }));
  },

  async claimNextAiChatJob(workerId, leaseMs) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_claim_ai_chat_job_v1", {
      p_worker_id: workerId,
      p_lease_ms: leaseMs,
    });
    if (error) mapRpcError(error);
    const row = (data as Record<string, unknown>[])?.[0];
    if (!row) return null;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      jobType: row.job_type as AiChatJobRecord["jobType"],
      runId: (row.run_id as string | null) ?? null,
      conversationId: String(row.conversation_id),
      createdByUserId: String(row.created_by_user_id),
      status: row.status as AiChatJobRecord["status"],
      payload: (row.payload as Record<string, unknown>) ?? {},
      leaseOwner: (row.lease_owner as string | null) ?? null,
      leaseToken: (row.lease_token as string | null) ?? null,
      leaseExpiresAt: (row.lease_expires_at as string | null) ?? null,
      heartbeatAt: (row.heartbeat_at as string | null) ?? null,
      retryCount: Number(row.retry_count ?? 0),
      nextAttemptAt: String(row.next_attempt_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  },

  async completeAiChatJob(jobId, workerId, leaseToken) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_complete_ai_chat_job_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
    });
  },

  async failAiChatJob(jobId, workerId, leaseToken, errorCode) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_fail_ai_chat_job_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_error_code: errorCode,
    });
  },

  async renewJobLease(jobId, workerId, leaseToken, leaseMs) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_renew_ai_chat_job_lease_v1", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_lease_ms: leaseMs,
    });
  },

  async shouldAbortRun(tenantId, runId) {
    const run = await supabaseAiChatStore.getRunById(tenantId, runId);
    if (!run) return true;
    return ["cancel_requested", "superseded", "stopped", "failed", "completed"].includes(run.status);
  },

  async updateRunStatus(tenantId, runId, status) {
    const supabase = requireSupabaseAdmin();
    await supabase
      .from("ai_chat_runs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", runId);
  },

  async appendRunEvent(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_append_run_event_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_event_type: input.eventType,
      p_payload: input.payload,
    });
    if (error) mapRpcError(error);
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      runId: String(row.run_id),
      conversationId: String(row.conversation_id),
      sequenceNumber: Number(row.sequence_number),
      eventType: String(row.event_type),
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    };
  },

  async finalizeRun(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_finalize_run_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_status: input.status,
      p_answerability: input.answerability ?? null,
      p_risk_level: input.riskLevel ?? null,
      p_error_code: input.errorCode ?? null,
    });
  },

  async commitAssistantMessage(tenantId, runId, input) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_commit_assistant_message_v1", {
      p_tenant_id: tenantId,
      p_run_id: runId,
      p_body: input.body,
      p_answerability: input.answerability,
      p_risk_level: input.riskLevel,
      p_completion_state: input.completionState ?? "complete",
    });
  },

  async enqueueTitleJob(tenantId, conversationId, userId) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_enqueue_title_job_v1", {
      p_tenant_id: tenantId,
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
  },

  async applyAutoTitleIfEligible(tenantId, conversationId, maxLength) {
    const supabase = requireSupabaseAdmin();
    await supabase.rpc("p85_stage_4c_apply_auto_title_v1", {
      p_tenant_id: tenantId,
      p_conversation_id: conversationId,
      p_max_length: maxLength,
    });
  },

  async getConversationRecord(tenantId, conversationId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_chat_conversations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", conversationId)
      .maybeSingle();
    if (error) mapRpcError(error);
    if (!data) return null;
    return {
      id: String(data.id),
      tenantId: String(data.tenant_id),
      createdByUserId: String(data.created_by_user_id),
      createdByDietitianId: String(data.created_by_dietitian_id),
      scopeType: data.scope_type as AiChatScopeType,
      clientId: (data.client_id as string | null) ?? null,
      title: String(data.title),
      titleSource: data.title_source as AiChatConversationRecord["titleSource"],
      status: data.status as AiChatConversationRecord["status"],
      activeBranchId: (data.active_branch_id as string | null) ?? null,
      revision: Number(data.revision),
      lastMessageAt: (data.last_message_at as string | null) ?? null,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  },

  async getContextGatewayAccess(input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_get_context_gateway_access_v1", {
      p_tenant_id: input.tenantId,
      p_user_id: input.userId,
      p_dietitian_id: input.dietitianId,
      p_role: input.role,
      p_scope_type: input.scopeType,
      p_client_id: input.clientId,
      p_conversation_revision: input.conversationRevision,
    });
    if (error) mapRpcError(error);
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      authorized: Boolean(row.authorized),
      clientId: (row.client_id as string | null) ?? null,
      revisionToken: String(row.revision_token ?? ""),
      checkedAt: String(row.checked_at ?? new Date().toISOString()),
    };
  },

  async listContextGatewayAccessibleClients(tenantId) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_list_context_gateway_clients_v1", {
      p_tenant_id: tenantId,
    });
    if (error) mapRpcError(error);
    return ((data as Array<Record<string, unknown>>) ?? []).map((row) =>
      toAccessibleClientIdentity({
        id: String(row.id),
        fullName: String(row.full_name),
      }),
    );
  },

  async executeContextGatewayTool(input) {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc("p85_stage_4c_execute_context_tool_v1", {
      p_tenant_id: input.tenantId,
      p_client_id: input.clientId,
      p_tool_name: input.tool,
      p_args: input.args,
    });
    if (error) mapRpcError(error);
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      tool: input.tool,
      ok: Boolean(row.ok),
      errorCode: (row.error_code as string | undefined) ?? undefined,
      rows: ((row.rows as Array<Record<string, unknown>>) ?? []).map((item) => ({
        sourceId: String(item.source_id),
        clientId: String(item.client_id),
        sourceType: item.source_type as ContextToolExecutionResult["rows"][number]["sourceType"],
        locator: (item.locator as string | null) ?? null,
        excerpt: String(item.excerpt ?? ""),
        contentHash: (item.content_hash as string | null) ?? null,
        sourceDate: (item.source_date as string | null) ?? null,
        updatedAt: (item.updated_at as string | null) ?? null,
        occurredAt: (item.occurred_at as string | null) ?? null,
        lifecycleStatus: item.lifecycle_status as ContextToolExecutionResult["rows"][number]["lifecycleStatus"],
        retrievalEligible: Boolean(item.retrieval_eligible),
        authorityWeight: Number(item.authority_weight ?? 1),
      })),
      categoryFailed: Boolean(row.category_failed),
      categoryCritical: Boolean(row.category_critical),
    };
  },

  async saveContextSnapshot(input) {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.rpc("p85_stage_4c_save_context_snapshot_v1", {
      p_tenant_id: input.tenantId,
      p_run_id: input.runId,
      p_conversation_id: input.conversationId,
      p_created_by_user_id: input.createdByUserId,
      p_source_identity_refs: input.sourceIdentityRefs,
      p_freshness_metadata: input.freshnessMetadata,
      p_evidence_excerpts: input.evidenceExcerpts,
    });
    if (error) mapRpcError(error);
  },
};
