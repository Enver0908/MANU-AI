export const MESSAGE_ORIGINS = {
  clientInbound: "client_inbound",
  aiGenerated: "ai_generated",
  dietitianManual: "dietitian_manual",
  systemEvent: "system_event",
  importedUnknown: "imported_unknown",
};

export function buildMessageProvenance({
  origin,
  authorDietitianId = null,
  generatedByAiDecisionId = null,
  approvedByDietitianId = null,
  sourceMessageId = null,
}) {
  if (!Object.values(MESSAGE_ORIGINS).includes(origin)) {
    throw new Error(`Unknown message origin: ${origin}`);
  }

  if (origin === MESSAGE_ORIGINS.dietitianManual && !authorDietitianId) {
    throw new Error("Dietitian manual messages require authorDietitianId");
  }

  if (origin === MESSAGE_ORIGINS.aiGenerated && !generatedByAiDecisionId) {
    throw new Error("AI generated messages require generatedByAiDecisionId");
  }

  return {
    origin,
    authorDietitianId,
    generatedByAiDecisionId,
    approvedByDietitianId,
    sourceMessageId,
  };
}

