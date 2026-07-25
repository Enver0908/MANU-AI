import { randomUUID } from "node:crypto";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import {
  clientReferenceMatchesQuery,
  encodeClientReferenceCode,
  formatClientReferenceShort,
} from "./client-reference-code";
import type {
  AiChatBranchDto,
  AiChatClientSearchItem,
  AiChatConversationDetail,
  AiChatConversationListResponse,
  AiChatConversationSummary,
  AiChatAttachmentDto,
  AiChatClientRecordCategory,
  AiChatClientScopedExportSlice,
  AiChatDeleteConversationInput,
  AiChatDeleteConversationResult,
  AiChatDeleteMessageInput,
  AiChatDeleteMessageResult,
  AiChatJobRecord,
  AiChatMessageVersionRecord,
  AiChatMutationRunResult,
  AiChatRiskLevel,
  AiChatRunDto,
  AiChatRunEventDto,
  AiChatScopeType,
  AiChatSendMessageResult,
  AiChatStopRunResult,
  AiChatTitleSource,
} from "./phase-85-stage-4c-contracts";
import type { AiChatStore, BranchMessageChainItem } from "./phase-85-stage-4c-store";
import { isNonTerminalAiChatRunStatus } from "./phase-85-stage-4c-contracts";
import {
  acceptAttachmentDerivativeCorrectionInMemory,
  completeAttachmentUploadInMemory,
  createAttachmentUploadSessionInMemory,
  createEmptyAttachmentState,
  deleteAttachmentInMemory,
  enqueueAttachmentJobInMemory,
  getAttachmentRecordInMemory,
  listConversationAttachmentsInMemory,
  linkMessageAttachmentsInMemory,
  listMessageAttachmentDerivativesInMemory,
  mapAttachmentDto,
  putAttachmentObjectBytesInMemory,
  saveAttachmentDerivativeInMemory,
  transferAttachmentToClientRecordInMemory,
  type InMemoryAttachmentState,
} from "./phase-85-stage-4c-attachment-store";
import {
  applyInMemoryRunRiskPipeline,
  consumeInMemoryDraftTransfer,
  createInMemoryRunHandoff,
  createRiskBridgeStoreSlice,
  getInMemoryPendingComposerTransfer,
  getInMemoryRunRiskSummary,
  listInMemoryDraftDestinations,
  supersedeInMemoryConversationRisk,
  transferInMemoryRunDraft,
  type InMemoryRiskBridgeState,
} from "./phase-85-stage-4c-risk-store";
import { buildSourceRevisionDigest } from "./phase-85-stage-4c-risk-bridge";
import {
  buildAiChatClientScopedExportSlice,
  claimNextDeletionJobInMemory,
  createEmptyLifecycleState,
  enqueueAccountAiChatDeletionsInMemory,
  enqueueClientScopedAiChatDeletionsInMemory,
  processDeletionJobInMemory,
  requestDeleteConversationInMemory,
  requestDeleteMessageInMemory,
  runLifecycleRetentionSweepsInMemory,
  type InMemoryLifecycleState,
} from "./phase-85-stage-4c-lifecycle";
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
  wrapContextToolExecutionResult,
  type ClientGatewayFixture,
} from "./phase-85-stage-4c-context-fixtures";
import {
  createInMemoryApprovedSourceStateFromManifest,
  searchInMemoryApprovedSources,
  type AiChatRunSourceClaimDto,
  type AiChatRunSourcesResponse,
  type InMemoryApprovedSourceState,
} from "./phase-85-stage-4c-sources";
import type { AiChatContextTool, AiChatConversationRecord } from "./phase-85-stage-4c-contracts";

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
  approvedSources: InMemoryApprovedSourceState;
  persistedSourceRefs: Array<{
    id: string;
    tenantId: string;
    runId: string;
    conversationId: string;
    createdByUserId: string;
    sourceType: string;
    canonicalEntityId: string;
    locator: string | null;
    sourceDate: string | null;
    contentHash: string | null;
    claimId: string | null;
    clientId: string | null;
    excerpt: string;
    title: string | null;
    publisher: string | null;
    sourceUrl: string | null;
    createdAt: string;
  }>;
  answerEnvelopes: Array<{
    tenantId: string;
    runId: string;
    conversationId: string;
    createdByUserId: string;
    directAnswer: string;
    answerability: string;
    riskLevel: string | null;
    claims: AiChatRunSourceClaimDto[];
    createdAt: string;
  }>;
  attachmentState: InMemoryAttachmentState;
  riskBridgeState: InMemoryRiskBridgeState;
  lifecycleState: InMemoryLifecycleState;
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
  approvedSources: createInMemoryApprovedSourceStateFromManifest(),
  persistedSourceRefs: [],
  answerEnvelopes: [],
  attachmentState: createEmptyAttachmentState(),
  riskBridgeState: createRiskBridgeStoreSlice(),
  lifecycleState: createEmptyLifecycleState(),
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
    approvedSources: createInMemoryApprovedSourceStateFromManifest(),
    persistedSourceRefs: [],
    answerEnvelopes: [],
    attachmentState: createEmptyAttachmentState(),
    riskBridgeState: createRiskBridgeStoreSlice(),
    lifecycleState: createEmptyLifecycleState(),
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

export function buildInMemoryAiChatClientExportSlice(clientId: string) {
  if (!canUseInMemoryAiChatStore()) return null;
  return buildAiChatClientScopedExportSlice(inMemoryState, clientId);
}

export function readInMemoryAiChatLifecycleStateForTests() {
  return inMemoryState.lifecycleState;
}

export function readInMemoryAiChatStateForLifecycle() {
  return inMemoryState;
}

export async function triggerClientAiChatLifecycleDeletions(
  context: AppTenantContext,
  clientId: string,
  reason: "client_anonymization" | "client_removal",
) {
  const { isSupabaseStoreConfigured } = await import("./supabase-store");
  if (isSupabaseStoreConfigured()) {
    const { getSupabaseAdminClient } = await import("./supabase");
    const { supabaseEnqueueClientScopedDeletions } = await import("./phase-85-stage-4c-supabase-lifecycle");
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new AppRequestError(503, "ai_chat_store_unavailable");
    await supabaseEnqueueClientScopedDeletions(supabase, context, clientId, reason);
  }
  if (!canUseInMemoryAiChatStore()) return;
  enqueueClientScopedAiChatDeletionsInMemory(inMemoryState, context, clientId, reason);
}

export async function triggerAccountAiChatLifecycleDeletions(
  tenantId: string,
  userId: string,
  reason: "account_membership_removed" = "account_membership_removed",
) {
  const { isSupabaseStoreConfigured } = await import("./supabase-store");
  if (isSupabaseStoreConfigured()) {
    const { getSupabaseAdminClient } = await import("./supabase");
    const { supabaseEnqueueAccountScopedDeletions } = await import("./phase-85-stage-4c-supabase-lifecycle");
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new AppRequestError(503, "ai_chat_store_unavailable");
    await supabaseEnqueueAccountScopedDeletions(supabase, tenantId, userId, reason);
  }
  if (!canUseInMemoryAiChatStore()) return;
  enqueueAccountAiChatDeletionsInMemory(inMemoryState, tenantId, userId, reason);
}

export function readFallbackPendingAiChatDraftTransfer(tenantId: string, destinationConversationId: string) {
  if (!canUseInMemoryAiChatStore()) return null;
  return getInMemoryPendingComposerTransfer(
    inMemoryState.riskBridgeState,
    tenantId,
    destinationConversationId,
  );
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
  if (conversation.status === "deleting" || conversation.status === "deleted") {
    throw new AppRequestError(404, "ai_chat_not_found");
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


export const inMemoryAiChatStore: AiChatStore = {
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
      status: "active",
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
      .filter((item) => item.status !== "deleting" && item.status !== "deleted")
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

    if (!input.body.trim() && (!input.attachmentIds || input.attachmentIds.length === 0)) {
      throw new AppRequestError(400, "ai_chat_message_body_required");
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

    if (input.attachmentIds?.length) {
      linkMessageAttachmentsInMemory(inMemoryState.attachmentState, {
        tenantId: context.tenantId,
        conversationId: chatId,
        messageVersionId: versionId,
        attachmentIds: input.attachmentIds,
        userId: context.userId,
      });
    }

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
    conversation.preview = input.body.trim()
      ? input.body.slice(0, 120)
      : input.attachmentIds?.length
        ? "[attachments]"
        : "";
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
    supersedeInMemoryConversationRisk(inMemoryState.riskBridgeState, {
      tenantId: context.tenantId,
      conversationId: conversation.id,
    });
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
      status: "active",
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
      status: "active",
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

  async getRunActorContext(input) {
    const conversation = inMemoryState.conversations.find(
      (item) => item.tenantId === input.tenantId && item.createdByUserId === input.userId,
    );
    return {
      tenantId: input.tenantId,
      userId: input.userId,
      dietitianId: conversation?.createdByDietitianId ?? input.fallbackDietitianId,
      role: "dietitian",
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
    if (input.tool === "search_approved_sources") {
      return executeInMemoryContextTool(
        getInMemoryClientGatewayFixture(input.clientId ?? "general-scope", "General"),
        input.tool,
        input.args,
        { approvedSources: inMemoryState.approvedSources },
      );
    }
    const client = inMemoryState.clients.find(
      (item) => item.tenantId === input.tenantId && item.id === input.clientId,
    );
    if (!input.clientId || !client) {
      return wrapContextToolExecutionResult(input.tool, [], {
        status: "failed",
        errorCode: "context_tool_client_required",
        categoryFailed: true,
      });
    }
    const fixture = getInMemoryClientGatewayFixture(
      input.clientId,
      client.fullName,
    );
    return executeInMemoryContextTool(fixture, input.tool, input.args, {
      ...input.options,
      approvedSources: inMemoryState.approvedSources,
    });
  },

  async searchApprovedClinicalSources(tenantId, query, limit = 5) {
    void tenantId;
    return searchInMemoryApprovedSources(inMemoryState.approvedSources, query, limit);
  },

  async persistRunAnswerArtifacts(tenantId, runId, input) {
    const now = new Date().toISOString();
    inMemoryState.answerEnvelopes.push({
      tenantId,
      runId,
      conversationId: input.conversationId,
      createdByUserId: input.createdByUserId,
      directAnswer: input.directAnswer,
      answerability: input.answerability ?? "answerable",
      riskLevel: input.riskLevel,
      claims: input.claims,
      createdAt: now,
    });
    for (const sourceRef of input.sourceRefs) {
      const approved = inMemoryState.approvedSources.chunks.find((item) => item.id === sourceRef.sourceRefId);
      const approvedSource = approved
        ? inMemoryState.approvedSources.sources.find((item) => item.id === approved.approvedSourceId)
        : null;
      inMemoryState.persistedSourceRefs.push({
        id: sourceRef.sourceRefId,
        tenantId,
        runId,
        conversationId: input.conversationId,
        createdByUserId: input.createdByUserId,
        sourceType: sourceRef.sourceType,
        canonicalEntityId: sourceRef.canonicalEntityId,
        locator: sourceRef.locator,
        sourceDate: sourceRef.sourceDate,
        contentHash: sourceRef.contentHash,
        claimId: sourceRef.claimId ?? null,
        clientId: input.clientId,
        excerpt: sourceRef.excerpt,
        title: approvedSource?.title ?? null,
        publisher: approvedSource?.publisher ?? null,
        sourceUrl: approvedSource?.sourceUrl ?? null,
        createdAt: now,
      });
    }
  },

  async listRunSources(tenantId, runId, userId) {
    const run = inMemoryState.runs.find(
      (item) => item.tenantId === tenantId && item.id === runId && item.createdByUserId === userId,
    );
    if (!run) {
      throw new AppRequestError(404, "ai_chat_run_not_found");
    }
    const envelope = [...inMemoryState.answerEnvelopes]
      .reverse()
      .find((item) => item.tenantId === tenantId && item.runId === runId);
    const sources = inMemoryState.persistedSourceRefs
      .filter((item) => item.tenantId === tenantId && item.runId === runId)
      .map((item) => ({
        sourceRefId: item.id,
        sourceType: item.sourceType,
        title: item.title ?? item.canonicalEntityId,
        publisher: item.publisher,
        sourceUrl: item.sourceUrl,
        locator: item.locator,
        sourceDate: item.sourceDate,
        excerpt: item.excerpt,
        dateLabel: item.sourceDate ? null : "date_unknown",
      }));
    return {
      runId,
      claims: envelope?.claims ?? [],
      sources,
    };
  },

  async createAttachmentUploadSession(context, input) {
    const conversation = inMemoryState.conversations.find(
      (item) => item.id === input.conversationId && item.tenantId === context.tenantId && item.createdByUserId === context.userId,
    );
    if (!conversation) throw new AppRequestError(404, "ai_chat_conversation_not_found");
    const existing = inMemoryState.attachmentState.attachments
      .filter((item) => item.conversationId === input.conversationId && item.status !== "deleted")
      .map((item) => ({ kind: item.kind, byteSize: item.byteSize, pageCount: item.pageCount ?? undefined, durationSec: item.durationSec ?? undefined }));
    return createAttachmentUploadSessionInMemory(inMemoryState.attachmentState, context, {
      conversationId: input.conversationId,
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      contentSha256: input.contentSha256,
      existing,
    });
  },

  async completeAttachmentUpload(context, attachmentId, input) {
    const attachment = completeAttachmentUploadInMemory(inMemoryState.attachmentState, context, attachmentId, input);
    const record = getAttachmentRecordInMemory(inMemoryState.attachmentState, attachmentId);
    if (record) {
      enqueueAttachmentJobInMemory(inMemoryState.jobs, {
        tenantId: record.tenantId,
        conversationId: record.conversationId,
        createdByUserId: record.createdByUserId,
        jobType: "attachment_scan",
        attachmentId: record.id,
      });
    }
    return attachment;
  },

  async putAttachmentObjectBytes(context, attachmentId, uploadToken, bytes) {
    putAttachmentObjectBytesInMemory(inMemoryState.attachmentState, attachmentId, uploadToken, bytes);
  },

  async listConversationAttachments(context, conversationId) {
    return listConversationAttachmentsInMemory(inMemoryState.attachmentState, context.tenantId, conversationId, context.userId);
  },

  async getAttachmentById(context, attachmentId) {
    const record = getAttachmentRecordInMemory(inMemoryState.attachmentState, attachmentId);
    if (!record || record.tenantId !== context.tenantId || record.createdByUserId !== context.userId) {
      throw new AppRequestError(404, "ai_chat_attachment_not_found");
    }
    return mapAttachmentDto(record, inMemoryState.attachmentState.derivatives);
  },

  async getAttachmentRecordById(attachmentId) {
    const record = getAttachmentRecordInMemory(inMemoryState.attachmentState, attachmentId);
    if (!record) return null;
    return {
      id: record.id,
      tenantId: record.tenantId,
      conversationId: record.conversationId,
      createdByUserId: record.createdByUserId,
      scopeType: record.scopeType,
      clientId: record.clientId,
      kind: record.kind,
      mimeType: record.mimeType,
      fileName: record.fileName,
      byteSize: record.byteSize,
      contentSha256: record.contentSha256,
      objectKey: record.objectKey,
      status: record.status,
      pageCount: record.pageCount,
      durationSec: record.durationSec,
    };
  },

  async deleteAttachment(context, attachmentId) {
    deleteAttachmentInMemory(inMemoryState.attachmentState, context, attachmentId);
    const record = getAttachmentRecordInMemory(inMemoryState.attachmentState, attachmentId);
    if (record) {
      enqueueAttachmentJobInMemory(inMemoryState.jobs, {
        tenantId: record.tenantId,
        conversationId: record.conversationId,
        createdByUserId: record.createdByUserId,
        jobType: "attachment_cleanup",
        attachmentId: record.id,
      });
    }
  },

  async updateAttachmentStatus(attachmentId, status, failureCode = null, meta) {
    const record = getAttachmentRecordInMemory(inMemoryState.attachmentState, attachmentId);
    if (!record) return;
    record.status = status;
    record.failureCode = failureCode;
    if (meta?.pageCount !== undefined) record.pageCount = meta.pageCount;
    if (meta?.durationSec !== undefined) record.durationSec = meta.durationSec;
    record.updatedAt = new Date().toISOString();
  },

  async saveAttachmentDerivative(input) {
    saveAttachmentDerivativeInMemory(inMemoryState.attachmentState, input);
  },

  async acceptAttachmentDerivativeCorrection(context, attachmentId, derivativeId, input) {
    return acceptAttachmentDerivativeCorrectionInMemory(
      inMemoryState.attachmentState,
      context,
      attachmentId,
      derivativeId,
      input,
    );
  },

  async transferAttachmentToClientRecord(context, attachmentId, input) {
    return transferAttachmentToClientRecordInMemory(inMemoryState.attachmentState, context, attachmentId, input);
  },

  async enqueueAttachmentScanJob(tenantId, conversationId, attachmentId, userId) {
    enqueueAttachmentJobInMemory(inMemoryState.jobs, {
      tenantId,
      conversationId,
      createdByUserId: userId,
      jobType: "attachment_scan",
      attachmentId,
    });
  },

  async enqueueAttachmentParseJob(tenantId, conversationId, attachmentId, userId) {
    enqueueAttachmentJobInMemory(inMemoryState.jobs, {
      tenantId,
      conversationId,
      createdByUserId: userId,
      jobType: "attachment_parse",
      attachmentId,
    });
  },

  async enqueueAttachmentCleanupJob(tenantId, conversationId, attachmentId, userId = "system") {
    enqueueAttachmentJobInMemory(inMemoryState.jobs, {
      tenantId,
      conversationId,
      createdByUserId: userId,
      jobType: "attachment_cleanup",
      attachmentId,
    });
  },

  async getAttachmentObjectBytes(objectKey) {
    return inMemoryState.attachmentState.objects.get(objectKey) ?? null;
  },

  async listMessageAttachmentDerivatives(tenantId, messageVersionId) {
    return listMessageAttachmentDerivativesInMemory(
      inMemoryState.attachmentState,
      tenantId,
      messageVersionId,
    );
  },

  async getRunRiskSummary(tenantId, runId, userId) {
    const run = inMemoryState.runs.find(
      (item) => item.tenantId === tenantId && item.id === runId && item.createdByUserId === userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    return getInMemoryRunRiskSummary(inMemoryState.riskBridgeState, tenantId, runId);
  },

  async listRunDraftDestinations(context, runId) {
    const run = inMemoryState.runs.find(
      (item) => item.tenantId === context.tenantId && item.id === runId && item.createdByUserId === context.userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    const conversation = inMemoryState.conversations.find((item) => item.id === run.conversationId);
    if (!conversation?.clientId) throw new AppRequestError(409, "ai_chat_destination_conversation_missing");
    return listInMemoryDraftDestinations(context.tenantId, conversation.clientId);
  },

  async transferRunDraft(context, runId, input) {
    const run = inMemoryState.runs.find(
      (item) => item.tenantId === context.tenantId && item.id === runId && item.createdByUserId === context.userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    const conversation = inMemoryState.conversations.find((item) => item.id === run.conversationId);
    if (!conversation) throw new AppRequestError(404, "ai_chat_conversation_not_found");
    return transferInMemoryRunDraft(inMemoryState.riskBridgeState, context, {
      runId,
      sourceConversationId: input.sourceConversationId,
      destinationConversationId: input.destinationConversationId,
      destinationRevision: input.destinationRevision,
      clientContextRevision: input.clientContextRevision,
      scopeType: conversation.scopeType,
    });
  },

  async createRunHandoff(context, runId, input) {
    const run = inMemoryState.runs.find(
      (item) => item.tenantId === context.tenantId && item.id === runId && item.createdByUserId === context.userId,
    );
    if (!run) throw new AppRequestError(404, "ai_chat_run_not_found");
    const conversation = inMemoryState.conversations.find((item) => item.id === run.conversationId);
    if (!conversation) throw new AppRequestError(404, "ai_chat_conversation_not_found");
    const result = createInMemoryRunHandoff(inMemoryState.riskBridgeState, context, {
      runId,
      conversationId: input.conversationId,
      clientId: input.clientId,
      confirmationToken: input.confirmationToken,
      expectedClientContextRevision: input.expectedClientContextRevision,
      scopeType: conversation.scopeType,
    });
    return { handoffId: result.handoffId };
  },

  async getPendingComposerDraftTransfer(tenantId, destinationConversationId) {
    return getInMemoryPendingComposerTransfer(inMemoryState.riskBridgeState, tenantId, destinationConversationId);
  },

  async consumeComposerDraftTransfer(input) {
    consumeInMemoryDraftTransfer(inMemoryState.riskBridgeState, input);
  },

  async applyRunRiskPipeline(input) {
    const sourceRevisionDigest = buildSourceRevisionDigest({
      revisionToken: input.revisionToken ?? null,
      sourceRefIds: input.sourceRefIds,
    });
    const assessment = applyInMemoryRunRiskPipeline(inMemoryState.riskBridgeState, {
      ...input,
      sourceRevisionDigest,
    });
    const run = inMemoryState.runs.find((item) => item.tenantId === input.tenantId && item.id === input.runId);
    if (run) {
      run.riskLevel = assessment.riskLevel;
    }
    await inMemoryAiChatStore.appendRunEvent(input.tenantId, input.runId, {
      eventType: "risk.updated",
      payload: {
        riskLevel: assessment.riskLevel,
        reasons: assessment.reasons,
        confidenceClass: assessment.confidenceClass,
        hypotheticalRed: assessment.hypotheticalRed,
      },
    });
  },

  async deleteConversation(context, chatId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const result = requestDeleteConversationInMemory(
      inMemoryState,
      context,
      chatId,
      input,
      bodyHash,
      (requestId, hash) => readLedger(context, requestId, hash),
      (requestId, hash, digest) => writeLedger(context, requestId, hash, digest),
    );
    supersedeInMemoryConversationRisk(inMemoryState.riskBridgeState, {
      tenantId: context.tenantId,
      conversationId: chatId,
    });
    return result;
  },

  async deleteMessage(context, messageId, input) {
    const bodyHash = canonicalAiChatBodyHash(input);
    const message = inMemoryState.messages.find(
      (item) => item.tenantId === context.tenantId && item.id === messageId,
    );
    const result = requestDeleteMessageInMemory(
      inMemoryState,
      context,
      messageId,
      input,
      bodyHash,
      (requestId, hash) => readLedger(context, requestId, hash),
      (requestId, hash, digest) => writeLedger(context, requestId, hash, digest),
    );
    if (message) {
      supersedeInMemoryConversationRisk(inMemoryState.riskBridgeState, {
        tenantId: context.tenantId,
        conversationId: message.conversationId,
      });
    }
    return result;
  },

  async processLifecycleDeletionBatch(limit = 4) {
    let processed = 0;
    for (let index = 0; index < limit; index += 1) {
      const job = claimNextDeletionJobInMemory(inMemoryState.lifecycleState);
      if (!job) break;
      const result = processDeletionJobInMemory(inMemoryState, job.id);
      if (result.processed) processed += 1;
      if (result.completed) continue;
      if (!result.processed) break;
    }
    return processed;
  },

  async runLifecycleRetentionSweeps() {
    runLifecycleRetentionSweepsInMemory(inMemoryState);
  },

  async enqueueClientScopedDeletions(context, clientId, reason) {
    enqueueClientScopedAiChatDeletionsInMemory(inMemoryState, context, clientId, reason);
  },

  async enqueueAccountScopedDeletions(tenantId, userId, reason) {
    enqueueAccountAiChatDeletionsInMemory(inMemoryState, tenantId, userId, reason);
  },

  async buildClientScopedExportSlice(clientId) {
    return buildAiChatClientScopedExportSlice(inMemoryState, clientId);
  },

  async saveContextSnapshot(input) {
    inMemoryState.contextSnapshots.push({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });
  },
};
