import { beforeEach, describe, expect, it } from "vitest";
import { processMockChannelInbound } from "@/lib/channel-adapters";
import { buildChannelAdapterHealthSignal } from "@/lib/channel-adapter-health";
import {
  setChannelAdapterRollbackInState,
} from "@/lib/channel-adapter-rollback";
import { buildOperationalHealthSnapshot } from "@/lib/operational-health";
import { createInitialState, DEMO_DIETITIAN_ID } from "@/lib/seed-data";
import { resetRateLimits } from "@/lib/rate-limit";
import { runInboundSimulation } from "@/lib/simulator";
import { buildChannelDeliveryRecord, resolveMockChannelDeliveryOutcome } from "@/lib/channel-mock-delivery-ledger";
import type { InboundQuarantineRecord, ManuAppState } from "@/lib/types";

describe("phase 77af adapter operational health and rollback controls", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("aggregates channel adapter health counters without raw message text", () => {
    const state = createInitialState();
    const withSignals: ManuAppState = {
      ...state,
      channelDeliveries: [
        buildChannelDeliveryRecord({
          tenantId: state.tenant.id,
          clientId: "client-mert",
          conversationId: "conversation-client-mert",
          messageId: "message-failed-1",
          channel: "whatsapp",
          outcome: resolveMockChannelDeliveryOutcome({
            channel: "whatsapp",
            mockDeliveryStatus: "failed",
            mockDeliveryFailureCode: "mock_delivery_provider_timeout",
          }),
          now: "2026-06-22T10:00:00.000Z",
        }),
      ],
      inboundQuarantines: [
        {
          id: "quarantine-1",
          tenantId: state.tenant.id,
          channel: "whatsapp",
          sourceConversationType: "group",
          sourceConversationId: "group-1",
          sourceMessageId: "msg-1",
          senderChannelUserId: "+905551119999",
          reason: "whatsapp_group_unsupported",
          createdAt: "2026-06-22T10:00:00.000Z",
        } satisfies InboundQuarantineRecord,
      ],
      auditEvents: [
        ...state.auditEvents,
        {
          id: "audit-dup-1",
          tenantId: state.tenant.id,
          eventType: "channel_duplicate_ignored",
          entityType: "channel_event",
          entityId: "dup-1",
          metadata: { blockedReason: "duplicate_channel_event" },
          createdAt: "2026-06-22T10:00:00.000Z",
        },
        {
          id: "audit-opt-out-1",
          tenantId: state.tenant.id,
          eventType: "channel_permission_opted_out",
          entityType: "client",
          entityId: "client-mert",
          metadata: { source: "test" },
          createdAt: "2026-06-22T10:00:00.000Z",
        },
        {
          id: "audit-gate-1",
          tenantId: state.tenant.id,
          eventType: "channel_policy_outbound_blocked",
          entityType: "channel_event",
          entityId: "gate-1",
          metadata: { blockedReason: "channel_policy_service_window_closed" },
          createdAt: "2026-06-22T10:00:00.000Z",
        },
      ],
    };

    const signal = buildChannelAdapterHealthSignal(withSignals);
    const snapshot = buildOperationalHealthSnapshot(withSignals, { now: "2026-06-22T12:00:00.000Z" });
    const json = JSON.stringify(snapshot);

    expect(signal).toMatchObject({
      channelMockDeliveryFailureCount: 1,
      channelQuarantineCount: 1,
      channelDuplicateIgnoredCount: 1,
      channelOptOutCount: 1,
      channelGateBlockedCount: 1,
    });
    expect(snapshot.channelAutomationRollbackActiveScopeCount).toBe(0);
    expect(json).not.toContain("mock_delivery_provider_timeout");
    expect(json).not.toContain("Alerjiden nefes alamiyorum");
    expect(json).not.toContain("+905551110001");
  });

  it("blocks inbound channel automation when global rollback is active", async () => {
    const state = setChannelAdapterRollbackInState(createInitialState(), {
      scope: "global",
      disabled: true,
      reason: "manual_adapter_rollback",
    });
    const sentBefore = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-rollback-global-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });

    const sentAfter = next.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_automation_rollback_global");
    expect(sentAfter).toBe(sentBefore);
  });

  it("blocks channel automation when client rollback is active", async () => {
    const state = setChannelAdapterRollbackInState(createInitialState(), {
      scope: "client",
      targetId: "client-mert",
      disabled: true,
      reason: "client_channel_incident",
    });
    const sentBefore = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun ogle yemeginde ne yiyebilirim?",
      idempotencyKey: "rollback-client-outbound",
      channel: "whatsapp",
    });

    const sentAfter = next.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_automation_rollback_client");
    expect(sentAfter).toBe(sentBefore);
  });

  it("blocks dietitian-scoped clients when dietitian rollback is active", async () => {
    const state = setChannelAdapterRollbackInState(createInitialState(), {
      scope: "dietitian",
      targetId: DEMO_DIETITIAN_ID,
      disabled: true,
      reason: "dietitian_channel_pause",
    });

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-rollback-dietitian-1",
      channelUserId: "+905551110001",
      body: "Bugun aksam yemeginde ne yiyebilirim?",
    });

    expect(next.lastSimulation?.blockedReason).toBe("channel_automation_rollback_dietitian");
  });

  it("records active rollback scopes in operational health", () => {
    const state = setChannelAdapterRollbackInState(
      setChannelAdapterRollbackInState(createInitialState(), {
        scope: "tenant",
        disabled: true,
        reason: "tenant_pause",
      }),
      {
        scope: "client",
        targetId: "client-mert",
        disabled: true,
        reason: "client_pause",
      },
    );

    const snapshot = buildOperationalHealthSnapshot(state, { now: "2026-06-22T12:00:00.000Z" });
    expect(snapshot.channelAutomationRollbackActiveScopeCount).toBe(2);
  });

  it("re-enables channel automation when rollback is cleared", async () => {
    const rolledBack = setChannelAdapterRollbackInState(createInitialState(), {
      scope: "global",
      disabled: true,
      reason: "temporary_pause",
    });
    const cleared = setChannelAdapterRollbackInState(rolledBack, {
      scope: "global",
      disabled: false,
      reason: "resume",
    });

    const next = await processMockChannelInbound(cleared, {
      channel: "whatsapp",
      providerEventId: "wa-rollback-cleared-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });

    expect(next.lastSimulation?.action).toBe("sent");
  });
});
