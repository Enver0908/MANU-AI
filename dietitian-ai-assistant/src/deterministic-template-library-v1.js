export const DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION = "deterministic-template-library-v1-v0.1.0";

export const KNOWN_TEMPLATE_IDS = [
  "allowed_food_answer_v1",
  "allowed_substitution_v1",
  "plan_lookup_v1",
  "forbidden_food_response_v1",
  "discouraged_food_response_v1",
  "ingredient_label_request_v1",
  "low_risk_clarification_v1",
  "unknown_intent_clarify_v1",
  "source_unsupported_answer_v1",
  "yellow_red_handoff_v1",
  "logistics_reply_v1",
  "meal_reminder_v1",
  "context_recap_v1",
  "provider_styled_send_v1",
  "provider_styled_draft_v1",
];

const KNOWN_TEMPLATE_ID_SET = new Set(KNOWN_TEMPLATE_IDS);

const INTERNAL_METADATA_MARKERS = [
  /internal_reason=/i,
  /workflowState/i,
  /intentFamily=/i,
  /replyMode=/i,
  /templateId=/i,
  /claim_manifest/i,
  /style_dna/i,
  /raw_label/i,
];

const TEMPLATE_COPY = {
  allowed_food_answer_v1: {
    tr: "Kayitli planina gore bu secenek uygun gorunuyor. Porsiyonu planindaki olcuye sadik kal.",
    en: "Based on your recorded plan, this option looks appropriate. Keep the portion aligned with your plan.",
  },
  allowed_substitution_v1: {
    tr: "Planindaki esdeger degisim kurallarina gore uygun bir alternatif secebilirsin.",
    en: "You can choose an appropriate alternative within your plan's equivalent exchange rules.",
    de: "Sie konnen innerhalb der aquivalenten Austauschregeln Ihres Plans eine passende Alternative wahlen.",
  },
  plan_lookup_v1: {
    tr: "Bugunku planindaki onerilen ogun seceneklerine sadik kalabilirsin. Belirli bir ogun soruyorsan yaz.",
    en: "You can stay with today's planned meal options. Tell me which meal you mean if you need details.",
  },
  forbidden_food_response_v1: {
    tr: "Bu gida su anki planinda yer almiyor. Planina uygun bir alternatif sorarsan yardimci olabilirim.",
    en: "This food is not in your current plan. Ask about a plan-aligned alternative and I can help.",
  },
  discouraged_food_response_v1: {
    tr: "Bu secenek planinda sinirli veya onerilmeyen grupta. Mumkunse planindaki tercihlere yakin kal.",
    en: "This option is limited or discouraged in your plan. When possible, stay close to your planned preferences.",
  },
  ingredient_label_request_v1: {
    tr: "Urunu net degerlendirebilmem icin lutfen icindekiler bilgisini yazabilir veya etiket fotografini paylasabilir misiniz?",
    en: "To evaluate this product clearly, could you share the ingredient list or a photo of the label?",
  },
  low_risk_clarification_v1: {
    tr: "Porsiyon veya secim net degil. Bir dilim mi, bir kase mi yoksa baska bir olcu mu istedigini yazabilir misin?",
    en: "The portion or choice is unclear. Could you say whether you mean one slice, one bowl, or another amount?",
  },
  unknown_intent_clarify_v1: {
    tr: "Mesajini tam anlayamadim. Ne yemek veya ne degistirmek istedigini bir cumleyle yazabilir misin?",
    en: "I did not fully understand your message. Could you write in one sentence what food or change you mean?",
  },
  source_unsupported_answer_v1: {
    tr: "Bu soruyu planindaki kayitli bilgilere dayanarak yanitlayamiyorum. Inceleme kaydi olusturuldu.",
    en: "I cannot answer this from your recorded plan sources. A review record was created.",
  },
  yellow_red_handoff_v1: {
    tr: "Bu mesaj inceleme icin kaydedildi. Kisa sure icinde donus yapilacak.",
    en: "This message was saved for review. You will hear back shortly.",
  },
  logistics_reply_v1: {
    tr: "Randevu veya iletisim detayin icin ekipten donus gelecektir.",
    en: "For appointment or contact details, a follow-up from the care team will arrive.",
  },
  meal_reminder_v1: {
    tr: "Planindaki ogun saatine yaklastin. Hazir degilsen hafif bir alternatif sorabilirsin.",
    en: "You are close to your planned meal time. If you are not ready, ask about a light alternative.",
  },
  context_recap_v1: {
    tr: "Son konustugumuz noktalar planina uygun sekilde devam ediyor. Belirli bir ogun veya degisim soruyorsan yaz.",
    en: "What we discussed recently still fits your plan. Tell me which meal or change you mean.",
  },
  provider_styled_send_v1: {
    tr: "Planina uygun sekilde ilerleyebilirsin. Belirli bir yemek veya degisim soruyorsan yaz.",
    en: "You can continue within your plan. Tell me which food or change you mean.",
  },
  provider_styled_draft_v1: {
    tr: "Planina uygun bir yanit hazirlaniyor; onay bekleniyor.",
    en: "A plan-aligned reply is being prepared for approval.",
  },
};

export function isKnownTemplateId(templateId) {
  return typeof templateId === "string" && KNOWN_TEMPLATE_ID_SET.has(templateId);
}

export function assertClientFacingTemplateId(templateId) {
  if (!isKnownTemplateId(templateId)) {
    throw new Error("client_facing_template_id_required");
  }
}

export function renderDeterministicTemplate({
  templateId,
  language = "tr",
  replyMode = null,
  riskClass = null,
}) {
  assertClientFacingTemplateId(templateId);

  if (riskClass === "yellow" && replyMode === "draft" && templateId === "provider_styled_draft_v1") {
    return localize("yellow_red_handoff_v1", language);
  }

  if (riskClass === "yellow" && replyMode === "send") {
    return localize("yellow_red_handoff_v1", language);
  }

  return localize(templateId, language);
}

export function assertTemplateTextSafeForClient(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("template_text_empty");
  }

  for (const marker of INTERNAL_METADATA_MARKERS) {
    if (marker.test(text)) {
      throw new Error("template_text_internal_metadata_leak");
    }
  }
}

export function parseTemplateIdFromResponsePlanSegment(segmentText = "") {
  const match = String(segmentText).match(/templateId=([^;]+)/);
  const value = match?.[1]?.trim() || null;
  if (!value || value === "none") return null;
  return value;
}

export function parseReplyModeFromResponsePlanSegment(segmentText = "") {
  const match = String(segmentText).match(/replyMode=([a-z_]+)/);
  return match?.[1] || null;
}

export function parseRiskClassFromResponsePlanSegment(segmentText = "") {
  const match = String(segmentText).match(/riskClass=([a-z_]+)/);
  const value = match?.[1] || null;
  if (!value || value === "none") return null;
  return value;
}

function localize(templateId, language) {
  const copy = TEMPLATE_COPY[templateId];
  if (!copy) {
    throw new Error("client_facing_template_id_required");
  }

  const normalized = String(language || "tr").toLowerCase();
  const text = copy[normalized] || (normalized !== "tr" ? copy.en : null) || copy.tr;
  assertTemplateTextSafeForClient(text);
  return text;
}
