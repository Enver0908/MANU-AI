import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { resetRateLimits } from "./rate-limit";
import {
  expireStaleQuarantinedChannelEvents,
  processInboundWhatsAppChannelBatch,
  replayQuarantinedChannelEvent,
  resolveSecureChannelIngressGate,
} from "./phase-85-if-c-channel-event-ledger";
import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelAccountBindingRecord, ManuAppState } from "./types";

const TEST_SECRET = "synthetic-ifc-test-secret";

function testEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    ...overrides,
  } as NodeJS.ProcessEnv;
}

function buildAccountBinding(overrides: Partial<ChannelAccountBindingRecord> = {}): ChannelAccountBindingRecord {
  return {
    id: "account-binding-1",
    tenantId: DEMO_TENANT_ID,
    provider: "whatsapp_cloud",
    providerAccountId: "SYNTHETIC_PHONE_1",
    wabaId: "SYNTHETIC_WABA_1",
    businessPhoneNumberId: "SYNTHETIC_PHONE_1",
    normalizedDisplayNumber: null,
    operatingMode: "mock",
    lifecycleStatus: "active",
    attributionPolicy: "shared_authorized_team",
    verifiedAt: "2024-06-01T00:00:00.000Z",
    revokedAt: null,
    createdByDietitianId: null,
    revokedByDietitianId: null,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function stateWithBinding(): ManuAppState {
  const state = createInitialState();
  return { ...state, channelAccountBindings: [buildAccountBinding()] };
}

function directTextPayload(providerEventId: string, from = "905551110001", body = "Bugun ne yiyebilirim?") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [{ from, id: providerEventId, timestamp: "1720000000", type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

describe("phase 85 if-c secure channel ingress gate", () => {
  it("requires feature gate, secret, and refuses production/hosted execution", () => {
    expect(resolveSecureChannelIngressGate(testEnv(), TEST_SECRET).enabled).toBe(true);
    expect(resolveSecureChannelIngressGate(testEnv({ NODE_ENV: "production" }), TEST_SECRET).enabled).toBe(false);
    expect(resolveSecureChannelIngressGate(testEnv({ MANU_HOSTED_SANDBOX_ACTIVE: "true" }), TEST_SECRET).enabled).toBe(false);
    expect(resolveSecureChannelIngressGate(testEnv({ MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "false" }), TEST_SECRET).enabled).toBe(false);
    expect(resolveSecureChannelIngressGate(testEnv({ MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: undefined }), TEST_SECRET).enabled).toBe(false);
    expect(resolveSecureChannelIngressGate(testEnv(), "wrong-secret").enabled).toBe(false);
    expect(resolveSecureChannelIngressGate(testEnv(), null).enabled).toBe(false);
  });
});

describe("phase 85 if-c channel event ledger", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("rejects ingestion when the secure gate is disabled without touching state", async () => {
    const state = stateWithBinding();
    const { state: next, result } = await processInboundWhatsAppChannelBatch(state, directTextPayload("wamid.GATE_1"), {
      providedSecret: "wrong-secret",
      env: testEnv(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "secure_ingress_gate_disabled") {
      expect(result.blockingReasons).toContain("mock_webhook_secret_mismatch");
    }
    expect(next.channelEvents).toHaveLength(0);
  });

  it("rejects malformed top-level payloads without creating a ledger entry", async () => {
    const state = stateWithBinding();
    const { state: next, result } = await processInboundWhatsAppChannelBatch(
      state,
      { object: "telegram_bot_update", entry: [] },
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("malformed_payload");
    }
    expect(next.channelEvents).toHaveLength(0);
  });

  it("commits a resolvable client message and delegates to the existing orchestrator path", async () => {
    const state = stateWithBinding();
    const { state: next, result } = await processInboundWhatsAppChannelBatch(state, directTextPayload("wamid.COMMIT_1"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].event.processingStatus).toBe("committed");
    expect(result.outcomes[0].event.eventKind).toBe("client_message_text");
    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.processedSimulationKeys).toContain("wamid.COMMIT_1");
  });

  it("quarantines an event and records an audit trail when no client matches", async () => {
    const state = stateWithBinding();
    const { state: next, result } = await processInboundWhatsAppChannelBatch(
      state,
      directTextPayload("wamid.QUARANTINE_1", "905559999999"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.outcomes[0].event.processingStatus).toBe("quarantined");
    expect(result.outcomes[0].event.eventKind).toBe("unknown_client");
    expect(next.auditEvents.some((event) => event.eventType === "channel_event_quarantined")).toBe(true);
  });

  it("marks a repeated provider event id as duplicate without a second orchestrator run", async () => {
    const state = stateWithBinding();
    const first = await processInboundWhatsAppChannelBatch(state, directTextPayload("wamid.DUP_1"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
    });
    expect(first.result.ok).toBe(true);

    const second = await processInboundWhatsAppChannelBatch(first.state, directTextPayload("wamid.DUP_1"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
    });

    expect(second.result.ok).toBe(true);
    if (!second.result.ok) return;
    expect(second.state.channelEvents.filter((event) => event.providerEventId === "wamid.DUP_1")).toHaveLength(1);
    expect(second.state.auditEvents.some((event) => event.eventType === "channel_event_duplicate")).toBe(true);
  });

  it("replays a quarantined event successfully once the trust binding becomes available", () => {
    let state = stateWithBinding();
    state = { ...state, channelAccountBindings: [] };

    const candidate: RawChannelEventCandidate = {
      eventKind: "client_message_text",
      wabaId: "SYNTHETIC_WABA_1",
      businessPhoneNumberId: "SYNTHETIC_PHONE_1",
      providerAccountId: "SYNTHETIC_PHONE_1",
      providerEventId: "wamid.REPLAY_1",
      providerMessageId: null,
      fromIdentity: "905551110001",
      toIdentity: "SYNTHETIC_PHONE_1",
      counterpartyIdentity: "905551110001",
      body: "replay body",
      messageType: "text",
      providerTime: "2024-07-01T10:00:00.000Z",
      payloadDigest: "digest",
      malformedReason: null,
    };

    const quarantinedEvent = {
      id: "channel-event-replay-1",
      tenantId: state.tenant.id,
      accountBindingId: null,
      eventKind: "unknown_account" as const,
      processingStatus: "quarantined" as const,
      providerAccountId: candidate.providerAccountId,
      providerEventId: candidate.providerEventId,
      providerMessageId: null,
      fromIdentity: candidate.fromIdentity,
      toIdentity: candidate.toIdentity,
      counterpartyIdentity: candidate.counterpartyIdentity,
      payloadDigest: candidate.payloadDigest,
      payloadSchemaVersion: "p85-if-c-v1",
      providerTime: candidate.providerTime,
      observedAt: new Date().toISOString(),
      committedAt: null,
      quarantineId: null,
      replayOfEventId: null,
      retryCount: 0,
      internalSequence: 1,
    };

    state = { ...state, channelEvents: [quarantinedEvent] };
    const stateWithNowActiveBinding = { ...state, channelAccountBindings: [buildAccountBinding()] };

    const { result } = replayQuarantinedChannelEvent(stateWithNowActiveBinding, quarantinedEvent.id, candidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.processingStatus).toBe("replayed");
      expect(result.event.eventKind).toBe("client_message_text");
      expect(result.event.retryCount).toBe(1);
    }
  });

  it("keeps a still-unresolvable quarantined event quarantined on replay and increments retry count", () => {
    const state = createInitialState();
    const candidate: RawChannelEventCandidate = {
      eventKind: "client_message_text",
      wabaId: "SYNTHETIC_WABA_1",
      businessPhoneNumberId: "SYNTHETIC_PHONE_1",
      providerAccountId: "SYNTHETIC_PHONE_1",
      providerEventId: "wamid.REPLAY_2",
      providerMessageId: null,
      fromIdentity: "905551110001",
      toIdentity: "SYNTHETIC_PHONE_1",
      counterpartyIdentity: "905551110001",
      body: "replay body",
      messageType: "text",
      providerTime: "2024-07-01T10:00:00.000Z",
      payloadDigest: "digest",
      malformedReason: null,
    };
    const quarantinedEvent = {
      id: "channel-event-replay-2",
      tenantId: state.tenant.id,
      accountBindingId: null,
      eventKind: "unknown_account" as const,
      processingStatus: "quarantined" as const,
      providerAccountId: candidate.providerAccountId,
      providerEventId: candidate.providerEventId,
      providerMessageId: null,
      fromIdentity: candidate.fromIdentity,
      toIdentity: candidate.toIdentity,
      counterpartyIdentity: candidate.counterpartyIdentity,
      payloadDigest: candidate.payloadDigest,
      payloadSchemaVersion: "p85-if-c-v1",
      providerTime: candidate.providerTime,
      observedAt: new Date().toISOString(),
      committedAt: null,
      quarantineId: null,
      replayOfEventId: null,
      retryCount: 0,
      internalSequence: 1,
    };

    const withEvent = { ...state, channelEvents: [quarantinedEvent] };
    const { result } = replayQuarantinedChannelEvent(withEvent, quarantinedEvent.id, candidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.processingStatus).toBe("quarantined");
      expect(result.event.retryCount).toBe(1);
    }
  });

  it("expires a quarantined event past the seven-day mock replay window instead of replaying it", () => {
    const state = createInitialState();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const quarantinedEvent = {
      id: "channel-event-expired-1",
      tenantId: state.tenant.id,
      accountBindingId: null,
      eventKind: "unknown_account" as const,
      processingStatus: "quarantined" as const,
      providerAccountId: "SYNTHETIC_PHONE_1",
      providerEventId: "wamid.EXPIRE_1",
      providerMessageId: null,
      fromIdentity: "905551110001",
      toIdentity: "SYNTHETIC_PHONE_1",
      counterpartyIdentity: "905551110001",
      payloadDigest: "digest",
      payloadSchemaVersion: "p85-if-c-v1",
      providerTime: null,
      observedAt: eightDaysAgo,
      committedAt: null,
      quarantineId: null,
      replayOfEventId: null,
      retryCount: 0,
      internalSequence: 1,
    };
    const withEvent = { ...state, channelEvents: [quarantinedEvent] };

    const swept = expireStaleQuarantinedChannelEvents(withEvent);
    expect(swept.channelEvents[0].processingStatus).toBe("expired");
  });
});
