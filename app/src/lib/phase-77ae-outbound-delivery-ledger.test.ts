import { beforeEach, describe, expect, it } from "vitest";
import { processMockChannelInbound } from "@/lib/channel-adapters";
import { buildPhase74ExportPackage, applyPhase74TransactionalRedactionInState } from "@/lib/phase-74-data-lifecycle-policy";
import { createInitialState } from "@/lib/seed-data";
import { resetRateLimits } from "@/lib/rate-limit";
import { runInboundSimulation } from "@/lib/simulator";
import {
  buildChannelDeliveryRecord,
  resolveMockChannelDeliveryOutcome,
} from "@/lib/channel-mock-delivery-ledger";

describe("phase 77ae outbound delivery ledger and mock send failures", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("records mock delivered status for allowed WhatsApp AI sends", async () => {
    const state = createInitialState();
    const inboundBody = "Bugun kahvaltida yumurta yerine ne yiyebilirim?";

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-delivery-delivered-1",
      channelUserId: "+905551110001",
      body: inboundBody,
    });

    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.channelDeliveries).toHaveLength(state.channelDeliveries.length + 1);
    expect(next.channelDeliveries.at(-1)).toMatchObject({
      channel: "whatsapp",
      direction: "outbound",
      deliveryStatus: "delivered",
      failureCode: null,
      clientId: "client-mert",
    });
    expect(JSON.stringify(next.channelDeliveries.at(-1))).not.toContain(inboundBody);
    expect(
      next.auditEvents.some(
        (event) =>
          event.eventType === "channel_delivery_mock_recorded" &&
          event.metadata.deliveryStatus === "delivered",
      ),
    ).toBe(true);
  });

  it("records mock sent and failed statuses from channelPolicyMock", () => {
    const sentOutcome = resolveMockChannelDeliveryOutcome({
      channel: "whatsapp",
      mockDeliveryStatus: "sent",
    });
    const failedOutcome = resolveMockChannelDeliveryOutcome({
      channel: "whatsapp",
      mockDeliveryStatus: "failed",
      mockDeliveryFailureCode: "mock_delivery_provider_timeout",
    });

    expect(sentOutcome.deliveryStatus).toBe("sent");
    expect(failedOutcome).toMatchObject({
      deliveryStatus: "failed",
      failureCode: "mock_delivery_provider_timeout",
    });
  });

  it("persists failed mock delivery without message body metadata", async () => {
    const state = createInitialState();
    const inboundBody = "Bugun ogle yemeginde ne yiyebilirim?";

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-delivery-failed-1",
      channelUserId: "+905551110001",
      body: inboundBody,
      channelPolicyMock: {
        mockDeliveryStatus: "failed",
        mockDeliveryFailureCode: "mock_delivery_provider_timeout",
      },
    });

    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.channelDeliveries.at(-1)).toMatchObject({
      deliveryStatus: "failed",
      failureCode: "mock_delivery_provider_timeout",
    });
    expect(JSON.stringify(next.channelDeliveries.at(-1))).not.toContain(inboundBody);
    expect(JSON.stringify(next.auditEvents.at(-2)?.metadata ?? {})).not.toContain(inboundBody);
  });

  it("does not create delivery records for yellow drafts or red handoffs", async () => {
    const state = createInitialState();

    const yellow = await runInboundSimulation(state, {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "phase-77ae-yellow",
      channel: "whatsapp",
    });
    expect(yellow.lastSimulation?.action).toBe("draft_for_approval");
    expect(yellow.channelDeliveries).toHaveLength(state.channelDeliveries.length);

    const red = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "phase-77ae-red",
      channel: "whatsapp",
    });
    expect(red.lastSimulation?.action).toBe("handoff");
    expect(red.channelDeliveries).toHaveLength(state.channelDeliveries.length);
  });

  it("keeps channel delivery records tenant-scoped in state", () => {
    const now = "2026-06-22T10:00:00.000Z";
    const state = createInitialState();
    const otherTenantDelivery = buildChannelDeliveryRecord({
      tenantId: "tenant-other",
      clientId: "client-other",
      conversationId: "conversation-other",
      messageId: "message-other",
      channel: "whatsapp",
      outcome: resolveMockChannelDeliveryOutcome({ channel: "whatsapp" }),
      now,
    });
    const visible = {
      ...state,
      channelDeliveries: [...state.channelDeliveries, otherTenantDelivery],
    };

    expect(visible.channelDeliveries.filter((item) => item.tenantId === state.tenant.id)).toHaveLength(
      state.channelDeliveries.length,
    );
    expect(visible.channelDeliveries.some((item) => item.tenantId === "tenant-other")).toBe(true);
  });

  it("includes minimized channel deliveries in phase 74 export and removes them on DSAR redaction", async () => {
    const state = createInitialState();
    const withDelivery = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-delivery-export-1",
      channelUserId: "+905551110001",
      body: "Bugun aksam yemeginde ne yiyebilirim?",
    });
    const delivery = withDelivery.channelDeliveries.at(-1);
    expect(delivery).toBeTruthy();

    const exportPackage = buildPhase74ExportPackage(withDelivery, "client-mert");
    expect(exportPackage.manifest.includedFiles).toContain("channel_deliveries.jsonl");
    expect(exportPackage.files["channel_deliveries.jsonl"]).toContain(delivery!.id);
    expect(exportPackage.files["channel_deliveries.jsonl"]).not.toContain("Bugun aksam");

    const { state: redacted } = applyPhase74TransactionalRedactionInState(withDelivery, "client-mert", "deletion");
    expect(redacted.channelDeliveries.some((item) => item.clientId === "client-mert")).toBe(false);
  });
});
