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
    safeAcknowledgement: buildSafeAcknowledgement(riskDecision.level, capsule.client.communicationLanguage),
    recommendedAction: buildRecommendedAction(riskDecision),
    pauseAutopilot: riskDecision.pauseAutopilot,
    originalMessage: inboundMessage,
  };
}

export function buildSafeAcknowledgement(level, language = "tr") {
  const templates = SAFE_ACKNOWLEDGEMENTS[language] || SAFE_ACKNOWLEDGEMENTS.tr;
  return level === "red" ? templates.red : templates.review;
}

const SAFE_ACKNOWLEDGEMENTS = {
  tr: {
    red: "Bunu hemen diyetisyeninize iletiyorum. Bu konuda net yaniti kendisi versin.",
    review: "Bunu diyetisyeninize kontrol ettiriyorum. Netlesince size donus yapilacak.",
  },
  en: {
    red: "I am sending this to your dietitian now. They should give the clear answer on this.",
    review: "I am asking your dietitian to check this. They will get back to you when it is clear.",
  },
  de: {
    red: "Ich leite das jetzt an Ihre Ernahrungsfachkraft weiter. Die klare Antwort sollte von ihr kommen.",
    review: "Ich lasse das von Ihrer Ernahrungsfachkraft prufen. Sie meldet sich, sobald es klar ist.",
  },
  fr: {
    red: "Je transmets cela tout de suite a votre dieteticien. La reponse claire doit venir de lui.",
    review: "Je fais verifier cela par votre dieteticien. Il vous repondra quand ce sera clair.",
  },
  es: {
    red: "Voy a enviar esto ahora a su dietista. La respuesta clara debe venir de esa persona.",
    review: "Voy a pedir a su dietista que revise esto. Le respondera cuando este claro.",
  },
  pt: {
    red: "Vou enviar isto agora para o seu nutricionista. A resposta clara deve vir dele.",
    review: "Vou pedir ao seu nutricionista para verificar isto. Ele respondera quando estiver claro.",
  },
  cs: {
    red: "Hned to predavam vasemu nutricnimu specialistovi. Jasnou odpoved by mel dat on.",
    review: "Necham to zkontrolovat vasim nutricnim specialistou. Ozve se vam, az to bude jasne.",
  },
};

function buildRecommendedAction(riskDecision) {
  if (riskDecision.level === "red") {
    return "Review immediately. If the message suggests urgent symptoms, contact the client directly and advise appropriate emergency care where applicable.";
  }

  return "Review context, approve or edit the AI draft, and decide whether client mode should remain copilot.";
}
