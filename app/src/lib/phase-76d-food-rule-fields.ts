import type { Phase70RegistryField } from "./phase-70-form-registry";
import type { FormFieldType } from "./types";

export const PHASE_76D_FOOD_GROUP_OPTIONS = [
  "Sut urunleri",
  "Gluten",
  "Kabuklu yemis",
  "Kirmizi et",
  "Islenmis seker",
  "Yumurta",
  "Balik",
  "Soya",
  "Laktoz",
] as const;

export const PHASE_76D_DIET_TYPE_OPTIONS = [
  "Genel denge",
  "Akdeniz",
  "Vegan",
  "Vejetaryen",
  "Dusuk karbonhidrat",
  "Diyabet dostu",
  "Glutensiz",
  "Dusuk FODMAP",
] as const;

export const PHASE_76D_SKIP_TOLERANCE_OPTIONS = [
  "Atlanamaz",
  "Haftada 1 kez esnek",
  "Bugunluk esnek",
  "Diyetisyen onayi gerekli",
] as const;

export const PHASE_76D_PRODUCT_LABEL_REVIEW_OPTIONS = [
  "Yalnizca kullanici etiketi metni",
  "Barkod veri tabani kapali",
  "Onayli urun katalogu kapali",
] as const;

export const PHASE_76D_UNCERTAINTY_POLICY_OPTIONS = [
  "Emin degilse yellow",
  "Emin degilse handoff",
  "Emin degilse green ret",
] as const;

export const PHASE_76D_INGREDIENT_KEYWORD_OPTIONS = [
  "sut",
  "laktoz",
  "whey",
  "casein",
  "gluten",
  "yumurta",
  "balik",
  "soya",
  "findik",
  "badem",
  "fistik",
] as const;

type FoodRuleFieldInput = {
  id: string;
  label: string;
  required?: boolean;
  type?: FormFieldType;
  options?: readonly string[];
};

function defineFoodRuleField(input: FoodRuleFieldInput): Phase70RegistryField {
  const promptAccess = "prompt_allowed" as const;
  return {
    id: input.id,
    label: input.label,
    type: input.type || (input.options ? "select" : "textarea"),
    required: Boolean(input.required),
    options: input.options ? [...input.options] : undefined,
    llmVisibility: "prompt_allowed",
    promptAccess,
    answerabilityRole: "answerability_source",
    privacySensitivity: "high",
    clinicalSensitivity: input.id.includes("allergen") || input.id.includes("forbidden") ? "critical" : "none",
    section: "2.3.1",
    form: "client",
    filledBy: "Diyetisyen",
  };
}

export const PHASE_76D_CLIENT_FOOD_RULE_FIELDS: Phase70RegistryField[] = [
  defineFoodRuleField({
    id: "forbidden_food_items",
    label: "Yasak besinler (virgul listesi)",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "forbidden_food_groups",
    label: "Yasak besin gruplari",
    required: true,
    type: "multiselect",
    options: PHASE_76D_FOOD_GROUP_OPTIONS,
  }),
  defineFoodRuleField({
    id: "allowed_food_items",
    label: "Izinli besinler (virgul listesi)",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "allowed_food_groups",
    label: "Izinli besin gruplari",
    required: true,
    type: "multiselect",
    options: PHASE_76D_FOOD_GROUP_OPTIONS,
  }),
  defineFoodRuleField({
    id: "diet_type_rules",
    label: "Aktif diyet tipi kurallari",
    required: true,
    options: PHASE_76D_DIET_TYPE_OPTIONS,
  }),
  defineFoodRuleField({
    id: "equivalent_exchange_groups",
    label: "Esdeger degisim gruplari (grup: a|b; grup2: c|d)",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "mandatory_foods_or_meals",
    label: "Zorunlu besin veya ogunler",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "optional_foods_or_meals",
    label: "Opsiyonel besin veya ogunler",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "skip_tolerance_rules",
    label: "Atlama tolerans kurallari",
    required: true,
    options: PHASE_76D_SKIP_TOLERANCE_OPTIONS,
  }),
  defineFoodRuleField({
    id: "portion_boundaries",
    label: "Porsiyon sinirlari (hatirlatma)",
    required: true,
    type: "textarea",
  }),
  defineFoodRuleField({
    id: "ingredient_allergen_keywords",
    label: "Alerjen/icerik anahtar kelimeleri",
    required: true,
    type: "multiselect",
    options: PHASE_76D_INGREDIENT_KEYWORD_OPTIONS,
  }),
  defineFoodRuleField({
    id: "product_label_review_policy",
    label: "Urun etiketi inceleme politikasi",
    required: true,
    options: PHASE_76D_PRODUCT_LABEL_REVIEW_OPTIONS,
  }),
  defineFoodRuleField({
    id: "uncertainty_policy",
    label: "Belirsizlik politikasi",
    required: true,
    options: PHASE_76D_UNCERTAINTY_POLICY_OPTIONS,
  }),
];

export const PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS = [
  "forbidden_food_items",
  "forbidden_food_groups",
  "allowed_food_items",
  "allowed_food_groups",
  "diet_type_rules",
  "equivalent_exchange_groups",
  "mandatory_foods_or_meals",
  "optional_foods_or_meals",
  "skip_tolerance_rules",
  "portion_boundaries",
  "ingredient_allergen_keywords",
  "product_label_review_policy",
  "uncertainty_policy",
] as const;

export const PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS = PHASE_76D_CLIENT_FOOD_RULE_FIELDS.map((field) => field.id);
