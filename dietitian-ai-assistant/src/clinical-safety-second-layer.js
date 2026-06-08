import { normalizeSafetyText } from "./normalize-safety-text.js";
import { SAFETY_CLASSIFIER_VERSION, classifyConversationRisk } from "./safety-classifier.js";

export const CLINICAL_SAFETY_SECOND_LAYER_VERSION = "clinical-safety-second-layer-v0.2.0";
export const CLINICAL_SAFETY_CLASSIFIER_VERSION = `${SAFETY_CLASSIFIER_VERSION}+${CLINICAL_SAFETY_SECOND_LAYER_VERSION}`;

const AMBIGUOUS_REFERENCES = /\b(bunu|sunu|şunu|onu|ayni|aynı|onceki|önceki|dunku|dünkü|this|that|it|same|previous|yesterday)\b/i;
const CLINICAL_REFERENCE_CONTEXT =
  /takviye|vitamin|ilac|ilaç|damla|doz|protein|kreatin|supplement|medication|medicine|dose|lab|tahlil|kan sonucu|hba1c|ferritin|hamile|gebe|emzir|pregnan|breastfeed|lactat|diyet|plan/i;
const MISSING_HISTORY_REFERENCE =
  /dunku|dünkü|onceki|önceki|son konustugumuz|son konuştuğumuz|gecen sefer|geçen sefer|yesterday|previous|last time|same as/i;
const MINOR_WEIGHT_CONTEXT =
  /kilo|kalori|zayif|zayıf|ogun.*atla|öğün.*atla|body check|weight|calorie|skip.*meal|not eating|fast/i;
const AMBIGUOUS_RESTRICTION_CONTEXT =
  /az yedim|hafif gec|hafif geç|telafi|iyi gidiyor mu|yemeden|yemedim|not eating|make up for|compensat/i;

const FOOD_RULE_CARVE_OUT_DECISIONS = new Set([
  "forbidden_food_rejection",
  "allowed_food_confirmation",
  "equivalent_substitution_allowed",
  "diet_type_compatible",
  "diet_type_conflict",
  "optional_skip_allowed",
  "mandatory_skip_blocked",
]);

const ACUTE_CLINICAL_ESCALATION_PATTERN =
  /\b(?:nefes|bogaz|bogazim|sisti|anafilaksi|anaphylaxis|swelling|swell|acil|emergency|ambulans|ilac\w*|insulin\w*|metformin|takviye|supplement|medication|dose|doz|tahlil|lab|kan sonucu|belirti|symptom|hamile|pregnan|kalori hedef|makro hedef|porsiyon.*artir|portion.*increase|plan.*degistir|plan.*change)\b/i;

const INGESTION_REACTION_PATTERN =
  /\b(?:yedim|ictim|yemis|icmis|yedi|aldi|aldim|ate|had|consumed).{0,40}\b(?:kasin|kurde|dokul|sis|nefes|bulanti|kus|titri|swell|itch|hives|breath)\b|\b(?:kasin|kurde|nefes|bogaz).{0,40}\b(?:yedim|ictim|yemis|icmis|ate|had)\b/i;

const FOOD_PERMISSION_QUERY_PATTERN =
  /\b(?:yiyebilir|icebilir|yersem|icersem|yemek|icmek|olur\s*mu|can\s+i\s+eat|can\s+i\s+have|can\s+i\s+drink|is\s+it\s+ok|yerine|instead\s+of|substitut|atlayabilir|skip)\b/i;

export function classifyClinicalSafetyRisk({
  message,
  recentMessages = [],
  clientProfile = {},
  foodRuleDecision = null,
}) {
  const baseDecision = classifyConversationRisk({ message, recentMessages, clientProfile });
  const secondLayer = evaluateClinicalSafetySecondLayer({
    message,
    recentMessages,
    clientProfile,
    baseDecision,
    foodRuleDecision,
  });

  if (!secondLayer.escalate) {
    return withSecondLayerMetadata(baseDecision, secondLayer);
  }

  return withSecondLayerMetadata(
    {
      ...baseDecision,
      level: "yellow",
      reasons: uniqueReasons([...baseDecision.reasons, ...secondLayer.reasons]),
      shouldHandoff: true,
      pauseAutopilot: baseDecision.pauseAutopilot,
    },
    secondLayer,
  );
}

export function evaluateClinicalSafetySecondLayer({
  message,
  recentMessages = [],
  clientProfile = {},
  baseDecision,
  foodRuleDecision = null,
}) {
  if (baseDecision?.level && baseDecision.level !== "green") {
    return decision(false, []);
  }

  const text = normalizeSafetyText(message);
  const recentTexts = recentMessages
    .map((item) => normalizeSafetyText(typeof item === "string" ? item : item?.body || ""))
    .filter(Boolean)
    .slice(-8);
  const healthProfile = clientProfile.healthProfile || clientProfile;
  const reasons = [];

  if (mentionsClientAllergyOrRestriction(text, clientProfile)) {
    reasons.push("second_layer_client_allergy_or_restriction_mentioned");
  }
  if (AMBIGUOUS_REFERENCES.test(text) && hasClinicalReferenceContext([text, ...recentTexts])) {
    reasons.push("second_layer_ambiguous_clinical_reference");
  }
  if (MISSING_HISTORY_REFERENCE.test(text) && recentTexts.length === 0) {
    reasons.push("second_layer_missing_history_reference");
  }
  if (healthProfile.adultStatus === "minor" && MINOR_WEIGHT_CONTEXT.test(text)) {
    reasons.push("second_layer_minor_weight_or_restriction_context");
  }
  if (healthProfile.eatingDisorderRiskFlag === true && AMBIGUOUS_RESTRICTION_CONTEXT.test(text)) {
    reasons.push("second_layer_eating_disorder_ambiguous_restriction");
  }

  const carveOut = applySourceBackedFoodRuleCarveOut({
    message,
    clientProfile,
    foodRuleDecision,
    reasons,
  });

  return decision(carveOut.reasons.length > 0, carveOut.reasons, carveOut.carveOut);
}

export function shouldApplySourceBackedFoodRuleCarveOut({
  message,
  clientProfile = {},
  foodRuleDecision = null,
  reasons = [],
}) {
  if (!reasons.includes("second_layer_client_allergy_or_restriction_mentioned")) {
    return false;
  }
  if (!foodRuleDecision || !FOOD_RULE_CARVE_OUT_DECISIONS.has(foodRuleDecision.decision)) {
    return false;
  }

  const text = normalizeSafetyText(message);
  if (!FOOD_PERMISSION_QUERY_PATTERN.test(text)) {
    return false;
  }
  if (ACUTE_CLINICAL_ESCALATION_PATTERN.test(text) || INGESTION_REACTION_PATTERN.test(text)) {
    return false;
  }
  if (hasSevereAllergyProfile(clientProfile)) {
    return false;
  }

  return true;
}

function applySourceBackedFoodRuleCarveOut({ message, clientProfile, foodRuleDecision, reasons }) {
  if (
    !shouldApplySourceBackedFoodRuleCarveOut({
      message,
      clientProfile,
      foodRuleDecision,
      reasons,
    })
  ) {
    return { reasons: uniqueReasons(reasons), carveOut: null };
  }

  return {
    reasons: uniqueReasons(reasons.filter((reason) => reason !== "second_layer_client_allergy_or_restriction_mentioned")),
    carveOut: {
      applied: true,
      reason: "second_layer_source_backed_food_rule_carveout",
      foodRuleDecision: foodRuleDecision.decision,
    },
  };
}

function decision(escalate, reasons, carveOut = null) {
  return {
    version: CLINICAL_SAFETY_SECOND_LAYER_VERSION,
    escalate,
    level: escalate ? "yellow" : "green",
    reasons: uniqueReasons(reasons),
    carveOut,
  };
}

function withSecondLayerMetadata(riskDecision, secondLayer) {
  return {
    ...riskDecision,
    reasons: uniqueReasons(riskDecision.reasons || []),
    classifierVersion: CLINICAL_SAFETY_CLASSIFIER_VERSION,
    layers: {
      baseClassifierVersion: SAFETY_CLASSIFIER_VERSION,
      secondLayerVersion: secondLayer.version,
      secondLayerReasons: secondLayer.reasons,
      secondLayerCarveOut: secondLayer.carveOut || null,
    },
  };
}

function mentionsClientAllergyOrRestriction(text, clientProfile) {
  const allergyTerms = [...(clientProfile.allergies || []), ...(clientProfile.restrictedFoods || [])]
    .map(normalizeSafetyText)
    .filter((term) => term.length >= 3);

  return allergyTerms.some((term) => text.includes(term));
}

function hasSevereAllergyProfile(clientProfile) {
  const healthProfile = clientProfile.healthProfile || clientProfile;
  const severity = normalizeSafetyText(healthProfile.allergySeverity || healthProfile.allergy_severity || "");
  return /agir|anafil/i.test(severity);
}

function hasClinicalReferenceContext(texts) {
  return texts.some((item) => CLINICAL_REFERENCE_CONTEXT.test(item));
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean)));
}
