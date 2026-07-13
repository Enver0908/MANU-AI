import type {
  ChannelActorAttributionBasis,
  ChannelActorType,
  ChannelAuthorInterface,
  ChannelEventKind,
  MessageRecord,
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
  accountBindingId: string | null;
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

  const accountResolution = resolveAccountBinding(state, candidate);
  if (accountResolution.status === "unresolved") {
    return quarantine("unknown_account", accountResolution.reasons);
  }
  const accountBinding = accountResolution.binding;

  if (accountBinding.tenantId !== state.tenant.id) {
    return quarantine("cross_tenant_collision", ["account_binding_tenant_mismatch"], accountBinding.id);
  }

  if (candidate.eventKind === "outbound_status") {
    const message = state.messages.find(
      (item) =>
        item.tenantId === accountBinding.tenantId &&
        item.providerMessageId === candidate.providerMessageId &&
        item.providerAccountBindingId === accountBinding.id,
    );
    if (!message) {
      return quarantine("message_revision_unknown_target", ["outbound_status_unknown_target_message"], accountBinding.id);
    }
    const messageContext = resolveMessageContext(state, message, accountBinding.tenantId);
    if (!messageContext) {
      return quarantine("cross_tenant_collision", ["outbound_status_target_context_mismatch"], accountBinding.id);
    }

    return routed({
      finalEventKind: "outbound_status",
      accountBindingId: accountBinding.id,
      clientId: messageContext.clientId,
      conversationId: messageContext.conversationId,
      actorType: "system",
      actorBindingId: null,
      authorInterface: "system",
      actorResolutionBasis: "system_operation",
    });
  }

  if (candidate.eventKind === "message_edit" || candidate.eventKind === "message_revoke") {
    const targetMessage = state.messages.find(
      (item) =>
        item.tenantId === accountBinding.tenantId &&
        item.providerMessageId === candidate.providerMessageId &&
        item.providerAccountBindingId === accountBinding.id,
    );
    if (!targetMessage) {
      return quarantine("message_revision_unknown_target", ["revision_unknown_target_message"], accountBinding.id);
    }
    const messageContext = resolveMessageContext(state, targetMessage, accountBinding.tenantId);
    if (!messageContext) {
      return quarantine("cross_tenant_collision", ["revision_target_context_mismatch"], accountBinding.id);
    }
    const targetActor = resolveTargetMessageActor(targetMessage);

    return routed({
      finalEventKind: candidate.eventKind,
      accountBindingId: accountBinding.id,
      clientId: messageContext.clientId,
      conversationId: messageContext.conversationId,
      actorType: targetActor.actorType,
      actorBindingId: targetMessage.actorBindingId ?? null,
      authorInterface: targetActor.authorInterface,
      actorResolutionBasis: targetActor.actorResolutionBasis,
    });
  }

  const allClientMatches = resolveClientMatches(state, candidate);
  const clientMatches = allClientMatches.filter((client) => client.tenantId === accountBinding.tenantId);
  if (clientMatches.length === 0 && allClientMatches.length > 0) {
    return quarantine("cross_tenant_collision", ["counterparty_matches_other_tenant_only"], accountBinding.id);
  }
  if (clientMatches.length === 0) {
    return quarantine("unknown_client", ["no_client_matches_counterparty"], accountBinding.id);
  }
  if (clientMatches.length > 1) {
    return quarantine("ambiguous_client", ["multiple_tenant_clients_match_counterparty"], accountBinding.id);
  }

  const client = clientMatches[0];

  if (client.tenantId !== state.tenant.id) {
    return quarantine("cross_tenant_collision", ["client_tenant_mismatch"], accountBinding.id);
  }

  if (client.lifecycleStatus === "removed_anonymized") {
    return quarantine("unknown_client", ["client_removed_anonymized"], accountBinding.id);
  }

  if (client.channel !== "whatsapp") {
    return quarantine("unknown_client", ["client_channel_mismatch"], accountBinding.id);
  }

  if (!new Set(["ready", "pending", "blocked", "opted_out"]).has(client.channelPermission)) {
    return quarantine("unknown_client", ["client_channel_permission_invalid"], accountBinding.id);
  }

  const conversation = state.conversations.find(
    (item) =>
      item.tenantId === accountBinding.tenantId &&
      item.clientId === client.id &&
      item.dietitianId === client.dietitianId &&
      item.channel === "whatsapp",
  );
  if (!conversation) {
    return quarantine("unknown_client", ["no_tenant_assignment_matched_conversation"], accountBinding.id);
  }

  if (hasClientBusinessIdentityOverlap(client.channelUserId, candidate, accountBinding.normalizedDisplayNumber)) {
    return quarantine("unknown_account", ["actor_client_identity_overlap"], accountBinding.id);
  }

  if (
    candidate.eventKind === "client_message_text" ||
    candidate.eventKind === "client_message_image" ||
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
      return quarantine("unknown_account", ["business_actor_unresolved"], accountBinding.id);
    }
    if (actor.actorType === "exact_dietitian" && actor.dietitianId !== client.dietitianId) {
      return quarantine("unknown_account", ["exact_dietitian_assignment_mismatch"], accountBinding.id);
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
  const eligibleBindings = state.channelAccountBindings.filter(
    (binding) =>
      binding.provider === "whatsapp_cloud" &&
      binding.operatingMode === "mock" &&
      binding.lifecycleStatus === "active" &&
      Boolean(binding.verifiedAt) &&
      !binding.revokedAt,
  );
  const selectors = [
    candidate.wabaId ? (binding: (typeof eligibleBindings)[number]) => binding.wabaId === candidate.wabaId : null,
    candidate.businessPhoneNumberId
      ? (binding: (typeof eligibleBindings)[number]) => binding.businessPhoneNumberId === candidate.businessPhoneNumberId
      : null,
    candidate.providerAccountId
      ? (binding: (typeof eligibleBindings)[number]) => binding.providerAccountId === candidate.providerAccountId
      : null,
  ].filter((selector): selector is (binding: (typeof eligibleBindings)[number]) => boolean => Boolean(selector));

  if (selectors.length === 0) {
    return { status: "unresolved" as const, reasons: ["provider_account_identifiers_missing"] };
  }

  const matches = eligibleBindings.filter((binding) => selectors.every((selector) => selector(binding)));
  if (matches.length === 1) {
    return { status: "resolved" as const, binding: matches[0] };
  }

  const anySelectorMatch = eligibleBindings.some((binding) => selectors.some((selector) => selector(binding)));
  return {
    status: "unresolved" as const,
    reasons: [matches.length > 1 ? "multiple_active_account_bindings" : anySelectorMatch ? "conflicting_account_binding_identifiers" : "unknown_account_binding"],
  };
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
      binding.tenantId === state.tenant.id &&
      binding.accountBindingId === accountBindingId &&
      Boolean(binding.verifiedAt) &&
      !binding.revokedAt &&
      new Date(binding.validFrom).getTime() <= now &&
      (!binding.validTo || new Date(binding.validTo).getTime() > now),
  );

  if (attributionPolicy === "exclusive_dietitian") {
    const exclusive = activeBindings.filter(
      (binding) =>
        binding.actorType === "exact_dietitian" &&
        binding.attributionBasis === "exclusive_verified_account" &&
        Boolean(binding.dietitianId),
    );
    if (exclusive.length !== 1) {
      return null;
    }
    return {
      actorType: "exact_dietitian" as const,
      actorBindingId: exclusive[0].id,
      actorResolutionBasis: "exclusive_verified_account" as const,
      dietitianId: exclusive[0].dietitianId,
    };
  }

  const shared = activeBindings.filter(
    (binding) => binding.actorType === "business_operator" && binding.attributionBasis === "shared_authorized_team",
  );
  if (shared.length !== 1) {
    return null;
  }
  return {
    actorType: "business_operator" as const,
    actorBindingId: shared[0].id,
    actorResolutionBasis: "shared_authorized_team" as const,
    dietitianId: null,
  };
}

function resolveMessageContext(state: ManuAppState, message: MessageRecord, tenantId: string) {
  const conversation = state.conversations.find(
    (item) => item.id === message.conversationId && item.tenantId === tenantId,
  );
  if (!conversation) return null;
  const client = state.clients.find(
    (item) => item.id === conversation.clientId && item.tenantId === tenantId && item.dietitianId === conversation.dietitianId,
  );
  if (!client) return null;
  return { clientId: client.id, conversationId: conversation.id };
}

function resolveTargetMessageActor(message: MessageRecord): {
  actorType: ChannelActorType;
  authorInterface: ChannelAuthorInterface;
  actorResolutionBasis: ChannelActorAttributionBasis;
} {
  if (message.actorType && message.authorInterface && message.actorResolutionBasis) {
    return {
      actorType: message.actorType,
      authorInterface: message.authorInterface,
      actorResolutionBasis: message.actorResolutionBasis,
    };
  }
  if (message.sender === "client") {
    return { actorType: "client", authorInterface: "client_channel", actorResolutionBasis: "provider_counterparty" };
  }
  if (message.sender === "assistant") {
    return { actorType: "ai", authorInterface: "ai_provider", actorResolutionBasis: "ai_decision" };
  }
  if (message.sender === "system") {
    return { actorType: "system", authorInterface: "system", actorResolutionBasis: "system_operation" };
  }
  return { actorType: "unknown", authorInterface: "unknown", actorResolutionBasis: "imported_unknown" };
}

function hasClientBusinessIdentityOverlap(
  clientIdentity: string,
  candidate: RawChannelEventCandidate,
  normalizedDisplayNumber: string | null,
) {
  const client = normalizeChannelIdentityForMatching("whatsapp", clientIdentity);
  if (!client) return true;
  const isBusinessAuthored =
    candidate.eventKind === "business_human_echo_text" ||
    candidate.eventKind === "business_human_echo_media_unsupported" ||
    candidate.eventKind === "history_business_human_message";
  const businessIdentities = [normalizedDisplayNumber, isBusinessAuthored ? candidate.fromIdentity : null]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeChannelIdentityForMatching("whatsapp", value))
    .filter(Boolean);
  return businessIdentities.includes(client);
}

function quarantine(
  finalEventKind: ChannelEventKind,
  quarantineReasons: string[],
  accountBindingId: string | null = null,
): ChannelEventQuarantineOutcome {
  return { status: "quarantined", finalEventKind, quarantineReasons, accountBindingId };
}

function routed(outcome: Omit<ChannelEventRoutedOutcome, "status">): ChannelEventRoutedOutcome {
  return { status: "routed", ...outcome };
}
