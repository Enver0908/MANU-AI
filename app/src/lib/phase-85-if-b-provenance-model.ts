import type {
  ChannelActorAttributionBasis,
  ChannelActorType,
  ChannelAuthorInterface,
  ChannelEventKind,
  ChannelEventProcessingStatus,
  MessageRecord,
  MessageRetrievalEligibility,
} from "./types";

export const PHASE_85_IF_B_PROVENANCE_MODEL_VERSION = "p85-if-b-trust-root-provenance-v1";

export const CHANNEL_ACTOR_TYPES: readonly ChannelActorType[] = [
  "client",
  "exact_dietitian",
  "business_operator",
  "ai",
  "system",
  "unknown",
];

export const CHANNEL_ACTOR_ATTRIBUTION_BASES: readonly ChannelActorAttributionBasis[] = [
  "authenticated_manu_action",
  "exclusive_verified_account",
  "shared_authorized_team",
  "provider_counterparty",
  "ai_decision",
  "system_operation",
  "imported_unknown",
];

export const CHANNEL_AUTHOR_INTERFACES: readonly ChannelAuthorInterface[] = [
  "manu_dashboard",
  "whatsapp_business_surface",
  "telegram_business_surface",
  "client_channel",
  "ai_provider",
  "system",
  "unknown",
];

export const CHANNEL_EVENT_KINDS: readonly ChannelEventKind[] = [
  "client_message_text",
  "client_message_image",
  "client_message_audio",
  "client_message_media_unsupported",
  "business_human_echo_text",
  "business_human_echo_media_unsupported",
  "outbound_status",
  "history_client_message",
  "history_business_human_message",
  "message_edit",
  "message_revoke",
  "message_revision_unknown_target",
  "malformed_event",
  "duplicate_event",
  "duplicate_message",
  "unknown_account",
  "unknown_client",
  "ambiguous_client",
  "cross_tenant_collision",
  "unsupported_event",
];

export const CHANNEL_EVENT_PROCESSING_STATUSES: readonly ChannelEventProcessingStatus[] = [
  "received",
  "normalized",
  "quarantined",
  "committed",
  "duplicate",
  "replayed",
  "rejected",
  "expired",
];

export function isVerifiedBusinessHumanMessage(message: Pick<MessageRecord, "origin" | "actorType" | "actorResolutionBasis">) {
  return (
    message.origin === "dietitian_manual" &&
    message.actorType === "business_operator" &&
    message.actorResolutionBasis === "shared_authorized_team"
  );
}

export function resolveLegacyRetrievalEligibility(
  message: Pick<MessageRecord, "origin" | "contentStatus" | "status" | "actorType">,
): MessageRetrievalEligibility {
  if (message.origin === "imported_unknown") {
    return "excluded_imported_unknown";
  }

  if (message.contentStatus === "revoked") {
    return "excluded_revoked";
  }

  if (message.contentStatus === "content_unavailable" || message.contentStatus === "redacted") {
    return "excluded_unavailable";
  }

  if (message.status === "blocked") {
    return "excluded_blocked";
  }

  if (message.status === "draft") {
    return "excluded_draft";
  }

  if (message.actorType === "unknown") {
    return "excluded_unverified_actor";
  }

  return "eligible";
}
