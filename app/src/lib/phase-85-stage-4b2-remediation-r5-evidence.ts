import type {
  ConversationActorContext,
  ConversationProjectionMessage,
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
  createStage4B2MessagingScaleFixture,
} from "./phase-85-stage-4b2-messaging";

export const PHASE_85_STAGE_4B_2_REMEDIATION_R5_VERSION =
  "p85-stage-4b2-remediation-r5-evidence-v1";

export const STAGE_4B2_R5_SCALE_TARGETS = {
  conversationCount: 10_000,
  heavyTranscriptMessageCount: 10_000,
  listDefaultPageSize: CONVERSATION_LIST_DEFAULT_PAGE_SIZE,
  listMaxPageSize: CONVERSATION_LIST_MAX_PAGE_SIZE,
  detailDefaultPageSize: CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE,
  detailMaxPageSize: CONVERSATION_DETAIL_MAX_PAGE_SIZE,
} as const;

const R5_ACTOR: ConversationActorContext = {
  tenantId: "tenant-scale-4b2-r5",
  userId: "user-owner-r5",
  dietitianId: "dietitian-scale-4b2-r5",
  role: "owner",
};

export type Stage4B2R5ScaleEvidence = {
  version: string;
  status: "pass" | "fail";
  conversationCount: number;
  heavyTranscriptMessageCount: number;
  firstPageSize: number;
  secondPageSize: number;
  maxPageSize: number;
  defaultDetailSize: number;
  maxDetailSize: number;
  unreadConversationCount: number;
  unreadMessageCount: number;
  failures: string[];
};

function buildHeavyTranscript(
  conversationId: string,
  baseMessage: ConversationProjectionMessage,
  count: number,
) {
  return Array.from({ length: count }, (_, index) => ({
    ...baseMessage,
    id: `r5-heavy-message-${index}`,
    conversationId,
    body: `r5 bounded message ${index}`,
    conversationSequence: index + 1,
    createdAt: `2026-07-13T${String(Math.floor(index / 3600) % 24).padStart(2, "0")}:${String(
      Math.floor(index / 60) % 60,
    ).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
  }));
}

export function createStage4B2R5ScaleFixture(
  conversationCount = STAGE_4B2_R5_SCALE_TARGETS.conversationCount,
) {
  const base = createStage4B2MessagingScaleFixture(conversationCount, {
    tenantId: R5_ACTOR.tenantId,
    dietitianId: R5_ACTOR.dietitianId,
    messagesPerConversation: 1,
  });
  const heavyConversationId = base.conversations[0]!.id;
  const baseMessage = base.messages.find((message) => message.conversationId === heavyConversationId);
  if (!baseMessage) throw new Error("r5_heavy_transcript_seed_missing");
  return {
    source: {
      ...base,
      messages: [
        ...base.messages.filter((message) => message.conversationId !== heavyConversationId),
        ...buildHeavyTranscript(
          heavyConversationId,
          baseMessage,
          STAGE_4B2_R5_SCALE_TARGETS.heavyTranscriptMessageCount,
        ),
      ],
    } satisfies ConversationProjectionSource,
    heavyConversationId,
  };
}

export function evaluateStage4B2R5ScaleEvidence(
  source: ConversationProjectionSource,
  heavyConversationId: string,
): Stage4B2R5ScaleEvidence {
  const failures: string[] = [];
  const firstPage = buildConversationListResponse(source, R5_ACTOR, [], { limit: CONVERSATION_LIST_DEFAULT_PAGE_SIZE });
  const secondPage = firstPage.nextCursor
    ? buildConversationListResponse(source, R5_ACTOR, [], {
        cursor: firstPage.nextCursor,
        limit: CONVERSATION_LIST_DEFAULT_PAGE_SIZE,
      })
    : null;
  const maxPage = buildConversationListResponse(source, R5_ACTOR, [], { limit: CONVERSATION_LIST_MAX_PAGE_SIZE });
  const defaultDetail = buildConversationDetailResponse(source, R5_ACTOR, [], heavyConversationId, {
    limit: CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE,
  });
  const maxDetail = buildConversationDetailResponse(source, R5_ACTOR, [], heavyConversationId, {
    limit: CONVERSATION_DETAIL_MAX_PAGE_SIZE,
  });

  if (!secondPage) failures.push("missing_second_list_page");
  if (firstPage.filteredTotal !== source.conversations.length) {
    failures.push("filtered_total_not_scale_target");
  }
  if (firstPage.unreadConversationCount !== source.conversations.length) {
    failures.push("unread_conversation_aggregate_mismatch");
  }
  if (firstPage.unreadMessageCount !== source.messages.length) {
    failures.push("unread_message_aggregate_mismatch");
  }
  if (secondPage && secondPage.unreadMessageCount !== firstPage.unreadMessageCount) {
    failures.push("unread_aggregate_changed_between_pages");
  }
  if (firstPage.items.length > CONVERSATION_LIST_DEFAULT_PAGE_SIZE) {
    failures.push("default_list_page_overflow");
  }
  if (maxPage.items.length > CONVERSATION_LIST_MAX_PAGE_SIZE) {
    failures.push("max_list_page_overflow");
  }
  if (defaultDetail.messages.length > CONVERSATION_DETAIL_DEFAULT_PAGE_SIZE) {
    failures.push("default_detail_page_overflow");
  }
  if (maxDetail.messages.length > CONVERSATION_DETAIL_MAX_PAGE_SIZE) {
    failures.push("max_detail_page_overflow");
  }
  if (defaultDetail.unreadCount !== STAGE_4B2_R5_SCALE_TARGETS.heavyTranscriptMessageCount) {
    failures.push("heavy_detail_unread_count_not_authoritative");
  }
  if (JSON.stringify(firstPage).length > 200_000) failures.push("list_payload_unbounded");
  if (JSON.stringify(maxDetail).length > 200_000) failures.push("detail_payload_unbounded");

  return {
    version: PHASE_85_STAGE_4B_2_REMEDIATION_R5_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    conversationCount: source.conversations.length,
    heavyTranscriptMessageCount: source.messages.filter((message) => message.conversationId === heavyConversationId).length,
    firstPageSize: firstPage.items.length,
    secondPageSize: secondPage?.items.length ?? 0,
    maxPageSize: maxPage.items.length,
    defaultDetailSize: defaultDetail.messages.length,
    maxDetailSize: maxDetail.messages.length,
    unreadConversationCount: firstPage.unreadConversationCount,
    unreadMessageCount: firstPage.unreadMessageCount,
    failures,
  };
}

export function evaluateStage4B2R5SqlContractEvidence(input: { r2Migration: string; r3Migration: string }) {
  const failures: string[] = [];
  const requiredR2Markers = [
    "page as (",
    "bounded_messages",
    "unread_conversation_count",
    "unread_message_count",
    "p85_stage_4b2_mark_conversation_read_v2",
  ];
  const requiredR3Markers = [
    "on conflict (tenant_id, request_id) do nothing",
    "for update of cl",
    "p85_stage_4b2_actor_can_mutate_conversation",
    "red_lock_superseded",
    "set response_json = p_response_json",
  ];
  for (const marker of requiredR2Markers) {
    if (!input.r2Migration.toLowerCase().includes(marker.toLowerCase())) failures.push(`r2_marker_missing:${marker}`);
  }
  for (const marker of requiredR3Markers) {
    if (!input.r3Migration.toLowerCase().includes(marker.toLowerCase())) failures.push(`r3_marker_missing:${marker}`);
  }
  return { status: failures.length === 0 ? "pass" : "fail", failures };
}
