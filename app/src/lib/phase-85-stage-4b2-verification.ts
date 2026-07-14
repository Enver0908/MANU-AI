import type { AppTenantContext } from "./auth-context";
import { createInitialState, DEMO_DIETITIAN_ID, DEMO_TENANT_ID } from "./seed-data";
import type {
  ConversationActorContext,
  ConversationInboxItem,
  ConversationMessageDto,
  ConversationProjectionSource,
} from "./phase-85-stage-4b2-contracts";
import {
  CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE,
  CONVERSATION_DETAIL_MAX_PAGE_SIZE,
  CONVERSATION_LIST_DEFAULT_PAGE_SIZE,
  CONVERSATION_LIST_MAX_PAGE_SIZE,
} from "./phase-85-stage-4b2-contracts";
import {
  buildConversationDetailResponse,
  buildConversationListResponse,
} from "./phase-85-stage-4b2-messaging";
import { evaluateStage4B2MessagingIntegrationEvidence } from "./phase-85-stage-4b2-messaging-integration-evidence";
import { runStage4BChannelIntegrationChecks } from "./phase-85-stage-4b-integration-verification";
import { createStage4B2MessagingScaleFixture } from "./phase-85-stage-4b2-messaging";

export const PHASE_85_STAGE_4B_2_VERIFICATION_VERSION = "p85-stage-4b2-verification-v1";

export const STAGE_4B2_SCALE_TARGETS = {
  conversationCount: 10_000,
  defaultListPageSize: CONVERSATION_LIST_DEFAULT_PAGE_SIZE,
  maxListPageSize: CONVERSATION_LIST_MAX_PAGE_SIZE,
  defaultDetailPageSize: CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE,
  maxDetailPageSize: CONVERSATION_DETAIL_MAX_PAGE_SIZE,
} as const;

export const CONVERSATION_INBOX_ITEM_DTO_KEYS = [
  "id",
  "clientId",
  "clientFullName",
  "channel",
  "preview",
  "lastActivityAt",
  "lastMessageId",
  "unreadCount",
  "hasUnread",
  "safeStatus",
  "permissions",
] as const;

export const CONVERSATION_MESSAGE_DTO_KEYS = [
  "id",
  "conversationId",
  "sender",
  "origin",
  "body",
  "contentStatus",
  "status",
  "isDraft",
  "sourceMessageId",
  "createdAt",
  "conversationSequence",
  "media",
  "visualReview",
  "audio",
  "voiceTranscript",
] as const;

export const STAGE_4B2_SENSITIVE_DTO_PATTERNS =
  /\b(providerAccountId|providerMessageId|payloadDigest|rawPrompt|reasonCode|reasonCodes|audit_metadata|generatedByAiDecisionId|rollingSummary|safeAcknowledgement|recommendedAction)\b/i;

export const STAGE_4B2_FORBIDDEN_WORKSPACE_PATTERNS = {
  phase86: /\bPhase\s+86\b/i,
  liveStripeKey: /\bsk_live_[a-zA-Z0-9]+\b/,
  embeddedServiceRole: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]{8,}['"]/,
} as const;

export type Stage4B2BoundedMessagingEvidence = {
  ready: boolean;
  failures: string[];
  conversationCount: number;
  listDefaultPageSize: number;
  listMaxPageSize: number;
  detailDefaultPageSize: number;
  detailMaxPageSize: number;
  filteredTotal: number;
};

export type Stage4B2WorkspaceHygieneEvidence = {
  ready: boolean;
  failures: string[];
};

function ownerActor(): ConversationActorContext {
  return {
    tenantId: DEMO_TENANT_ID,
    userId: "user-owner",
    dietitianId: DEMO_DIETITIAN_ID,
    role: "owner",
  };
}

function assertAllowlistedKeys(value: Record<string, unknown>, allowlist: readonly string[], label: string) {
  const keys = Object.keys(value).sort();
  const allowed = [...allowlist].sort();
  if (keys.join("|") !== allowed.join("|")) {
    throw new Error(`${label}_dto_key_mismatch:${keys.join(",")}`);
  }
}

export function assertConversationInboxItemDtoSafety(item: ConversationInboxItem) {
  assertAllowlistedKeys(item as unknown as Record<string, unknown>, CONVERSATION_INBOX_ITEM_DTO_KEYS, "conversation_inbox_item");
  if (STAGE_4B2_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(item))) {
    throw new Error(`conversation_inbox_item_dto_sensitive_field:${item.id}`);
  }
  return item;
}

export function assertConversationMessageDtoSafety(message: ConversationMessageDto) {
  assertAllowlistedKeys(message as unknown as Record<string, unknown>, CONVERSATION_MESSAGE_DTO_KEYS, "conversation_message");
  if (STAGE_4B2_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(message))) {
    throw new Error(`conversation_message_dto_sensitive_field:${message.id}`);
  }
  return message;
}

export function evaluateStage4B2BoundedMessagingEvidence(
  source: ConversationProjectionSource,
  options?: { generatedAt?: string },
) {
  const failures: string[] = [];
  const actor = ownerActor();
  const generatedAt = options?.generatedAt ?? "2026-07-12T12:00:00.000Z";
  const conversationId = source.conversations[0]?.id;
  if (!conversationId) {
    return {
      ready: false,
      failures: ["no_conversation_for_bounded_evidence"],
      conversationCount: 0,
      listDefaultPageSize: 0,
      listMaxPageSize: 0,
      detailDefaultPageSize: 0,
      detailMaxPageSize: 0,
      filteredTotal: 0,
    } satisfies Stage4B2BoundedMessagingEvidence;
  }

  const defaultList = buildConversationListResponse(source, actor, [], { generatedAt });
  const maxList = buildConversationListResponse(source, actor, [], { generatedAt, limit: 250 });
  const defaultDetail = buildConversationDetailResponse(source, actor, [], conversationId, { generatedAt });
  const maxDetail = buildConversationDetailResponse(source, actor, [], conversationId, {
    generatedAt,
    limit: 250,
  });

  if (defaultList.items.length !== CONVERSATION_LIST_DEFAULT_PAGE_SIZE && source.conversations.length >= CONVERSATION_LIST_DEFAULT_PAGE_SIZE) {
    failures.push("list_default_page_size_mismatch");
  }
  if (maxList.items.length > CONVERSATION_LIST_MAX_PAGE_SIZE) {
    failures.push("list_max_page_size_exceeded");
  }
  const messageCount = source.messages.filter((message) => message.conversationId === conversationId).length;
  if (messageCount >= CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE && defaultDetail.messages.length !== CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE) {
    failures.push("detail_default_page_size_mismatch");
  }
  if (defaultDetail.messages.length > CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE) {
    failures.push("detail_default_page_size_exceeded");
  }
  if (maxDetail.messages.length > CONVERSATION_DETAIL_MAX_PAGE_SIZE) {
    failures.push("detail_max_page_size_exceeded");
  }

  for (const item of defaultList.items) {
    try {
      assertConversationInboxItemDtoSafety(item);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "inbox_item_dto_unsafe");
    }
  }
  for (const message of defaultDetail.messages) {
    try {
      assertConversationMessageDtoSafety(message);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "message_dto_unsafe");
    }
  }

  return {
    ready: failures.length === 0,
    failures,
    conversationCount: source.conversations.length,
    listDefaultPageSize: defaultList.items.length,
    listMaxPageSize: maxList.items.length,
    detailDefaultPageSize: defaultDetail.messages.length,
    detailMaxPageSize: maxDetail.messages.length,
    filteredTotal: defaultList.filteredTotal,
  } satisfies Stage4B2BoundedMessagingEvidence;
}

export function evaluateStage4B2WorkspaceHygieneEvidence(snippets: Record<string, string>) {
  const failures: string[] = [];
  for (const [path, text] of Object.entries(snippets)) {
    if (STAGE_4B2_FORBIDDEN_WORKSPACE_PATTERNS.phase86.test(text)) {
      failures.push(`phase_86_reference:${path}`);
    }
    if (STAGE_4B2_FORBIDDEN_WORKSPACE_PATTERNS.liveStripeKey.test(text)) {
      failures.push(`live_stripe_key:${path}`);
    }
    if (STAGE_4B2_FORBIDDEN_WORKSPACE_PATTERNS.embeddedServiceRole.test(text)) {
      failures.push(`embedded_service_role:${path}`);
    }
    if (STAGE_4B2_SENSITIVE_DTO_PATTERNS.test(text) && path.includes("contracts")) {
      failures.push(`sensitive_contract_marker:${path}`);
    }
  }
  return {
    ready: failures.length === 0,
    failures,
  } satisfies Stage4B2WorkspaceHygieneEvidence;
}

export function buildStage4B2VerificationEvidencePackMetrics(input: {
  bounded: Stage4B2BoundedMessagingEvidence;
  integrationReady: boolean;
  integrationFailures: string[];
  channelReady: boolean;
  channelFailures: string[];
  hygieneReady: boolean;
  hygieneFailures: string[];
}) {
  const failures = [
    ...input.bounded.failures,
    ...input.integrationFailures,
    ...input.channelFailures,
    ...input.hygieneFailures,
  ];
  return {
    phase: PHASE_85_STAGE_4B_2_VERIFICATION_VERSION,
    status:
      input.bounded.ready &&
      input.integrationReady &&
      input.channelReady &&
      input.hygieneReady
        ? "pass"
        : "fail",
    production_pilot_go: false,
    conversation_count: input.bounded.conversationCount,
    filtered_total: input.bounded.filteredTotal,
    list_default_page_size: input.bounded.listDefaultPageSize,
    list_max_page_size: input.bounded.listMaxPageSize,
    detail_default_page_size: input.bounded.detailDefaultPageSize,
    detail_max_page_size: input.bounded.detailMaxPageSize,
    failures,
  };
}

export async function runStage4B2VerificationRehearsalSample(
  snippets: Record<string, string> = {},
) {
  const source = createStage4B2MessagingScaleFixture(500, {
    tenantId: DEMO_TENANT_ID,
    dietitianId: DEMO_DIETITIAN_ID,
    messagesPerConversation: 3,
  });
  const bounded = evaluateStage4B2BoundedMessagingEvidence(source);
  const integration = await evaluateStage4B2MessagingIntegrationEvidence(createInitialState());
  const channel = await runStage4BChannelIntegrationChecks();
  const hygiene = evaluateStage4B2WorkspaceHygieneEvidence(snippets);
  return buildStage4B2VerificationEvidencePackMetrics({
    bounded,
    integrationReady: integration.ready,
    integrationFailures: integration.failures.map((failure) => `integration:${failure}`),
    channelReady: channel.ready,
    channelFailures: channel.failures.map((failure) => `channel:${failure}`),
    hygieneReady: hygiene.ready,
    hygieneFailures: hygiene.failures,
  });
}

export async function runStage4B2VerificationRehearsalFull(
  snippets: Record<string, string> = {},
) {
  const source = createStage4B2MessagingScaleFixture(STAGE_4B2_SCALE_TARGETS.conversationCount, {
    tenantId: DEMO_TENANT_ID,
    dietitianId: DEMO_DIETITIAN_ID,
    messagesPerConversation: 1,
  });
  const bounded = evaluateStage4B2BoundedMessagingEvidence(source);
  const integration = await evaluateStage4B2MessagingIntegrationEvidence(createInitialState());
  const channel = await runStage4BChannelIntegrationChecks();
  const hygiene = evaluateStage4B2WorkspaceHygieneEvidence(snippets);
  return buildStage4B2VerificationEvidencePackMetrics({
    bounded,
    integrationReady: integration.ready,
    integrationFailures: integration.failures.map((failure) => `integration:${failure}`),
    channelReady: channel.ready,
    channelFailures: channel.failures.map((failure) => `channel:${failure}`),
    hygieneReady: hygiene.ready,
    hygieneFailures: hygiene.failures,
  });
}

export function ownerContextForVerification(state = createInitialState()): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-owner",
    role: "owner",
  };
}
