import type {
  ChannelActorAttributionBasis,
  ChannelActorType,
  ChannelAuthorInterface,
  ChannelEventKind,
  ManuAppState,
} from "./types";
import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import { normalizeChannelIdentityForMatching } from "./channel-adapters";

// Phase 85 Interstage Foundation - P85-IF-C routing.
// Implements the mandatory fail-closed resolution order from
// docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md section 6:
// 1. provider account binding -> tenant (tenant is the caller's own already-loaded ManuAppState)
// 2. counterparty -> exactly one tenant-scoped client
// 3. client lifecycle / channel / tenant verification
// 4. actor resolution from event kind and trust binding
// 5. conversation resolution
// No event reaches the orchestrator until every step succeeds.

export type ChannelEventQuarantineOutcome = {
  status: "quarantined";
  finalEventKind: ChannelEventKind;
  quarantineReasons: string[];
};

export type ChannelEventRoutedOutcome = {
  status: "routed";
  finalEventKind: ChannelEventKind;
  accountBindingId: string;
  clientId: string | null;
  conversationId: string | null;
  actorType: ChannelActorType;
  actorBindingId: string | null;
  authorInterface: ChannelAuthorInterface;
  actorResolutionBasis: ChannelActorAttributionBasis;
};

export type ChannelEventRoutingOutcome = ChannelEventQuarantineOutcome | ChannelEventRoutedOutcome;

export function routeChannelEvent(state: ManuAppState, candidate: RawChannelEventCandidate): ChannelEventRoutingOutcome {
  if (candidate.eventKind === "malformed_event") {
    return quarantine("malformed_event", [candidate.malformedReason || "malformed_event"]);
  }

  if (candidate.eventKind === "unsupported_event") {
    return quarantine("unsupported_event", [candidate.malformedReason || "unsupported_event"]);
  }

  const accountBinding = resolveAccountBinding(state, candidate);
  if (!accountBinding) {
    return quarantine("unknown_account", ["unknown_account_binding"]);
  }

  if (candidate.eventKind === "outbound_status") {
    const message = state.messages.find(
      (item) => item.providerMessageId === candidate.providerMessageId && item.providerAccountBindingId === accountBinding.id,
    );
    if (!message) {
      return quarantine("message_revision_unknown_target", ["outbound_status_unknown_target_message"]);
    }

    return routed({
      finalEventKind: "outbound_status",
      accountBindingId: accountBinding.id,
      clientId: findClientIdForConversation(state, message.conversationId),
      conversationId: message.conversationId,
      actorType: "system",
      actorBindingId: null,
      authorInterface: "system",
      actorResolutionBasis: "system_operation",
    });
  }

  if (candidate.eventKind === "message_edit" || candidate.eventKind === "message_revoke") {
    const targetMessage = state.messages.find(
      (item) => item.providerMessageId === candidate.providerMessageId && item.providerAccountBindingId === accountBinding.id,
    );
    if (!targetMessage) {
      return quarantine("message_revision_unknown_target", ["revision_unknown_target_message"]);
    }

    return routed({
      finalEventKind: candidate.eventKind,
      accountBindingId: accountBinding.id,
      clientId: findClientIdForConversation(state, targetMessage.conversationId),
      conversationId: targetMessage.conversationId,
      actorType: targetMessage.actorType ?? inferActorTypeFromSender(targetMessage.sender),
      actorBindingId: targetMessage.actorBindingId ?? null,
      authorInterface: targetMessage.authorInterface ?? (targetMessage.sender === "client" ? "client_channel" : "whatsapp_business_surface"),
      actorResolutionBasis: targetMessage.actorResolutionBasis ?? "provider_counterparty",
    });
  }

  const clientMatches = resolveClientMatches(state, candidate);
  if (clientMatches.length === 0) {
    return quarantine("unknown_client", ["no_client_matches_counterparty"]);
  }
  if (clientMatches.length > 1) {
    return quarantine("ambiguous_client", ["multiple_clients_match_counterparty"]);
  }

  const client = clientMatches[0];

  if (client.tenantId !== state.tenant.id) {
    return quarantine("cross_tenant_collision", ["client_tenant_mismatch"]);
  }

  if (client.lifecycleStatus === "removed_anonymized") {
    return quarantine("unknown_client", ["client_removed_anonymized"]);
  }

  if (client.channel !== "whatsapp") {
    return quarantine("unknown_client", ["client_channel_mismatch"]);
  }

  const conversation = state.conversations.find((item) => item.clientId === client.id && item.channel === "whatsapp");
  if (!conversation) {
    return quarantine("unknown_client", ["no_conversation_for_client"]);
  }

  if (
    candidate.eventKind === "client_message_text" ||
    candidate.eventKind === "client_message_media_unsupported" ||
    candidate.eventKind === "history_client_message"
  ) {
    return routed({
      finalEventKind: candidate.eventKind,
      accountBindingId: accountBinding.id,
      clientId: client.id,
      conversationId: conversation.id,
      actorType: "client",
      actorBindingId: null,
      authorInterface: "client_channel",
      actorResolutionBasis: "provider_counterparty",
    });
  }

  if (
    candidate.eventKind === "business_human_echo_text" ||
    candidate.eventKind === "business_human_echo_media_unsupported" ||
    candidate.eventKind === "history_business_human_message"
  ) {
    const actor = resolveBusinessActor(state, accountBinding.id, accountBinding.attributionPolicy);
    if (!actor) {
      return quarantine("unknown_account", ["business_actor_unresolved"]);
    }

    return routed({
      finalEventKind: candidate.eventKind,
      accountBindingId: accountBinding.id,
      clientId: client.id,
      conversationId: conversation.id,
      actorType: actor.actorType,
      actorBindingId: actor.actorBindingId,
      authorInterface: "whatsapp_business_surface",
      actorResolutionBasis: actor.actorResolutionBasis,
    });
  }

  return quarantine("unsupported_event", ["unrouted_event_kind"]);
}

function resolveAccountBinding(state: ManuAppState, candidate: RawChannelEventCandidate) {
  return (
    state.channelAccountBindings.find((binding) => {
      if (binding.lifecycleStatus !== "active") return false;
      if (binding.provider !== "whatsapp_cloud") return false;
      if (candidate.businessPhoneNumberId && binding.businessPhoneNumberId === candidate.businessPhoneNumberId) return true;
      if (candidate.wabaId && binding.wabaId === candidate.wabaId) return true;
      if (candidate.providerAccountId && binding.providerAccountId === candidate.providerAccountId) return true;
      return false;
    }) ?? null
  );
}

function resolveClientMatches(state: ManuAppState, candidate: RawChannelEventCandidate) {
  if (!candidate.counterpartyIdentity) {
    return [];
  }

  const normalized = normalizeChannelIdentityForMatching("whatsapp", candidate.counterpartyIdentity);
  if (!normalized) {
    return [];
  }

  return state.clients.filter(
    (client) => client.channel === "whatsapp" && normalizeChannelIdentityForMatching("whatsapp", client.channelUserId) === normalized,
  );
}

function resolveBusinessActor(
  state: ManuAppState,
  accountBindingId: string,
  attributionPolicy: "exclusive_dietitian" | "shared_authorized_team",
) {
  const now = Date.now();
  const activeBindings = state.channelActorBindings.filter(
    (binding) =>
      binding.accountBindingId === accountBindingId &&
      !binding.revokedAt &&
      (!binding.validTo || new Date(binding.validTo).getTime() > now),
  );

  if (attributionPolicy === "exclusive_dietitian") {
    const exclusive = activeBindings.find((binding) => binding.actorType === "exact_dietitian" && binding.dietitianId);
    if (!exclusive) {
      return null;
    }
    return {
      actorType: "exact_dietitian" as const,
      actorBindingId: exclusive.id,
      actorResolutionBasis: "exclusive_verified_account" as const,
    };
  }

  const shared = activeBindings.find((binding) => binding.actorType === "business_operator");
  if (!shared) {
    return null;
  }
  return {
    actorType: "business_operator" as const,
    actorBindingId: shared.id,
    actorResolutionBasis: "shared_authorized_team" as const,
  };
}

function findClientIdForConversation(state: ManuAppState, conversationId: string) {
  return state.conversations.find((item) => item.id === conversationId)?.clientId ?? null;
}

function inferActorTypeFromSender(sender: string): ChannelActorType {
  if (sender === "client") return "client";
  if (sender === "dietitian") return "exact_dietitian";
  if (sender === "assistant") return "ai";
  return "system";
}

function quarantine(finalEventKind: ChannelEventKind, quarantineReasons: string[]): ChannelEventQuarantineOutcome {
  return { status: "quarantined", finalEventKind, quarantineReasons };
}

function routed(outcome: Omit<ChannelEventRoutedOutcome, "status">): ChannelEventRoutedOutcome {
  return { status: "routed", ...outcome };
}
