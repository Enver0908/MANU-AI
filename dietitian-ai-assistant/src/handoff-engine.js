export function createHandoffCase({ capsule, inboundMessage, riskDecision }) {
  const urgency = riskDecision.level === "red" ? "urgent" : "normal";

  return {
    tenantId: capsule.tenantId,
    dietitianId: capsule.dietitian.id,
    clientId: capsule.client.id,
    conversationId: capsule.conversation.id,
    risk: riskDecision.level,
    reasons: riskDecision.reasons,
    urgency,
    safeAcknowledgement: buildSafeAcknowledgement(riskDecision.level),
    recommendedAction: buildRecommendedAction(riskDecision),
    pauseAutopilot: riskDecision.pauseAutopilot,
    originalMessage: inboundMessage,
  };
}

function buildSafeAcknowledgement(level) {
  if (level === "red") {
    return "Bunu hemen diyetisyeninize iletiyorum. Bu konuda net yanıtı kendisi versin.";
  }

  return "Bunu diyetisyeninize kontrol ettiriyorum. Netleşince size dönüş yapılacak.";
}

function buildRecommendedAction(riskDecision) {
  if (riskDecision.level === "red") {
    return "Review immediately. If the message suggests urgent symptoms, contact the client directly and advise appropriate emergency care where applicable.";
  }

  return "Review context, approve or edit the AI draft, and decide whether client mode should remain copilot.";
}

