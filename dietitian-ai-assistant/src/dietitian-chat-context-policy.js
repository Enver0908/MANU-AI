export const DIETITIAN_CHAT_CONTEXT_POLICY_VERSION = "dietitian-chat-context-policy-v1";

export const MAX_VISIBLE_MESSAGES = 12;
export const MAX_CONTEXT_CHARS = 18_000;
export const MAX_ROLLING_SUMMARY_CHARS = 4_000;

export const DIETITIAN_CHAT_INTENTS = [
  "general_non_client",
  "client_current_status",
  "client_longitudinal_summary",
  "client_trend",
  "client_period_comparison",
  "client_specific_record",
  "client_risk_review",
  "client_source_explanation",
  "client_safe_draft",
  "unsupported_write_action",
  "second_client_reference",
];

export const AI_CHAT_CONTEXT_TOOLS = [
  "load_client_profile",
  "load_client_active_form",
  "load_client_food_rule_profile",
  "load_client_menu_plans",
  "load_client_context_updates",
  "load_client_recent_messages",
  "search_client_messages",
  "load_client_accepted_transcripts",
  "load_client_risk_timeline",
  "load_client_handoffs",
  "load_client_ai_decisions",
  "load_client_record_assets",
  "search_approved_sources",
];

const DEFAULT_CLIENT_BOUNDED_TOOL_PLAN = [
  "load_client_profile",
  "load_client_active_form",
  "load_client_context_updates",
  "load_client_recent_messages",
  "load_client_food_rule_profile",
];

const INTENT_TOOL_PLAN = {
  client_current_status: [
    "load_client_profile",
    "load_client_active_form",
    "load_client_context_updates",
    "load_client_recent_messages",
    "load_client_menu_plans",
    "load_client_food_rule_profile",
  ],
  client_longitudinal_summary: [
    "load_client_profile",
    "load_client_active_form",
    "load_client_context_updates",
    "load_client_accepted_transcripts",
    "load_client_menu_plans",
    "load_client_risk_timeline",
    "load_client_record_assets",
  ],
  client_trend: [
    "load_client_profile",
    "load_client_context_updates",
    "load_client_accepted_transcripts",
    "search_approved_sources",
    "load_client_risk_timeline",
  ],
  client_period_comparison: [
    "load_client_profile",
    "load_client_context_updates",
    "load_client_accepted_transcripts",
    "search_client_messages",
    "load_client_menu_plans",
  ],
  client_specific_record: [
    "load_client_profile",
    "search_client_messages",
    "load_client_record_assets",
    "load_client_accepted_transcripts",
  ],
  client_risk_review: [
    "load_client_profile",
    "load_client_risk_timeline",
    "load_client_handoffs",
    "search_approved_sources",
  ],
  client_source_explanation: [
    "load_client_profile",
    "search_client_messages",
    "search_approved_sources",
    "load_client_record_assets",
  ],
  client_safe_draft: [
    "load_client_profile",
    "load_client_recent_messages",
    "load_client_context_updates",
  ],
};

/**
 * @typedef {{ role: "user" | "assistant"; body: string }} DietitianChatContextMessage
 */

/**
 * @param {readonly DietitianChatContextMessage[]} messages
 * @param {number} [maxMessages]
 * @param {number} [maxChars]
 */
export function selectVisibleMessages(messages, maxMessages = MAX_VISIBLE_MESSAGES, maxChars = MAX_CONTEXT_CHARS) {
  const visible = [];
  let totalChars = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.body) continue;
    const nextChars = totalChars + message.body.length;
    if (visible.length >= maxMessages || nextChars > maxChars) {
      break;
    }
    visible.unshift(message);
    totalChars = nextChars;
  }

  return { visibleMessages: visible, totalChars };
}

/**
 * @param {readonly DietitianChatContextMessage[]} olderMessages
 * @param {number} [maxChars]
 */
export function buildRollingSummary(olderMessages, maxChars = MAX_ROLLING_SUMMARY_CHARS) {
  if (!olderMessages.length) {
    return { summaryText: "", isAuthoritative: false };
  }

  const parts = [];
  let totalChars = 0;
  for (let index = olderMessages.length - 1; index >= 0; index -= 1) {
    const message = olderMessages[index];
    if (!message?.body) continue;
    const snippet = `${message.role}: ${message.body}`.slice(0, 240);
    const nextChars = totalChars + snippet.length + 1;
    if (nextChars > maxChars) break;
    parts.unshift(snippet);
    totalChars = nextChars;
  }

  return {
    summaryText: parts.join("\n"),
    isAuthoritative: false,
  };
}

/**
 * @param {{ messages: readonly DietitianChatContextMessage[] }} input
 */
export function buildProviderContext(input) {
  const { visibleMessages, totalChars } = selectVisibleMessages(input.messages);
  const olderMessages = input.messages.slice(0, Math.max(0, input.messages.length - visibleMessages.length));
  const rollingSummary = buildRollingSummary(olderMessages);

  return {
    version: DIETITIAN_CHAT_CONTEXT_POLICY_VERSION,
    visibleMessages,
    visibleCharCount: totalChars,
    rollingSummary,
  };
}

/**
 * @param {{ triggerBody: string; scopeType?: "general" | "client" }} input
 */
export function classifyDietitianChatIntentFromSignals(input) {
  const triggerBody = String(input.triggerBody ?? "").trim();
  const scopeType = input.scopeType === "client" ? "client" : "general";
  const fixtureMatch = triggerBody.match(/^__fixture:intent:([a-z_]+)__$/i);
  if (fixtureMatch) {
    const key = fixtureMatch[1].toLowerCase();
    if (DIETITIAN_CHAT_INTENTS.includes(key)) {
      return key;
    }
  }

  if (scopeType === "general") {
    return "general_non_client";
  }

  const lowered = triggerBody.toLowerCase();
  if (/\b(güncelle|kaydet|yaz|update|save|write|delete|sil)\b/u.test(lowered) && /\b(kayıt|record|form|plan|profil)\b/u.test(lowered)) {
    return "unsupported_write_action";
  }
  if (/\b(kaynak|source|referans|kanıt)\b/u.test(lowered)) return "client_source_explanation";
  if (/\b(risk|tehlike|handoff|devir)\b/u.test(lowered)) return "client_risk_review";
  if (/\b(taslak|draft|mesaj yaz)\b/u.test(lowered)) return "client_safe_draft";
  if (/\b(trend|eğilim|artış|azalış)\b/u.test(lowered)) return "client_trend";
  if (/\b(karşılaştır|dönem|önce|sonra|compare|period)\b/u.test(lowered)) return "client_period_comparison";
  if (/\b(geçmiş|longitudinal|yıllık|kronik|tarihçe)\b/u.test(lowered)) return "client_longitudinal_summary";
  if (/\b(kayıt|belge|transcript|dosya|asset)\b/u.test(lowered)) return "client_specific_record";
  if (/\b(durum|özet|status|current|güncel)\b/u.test(lowered)) return "client_current_status";

  return "client_current_status";
}

/**
 * @param {string} intent
 * @param {"general" | "client"} scopeType
 */
export function planDietitianChatContextTools(intent, scopeType) {
  if (scopeType !== "client") return [];
  if (intent === "unsupported_write_action" || intent === "second_client_reference" || intent === "general_non_client") {
    return [];
  }
  return INTENT_TOOL_PLAN[intent] ?? DEFAULT_CLIENT_BOUNDED_TOOL_PLAN;
}

/**
 * @param {{
 *   intent: string;
 *   sourceRefs: Array<{ sourceId: string; excerpt: string }>;
 *   structuredFacts?: Array<{ section: string; facts: string[]; isAiSynthesis: boolean }>;
 * }} input
 */
export function buildDietitianChatEvidenceEnvelope(input) {
  const lines = [`intent:${input.intent}`];
  for (const section of input.structuredFacts ?? []) {
    lines.push(`section:${section.section}`);
    for (const fact of section.facts) {
      lines.push(`fact:${fact}`);
    }
    if (section.isAiSynthesis) {
      lines.push("synthesis_label:ai_synthesis_non_authoritative");
    }
  }
  for (const ref of input.sourceRefs ?? []) {
    lines.push(`source:${ref.sourceId}|${ref.excerpt}`);
  }
  return lines.join("\n");
}
