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
      /bayil/i,
      /siddetli karin agr/i,
      /severe abdominal pain/i,
      /kan kus/i,
    ],
  },
  {
    reason: "possible_severe_allergic_reaction",
    patterns: [/alerji.*nefes/i, /bogaz.*sis/i, /dilim.*sis/i, /anafilaksi/i],
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
    ],
  },
  {
    reason: "self_harm_or_suicidal_language",
    patterns: [/kendime zarar/i, /yasamak istemiyorum/i, /intihar/i],
  },
  {
    reason: "medication_or_insulin_dosing",
    patterns: [
      /insulin.*kac/i,
      /insulin.*how much/i,
      /ilac.*doz/i,
      /medication.*dose/i,
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
    patterns: [/hamileyim.*kanama/i, /gebeyim.*kanama/i, /hamileyim.*siddetli/i, /pregnant.*bleed/i],
  },
];

const yellowRules = [
  {
    reason: "medical_condition_context",
    patterns: [/diyabet/i, /bobrek/i, /karaciger/i, /tiroid/i, /pcos/i, /hipertansiyon/i, /kolesterol/i],
  },
  {
    reason: "lab_or_diagnostic_result",
    patterns: [/tahlil/i, /kan sonucu/i, /degerim/i, /hba1c/i, /ferritin/i, /d vitamini/i],
  },
  {
    reason: "supplement_or_medication_question",
    patterns: [/takviye/i, /protein tozu/i, /kreatin/i, /vitamin/i, /damla/i, /ilac/i],
  },
  {
    reason: "plan_change_request",
    patterns: [/diyetimi.*degistir/i, /kalorimi/i, /ogun.*atla/i, /oruc/i, /intermittent/i],
  },
  {
    reason: "pregnancy_or_lactation_context",
    patterns: [/hamileyim/i, /gebeyim/i, /emziriyorum/i],
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
  if (yellowReasons.length > 0 || clientRiskReasons.length > 0) {
    return decision("yellow", [...yellowReasons, ...clientRiskReasons], clientProfile);
  }

  return decision("green", [], clientProfile);
}

function normalizeText(message) {
  return String(message || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

function collectReasons(text, rules) {
  return rules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(text)))
    .map((rule) => rule.reason);
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
