export const MESSAGE_ORIGINS = {
  clientInbound: "client_inbound",
  aiGenerated: "ai_generated",
  dietitianManual: "dietitian_manual",
  systemEvent: "system_event",
  importedUnknown: "imported_unknown",
};

const EXACT_DIETITIAN_BASES = new Set(["authenticated_manu_action", "exclusive_verified_account"]);

export function buildMessageProvenance({
  origin,
  authorDietitianId = null,
  actorType = null,
  actorBindingId = null,
  actorResolutionBasis = null,
  generatedByAiDecisionId = null,
  approvedByDietitianId = null,
  sourceMessageId = null,
}) {
  if (!Object.values(MESSAGE_ORIGINS).includes(origin)) {
    throw new Error(`Unknown message origin: ${origin}`);
  }

  if (origin === MESSAGE_ORIGINS.dietitianManual) {
    const hasExactDietitian = Boolean(authorDietitianId);
    const hasVerifiedBusinessHuman =
      actorType === "business_operator" &&
      actorResolutionBasis === "shared_authorized_team" &&
      Boolean(actorBindingId);
    const hasExclusiveDietitian =
      actorType === "exact_dietitian" &&
      EXACT_DIETITIAN_BASES.has(actorResolutionBasis) &&
      Boolean(actorBindingId);

    if (!hasExactDietitian && !hasVerifiedBusinessHuman && !hasExclusiveDietitian) {
      throw new Error(
        "Dietitian manual messages require exact dietitian proof or verified business-human proof",
      );
    }
  }

  if (origin === MESSAGE_ORIGINS.aiGenerated && !generatedByAiDecisionId) {
    throw new Error("AI generated messages require generatedByAiDecisionId");
  }

  return {
    origin,
    authorDietitianId,
    actorType,
    actorBindingId,
    actorResolutionBasis,
    generatedByAiDecisionId,
    approvedByDietitianId,
    sourceMessageId,
  };
}
