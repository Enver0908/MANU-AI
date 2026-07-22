export const PHASE_85_STAGE_4C_CONTRACT_VERSION = "p85-stage-4c-contracts-v1";

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

export const AI_CHAT_MESSAGE_VERSION_STATUSES = ["active", "superseded", "deleted"] as const;
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

export type AiChatBranchDto = {
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

export type AiChatAttachmentDto = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  status: AiChatAttachmentStatus;
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
  sourceRefs: AiChatSourceRefDto[];
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
  };
}
