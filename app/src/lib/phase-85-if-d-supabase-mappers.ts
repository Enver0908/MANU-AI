import type {
  ChannelMessageRevisionRecord,
  HumanControlSessionRecord,
  RiskActivityEventRecord,
} from "./types";

// Phase 85 Interstage Foundation - P85-IF-D Supabase row mappers for transcript/human-control persistence.

export function humanControlSessionToDbRow(session: HumanControlSessionRecord) {
  return {
    id: session.id,
    tenant_id: session.tenantId,
    client_id: session.clientId,
    conversation_id: session.conversationId,
    reason: session.reason,
    status: session.status,
    previous_ai_status: session.previousAiStatus,
    previous_ai_mode: session.previousAiMode,
    linked_handoff_id: session.linkedHandoffId,
    linked_yellow_hold_message_id: session.linkedYellowHoldMessageId,
    opened_by_message_id: session.openedByMessageId,
    latest_human_message_id: session.latestHumanMessageId,
    human_response_observed_count: session.humanResponseObservedCount,
    opened_at: session.openedAt,
    resolved_at: session.resolvedAt,
    reactivated_by_dietitian_id: session.reactivatedByDietitianId,
    reactivation_reason_code: session.reactivationReasonCode,
    restored_ai_mode: session.restoredAiMode,
  };
}

export function channelMessageRevisionToDbRow(revision: ChannelMessageRevisionRecord) {
  return {
    id: revision.id,
    tenant_id: revision.tenantId,
    message_id: revision.messageId,
    channel_event_id: revision.channelEventId,
    provider_event_id: revision.providerEventId,
    revision_action: revision.revisionAction,
    prior_content_status: revision.priorContentStatus,
    current_content_status: revision.currentContentStatus,
    prior_body_digest: revision.priorBodyDigest,
    current_body_digest: revision.currentBodyDigest,
    revision_sequence: revision.revisionSequence,
    provider_time: revision.providerTime,
    observed_at: revision.observedAt,
  };
}

export function riskActivityEventToDbRow(event: RiskActivityEventRecord) {
  return {
    id: event.id,
    tenant_id: event.tenantId,
    client_id: event.clientId,
    conversation_id: event.conversationId,
    human_control_session_id: event.humanControlSessionId,
    event_type: event.eventType,
    source_message_id: event.sourceMessageId,
    handoff_id: event.handoffId,
    ai_decision_id: event.aiDecisionId,
    metadata: event.metadata,
    created_at: event.createdAt,
  };
}
