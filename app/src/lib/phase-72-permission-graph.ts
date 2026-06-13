import type { LaunchGateEvidenceRecord } from "./launch-gates";
import { PHASE_71_TURKIYE_SOURCE_PACK_VERSION } from "./phase-71-turkiye-official-sources";

export const PHASE_72_PERMISSION_GRAPH_VERSION = "phase-72-permission-graph-v1.1.0";

export type Phase72ApprovalStatus = "draft";

export type Phase72RoutingBand = "green" | "draft_only" | "handoff_no_send" | "quarantine" | "automation_off" | "internal_only";

export type Phase72SourceRef = {
  sourceFamily: string;
  phase71SourceId?: string;
};

export type Phase72ArtifactEntry = {
  id: string;
  label: string;
  routingBand: Phase72RoutingBand;
  sourceRefs: Phase72SourceRef[];
  approvalStatus: Phase72ApprovalStatus;
  rationale: string;
};

export type Phase72IntentId =
  | "plan_lookup"
  | "meal_reminder"
  | "allowed_substitution"
  | "plan_conflict"
  | "plan_change"
  | "calorie_macro"
  | "medication_insulin"
  | "supplement_dose"
  | "lab_result"
  | "symptom"
  | "diabetes_glucose"
  | "pregnancy_breastfeeding"
  | "minor_body_image"
  | "eating_disorder"
  | "general_nutrition_education"
  | "privacy_dsar"
  | "opt_out"
  | "unknown_identity"
  | "group_message";

export type Phase72FoodRuleIntentId =
  | "forbidden_food_reminder"
  | "allowed_food_confirmation"
  | "equivalent_substitution_allowed"
  | "diet_type_compatible"
  | "optional_skip_allowed"
  | "mandatory_skip_block"
  | "food_rule_uncertain_review"
  | "diet_type_conflict"
  | "product_ingredient_unknown"
  | "food_rule_mixed_intent";

export type Phase72FoodRuleDecisionLike = {
  decision: string;
  reasons?: string[];
  queryType?: string | null;
} | null;

export type Phase72PrivacyGateId =
  | "channel_permission_not_ready"
  | "opt_out_active"
  | "unknown_identity"
  | "group_message"
  | "legal_privacy_approval_missing"
  | "provider_vendor_approval_missing"
  | "whatsapp_policy_approval_missing"
  | "sensitive_data_consent_revoked"
  | "dsar_deletion_request";

export type Phase72PrivacyGateState = {
  channelPermissionReady: boolean;
  optOut: boolean;
  unknownIdentity: boolean;
  groupMessage: boolean;
  legalPrivacyApproval: boolean;
  providerVendorApproval: boolean;
  whatsappPolicyApproval: boolean;
  sensitiveDataConsentRevoked: boolean;
  dsarDeletionRequest: boolean;
};

export type Phase72ClinicalContext = {
  acuteEmergency: boolean;
  numericGlucoseRisk: boolean;
  pregnancyComplicationRisk: boolean;
  minorBodyImageRisk: boolean;
};

export type Phase72RoutingEvaluation = {
  graphVersion: string;
  approvalStatus: Phase72ApprovalStatus;
  activeProductionRoutingAllowed: boolean;
  finalRoutingBand: Phase72RoutingBand;
  intentIds: Phase72IntentId[];
  matchedIntentBands: Array<{ intentId: Phase72IntentId; routingBand: Phase72RoutingBand }>;
  triggeredPrivacyGates: Phase72PrivacyGateId[];
  mixedIntentFailClosed: boolean;
  blockingReasons: string[];
};

export type Phase72PermissionGraphBundle = {
  graphVersion: string;
  approvalStatus: Phase72ApprovalStatus;
  upstreamSourcePackVersion: string;
  forbiddenActionMap: Phase72ArtifactEntry[];
  draftOnlyActionMap: Phase72ArtifactEntry[];
  allowedPlanAnswerabilityMap: Phase72ArtifactEntry[];
  allowedGeneralEducationMap: Phase72ArtifactEntry[];
  sensitiveNeverPromptFieldMap: Phase72ArtifactEntry[];
  promptAllowedFieldMap: Phase72ArtifactEntry[];
  productCovenantForbiddenPhraseMap: Phase72ArtifactEntry[];
  legalPrivacyRoutingMap: Phase72ArtifactEntry[];
  clinicalEscalationRoutingMap: Phase72ArtifactEntry[];
  mixedIntentFailClosedPolicy: {
    id: string;
    approvalStatus: Phase72ApprovalStatus;
    rule: string;
    sourceRefs: Phase72SourceRef[];
  };
  foodRuleRoutingMap: Phase72ArtifactEntry[];
};

const DRAFT: Phase72ApprovalStatus = "draft";

const SOURCE_1219: Phase72SourceRef = {
  sourceFamily: "1219 sayili Tababet ve Suabati San'atlarinin Tarzi Icrasina Dair Kanun",
  phase71SourceId: "TR-P71-001",
};
const SOURCE_JOB_DEFINITIONS: Phase72SourceRef = {
  sourceFamily: "Saglik Meslek Mensuplari Is ve Gorev Tanimlari Yonetmeligi",
  phase71SourceId: "TR-P71-002",
};
const SOURCE_HEALTH_DATA_REG: Phase72SourceRef = {
  sourceFamily: "Kisisel Saglik Verileri Hakkinda Yonetmelik",
  phase71SourceId: "TR-P71-003",
};
const SOURCE_KVKK: Phase72SourceRef = {
  sourceFamily: "6698 sayili KVKK",
  phase71SourceId: "TR-P71-004",
};
const SOURCE_PATIENT_RIGHTS: Phase72SourceRef = {
  sourceFamily: "Hasta Haklari Yonetmeligi",
  phase71SourceId: "TR-P71-005",
};
const SOURCE_REMOTE_HEALTH: Phase72SourceRef = {
  sourceFamily: "Uzaktan Saglik Hizmetleri Yonetmeligi",
  phase71SourceId: "TR-P71-006",
};
const SOURCE_PROMOTION: Phase72SourceRef = {
  sourceFamily: "Saglik Hizmetlerinde Tanitim ve Bilgilendirme Yonetmeligi",
  phase71SourceId: "TR-P71-007",
};
const SOURCE_TUBER: Phase72SourceRef = {
  sourceFamily: "TUBER 2022",
  phase71SourceId: "TR-P71-008",
};
const SOURCE_DIABETES_PROGRAM: Phase72SourceRef = {
  sourceFamily: "Turkiye Diyabet Programi 2023-2027",
  phase71SourceId: "TR-P71-009",
};

function entry(
  id: string,
  label: string,
  routingBand: Phase72RoutingBand,
  sourceRefs: Phase72SourceRef[],
  rationale: string,
): Phase72ArtifactEntry {
  return { id, label, routingBand, sourceRefs, approvalStatus: DRAFT, rationale };
}

export const PHASE_72_FORBIDDEN_ACTION_MAP: Phase72ArtifactEntry[] = [
  entry("diagnosis", "Tani koyma", "handoff_no_send", [SOURCE_1219, SOURCE_JOB_DEFINITIONS], "Hekim/klinik karar alani."),
  entry("treatment_change", "Tedavi onerme veya degistirme", "handoff_no_send", [SOURCE_1219], "Saglik hizmeti/tibbi karar alani."),
  entry("medication_dose", "Ilac dozu", "handoff_no_send", [SOURCE_1219, SOURCE_DIABETES_PROGRAM], "Kritik klinik risk."),
  entry("insulin_dose", "Insulin dozu", "handoff_no_send", [SOURCE_DIABETES_PROGRAM], "Kritik ve acil risk potansiyeli."),
  entry("supplement_dose_decision", "Supplement dozu karari", "draft_only", [SOURCE_JOB_DEFINITIONS], "Klinik baglam gerektirir."),
  entry("lab_interpretation", "Lab/tahlil yorumlama", "handoff_no_send", [SOURCE_1219], "Klinik yorum gerektirir."),
  entry("symptom_interpretation", "Semptom yorumlama", "handoff_no_send", [SOURCE_1219], "Yanlis guvence/acil durum riski."),
  entry("emergency_management", "Acil durum yonetimi", "handoff_no_send", [SOURCE_REMOTE_HEALTH], "Red/no-send/manual lock."),
  entry("eating_disorder_coaching", "Eating disorder davranis yonlendirme", "handoff_no_send", [SOURCE_JOB_DEFINITIONS], "Zarar riski."),
  entry("minor_weight_pressure", "Minor icin kilo verme/baski dili", "handoff_no_send", [SOURCE_PROMOTION], "Klinik ve etik risk."),
  entry("pregnancy_complication_management", "Gebelik komplikasyonu yonetimi", "handoff_no_send", [SOURCE_1219], "Klinik risk."),
  entry("off_plan_macro_portion", "Plan disi kalori/makro/porsiyon belirleme", "draft_only", [SOURCE_JOB_DEFINITIONS], "Diyetisyen karari gerekir."),
  entry("disease_specific_nutrition_therapy", "Hastalik-spesifik beslenme tedavisi", "draft_only", [SOURCE_1219], "Klinik degerlendirme gerekir."),
  entry("raw_health_data_provider_egress", "Raw saglik verisini provider'a gonderme", "handoff_no_send", [SOURCE_KVKK, SOURCE_HEALTH_DATA_REG], "Privacy/launch gate riski."),
  entry("raw_identity_in_prompt", "Raw phone/channel identity prompt'a alma", "handoff_no_send", [SOURCE_KVKK], "Privacy/identity leakage."),
  entry("success_guarantee", "Basari vaadi veya garanti", "handoff_no_send", [SOURCE_PROMOTION], "Tanitim/reklam riski."),
  entry("miracle_claim", "Once/sonra, mucize, kesin sonuc iddiasi", "handoff_no_send", [SOURCE_PROMOTION], "Yaniltici tanitim riski."),
  entry("approve_forbidden_food", "Yasak besini client-facing onaylama", "handoff_no_send", [SOURCE_JOB_DEFINITIONS], "Structured food-rule engine forbid."),
  entry("unapproved_food_substitution", "Onaysiz besin degisimi", "draft_only", [SOURCE_JOB_DEFINITIONS], "Exchange group veya dietitian onayi gerekir."),
];

export const PHASE_72_DRAFT_ONLY_ACTION_MAP: Phase72ArtifactEntry[] = [
  entry("plan_change_request", "Plan degisikligi talebi", "draft_only", [SOURCE_JOB_DEFINITIONS], "Dietitian approval draft."),
  entry("portion_adjustment", "Porsiyon artirma/azaltma", "draft_only", [SOURCE_JOB_DEFINITIONS], "Dietitian approval draft."),
  entry("calorie_macro_target", "Kalori/makro hedefi", "draft_only", [SOURCE_JOB_DEFINITIONS], "Dietitian approval draft."),
  entry("weight_goal_change", "Kilo hedefi degisikligi", "draft_only", [SOURCE_JOB_DEFINITIONS], "Dietitian approval draft."),
  entry("supplement_start_stop", "Supplement baslama/birakma/doz", "draft_only", [SOURCE_JOB_DEFINITIONS], "Draft veya handoff."),
  entry("clinical_activity_adjustment", "Egzersiz/aktiviteyi klinik duruma gore ayarlama", "draft_only", [SOURCE_JOB_DEFINITIONS], "Draft veya handoff."),
  entry("disease_context_nutrition", "Hastalik baglaminda beslenme sorusu", "draft_only", [SOURCE_1219], "Draft veya handoff."),
  entry("pregnancy_breastfeeding_nutrition", "Gebelik/emzirme beslenme sorusu", "draft_only", [SOURCE_1219], "Draft veya handoff."),
  entry("diabetes_glucose_meal", "Diyabet/glukoz baglamli yemek/karbonhidrat sorusu", "draft_only", [SOURCE_DIABETES_PROGRAM], "Draft veya handoff."),
  entry("minor_body_image_question", "Minor/body image/kilo sorusu", "draft_only", [SOURCE_PROMOTION], "Draft veya handoff."),
  entry("plan_conflict_request", "Client planla celisen istek", "draft_only", [SOURCE_JOB_DEFINITIONS], "Draft veya handoff."),
  entry("personalized_official_source", "Genel resmi kaynak var ama kisisellestirme istiyor", "draft_only", [SOURCE_TUBER], "Draft veya handoff."),
  entry("legal_privacy_dsar", "Legal/privacy/DSAR sorusu", "internal_only", [SOURCE_KVKK, SOURCE_HEALTH_DATA_REG], "Internal legal/privacy workflow."),
  entry("patient_rights_complaint", "Hasta haklari/riza/sikayet", "internal_only", [SOURCE_PATIENT_RIGHTS], "Internal review."),
];

export const PHASE_72_ALLOWED_PLAN_ANSWERABILITY_MAP: Phase72ArtifactEntry[] = [
  entry("active_diet_plan_summary", "Aktif diyet plani ozeti", "green", [SOURCE_JOB_DEFINITIONS], "Plan lookup ve hatirlatma."),
  entry("meal_plan_slots", "Ogun saati ve plan lookup", "green", [SOURCE_JOB_DEFINITIONS], "Lojistik plan cevabi."),
  entry("allowed_substitutions", "Diyetisyen onayli alternatifler", "green", [SOURCE_JOB_DEFINITIONS], "Alerji/kisit kontrolu sart."),
  entry("forbidden_substitutions", "Planla celisen besini onermeme", "green", [SOURCE_JOB_DEFINITIONS], "Plan uyumu."),
  entry("restricted_foods_medical", "Kisitli besin hatirlatmasi", "green", [SOURCE_JOB_DEFINITIONS], "Yeni klinik yorum yok."),
  entry("restricted_foods_preference", "Tercihlere uygun plan hatirlatma", "green", [SOURCE_JOB_DEFINITIONS], "Tercih uyumu."),
  entry("allergies", "Alerjenlerden kacinma hatirlatmasi", "green", [SOURCE_JOB_DEFINITIONS], "Yeni klinik yorum yok."),
  entry("primary_goal", "Plandaki hedefi hatirlatma", "green", [SOURCE_JOB_DEFINITIONS], "Yeni hedef belirleme yok."),
  entry("pinned_notes", "Diyetisyen onayli not", "green", [SOURCE_JOB_DEFINITIONS], "Prompt-safe ozet."),
  entry("client_context_updates", "Diyetisyen onayli context update", "green", [SOURCE_JOB_DEFINITIONS], "Kisa onayli context."),
  entry("dietitian_manual_message", "Diyetisyen-authored manual message", "green", [SOURCE_JOB_DEFINITIONS], "Answerability kaynagi olabilir."),
  entry("forbidden_food_items", "Yasak besin listesi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule source."),
  entry("forbidden_food_groups", "Yasak besin gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule source."),
  entry("allowed_food_items", "Izinli besin listesi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule source."),
  entry("allowed_food_groups", "Izinli besin gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule source."),
  entry("equivalent_exchange_groups", "Esdeger degisim gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured substitution source."),
  entry("ingredient_allergen_keywords", "Alerjen anahtar kelimeleri", "green", [SOURCE_JOB_DEFINITIONS], "Product label verification source."),
  entry("skip_tolerance_rules", "Atlama tolerans kurallari", "green", [SOURCE_JOB_DEFINITIONS], "Optional skip source."),
];

export const PHASE_72_FOOD_RULE_ROUTING_MAP: Phase72ArtifactEntry[] = [
  entry("forbidden_food_reminder", "Yasak besin hatirlatma", "green", [SOURCE_JOB_DEFINITIONS], "Source-backed structured rule."),
  entry("allowed_food_confirmation", "Izinli besin onayi", "green", [SOURCE_JOB_DEFINITIONS], "Source-backed structured rule."),
  entry("equivalent_substitution_allowed", "Onayli esdeger degisim", "green", [SOURCE_JOB_DEFINITIONS], "Exchange group match."),
  entry("diet_type_compatible", "Diyet tipi uyumu", "green", [SOURCE_JOB_DEFINITIONS], "Diet-type rule match."),
  entry("optional_skip_allowed", "Opsiyonel skip toleransi", "green", [SOURCE_JOB_DEFINITIONS], "Skip tolerance source."),
  entry("mandatory_skip_block", "Zorunlu ogun atlama", "draft_only", [SOURCE_JOB_DEFINITIONS], "Mandatory meal protection."),
  entry("food_rule_uncertain_review", "Belirsiz besin karari", "draft_only", [SOURCE_JOB_DEFINITIONS], "Fail-closed review."),
  entry("diet_type_conflict", "Diyet tipi celiskisi", "draft_only", [SOURCE_JOB_DEFINITIONS], "Diet-type conflict."),
  entry("product_ingredient_unknown", "Urun icerigi belirsiz", "draft_only", [SOURCE_JOB_DEFINITIONS], "Trusted verification required."),
  entry("food_rule_mixed_intent", "Karisik besin+klinik intent", "handoff_no_send", [SOURCE_JOB_DEFINITIONS], "Mixed intent fail-closed."),
];

export const PHASE_72_ALLOWED_GENERAL_EDUCATION_MAP: Phase72ArtifactEntry[] = [
  entry("healthy_nutrition_principles", "Saglikli beslenme ilkeleri", "green", [SOURCE_TUBER], "Onayli resmi corpus, genel ve dusuk riskli."),
  entry("general_hydration_education", "Su tuketimi hakkinda genel egitim", "green", [SOURCE_TUBER], "Kisisellestirilmis miktar hedefi yok."),
  entry("produce_whole_grain_education", "Sebze/meyve/tam tahil genel egitimi", "green", [SOURCE_TUBER], "Aktif planla celismeden."),
  entry("salt_sugar_fat_education", "Tuz/seker/yag hakkinda genel egitim", "green", [SOURCE_TUBER], "Hastalik-spesifik tedaviye donmeden."),
  entry("meal_pattern_education", "Ogun duzeni hakkinda genel egitim", "green", [SOURCE_TUBER], "Aktif plani degistirmeden."),
  entry("label_reading_education", "Etiket okuma genel egitimi", "green", [SOURCE_TUBER], "Ilac/hastalik/lab yorumu yok."),
  entry("food_safety_education", "Besin guvenligi genel bilgisi", "green", [SOURCE_TUBER], "Acil/zehirlenme/alerji varsa red/yellow."),
  entry("behavior_support_motivation", "Davranis destek/motivasyon", "green", [SOURCE_TUBER], "Vucut utandirma, garanti, asiri kisitlama yok."),
];

export const PHASE_72_SENSITIVE_NEVER_PROMPT_FIELD_MAP: Phase72ArtifactEntry[] = [
  "whatsapp_phone_e164",
  "telegram_user_id",
  "date_of_birth",
  "credential_id",
  "guardian_identity",
  "diagnosed_condition_details",
  "medication_details",
  "insulin_details",
  "supplement_details",
  "lab_result_details",
  "symptom_details",
  "eating_disorder_details",
  "pregnancy_complication_details",
  "exact_height_weight",
  "body_measurement_notes",
  "progress_photos",
  "dietitian_only_notes",
  "free_text_client_notes",
].map((fieldId) =>
  entry(fieldId, fieldId, "handoff_no_send", [SOURCE_KVKK, SOURCE_HEALTH_DATA_REG], "Raw alan prompt'a girmemeli."),
);

export const PHASE_72_PROMPT_ALLOWED_FIELD_MAP: Phase72ArtifactEntry[] = [
  entry("allergies", "Alerji/kisitli besin", "green", [SOURCE_JOB_DEFINITIONS], "Sinirli prompt_allowed; raw detay dikkatli."),
  entry("pinned_notes", "Pinned note", "green", [SOURCE_JOB_DEFINITIONS], "Prompt-safe ozet ise kaynak olabilir."),
  entry("active_diet_plan_summary", "Aktif diyet plani", "green", [SOURCE_JOB_DEFINITIONS], "Prompt_allowed ve answerability kaynagi."),
  entry("meal_plan_slots", "Ogun plani", "green", [SOURCE_JOB_DEFINITIONS], "Plan lookup."),
  entry("allowed_substitutions", "Onayli alternatifler", "green", [SOURCE_JOB_DEFINITIONS], "Plan answerability."),
  entry("forbidden_substitutions", "Yasak alternatifler", "green", [SOURCE_JOB_DEFINITIONS], "Plan answerability."),
  entry("restricted_foods_medical", "Tibbi kisitli besinler", "green", [SOURCE_JOB_DEFINITIONS], "Risk flag olarak sinirli."),
  entry("restricted_foods_preference", "Tercih kisitlari", "green", [SOURCE_JOB_DEFINITIONS], "Tercih uyumu."),
  entry("primary_goal", "Birincil hedef", "green", [SOURCE_JOB_DEFINITIONS], "Hatirlatma only."),
  entry("client_context_updates", "Context update", "green", [SOURCE_JOB_DEFINITIONS], "Diyetisyen onayli kisa context."),
  entry("manual_dietitian_message_origin", "Manual dietitian message", "green", [SOURCE_JOB_DEFINITIONS], "AI-generated olmayanlar answerability kaynagi olabilir."),
  entry("forbidden_food_items", "Yasak besin listesi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("forbidden_food_groups", "Yasak besin gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("allowed_food_items", "Izinli besin listesi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("allowed_food_groups", "Izinli besin gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("equivalent_exchange_groups", "Esdeger degisim gruplari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("mandatory_foods_or_meals", "Zorunlu besin/ogunler", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("optional_foods_or_meals", "Opsiyonel besin/ogunler", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("diet_type_rules", "Diyet tipi kurallari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("ingredient_allergen_keywords", "Alerjen anahtar kelimeleri", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("skip_tolerance_rules", "Atlama toleransi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("portion_boundaries", "Porsiyon sinirlari", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("product_label_review_policy", "Urun etiketi politikasi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
  entry("uncertainty_policy", "Belirsizlik politikasi", "green", [SOURCE_JOB_DEFINITIONS], "Structured food-rule prompt field."),
];

export const PHASE_72_PRODUCT_COVENANT_FORBIDDEN_PHRASE_MAP: Phase72ArtifactEntry[] = [
  entry("ai_identity_disclosure", "AI kimligi veya limitasyon ifadesi", "handoff_no_send", [SOURCE_PROMOTION], "Client mesajlari diyetisyenden geliyormus gibi olmali."),
  entry("referral_deferral_language", "Referral/deferral ifadesi", "handoff_no_send", [SOURCE_PROMOTION], "Yellow/red internal handoff ile cozulur."),
  entry("false_reassurance", "Guvence ve risk azaltma ifadesi", "handoff_no_send", [SOURCE_1219], "Klinik risk azaltma yasak."),
  entry("unsolicited_plan_change", "Plan degistiren ifade", "draft_only", [SOURCE_JOB_DEFINITIONS], "Otomatik plan degisikligi yok."),
  entry("promotional_guarantee", "Tanitim/garanti/body-shaming ifadesi", "handoff_no_send", [SOURCE_PROMOTION], "Yaniltici tanitim riski."),
  entry("sensitive_data_disclosure", "Hassas veriyi aciga cikaran ifade", "handoff_no_send", [SOURCE_KVKK], "Gereksiz health-data disclosure yasak."),
];

export const PHASE_72_LEGAL_PRIVACY_ROUTING_MAP: Phase72ArtifactEntry[] = [
  entry("channel_permission_not_ready", "Channel permission ready degil", "handoff_no_send", [SOURCE_REMOTE_HEALTH], "AI generation ve send yok."),
  entry("opt_out_active", "Opt-out var", "automation_off", [SOURCE_KVKK], "Outbound automation yok."),
  entry("unknown_identity", "Unknown/ambiguous identity", "quarantine", [SOURCE_KVKK], "Quarantine; AI/provider yok."),
  entry("group_message", "Group message", "quarantine", [SOURCE_REMOTE_HEALTH], "Quarantine; client context yok."),
  entry("legal_privacy_approval_missing", "Legal/privacy approval yok", "handoff_no_send", [SOURCE_KVKK], "Production health data processing yok."),
  entry("provider_vendor_approval_missing", "Provider/vendor approval yok", "handoff_no_send", [SOURCE_KVKK], "Real Gemini egress yok."),
  entry("whatsapp_policy_approval_missing", "WhatsApp policy approval yok", "handoff_no_send", [SOURCE_REMOTE_HEALTH], "Real WhatsApp traffic yok."),
  entry("sensitive_data_consent_revoked", "Sensitive data consent revoked", "handoff_no_send", [SOURCE_KVKK], "Automation ve provider path kapali."),
  entry("dsar_deletion_request", "DSAR/deletion/anonymization talebi", "internal_only", [SOURCE_KVKK, SOURCE_HEALTH_DATA_REG], "Draft/send/provider path kapali."),
];

export const PHASE_72_CLINICAL_ESCALATION_ROUTING_MAP: Phase72ArtifactEntry[] = [
  entry("plan_lookup", "Plan lookup", "green", [SOURCE_JOB_DEFINITIONS], "Aktif plan gerekli."),
  entry("meal_reminder", "Ogun hatirlatma", "green", [SOURCE_JOB_DEFINITIONS], "Lojistik cevap."),
  entry("allowed_substitution", "Allowed substitution", "green", [SOURCE_JOB_DEFINITIONS], "Alerji/kisit kontrolu sart."),
  entry("plan_conflict", "Plan conflict", "draft_only", [SOURCE_JOB_DEFINITIONS], "Client planla celisen istek."),
  entry("plan_change", "Plan change", "draft_only", [SOURCE_JOB_DEFINITIONS], "Green olmaz."),
  entry("calorie_macro", "Calorie/macro", "draft_only", [SOURCE_JOB_DEFINITIONS], "Green olmaz."),
  entry("medication_insulin", "Medication/insulin", "handoff_no_send", [SOURCE_DIABETES_PROGRAM], "Red/yellow."),
  entry("supplement_dose", "Supplement dose", "draft_only", [SOURCE_JOB_DEFINITIONS], "Client-facing karar yok."),
  entry("lab_result", "Lab result", "handoff_no_send", [SOURCE_1219], "Yorum yok."),
  entry("symptom", "Symptom", "handoff_no_send", [SOURCE_1219], "Yorum yok."),
  entry("diabetes_glucose", "Diabetes/glucose", "draft_only", [SOURCE_DIABETES_PROGRAM], "Sayisal/acil riskte red."),
  entry("pregnancy_breastfeeding", "Pregnancy/breastfeeding", "draft_only", [SOURCE_1219], "Green genisletilmez."),
  entry("minor_body_image", "Minor/body image", "draft_only", [SOURCE_PROMOTION], "Kilo baskisi yok."),
  entry("eating_disorder", "Eating disorder", "handoff_no_send", [SOURCE_JOB_DEFINITIONS], "Automation yok."),
  entry("general_nutrition_education", "General nutrition education", "green", [SOURCE_TUBER], "Official corpus, non-personalized."),
  entry("privacy_dsar", "Privacy/DSAR", "internal_only", [SOURCE_KVKK], "Client-facing AI yok."),
  entry("opt_out", "Opt-out", "automation_off", [SOURCE_KVKK], "Automation off."),
  entry("unknown_identity", "Unknown identity", "quarantine", [SOURCE_KVKK], "Quarantine."),
  entry("group_message", "Group message", "quarantine", [SOURCE_REMOTE_HEALTH], "Quarantine."),
];

export const PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY = {
  id: "mixed-intent-fail-closed",
  approvalStatus: DRAFT,
  rule: "Herhangi bir parca yellow/red/handoff/quarantine ise tum mesaj fail-closed; partial green cevap yok.",
  sourceRefs: [SOURCE_JOB_DEFINITIONS, SOURCE_1219],
};

const ROUTING_BAND_SEVERITY: Record<Phase72RoutingBand, number> = {
  quarantine: 6,
  handoff_no_send: 5,
  internal_only: 4,
  automation_off: 3,
  draft_only: 2,
  green: 1,
};

const INTENT_ROUTING_LOOKUP = new Map<Phase72IntentId, Phase72RoutingBand>(
  PHASE_72_CLINICAL_ESCALATION_ROUTING_MAP.map((artifact) => [artifact.id as Phase72IntentId, artifact.routingBand]),
);

const NEVER_PROMPT_FIELD_IDS = new Set(PHASE_72_SENSITIVE_NEVER_PROMPT_FIELD_MAP.map((artifact) => artifact.id));
const PROMPT_ALLOWED_FIELD_IDS = new Set(PHASE_72_PROMPT_ALLOWED_FIELD_MAP.map((artifact) => artifact.id));

const FOOD_RULE_ROUTING_LOOKUP = new Map<Phase72FoodRuleIntentId, Phase72RoutingBand>(
  PHASE_72_FOOD_RULE_ROUTING_MAP.map((artifact) => [artifact.id as Phase72FoodRuleIntentId, artifact.routingBand]),
);

export function buildPhase72PermissionGraphBundle(): Phase72PermissionGraphBundle {
  return {
    graphVersion: PHASE_72_PERMISSION_GRAPH_VERSION,
    approvalStatus: DRAFT,
    upstreamSourcePackVersion: PHASE_71_TURKIYE_SOURCE_PACK_VERSION,
    forbiddenActionMap: PHASE_72_FORBIDDEN_ACTION_MAP,
    draftOnlyActionMap: PHASE_72_DRAFT_ONLY_ACTION_MAP,
    allowedPlanAnswerabilityMap: PHASE_72_ALLOWED_PLAN_ANSWERABILITY_MAP,
    allowedGeneralEducationMap: PHASE_72_ALLOWED_GENERAL_EDUCATION_MAP,
    sensitiveNeverPromptFieldMap: PHASE_72_SENSITIVE_NEVER_PROMPT_FIELD_MAP,
    promptAllowedFieldMap: PHASE_72_PROMPT_ALLOWED_FIELD_MAP,
    productCovenantForbiddenPhraseMap: PHASE_72_PRODUCT_COVENANT_FORBIDDEN_PHRASE_MAP,
    legalPrivacyRoutingMap: PHASE_72_LEGAL_PRIVACY_ROUTING_MAP,
    clinicalEscalationRoutingMap: PHASE_72_CLINICAL_ESCALATION_ROUTING_MAP,
    mixedIntentFailClosedPolicy: PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY,
    foodRuleRoutingMap: PHASE_72_FOOD_RULE_ROUTING_MAP,
  };
}

export function inferPhase72IntentIdsFromMessage(message: string): Phase72IntentId[] {
  const normalized = normalizePhase72Text(message);
  const intents = new Set<Phase72IntentId>();

  if (/(ilac|insulin|doz|medikasyon)/.test(normalized)) intents.add("medication_insulin");
  if (/(semptom|belirti|bas don|mide bulant|halsiz)/.test(normalized)) intents.add("symptom");
  if (/(lab|tahlil|kan sonuc)/.test(normalized)) intents.add("lab_result");
  if (/(glukoz|seker|diyabet|hipoglisemi)/.test(normalized)) intents.add("diabetes_glucose");
  if (/(hamile|gebe|emzir)/.test(normalized)) intents.add("pregnancy_breastfeeding");
  if (/(cocuk|minor|resit degil)/.test(normalized)) intents.add("minor_body_image");
  if (/(yeme bozuk|kusma|purge)/.test(normalized)) intents.add("eating_disorder");
  if (/(kalori|makro|porsiyon|kilo hedef)/.test(normalized)) intents.add("calorie_macro");
  if (/(plan degis|diyet degis)/.test(normalized)) intents.add("plan_change");
  if (/(planla celis|plan disi)/.test(normalized)) intents.add("plan_conflict");
  if (/(yiyebilir|yasak|serbest|alternatif|degisim|besin|ogun)/.test(normalized)) intents.add("allowed_substitution");
  if (/(kahvalti|ogle|aksam|ogun|plan)/.test(normalized)) intents.add("plan_lookup");

  return [...intents];
}

export type Phase72FoodDecisionV2Like = {
  decision?: string;
  queryType?: string | null;
  providerEligible?: boolean;
  reasonCodes?: string[];
};

export function mapFoodDecisionV2ToPermissionIntents(
  foodDecisionV2: Phase72FoodDecisionV2Like | null,
): Phase72FoodRuleIntentId[] {
  if (!foodDecisionV2?.decision || foodDecisionV2.decision === "not_applicable") return [];

  switch (foodDecisionV2.decision) {
    case "forbid":
      return ["forbidden_food_reminder"];
    case "allow":
      return ["allowed_food_confirmation"];
    case "discourage":
      return ["equivalent_substitution_allowed"];
    case "needs_label":
      return ["product_ingredient_unknown"];
    case "needs_review":
      return ["food_rule_uncertain_review"];
    default:
      return [];
  }
}

export function mapFoodRuleDecisionToPermissionIntents(
  foodRuleDecision: Phase72FoodRuleDecisionLike,
): Phase72FoodRuleIntentId[] {
  if (!foodRuleDecision) return [];

  switch (foodRuleDecision.decision) {
    case "forbidden_food_rejection":
      return ["forbidden_food_reminder"];
    case "allowed_food_confirmation":
      return ["allowed_food_confirmation"];
    case "equivalent_substitution_allowed":
      return ["equivalent_substitution_allowed"];
    case "diet_type_compatible":
      return ["diet_type_compatible"];
    case "optional_skip_allowed":
      return ["optional_skip_allowed"];
    case "mandatory_skip_blocked":
      return ["mandatory_skip_block"];
    case "unknown_food_requires_review":
      return foodRuleDecision.reasons?.some((reason) => reason.includes("product"))
        ? ["product_ingredient_unknown"]
        : ["food_rule_uncertain_review"];
    case "diet_type_conflict":
      return ["diet_type_conflict"];
    case "mixed_intent_blocked":
      return ["food_rule_mixed_intent"];
    default:
      return [];
  }
}

export function resolveFoodRulePermissionBands(foodRuleDecision: Phase72FoodRuleDecisionLike): Phase72RoutingBand[] {
  const intents = mapFoodRuleDecisionToPermissionIntents(foodRuleDecision);
  return intents.map((intentId) => FOOD_RULE_ROUTING_LOOKUP.get(intentId) ?? "handoff_no_send");
}

export function resolveForbiddenActionBandsFromFoodRule(
  foodRuleDecision: Phase72FoodRuleDecisionLike,
): Phase72RoutingBand[] {
  if (!foodRuleDecision) return [];
  if (foodRuleDecision.decision === "allowed_food_confirmation" && foodRuleDecision.reasons?.some((reason) => reason.includes("forbidden"))) {
    return ["handoff_no_send"];
  }
  if (foodRuleDecision.reasons?.some((reason) => reason.includes("unapproved_substitution"))) {
    return ["draft_only"];
  }
  return [];
}

export function evaluatePhase72PermissionGraphReadiness(
  bundle: Phase72PermissionGraphBundle = buildPhase72PermissionGraphBundle(),
): { status: "pass" | "fail"; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  if (bundle.approvalStatus !== "draft") {
    blockingReasons.push("permission graph approval status must remain draft until external review");
  }

  const artifactGroups = [
    bundle.forbiddenActionMap,
    bundle.draftOnlyActionMap,
    bundle.allowedPlanAnswerabilityMap,
    bundle.allowedGeneralEducationMap,
    bundle.sensitiveNeverPromptFieldMap,
    bundle.promptAllowedFieldMap,
    bundle.productCovenantForbiddenPhraseMap,
    bundle.legalPrivacyRoutingMap,
    bundle.clinicalEscalationRoutingMap,
    bundle.foodRuleRoutingMap,
  ];

  for (const group of artifactGroups) {
    if (group.length === 0) {
      blockingReasons.push("permission graph artifact group is empty");
      continue;
    }

    for (const artifact of group) {
      if (artifact.approvalStatus !== "draft") {
        blockingReasons.push(`artifact ${artifact.id} is not draft`);
      }
      if (artifact.sourceRefs.length === 0) {
        blockingReasons.push(`artifact ${artifact.id} is missing source references`);
      }
    }
  }

  if (bundle.mixedIntentFailClosedPolicy.approvalStatus !== "draft") {
    blockingReasons.push("mixed intent policy is not draft");
  }

  return {
    status: blockingReasons.length === 0 ? "pass" : "fail",
    blockingReasons,
  };
}

export function evaluatePhase72PromptFieldAccess(fieldId: string): {
  fieldId: string;
  promptAllowed: boolean;
  routingBand: Phase72RoutingBand;
  approvalStatus: Phase72ApprovalStatus;
} {
  if (NEVER_PROMPT_FIELD_IDS.has(fieldId)) {
    return {
      fieldId,
      promptAllowed: false,
      routingBand: "handoff_no_send",
      approvalStatus: DRAFT,
    };
  }

  if (PROMPT_ALLOWED_FIELD_IDS.has(fieldId)) {
    return {
      fieldId,
      promptAllowed: true,
      routingBand: "green",
      approvalStatus: DRAFT,
    };
  }

  return {
    fieldId,
    promptAllowed: false,
    routingBand: "handoff_no_send",
    approvalStatus: DRAFT,
  };
}

function resolveIntentBand(
  intentId: Phase72IntentId,
  clinicalContext: Phase72ClinicalContext,
): Phase72RoutingBand {
  const base = INTENT_ROUTING_LOOKUP.get(intentId) ?? "handoff_no_send";

  if (clinicalContext.acuteEmergency) {
    return "handoff_no_send";
  }

  if (intentId === "diabetes_glucose" && clinicalContext.numericGlucoseRisk) {
    return "handoff_no_send";
  }

  if (intentId === "pregnancy_breastfeeding" && clinicalContext.pregnancyComplicationRisk) {
    return "handoff_no_send";
  }

  if (intentId === "minor_body_image" && clinicalContext.minorBodyImageRisk) {
    return "handoff_no_send";
  }

  return base;
}

function collectTriggeredPrivacyGates(privacyGate: Phase72PrivacyGateState): Phase72PrivacyGateId[] {
  const triggered: Phase72PrivacyGateId[] = [];

  if (!privacyGate.channelPermissionReady) triggered.push("channel_permission_not_ready");
  if (privacyGate.optOut) triggered.push("opt_out_active");
  if (privacyGate.unknownIdentity) triggered.push("unknown_identity");
  if (privacyGate.groupMessage) triggered.push("group_message");
  if (!privacyGate.legalPrivacyApproval) triggered.push("legal_privacy_approval_missing");
  if (!privacyGate.providerVendorApproval) triggered.push("provider_vendor_approval_missing");
  if (!privacyGate.whatsappPolicyApproval) triggered.push("whatsapp_policy_approval_missing");
  if (privacyGate.sensitiveDataConsentRevoked) triggered.push("sensitive_data_consent_revoked");
  if (privacyGate.dsarDeletionRequest) triggered.push("dsar_deletion_request");

  return triggered;
}

function privacyGateRoutingBand(gateId: Phase72PrivacyGateId): Phase72RoutingBand {
  const artifact = PHASE_72_LEGAL_PRIVACY_ROUTING_MAP.find((entry) => entry.id === gateId);
  return artifact?.routingBand ?? "handoff_no_send";
}

function worstRoutingBand(bands: Phase72RoutingBand[]): Phase72RoutingBand {
  return bands.reduce((worst, current) =>
    ROUTING_BAND_SEVERITY[current] > ROUTING_BAND_SEVERITY[worst] ? current : worst,
  bands[0] ?? "handoff_no_send");
}

const DEFAULT_PRIVACY_GATE: Phase72PrivacyGateState = {
  channelPermissionReady: true,
  optOut: false,
  unknownIdentity: false,
  groupMessage: false,
  legalPrivacyApproval: false,
  providerVendorApproval: false,
  whatsappPolicyApproval: false,
  sensitiveDataConsentRevoked: false,
  dsarDeletionRequest: false,
};

const DEFAULT_CLINICAL_CONTEXT: Phase72ClinicalContext = {
  acuteEmergency: false,
  numericGlucoseRisk: false,
  pregnancyComplicationRisk: false,
  minorBodyImageRisk: false,
};

export function evaluatePhase72PermissionRouting(input: {
  intentIds: Phase72IntentId[];
  privacyGate?: Partial<Phase72PrivacyGateState>;
  clinicalContext?: Partial<Phase72ClinicalContext>;
  approvedOfficialCorpus?: boolean;
  activePlanAvailable?: boolean;
  launchGateEvidence?: LaunchGateEvidenceRecord[];
  foodRuleDecision?: Phase72FoodRuleDecisionLike;
  foodRuleRoutingBands?: Phase72RoutingBand[];
}): Phase72RoutingEvaluation {
  const privacyGate: Phase72PrivacyGateState = { ...DEFAULT_PRIVACY_GATE, ...input.privacyGate };
  const clinicalContext: Phase72ClinicalContext = { ...DEFAULT_CLINICAL_CONTEXT, ...input.clinicalContext };
  const messageIntentIds = [...new Set(input.intentIds)];
  const foodRuleIntentIds = mapFoodRuleDecisionToPermissionIntents(input.foodRuleDecision ?? null);
  const intentIds = messageIntentIds;
  const blockingReasons: string[] = [];
  const triggeredPrivacyGates = collectTriggeredPrivacyGates(privacyGate);
  const privacyBands = triggeredPrivacyGates.map(privacyGateRoutingBand);
  const foodRuleBands = [
    ...resolveFoodRulePermissionBands(input.foodRuleDecision ?? null),
    ...resolveForbiddenActionBandsFromFoodRule(input.foodRuleDecision ?? null),
    ...(input.foodRuleRoutingBands ?? []),
  ];

  const matchedIntentBands = intentIds.map((intentId) => {
    let routingBand = resolveIntentBand(intentId, clinicalContext);

    if (
      (intentId === "plan_lookup" ||
        intentId === "meal_reminder" ||
        intentId === "allowed_substitution" ||
        intentId === "plan_conflict") &&
      input.activePlanAvailable === false
    ) {
      routingBand = "handoff_no_send";
      blockingReasons.push(`active plan required for intent ${intentId}`);
    }

    if (intentId === "general_nutrition_education" && !input.approvedOfficialCorpus) {
      routingBand = "handoff_no_send";
      blockingReasons.push("approved official corpus required for general nutrition education");
    }

    return { intentId, routingBand };
  });

  const intentBands = matchedIntentBands.map((band) => band.routingBand);
  const combinedIntentBands = [...intentBands, ...foodRuleBands];
  const hasGreen = combinedIntentBands.includes("green");
  const hasNonGreen = combinedIntentBands.some((band) => band !== "green");
  const mixedIntentFailClosed =
    (intentBands.length > 1 && intentBands.includes("green") && intentBands.some((band) => band !== "green")) ||
    (combinedIntentBands.length > 1 && hasGreen && hasNonGreen && foodRuleIntentIds.length > 0 && messageIntentIds.length > 0);

  if (mixedIntentFailClosed) {
    blockingReasons.push(PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY.rule);
  }

  const candidateBands = [...privacyBands, ...combinedIntentBands];
  let finalRoutingBand = worstRoutingBand(candidateBands.length > 0 ? candidateBands : ["handoff_no_send"]);

  if (mixedIntentFailClosed) {
    const mixedBands = [
      ...combinedIntentBands.filter((band): band is Exclude<Phase72RoutingBand, "green"> => band !== "green"),
      ...(privacyBands.length > 0 ? privacyBands : (["handoff_no_send"] as const)),
    ] satisfies Phase72RoutingBand[];
    finalRoutingBand = worstRoutingBand(mixedBands);
  }

  if (triggeredPrivacyGates.length > 0) {
    const privacyWorst = worstRoutingBand(privacyBands);
    if (ROUTING_BAND_SEVERITY[privacyWorst] >= ROUTING_BAND_SEVERITY[finalRoutingBand]) {
      finalRoutingBand = privacyWorst;
    }
    if (combinedIntentBands.includes("green")) {
      blockingReasons.push("privacy gate blocks green routing");
    }
  }

  if (foodRuleIntentIds.length > 0) {
    blockingReasons.push(`food_rule_intents:${foodRuleIntentIds.join(",")}`);
  }

  return {
    graphVersion: PHASE_72_PERMISSION_GRAPH_VERSION,
    approvalStatus: DRAFT,
    activeProductionRoutingAllowed: isPhase72ActiveProductionRoutingAllowed(input.launchGateEvidence ?? []),
    finalRoutingBand,
    intentIds,
    matchedIntentBands,
    triggeredPrivacyGates,
    mixedIntentFailClosed,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export function isPhase72ActiveProductionRoutingAllowed(
  launchGateEvidence: LaunchGateEvidenceRecord[] = [],
): boolean {
  if (process.env.MANU_ALLOW_PHASE_72_ACTIVE_ROUTING !== "true") {
    return false;
  }

  const legalApproved = launchGateEvidence.some(
    (record) => record.gateId === "legal_privacy_review" && record.approvalStatus === "approved",
  );
  const clinicalApproved = launchGateEvidence.some(
    (record) => record.gateId === "clinical_taxonomy_approval" && record.approvalStatus === "approved",
  );

  return legalApproved && clinicalApproved;
}

export function buildPhase72PermissionGraphLaunchGateEvidence(): LaunchGateEvidenceRecord[] {
  return [
    {
      gateId: "legal_privacy_review",
      artifactTitle: "Phase 72 regulation permission graph legal/privacy interpretation pack",
      artifactRef: PHASE_72_PERMISSION_GRAPH_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "legal basis matrix",
        "privacy notice and client permission documents",
        "user-supplied dietitian/client form privacy and prompt-allowlist approval",
        "official PDF corpus handling decision",
      ],
      sanitizedReference: true,
    },
    {
      gateId: "clinical_taxonomy_approval",
      artifactTitle: "Phase 72 regulation permission graph clinical escalation matrix",
      artifactRef: PHASE_72_PERMISSION_GRAPH_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "qualified dietitian sign-off",
        "current clinical golden test report",
        "taxonomy change log",
        "green/yellow/red permission graph",
      ],
      sanitizedReference: true,
    },
  ];
}

function normalizePhase72Text(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
