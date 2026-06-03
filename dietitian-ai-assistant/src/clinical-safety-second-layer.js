import { SAFETY_CLASSIFIER_VERSION, classifyConversationRisk } from "./safety-classifier.js";

export const CLINICAL_SAFETY_SECOND_LAYER_VERSION = "clinical-safety-second-layer-v0.1.0";
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

export function classifyClinicalSafetyRisk({ message, recentMessages = [], clientProfile = {} }) {
  const baseDecision = classifyConversationRisk({ message, recentMessages, clientProfile });
  const secondLayer = evaluateClinicalSafetySecondLayer({
    message,
    recentMessages,
    clientProfile,
    baseDecision,
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

export function evaluateClinicalSafetySecondLayer({ message, recentMessages = [], clientProfile = {}, baseDecision }) {
  if (baseDecision?.level && baseDecision.level !== "green") {
    return decision(false, []);
  }

  const text = normalizeText(message);
  const recentTexts = recentMessages
    .map((item) => normalizeText(typeof item === "string" ? item : item?.body || ""))
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

  return decision(reasons.length > 0, reasons);
}

function decision(escalate, reasons) {
  return {
    version: CLINICAL_SAFETY_SECOND_LAYER_VERSION,
    escalate,
    level: escalate ? "yellow" : "green",
    reasons: uniqueReasons(reasons),
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
    },
  };
}

function mentionsClientAllergyOrRestriction(text, clientProfile) {
  const allergyTerms = [...(clientProfile.allergies || []), ...(clientProfile.restrictedFoods || [])]
    .map(normalizeText)
    .filter((term) => term.length >= 3);

  return allergyTerms.some((term) => text.includes(term));
}

function hasClinicalReferenceContext(texts) {
  return texts.some((item) => CLINICAL_REFERENCE_CONTEXT.test(item));
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function normalizeText(message) {
  return String(message || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
