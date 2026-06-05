export const GREEN_INTENT_TAXONOMY_VERSION = "green-intent-taxonomy-v0.1.0";

const GREEN_INTENT_RULES = [
  {
    family: "green_allowed_substitution",
    pattern:
      /\b(?:yerine|alternatif|degisim|swap|replace|substitute|instead|neyle degistir|neyi degistir)\b/i,
  },
  {
    family: "green_plan_lookup",
    pattern:
      /\b(?:ne yiyebilirim|kahvalti|ogle|aksam|ara ogun|ogun|planimda|bugun ne var|meal|breakfast|lunch|dinner|snack)\b/i,
  },
  {
    family: "green_meal_reminder",
    pattern: /\b(?:hatirlat|saat|zaman|remind|when should)\b/i,
  },
  {
    family: "green_logistics",
    pattern: /\b(?:randevu|saat kacta|adres|link|appointment|address)\b/i,
  },
  {
    family: "green_behavior_support",
    pattern: /\b(?:zorlan|motivasyon|canim .* istiyor|destek|motivation|craving)\b/i,
  },
  {
    family: "green_progress_logging",
    pattern: /\b(?:kaydettim|yaptim|yurudum|su ictim|plana uydum|logged|completed|walked)\b/i,
  },
  {
    family: "green_general_education",
    pattern: /\b(?:nedir|farki ne|lif|fiber|water|su neden)\b/i,
  },
  {
    family: "green_context_recap",
    pattern: /\b(?:ozet|hatirla|recap|summary)\b/i,
  },
];

const SENSITIVE_INTENT_RULES = [
  {
    family: "yellow_plan_change_request",
    pattern: /\b(?:diyetimi .*degistir|plan.*degistir|ogun.*atla|skip.*meal|oruc|intermittent)\b/i,
  },
  {
    family: "yellow_calorie_macro_portion_request",
    pattern:
      /\b(?:kalorim\w*|kalori hedef\w*|kalori.*(?:kac|ayarla|dusur|artir|hesapla|yap)|makrom\w*|makro hedef\w*|makro.*(?:kac|ayarla|hesapla)|protein hedef\w*|porsiyon.*artir|porsiyon.*cikar|portion.*(?:increase|double|target)|macro.*(?:target|calculate)|calorie.*(?:target|calculate|set))\b/i,
  },
  {
    family: "yellow_medication_supplement_request",
    pattern: /\b(?:ilac|insulin|metformin|takviye|vitamin|doz|supplement|medication|dose)\b/i,
  },
  {
    family: "yellow_lab_interpretation_request",
    pattern: /\b(?:tahlil|kan sonucu|hba1c|ferritin|lab|blood test)\b/i,
  },
  {
    family: "yellow_symptom_interpretation_request",
    pattern: /\b(?:basim don|midem bulan|ishal|kabiz|carpinti|symptom|dizzy|nausea)\b/i,
  },
  {
    family: "red_sensitive_context_or_emergency",
    pattern: /\b(?:hamile|gebe|emzir|cocuk|ergen|diyabet|diabetes|kus|purge|intihar|nefes|gogus|acil|emergency)\b/i,
  },
  {
    family: "yellow_active_plan_conflict",
    pattern: /\b(?:plana uymuyor|plan disi|yasak .*yemek|not in my plan)\b/i,
  },
];

export function evaluateGreenIntentTaxonomy({ promptContext, riskDecision, answerability }) {
  if (riskDecision?.level !== "green") {
    return buildDecision({
      decision: "not_applicable_non_green",
      allowed: true,
      intentFamily: null,
      blockedFamily: null,
      reasons: ["non_green_risk_not_downgraded"],
      sourceCategories: answerability?.sourceCategories || [],
    });
  }

  if (!promptContext || !Array.isArray(promptContext.segments)) {
    return buildDecision({
      decision: "blocked_sensitive_intent",
      allowed: false,
      intentFamily: null,
      blockedFamily: "prompt_context_missing",
      reasons: ["green_intent_taxonomy_prompt_context_missing"],
      sourceCategories: answerability?.sourceCategories || [],
    });
  }

  const currentMessage = normalize(currentMessageText(promptContext));
  for (const rule of SENSITIVE_INTENT_RULES) {
    if (rule.pattern.test(currentMessage)) {
      return buildDecision({
        decision: "blocked_sensitive_intent",
        allowed: false,
        intentFamily: null,
        blockedFamily: rule.family,
        reasons: ["green_intent_taxonomy_sensitive_family", rule.family],
        sourceCategories: answerability?.sourceCategories || [],
      });
    }
  }

  const matchedRule = GREEN_INTENT_RULES.find((rule) => rule.pattern.test(currentMessage));
  const intentFamily = matchedRule?.family || "green_low_risk_clarification";

  return buildDecision({
    decision: "green_intent_allowed",
    allowed: true,
    intentFamily,
    blockedFamily: null,
    reasons: ["green_intent_taxonomy_allowed", intentFamily],
    sourceCategories: answerability?.sourceCategories || [],
  });
}

function currentMessageText(promptContext) {
  return (promptContext.segments || []).find((segment) => segment.type === "current_message")?.text || "";
}

function buildDecision({ decision, allowed, intentFamily, blockedFamily, reasons, sourceCategories }) {
  return {
    version: GREEN_INTENT_TAXONOMY_VERSION,
    decision,
    allowed,
    intentFamily,
    blockedFamily,
    reasons,
    sourceCategories: Array.from(new Set(sourceCategories || [])),
  };
}

function normalize(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00e7/g, "c");
}
