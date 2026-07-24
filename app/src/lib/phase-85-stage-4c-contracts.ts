export const PHASE_85_STAGE_4C_CONTRACT_VERSION = "p85-stage-4c-contracts-v2";

export const AI_CHAT_TITLE_MAX_LENGTH = 120;
export const AI_CHAT_MESSAGE_BODY_MAX_LENGTH = 12_000;
export const AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH = 1_200;
export const AI_CHAT_LIST_DEFAULT_LIMIT = 30;
export const AI_CHAT_LIST_MAX_LIMIT = 100;
export const AI_CHAT_MESSAGE_LIST_DEFAULT_LIMIT = 50;
export const AI_CHAT_MESSAGE_LIST_MAX_LIMIT = 100;
export const AI_CHAT_CLIENT_SEARCH_DEFAULT_LIMIT = 20;
export const AI_CHAT_CLIENT_SEARCH_MAX_LIMIT = 50;
export const AI_CHAT_MAX_QUERY_LENGTH = 120;
export const AI_CHAT_PREVIEW_MAX_LENGTH = 120;
export const AI_CHAT_CURSOR_VERSION = 1;
export const AI_CHAT_READ_RATE_LIMIT = 120;
export const AI_CHAT_MUTATION_RATE_LIMIT = 60;

export const AI_CHAT_MAX_VISIBLE_MESSAGES = 12;
export const AI_CHAT_MAX_CONTEXT_CHARS = 18_000;
export const AI_CHAT_MAX_ROLLING_SUMMARY_CHARS = 4_000;
export const AI_CHAT_MAX_USER_ACTIVE_RUNS = 3;
export const AI_CHAT_AUTO_TITLE_MAX_LENGTH = 60;
export const AI_CHAT_DEFAULT_CONVERSATION_TITLE = "Yeni sohbet";
export const AI_CHAT_DELETION_DB_BATCH_SIZE = 500;
export const AI_CHAT_DELETION_STORAGE_BATCH_SIZE = 100;
export const AI_CHAT_DELETION_MAX_ATTEMPTS = 3;
export const AI_CHAT_ORPHAN_RETENTION_HOURS = 24;
export const AI_CHAT_SSE_RETENTION_HOURS = 24;
export const AI_CHAT_JOB_LEASE_MS = 60_000;
export const AI_CHAT_JOB_HEARTBEAT_MS = 20_000;
export const AI_CHAT_PROVIDER_TIMEOUT_MS = 15_000;
export const AI_CHAT_RUN_TIMEOUT_MS = 120_000;
export const AI_CHAT_SSE_WINDOW_MS = 25_000;
export const AI_CHAT_SSE_HEARTBEAT_MS = 15_000;
export const AI_CHAT_RUN_EVENT_RETENTION_HOURS = 24;

export const DIETITIAN_CHAT_INTENTS = [
  "general_non_client",
  "client_current_status",
  "client_longitudinal_summary",
  "client_trend",
  "client_period_comparison",
  "client_specific_record",
  "client_risk_review",
  "client_source_explanation",
  "client_safe_draft",
  "unsupported_write_action",
  "second_client_reference",
] as const;
export type DietitianChatIntent = (typeof DIETITIAN_CHAT_INTENTS)[number];

export const AI_CHAT_CONTEXT_TOOLS = [
  "load_client_profile",
  "load_client_active_form",
  "load_client_food_rule_profile",
  "load_client_menu_plans",
  "load_client_context_updates",
  "load_client_recent_messages",
  "search_client_messages",
  "load_client_accepted_transcripts",
  "load_client_risk_timeline",
  "load_client_handoffs",
  "load_client_ai_decisions",
  "load_client_record_assets",
  "search_approved_sources",
] as const;
export type AiChatContextTool = (typeof AI_CHAT_CONTEXT_TOOLS)[number];

export const AI_CHAT_CONTEXT_FORBIDDEN_TOOL_ARG_KEYS = [
  "tenant_id",
  "tenantId",
  "client_id",
  "clientId",
  "dietitian_id",
  "dietitianId",
] as const;

export const AI_CHAT_CONTEXT_MAX_TOOL_CALLS_PER_RUN = 8;
export const AI_CHAT_CONTEXT_MAX_PARALLEL_TOOL_CALLS = 4;
export const AI_CHAT_CONTEXT_TOOL_TIMEOUT_MS = 2_000;
export const AI_CHAT_CONTEXT_MAX_SOURCE_REFS = 30;
export const AI_CHAT_CONTEXT_MAX_UNSTRUCTURED_EXCERPTS = 20;
export const AI_CHAT_CONTEXT_MAX_EVIDENCE_CHARS = 32_000;
export const AI_CHAT_CONTEXT_MAX_PROVIDER_SERIALIZED_CHARS = 60_000;
export const AI_CHAT_CONTEXT_LIMIT_PROFILE_ROWS = 1;
export const AI_CHAT_CONTEXT_LIMIT_ACTIVE_FORM_FIELDS = 250;
export const AI_CHAT_CONTEXT_LIMIT_FOOD_RULE_RECORDS = 200;
export const AI_CHAT_CONTEXT_LIMIT_MENU_PLANS = 12;
export const AI_CHAT_CONTEXT_LIMIT_CONTEXT_UPDATES = 50;
export const AI_CHAT_CONTEXT_LIMIT_RECENT_MESSAGES = 30;
export const AI_CHAT_CONTEXT_LIMIT_SEARCH_CHUNKS = 20;
export const AI_CHAT_CONTEXT_LIMIT_CATEGORY_ROWS = 20;

export const AI_CHAT_RUN_EVENT_TYPES = [
  "run.accepted",
  "run.status",
  "response.delta",
  "source.available",
  "risk.updated",
  "response.completed",
  "response.stopped",
  "run.failed",
  "heartbeat",
] as const;
export type AiChatRunEventType = (typeof AI_CHAT_RUN_EVENT_TYPES)[number];

export const AI_CHAT_COMPLETION_STATES = ["complete", "incomplete"] as const;
export type AiChatCompletionState = (typeof AI_CHAT_COMPLETION_STATES)[number];

export const AI_CHAT_JOB_TYPES = [
  "generation",
  "title",
  "attachment_scan",
  "attachment_parse",
  "attachment_cleanup",
  "conversation_purge",
  "message_purge",
  "lifecycle_sweep",
] as const;
export type AiChatJobType = (typeof AI_CHAT_JOB_TYPES)[number];

export const AI_CHAT_TITLE_SOURCES = ["auto", "user"] as const;
export type AiChatTitleSource = (typeof AI_CHAT_TITLE_SOURCES)[number];

export const AI_CHAT_LIST_SCOPE_FILTERS = ["all", "general", "client"] as const;
export type AiChatListScopeFilter = (typeof AI_CHAT_LIST_SCOPE_FILTERS)[number];

export const AI_CHAT_SCOPE_TYPES = ["general", "client"] as const;
export type AiChatScopeType = (typeof AI_CHAT_SCOPE_TYPES)[number];

export const AI_CHAT_CONVERSATION_STATUSES = ["active", "locked", "deleting", "deleted"] as const;
export type AiChatConversationStatus = (typeof AI_CHAT_CONVERSATION_STATUSES)[number];

export const AI_CHAT_MESSAGE_ROLES = ["user", "assistant"] as const;
export type AiChatMessageRole = (typeof AI_CHAT_MESSAGE_ROLES)[number];

export const AI_CHAT_RUN_STATUSES = [
  "queued",
  "retrieving",
  "generating",
  "validating",
  "cancel_requested",
  "completed",
  "stopped",
  "failed",
  "superseded",
] as const;
export type AiChatRunStatus = (typeof AI_CHAT_RUN_STATUSES)[number];

export const AI_CHAT_ANSWERABILITY_VALUES = [
  "answerable",
  "partial",
  "insufficient",
  "conflicting",
  "not_authorized",
] as const;
export type AiChatAnswerability = (typeof AI_CHAT_ANSWERABILITY_VALUES)[number];

export const AI_CHAT_RISK_LEVELS = ["green", "yellow", "red"] as const;
export type AiChatRiskLevel = (typeof AI_CHAT_RISK_LEVELS)[number];

export const AI_CHAT_SOURCE_TYPES = [
  "client_record",
  "approved_clinical_source",
  "chat_attachment",
  "web_source",
  "dietitian_input",
] as const;
export type AiChatSourceType = (typeof AI_CHAT_SOURCE_TYPES)[number];

export const AI_CHAT_ATTACHMENT_STATUSES = [
  "upload_pending",
  "uploaded",
  "quarantined",
  "scanning",
  "processing",
  "review_required",
  "ready",
  "rejected",
  "failed",
  "deleting",
  "deleted",
] as const;
export type AiChatAttachmentStatus = (typeof AI_CHAT_ATTACHMENT_STATUSES)[number];

export const AI_CHAT_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "retryable_failed",
  "permanently_failed",
  "cancelled",
] as const;
export type AiChatJobStatus = (typeof AI_CHAT_JOB_STATUSES)[number];

export const AI_CHAT_MESSAGE_VERSION_STATUSES = ["active", "superseded", "deleted", "deleting"] as const;
export type AiChatMessageVersionStatus = (typeof AI_CHAT_MESSAGE_VERSION_STATUSES)[number];

export const AI_CHAT_TOOL_CALL_STATUSES = ["allowed", "denied", "completed", "failed", "superseded"] as const;
export type AiChatToolCallStatus = (typeof AI_CHAT_TOOL_CALL_STATUSES)[number];

export const AI_CHAT_API_ERROR_CODES = [
  "dietitian_ai_chat_forbidden",
  "ai_chat_not_found",
  "ai_chat_scope_client_mismatch",
  "ai_chat_client_required",
  "ai_chat_immutable_scope",
  "ai_chat_revision_conflict",
  "ai_chat_idempotency_conflict",
  "ai_chat_access_check_failed",
  "ai_chat_store_unavailable",
  "ai_chat_cursor_invalid",
  "ai_chat_title_required",
  "ai_chat_title_too_long",
  "ai_chat_conversation_locked",
  "ai_chat_message_version_immutable",
  "ai_chat_general_scope_client_source_forbidden",
  "ai_chat_message_body_required",
  "ai_chat_message_body_too_long",
  "ai_chat_message_not_latest_user",
  "ai_chat_active_run_conflict",
  "ai_chat_user_run_limit",
  "ai_chat_run_not_found",
  "ai_chat_run_already_terminal",
  "ai_chat_message_not_found",
  "ai_chat_regenerate_not_latest_assistant",
  "ai_chat_legal_hold",
  "ai_chat_assistant_delete_forbidden",
  "ai_chat_message_delete_in_progress",
  "ai_chat_deletion_job_not_found",
] as const;
export type AiChatApiErrorCode = (typeof AI_CHAT_API_ERROR_CODES)[number];

export type AiChatConversationSummary = {
  id: string;
  tenantId: string;
  createdByUserId: string;
  createdByDietitianId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  title: string;
  titleSource: AiChatTitleSource;
  status: AiChatConversationStatus;
  activeBranchId: string | null;
  revision: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatConversationListItem = AiChatConversationSummary & {
  preview: string | null;
  clientFullName: string | null;
  clientReferenceCode: string | null;
  clientReferenceShort: string | null;
};

export type AiChatConversationDetail = AiChatConversationListItem & {
  branches: AiChatBranchDto[];
  messages: AiChatMessageDto[];
};

export const AI_CHAT_BRANCH_STATUSES = ["active", "deleted"] as const;
export type AiChatBranchStatus = (typeof AI_CHAT_BRANCH_STATUSES)[number];

export type AiChatBranchDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  parentBranchId: string | null;
  forkedFromMessageVersionId: string | null;
  activeLeafVersionId: string | null;
  forkReason: string | null;
  status: AiChatBranchStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessageDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  role: AiChatMessageRole;
  authorUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions: AiChatMessageVersionDto[];
};

export type AiChatMessageVersionDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  branchId: string;
  createdByUserId: string;
  body: string;
  bodySha256: string;
  parentVersionId: string | null;
  supersedesVersionId: string | null;
  runId: string | null;
  contentStatus: AiChatMessageVersionStatus;
  createdAt: string;
};

export type AiChatRunDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  triggerMessageVersionId: string;
  status: AiChatRunStatus;
  answerability: AiChatAnswerability | null;
  riskLevel: AiChatRiskLevel | null;
  safetyOutcome: string | null;
  cancelRequestedAt: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatRunEventDto = {
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  sequenceNumber: number;
  eventType: AiChatRunEventType | string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AiChatSendMessageResult = {
  runId: string;
  messageId: string;
  messageVersionId: string;
  conversationRevision: number;
};

export type AiChatMutationRunResult = {
  runId: string;
  conversationRevision: number;
  branchId: string;
  messageId?: string;
  messageVersionId?: string;
};

export type AiChatStopRunResult = {
  runId: string;
  status: AiChatRunStatus;
};

export const AI_CHAT_DELETION_JOB_KINDS = [
  "conversation_purge",
  "message_purge",
  "client_chats_purge",
  "account_chats_purge",
  "lifecycle_sweep",
] as const;
export type AiChatDeletionJobKind = (typeof AI_CHAT_DELETION_JOB_KINDS)[number];

export const AI_CHAT_DELETION_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "blocked_legal_hold",
] as const;
export type AiChatDeletionJobStatus = (typeof AI_CHAT_DELETION_JOB_STATUSES)[number];

export type AiChatDeletionJobRecord = {
  id: string;
  tenantId: string;
  jobKind: AiChatDeletionJobKind;
  targetConversationId: string | null;
  targetMessageId: string | null;
  targetClientId: string | null;
  targetUserId: string | null;
  reason: string;
  status: AiChatDeletionJobStatus;
  attemptCount: number;
  cursor: Record<string, unknown>;
  requestedAt: string;
  completedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type AiChatDeletionLedgerRecord = {
  id: string;
  tenantId: string;
  entityType: string;
  entityIdHash: string;
  reason: string;
  requestedAt: string;
  completedAt: string | null;
  replayStatus: "pending" | "applied" | "verified";
  createdAt: string;
  updatedAt: string;
};

export type AiChatDeleteConversationInput = {
  requestId: string;
  expectedRevision: number;
};

export type AiChatDeleteConversationResult = {
  chatId: string;
  deletionJobId: string;
  status: "deleting";
  conversationRevision: number;
};

export type AiChatDeleteMessageInput = {
  requestId: string;
  expectedRevision: number;
};

export type AiChatDeleteMessageResult = {
  messageId: string;
  deletionJobId: string;
  conversationId: string;
  conversationRevision: number;
};

export type AiChatClientScopedExportSlice = {
  conversations: Array<{
    id: string;
    title: string;
    scopeType: AiChatScopeType;
    clientId: string | null;
    lastMessageAt: string | null;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    conversationId: string;
    role: AiChatMessageRole;
    body: string;
    createdAt: string;
  }>;
  sourceManifest: Array<{
    sourceRefId: string;
    sourceType: AiChatSourceType;
    locator: string | null;
    sourceDate: string | null;
  }>;
  clientRecordAssets: Array<{
    id: string;
    category: string;
    title: string;
    sourceChatIdHash: string | null;
    createdAt: string;
  }>;
};

export type AiChatJobRecord = {
  id: string;
  tenantId: string;
  jobType: AiChatJobType;
  runId: string | null;
  conversationId: string;
  createdByUserId: string;
  status: AiChatJobStatus;
  payload: Record<string, unknown>;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  retryCount: number;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AiChatAnswerEnvelope = {
  directAnswer: string | null;
  verifiedFindings: string[];
  inferences: string[];
  recommendations: string[];
  missingData: string[];
  conflictingData: string[];
  riskContext: string | null;
  sourceRefs: AiChatSourceRefDto[];
  safeDraft: AiChatSafeDraftDto | null;
};

export type AiChatSourceRefDto = {
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  messageVersionId: string | null;
  createdByUserId: string;
  sourceType: AiChatSourceType;
  canonicalEntityId: string;
  locator: string | null;
  sourceDate: string | null;
  contentHash: string | null;
  claimId: string | null;
  clientId: string | null;
  createdAt: string;
};

export type AiChatAttachmentKind = "image" | "document" | "audio";

export const AI_CHAT_CLIENT_RECORD_CATEGORIES = [
  "clinical_document",
  "laboratory_result",
  "diet_plan_reference",
  "form_source",
  "general_context",
] as const;
export type AiChatClientRecordCategory = (typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number];

export type AiChatAttachmentDerivativeDto = {
  id: string;
  attachmentId: string;
  kind: "sanitized_original" | "extracted_text" | "ocr_text" | "transcript" | "chunk";
  status: "pending" | "review_required" | "accepted" | "superseded" | "rejected";
  excerpt: string | null;
  locator: string | null;
  confidence: number | null;
  createdAt: string;
};

export type AiChatAttachmentDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  kind: AiChatAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentSha256: string;
  status: AiChatAttachmentStatus;
  failureCode: string | null;
  pageCount: number | null;
  durationSec: number | null;
  derivatives: AiChatAttachmentDerivativeDto[];
  createdAt: string;
  updatedAt: string;
};

export type AiChatClientSearchItem = {
  id: string;
  fullName: string;
  displayReference: string;
  shortDisplay: string;
  channel: string | null;
};

export type AiChatConversationListResponse = {
  items: AiChatConversationListItem[];
  nextCursor: string | null;
};

export type AiChatApiErrorBody = {
  error: {
    code: AiChatApiErrorCode | string;
    retryable: boolean;
    field?: string;
    revision?: number;
  };
  requestId: string | null;
};

export type AiChatSafeDraftDto = {
  body: string;
  riskLevel: AiChatRiskLevel | null;
  sourceRefIds: string[];
};

export type AiChatRiskAssessmentDto = {
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  createdByUserId: string;
  clientId: string | null;
  riskLevel: AiChatRiskLevel;
  reasons: string[];
  sourceRefIds: string[];
  confidenceClass: string;
  recommendedHumanAction: string;
  hypotheticalRed: boolean;
  sourceRevisionDigest: string;
  handoffConfirmationToken: string | null;
  status: "active" | "superseded";
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatDraftTransferDto = {
  id: string;
  tenantId: string;
  runId: string;
  sourceConversationId: string;
  destinationConversationId: string;
  destinationClientId: string;
  createdByUserId: string;
  riskLevel: "green" | "yellow";
  reviewOrigin: "ai_chat";
  transferMode: "composer_pending" | "yellow_review";
  draftBody: string;
  sourceRefIds: string[];
  status: "pending" | "consumed" | "superseded" | "blocked";
  destinationRevision: number;
  clientContextRevision: number;
  consumedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatHandoffLinkDto = {
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  clientId: string;
  createdByUserId: string;
  handoffId: string;
  fingerprint: string;
  confirmationToken: string;
  status: "active" | "superseded";
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatRunRiskSummaryDto = {
  runId: string;
  riskLevel: AiChatRiskLevel;
  reasons: string[];
  confidenceClass: string;
  recommendedHumanAction: string;
  hypotheticalRed: boolean;
  safeDraft: AiChatSafeDraftDto | null;
  handoffConfirmationToken: string | null;
  canTransferDraft: boolean;
  canCreateHandoff: boolean;
};

export type AiChatApiError = {
  error: AiChatApiErrorCode;
  revision?: number;
};

export type AiChatConversationRecord = {
  id: string;
  tenantId: string;
  createdByUserId: string;
  createdByDietitianId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  title: string;
  titleSource: AiChatTitleSource;
  status: AiChatConversationStatus;
  activeBranchId: string | null;
  revision: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatBranchRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  parentBranchId: string | null;
  forkedFromMessageVersionId: string | null;
  activeLeafVersionId: string | null;
  forkReason: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessageRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  role: AiChatMessageRole;
  authorUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessageVersionRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  branchId: string;
  createdByUserId: string;
  body: string;
  bodySha256: string;
  parentVersionId: string | null;
  supersedesVersionId: string | null;
  runId: string | null;
  contentStatus: AiChatMessageVersionStatus;
  createdAt: string;
};

export type AiChatRunRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  triggerMessageVersionId: string;
  status: AiChatRunStatus;
  answerability: AiChatAnswerability | null;
  riskLevel: AiChatRiskLevel | null;
  safetyOutcome: string | null;
  cancelRequestedAt: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Stage4CAiChatStateSlice = {
  aiChatConversations: AiChatConversationRecord[];
  aiChatBranches: AiChatBranchRecord[];
  aiChatMessages: AiChatMessageRecord[];
  aiChatMessageVersions: AiChatMessageVersionRecord[];
  aiChatRuns: AiChatRunRecord[];
  aiChatRunEvents: AiChatRunEventRecord[];
  aiChatJobs: AiChatJobRecord[];
  aiChatMemorySummaries: AiChatMemorySummaryRecord[];
};

export type AiChatRunEventRecord = {
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  createdByUserId: string;
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
  expiresAt: string;
  createdAt: string;
};

export type AiChatMemorySummaryRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  branchId: string;
  createdByUserId: string;
  summaryText: string;
  isAuthoritative: boolean;
  createdAt: string;
  updatedAt: string;
};

export function isAiChatScopeClientMismatch(scopeType: AiChatScopeType, clientId: string | null | undefined) {
  if (scopeType === "general") {
    return clientId != null;
  }
  return clientId == null;
}

export function createEmptyStage4CAiChatCollections(): Stage4CAiChatStateSlice {
  return {
    aiChatConversations: [],
    aiChatBranches: [],
    aiChatMessages: [],
    aiChatMessageVersions: [],
    aiChatRuns: [],
    aiChatRunEvents: [],
    aiChatJobs: [],
    aiChatMemorySummaries: [],
  };
}

export function isNonTerminalAiChatRunStatus(status: AiChatRunStatus) {
  return !["completed", "stopped", "failed", "superseded"].includes(status);
}
