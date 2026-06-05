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

export function buildSafeAcknowledgement(level) {
  return level === "red" ? "Internal urgent handoff queued." : "Internal review handoff queued.";
}

function buildRecommendedAction(riskDecision) {
  if (riskDecision.level === "red") {
    return "Review immediately. If the message suggests urgent symptoms, contact the client directly and advise appropriate emergency care where applicable.";
  }

  return "Review context, decide the manual client response, and decide whether client mode should remain copilot.";
}
