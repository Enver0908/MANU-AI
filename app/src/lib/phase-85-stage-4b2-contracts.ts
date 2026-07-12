import type {
  AiStatus,
  Channel,
  ClientAssignmentAccessLevel,
  ClientAssignmentRecord,
  ClientRecord,
  ConversationRecord,
  MessageContentStatus,
  MessageOrigin,
  MessageRecord,
  SenderType,
  TenantRole,
} from "./types";

export const PHASE_85_STAGE_4B_2_CONTRACT_VERSION = "p85-stage-4b-2-contracts-v1";
export const PHASE_85_STAGE_4B_2_API_VERSION = "p85-stage-4b-2-api-v1";
export const CONVERSATION_LIST_DEFAULT_PAGE_SIZE = 30;
export const CONVERSATION_LIST_MAX_PAGE_SIZE = 100;
export const CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE = 50;
export const CONVERSATION_DETAIL_MAX_PAGE_SIZE = 100;
export const CONVERSATION_MAX_QUERY_LENGTH = 80;
export const CONVERSATION_MAX_MESSAGE_BODY_LENGTH = 4096;
export const CONVERSATION_MAX_PREVIEW_LENGTH = 120;
export const CONVERSATION_ANCHOR_BEFORE_COUNT = 25;
export const CONVERSATION_ANCHOR_AFTER_COUNT = 24;
export const CONVERSATION_CURSOR_VERSION = 1;

export const CONVERSATION_DRAFT_PREVIEW = "Taslak inceleme bekliyor";
export const CONVERSATION_UNAVAILABLE_PREVIEW = "Icerik kullanilamiyor";

export type ConversationListStatus = "all" | "unread";
export type ConversationMessageDirection = "older" | "newer";
export type ConversationSafeStatus = "normal" | "ai_passive" | "attention";
export type ConversationVisibilityScope = "tenant" | "assigned" | "none";
export type ConversationAssignmentLevel = "tenant" | "primary" | ClientAssignmentAccessLevel | null;
export type ConversationMutationOperation =
  | "mark_read"
  | "manual_reply"
  | "draft_review"
  | "ai_control"
  | "risk_resolution";

export type ConversationActorContext = {
  tenantId: string;
  userId: string;
  dietitianId: string;
  role: TenantRole;
};

export type ConversationAssignmentRow = {
  tenant_id?: string | null;
  client_id: string;
  dietitian_id: string;
  access_level?: ClientAssignmentAccessLevel | null;
};

export type ConversationAssignmentInput =
  | ClientAssignmentRecord
  | {
      tenantId?: string | null;
      clientId: string;
      dietitianId: string;
      accessLevel?: ClientAssignmentAccessLevel | null;
    }
  | ConversationAssignmentRow;

export type ConversationReadReceiptRecord = {
  tenantId: string;
  conversationId: string;
  dietitianId: string;
  actorRole: TenantRole;
  lastReadSequence: number;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationPermissions = {
  canRead: boolean;
  canViewTranscript: boolean;
  canMarkRead: boolean;
  canSendManualReply: boolean;
  canReviewDraft: boolean;
  canControlAi: boolean;
  canResolveRisk: boolean;
  canMutateConversation: boolean;
  isReadOnly: boolean;
  assignmentLevel: ConversationAssignmentLevel;
  scope: ConversationVisibilityScope;
};

export type ConversationInboxItem = {
  id: string;
  clientId: string;
  clientFullName: string;
  channel: Channel;
  preview: string;
  lastActivityAt: string | null;
  lastMessageId: string | null;
  unreadCount: number;
  hasUnread: boolean;
  safeStatus: ConversationSafeStatus;
  permissions: ConversationPermissions;
};

export type ConversationListResponse = {
  version: string;
  generatedAt: string;
  items: ConversationInboxItem[];
  nextCursor: string | null;
  filteredTotal: number;
};

export type ConversationMessageDto = {
  id: string;
  conversationId: string;
  sender: SenderType;
  origin: MessageOrigin;
  body: string | null;
  contentStatus: MessageContentStatus;
  status: NonNullable<MessageRecord["status"]> | "sent";
  isDraft: boolean;
  sourceMessageId: string | null;
  createdAt: string;
  conversationSequence: number | null;
};

export type ConversationSummaryDto = {
  id: string;
  clientId: string;
  clientFullName: string;
  channel: Channel;
  revision: number;
  lastActivityAt: string | null;
  safeStatus: ConversationSafeStatus;
};

export type ConversationPagination = {
  requestedDirection: ConversationMessageDirection;
  anchorMessageId: string | null;
  olderCursor: string | null;
  newerCursor: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
};

export type ConversationDetailResponse = {
  version: string;
  generatedAt: string;
  conversation: ConversationSummaryDto;
  messages: ConversationMessageDto[];
  pagination: ConversationPagination;
  receipt: ConversationReadReceiptRecord | null;
  unreadCount: number;
  permissions: ConversationPermissions;
};

export type ConversationMutationResponse = {
  version: string;
  generatedAt: string;
  operation: ConversationMutationOperation;
  conversationId: string;
  conversationRevision: number;
  message: ConversationMessageDto | null;
  receipt: ConversationReadReceiptRecord | null;
  unreadCount: number;
  permissions: ConversationPermissions;
};

export type ConversationManualReplyRequest = {
  conversationId: string;
  body: string;
  requestId: string;
  expectedConversationRevision: number;
};

export type ConversationDraftAction =
  | "approve"
  | "edit_send"
  | "dismiss"
  | "review_send_manual";

export type ConversationDraftMutationRequest = {
  action: ConversationDraftAction;
  body?: string;
  requestId: string;
  expectedConversationRevision: number;
  expectedClientContextRevision?: number;
};

export type ConversationListCursorPayload = {
  v: number;
  mode: "conversation_list";
  status: ConversationListStatus;
  query: string;
  lastActivityAt: string | null;
  conversationId: string;
};

export type ConversationMessageCursorPayload = {
  v: number;
  mode: "conversation_messages";
  direction: ConversationMessageDirection;
  conversationId: string;
  messageId: string;
  conversationSequence: number | null;
  createdAt: string;
};

export type ConversationListQuery = {
  status: ConversationListStatus;
  query: string;
  cursor: string | null;
  limit: number;
};

export type ConversationDetailQuery = {
  direction: ConversationMessageDirection;
  cursor: string | null;
  anchorMessageId: string | null;
  limit: number;
};

export type ConversationProjectionConversation = Pick<
  ConversationRecord,
  "id" | "tenantId" | "dietitianId" | "clientId" | "channel" | "revision"
>;

export type ConversationProjectionClient = Pick<
  ClientRecord,
  | "id"
  | "tenantId"
  | "dietitianId"
  | "lifecycleStatus"
  | "fullName"
  | "aiStatus"
  | "humanTakeoverLocked"
  | "redRiskLock"
  | "yellowRiskHold"
>;

export type ConversationProjectionMessage = Pick<
  MessageRecord,
  | "id"
  | "tenantId"
  | "conversationId"
  | "sender"
  | "body"
  | "origin"
  | "sourceMessageId"
  | "conversationSequence"
  | "contentStatus"
  | "status"
  | "createdAt"
>;

export type ConversationProjectionSource = {
  conversations: readonly ConversationProjectionConversation[];
  clients: readonly ConversationProjectionClient[];
  messages: readonly ConversationProjectionMessage[];
  receipts?: readonly ConversationReadReceiptRecord[];
};

export type ConversationClientStatusSource = Pick<
  ConversationProjectionClient,
  "aiStatus" | "humanTakeoverLocked" | "redRiskLock" | "yellowRiskHold"
>;

export type ConversationAssignmentAccess = {
  level: ConversationAssignmentLevel;
  isExplicit: boolean;
};

export type ConversationPermissionInput = {
  actor: ConversationActorContext;
  conversation: ConversationProjectionConversation;
  client: ConversationProjectionClient;
  assignments: readonly ConversationAssignmentInput[];
};

export type ConversationListItemPermissionFlags = Pick<
  ConversationPermissions,
  | "canRead"
  | "canMarkRead"
  | "canSendManualReply"
  | "canReviewDraft"
  | "canControlAi"
  | "isReadOnly"
>;

export type ConversationMessageSource = ConversationProjectionMessage;

export type ConversationAiStatus = AiStatus;
