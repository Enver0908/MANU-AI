import { normalizeWhatsAppCloudPayload } from "./whatsapp-cloud-payload-normalizer";
import { processMockChannelInbound } from "./channel-adapters";
import type { ManuAppState, SimulationResult } from "./types";

export type WhatsAppMockWebhookStatus = "processed" | "blocked" | "duplicate_ignored" | "rejected";

export type WhatsAppMockWebhookResult = {
  status: WhatsAppMockWebhookStatus;
  action: SimulationResult["action"] | null;
  blockedReason: string | null;
  normalizationCode?: string;
};

export function isMockWhatsAppWebhookEnabled() {
  return process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK === "true";
}

export async function processWhatsAppMockWebhookInState(
  state: ManuAppState,
  payload: unknown,
): Promise<{ state: ManuAppState; result: WhatsAppMockWebhookResult }> {
  const normalized = normalizeWhatsAppCloudPayload(payload);
  if (!normalized.ok) {
    return {
      state,
      result: {
        status: "rejected",
        action: null,
        blockedReason: normalized.code,
        normalizationCode: normalized.code,
      },
    };
  }

  const next = await processMockChannelInbound(state, normalized.event);
  return {
    state: next,
    result: toWhatsAppMockWebhookResult(next.lastSimulation),
  };
}

export function toWhatsAppMockWebhookResult(lastSimulation: SimulationResult | null): WhatsAppMockWebhookResult {
  if (!lastSimulation) {
    return {
      status: "blocked",
      action: null,
      blockedReason: "missing_simulation_result",
    };
  }

  if (lastSimulation.action === "duplicate_ignored") {
    return {
      status: "duplicate_ignored",
      action: lastSimulation.action,
      blockedReason: lastSimulation.blockedReason,
    };
  }

  if (lastSimulation.action === "no_ai") {
    return {
      status: "blocked",
      action: lastSimulation.action,
      blockedReason: lastSimulation.blockedReason,
    };
  }

  return {
    status: "processed",
    action: lastSimulation.action,
    blockedReason: lastSimulation.blockedReason,
  };
}

export function whatsAppMockWebhookHttpStatus(result: WhatsAppMockWebhookResult) {
  if (result.status === "rejected") {
    return 422;
  }

  return 200;
}
