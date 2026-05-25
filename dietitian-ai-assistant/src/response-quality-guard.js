const forbiddenPatterns = [
  { issue: "diagnosis_language", pattern: /sende .* olabilir|tanı|teşhis/i },
  { issue: "medication_dosing", pattern: /(?:ilaç|insülin|metformin|antibiyotik).*?(?:mg|doz|artır|azalt)/i },
  { issue: "emergency_advice", pattern: /acile gitme gerek yok|önemli değildir|bekleyebilirsin/i },
  { issue: "unsupported_plan_change", pattern: /kalorini .* yap|diyetini değiştirelim|öğünü tamamen çıkar/i },
  { issue: "ai_identity_phrase", pattern: /yapay zeka olarak|bir ai olarak|chatbot olarak/i },
];

export function guardAssistantReply({ draft, capsule, riskDecision }) {
  const text = String(draft || "").trim();
  const issues = [];

  if (!text) issues.push("empty_reply");
  if (riskDecision.level === "red") issues.push("red_risk_requires_handoff");
  if (text.length > maxLengthFor(capsule)) issues.push("too_long_for_channel_style");
  if (mentionsKnownOtherClientName(text, capsule)) issues.push("possible_cross_client_leakage");

  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(text)) issues.push(rule.issue);
  }

  return {
    allowed: issues.length === 0,
    issues,
  };
}

function maxLengthFor(capsule) {
  const preferred = Number(capsule.voiceProfile.averageMessageChars) || 140;
  return Math.min(Math.max(preferred * 2, 120), 360);
}

function mentionsKnownOtherClientName(text, capsule) {
  const knownOtherNames = [
    ...(capsule.client.knownOtherClientNames || []),
    ...(capsule.memory?.durableFacts?.knownOtherClientNames || []),
  ];

  if (knownOtherNames.length === 0) return false;

  const normalized = text.toLocaleLowerCase("tr-TR");
  const currentClientName = String(capsule.client.fullName || "").toLocaleLowerCase("tr-TR");

  return knownOtherNames.some((name) => {
    const normalizedName = String(name || "").toLocaleLowerCase("tr-TR").trim();
    return normalizedName && normalizedName !== currentClientName && normalized.includes(normalizedName);
  });
}
