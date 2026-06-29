import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { processMockChannelInbound } from "@/lib/channel-adapters";
import { createInitialState } from "@/lib/seed-data";
import { resetRateLimits } from "@/lib/rate-limit";
import { runInboundSimulation, updateClientInState } from "@/lib/simulator";
import {
  MOCK_WHATSAPP_TEMPLATE_REGISTRY,
  evaluateMockWhatsAppOutboundPolicy,
  isChannelOptOutCommand,
  resolveMockTemplateLookup,
} from "@/lib/whatsapp-channel-policy-mock";
import { processWhatsAppMockWebhookInState } from "@/lib/whatsapp-mock-webhook";

const goldenCasesPath = join(dirname(fileURLToPath(import.meta.url)), "whatsapp-cloud-payload-golden-cases.jsonl");

function loadGoldenPayload(id: string) {
  const cases = readFileSync(goldenCasesPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { id: string; payload: unknown });
  const match = cases.find((item) => item.id === id);
  if (!match) {
    throw new Error(`missing golden payload: ${id}`);
  }
  return match.payload;
}

describe("phase 77ad whatsapp channel policy mock", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("recognizes explicit channel opt-out commands", () => {
    expect(isChannelOptOutCommand("STOP")).toBe(true);
    expect(isChannelOptOutCommand("iptal et")).toBe(true);
    expect(isChannelOptOutCommand("please stop messaging me")).toBe(false);
  });

  it("keeps the mock template registry non-production-approved", () => {
    expect(MOCK_WHATSAPP_TEMPLATE_REGISTRY.every((entry) => entry.mockApproved === false)).toBe(true);
    expect(resolveMockTemplateLookup("marketing_promo_v1").eligible).toBe(false);
    expect(resolveMockTemplateLookup("utility_session_reply_v1").eligible).toBe(true);
  });

  it("allows session replies while the mock service window is open", () => {
    const policy = evaluateMockWhatsAppOutboundPolicy({
      channel: "whatsapp",
      outboundTrigger: "inbound_reply",
    });

    expect(policy.allowed).toBe(true);
    if (policy.allowed) {
      expect(policy.deliveryMode).toBe("session_message");
    }
  });

  it("blocks client-facing AI sends when an ineligible mock template is required", async () => {
    const state = createInitialState();
    const sentBefore = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-template-required-block-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      channelPolicyMock: { serviceWindowClosed: true, mockTemplateId: "marketing_promo_v1" },
    });

    const sentAfter = next.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_template_required_blocked");
    expect(sentAfter).toBe(sentBefore);
  });

  it("blocks client-facing AI sends when the mock service window is closed", async () => {
    const state = createInitialState();
    const sentBefore = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-service-window-closed-1",
      channelUserId: "+905551110001",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      channelPolicyMock: { serviceWindowClosed: true },
    });

    const sentAfter = next.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")
      .length;

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_service_window_closed");
    expect(sentAfter).toBe(sentBefore);
    expect(
      next.auditEvents.some(
        (event) =>
          event.eventType === "channel_policy_outbound_blocked" &&
          event.metadata.templateRequired === true &&
          event.metadata.clientFacingAiSendBlocked === true,
      ),
    ).toBe(true);
    expect(JSON.stringify(next.auditEvents.at(-1)?.metadata)).not.toContain("Bugun kahvaltida");
  });

  it("processes opt-out commands through the mock webhook before AI automation", async () => {
    const payload = loadGoldenPayload("wa-direct-text");
    const stopPayload = structuredClone(payload) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<{ id: string; text: { body: string } }> } }> }>;
    };
    stopPayload.entry[0].changes[0].value.messages[0].text.body = "STOP";
    stopPayload.entry[0].changes[0].value.messages[0].id = "wamid.SYNTH_STOP_1";

    const state = createInitialState();
    const { state: next, result } = await processWhatsAppMockWebhookInState(state, stopPayload);

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("channel_policy_opt_out_received");
    expect(next.clients.find((client) => client.id === "client-mert")?.channelPermission).toBe("opted_out");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
  });

  it("ignores duplicate opt-out provider events idempotently", async () => {
    const payload = loadGoldenPayload("wa-direct-text");
    const stopPayload = structuredClone(payload) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<{ id: string; text: { body: string } }> } }> }>;
    };
    stopPayload.entry[0].changes[0].value.messages[0].text.body = "STOP";
    stopPayload.entry[0].changes[0].value.messages[0].id = "wamid.SYNTH_STOP_DUP";

    const first = await processWhatsAppMockWebhookInState(createInitialState(), stopPayload);
    const second = await processWhatsAppMockWebhookInState(first.state, stopPayload);

    expect(second.result.status).toBe("duplicate_ignored");
    expect(second.state.messages).toHaveLength(first.state.messages.length);
    expect(second.state.aiDecisions).toHaveLength(first.state.aiDecisions.length);
  });

  it("blocks repeat opt-out commands for already opted-out clients without re-entering AI", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "opted_out",
    });
    const next = await processMockChannelInbound(state, {
      channel: "whatsapp",
      providerEventId: "wa-stop-already-opted-out",
      channelUserId: "+905551110001",
      body: "STOP",
    });

    expect(next.lastSimulation?.blockedReason).toBe("channel_policy_opt_out_already_applied");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
  });

  it("keeps opted-out clients out of automation on normal inbound messages", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "opted_out",
    });
    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "sim-opted-out-normal",
      channel: "whatsapp",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_permission_opted_out");
    expect(next.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent")).toHaveLength(
      state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent").length,
    );
  });
});
