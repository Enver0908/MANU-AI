import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildProviderMetadata, processMockChannelInbound } from "./channel-adapters";
import { resetRateLimits } from "./rate-limit";
import { updateClientInState } from "./simulator";

describe("mock channel adapters", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("routes known WhatsApp events through the simulator path", async () => {
    const next = await processMockChannelInbound(createInitialState(), {
      channel: "whatsapp",
      providerEventId: "wa-known-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      receivedAt: "2026-05-25T12:00:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.lastSimulation?.model).toBe("gemini-1.5-flash");
    expect(next.messages.some((message) => message.sourceMessageId && message.origin === "ai_generated")).toBe(true);
  });

  it("routes known Telegram events through the same simulator path", async () => {
    const next = await processMockChannelInbound(createInitialState(), {
      channel: "telegram",
      providerEventId: "tg-known-1",
      channelUserId: "elif_telegram",
      body: "D vitamini takviyesi kullanayim mi?",
      receivedAt: "2026-05-25T12:01:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("draft_for_approval");
    expect(next.lastSimulation?.risk).toBe("yellow");
    expect(next.lastSimulation?.model).toBe("gemini-3");
  });

  it("quarantines unknown channel identities before messages or decisions are created", async () => {
    const state = createInitialState();
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-unknown-1",
      channelUserId: "+900000000000",
      body: "Merhaba, planim ne olacak?",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("identity_quarantine_unknown_channel_identity");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(next.auditEvents.some((event) => event.eventType === "channel_identity_quarantined")).toBe(true);
  });

  it("quarantines ambiguous channel identities before the orchestrator path", async () => {
    const state = createInitialState();
    const duplicateClient = {
      ...state.clients[0],
      id: "client-duplicate-mert",
      fullName: "Duplicate Mert",
    };
    const ambiguousState = {
      ...state,
      clients: [...state.clients, duplicateClient],
    };
    const next = await processMockChannelInbound(ambiguousState, {
      channel: "whatsapp",
      providerEventId: "wa-ambiguous-1",
      channelUserId: "+905551110001",
      body: "Bugun ne yemeliyim?",
    });

    expect(next.lastSimulation?.blockedReason).toBe("identity_quarantine_ambiguous_channel_identity");
    expect(next.messages).toHaveLength(ambiguousState.messages.length);
    expect(next.aiDecisions).toHaveLength(ambiguousState.aiDecisions.length);
  });

  it("does not duplicate-send duplicate provider events", async () => {
    const first = await processMockChannelInbound(createInitialState(), {
      channel: "whatsapp",
      providerEventId: "wa-duplicate-1",
      channelUserId: "+905551110001",
      body: "Ara ogun icin ne yiyebilirim?",
    });
    const second = await processMockChannelInbound(first, {
      channel: "whatsapp",
      providerEventId: "wa-duplicate-1",
      channelUserId: "+905551110001",
      body: "Ara ogun icin ne yiyebilirim?",
    });

    expect(second.lastSimulation?.action).toBe("duplicate_ignored");
    expect(second.messages).toHaveLength(first.messages.length);
    expect(second.aiDecisions).toHaveLength(first.aiDecisions.length);
  });

  it("blocks missing provider event ids before client lookup or AI processing", async () => {
    const state = createInitialState();
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "   ",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_missing_provider_event_id");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length);
  });

  it("blocks empty channel bodies before AI processing and marks the provider event processed", async () => {
    const state = createInitialState();
    const next = await processMockChannelInbound(state, {
      channel: "telegram",
      providerEventId: "tg-empty-1",
      channelUserId: "elif_telegram",
      body: "   ",
    });
    const duplicate = await processMockChannelInbound(next, {
      channel: "telegram",
      providerEventId: "tg-empty-1",
      channelUserId: "elif_telegram",
      body: "   ",
    });

    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_empty_body");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length);
    expect(duplicate.lastSimulation?.action).toBe("duplicate_ignored");
  });

  it("handles matched-client opt-out commands without entering the AI path", async () => {
    const state = createInitialState();
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-stop-1",
      channelUserId: "+905551110001",
      body: "STOP",
    });

    expect(next.clients.find((client) => client.id === "client-mert")?.channelPermission).toBe("opted_out");
    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_opt_out_received");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length);
    expect(next.auditEvents.some((event) => event.eventType === "channel_permission_opted_out")).toBe(true);
  });

  it("keeps channel policy audit metadata minimized", async () => {
    const next = await processMockChannelInbound(createInitialState(), {
      channel: "whatsapp",
      providerEventId: "wa-stop-private-1",
      channelUserId: "+905551110001",
      body: "STOP",
    });
    const policyEvent = next.auditEvents.find((event) => event.eventType === "channel_policy_blocked");

    expect(JSON.stringify(policyEvent?.metadata)).not.toContain("STOP");
    expect(JSON.stringify(policyEvent?.metadata)).not.toContain("+905551110001");
    expect(JSON.stringify(policyEvent?.metadata)).not.toContain("Bugun kahvaltida");
  });

  it("keeps permission-blocked clients on the existing safety gate", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "blocked",
    });
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-blocked-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_permission_blocked");
  });

  it("keeps opted-out clients on the existing safety gate", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "opted_out",
    });
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-opted-out-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_permission_opted_out");
  });

  it("rate-limits repeated inbound channel events for the same channel identity", async () => {
    let state = createInitialState();

    for (let index = 0; index < 30; index += 1) {
      state = await processMockChannelInbound(state, {
        channel: "whatsapp",
        providerEventId: `wa-rate-limit-${index}`,
        channelUserId: "+905551110001",
        body: "Bugun ara ogun icin ne yiyebilirim?",
      });
    }

    await expect(
      processMockChannelInbound(state, {
        channel: "whatsapp",
        providerEventId: "wa-rate-limit-over",
        channelUserId: "+905551110001",
        body: "Bugun ara ogun icin ne yiyebilirim?",
      }),
    ).rejects.toMatchObject({ status: 429, message: "rate_limit_exceeded" });
  });

  it("redacts sensitive provider metadata fields", () => {
    const metadata = buildProviderMetadata({
      tenantId: "tenant-manu-demo",
      clientId: "client-mert",
      purpose: "outbound_message",
      body: "raw health message",
      prompt: "full prompt",
      healthProfile: { goal: "fat_loss" },
      dietPlan: { summary: "private" },
      allergies: ["peanut"],
      clinicalRiskNotes: ["private"],
      retryCount: 1,
    });

    expect(metadata).toEqual({
      tenantId: "tenant-manu-demo",
      clientId: "client-mert",
      purpose: "outbound_message",
      retryCount: 1,
    });
  });
});
