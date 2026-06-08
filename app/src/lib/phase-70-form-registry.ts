import type {
  ClientFormFieldDefinition,
  ClientFormSchemaRecord,
  DietitianFormSchemaRecord,
  FormFieldAnswerabilityRole,
  FormFieldPrivacySensitivity,
  FormFieldPromptAccess,
  FormFieldType,
  SupportedLanguageCode,
} from "./types";
import { PHASE_76D_CLIENT_FOOD_RULE_FIELDS } from "./phase-76d-food-rule-fields";

export const PHASE_70_SCHEMA_TITLE_CLIENT = "Phase 70 client intake";
export const PHASE_70_SCHEMA_TITLE_DIETITIAN = "Phase 70 dietitian profile";
export const PHASE_70_REGISTRY_VERSION = "phase-76d-food-rule-registry-v1";

export type Phase70RegistryField = ClientFormFieldDefinition & {
  form: "client" | "dietitian";
  filledBy: string;
};

type FieldInput = {
  id: string;
  label: string;
  form: "client" | "dietitian";
  section: string;
  filledBy: string;
  required?: boolean;
  type?: FormFieldType;
  options?: string[];
  promptAccess: FormFieldPromptAccess;
  answerabilityRole?: FormFieldAnswerabilityRole;
  privacySensitivity?: FormFieldPrivacySensitivity;
  clinicalSensitivity?: "none" | "risk_modifier" | "critical";
};

function defineField(input: FieldInput): Phase70RegistryField {
  const llmVisibility = input.promptAccess === "prompt_allowed" ? "prompt_allowed" : "never";
  return {
    id: input.id,
    label: input.label,
    type: input.type || (input.options ? "select" : "text"),
    required: Boolean(input.required),
    options: input.options,
    llmVisibility,
    promptAccess: input.promptAccess,
    answerabilityRole: input.answerabilityRole || "none",
    privacySensitivity: input.privacySensitivity || "medium",
    clinicalSensitivity: input.clinicalSensitivity || "none",
    section: input.section,
    form: input.form,
    filledBy: input.filledBy,
  };
}

const yesNo = ["Evet", "Hayir"];
const yesNoUnknown = ["Evet", "Hayir", "Bilinmiyor", "Belirtmek istemiyorum"];
const languages = ["TR", "EN", "DE", "FR", "ES", "PT", "CS"];
const permissionStates = ["pending", "ready", "blocked", "opted_out"];
const consentStates = ["pending", "approved", "revoked"];
const aiStatus = ["active", "passive"];
const aiModes = ["autopilot", "copilot", "manual", "paused"];
const adultStatuses = ["Adult", "Minor", "Unknown"];
const ageBands = ["18 alti", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export const PHASE_70_DIETITIAN_FIELDS: Phase70RegistryField[] = [
  defineField({ id: "dietitian_full_name", label: "Diyetisyen adi soyadi", form: "dietitian", section: "1.1", filledBy: "Diyetisyen / admin", required: true, promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "professional_title", label: "Mesleki unvan", form: "dietitian", section: "1.1", filledBy: "Diyetisyen", required: true, options: ["Diyetisyen", "Uzman Diyetisyen", "Klinik Diyetisyen", "Diger"], promptAccess: "dietitian_only" }),
  defineField({ id: "credential_id", label: "Credential id", form: "dietitian", section: "1.1", filledBy: "Diyetisyen / admin", required: true, promptAccess: "sensitive_never_prompt", privacySensitivity: "high" }),
  defineField({ id: "credential_jurisdiction", label: "Mesleki yetki bolgesi", form: "dietitian", section: "1.1", filledBy: "Diyetisyen / admin", required: true, options: ["Turkiye", "AB", "UK", "US", "Diger"], promptAccess: "dietitian_only" }),
  defineField({ id: "clinic_name", label: "Klinik adi", form: "dietitian", section: "1.1", filledBy: "Diyetisyen / admin", required: true, promptAccess: "dietitian_only" }),
  defineField({ id: "clinic_type", label: "Calisma modeli", form: "dietitian", section: "1.1", filledBy: "Diyetisyen / admin", options: ["Solo", "Klinik", "Online", "Hibrit", "Kurumsal"], promptAccess: "dietitian_only" }),
  defineField({ id: "clinical_focus_areas", label: "Klinik odak alanlari", form: "dietitian", section: "1.1", filledBy: "Diyetisyen", type: "multiselect", options: ["Kilo yonetimi", "Spor", "Diyabet", "Gebelik", "Pediatri", "Yeme bozuklugu", "Genel saglik", "Diger"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "excluded_practice_areas", label: "Haric tutulan alanlar", form: "dietitian", section: "1.1", filledBy: "Diyetisyen", type: "textarea", promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "supported_client_languages", label: "Desteklenen diller", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, type: "multiselect", options: languages, promptAccess: "system_rule" }),
  defineField({ id: "default_communication_language", label: "Varsayilan client dili", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, options: languages, promptAccess: "system_rule" }),
  defineField({ id: "default_persona", label: "Varsayilan persona", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, options: ["Dengeli Koc", "Sicak Destekci", "Disiplinli Takipci", "Minimal Yanit", "Motivasyon Ortagi", "Klinik Resmi"], promptAccess: "system_rule" }),
  defineField({ id: "emoji_policy", label: "Emoji politikasi", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, options: ["Yok", "Az", "Orta"], promptAccess: "system_rule" }),
  defineField({ id: "preferred_reply_length", label: "Yanit uzunlugu", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, options: ["Cok kisa", "Kisa", "Orta"], promptAccess: "system_rule" }),
  defineField({ id: "formality_level", label: "Resmiyet", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", required: true, options: ["Samimi", "Dengeli", "Resmi"], promptAccess: "system_rule" }),
  defineField({ id: "greeting_style", label: "Selamlama stili", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", options: ["Selam", "Merhaba", "Isimle hitap", "Hicbiri"], promptAccess: "prompt_allowed", privacySensitivity: "low" }),
  defineField({ id: "closing_style", label: "Kapanis stili", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", options: ["Kisa kapanis", "Motive edici kapanis", "Kapanis yok"], promptAccess: "prompt_allowed", privacySensitivity: "low" }),
  defineField({ id: "tone_boundaries", label: "Ton sinirlari", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", type: "textarea", promptAccess: "system_rule", privacySensitivity: "medium" }),
  defineField({ id: "notes_for_ai_style", label: "AI stil notlari", form: "dietitian", section: "1.2", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", privacySensitivity: "medium" }),
  defineField({ id: "working_hours", label: "Calisma saatleri", form: "dietitian", section: "1.3", filledBy: "Diyetisyen / admin", required: true, type: "textarea", promptAccess: "dietitian_only" }),
  defineField({ id: "quiet_hours", label: "Sessiz saatler", form: "dietitian", section: "1.3", filledBy: "Diyetisyen / admin", type: "textarea", promptAccess: "dietitian_only" }),
  defineField({ id: "urgent_handoff_owner", label: "Acil handoff sorumlusu", form: "dietitian", section: "1.3", filledBy: "Klinik admin", required: true, promptAccess: "sensitive_never_prompt", privacySensitivity: "high" }),
  defineField({ id: "backup_handoff_owner", label: "Yedek handoff sorumlusu", form: "dietitian", section: "1.3", filledBy: "Klinik admin", promptAccess: "sensitive_never_prompt", privacySensitivity: "high" }),
  defineField({ id: "yellow_review_sla", label: "Yellow SLA", form: "dietitian", section: "1.3", filledBy: "Diyetisyen / admin", required: true, options: ["1s", "2s", "4s", "Ayni gun"], promptAccess: "system_rule" }),
  defineField({ id: "red_response_sla", label: "Red SLA", form: "dietitian", section: "1.3", filledBy: "Diyetisyen / admin", required: true, options: ["15dk", "30dk", "1s"], promptAccess: "system_rule" }),
  defineField({ id: "client_capacity_limit", label: "Client limiti", form: "dietitian", section: "1.3", filledBy: "Admin", required: true, type: "number", promptAccess: "dietitian_only", privacySensitivity: "low" }),
  defineField({ id: "handoff_notification_channels", label: "Handoff bildirim kanallari", form: "dietitian", section: "1.3", filledBy: "Admin", type: "multiselect", options: ["In-app", "Email", "Push"], promptAccess: "dietitian_only" }),
  defineField({ id: "autopilot_allowed_by_default", label: "Varsayilan autopilot", form: "dietitian", section: "1.4", filledBy: "Admin", required: true, options: yesNo, promptAccess: "system_rule" }),
  defineField({ id: "allowed_green_topics", label: "Izinli green konular", form: "dietitian", section: "1.4", filledBy: "Diyetisyen / clinical reviewer", required: true, type: "multiselect", options: ["Plan hatirlatma", "Lojistik", "Ogun saati", "Izinli alternatif", "Motivasyon", "Ilerleme kaydi", "Kaynakli plan lookup"], promptAccess: "system_rule", answerabilityRole: "policy_source" }),
  defineField({ id: "draft_only_topics", label: "Draft-only konular", form: "dietitian", section: "1.4", filledBy: "Diyetisyen / clinical reviewer", required: true, type: "multiselect", options: ["Plan degisikligi", "Porsiyon", "Kilo hedefi", "Makro/kalori", "Supplement", "Semptom", "Lab", "Ilac"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "never_green_topics", label: "Asla green olmayan konular", form: "dietitian", section: "1.4", filledBy: "Diyetisyen / clinical reviewer", required: true, type: "multiselect", options: ["Ilac/insulin", "Acil belirti", "Gebelik komplikasyonu", "Yeme bozuklugu", "Minor kilo baskisi", "Lab yorumu", "Tani yorumu"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "substitution_policy", label: "Alternatif politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Sadece planda belirtilenler", "Onayli esdeger listeden", "Manuel onay gerekli"], promptAccess: "system_rule", answerabilityRole: "policy_source" }),
  defineField({ id: "portion_change_policy", label: "Porsiyon politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Asla otomatik degil", "Sadece taslak", "Kaynak varsa taslak"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "supplement_policy", label: "Takviye politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Her zaman handoff", "Taslak-only", "Hicbir zaman AI"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "medication_policy", label: "Ilac politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Her zaman yellow/red handoff"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "critical" }),
  defineField({ id: "lab_result_policy", label: "Lab politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Her zaman handoff"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier" }),
  defineField({ id: "minor_policy", label: "Minor politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen / admin", required: true, options: ["Kabul edilmez", "Guardian approval required", "Manual-only"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "pregnancy_policy", label: "Gebelik politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Manual-only", "Copilot-only", "Ozel onay gerekli"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "eating_disorder_policy", label: "Yeme bozuklugu politikasi", form: "dietitian", section: "1.4", filledBy: "Diyetisyen", required: true, options: ["Manual-only", "Handoff", "Dis protokol"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "critical", privacySensitivity: "high" }),
  defineField({ id: "official_sources_acknowledged", label: "Resmi kaynak onayi", form: "dietitian", section: "1.5", filledBy: "Admin / clinical reviewer", required: true, options: yesNo, promptAccess: "dietitian_only" }),
  defineField({ id: "form_prompt_approval_ack", label: "Prompt alan onayi", form: "dietitian", section: "1.5", filledBy: "Legal / clinical reviewer", required: true, options: yesNo, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "product_covenant_ack", label: "Product covenant onayi", form: "dietitian", section: "1.5", filledBy: "Admin / product owner", required: true, options: yesNo, promptAccess: "system_rule" }),
  defineField({ id: "manual_takeover_policy_ack", label: "Manual takeover onayi", form: "dietitian", section: "1.5", filledBy: "Diyetisyen / admin", required: true, options: yesNo, promptAccess: "system_rule" }),
  defineField({ id: "internal_clinical_notes", label: "Ic klinik notlar", form: "dietitian", section: "1.5", filledBy: "Diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
];

export const PHASE_70_CLIENT_FIELDS: Phase70RegistryField[] = [
  defineField({ id: "client_display_name", label: "Client adi", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "date_of_birth_or_age_band", label: "Yas araligi", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: ageBands, promptAccess: "sensitive_never_prompt", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "adult_status", label: "Yetiskin/minor", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: adultStatuses, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "guardian_permission_status", label: "Veli izin durumu", form: "client", section: "2.1", filledBy: "Veli / diyetisyen", options: ["Yok", "Bekliyor", "Onayli", "Reddedildi"], promptAccess: "sensitive_never_prompt", answerabilityRole: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "communication_language", label: "Konusma dili", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: languages, promptAccess: "prompt_allowed", privacySensitivity: "low" }),
  defineField({ id: "timezone", label: "Saat dilimi", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "prompt_allowed", answerabilityRole: "logistics_only", privacySensitivity: "low" }),
  defineField({ id: "channel_permission_state", label: "Kanal izin durumu", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: permissionStates, promptAccess: "system_rule", privacySensitivity: "high" }),
  defineField({ id: "whatsapp_phone_e164", label: "WhatsApp telefon", form: "client", section: "2.1", filledBy: "Client / diyetisyen", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "telegram_user_id", label: "Telegram id", form: "client", section: "2.1", filledBy: "Client / diyetisyen", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "opt_in_timestamp", label: "Opt-in zamani", form: "client", section: "2.1", filledBy: "Sistem / diyetisyen", required: true, type: "date", promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "opt_out_preference", label: "Opt-out tercihi", form: "client", section: "2.1", filledBy: "Client", required: true, options: ["Aktif", "Cikis istedi", "Bilinmiyor"], promptAccess: "system_rule", privacySensitivity: "high" }),
  defineField({ id: "sensitive_data_consent_status", label: "Hassas veri onayi", form: "client", section: "2.1", filledBy: "Client / legal flow", required: true, options: consentStates, promptAccess: "system_rule", privacySensitivity: "critical" }),
  defineField({ id: "form_prompt_visibility_ack", label: "Prompt gorunurluk onayi", form: "client", section: "2.1", filledBy: "Client", required: true, options: yesNo, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "emergency_contact_policy_ack", label: "Acil durum proseduru onayi", form: "client", section: "2.1", filledBy: "Client / legal flow", required: true, options: yesNo, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "primary_goal", label: "Ana hedef", form: "client", section: "2.2", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "goal_notes", label: "Hedef notlari", form: "client", section: "2.2", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "active_diet_plan_summary", label: "Aktif plan ozeti", form: "client", section: "2.2", filledBy: "Diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "meal_plan_slots", label: "Ogun plani", form: "client", section: "2.2", filledBy: "Diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "allowed_substitutions", label: "Izinli alternatifler", form: "client", section: "2.2", filledBy: "Diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "forbidden_substitutions", label: "Yasak alternatifler", form: "client", section: "2.2", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "current_plan_start_date", label: "Plan baslangic", form: "client", section: "2.2", filledBy: "Diyetisyen", required: true, type: "date", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "plan_version_id", label: "Plan versiyonu", form: "client", section: "2.2", filledBy: "Sistem / diyetisyen", required: true, promptAccess: "system_rule", answerabilityRole: "answerability_source", privacySensitivity: "low" }),
  defineField({ id: "plan_review_date", label: "Plan review tarihi", form: "client", section: "2.2", filledBy: "Diyetisyen", type: "date", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "pinned_notes", label: "Pinned notlar", form: "client", section: "2.2", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "client_context_updates", label: "Kritik context ozetleri", form: "client", section: "2.2", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "manual_message_source_allowed", label: "Manual mesaj kaynagi", form: "client", section: "2.2", filledBy: "Diyetisyen / admin", required: true, options: yesNo, promptAccess: "system_rule", answerabilityRole: "answerability_source" }),
  defineField({ id: "allergies", label: "Alerjiler", form: "client", section: "2.3", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", clinicalSensitivity: "critical", privacySensitivity: "critical" }),
  defineField({ id: "allergy_severity", label: "Alerji siddeti", form: "client", section: "2.3", filledBy: "Client / diyetisyen", options: ["Hafif", "Orta", "Agir/anafilaksi", "Bilinmiyor"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "critical", privacySensitivity: "critical" }),
  defineField({ id: "restricted_foods_medical", label: "Tibbi kisitli besinler", form: "client", section: "2.3", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "critical" }),
  defineField({ id: "restricted_foods_preference", label: "Tercih kisitlari", form: "client", section: "2.3", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "cultural_religious_food_rules", label: "Kulturel/dini kurallar", form: "client", section: "2.3", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "food_access_constraints", label: "Erisim kisitlari", form: "client", section: "2.3", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  ...PHASE_76D_CLIENT_FOOD_RULE_FIELDS,
  defineField({ id: "diagnosed_condition_flag", label: "Tanili hastalik", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "diagnosed_condition_details", label: "Tani detaylari", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "diabetes_or_glucose_flag", label: "Diyabet/glukoz", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "medication_or_insulin_flag", label: "Ilac/insulin", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "medication_details", label: "Ilac detaylari", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "supplement_flag", label: "Takviye", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "supplement_details", label: "Takviye detaylari", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "pregnancy_or_breastfeeding_flag", label: "Gebelik/emzirme", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: ["Hayir", "Gebe", "Emziriyor", "Belirtmek istemiyorum"], promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "eating_disorder_risk_flag", label: "Yeme bozuklugu riski", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "critical", privacySensitivity: "critical" }),
  defineField({ id: "recent_symptom_flag", label: "Son donem belirti", form: "client", section: "2.4", filledBy: "Client", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "symptom_details", label: "Belirti detaylari", form: "client", section: "2.4", filledBy: "Client", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "lab_result_available", label: "Lab sonucu var mi", form: "client", section: "2.4", filledBy: "Client / diyetisyen", required: true, options: yesNo, promptAccess: "system_rule", answerabilityRole: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "lab_result_details", label: "Lab detaylari", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "activity_level", label: "Aktivite seviyesi", form: "client", section: "2.5", filledBy: "Client / diyetisyen", required: true, options: ["Dusuk", "Orta", "Yuksek", "Sporcu"], promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "meal_timing_preferences", label: "Ogun saati tercihleri", form: "client", section: "2.5", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "work_school_schedule", label: "Gunluk rutin", form: "client", section: "2.5", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "sleep_schedule_notes", label: "Uyku duzeni", form: "client", section: "2.5", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "cooking_facilities", label: "Mutfak imkani", form: "client", section: "2.5", filledBy: "Client", options: ["Evde mutfak", "Is yerinde", "Hazir yemek", "Kisitli imkan"], promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "shopping_constraints", label: "Alisveris kisitlari", form: "client", section: "2.5", filledBy: "Client", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "height_band", label: "Boy araligi", form: "client", section: "2.6", filledBy: "Client / diyetisyen", promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "weight_band", label: "Kilo araligi", form: "client", section: "2.6", filledBy: "Client / diyetisyen", promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "exact_height_weight", label: "Net boy/kilo", form: "client", section: "2.6", filledBy: "Client / diyetisyen", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "body_measurement_notes", label: "Olcum notlari", form: "client", section: "2.6", filledBy: "Diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "progress_photo_status", label: "Fotograf takibi", form: "client", section: "2.6", filledBy: "Client / diyetisyen", options: ["Yok", "Var", "Onay bekliyor"], promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "ai_status", label: "AI status", form: "client", section: "2.7", filledBy: "Diyetisyen", required: true, options: aiStatus, promptAccess: "system_rule" }),
  defineField({ id: "ai_mode", label: "AI mode", form: "client", section: "2.7", filledBy: "Diyetisyen", required: true, options: aiModes, promptAccess: "system_rule" }),
  defineField({ id: "ai_active_from", label: "AI active from", form: "client", section: "2.7", filledBy: "Diyetisyen", type: "date", promptAccess: "system_rule" }),
  defineField({ id: "ai_active_until", label: "AI active until", form: "client", section: "2.7", filledBy: "Diyetisyen", type: "date", promptAccess: "system_rule" }),
  defineField({ id: "autopilot_qualification", label: "Autopilot uygunlugu", form: "client", section: "2.7", filledBy: "Sistem / diyetisyen", required: true, options: ["Uygun", "Eksik", "Uygun degil"], promptAccess: "system_rule" }),
  defineField({ id: "safety_checklist_complete", label: "Safety checklist", form: "client", section: "2.7", filledBy: "Sistem", required: true, options: yesNo, promptAccess: "system_rule" }),
  defineField({ id: "human_takeover_locked", label: "Takeover lock", form: "client", section: "2.7", filledBy: "Sistem / diyetisyen", required: true, options: yesNo, promptAccess: "system_rule" }),
  defineField({ id: "red_risk_lock_status", label: "Red lock", form: "client", section: "2.7", filledBy: "Sistem / diyetisyen", required: true, options: ["Yok", "Aktif", "Cozuldu"], promptAccess: "system_rule" }),
  defineField({ id: "yellow_risk_hold_status", label: "Yellow hold", form: "client", section: "2.7", filledBy: "Sistem / diyetisyen", required: true, options: ["Yok", "Aktif", "Cozuldu"], promptAccess: "system_rule" }),
  defineField({ id: "free_text_client_notes", label: "Serbest client notu", form: "client", section: "2.8", filledBy: "Client", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "dietitian_only_notes", label: "Diyetisyen ic notlari", form: "client", section: "2.8", filledBy: "Diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "client_public_preference_summary", label: "Prompt uygun tercih ozeti", form: "client", section: "2.8", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
];

export const PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS = [
  "adult_status",
  "communication_language",
  "timezone",
  "channel_permission_state",
  "sensitive_data_consent_status",
  "form_prompt_visibility_ack",
  "primary_goal",
  "active_diet_plan_summary",
  "meal_plan_slots",
  "allowed_substitutions",
  "allergies",
  "restricted_foods_medical",
  "diagnosed_condition_flag",
  "diabetes_or_glucose_flag",
  "medication_or_insulin_flag",
  "supplement_flag",
  "pregnancy_or_breastfeeding_flag",
  "eating_disorder_risk_flag",
  "recent_symptom_flag",
  "ai_status",
  "ai_mode",
  "safety_checklist_complete",
] as const;

const registryById = new Map(
  [...PHASE_70_DIETITIAN_FIELDS, ...PHASE_70_CLIENT_FIELDS].map((field) => [field.id, field]),
);

export function getPhase70RegistryField(fieldId: string) {
  return registryById.get(fieldId) || null;
}

export function toFormFieldDefinition(field: Phase70RegistryField): ClientFormFieldDefinition {
  const definition = { ...field };
  delete (definition as Partial<Phase70RegistryField>).form;
  delete (definition as Partial<Phase70RegistryField>).filledBy;
  return definition;
}

export function buildPhase70ClientFormSchema(input: {
  tenantId: string;
  schemaId: string;
  languageCode: SupportedLanguageCode;
  createdAt: string;
}): ClientFormSchemaRecord {
  return {
    id: input.schemaId,
    tenantId: input.tenantId,
    title: PHASE_70_SCHEMA_TITLE_CLIENT,
    languageCode: input.languageCode,
    version: 1,
    status: "published",
    fields: PHASE_70_CLIENT_FIELDS.map(toFormFieldDefinition),
    createdAt: input.createdAt,
    publishedAt: input.createdAt,
    registryVersion: PHASE_70_REGISTRY_VERSION,
  };
}

export function buildPhase70DietitianFormSchema(input: {
  tenantId: string;
  schemaId: string;
  languageCode: SupportedLanguageCode;
  createdAt: string;
}): DietitianFormSchemaRecord {
  return {
    id: input.schemaId,
    tenantId: input.tenantId,
    title: PHASE_70_SCHEMA_TITLE_DIETITIAN,
    languageCode: input.languageCode,
    version: 1,
    status: "published",
    fields: PHASE_70_DIETITIAN_FIELDS.map(toFormFieldDefinition),
    createdAt: input.createdAt,
    publishedAt: input.createdAt,
    registryVersion: PHASE_70_REGISTRY_VERSION,
  };
}
