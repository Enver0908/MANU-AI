import { normalizeSafetyText } from "./normalize-safety-text.js";
import {
  resolveFoodDecisionV2IntentFamily,
  resolveFoodIntentFamily,
} from "./intent-family-mappings.js";

export const CANONICAL_INTENT_RESOLVER_V2_VERSION = "canonical-intent-resolver-v2-v0.1.0";

export const CANONICAL_INTENT_WORKFLOW_STATES = [
  "unknown_intent",
  "needs_label",
  "needs_review",
  "clarify",
  "handoff",
  "block",
];

const GREEN_INTENT_RULES = [
  {
    family: "green_allowed_substitution",
    pattern:
      /\b(?:yerine|alternatif|degisim|swap|replace|substitute|instead|neyle degistir|neyi degistir)\b/i,
  },
  {
    family: "green_plan_lookup",
    pattern:
      /\b(?:ne yiyebilirim|ne var|kahvalt\w*|ogle\w*|aksam\w*|ara ogun|ogun|planimda|bugun ne var|meal|breakfast|lunch|dinner|snack)\b/i,
  },
  {
    family: "green_allowed_food_confirmation",
    pattern: /\b(?:yiyebilir miyim|icer miyim|yiyebilirim|icebilir miyim)\b/i,
  },
  {
    family: "green_low_risk_clarification",
    pattern:
      /\b(?:(?:sekerim \d+|kan sekerim \d+).*(?:normal mi|iyi mi)|(?:icsem|icerim).*(?:sorun olur mu|problem olur mu))\b/i,
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
    pattern: /\b(?:kaydettim|yaptim|yurudum|su ictim|plana uydum|logged|completed|walked|harcadim|harcatim)\b/i,
  },
  {
    family: "green_general_education",
    pattern: /\b(?:nedir|farki ne|lif|fiber|water|su neden)\b/i,
  },
  {
    family: "green_context_recap",
    pattern: /\b(?:ozet|hatirla|recap|summary|gecen hafta konustugumuz|daha once konustugumuz)\b/i,
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
    family: "yellow_active_plan_structural_change",
    pattern: /\b(?:planimi tamamen|diyet planimi yeniden|ogun programini degistir|change my entire plan|restructure my plan)\b/i,
  },
];

const AMBIGUOUS_NEGATION_PATTERN =
  /\b(?:hem .* hem|ya da belki|sanirim|galiba|emin degilim|herhalde|bilmiyorum|kararsizim)\b/i;

const CLEAR_NEGATION_SUBSTITUTION_PATTERN =
  /\b(?:yiyemem|yemem|icemem|icmem|tuketemem|alamam)\b[\s\S]{0,80}\b(?:ama|fakat|ancak)\b[\s\S]{0,80}\b(?:olur mu|yiyebilir|icer|yerine)\b/i;

const PRODUCT_LABEL_CONTEXT_PATTERN =
  /\b(?:icindekiler|ingredient|etiket|label|cikolata|biskuvi|urun|ambalaj)\b/i;

const PORTION_AMBIGUITY_PATTERN =
  /\b(?:bir|iki|uc|1|2|3)\s+(?:dilim|porsiyon|bardak|kasik|ogun)\b[\s\S]{0,40}\b(?:mi|mı|mu|mü)\b/i;

const PORTION_AMBIGUITY_EN_PATTERN =
  /\b(?:one|two|1|2)\s+(?:slice|portion|cup|serving|piece)\b[\s\S]{0,24}\b(?:or|\/)\b[\s\S]{0,24}\b(?:one|two|1|2)\b/i;

export function resolveCanonicalIntentV2({
  message,
  riskDecision,
  foodDecisionV2 = null,
  foodRule = null,
}) {
  if (riskDecision?.level !== "green") {
    return buildResult({
      decision: "not_applicable_non_green",
      allowed: true,
      intentFamily: null,
      blockedFamily: null,
      precedenceStage: "non_green",
      workflowState: null,
      reasons: ["canonical_intent_non_green"],
    });
  }

  const normalizedMessage = normalizeSafetyText(message);
  if (!normalizedMessage) {
    return unknownIntentResult(["canonical_intent_empty_message"], "clarify");
  }

  for (const rule of SENSITIVE_INTENT_RULES) {
    if (rule.pattern.test(normalizedMessage)) {
      return buildResult({
        decision: "blocked_sensitive_intent",
        allowed: false,
        intentFamily: null,
        blockedFamily: rule.family,
        precedenceStage: "sensitive",
        workflowState: "handoff",
        reasons: ["canonical_intent_sensitive_family", rule.family],
      });
    }
  }

  if (
    AMBIGUOUS_NEGATION_PATTERN.test(normalizedMessage) &&
    !PRODUCT_LABEL_CONTEXT_PATTERN.test(normalizedMessage)
  ) {
    return unknownIntentResult(["canonical_intent_ambiguous_negation"], "clarify");
  }

  if (PORTION_AMBIGUITY_PATTERN.test(normalizedMessage) || PORTION_AMBIGUITY_EN_PATTERN.test(normalizedMessage)) {
    return unknownIntentResult(["canonical_intent_portion_ambiguity"], "clarify");
  }

  const foodDecisionV2Intent = resolveFoodDecisionV2IntentFamily(foodDecisionV2);
  if (foodDecisionV2Intent) {
    return buildResult({
      decision: "canonical_intent_resolved",
      allowed: true,
      intentFamily: foodDecisionV2Intent,
      blockedFamily: null,
      precedenceStage: "food_decision_v2",
      workflowState: mapFoodDecisionWorkflowState(foodDecisionV2),
      reasons: ["canonical_intent_food_decision_v2", foodDecisionV2Intent, foodDecisionV2.decision],
      foodDecisionV2: foodDecisionV2.decision,
      foodQueryType: foodDecisionV2.queryType || null,
    });
  }

  const foodRuleIntent = resolveFoodIntentFamily(foodRule);
  if (foodRuleIntent) {
    return buildResult({
      decision: "canonical_intent_resolved",
      allowed: true,
      intentFamily: foodRuleIntent,
      blockedFamily: null,
      precedenceStage: "food_rule",
      workflowState: null,
      reasons: ["canonical_intent_food_rule", foodRuleIntent, foodRule.decision],
      foodRuleDecision: foodRule.decision,
      foodQueryType: foodRule.queryType || null,
    });
  }

  if (CLEAR_NEGATION_SUBSTITUTION_PATTERN.test(normalizedMessage)) {
    return buildResult({
      decision: "canonical_intent_resolved",
      allowed: true,
      intentFamily: "green_allowed_substitution",
      blockedFamily: null,
      precedenceStage: "explicit_green",
      workflowState: null,
      reasons: ["canonical_intent_negation_substitution", "green_allowed_substitution"],
    });
  }

  const matchedGreenRule = GREEN_INTENT_RULES.find((rule) => rule.pattern.test(normalizedMessage));
  if (matchedGreenRule) {
    return buildResult({
      decision: "canonical_intent_resolved",
      allowed: true,
      intentFamily: matchedGreenRule.family,
      blockedFamily: null,
      precedenceStage: "explicit_green",
      workflowState: null,
      reasons: ["canonical_intent_explicit_green", matchedGreenRule.family],
    });
  }

  return unknownIntentResult(["canonical_intent_unknown"], "clarify");
}

export function mapCanonicalIntentToGreenTaxonomy(canonicalIntent) {
  if (!canonicalIntent) {
    return {
      decision: "blocked_unknown_intent",
      allowed: false,
      intentFamily: "unknown_intent",
      blockedFamily: null,
      reasons: ["canonical_intent_missing"],
      workflowState: "clarify",
    };
  }

  if (canonicalIntent.decision === "not_applicable_non_green") {
    return {
      decision: "not_applicable_non_green",
      allowed: true,
      intentFamily: null,
      blockedFamily: null,
      reasons: canonicalIntent.reasons,
      workflowState: null,
    };
  }

  if (canonicalIntent.decision === "blocked_sensitive_intent") {
    return {
      decision: "blocked_sensitive_intent",
      allowed: false,
      intentFamily: null,
      blockedFamily: canonicalIntent.blockedFamily,
      reasons: canonicalIntent.reasons,
      workflowState: canonicalIntent.workflowState,
    };
  }

  if (canonicalIntent.intentFamily === "unknown_intent" || canonicalIntent.allowed === false) {
    return {
      decision: "blocked_unknown_intent",
      allowed: false,
      intentFamily: "unknown_intent",
      blockedFamily: null,
      reasons: canonicalIntent.reasons,
      workflowState: canonicalIntent.workflowState || "clarify",
    };
  }

  return {
    decision: "green_intent_allowed",
    allowed: true,
    intentFamily: canonicalIntent.intentFamily,
    blockedFamily: null,
    reasons: canonicalIntent.reasons,
    workflowState: canonicalIntent.workflowState,
  };
}

function unknownIntentResult(reasons, workflowState) {
  return buildResult({
    decision: "blocked_unknown_intent",
    allowed: false,
    intentFamily: "unknown_intent",
    blockedFamily: null,
    precedenceStage: "unknown",
    workflowState,
    reasons: [...reasons, "fail_closed_no_autopilot"],
  });
}

function mapFoodDecisionWorkflowState(foodDecisionV2) {
  if (!foodDecisionV2) return null;
  if (foodDecisionV2.decision === "needs_label") return "needs_label";
  if (foodDecisionV2.decision === "needs_review") return "needs_review";
  return null;
}

function buildResult({
  decision,
  allowed,
  intentFamily,
  blockedFamily,
  precedenceStage,
  workflowState,
  reasons,
  foodDecisionV2 = null,
  foodRuleDecision = null,
  foodQueryType = null,
}) {
  return {
    version: CANONICAL_INTENT_RESOLVER_V2_VERSION,
    decision,
    allowed,
    intentFamily,
    blockedFamily,
    precedenceStage,
    workflowState,
    reasons,
    foodDecisionV2,
    foodRuleDecision,
    foodQueryType,
  };
}
