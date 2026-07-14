import type { ManuAppState } from "./types";
import type { SimulationResult } from "./types";
import {
  processCanonicalWhatsAppIngressInState,
  type CanonicalIngressProcessOptions,
} from "./phase-85-stage-4b3-canonical-ingress";

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
  options: CanonicalIngressProcessOptions = {},
): Promise<{ state: ManuAppState; result: WhatsAppMockWebhookResult }> {
  const canonical = await processCanonicalWhatsAppIngressInState(state, payload, options);
  return {
    state: canonical.state,
    result: canonical.result,
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
