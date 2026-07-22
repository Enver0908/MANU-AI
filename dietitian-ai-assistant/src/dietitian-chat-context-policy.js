export const DIETITIAN_CHAT_CONTEXT_POLICY_VERSION = "dietitian-chat-context-policy-v1";

export const MAX_VISIBLE_MESSAGES = 12;
export const MAX_CONTEXT_CHARS = 18_000;
export const MAX_ROLLING_SUMMARY_CHARS = 4_000;

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
