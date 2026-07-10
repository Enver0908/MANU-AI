import { describe, expect, it } from "vitest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { routeChannelEvent } from "./phase-85-if-c-channel-event-routing";
import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelAccountBindingRecord, ChannelActorBindingRecord, ManuAppState } from "./types";

function baseCandidate(overrides: Partial<RawChannelEventCandidate>): RawChannelEventCandidate {
  return {
    eventKind: "client_message_text",
    wabaId: "SYNTHETIC_WABA_1",
    businessPhoneNumberId: "SYNTHETIC_PHONE_1",
    providerAccountId: "SYNTHETIC_PHONE_1",
    providerEventId: "wamid.ROUTING_TEST_1",
    providerMessageId: null,
    fromIdentity: "905551110001",
    toIdentity: "SYNTHETIC_PHONE_1",
    counterpartyIdentity: "905551110001",
    body: "test body",
    messageType: "text",
    providerTime: "2024-07-01T10:00:00.000Z",
    payloadDigest: "test-digest",
    malformedReason: null,
    ...overrides,
  };
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

function buildActorBinding(overrides: Partial<ChannelActorBindingRecord> = {}): ChannelActorBindingRecord {
  return {
    id: "actor-binding-1",
    tenantId: DEMO_TENANT_ID,
    accountBindingId: "account-binding-1",
    dietitianId: null,
    actorType: "business_operator",
    attributionBasis: "shared_authorized_team",
    validFrom: "2024-06-01T00:00:00.000Z",
    validTo: null,
    verifiedAt: "2024-06-01T00:00:00.000Z",
    revokedAt: null,
    createdByDietitianId: null,
    revokedByDietitianId: null,
    auditReasonCode: null,
    createdAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function stateWithBinding(binding: ChannelAccountBindingRecord, actorBindings: ChannelActorBindingRecord[] = []): ManuAppState {
  const state = createInitialState();
  return { ...state, channelAccountBindings: [binding], channelActorBindings: actorBindings };
}

describe("phase 85 if-c channel event routing", () => {
  it("quarantines unknown_account when no active binding matches the provider account", () => {
    const state = createInitialState();
    const outcome = routeChannelEvent(state, baseCandidate({}));
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("unknown_account");
    }
  });

  it("quarantines unknown_client when counterparty does not match any client", () => {
    const state = stateWithBinding(buildAccountBinding());
    const outcome = routeChannelEvent(
      state,
      baseCandidate({ fromIdentity: "905559999999", counterpartyIdentity: "905559999999" }),
    );
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("unknown_client");
    }
  });

  it("quarantines ambiguous_client when multiple clients match the same counterparty", () => {
    const state = stateWithBinding(buildAccountBinding());
    const duplicated: ManuAppState = {
      ...state,
      clients: [...state.clients, { ...state.clients[0], id: "client-mert-duplicate" }],
    };
    const outcome = routeChannelEvent(duplicated, baseCandidate({}));
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("ambiguous_client");
    }
  });

  it("quarantines cross_tenant_collision when the matched client belongs to a different tenant", () => {
    const state = stateWithBinding(buildAccountBinding());
    const mismatched: ManuAppState = {
      ...state,
      clients: state.clients.map((client) => (client.id === "client-mert" ? { ...client, tenantId: "tenant-other" } : client)),
    };
    const outcome = routeChannelEvent(mismatched, baseCandidate({}));
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("cross_tenant_collision");
    }
  });

  it("routes a direct client message once tenant, client, actor, and conversation resolve", () => {
    const state = stateWithBinding(buildAccountBinding());
    const outcome = routeChannelEvent(state, baseCandidate({}));
    expect(outcome.status).toBe("routed");
    if (outcome.status === "routed") {
      expect(outcome.finalEventKind).toBe("client_message_text");
      expect(outcome.clientId).toBe("client-mert");
      expect(outcome.actorType).toBe("client");
      expect(outcome.authorInterface).toBe("client_channel");
    }
  });

  it("routes a shared-account business human echo to a business_operator actor", () => {
    const binding = buildAccountBinding({ attributionPolicy: "shared_authorized_team" });
    const state = stateWithBinding(binding, [buildActorBinding({ actorType: "business_operator" })]);
    const outcome = routeChannelEvent(
      state,
      baseCandidate({ eventKind: "business_human_echo_text", providerEventId: "wamid.ECHO_1" }),
    );
    expect(outcome.status).toBe("routed");
    if (outcome.status === "routed") {
      expect(outcome.actorType).toBe("business_operator");
      expect(outcome.actorResolutionBasis).toBe("shared_authorized_team");
      expect(outcome.authorInterface).toBe("whatsapp_business_surface");
    }
  });

  it("does not fabricate an exact dietitian for an exclusive account with no verified actor binding", () => {
    const binding = buildAccountBinding({ attributionPolicy: "exclusive_dietitian" });
    const state = stateWithBinding(binding, []);
    const outcome = routeChannelEvent(
      state,
      baseCandidate({ eventKind: "business_human_echo_text", providerEventId: "wamid.ECHO_2" }),
    );
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("unknown_account");
    }
  });

  it("resolves an exclusive verified dietitian actor for exclusive accounts", () => {
    const binding = buildAccountBinding({ attributionPolicy: "exclusive_dietitian" });
    const state = stateWithBinding(binding, [
      buildActorBinding({ actorType: "exact_dietitian", dietitianId: "dietitian-ayse", attributionBasis: "exclusive_verified_account" }),
    ]);
    const outcome = routeChannelEvent(
      state,
      baseCandidate({ eventKind: "business_human_echo_text", providerEventId: "wamid.ECHO_3" }),
    );
    expect(outcome.status).toBe("routed");
    if (outcome.status === "routed") {
      expect(outcome.actorType).toBe("exact_dietitian");
      expect(outcome.actorResolutionBasis).toBe("exclusive_verified_account");
    }
  });

  it("quarantines message_edit as message_revision_unknown_target when the original message is missing", () => {
    const state = stateWithBinding(buildAccountBinding());
    const outcome = routeChannelEvent(
      state,
      baseCandidate({ eventKind: "message_edit", providerEventId: "wamid.EDIT_1", providerMessageId: "wamid.NEVER_SEEN" }),
    );
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.finalEventKind).toBe("message_revision_unknown_target");
    }
  });

  it("routes message_edit to the original message's actor when the target is known", () => {
    const state = stateWithBinding(buildAccountBinding());
    const targetMessageId = state.messages.find((message) => message.conversationId === "conversation-client-mert" && message.sender === "client")?.id;
    expect(targetMessageId).toBeDefined();

    const withProviderMessage: ManuAppState = {
      ...state,
      messages: state.messages.map((message) =>
        message.id === targetMessageId
          ? { ...message, providerMessageId: "wamid.ORIGINAL_1", providerAccountBindingId: "account-binding-1" }
          : message,
      ),
    };

    const outcome = routeChannelEvent(
      withProviderMessage,
      baseCandidate({ eventKind: "message_edit", providerEventId: "wamid.EDIT_2", providerMessageId: "wamid.ORIGINAL_1" }),
    );
    expect(outcome.status).toBe("routed");
    if (outcome.status === "routed") {
      expect(outcome.finalEventKind).toBe("message_edit");
      expect(outcome.actorType).toBe("client");
    }
  });

  it("routes outbound_status by correlating to the existing outbound message without creating a transcript entry", () => {
    const state = stateWithBinding(buildAccountBinding());
    const outboundMessageId = state.messages.find((message) => message.conversationId === "conversation-client-mert" && message.sender === "assistant")?.id;
    expect(outboundMessageId).toBeDefined();

    const withProviderMessage: ManuAppState = {
      ...state,
      messages: state.messages.map((message) =>
        message.id === outboundMessageId
          ? { ...message, providerMessageId: "wamid.OUTBOUND_1", providerAccountBindingId: "account-binding-1" }
          : message,
      ),
    };

    const outcome = routeChannelEvent(
      withProviderMessage,
      baseCandidate({
        eventKind: "outbound_status",
        providerEventId: "wamid.OUTBOUND_1:delivered",
        providerMessageId: "wamid.OUTBOUND_1",
        body: null,
      }),
    );
    expect(outcome.status).toBe("routed");
    if (outcome.status === "routed") {
      expect(outcome.actorType).toBe("system");
      expect(outcome.authorInterface).toBe("system");
    }
  });

  it("keeps two tenants with the same client phone isolated by provider account binding", () => {
    const tenantAState = stateWithBinding(
      buildAccountBinding({
        id: "tenant-a-binding",
        wabaId: "WABA_TENANT_A",
        businessPhoneNumberId: "PHONE_TENANT_A",
        providerAccountId: "PHONE_TENANT_A",
      }),
    );
    const tenantBBinding = buildAccountBinding({
      id: "tenant-b-binding",
      wabaId: "WABA_TENANT_B",
      businessPhoneNumberId: "PHONE_TENANT_B",
      providerAccountId: "PHONE_TENANT_B",
    });
    const tenantBState: ManuAppState = {
      ...createInitialState(),
      channelAccountBindings: [tenantBBinding],
    };

    const candidateForTenantA = baseCandidate({
      wabaId: "WABA_TENANT_A",
      businessPhoneNumberId: "PHONE_TENANT_A",
      providerAccountId: "PHONE_TENANT_A",
    });

    const outcomeA = routeChannelEvent(tenantAState, candidateForTenantA);
    expect(outcomeA.status).toBe("routed