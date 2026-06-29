import type { Channel } from "./types";

export const MOCK_WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type MockWhatsAppTemplateRegistryEntry = {
  templateId: string;
  category: "utility" | "marketing";
  mockApproved: false;
  mockEligibleForOutbound: boolean;
};

export const MOCK_WHATSAPP_TEMPLATE_REGISTRY: MockWhatsAppTemplateRegistryEntry[] = [
  {
    templateId: "utility_session_reply_v1",
    category: "utility",
    mockApproved: false,
    mockEligibleForOutbound: true,
  },
  {
    templateId: "marketing_promo_v1",
    category: "marketing",
    mockApproved: false,
    mockEligibleForOutbound: false,
  },
];

export type MockWhatsAppOutboundPolicyInput = {
  channel: Channel;
  serviceWindowClosed?: boolean;
  mockTemplateId?: string;
  outboundTrigger?: "inbound_reply" | "proactive";
};

export type MockWhatsAppOutboundPolicyAllowed = {
  allowed: true;
  deliveryMode: "session_message" | "mock_template";
  templateId?: string;
  templateRequired: false;
};

export type MockWhatsAppOutboundPolicyBlocked = {
  allowed: false;
  blockedReason: string;
  reasons: string[];
  templateRequired: boolean;
  mockTemplateFailureCode?: string;
};

export type MockWhatsAppOutboundPolicyResult =
  | MockWhatsAppOutboundPolicyAllowed
  | MockWhatsAppOutboundPolicyBlocked;

export function evaluateMockWhatsAppOutboundPolicy(
  input: MockWhatsAppOutboundPolicyInput,
): MockWhatsAppOutboundPolicyResult {
  if (input.channel !== "whatsapp") {
    return {
      allowed: true,
      deliveryMode: "session_message",
      templateRequired: false,
    };
  }

  const serviceWindowClosed =
    input.serviceWindowClosed === true || input.outboundTrigger === "proactive";

  if (!serviceWindowClosed) {
    return {
      allowed: true,
      deliveryMode: "session_message",
      templateRequired: false,
    };
  }

  if (input.mockTemplateId) {
    const templateLookup = resolveMockTemplateLookup(input.mockTemplateId);
    if (!templateLookup.eligible) {
      return {
        allowed: false,
        blockedReason: "channel_policy_template_required_blocked",
        reasons: ["whatsapp_service_window_closed", templateLookup.failureCode || "mock_template_not_eligible"],
        templateRequired: true,
        mockTemplateFailureCode: templateLookup.failureCode || undefined,
      };
    }
  }

  return {
    allowed: false,
    blockedReason: "channel_policy_service_window_closed",
    reasons: ["whatsapp_service_window_closed", "client_facing_ai_send_blocked_pending_template"],
    templateRequired: true,
    mockTemplateFailureCode: "mock_template_send_not_enabled_in_phase_77ad",
  };
}

export function resolveMockTemplateLookup(templateId?: string) {
  if (!templateId) {
    return {
      eligible: false,
      failureCode: "mock_template_id_required",
      entry: null,
    };
  }

  const entry = MOCK_WHATSAPP_TEMPLATE_REGISTRY.find((item) => item.templateId === templateId) || null;
  if (!entry) {
    return {
      eligible: false,
      failureCode: "mock_template_not_registered",
      entry: null,
    };
  }

  if (!entry.mockEligibleForOutbound) {
    return {
      eligible: false,
      failureCode: "mock_template_not_eligible",
      entry,
    };
  }

  return {
    eligible: true,
    failureCode: null,
    entry,
  };
}

export function isChannelOptOutCommand(body: string) {
  return OPT_OUT_COMMANDS.has(body.trim().toUpperCase());
}

const OPT_OUT_COMMANDS = new Set(["STOP", "DUR", "IPTAL", "IPTAL ET", "CANCEL"]);
