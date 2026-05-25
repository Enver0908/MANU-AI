export function selectRecentMessages(messages, limit = 8) {
  return messages
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit)
    .map((message) => ({
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt,
    }));
}

export function buildMemoryContext({ rollingSummary = "", durableFacts = {}, recentMessages = [] }) {
  return {
    rollingSummary,
    durableFacts,
    recentMessages: selectRecentMessages(recentMessages),
  };
}

export function appendDurableFact(memory, key, value) {
  return {
    ...memory,
    durableFacts: {
      ...(memory.durableFacts || {}),
      [key]: value,
    },
  };
}

