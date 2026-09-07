import { AIYA_BRAND_NAME } from "./brand";
import type { ClientFormFieldDefinition, ClientFormResponseRecord, DietitianFormResponseRecord } from "./types";
import {
  buildPhase70ClientFormSchema,
  buildPhase70DietitianFormSchema,
  PHASE_70_CLIENT_FIELDS,
  PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS,
} from "./phase-70-form-registry";

export const DEMO_DIETITIAN_FORM_SCHEMA_ID = "00000000-0000-4000-8000-000000000502";

function defaultAnswerForField(field: ClientFormFieldDefinition) {
  if (field.options?.length) {
    if (field.type === "multiselect") return [field.options[0]];
    return field.options[0];
  }
  if (field.type === "number") return 1;
  if (field.type === "date") return "2026-05-22";
  if (field.type === "boolean") return true;
  return `demo-${field.id}`;
}

export function buildPhase70DemoClientAnswers(overrides: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {};
  for (const field of PHASE_70_CLIENT_FIELDS) {
    if (!field.required) continue;
    answers[field.id] = defaultAnswerForField(field);
  }

  return {
    ...answers,
    adult_status: "Adult",
    communication_language: "TR",
    timezone: "Europe/Istanbul",
    channel_permission_state: "ready",
    sensitive_data_consent_status: "approved",
    form_prompt_visibility_ack: "Evet",
    primary_goal: "Fat loss with steady meal adherence",
    goal_type: "Kilo verme",
    active_diet_plan_summary: "Three meals, one planned snack, no peanut suggestions.",
    meal_plan_slots: "Breakfast: eggs and greens. Lunch: grilled chicken salad. Dinner: vegetable soup.",
    allowed_substitutions: "Egg swaps to lor cheese when needed.",
    allergies: "peanut",
    restricted_foods_medical: "None beyond allergy list.",
    forbidden_substitutions: "peanut",
    forbidden_food_items: "peanut, peanut butter",
    forbidden_food_groups: ["Kabuklu yemis"],
    allowed_food_items: "eggs, chicken, lor cheese, greens",
    allowed_food_groups: ["Balik"],
    diet_type_rules: "Genel denge",
    equivalent_exchange_groups: "nut_swap: almond|walnut|hazelnut; dairy_alt: lor|labne",
    mandatory_foods_or_meals: "breakfast, lunch protein",
    optional_foods_or_meals: "planned snack",
    skip_tolerance_rules: "Haftada 1 kez esnek",
    portion_boundaries: "No automatic portion increases; remind plan portions only.",
    ingredient_allergen_keywords: ["fistik", "sut", "laktoz"],
    product_label_review_policy: "Yalnizca kullanici etiketi metni",
    uncertainty_policy: "Emin degilse yellow",
    diagnosed_condition_flag: "Hayir",
    diabetes_or_glucose_flag: "Hayir",
    medication_or_insulin_flag: "Hayir",
    supplement_flag: "Hayir",
    pregnancy_or_breastfeeding_flag: "Hayir",
    eating_disorder_risk_flag: "Hayir",
    first_name: "Mert",
    last_name: "Kaya",
    date_of_birth: "1994-05-22",
    email: "mert.kaya@example.test",
    mobile_phone_e164: "+905551110001",
    whatsapp_phone_e164: "+905551110001",
    gender: "Erkek",
    profession: "Software developer",
    marital_status: "Bekar",
    city: "Istanbul",
    emergency_contact_policy_ack: "Evet",
    current_weight_kg: 84,
    height_cm: 178,
    waist_circumference_cm: 94,
    hip_circumference_cm: 101,
    weight_change_period: "Son 6 ay",
    weight_change_direction: "Verme",
    weight_change_kg: 3,
    weight_change_intentionality: "Istemli",
    target_weight_kg: 78,
    goal_timeline: "12 weeks",
    general_flexibility_score: "Orta esnek",
    goal_flexibility_score: "Kisitli",
    average_sleep_hours: 7,
    work_hours: "09:00-18:00 weekdays",
    work_movement_level: "Hareketsiz",
    smoking_status: "Icmiyor",
    alcohol_status: "Nadiren",
    sport_status: "Haftada 3-4",
    sport_details: "Strength training and walking.",
    surgery_history: "Yok",
    children_count: 0,
    menstrual_cycle_regular: "Uygun degil",
    nutrition_history: "Breakfast, lunch, dinner and one planned snack.",
    current_diet_type: "Mixed balanced diet",
    nutrition_model: ["Kalori kisitlama", "Akdeniz diyeti"],
    disliked_foods: "okra",
    breakfast_habit: "Usually eats breakfast.",
    daily_meal_count: "4",
    outside_eating_frequency: "Haftada 1-2",
    daily_caffeine_cups: 2,
    daily_fluid_liters: 2.5,
    hot_drink_sugar_habit: "Kullanmiyor",
    food_intolerances: "None known.",
    bowel_regular: "Duzenli",
    bristol_stool_scale: "Tip 4",
    client_public_preference_summary: "Prefers practical swaps and clear short guidance.",
    recent_symptom_flag: "Hayir",
    lab_result_available: "Hayir",
    ai_status: "active",
    ai_mode: "autopilot",
    safety_checklist_complete: "Evet",
    ...overrides,
  };
}

export function buildPhase70QualifiedClientAnswers() {
  return buildPhase70DemoClientAnswers() satisfies Record<
    (typeof PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS)[number],
    unknown
  >;
}

export function buildPhase70DietitianDemoAnswers() {
  return {
    dietitian_full_name: "Dyt. Ayse",
    professional_title: "Diyetisyen",
    credential_id: "demo-credential-001",
    credential_jurisdiction: "Turkiye",
    clinic_name: `${AIYA_BRAND_NAME} Demo Clinic`,
    supported_client_languages: ["TR"],
    default_communication_language: "TR",
    default_persona: "Dengeli Koc",
    emoji_policy: "Az",
    preferred_reply_length: "Kisa",
    formality_level: "Dengeli",
    working_hours: "09:00-18:00 weekdays",
    urgent_handoff_owner: "demo-handoff-owner",
    yellow_review_sla: "2s",
    red_response_sla: "30dk",
    client_capacity_limit: 50,
    autopilot_allowed_by_default: "Evet",
    allowed_green_topics: ["Plan hatirlatma", "Lojistik", "Izinli alternatif"],
    draft_only_topics: ["Plan degisikligi", "Supplement"],
    never_green_topics: ["Ilac/insulin", "Acil belirti"],
    substitution_policy: "Onayli esdeger listeden",
    portion_change_policy: "Sadece taslak",
    supplement_policy: "Her zaman handoff",
    medication_policy: "Her zaman yellow/red handoff",
    lab_result_policy: "Her zaman handoff",
    minor_policy: "Kabul edilmez",
    pregnancy_policy: "Manual-only",
    eating_disorder_policy: "Handoff",
    official_sources_acknowledged: "Evet",
    form_prompt_approval_ack: "Evet",
    product_covenant_ack: "Evet",
    manual_takeover_policy_ack: "Evet",
  };
}

export function buildPhase70SeedFormBundle(input: {
  tenantId: string;
  clientSchemaId: string;
  dietitianSchemaId: string;
  clientId: string;
  dietitianId: string;
  createdAt: string;
}) {
  const clientSchema = buildPhase70ClientFormSchema({
    tenantId: input.tenantId,
    schemaId: input.clientSchemaId,
    languageCode: "tr",
    createdAt: input.createdAt,
  });
  const dietitianSchema = buildPhase70DietitianFormSchema({
    tenantId: input.tenantId,
    schemaId: input.dietitianSchemaId,
    languageCode: "tr",
    createdAt: input.createdAt,
  });
  const clientResponse: ClientFormResponseRecord = {
    id: "client-form-response-mert",
    tenantId: input.tenantId,
    clientId: input.clientId,
    schemaId: clientSchema.id,
    schemaVersion: clientSchema.version,
    schemaSnapshot: clientSchema,
    languageCode: clientSchema.languageCode,
    submittedPhoneE164: "+905551110001",
    answers: buildPhase70QualifiedClientAnswers(),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  const dietitianResponse: DietitianFormResponseRecord = {
    id: "dietitian-form-response-ayse",
    tenantId: input.tenantId,
    dietitianId: input.dietitianId,
    schemaId: dietitianSchema.id,
    schemaVersion: dietitianSchema.version,
    schemaSnapshot: dietitianSchema,
    languageCode: dietitianSchema.languageCode,
    answers: buildPhase70DietitianDemoAnswers(),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  return { clientSchema, dietitianSchema, clientResponse, dietitianResponse };
}
