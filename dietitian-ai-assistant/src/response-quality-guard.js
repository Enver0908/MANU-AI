import { detectClaimManifestOutputViolations } from "./claim-manifest-v1.js";
import { detectHardStyleGuardViolations } from "./style-dna-v2.js";

export const PRODUCT_COMMUNICATION_COVENANT_VERSION = "product-communication-covenant-v0.1.0";
export const FOOD_RULE_OUTPUT_GUARD_VERSION = "food-rule-output-guard-v0.2.0";
export const FOOD_DECISION_V2_OUTPUT_GUARD_VERSION = "food-decision-v2-output-guard-v0.1.0";

const FOOD_RULE_REJECTION_DECISIONS = new Set([
  "forbidden_food_rejection",
  "diet_type_conflict",
  "product_ingredient_conflict",
  "mandatory_skip_blocked",
]);

const foodRuleStrongEatApprovalPatterns = [
  /\b(?:yiyebilirsin|yiyebilir|tuketebilirsin|tuketebilir|icebilirsin|icebilir)\b/i,
  /\b(?:you can (?:eat|have|consume)|that is fine to eat|go ahead and eat)\b/i,
];


const foodRuleSkipRelaxationPatterns = [
  /\bbugunluk\s+(?:sorun\s+)?olmaz\b/i,
  /\b(?:atla|atlayabilirsin|skip(?:\s+it)?|es gec)\b/i,
  /\b(?:you can skip|skipping (?:is|should be) fine)\b/i,
];

const foodRulePortionMacroPatterns = [
  /\b(?:porsiyon|portion)\w*.{0,32}(?:artir|buyut|increase|raise)\w*/i,
  /\b(?:kalori|calorie|makro|macro)\w*.{0,32}(?:artir|increase|yuksek|raise)\w*/i,
  /\b(?:set|hedef).{0,16}(?:kalori|calorie|makro|macro)\b/i,
];

const foodRuleUnauthorizedSubstitutionPatterns = [
  /\b(?:deneyebilir|try)\b.{0,24}\b(?:yerine|instead)\b/i,
  /\b(?:bunun yerine|instead of that)\b/i,
  /\b(?:alternatif olarak|as an alternative)\b/i,
];

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

const covenantPatterns = [
  {
    issue: "covenant_ai_self_disclosure",
    pattern:
      /\b(as an ai|as a chatbot|i am an ai|i'm an ai|i am a chatbot|artificial intelligence)\b|(?:yapay zeka|chatbot|sohbet robotu|ai)\s*(?:olarak|modeli|sistemiyim)|\b(bir yapay zeka|ben yapay zeka|ben bir ai)\b|\b(als ki|als chatbot|kunstliche intelligenz)\b|\b(en tant qu ia|en tant que chatbot|je suis une ia|intelligence artificielle)\b|\b(como ia|como una ia|como um chatbot|como uma ia|inteligencia artificial)\b|\b(jako ai|jsem ai|umela inteligence|chatbot)\b/i,
  },
  {
    issue: "covenant_ai_limitation_disclaimer",
    pattern:
      /(?:tibbi|medikal|saglik)\s+tavsiye\s+veremem|(?:tibbi|medikal)\s+oneride\s+bulunamam|(?:cannot|can't|can not)\s+provide\s+(?:medical|health)\s+advice|no\s+puedo\s+(?:dar|proporcionar)\s+(?:consejo|asesoramiento)\s+medic|nao\s+posso\s+(?:dar|fornecer)\s+aconselhamento\s+medic|je\s+ne\s+peux\s+pas\s+(?:donner|fournir)\s+(?:de\s+)?conseil\s+medical|ich\s+kann\s+keine\s+(?:medizinische|arztliche)\s+beratung\s+geben|nemohu\s+poskytovat\s+(?:lekarske|zdravotni)\s+rady/i,
  },
  {
    issue: "covenant_referral_language",
    pattern:
      /\b(?:diyetisyen|diyetisyenin|diyetisyeninize|diyetisyenine|doktor|doktorun|doktoruna|doktorunuza|hekim|hekiminize|uzman|uzmana|profesyonel)\b|(?:danis|basvur|iletisime gec|sor|kontrol ettir|onay).*?(?:doktor|diyetisyen|hekim|uzman|profesyonel)|(?:consult|ask|contact|check with|defer to|talk to|speak to).*?(?:doctor|dietitian|professional|expert|specialist|healthcare provider|physician)|\b(?:your doctor|your dietitian|a professional|a specialist|an expert|healthcare professional)\b|(?:konsultieren|fragen|wenden sie sich).*?(?:arzt|ernahrungsfachkraft|ernahrungsberater|facharzt|spezialist)|\b(?:arzt|ernahrungsfachkraft|ernahrungsberater|spezialist)\b|(?:consultez|demandez|contactez).*?(?:medecin|dieteticien|professionnel|specialiste)|\b(?:medecin|dieteticien|professionnel de sante|specialiste)\b|(?:consulta|consulte|pregunta|contacta).*?(?:medico|dietista|profesional|especialista)|\b(?:medico|dietista|profesional de salud|especialista)\b|(?:consulte|pergunte|contacte).*?(?:medico|nutricionista|profissional|especialista)|\b(?:medico|nutricionista|profissional de saude|especialista)\b|(?:poradte|kontaktujte|zeptejte).*?(?:lekarem|lekar|nutricnim specialistou|odbornikem|specialistou)|\b(?:lekar|nutricni specialista|odbornik|specialista)\b/i,
  },
  {
    issue: "covenant_referral_language",
    pattern:
      /\b(?:diyetisyen\w*|doktor\w*|hekim\w*|uzman\w*|profesyonel\w*|doctor\w*|dietitian\w*|professional\w*|expert\w*|specialist\w*|physician\w*|arzt\w*|ernahrungsfachkraft\w*|ernahrungsberater\w*|facharzt\w*|spezialist\w*|medecin\w*|dieteticien\w*|professionnel\w*|specialiste\w*|medico\w*|dietista\w*|profesional\w*|nutricionista\w*|lekar\w*|odbornik\w*)\b/i,
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
  issues.push(...detectProductCommunicationCovenantIssues(text));

  return {
    allowed: issues.length === 0,
    issues: Array.from(new Set(issues)),
  };
}

export function guardProviderOutput({
  output,
  capsule,
  riskDecision,
  foodRule = null,
  foodDecisionV2 = null,
  structuredFoodRules = null,
  claimManifest = null,
  styleDna = null,
}) {
  const assistant = guardAssistantReply({ draft: output, capsule, riskDecision });
  const issues = assistant.issues.map((issue) => ({
    code: issue,
    severity: "block",
    category: issue.startsWith("covenant_") ? "product_communication" : "clinical",
    evidence: "pattern",
  }));

  issues.push(
    ...detectFoodRuleOutputViolations(output, { foodRule, structuredFoodRules }).map((code) => ({
      code,
      severity: "block",
      category: "food_rule",
      evidence: "food_rule_decision",
    })),
  );
  issues.push(
    ...detectFoodDecisionV2OutputViolations(output, { foodDecisionV2 }).map((code) => ({
      code,
      severity: "block",
      category: "food_decision_v2",
      evidence: "food_decision_v2",
    })),
  );

  issues.push(
    ...detectClaimManifestOutputViolations(output, { claimManifest }).map((code) => ({
      code,
      severity: "block",
      category: "claim_manifest",
      evidence: "claim_manifest_v1",
    })),
  );

  issues.push(
    ...detectHardStyleGuardViolations(output, styleDna).map((code) => ({
      code,
      severity: "block",
      category: "style_dna",
      evidence: "style_dna_v2",
    })),
  );

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

export function detectFoodDecisionV2OutputViolations(output, { foodDecisionV2 = null } = {}) {
  if (!foodDecisionV2?.decision || foodDecisionV2.decision === "not_applicable") return [];

  const normalizedText = normalizeForSafetyPatterns(output);
  const issues = [];

  if (foodDecisionV2.decision === "forbid" && hasForbiddenFoodApprovalLanguage(normalizedText)) {
    issues.push("food_decision_v2_forbidden_food_approved");
  }

  if (foodDecisionV2.decision === "discourage" && hasForbiddenFoodApprovalLanguage(normalizedText)) {
    issues.push("food_decision_v2_discourage_strong_approval");
  }

  if (foodDecisionV2.decision === "needs_label" && hasForbiddenFoodApprovalLanguage(normalizedText)) {
    issues.push("food_decision_v2_needs_label_answered_as_allowed");
  }

  return Array.from(new Set(issues));
}

export function detectFoodRuleOutputViolations(output, { foodRule = null, structuredFoodRules = null } = {}) {
  if (!foodRule?.decision || foodRule.decision === "not_applicable") return [];

  const normalizedText = normalizeForSafetyPatterns(output);
  const issues = [];

  if (FOOD_RULE_REJECTION_DECISIONS.has(foodRule.decision)) {
    if (hasForbiddenFoodApprovalLanguage(normalizedText)) {
      issues.push("food_rule_forbidden_food_approved");
    }
  }

  if (foodRule.decision !== "optional_skip_allowed" && !hasSkipToleranceSource(structuredFoodRules)) {
    if (foodRuleSkipRelaxationPatterns.some((pattern) => pattern.test(normalizedText))) {
      issues.push("food_rule_unauthorized_skip_relaxation");
    }
  }

  if (foodRulePortionMacroPatterns.some((pattern) => pattern.test(normalizedText))) {
    issues.push("food_rule_portion_or_macro_change");
  }

  if (
    foodRule.decision !== "equivalent_substitution_allowed" &&
    foodRuleUnauthorizedSubstitutionPatterns.some((pattern) => pattern.test(normalizedText))
  ) {
    issues.push("food_rule_unauthorized_substitution");
  }

  return Array.from(new Set(issues));
}

function hasForbiddenFoodApprovalLanguage(normalizedText) {
  return foodRuleStrongEatApprovalPatterns.some((pattern) => pattern.test(normalizedText));
}

function hasSkipToleranceSource(structuredFoodRules) {
  if (!structuredFoodRules || typeof structuredFoodRules !== "object") return false;
  const optional = Array.isArray(structuredFoodRules.optionalFoodsOrMeals)
    ? structuredFoodRules.optionalFoodsOrMeals
    : [];
  return optional.length > 0 || Boolean(String(structuredFoodRules.skipToleranceRules || "").trim());
}

export function hasMissingHistoricalContextToken(output) {
  return /\[ERROR:\s*missing_historical_context\]|missing_historical_context/i.test(String(output || ""));
}

export function detectProductCommunicationCovenantIssues(text) {
  const normalizedText = normalizeForSafetyPatterns(text)
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00e7/g, "c");
  const issues = [];

  for (const rule of covenantPatterns) {
    if (rule.pattern.test(normalizedText)) issues.push(rule.issue);
  }

  return Array.from(new Set(issues));
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

// Intentionally separate from normalizeSafetyText: includes mojibake repair for provider output bytes.
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
