import { runInboundSimulation } from "./simulator";
import type { AuditEventRecord, Channel, ManuAppState } from "./types";

export type NormalizedInboundChannelEvent = {
  channel: Channel;
  providerEventId: string;
  channelUserId: string;
  body: string;
  receivedAt?: string;
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
  const idempotencyKey = providerEventId || `${event.channel}:missing-provider-event-id`;

  if (state.processedSimulationKeys.includes(idempotencyKey)) {
    return {
      ...state,
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

  const matches = findClientsByChannelIdentity(state, event.channel, event.channelUserId);

  if (matches.length !== 1) {
    return quarantineChannelEvent(state, event, idempotencyKey, matches.length > 1 ? "ambiguous" : "unknown");
  }

  return runInboundSimulation(state, {
    clientId: matches[0].id,
    body: event.body,
    idempotencyKey,
    now: event.receivedAt,
  });
}

export function buildProviderMetadata(input: ProviderMetadataInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => !SENSITIVE_METADATA_KEYS.has(key) && isSafeMetadataValue(value)),
  );
}

function findClientsByChannelIdentity(state: ManuAppState, channel: Channel, channelUserId: string) {
  const normalizedIdentity = channelUserId.trim();
  if (!normalizedIdentity) {
    return [];
  }

  return state.clients.filter(
    (client) => client.channel === channel && client.channelUserId.trim() === normalizedIdentity,
  );
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
