import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import { isSupabaseStoreConfigured } from "./supabase-store";
import { inMemoryAiChatStore } from "./phase-85-stage-4c-in-memory-store";
import {
  assertSupabaseAiChatCoreContractReady,
  supabaseAiChatStore,
} from "./phase-85-stage-4c-supabase-store";
import type {
  AiChatAttachmentDto,
  AiChatBranchDto,
  AiChatClientRecordCategory,
  AiChatClientScopedExportSlice,
  AiChatClientSearchItem,
  AiChatConversationDetail,
  AiChatConversationListResponse,
  AiChatConversationSummary,
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
  AiChatConversationRecord,
  AiChatContextTool,
} from "./phase-85-stage-4c-contracts";
import type {
  AiChatEditMessageInput,
  AiChatRegenerateMessageInput,
  AiChatSendMessageInput,
  AiChatStopRunInput,
} from "./phase-85-stage-4c-run-service";
import type {
  AiChatActivateBranchInput,
  AiChatClientSearchQuery,
  AiChatCreateInput,
  AiChatListQuery,
  AiChatLoadQuery,
  AiChatRenameInput,
} from "./phase-85-stage-4c-service";
import type {
  AccessibleClientIdentity,
  AiChatContextSnapshotInput,
  ContextGatewayAccessState,
  ContextToolExecutionResult,
} from "./phase-85-stage-4c-context-gateway";
import type { AiChatRunSourceClaimDto, AiChatRunSourcesResponse } from "./phase-85-stage-4c-sources";

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
    clientId: string | null;
    tool: AiChatContextTool;
    args: Record<string, unknown>;
    options?: { failRisk?: boolean; delayMs?: number };
  }): Promise<ContextToolExecutionResult>;
  saveContextSnapshot(input: AiChatContextSnapshotInput): Promise<void>;
  searchApprovedClinicalSources(tenantId: string, query: string, limit?: number): Promise<
    Array<{
      sourceRefId: string;
      sourceType: "approved_clinical_source";
      canonicalEntityId: string;
      locator: string;
      excerpt: string;
      title: string;
      publisher: string;
      sourceUrl: string;
      sourceDate: string | null;
      contentHash: string;
    }>
  >;
  persistRunAnswerArtifacts(
    tenantId: string,
    runId: string,
    input: {
      conversationId: string;
      createdByUserId: string;
      clientId: string | null;
      directAnswer: string;
      answerability: AiChatRunDto["answerability"];
      riskLevel: AiChatRunDto["riskLevel"];
      claims: AiChatRunSourceClaimDto[];
      sourceRefs: Array<{
        sourceRefId: string;
        sourceType: string;
        canonicalEntityId: string;
        locator: string | null;
        sourceDate: string | null;
        contentHash: string | null;
        excerpt: string;
        claimId?: string | null;
      }>;
    },
  ): Promise<void>;
  listRunSources(tenantId: string, runId: string, userId: string): Promise<AiChatRunSourcesResponse>;
  createAttachmentUploadSession(
    context: AppTenantContext,
    input: {
      conversationId: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      contentSha256: string;
    },
  ): Promise<{
    attachment: AiChatAttachmentDto;
    uploadUrl: string;
    uploadToken: string;
    expiresAt: string;
    objectKey: string;
  }>;
  completeAttachmentUpload(
    context: AppTenantContext,
    attachmentId: string,
    input: { bytes: Buffer; contentSha256: string },
  ): Promise<AiChatAttachmentDto>;
  listConversationAttachments(context: AppTenantContext, conversationId: string): Promise<AiChatAttachmentDto[]>;
  getAttachmentById(context: AppTenantContext, attachmentId: string): Promise<AiChatAttachmentDto>;
  getAttachmentRecordById(attachmentId: string): Promise<{
    id: string;
    tenantId: string;
    conversationId: string;
    createdByUserId: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    kind: "image" | "document" | "audio";
    mimeType: string;
    fileName: string;
    byteSize: number;
    contentSha256: string;
    objectKey: string;
    status: AiChatAttachmentDto["status"];
    pageCount: number | null;
    durationSec: number | null;
  } | null>;
  deleteAttachment(context: AppTenantContext, attachmentId: string): Promise<void>;
  updateAttachmentStatus(
    attachmentId: string,
    status: AiChatAttachmentDto["status"],
    failureCode?: string | null,
    meta?: { pageCount?: number | null; durationSec?: number | null },
  ): Promise<void>;
  saveAttachmentDerivative(input: {
    attachmentId: string;
    kind: "sanitized_original" | "extracted_text" | "ocr_text" | "transcript" | "chunk";
    status: "pending" | "review_required" | "accepted" | "superseded" | "rejected";
    contentSha256: string | null;
    excerpt: string | null;
    locator: Record<string, unknown>;
    confidence: number | null;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  acceptAttachmentDerivativeCorrection(
    context: AppTenantContext,
    attachmentId: string,
    derivativeId: string,
    input: { correctedText: string },
  ): Promise<AiChatAttachmentDto>;
  transferAttachmentToClientRecord(
    context: AppTenantContext,
    attachmentId: string,
    input: { clientId: string; category: AiChatClientRecordCategory; title: string; previewAccepted: boolean },
  ): Promise<{ assetId: string; objectKey: string }>;
  enqueueAttachmentScanJob(tenantId: string, conversationId: string, attachmentId: string, userId: string): Promise<void>;
  enqueueAttachmentParseJob(tenantId: string, conversationId: string, attachmentId: string, userId: string): Promise<void>;
  enqueueAttachmentCleanupJob(tenantId: string, conversationId: string, attachmentId: string, userId?: string): Promise<void>;
  getAttachmentObjectBytes(objectKey: string): Promise<Buffer | null>;
  getRunRiskSummary(
    tenantId: string,
    runId: string,
    userId: string,
  ): Promise<import("./phase-85-stage-4c-contracts").AiChatRunRiskSummaryDto | null>;
  listRunDraftDestinations(
    context: AppTenantContext,
    runId: string,
  ): Promise<Array<{ conversationId: string; clientId: string; channel: string; revision: number }>>;
  transferRunDraft(
    context: AppTenantContext,
    runId: string,
    input: {
      sourceConversationId: string;
      destinationConversationId: string;
      destinationRevision: number;
      clientContextRevision: number;
    },
  ): Promise<import("./phase-85-stage-4c-contracts").AiChatDraftTransferDto>;
  createRunHandoff(
    context: AppTenantContext,
    runId: string,
    input: { conversationId: string; clientId: string; confirmationToken: string; expectedClientContextRevision: number },
  ): Promise<{ handoffId: string }>;
  getPendingComposerDraftTransfer(
    tenantId: string,
    destinationConversationId: string,
  ): Promise<import("./phase-85-stage-4c-contracts").AiChatDraftTransferDto | null>;
  consumeComposerDraftTransfer(input: {
    tenantId: string;
    transferId: string;
    destinationConversationId: string;
    destinationClientId: string;
  }): Promise<void>;
  applyRunRiskPipeline(input: {
    tenantId: string;
    runId: string;
    conversationId: string;
    createdByUserId: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    triggerBody: string;
    directAnswer: string | null;
    answerability: AiChatRunDto["answerability"];
    providerRiskLevel: AiChatRiskLevel | null;
    verifiedFactTexts: string[];
    attachmentExcerpts: string[];
    sourceExcerptTexts: string[];
    sourceRefIds: string[];
    revisionToken?: string | null;
  }): Promise<void>;
  deleteConversation(
    context: AppTenantContext,
    chatId: string,
    input: AiChatDeleteConversationInput,
  ): Promise<AiChatDeleteConversationResult>;
  deleteMessage(
    context: AppTenantContext,
    messageId: string,
    input: AiChatDeleteMessageInput,
  ): Promise<AiChatDeleteMessageResult>;
  processLifecycleDeletionBatch(limit?: number): Promise<number>;
  runLifecycleRetentionSweeps(): Promise<void>;
  enqueueClientScopedDeletions(
    context: AppTenantContext,
    clientId: string,
    reason: "client_anonymization" | "client_removal",
  ): Promise<void>;
  buildClientScopedExportSlice(clientId: string): Promise<AiChatClientScopedExportSlice>;
}

function canUseInMemoryAiChatStore() {
  return process.env.NODE_ENV === "test" || process.env.AI_CHAT_DETERMINISTIC_MODE === "true";
}

export function resolveAiChatStore(): AiChatStore {
  if (isSupabaseStoreConfigured()) {
    assertSupabaseAiChatCoreContractReady();
    return supabaseAiChatStore;
  }
  if (canUseInMemoryAiChatStore()) {
    return inMemoryAiChatStore;
  }
  throw new AppRequestError(503, "ai_chat_store_unavailable");
}

export {
  buildInMemoryAiChatClientExportSlice,
  inMemoryAiChatStore,
  readFallbackPendingAiChatDraftTransfer,
  readInMemoryAiChatLifecycleStateForTests,
  readInMemoryAiChatStateForLifecycle,
  resetInMemoryAiChatStoreForTests,
  seedInMemoryClientGatewayFixture,
  setInMemoryClientRevisionToken,
  triggerAccountAiChatLifecycleDeletions,
  triggerClientAiChatLifecycleDeletions,
} from "./phase-85-stage-4c-in-memory-store";

export { assertSupabaseAiChatCoreContractReady, supabaseAiChatStore } from "./phase-85-stage-4c-supabase-store";
