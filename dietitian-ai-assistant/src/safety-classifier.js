export const SAFETY_CLASSIFIER_VERSION = "dietetic-risk-v0.3.0";

const redRules = [
  {
    reason: "possible_emergency_symptom",
    patterns: [
      /gogus agr/i,
      /gogsum agr/i,
      /nefes alam/i,
      /cant breathe/i,
      /can.?t breathe/i,
      /shortness of breath/i,
      /chest pain/i,
      /brustschmerz/i,
      /atemnot/i,
      /nicht atmen/i,
      /douleur thoracique/i,
      /mal a respirer/i,
      /dolor en el pecho/i,
      /no puedo respirar/i,
      /dor no peito/i,
      /nao consigo respirar/i,
      /bolest na hrudi/i,
      /nemuzu dychat/i,
      /bayil/i,
      /siddetli karin agr/i,
      /severe abdominal pain/i,
      /kan kus/i,
    ],
  },
  {
    reason: "possible_severe_allergic_reaction",
    patterns: [
      /alerji.*nefes/i,
      /bogaz.*sis/i,
      /dilim.*sis/i,
      /anafilaksi/i,
      /allerg.*breathe/i,
      /allerg.*breath/i,
      /allerg.*atem/i,
      /allerg.*respir/i,
      /alerg.*respir/i,
      /alerg.*dychat/i,
    ],
  },
  {
    reason: "possible_eating_disorder_crisis",
    patterns: [
      /kendimi kustur/i,
      /kusmak istiyorum/i,
      /yediklerimi cikar/i,
      /telafi.*kus/i,
      /hic yemek yemeyecegim/i,
      /laksatif/i,
      /mushil/i,
      /purge/i,
      /throw up/i,
      /erbrechen/i,
      /vomir/i,
      /vomitar/i,
      /zvracet/i,
    ],
  },
  {
    reason: "self_harm_or_suicidal_language",
    patterns: [
      /kendime zarar/i,
      /yasamak istemiyorum/i,
      /intihar/i,
      /hurt myself/i,
      /suicide/i,
      /suizid/i,
      /me faire du mal/i,
      /suicid/i,
      /hacerme dano/i,
      /machucar/i,
      /ublizit si/i,
    ],
  },
  {
    reason: "medication_or_insulin_dosing",
    patterns: [
      /insulin.*kac/i,
      /insulin.*how much/i,
      /ilac.*doz/i,
      /medication.*dose/i,
      /medication.*dosage/i,
      /medikament.*dosis/i,
      /dose.*medicament/i,
      /dosis.*medicamento/i,
      /dose.*medicamento/i,
      /davk.*lek/i,
      /dozu.*artir/i,
      /dozu.*azalt/i,
      /metformin.*(mg|doz|dose|artir|azalt|increase|decrease)/i,
    ],
  },
  {
    reason: "critical_glucose_issue",
    patterns: [/sekerim.*(40|50|60|300|400)/i, /blood sugar.*(40|50|60|300|400)/i, /hipoglisemi/i, /hiperglisemi/i],
  },
  {
    reason: "pregnancy_complication",
    patterns: [
      /hamileyim.*kanama/i,
      /gebeyim.*kanama/i,
      /hamileyim.*siddetli/i,
      /pregnant.*bleed/i,
      /schwanger.*blut/i,
      /enceinte.*saign/i,
      /embarazada.*sangr/i,
      /gravida.*sangr/i,
      /tehotna.*krvac/i,
    ],
  },
];

const yellowRules = [
  {
    reason: "medical_condition_context",
    patterns: [/diyabet/i, /diabetes/i, /diabet/i, /bobrek/i, /karaciger/i, /tiroid/i, /thyroid/i, /pcos/i, /hipertansiyon/i, /hypertension/i, /kolesterol/i],
  },
  {
    reason: "lab_or_diagnostic_result",
    patterns: [/tahlil/i, /kan sonucu/i, /blood test/i, /lab result/i, /analyse/i, /analisis/i, /exame/i, /krevni test/i, /degerim/i, /hba1c/i, /ferritin/i, /d vitamini/i, /vitamin d/i],
  },
  {
    reason: "supplement_or_medication_question",
    patterns: [/takviye/i, /supplement/i, /erganzung/i, /complement/i, /suplement/i, /dopln/i, /protein tozu/i, /kreatin/i, /creatine/i, /vitamin/i, /damla/i, /ilac/i],
  },
  {
    reason: "plan_change_request",
    patterns: [/diyetimi.*degistir/i, /change.*diet/i, /diat.*ander/i, /changer.*regime/i, /cambiar.*dieta/i, /mudar.*dieta/i, /zmenit.*jidelnicek/i, /kalorimi/i, /ogun.*atla/i, /skip.*meal/i, /oruc/i, /intermittent/i],
  },
  {
    reason: "pregnancy_or_lactation_context",
    patterns: [
      /hamileyim/i,
      /gebeyim/i,
      /emziriyorum/i,
      /pregnant/i,
      /pregnancy/i,
      /breastfeed/i,
      /lactat/i,
      /schwanger/i,
      /stillen/i,
      /enceinte/i,
      /grossesse/i,
      /allaite/i,
      /embarazada/i,
      /embarazo/i,
      /lactancia/i,
      /gravida/i,
      /amament/i,
      /tehotna/i,
      /kojim/i,
    ],
  },
  {
    reason: "prompt_injection_attempt",
    patterns: [
      /ignore.*instructions/i,
      /ignore.*previous/i,
      /system prompt/i,
      /developer message/i,
      /act as/i,
      /jailbreak/i,
      /bypass.*rules/i,
      /override.*instructions/i,
      /talimatlari.*gorme/i,
      /onceki.*talimat/i,
      /kurallari.*yok say/i,
      /sen artik/i,
    ],
  },
  {
    reason: "symptom_question",
    patterns: [/basim don/i, /midem bulan/i, /ishal/i, /kabiz/i, /carpinti/i],
  },
  {
    reason: "minor_or_body_image_weight_loss",
    patterns: [
      /1[4-7]\s*yas/i,
      /teen/i,
      /ergen/i,
      /cok hizli kilo/i,
      /hizli kilo ver/i,
      /asiri kilo vermek/i,
      /body check/i,
    ],
  },
];

export function classifyDieteticRisk(message, clientProfile = {}) {
  const text = normalizeText(message);
  const redReasons = collectReasons(text, redRules);
  if (redReasons.length > 0) {
    return decision("red", redReasons, clientProfile);
  }

  const yellowReasons = collectReasons(text, yellowRules);
  const clientRiskReasons = clientProfile.highRisk === true ? ["client_marked_high_risk"] : [];
  const profileFlagReasons = collectProfileFlagReasons(text, clientProfile);
  if (yellowReasons.length > 0 || clientRiskReasons.length > 0 || profileFlagReasons.length > 0) {
    return decision("yellow", [...yellowReasons, ...clientRiskReasons, ...profileFlagReasons], clientProfile);
  }

  return decision("green", [], clientProfile);
}

export function classifyConversationRisk({ message, recentMessages = [], clientProfile = {} }) {
  const currentDecision = classifyDieteticRisk(message, clientProfile);
  if (currentDecision.level !== "green") return currentDecision;

  const windowText = [...recentMessages, { body: message }]
    .map((item) => normalizeText(typeof item === "string" ? item : item?.body || ""))
    .filter(Boolean)
    .slice(-8);
  const cumulativeReasons = collectCumulativeReasons(windowText);

  if (cumulativeReasons.length > 0) {
    return decision("yellow", cumulativeReasons, clientProfile);
  }

  return currentDecision;
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

function collectReasons(text, rules) {
  return rules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(text)))
    .map((rule) => rule.reason);
}

function collectCumulativeReasons(messages) {
  const reasons = [];
  const mealRestrictionCount = countMatches(messages, [
    /hic yemek yemedim/i,
    /\byemedim\b/i,
    /yemeye gerek yok/i,
    /ogun.*atla/i,
    /skip.*meal/i,
    /not eating/i,
    /did not eat/i,
  ]);
  const bodyImageCount = countMatches(messages, [
    /hizli kilo ver/i,
    /cok hizli kilo/i,
    /body check/i,
    /asiri kilo/i,
    /zayiflamam lazim/i,
    /lose weight fast/i,
  ]);
  const symptomCount = countMatches(messages, [
    /basim don/i,
    /midem bulan/i,
    /carpinti/i,
    /ishal/i,
    /kabiz/i,
    /dizzy/i,
    /nausea/i,
    /palpitation/i,
  ]);

  if (mealRestrictionCount >= 2) reasons.push("cumulative_meal_restriction_pattern");
  if (bodyImageCount >= 2) reasons.push("cumulative_body_image_weight_loss_pattern");
  if (symptomCount >= 2) reasons.push("cumulative_repeated_symptom_pattern");

  return reasons;
}

function collectProfileFlagReasons(text, clientProfile) {
  const reasons = [];
  const healthProfile = clientProfile.healthProfile || clientProfile;

  if (healthProfile.diagnosedConditionFlag === true && matchesDietOrSymptomContext(text)) {
    reasons.push("profile_diagnosed_condition_context");
  }
  if (healthProfile.medicationOrSupplementFlag === true && matchesMedicationSupplementOrSymptomContext(text)) {
    reasons.push("profile_medication_or_supplement_context");
  }
  if (healthProfile.pregnancyOrBreastfeedingFlag === true && matchesPregnancySensitiveContext(text)) {
    reasons.push("profile_pregnancy_or_breastfeeding_context");
  }
  if (healthProfile.eatingDisorderRiskFlag === true && matchesEatingDisorderSensitiveContext(text)) {
    reasons.push("profile_eating_disorder_risk_context");
  }

  return reasons;
}

function matchesDietOrSymptomContext(text) {
  return /kahvalti|ogle|aksam|ogun|ara ogun|yemek|diyet|plan|kalori|kilo|seker|basim don|midem|ishal|kabiz|meal|diet|plan|calorie|weight|blood sugar|dizzy|nausea/i.test(text);
}

function matchesMedicationSupplementOrSymptomContext(text) {
  return /takviye|vitamin|ilac|damla|protein|kreatin|supplement|medication|medicine|dose|symptom|basim don|midem|carpinti|dizzy|nausea|palpitation/i.test(text);
}

function matchesPregnancySensitiveContext(text) {
  return /kahvalti|ogle|aksam|ogun|yemek|diyet|plan|takviye|vitamin|kilo|kalori|meal|diet|plan|supplement|vitamin|weight|calorie/i.test(text);
}

function matchesEatingDisorderSensitiveContext(text) {
  return /kilo|kalori|zayif|yemedim|yemeye gerek yok|ogun.*atla|tarti|body check|weight|calorie|not eating|skip.*meal|fast/i.test(text);
}

function countMatches(messages, patterns) {
  return messages.filter((message) => patterns.some((pattern) => pattern.test(message))).length;
}

function decision(level, reasons, clientProfile) {
  return {
    level,
    reasons,
    classifierVersion: SAFETY_CLASSIFIER_VERSION,
    shouldHandoff: level !== "green",
    pauseAutopilot: level === "red" || clientProfile.highRisk === true,
  };
}
