import { runInboundSimulation, updateClientInState } from "./simulator";
import { assertRateLimit, RATE_LIMITS } from "./rate-limit";
import { normalizeE164Phone } from "./languages";
import { evaluateChannelAutomationRollback } from "./channel-adapter-rollback";
import { isChannelOptOutCommand } from "./whatsapp-channel-policy-mock";
import type { AuditEventRecord, Channel, ManuAppState, SimulationRequest } from "./types";

export type NormalizedInboundChannelEvent = {
  channel: Channel;
  providerEventId: string;
  channelUserId: string;
  body: string;
  receivedAt?: string;
  sourceConversationType?: "direct" | "group";
  sourceConversationId?: string;
  sourceMessageId?: string;
  messageType?: "text" | "unsupported_media" | "unknown";
  channelPolicyMock?: SimulationRequest["channelPolicyMock"];
};

export type ProviderMetadataInput = Record<string, unknown>;

const SENSITIVE_METADATA_KEYS = new Set([
  "body",
  "message",
  "rawMessage",
  "prompt",
  "healthProfile",
  "dietPlan",
  "allergies",
  "restrictedFoods",
  "clinicalRiskNotes",
  "pinnedNotes",
  "memory",
]);
export async function processMockChannelInbound(
  state: ManuAppState,
  event: NormalizedInboundChannelEvent,
): Promise<ManuAppState> {
  const providerEventId = event.providerEventId.trim();
  const trimmedBody = event.body.trim();

  if (!providerEventId) {
    return blockChannelPolicyEvent(state, event, "missing-provider-event-id", "channel_policy_missing_provider_event_id", [
      "provider_event_id_required",
    ]);
  }

  if (state.processedSimulationKeys.includes(providerEventId)) {
    return {
      ...state,
      auditEvents: [
        ...state.auditEvents,
        buildAuditEvent(state, {
          eventType: "channel_duplicate_ignored",
          entityId: providerEventId,
          metadata: { blockedReason: "duplicate_channel_event", channel: event.channel },
        }),
      ],
      lastSimulation: {
        action: "duplicate_ignored",
        risk: null,
        model: null,
        blockedReason: "duplicate_channel_event",
        reasons: ["provider_event_id_already_processed"],
        draft: null,
        decisionId: null,
      },
    };
  }

  if (event.sourceConversationType === "group") {
    await assertRateLimit({
      key: `channel:${event.channel}:${event.channelUserId.trim() || "unknown"}`,
      tenantId: state.tenant.id,
      ...RATE_LIMITS.channelInbound,
    });

    return runInboundSimulation(state, buildChannelSimulationRequest(event, trimmedBody));
  }

  if (!trimmedBody) {
    return blockChannelPolicyEvent(state, event, providerEventId, "channel_policy_empty_body", ["body_required"], true);
  }

  await assertRateLimit({
    key: `channel:${event.channel}:${event.channelUserId.trim() || "unknown"}`,
    tenantId: state.tenant.id,
    ...RATE_LIMITS.channelInbound,
  });

  const matches = findClientsByChannelIdentity(state, event.channel, event.channelUserId);

  if (matches.length !== 1) {
    return quarantineChannelEvent(state, event, providerEventId, matches.length > 1 ? "ambiguous" : "unknown");
  }

  if (matches[0].channelPermission === "opted_out" && isChannelOptOutCommand(trimmedBody)) {
    return blockChannelPolicyEvent(
      state,
      event,
      providerEventId,
      "channel_policy_opt_out_already_applied",
      ["client_already_opted_out"],
      true,
    );
  }

  if (isChannelOptOutCommand(trimmedBody)) {
    const optedOutState = updateClientInState(state, matches[0].id, { channelPermission: "opted_out" });
    return blockChannelPolicyEvent(
      optedOutState,
      event,
      providerEventId,
      "channel_policy_opt_out_received",
      ["explicit_channel_opt_out_command"],
      true,
    );
  }

  const rollback = evaluateChannelAutomationRollback(state, matches[0]);
  if (rollback) {
    return blockChannelPolicyEvent(
      state,
      event,
      providerEventId,
      rollback.blockedReason,
      [rollback.blockedReason],
      true,
    );
  }

  return runInboundSimulation(state, {
    clientId: matches[0].id,
    ...buildChannelSimulationRequest(event, trimmedBody),
  });
}

export function normalizeChannelIdentityForMatching(channel: Channel, channelUserId: string) {
  const trimmed = channelUserId.trim();
  if (!trimmed) {
    return "";
  }

  if (channel === "whatsapp") {
    const candidate = trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/\D/g, "")}`;
    return normalizeE164Phone(candidate) || trimmed;
  }

  return trimmed;
}

export function buildProviderMetadata(input: ProviderMetadataInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => !SENSITIVE_METADATA_KEYS.has(key) && isSafeMetadataValue(value)),
  );
}

function findClientsByChannelIdentity(state: ManuAppState, channel: Channel, channelUserId: string) {
  const normalizedIdentity = normalizeChannelIdentityForMatching(channel, channelUserId);
  if (!normalizedIdentity) {
    return [];
  }

  return state.clients.filter(
    (client) =>
      client.channel === channel &&
      normalizeChannelIdentityForMatching(channel, client.channelUserId) === normalizedIdentity,
  );
}

function buildChannelSimulationRequest(event: NormalizedInboundChannelEvent, body: string) {
  return {
    body,
    idempotencyKey: event.providerEventId,
    channel: event.channel,
    sourceConversationType: event.sourceConversationType ?? ("direct" as const),
    sourceConversationId: event.sourceConversationId,
    sourceMessageId: event.sourceMessageId ?? event.providerEventId,
    senderChannelUserId: event.channelUserId,
    now: event.receivedAt,
    channelPolicyMock: event.channelPolicyMock,
  };
}

function quarantineChannelEvent(
  state: ManuAppState,
  event: NormalizedInboundChannelEvent,
  idempotencyKey: string,
  kind: "unknown" | "ambiguous",
): ManuAppState {
  const reason =
    kind === "ambiguous" ? "identity_quarantine_ambiguous_channel_identity" : "identity_quarantine_unknown_channel_identity";

  return {
    ...state,
    processedSimulationKeys: [...state.processedSimulationKeys, idempotencyKey],
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, {
        eventType: "channel_identity_quarantined",
        entityId: idempotencyKey,
        metadata: {
          channel: event.channel,
          providerEventId: event.providerEventId,
          channelUserIdPresent: Boolean(event.channelUserId.trim()),
          reason,
        },
      }),
    ],
    lastSimulation: {
      action: "no_ai",
      risk: null,
      model: null,
      blockedReason: reason,
      reasons: [kind === "ambiguous" ? "multiple_clients_match_channel_identity" : "no_client_matches_channel_identity"],
      draft: null,
      decisionId: null,
    },
  };
}

function blockChannelPolicyEvent(
  state: ManuAppState,
  event: NormalizedInboundChannelEvent,
  entityId: string,
  blockedReason: string,
  reasons: string[],
  markProcessed = false,
): ManuAppState {
  return {
    ...state,
    processedSimulationKeys: markProcessed ? [...state.processedSimulationKeys, entityId] : state.processedSimulationKeys,
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent(state, {
        eventType: "channel_policy_blocked",
        entityId,
        metadata: {
          channel: event.channel,
          providerEventIdPresent: Boolean(event.providerEventId.trim()),
          bodyPresent: Boolean(event.body.trim()),
          reason: blockedReason,
        },
      }),
    ],
    lastSimulation: {
      action: "no_ai",
      risk: null,
      model: null,
      blockedReason,
      reasons,
      draft: null,
      decisionId: null,
    },
  };
}

function buildAuditEvent(
  state: ManuAppState,
  input: { eventType: string; entityId: string; metadata: Record<string, unknown> },
): AuditEventRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType: input.eventType,
    entityType: "channel_event",
    entityId: input.entityId,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
}

function isSafeMetadataValue(value: unknown) {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  return false;
}
