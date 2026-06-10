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

export const PHASE_70_SCHEMA_TITLE_CLIENT = "Phase 77C client personal form v2";
export const PHASE_70_SCHEMA_TITLE_DIETITIAN = "Phase 70 dietitian profile";
export const PHASE_70_REGISTRY_VERSION = "phase-77c-client-personal-form-v2";

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
const adultStatuses = ["Adult", "Minor", "Unknown"];
const genderOptions = ["Kadin", "Erkek", "Diger", "Belirtmek istemiyorum"];
const maritalStatuses = ["Bekar", "Evli", "Bosandi", "Dul", "Belirtmek istemiyorum"];
const targetGoals = ["Kilo verme", "Kilo alma", "Kilo koruma", "Performans", "Klinik destek", "Genel saglik", "Diger"];
const flexibilityLevels = ["Kisitli", "Orta esnek", "Esnek"];
const weightChangePeriods = ["Son 6 ay", "Son 12 ay"];
const weightChangeDirections = ["Alma", "Verme", "Degisim yok", "Bilinmiyor"];
const weightChangeIntentions = ["Istemli", "Istemsiz", "Bilinmiyor"];
const movementLevels = ["Cok hareketsiz", "Hareketsiz", "Orta hareketli", "Hareketli", "Cok hareketli"];
const mealCountOptions = ["1", "2", "3", "4", "5+"];
const outsideEatingFrequency = ["Hic", "Nadiren", "Haftada 1-2", "Haftada 3-5", "Her gun"];
const sugarUseOptions = ["Kullanmiyor", "Bazen", "Her icecekte", "Kac kup/kasik belirtilmeli"];
const smokingStatuses = ["Icmiyor", "Icuyor", "Birakti", "Belirtmek istemiyor"];
const alcoholStatuses = ["Almiyor", "Nadiren", "Haftalik", "Sik", "Belirtmek istemiyor"];
const sportStatuses = ["Yok", "Haftada 1-2", "Haftada 3-4", "Haftada 5+", "Profesyonel/performans"];
const bowelRegularityOptions = ["Duzenli", "Duzenli degil", "Kabizlik egilimi", "Ishal egilimi", "Belirtmek istemiyorum"];
const bristolStoolTypes = ["Tip 1", "Tip 2", "Tip 3", "Tip 4", "Tip 5", "Tip 6", "Tip 7", "Bilinmiyor"];
const pregnancyStatuses = ["Hayir", "Gebe", "Emziriyor", "Planliyor", "Belirtmek istemiyorum", "Uygun degil"];
const menstrualRegularity = ["Duzenli", "Duzenli degil", "Menopoz", "Uygun degil", "Belirtmek istemiyorum"];
const nutritionModels = [
  "Kalori kisitlama",
  "Akdeniz diyeti",
  "Dusuk karbonhidrat diyeti",
  "Ketojenik diyet",
  "Paleo diyet",
  "Aralikli oruc",
  "Yuksek proteinli beslenme",
  "Dusuk yagli beslenme",
  "Dusuk FODMAP",
  "Glutensiz beslenme",
  "Sut urunsuz beslenme",
  "Eliminasyon diyeti",
  "Diyabet diyeti",
  "DASH diyeti",
  "Anti-inflamatuar beslenme",
  "Sporcu beslenmesi",
  "Diger",
];

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
  defineField({ id: "first_name", label: "Ad", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "last_name", label: "Soyad", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "date_of_birth", label: "Dogum tarihi", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, type: "date", promptAccess: "sensitive_never_prompt", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "adult_status", label: "Yetiskin/minor", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: adultStatuses, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "email", label: "E-mail", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "mobile_phone_e164", label: "Telefon", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "whatsapp_phone_e164", label: "WhatsApp telefon", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "gender", label: "Cinsiyet", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: genderOptions, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "profession", label: "Meslek", form: "client", section: "2.1", filledBy: "Client / diyetisyen", promptAccess: "prompt_allowed", privacySensitivity: "medium" }),
  defineField({ id: "marital_status", label: "Medeni durum", form: "client", section: "2.1", filledBy: "Client / diyetisyen", options: maritalStatuses, promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "city", label: "Sehir", form: "client", section: "2.1", filledBy: "Client / diyetisyen", promptAccess: "dietitian_only", privacySensitivity: "medium" }),
  defineField({ id: "communication_language", label: "Konusma dili", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: languages, promptAccess: "prompt_allowed", privacySensitivity: "low" }),
  defineField({ id: "timezone", label: "Saat dilimi", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, promptAccess: "prompt_allowed", answerabilityRole: "logistics_only", privacySensitivity: "low" }),
  defineField({ id: "channel_permission_state", label: "Kanal izin durumu", form: "client", section: "2.1", filledBy: "Client / diyetisyen", required: true, options: permissionStates, promptAccess: "system_rule", privacySensitivity: "high" }),
  defineField({ id: "sensitive_data_consent_status", label: "Hassas veri onayi", form: "client", section: "2.1", filledBy: "Client / legal flow", required: true, options: consentStates, promptAccess: "system_rule", privacySensitivity: "critical" }),
  defineField({ id: "form_prompt_visibility_ack", label: "Prompt gorunurluk onayi", form: "client", section: "2.1", filledBy: "Client", required: true, options: yesNo, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "emergency_contact_policy_ack", label: "Acil durum proseduru onayi", form: "client", section: "2.1", filledBy: "Client / legal flow", required: true, options: yesNo, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "current_weight_kg", label: "Kilo (kg)", form: "client", section: "2.2", filledBy: "Client / diyetisyen", required: true, type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "height_cm", label: "Boy (cm)", form: "client", section: "2.2", filledBy: "Client / diyetisyen", required: true, type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "waist_circumference_cm", label: "Bel cevresi (cm)", form: "client", section: "2.2", filledBy: "Client / diyetisyen", type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "hip_circumference_cm", label: "Kalca cevresi (cm)", form: "client", section: "2.2", filledBy: "Client / diyetisyen", type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "weight_change_period", label: "Kilo degisimi donemi", form: "client", section: "2.2", filledBy: "Client / diyetisyen", options: weightChangePeriods, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "weight_change_direction", label: "Son 6-12 ay kilo degisimi", form: "client", section: "2.2", filledBy: "Client / diyetisyen", options: weightChangeDirections, promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "weight_change_kg", label: "Kilo degisimi miktari (kg)", form: "client", section: "2.2", filledBy: "Client / diyetisyen", type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "weight_change_intentionality", label: "Kilo degisimi istemli mi", form: "client", section: "2.2", filledBy: "Client / diyetisyen", options: weightChangeIntentions, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "primary_goal", label: "Hedef", form: "client", section: "2.3", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "goal_type", label: "Hedef turu", form: "client", section: "2.3", filledBy: "Client / diyetisyen", options: targetGoals, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "target_weight_kg", label: "Hedef kilo (kg)", form: "client", section: "2.3", filledBy: "Client / diyetisyen", type: "number", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "goal_timeline", label: "Hedef suresi", form: "client", section: "2.3", filledBy: "Client / diyetisyen", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "goal_notes", label: "Hedef notlari", form: "client", section: "2.3", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "general_flexibility_score", label: "Genel esneklik durumu", form: "client", section: "2.3", filledBy: "Diyetisyen", required: true, options: flexibilityLevels, promptAccess: "prompt_allowed", privacySensitivity: "medium" }),
  defineField({ id: "goal_flexibility_score", label: "Hedef bazli esneklik durumu", form: "client", section: "2.3", filledBy: "Diyetisyen", required: true, options: flexibilityLevels, promptAccess: "prompt_allowed", privacySensitivity: "medium" }),
  defineField({ id: "average_sleep_hours", label: "Ortalama uyku suresi (saat)", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "number", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "work_hours", label: "Calisma/is saatleri", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "work_movement_level", label: "Calisma hareket hali", form: "client", section: "2.4", filledBy: "Client / diyetisyen", options: movementLevels, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "smoking_status", label: "Sigara icme durumu", form: "client", section: "2.4", filledBy: "Client / diyetisyen", options: smokingStatuses, promptAccess: "system_rule", answerabilityRole: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "alcohol_status", label: "Alkol alma durumu", form: "client", section: "2.4", filledBy: "Client / diyetisyen", options: alcoholStatuses, promptAccess: "system_rule", answerabilityRole: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "sport_status", label: "Spor yapma durumu", form: "client", section: "2.4", filledBy: "Client / diyetisyen", options: sportStatuses, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "sport_details", label: "Spor detaylari", form: "client", section: "2.4", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "diagnosed_condition_flag", label: "Tanisi konmus hastalik var mi", form: "client", section: "2.5", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "diagnosed_condition_details", label: "Tanili hastalik detaylari", form: "client", section: "2.5", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "diabetes_or_glucose_flag", label: "Diyabet/glukoz oykusu", form: "client", section: "2.5", filledBy: "Client / diyetisyen", options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "medication_or_insulin_flag", label: "Duzenli kullanilan ilac var mi", form: "client", section: "2.5", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "medication_details", label: "Duzenli ilac detaylari", form: "client", section: "2.5", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "supplement_flag", label: "Duzenli kullanilan gida takviyesi var mi", form: "client", section: "2.5", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "supplement_details", label: "Gida takviyesi detaylari", form: "client", section: "2.5", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "surgery_history", label: "Daha once gecirilmis ameliyat", form: "client", section: "2.5", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
  defineField({ id: "pregnancy_or_breastfeeding_flag", label: "Gebelik/emzirme durumu", form: "client", section: "2.6", filledBy: "Client / diyetisyen", required: true, options: pregnancyStatuses, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "children_count", label: "Cocuk sayisi", form: "client", section: "2.6", filledBy: "Client / diyetisyen", type: "number", promptAccess: "dietitian_only", privacySensitivity: "high" }),
  defineField({ id: "menstrual_cycle_regular", label: "Adet duzeni", form: "client", section: "2.6", filledBy: "Client / diyetisyen", options: menstrualRegularity, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "risk_modifier", privacySensitivity: "critical" }),
  defineField({ id: "eating_disorder_risk_flag", label: "Yeme bozuklugu riski/gecmisi", form: "client", section: "2.6", filledBy: "Client / diyetisyen", required: true, options: yesNoUnknown, promptAccess: "system_rule", answerabilityRole: "risk_modifier", clinicalSensitivity: "critical", privacySensitivity: "critical" }),
  defineField({ id: "nutrition_history", label: "Gunluk beslenme oykusu", form: "client", section: "2.7", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "current_diet_type", label: "Diyet tipi / mevcut beslenme tarzi", form: "client", section: "2.7", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "nutrition_model", label: "Beslenme modeli", form: "client", section: "2.7", filledBy: "Diyetisyen", type: "multiselect", options: nutritionModels, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "high" }),
  defineField({ id: "disliked_foods", label: "Sevmedigi besinler", form: "client", section: "2.7", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "breakfast_habit", label: "Kahvalti aliskanligi", form: "client", section: "2.7", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "daily_meal_count", label: "Gunluk ogun sayisi", form: "client", section: "2.7", filledBy: "Client / diyetisyen", required: true, options: mealCountOptions, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "outside_eating_frequency", label: "Disaridan yeme sikligi", form: "client", section: "2.7", filledBy: "Client / diyetisyen", options: outsideEatingFrequency, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "daily_caffeine_cups", label: "Gunluk kafein miktari (fincan/kupa)", form: "client", section: "2.7", filledBy: "Client / diyetisyen", type: "number", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "daily_fluid_liters", label: "Gunluk sivi tuketimi (litre)", form: "client", section: "2.7", filledBy: "Client / diyetisyen", required: true, type: "number", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "hot_drink_sugar_habit", label: "Sicak icecekte seker kullanimi", form: "client", section: "2.7", filledBy: "Client / diyetisyen", options: sugarUseOptions, promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "allergies", label: "Besin alerjisi", form: "client", section: "2.8", filledBy: "Client / diyetisyen", required: true, type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", clinicalSensitivity: "critical", privacySensitivity: "critical" }),
  defineField({ id: "food_intolerances", label: "Besin intoleransi", form: "client", section: "2.8", filledBy: "Client / diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "critical" }),
  defineField({ id: "bowel_regular", label: "Duzenli tuvalete cikma durumu", form: "client", section: "2.9", filledBy: "Client / diyetisyen", options: bowelRegularityOptions, promptAccess: "system_rule", answerabilityRole: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "bristol_stool_scale", label: "Bristol diski olcegi", form: "client", section: "2.9", filledBy: "Client / diyetisyen", options: bristolStoolTypes, promptAccess: "system_rule", answerabilityRole: "risk_modifier", privacySensitivity: "high" }),
  defineField({ id: "client_public_preference_summary", label: "Prompt uygun tercih ozeti", form: "client", section: "2.10", filledBy: "Diyetisyen", type: "textarea", promptAccess: "prompt_allowed", answerabilityRole: "answerability_source", privacySensitivity: "medium" }),
  defineField({ id: "free_text_client_notes", label: "Serbest client notu", form: "client", section: "2.10", filledBy: "Client", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical" }),
  defineField({ id: "dietitian_only_notes", label: "Diyetisyen ic notlari", form: "client", section: "2.10", filledBy: "Diyetisyen", type: "textarea", promptAccess: "sensitive_never_prompt", privacySensitivity: "critical", clinicalSensitivity: "critical" }),
];

export const PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS = [
  "first_name",
  "last_name",
  "date_of_birth",
  "adult_status",
  "email",
  "mobile_phone_e164",
  "whatsapp_phone_e164",
  "gender",
  "communication_language",
  "timezone",
  "channel_permission_state",
  "sensitive_data_consent_status",
  "form_prompt_visibility_ack",
  "primary_goal",
  "current_weight_kg",
  "height_cm",
  "general_flexibility_score",
  "goal_flexibility_score",
  "allergies",
  "nutrition_history",
  "daily_meal_count",
  "daily_fluid_liters",
  "diagnosed_condition_flag",
  "medication_or_insulin_flag",
  "supplement_flag",
  "pregnancy_or_breastfeeding_flag",
  "eating_disorder_risk_flag",
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
