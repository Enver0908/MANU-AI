import { createHmac, randomUUID } from "node:crypto";
import { AppRequestError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import {
  AI_CHAT_DEFAULT_CONVERSATION_TITLE,
  AI_CHAT_DELETION_DB_BATCH_SIZE,
  AI_CHAT_DELETION_MAX_ATTEMPTS,
  AI_CHAT_DELETION_STORAGE_BATCH_SIZE,
  AI_CHAT_ORPHAN_RETENTION_HOURS,
  AI_CHAT_SSE_RETENTION_HOURS,
  type AiChatClientScopedExportSlice,
  type AiChatDeleteConversationInput,
  type AiChatDeleteConversationResult,
  type AiChatDeleteMessageInput,
  type AiChatDeleteMessageResult,
  type AiChatDeletionJobRecord,
  type AiChatDeletionLedgerRecord,
  type AiChatScopeType,
  isNonTerminalAiChatRunStatus,
} from "./phase-85-stage-4c-contracts";
import type { InMemoryAttachmentState } from "./phase-85-stage-4c-attachment-store";
import type { InMemoryRiskBridgeState } from "./phase-85-stage-4c-risk-bridge";

export const PHASE_85_STAGE_4C_LIFECYCLE_VERSION = "p85-stage-4c-lifecycle-v1";

const EXPORT_LEAK_MARKERS = [
  "toolArguments",
  "providerManifest",
  "systemPrompt",
  "internalSecurityClass",
  "promptText",
  "rawPayload",
] as const;

export type InMemoryLifecycleState = {
  deletionJobs: AiChatDeletionJobRecord[];
  deletionLedger: AiChatDeletionLedgerRecord[];
  legalHoldClientIds: Set<string>;
  legalHoldTenantIds: Set<string>;
  operationalAlerts: Array<{
    id: string;
    tenantId: string;
    kind: string;
    entityId: string;
    message: string;
    createdAt: string;
  }>;
  privacyReviewEvents: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    reason: string;
    createdAt: string;
  }>;
  lifecycleAuditEvents: Array<{
    id: string;
    tenantId: string;
    eventType: string;
    entityType: string;
    entityIdHash: string;
    createdAt: string;
  }>;
};

export function createEmptyLifecycleState(): InMemoryLifecycleState {
  return {
    deletionJobs: [],
    deletionLedger: [],
    legalHoldClientIds: new Set(),
    legalHoldTenantIds: new Set(),
    operationalAlerts: [],
    privacyReviewEvents: [],
    lifecycleAuditEvents: [],
  };
}

export function hashDeletionEntityId(tenantId: string, entityType: string, entityId: string) {
  const secret = process.env.AI_CHAT_DELETION_HMAC_SECRET || "p85-stage-4c-lifecycle-test-secret";
  return createHmac("sha256", secret).update(`${tenantId}:${entityType}:${entityId}`).digest("hex");
}

type LifecycleStoreSlice = {
  conversations: Array<{
    id: string;
    tenantId: string;
    createdByUserId: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    title: string;
    titleSource: "auto" | "user";
    status: "active" | "locked" | "deleting" | "deleted";
    activeBranchId: string;
    revision: number;
    lastMessageAt: string | null;
    preview: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  branches: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    parentBranchId: string | null;
    activeLeafVersionId: string | null;
    status?: "active" | "deleted";
    updatedAt: string;
  }>;
  messages: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    role: "user" | "assistant";
    deletedAt: string | null;
    createdAt?: string;
    versions: Array<{ id: string; body: string; contentStatus: string; branchId: string; parentVersionId: string | null }>;
  }>;
  messageVersions: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    messageId: string;
    branchId: string;
    body: string;
    parentVersionId: string | null;
    runId: string | null;
    contentStatus: string;
  }>;
  runs: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    triggerMessageVersionId: string;
    status: string;
    updatedAt: string;
  }>;
  runEvents: Array<{ id: string; tenantId: string; runId: string; conversationId: string; expiresAt: string }>;
  jobs: Array<{ id: string; tenantId: string; conversationId: string; status: string }>;
  memorySummaries: Array<{ id: string; tenantId: string; conversationId: string }>;
  contextSnapshots: Array<{ id: string; tenantId: string; conversationId: string; runId: string }>;
  persistedSourceRefs: Array<{ id: string; tenantId: string; runId: string; conversationId: string }>;
  answerEnvelopes: Array<{ tenantId: string; runId: string; conversationId: string }>;
  attachmentState: InMemoryAttachmentState;
  riskBridgeState: InMemoryRiskBridgeState;
  lifecycleState: InMemoryLifecycleState;
  ledger: Array<{ tenantId: string; requestId: string; createdByUserId: string; bodyHash: string; responseDigest: string }>;
};

function nowIso() {
  return new Date().toISOString();
}

function assertNoLegalHold(
  lifecycleState: InMemoryLifecycleState,
  tenantId: string,
  clientId: string | null,
) {
  if (lifecycleState.legalHoldTenantIds.has(tenantId)) {
    throw new AppRequestError(423, "ai_chat_legal_hold");
  }
  if (clientId && lifecycleState.legalHoldClientIds.has(clientId)) {
    throw new AppRequestError(423, "ai_chat_legal_hold");
  }
}

function appendLifecycleAudit(
  lifecycleState: InMemoryLifecycleState,
  tenantId: string,
  eventType: string,
  entityType: string,
  entityId: string,
) {
  lifecycleState.lifecycleAuditEvents.push({
    id: randomUUID(),
    tenantId,
    eventType,
    entityType,
    entityIdHash: hashDeletionEntityId(tenantId, entityType, entityId),
    createdAt: nowIso(),
  });
}

function upsertDeletionLedger(
  lifecycleState: InMemoryLifecycleState,
  input: {
    tenantId: string;
    entityType: string;
    entityId: string;
    reason: string;
    requestedAt: string;
    completedAt?: string | null;
    replayStatus?: AiChatDeletionLedgerRecord["replayStatus"];
  },
) {
  const entityIdHash = hashDeletionEntityId(input.tenantId, input.entityType, input.entityId);
  const existing = lifecycleState.deletionLedger.find(
    (item) => item.tenantId === input.tenantId && item.entityType === input.entityType && item.entityIdHash === entityIdHash,
  );
  if (existing) {
    if (input.completedAt) existing.completedAt = input.completedAt;
    if (input.replayStatus) existing.replayStatus = input.replayStatus;
    existing.updatedAt = nowIso();
    return existing;
  }
  const record: AiChatDeletionLedgerRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityIdHash,
    reason: input.reason,
    requestedAt: input.requestedAt,
    completedAt: input.completedAt ?? null,
    replayStatus: input.replayStatus ?? "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  lifecycleState.deletionLedger.push(record);
  return record;
}

function findActiveConversationDeletionJob(
  lifecycleState: InMemoryLifecycleState,
  tenantId: string,
  conversationId: string,
) {
  return lifecycleState.deletionJobs.find(
    (item) =>
      item.tenantId === tenantId &&
      item.targetConversationId === conversationId &&
      (item.status === "queued" || item.status === "processing"),
  );
}

function enqueueDeletionJob(
  lifecycleState: InMemoryLifecycleState,
  input: Omit<AiChatDeletionJobRecord, "id" | "createdAt" | "updatedAt" | "status" | "attemptCount" | "cursor" | "completedAt"> & {
    cursor?: Record<string, unknown>;
  },
) {
  const job: AiChatDeletionJobRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    jobKind: input.jobKind,
    targetConversationId: input.targetConversationId,
    targetMessageId: input.targetMessageId,
    targetClientId: input.targetClientId,
    targetUserId: input.targetUserId,
    reason: input.reason,
    status: "queued",
    attemptCount: 0,
    cursor: input.cursor ?? {},
    requestedAt: input.requestedAt,
    completedAt: null,
    createdByUserId: input.createdByUserId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  lifecycleState.deletionJobs.push(job);
  return job;
}

function supersedeActiveRuns(state: LifecycleStoreSlice, tenantId: string, conversationId: string) {
  const now = nowIso();
  for (const run of state.runs) {
    if (
      run.tenantId === tenantId &&
      run.conversationId === conversationId &&
      isNonTerminalAiChatRunStatus(run.status as never)
    ) {
      run.status = "superseded";
      run.updatedAt = now;
    }
  }
}

function buildBranchChain(state: LifecycleStoreSlice, tenantId: string, branchId: string) {
  const branch = state.branches.find((item) => item.tenantId === tenantId && item.id === branchId);
  if (!branch?.activeLeafVersionId) return [];

  const chain: Array<{ messageId: string; versionId: string; role: "user" | "assistant"; parentVersionId: string | null }> = [];
  let currentVersionId: string | null = branch.activeLeafVersionId;
  const visited = new Set<string>();

  while (currentVersionId && !visited.has(currentVersionId)) {
    visited.add(currentVersionId);
    const versionRecord = state.messageVersions.find((item) => item.tenantId === tenantId && item.id === currentVersionId);
    const embeddedVersion = state.messages
      .flatMap((message) => message.versions.map((entry) => ({ ...entry, messageId: message.id })))
      .find((item) => item.id === currentVersionId);
    const version = versionRecord ?? embeddedVersion;
    if (!version) break;
    const message = state.messages.find(
      (item) => item.tenantId === tenantId && item.id === (versionRecord?.messageId ?? embeddedVersion?.messageId),
    );
    if (!message) break;
    chain.unshift({
      messageId: message.id,
      versionId: version.id,
      role: message.role,
      parentVersionId: version.parentVersionId,
    });
    currentVersionId = version.parentVersionId;
  }
  return chain;
}

function collectConversationStorageObjectKeys(state: LifecycleStoreSlice, tenantId: string, conversationId: string) {
  const keys = new Set<string>();
  for (const attachment of state.attachmentState.attachments) {
    if (attachment.tenantId === tenantId && attachment.conversationId === conversationId && attachment.objectKey) {
      keys.add(attachment.objectKey);
    }
  }
  return [...keys];
}

function collectMessageStorageObjectKeys(
  state: LifecycleStoreSlice,
  tenantId: string,
  conversationId: string,
  messageIds: Set<string>,
) {
  const keys = new Set<string>();
  for (const attachment of state.attachmentState.attachments) {
    if (
      attachment.tenantId === tenantId &&
      attachment.conversationId === conversationId &&
      messageIds.has(attachment.id) === false
    ) {
      const linkedMessage = state.messages.find((item) => item.id === attachment.id);
      void linkedMessage;
    }
    if (attachment.tenantId === tenantId && attachment.conversationId === conversationId) {
      keys.add(attachment.objectKey);
    }
  }
  return [...keys];
}

function purgeStorageObjects(state: LifecycleStoreSlice, objectKeys: string[]) {
  for (const key of objectKeys) {
    state.attachmentState.objects.delete(key);
  }
}

function removeRowsByIds<T extends { id: string }>(rows: T[], ids: Set<string>) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (ids.has(rows[index]!.id)) {
      rows.splice(index, 1);
    }
  }
}

function purgeConversationBatch(state: LifecycleStoreSlice, tenantId: string, conversationId: string, cursor: Record<string, unknown>) {
  const phase = typeof cursor.phase === "string" ? cursor.phase : "storage";
  if (phase === "storage") {
    const objectKeys = collectConversationStorageObjectKeys(state, tenantId, conversationId);
    const start = Number(cursor.storageOffset ?? 0);
    const batch = objectKeys.slice(start, start + AI_CHAT_DELETION_STORAGE_BATCH_SIZE);
    purgeStorageObjects(state, batch);
    if (start + batch.length < objectKeys.length) {
      return { done: false, cursor: { phase: "storage", storageOffset: start + batch.length } };
    }
    return { done: false, cursor: { phase: "db", dbOffset: 0 } };
  }

  const dbOffset = Number(cursor.dbOffset ?? 0);
  const runIds = state.runs.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).map((item) => item.id);
  const versionIds = state.messageVersions
    .filter((item) => item.tenantId === tenantId && item.conversationId === conversationId)
    .map((item) => item.id);
  const messageIds = state.messages
    .filter((item) => item.tenantId === tenantId && item.conversationId === conversationId)
    .map((item) => item.id);
  const branchIds = state.branches
    .filter((item) => item.tenantId === tenantId && item.conversationId === conversationId)
    .map((item) => item.id);

  const orderedIds = [
    ...state.runEvents.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).map((item) => item.id),
    ...state.contextSnapshots.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).map((item) => item.id),
    ...state.persistedSourceRefs.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).map((item) => item.id),
    ...state.answerEnvelopes.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).map((item) => item.runId),
    ...runIds,
    ...versionIds,
    ...messageIds,
    ...branchIds,
    conversationId,
  ];

  const batch = orderedIds.slice(dbOffset, dbOffset + AI_CHAT_DELETION_DB_BATCH_SIZE);
  const batchSet = new Set(batch);

  state.runEvents = state.runEvents.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.contextSnapshots = state.contextSnapshots.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.persistedSourceRefs = state.persistedSourceRefs.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.answerEnvelopes = state.answerEnvelopes.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.runId)),
  );
  state.runs = state.runs.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.messageVersions = state.messageVersions.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.messages = state.messages.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.branches = state.branches.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.memorySummaries = state.memorySummaries.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)),
  );
  state.jobs = state.jobs.filter((item) => !(item.tenantId === tenantId && item.conversationId === conversationId && batchSet.has(item.id)));
  state.attachmentState.attachments = state.attachmentState.attachments.filter(
    (item) => !(item.tenantId === tenantId && item.conversationId === conversationId),
  );
  state.attachmentState.derivatives = state.attachmentState.derivatives.filter((derivative) => {
    const attachment = state.attachmentState.attachments.find((item) => item.id === derivative.attachmentId);
    return Boolean(attachment);
  });

  const conversation = state.conversations.find((item) => item.tenantId === tenantId && item.id === conversationId);
  if (conversation && batchSet.has(conversationId)) {
    conversation.status = "deleted";
    conversation.preview = null;
    conversation.updatedAt = nowIso();
    state.conversations = state.conversations.filter(
      (item) => !(item.tenantId === tenantId && item.id === conversationId),
    );
  }

  if (dbOffset + batch.length < orderedIds.length) {
    return { done: false, cursor: { phase: "db", dbOffset: dbOffset + batch.length } };
  }
  return { done: true, cursor: {} };
}

export function requestDeleteConversationInMemory(
  state: LifecycleStoreSlice,
  context: AppTenantContext,
  chatId: string,
  input: AiChatDeleteConversationInput,
  bodyHash: string,
  readLedger: (requestId: string, hash: string) => string | null,
  writeLedger: (requestId: string, hash: string, digest: string) => void,
): AiChatDeleteConversationResult {
  const existingDigest = readLedger(input.requestId, bodyHash);
  if (existingDigest) {
    const [jobId, revision] = existingDigest.split("|");
    return {
      chatId,
      deletionJobId: jobId,
      status: "deleting",
      conversationRevision: Number(revision),
    };
  }

  const conversation = state.conversations.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.id === chatId &&
      item.createdByUserId === context.userId,
  );
  if (!conversation) {
    throw new AppRequestError(404, "ai_chat_not_found");
  }
  if (conversation.status === "deleting" || conversation.status === "deleted") {
    const existingJob = findActiveConversationDeletionJob(state.lifecycleState, context.tenantId, chatId);
    if (!existingJob) {
      throw new AppRequestError(404, "ai_chat_not_found");
    }
    return {
      chatId,
      deletionJobId: existingJob.id,
      status: "deleting",
      conversationRevision: conversation.revision,
    };
  }
  if (conversation.revision !== input.expectedRevision) {
    throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
  }

  assertNoLegalHold(state.lifecycleState, context.tenantId, conversation.clientId);
  appendLifecycleAudit(state.lifecycleState, context.tenantId, "ai_chat_delete_requested", "conversation", chatId);

  const requestedAt = nowIso();
  upsertDeletionLedger(state.lifecycleState, {
    tenantId: context.tenantId,
    entityType: "conversation",
    entityId: chatId,
    reason: "user_delete",
    requestedAt,
  });

  supersedeActiveRuns(state, context.tenantId, chatId);

  conversation.status = "deleting";
  conversation.revision += 1;
  conversation.updatedAt = requestedAt;

  const job = enqueueDeletionJob(state.lifecycleState, {
    tenantId: context.tenantId,
    jobKind: "conversation_purge",
    targetConversationId: chatId,
    targetMessageId: null,
    targetClientId: conversation.clientId,
    targetUserId: context.userId,
    reason: "user_delete",
    requestedAt,
    createdByUserId: context.userId,
  });

  writeLedger(input.requestId, bodyHash, `${job.id}|${conversation.revision}`);
  return {
    chatId,
    deletionJobId: job.id,
    status: "deleting",
    conversationRevision: conversation.revision,
  };
}

function rewindActiveBranchAfterMessageDelete(
  state: LifecycleStoreSlice,
  tenantId: string,
  conversationId: string,
  deletedMessageId: string,
  deletedVersionId: string,
) {
  const conversation = state.conversations.find((item) => item.tenantId === tenantId && item.id === conversationId);
  if (!conversation) return;

  for (const branch of state.branches) {
    if (branch.tenantId !== tenantId || branch.conversationId !== conversationId) continue;
    const chain = buildBranchChain(state, tenantId, branch.id);
    if (chain.some((item) => item.messageId === deletedMessageId)) {
      branch.status = "deleted";
      branch.updatedAt = nowIso();
    }
  }

  const deletedVersion = state.messageVersions.find((item) => item.id === deletedVersionId);
  const parentVersionId = deletedVersion?.parentVersionId ?? null;
  if (!parentVersionId) {
    const rootBranch = state.branches.find(
      (item) => item.tenantId === tenantId && item.conversationId === conversationId && item.parentBranchId === null,
    );
    if (rootBranch) {
      rootBranch.activeLeafVersionId = null;
      rootBranch.status = "active";
      conversation.activeBranchId = rootBranch.id;
    }
    return;
  }

  const parentVersion = state.messageVersions.find((item) => item.id === parentVersionId);
  if (!parentVersion) return;
  const parentBranch = state.branches.find((item) => item.id === parentVersion.branchId);
  if (!parentBranch) return;
  parentBranch.activeLeafVersionId = parentVersion.id;
  parentBranch.status = "active";
  conversation.activeBranchId = parentBranch.id;
  for (const branch of state.branches) {
    if (branch.id === conversation.activeBranchId) {
      branch.status = "active";
    }
  }
}

export function requestDeleteMessageInMemory(
  state: LifecycleStoreSlice,
  context: AppTenantContext,
  messageId: string,
  input: AiChatDeleteMessageInput,
  bodyHash: string,
  readLedger: (requestId: string, hash: string) => string | null,
  writeLedger: (requestId: string, hash: string, digest: string) => void,
): AiChatDeleteMessageResult {
  const existingDigest = readLedger(input.requestId, bodyHash);
  if (existingDigest) {
    const [jobId, conversationId, revision] = existingDigest.split("|");
    return {
      messageId,
      deletionJobId: jobId,
      conversationId,
      conversationRevision: Number(revision),
    };
  }

  const message = state.messages.find((item) => item.tenantId === context.tenantId && item.id === messageId);
  if (!message) {
    throw new AppRequestError(404, "ai_chat_message_not_found");
  }
  if (message.role !== "user") {
    throw new AppRequestError(409, "ai_chat_assistant_delete_forbidden");
  }

  const conversation = state.conversations.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.id === message.conversationId &&
      item.createdByUserId === context.userId,
  );
  if (!conversation || conversation.status === "deleting" || conversation.status === "deleted") {
    throw new AppRequestError(404, "ai_chat_not_found");
  }
  if (conversation.revision !== input.expectedRevision) {
    throw new AppRequestError(409, "ai_chat_revision_conflict", undefined, conversation.revision);
  }

  const chain = buildBranchChain(state, context.tenantId, conversation.activeBranchId);
  const latestUser = [...chain].reverse().find((item) => item.role === "user");
  if (!latestUser || latestUser.messageId !== messageId) {
    throw new AppRequestError(409, "ai_chat_message_not_latest_user");
  }

  assertNoLegalHold(state.lifecycleState, context.tenantId, conversation.clientId);

  const existingMessageJob = state.lifecycleState.deletionJobs.find(
    (item) =>
      item.tenantId === context.tenantId &&
      item.targetMessageId === messageId &&
      (item.status === "queued" || item.status === "processing"),
  );
  if (existingMessageJob) {
    return {
      messageId,
      deletionJobId: existingMessageJob.id,
      conversationId: conversation.id,
      conversationRevision: conversation.revision,
    };
  }

  const requestedAt = nowIso();
  appendLifecycleAudit(state.lifecycleState, context.tenantId, "ai_chat_message_delete_requested", "message", messageId);
  upsertDeletionLedger(state.lifecycleState, {
    tenantId: context.tenantId,
    entityType: "message",
    entityId: messageId,
    reason: "user_delete",
    requestedAt,
  });

  supersedeActiveRuns(state, context.tenantId, conversation.id);

  const suffixMessageIds = new Set<string>();
  let collecting = false;
  for (const item of [...chain].reverse()) {
    if (item.messageId === messageId) collecting = true;
    if (collecting) suffixMessageIds.add(item.messageId);
  }

  const now = nowIso();
  for (const targetMessageId of suffixMessageIds) {
    const targetMessage = state.messages.find((item) => item.id === targetMessageId);
    if (!targetMessage) continue;
    targetMessage.deletedAt = now;
    for (const version of state.messageVersions.filter((item) => item.messageId === targetMessageId)) {
      version.contentStatus = "deleting";
      version.body = "";
    }
    for (const version of targetMessage.versions) {
      version.contentStatus = "deleting";
      version.body = "";
    }
  }

  rewindActiveBranchAfterMessageDelete(state, context.tenantId, conversation.id, messageId, latestUser.versionId);

  const remainingChain = buildBranchChain(state, context.tenantId, conversation.activeBranchId);
  if (remainingChain.length === 0 && conversation.titleSource === "auto") {
    conversation.title = AI_CHAT_DEFAULT_CONVERSATION_TITLE;
  } else {
    const last = remainingChain.at(-1);
    conversation.preview = last ? state.messageVersions.find((item) => item.id === last.versionId)?.body?.slice(0, 120) ?? null : null;
  }
  conversation.lastMessageAt = remainingChain.length > 0 ? now : null;
  conversation.revision += 1;
  conversation.updatedAt = now;

  const job = enqueueDeletionJob(state.lifecycleState, {
    tenantId: context.tenantId,
    jobKind: "message_purge",
    targetConversationId: conversation.id,
    targetMessageId: messageId,
    targetClientId: conversation.clientId,
    targetUserId: context.userId,
    reason: "user_delete",
    requestedAt,
    createdByUserId: context.userId,
    cursor: { suffixMessageIds: [...suffixMessageIds] },
  });

  writeLedger(input.requestId, bodyHash, `${job.id}|${conversation.id}|${conversation.revision}`);
  return {
    messageId,
    deletionJobId: job.id,
    conversationId: conversation.id,
    conversationRevision: conversation.revision,
  };
}

export function processDeletionJobInMemory(
  state: LifecycleStoreSlice,
  jobId: string,
  purgeObject: (objectKey: string) => Promise<void> | void = (key) => {
    state.attachmentState.objects.delete(key);
  },
) {
  const job = state.lifecycleState.deletionJobs.find((item) => item.id === jobId);
  if (!job || job.status === "completed" || job.status === "blocked_legal_hold") {
    return { processed: false };
  }

  if (job.jobKind === "client_chats_purge" && job.targetClientId) {
    assertNoLegalHold(state.lifecycleState, job.tenantId, job.targetClientId);
    const conversations = state.conversations.filter(
      (item) =>
        item.tenantId === job.tenantId &&
        item.scopeType === "client" &&
        item.clientId === job.targetClientId &&
        item.status !== "deleted",
    );
    for (const conversation of conversations) {
      if (conversation.status !== "deleting") {
        conversation.status = "deleting";
        enqueueDeletionJob(state.lifecycleState, {
          tenantId: job.tenantId,
          jobKind: "conversation_purge",
          targetConversationId: conversation.id,
          targetMessageId: null,
          targetClientId: job.targetClientId,
          targetUserId: job.createdByUserId,
          reason: job.reason,
          requestedAt: nowIso(),
          createdByUserId: job.createdByUserId,
        });
      }
    }
    for (const asset of [...state.attachmentState.clientRecordAssets]) {
      if (asset.tenantId === job.tenantId && asset.clientId === job.targetClientId) {
        state.attachmentState.objects.delete(asset.objectKey);
        removeRowsByIds(state.attachmentState.clientRecordAssets, new Set([asset.id]));
      }
    }
    job.status = "completed";
    job.completedAt = nowIso();
    job.updatedAt = job.completedAt;
    return { processed: true, completed: true };
  }

  if (job.jobKind === "account_chats_purge" && job.targetUserId) {
    const conversations = state.conversations.filter(
      (item) => item.tenantId === job.tenantId && item.createdByUserId === job.targetUserId && item.status !== "deleted",
    );
    for (const conversation of conversations) {
      if (conversation.status !== "deleting") {
        conversation.status = "deleting";
        enqueueDeletionJob(state.lifecycleState, {
          tenantId: job.tenantId,
          jobKind: "conversation_purge",
          targetConversationId: conversation.id,
          targetMessageId: null,
          targetClientId: conversation.clientId,
          targetUserId: job.targetUserId,
          reason: job.reason,
          requestedAt: nowIso(),
          createdByUserId: job.createdByUserId,
        });
      }
    }
    job.status = "completed";
    job.completedAt = nowIso();
    job.updatedAt = job.completedAt;
    return { processed: true, completed: true };
  }

  if (job.jobKind === "conversation_purge" && job.targetConversationId) {
    const conversation = state.conversations.find(
      (item) => item.tenantId === job.tenantId && item.id === job.targetConversationId,
    );
    if (conversation) {
      try {
        assertNoLegalHold(state.lifecycleState, job.tenantId, conversation.clientId);
      } catch {
        job.status = "blocked_legal_hold";
        job.updatedAt = nowIso();
        appendLifecycleAudit(state.lifecycleState, job.tenantId, "ai_chat_delete_blocked_legal_hold", "conversation", conversation.id);
        return { processed: true, completed: false, blocked: true };
      }
    }

    job.status = "processing";
    job.attemptCount += 1;
    job.updatedAt = nowIso();
    try {
      const objectKeys = collectConversationStorageObjectKeys(state, job.tenantId, job.targetConversationId);
      const storageOffset = Number(job.cursor.storageOffset ?? 0);
      const storageBatch = objectKeys.slice(storageOffset, storageOffset + AI_CHAT_DELETION_STORAGE_BATCH_SIZE);
      for (const key of storageBatch) {
        void purgeObject(key);
        state.attachmentState.objects.delete(key);
      }
      if (storageOffset + storageBatch.length < objectKeys.length) {
        job.cursor = { ...job.cursor, phase: "storage", storageOffset: storageOffset + storageBatch.length };
        job.status = "queued";
        job.updatedAt = nowIso();
        return { processed: true, completed: false };
      }

      const dbCursor =
        job.cursor.phase === "db"
          ? job.cursor
          : { phase: "db", dbOffset: Number(job.cursor.dbOffset ?? 0) };
      const result = purgeConversationBatch(state, job.tenantId, job.targetConversationId, dbCursor);
      job.cursor = result.cursor;
      if (!result.done) {
        job.status = "queued";
        job.updatedAt = nowIso();
        return { processed: true, completed: false };
      }

      job.status = "completed";
      job.completedAt = nowIso();
      job.updatedAt = job.completedAt;
      upsertDeletionLedger(state.lifecycleState, {
        tenantId: job.tenantId,
        entityType: "conversation",
        entityId: job.targetConversationId,
        reason: job.reason,
        requestedAt: job.requestedAt,
        completedAt: job.completedAt,
        replayStatus: "applied",
      });
      appendLifecycleAudit(state.lifecycleState, job.tenantId, "ai_chat_delete_completed", "conversation", job.targetConversationId);
      return { processed: true, completed: true };
    } catch {
      if (job.attemptCount >= AI_CHAT_DELETION_MAX_ATTEMPTS) {
        job.status = "failed";
        state.lifecycleState.operationalAlerts.push({
          id: randomUUID(),
          tenantId: job.tenantId,
          kind: "ai_chat_deletion_failed",
          entityId: job.targetConversationId ?? job.id,
          message: "Deletion job exceeded retry budget; daily sweeper will retry.",
          createdAt: nowIso(),
        });
      } else {
        job.status = "queued";
      }
      job.updatedAt = nowIso();
      return { processed: true, completed: false, failed: true };
    }
  }

  if (job.jobKind === "message_purge" && job.targetConversationId && job.targetMessageId) {
    job.status = "processing";
    job.attemptCount += 1;
    job.updatedAt = nowIso();
    const suffixIds = new Set(
      Array.isArray(job.cursor.suffixMessageIds) ? job.cursor.suffixMessageIds.map(String) : [job.targetMessageId],
    );
    const versionIds = state.messageVersions
      .filter((item) => item.tenantId === job.tenantId && suffixIds.has(item.messageId))
      .map((item) => item.id);
    const runIds = state.runs
      .filter((item) => versionIds.includes(item.triggerMessageVersionId))
      .map((item) => item.id);

    const objectKeys = collectMessageStorageObjectKeys(state, job.tenantId, job.targetConversationId, suffixIds);
    for (const key of objectKeys) {
      void purgeObject(key);
      state.attachmentState.objects.delete(key);
    }

    state.runEvents = state.runEvents.filter((item) => !(item.tenantId === job.tenantId && runIds.includes(item.runId)));
    state.contextSnapshots = state.contextSnapshots.filter(
      (item) => !(item.tenantId === job.tenantId && runIds.includes(item.runId)),
    );
    state.persistedSourceRefs = state.persistedSourceRefs.filter(
      (item) => !(item.tenantId === job.tenantId && runIds.includes(item.runId)),
    );
    state.answerEnvelopes = state.answerEnvelopes.filter(
      (item) => !(item.tenantId === job.tenantId && runIds.includes(item.runId)),
    );
    state.runs = state.runs.filter((item) => !(item.tenantId === job.tenantId && runIds.includes(item.id)));
    state.messageVersions = state.messageVersions.filter(
      (item) => !(item.tenantId === job.tenantId && suffixIds.has(item.messageId)),
    );
    state.messages = state.messages.filter(
      (item) => !(item.tenantId === job.tenantId && suffixIds.has(item.id)),
    );
    state.attachmentState.attachments = state.attachmentState.attachments.filter(
      (item) => !(item.tenantId === job.tenantId && item.conversationId === job.targetConversationId && suffixIds.has(item.id)),
    );

    for (const version of state.messages.flatMap((message) => message.versions)) {
      if (suffixIds.has(version.id)) {
        version.contentStatus = "deleted";
        version.body = "";
      }
    }

    const conversation = state.conversations.find(
      (item) => item.tenantId === job.tenantId && item.id === job.targetConversationId,
    );
    if (conversation) {
      const branch = state.branches.find(
        (item) => item.tenantId === job.tenantId && item.id === conversation.activeBranchId,
      );
      const remainingVersions = state.messageVersions.filter(
        (item) => item.tenantId === job.tenantId && item.conversationId === job.targetConversationId,
      );
      if (branch) {
        const activeLeafStillExists = remainingVersions.some((item) => item.id === branch.activeLeafVersionId);
        if (!activeLeafStillExists) {
          branch.activeLeafVersionId = remainingVersions.at(-1)?.id ?? null;
        }
        branch.status = "active";
      }
    }

    job.status = "completed";
    job.completedAt = nowIso();
    job.updatedAt = job.completedAt;
    upsertDeletionLedger(state.lifecycleState, {
      tenantId: job.tenantId,
      entityType: "message",
      entityId: job.targetMessageId,
      reason: job.reason,
      requestedAt: job.requestedAt,
      completedAt: job.completedAt,
      replayStatus: "applied",
    });
    return { processed: true, completed: true };
  }

  return { processed: false };
}

export function claimNextDeletionJobInMemory(lifecycleState: InMemoryLifecycleState) {
  const job = lifecycleState.deletionJobs.find((item) => item.status === "queued" || item.status === "failed");
  return job ?? null;
}

export function runLifecycleRetentionSweepsInMemory(state: LifecycleStoreSlice, now = new Date()) {
  const nowMs = now.getTime();
  const sseCutoff = nowMs - AI_CHAT_SSE_RETENTION_HOURS * 60 * 60 * 1000;
  const orphanCutoff = nowMs - AI_CHAT_ORPHAN_RETENTION_HOURS * 60 * 60 * 1000;

  state.runEvents = state.runEvents.filter((event) => new Date(event.expiresAt).getTime() > sseCutoff);

  for (const [objectKey] of [...state.attachmentState.objects.entries()]) {
    const attachment = state.attachmentState.attachments.find((item) => item.objectKey === objectKey);
    if (!attachment) {
      if (objectKey.includes("orphan") || objectKey.includes("pending")) {
        state.attachmentState.objects.delete(objectKey);
      }
      continue;
    }
    if (
      (attachment.status === "upload_pending" || attachment.status === "uploaded") &&
      attachment.uploadExpiresAt &&
      new Date(attachment.uploadExpiresAt).getTime() < orphanCutoff
    ) {
      state.attachmentState.objects.delete(objectKey);
      attachment.status = "deleted";
    }
    if (
      (attachment.status === "rejected" || attachment.status === "quarantined") &&
      new Date(attachment.updatedAt).getTime() < orphanCutoff
    ) {
      const conversation = state.conversations.find((item) => item.id === attachment.conversationId);
      const blocked =
        (conversation?.clientId && state.lifecycleState.legalHoldClientIds.has(conversation.clientId)) ||
        state.lifecycleState.legalHoldTenantIds.has(attachment.tenantId);
      if (!blocked) {
        state.attachmentState.objects.delete(objectKey);
        attachment.status = "deleted";
      }
    }
  }

  for (const job of state.lifecycleState.deletionJobs) {
    if (job.status === "failed") {
      job.status = "queued";
      job.updatedAt = nowIso();
    }
  }
}

export function enqueueClientScopedAiChatDeletionsInMemory(
  state: LifecycleStoreSlice,
  context: AppTenantContext,
  clientId: string,
  reason: "client_anonymization" | "client_removal",
) {
  enqueueDeletionJob(state.lifecycleState, {
    tenantId: context.tenantId,
    jobKind: "client_chats_purge",
    targetConversationId: null,
    targetMessageId: null,
    targetClientId: clientId,
    targetUserId: null,
    reason,
    requestedAt: nowIso(),
    createdByUserId: context.userId,
  });
}

export function enqueueAccountAiChatDeletionsInMemory(
  state: LifecycleStoreSlice,
  tenantId: string,
  userId: string,
  reason: "account_membership_removed",
) {
  enqueueDeletionJob(state.lifecycleState, {
    tenantId,
    jobKind: "account_chats_purge",
    targetConversationId: null,
    targetMessageId: null,
    targetClientId: null,
    targetUserId: userId,
    reason,
    requestedAt: nowIso(),
    createdByUserId: userId,
  });
}

export function replayDeletionLedgerInMemory(state: LifecycleStoreSlice) {
  let reapplied = 0;
  for (const entry of state.lifecycleState.deletionLedger) {
    if (entry.replayStatus === "verified") continue;
    if (entry.entityType === "conversation") {
      const conversation = state.conversations.find((item) => item.tenantId === entry.tenantId);
      void conversation;
      reapplied += 1;
      entry.replayStatus = "verified";
      entry.updatedAt = nowIso();
    } else {
      entry.replayStatus = "verified";
      entry.updatedAt = nowIso();
      reapplied += 1;
    }
  }
  for (const job of state.lifecycleState.deletionJobs) {
    if (job.status === "completed") continue;
    if (job.jobKind === "conversation_purge" && job.targetConversationId) {
      const conversation = state.conversations.find(
        (item) => item.tenantId === job.tenantId && item.id === job.targetConversationId,
      );
      if (conversation && conversation.status !== "deleted") {
        conversation.status = "deleting";
        job.status = "queued";
        reapplied += 1;
      }
    }
  }
  return { reapplied };
}

export function buildAiChatClientScopedExportSlice(state: LifecycleStoreSlice, clientId: string): AiChatClientScopedExportSlice {
  const conversations = state.conversations.filter(
    (item) => item.scopeType === "client" && item.clientId === clientId && item.status === "active",
  );
  const conversationIds = new Set(conversations.map((item) => item.id));
  const messages = state.messages
    .filter((item) => conversationIds.has(item.conversationId) && !item.deletedAt)
    .map((item) => {
      const activeVersion =
        state.messageVersions.find((version) => version.messageId === item.id && version.contentStatus === "active") ??
        item.versions.find((version) => version.contentStatus === "active") ??
        state.messageVersions.find((version) => version.messageId === item.id) ??
        item.versions[0];
      return {
        id: item.id,
        conversationId: item.conversationId,
        role: item.role,
        body: activeVersion?.body ?? "",
        createdAt: item.createdAt ?? "",
      };
    })
    .filter((item) => item.role === "user" || item.role === "assistant");

  const sourceManifest = state.persistedSourceRefs
    .filter((item) => conversationIds.has(item.conversationId))
    .map((item) => ({
      sourceRefId: item.id,
      sourceType: "client_record" as const,
      locator: null,
      sourceDate: null,
    }));

  const clientRecordAssets = state.attachmentState.clientRecordAssets
    .filter((item) => item.clientId === clientId)
    .map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      sourceChatIdHash: item.sourceAttachmentId
        ? hashDeletionEntityId(state.conversations[0]?.tenantId ?? "", "attachment", item.sourceAttachmentId)
        : null,
      createdAt: item.createdAt,
    }));

  return {
    conversations: conversations.map((item) => ({
      id: item.id,
      title: item.title,
      scopeType: item.scopeType,
      clientId: item.clientId,
      lastMessageAt: item.lastMessageAt,
      createdAt: item.createdAt ?? item.updatedAt,
    })),
    messages,
    sourceManifest,
    clientRecordAssets,
  };
}

export function assertAiChatClientExportHasNoLeaks(exportSlice: AiChatClientScopedExportSlice) {
  const serialized = JSON.stringify(exportSlice);
  for (const marker of EXPORT_LEAK_MARKERS) {
    if (serialized.includes(marker)) {
      throw new Error(`ai_chat_export_leak:${marker}`);
    }
  }
  const generalIncluded = exportSlice.conversations.some((item) => item.scopeType === "general");
  if (generalIncluded) {
    throw new Error("ai_chat_export_general_scope_leak");
  }
}

export function countRetainedAiChatRowsForConversation(state: LifecycleStoreSlice, tenantId: string, conversationId: string) {
  let count = 0;
  if (state.conversations.some((item) => item.tenantId === tenantId && item.id === conversationId && item.status !== "deleted")) {
    count += 1;
  }
  count += state.messages.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).length;
  count += state.messageVersions.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).length;
  count += state.runs.filter((item) => item.tenantId === tenantId && item.conversationId === conversationId).length;
  count += state.attachmentState.attachments.filter(
    (item) => item.tenantId === tenantId && item.conversationId === conversationId,
  ).length;
  count += collectConversationStorageObjectKeys(state, tenantId, conversationId).filter((key) =>
    state.attachmentState.objects.has(key),
  ).length;
  return count;
}

export function setAiChatLegalHoldForTests(
  lifecycleState: InMemoryLifecycleState,
  input: { tenantId?: string; clientId?: string; active: boolean },
) {
  if (input.tenantId) {
    if (input.active) lifecycleState.legalHoldTenantIds.add(input.tenantId);
    else lifecycleState.legalHoldTenantIds.delete(input.tenantId);
  }
  if (input.clientId) {
    if (input.active) lifecycleState.legalHoldClientIds.add(input.clientId);
    else lifecycleState.legalHoldClientIds.delete(input.clientId);
  }
}

export function recordGeneralChatPrivacyReviewIfNeeded(
  lifecycleState: InMemoryLifecycleState,
  tenantId: string,
  conversationId: string,
  detectedClientName: boolean,
) {
  if (!detectedClientName) return;
  lifecycleState.privacyReviewEvents.push({
    id: randomUUID(),
    tenantId,
    conversationId,
    reason: "possible_client_name_in_general_chat",
    createdAt: nowIso(),
  });
}
