const forbiddenPatterns = [
  {
    issue: "diagnosis_language",
    pattern:
      /sende .* olabilir|tani|teshis|tanisi|diagnos(?:is|e|ed|tic|tico|tika)|diagnostik|you may have|you might have|du hast.*vielleicht|puedes tener|puede tener|voce pode ter|vous pourriez avoir|muzes mit/i,
  },
  {
    issue: "medication_dosing",
    pattern:
      /(?:ilac|insulin|metformin|antibiyotik|medication|medicine|medikament|medicament|medicamento|remedio|lek|leku|inzulin).*?(?:mg|doz|dose|dosage|dosis|davk|unit|units|artir|azalt|increase|decrease|erhoh|reduz|augment|diminu|aument|dismin|zvys|sniz)/i,
  },
  {
    issue: "emergency_advice",
    pattern:
      /acile gitme gerek yok|onemli degildir|bekleyebilirsin|no need to (?:go to )?(?:er|emergency)|not serious|you can wait|kein notfall|nicht in die notaufnahme|pas besoin.*urgence|ce n.est pas grave|puede esperar|no es grave|nao precisa.*emergencia|nao e grave|neni to vazne|muzes pockat/i,
  },
  {
    issue: "unsupported_plan_change",
    pattern:
      /kalorini .* yap|diyetini degistirelim|ogununu tamamen cikar|set .*calor(?:y|ies).*to|change your diet|remove .*meal completely|kalorien .* setzen|ernahrung .* andern|supprimer .*repas|changer .*regime|cambiar .*dieta|quitar .*comida|mudar .*dieta|retirar .*refeicao|zmenit .*jidelnicek|vynechat .*jidlo/i,
  },
  {
    issue: "ai_identity_phrase",
    pattern:
      /yapay zeka olarak|bir ai olarak|chatbot olarak|as an ai|as a chatbot|als ki|als chatbot|en tant qu.ia|en tant que chatbot|como ia|como un chatbot|como uma ia|como chatbot|jako ai|jako chatbot/i,
  },
];

const emojiPattern = /[\u{1F300}-\u{1FAFF}]/u;

export function guardAssistantReply({ draft, capsule, riskDecision }) {
  const text = String(draft || "").trim();
  const normalizedText = normalizeForSafetyPatterns(text);
  const issues = [];

  if (!text) issues.push("empty_reply");
  if (riskDecision.level === "red") issues.push("red_risk_requires_handoff");
  if (text.length > maxLengthFor(capsule)) issues.push("too_long_for_channel_style");
  if (mentionsKnownOtherClientName(text, capsule)) issues.push("possible_cross_client_leakage");
  issues.push(...personaContractIssues(text, capsule));

  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(normalizedText)) issues.push(rule.issue);
  }

  return {
    allowed: issues.length === 0,
    issues,
  };
}

export function guardProviderOutput({ output, capsule, riskDecision }) {
  const assistant = guardAssistantReply({ draft: output, capsule, riskDecision });
  const issues = assistant.issues.map((issue) => ({
    code: issue,
    severity: "block",
    category: "clinical",
    evidence: "pattern",
  }));

  if (hasMissingHistoricalContextToken(output)) {
    issues.push({
      code: "missing_historical_context",
      severity: "block",
      category: "context",
      evidence: "context_mismatch",
    });
  }

  return {
    allowed: issues.length === 0,
    issues,
  };
}

export function hasMissingHistoricalContextToken(output) {
  return /\[ERROR:\s*missing_historical_context\]|missing_historical_context/i.test(String(output || ""));
}

function maxLengthFor(capsule) {
  const preferred = Number(capsule?.voiceProfile?.averageMessageChars) || 140;
  return Math.min(Math.max(preferred * 2, 120), 360);
}

function personaContractIssues(text, capsule) {
  const behavior = capsule?.persona?.behavior || {};
  const issues = [];

  if (behavior.emojiPolicy === "none" && emojiPattern.test(text)) {
    issues.push("persona_emoji_policy_violation");
  }

  if (behavior.sentenceLength === "very short" && text.length > 180) {
    issues.push("persona_length_policy_violation");
  }

  return issues;
}

function normalizeForSafetyPatterns(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ÄŸ/g, "g")
    .replace(/Ä±/g, "i")
    .replace(/Ã¶/g, "o")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã¼/g, "u")
    .replace(/Ã§/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

function mentionsKnownOtherClientName(text, capsule) {
  const knownOtherNames = [
    ...(capsule?.client?.knownOtherClientNames || []),
    ...(capsule?.memory?.durableFacts?.knownOtherClientNames || []),
  ];

  if (knownOtherNames.length === 0) return false;

  const normalized = text.toLocaleLowerCase("tr-TR");
  const currentClientName = String(capsule?.client?.fullName || "").toLocaleLowerCase("tr-TR");

  return knownOtherNames.some((name) => {
    const normalizedName = String(name || "").toLocaleLowerCase("tr-TR").trim();
    return normalizedName && normalizedName !== currentClientName && normalized.includes(normalizedName);
  });
}
