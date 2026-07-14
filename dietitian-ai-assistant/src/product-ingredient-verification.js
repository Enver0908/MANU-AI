export const PRODUCT_INGREDIENT_VERIFICATION_VERSION = "product-ingredient-verification-v0.1.0";

export const INGREDIENT_SOURCE_TYPES = [
  "user_label_text",
  "visual_label_ocr",
  "barcode_database",
  "approved_product_catalog",
  "dietitian_product_note",
  "unknown",
];

export const INGREDIENT_CONFIDENCE_LEVELS = ["exact", "high", "low", "unknown"];

export const PRODUCT_INGREDIENT_VERIFICATION_DECISIONS = [
  "product_allowed",
  "product_blocked",
  "requires_review",
];

const TRUSTED_SOURCE_TYPES = new Set([
  "user_label_text",
  "barcode_database",
  "approved_product_catalog",
  "dietitian_product_note",
]);

const TRUSTED_CONFIDENCE = new Set(["exact", "high"]);

const LABEL_GROUP_KEYWORDS = {
  "Sut urunleri": ["sut", "milk", "peynir", "cheese", "yogurt", "lor", "labne", "whey", "casein", "laktoz", "dairy"],
  Gluten: ["gluten", "bugday", "ekmek", "bread", "pasta", "un", "wheat"],
  "Kabuklu yemis": ["findik", "badem", "ceviz", "fistik", "peanut", "hazelnut", "walnut", "almond", "nut"],
  "Kirmizi et": ["et", "beef", "red meat", "kuzu", "chicken", "tavuk"],
  Yumurta: ["yumurta", "egg"],
  Balik: ["balik", "fish", "somon", "salmon"],
  Soya: ["soya", "soy"],
};

const DIET_TYPE_FORBIDDEN_GROUPS = {
  Vegan: ["Sut urunleri", "Yumurta", "Balik", "Kirmizi et"],
  Vejetaryen: ["Balik", "Kirmizi et"],
  Glutensiz: ["Gluten"],
  "Dusuk FODMAP": ["Gluten", "Sut urunleri", "Islenmis seker"],
};

export function evaluateProductIngredientVerification(input = {}) {
  const ingredientSourceType = String(input.ingredientSourceType || "unknown").trim() || "unknown";
  const ingredientConfidence = String(input.ingredientConfidence || "unknown").trim().toLowerCase() || "unknown";
  const ingredientText = String(input.ingredientText || "").trim();
  const ingredientAllergenKeywords = arrayify(input.ingredientAllergenKeywords);
  const forbiddenFoodItems = arrayify(input.forbiddenFoodItems);
  const forbiddenFoodGroups = arrayify(input.forbiddenFoodGroups);
  const dietTypeRules = input.dietTypeRules ? String(input.dietTypeRules).trim() : null;

  const base = {
    version: PRODUCT_INGREDIENT_VERIFICATION_VERSION,
    ingredientSourceType,
    ingredientConfidence,
    matchedForbiddenKeywordIds: [],
    dietTypeConflict: false,
    dietTypeConflictGroup: null,
  };

  if (ingredientSourceType === "visual_label_ocr") {
    if (!ingredientText) {
      return finish("requires_review", ["product_ingredient_text_missing"], base);
    }
    if (!TRUSTED_CONFIDENCE.has(ingredientConfidence)) {
      return finish("requires_review", ["product_ingredient_confidence_insufficient", ingredientConfidence], base);
    }

    const normalizedText = normalize(ingredientText);
    const matchedForbiddenKeywordIds = matchForbiddenKeywordIds(
      normalizedText,
      ingredientAllergenKeywords,
      forbiddenFoodItems,
      forbiddenFoodGroups,
    );
    if (matchedForbiddenKeywordIds.length > 0) {
      return finish("product_blocked", ["product_ingredient_forbidden_keyword_match"], {
        ...base,
        matchedForbiddenKeywordIds,
      });
    }

    return finish("requires_review", ["visual_label_ocr_absence_not_allowed"], base);
  }

  if (!TRUSTED_SOURCE_TYPES.has(ingredientSourceType)) {
    return finish("requires_review", ["product_ingredient_source_untrusted"], base);
  }

  if (!ingredientText) {
    return finish("requires_review", ["product_ingredient_text_missing"], base);
  }

  if (!TRUSTED_CONFIDENCE.has(ingredientConfidence)) {
    return finish("requires_review", ["product_ingredient_confidence_insufficient", ingredientConfidence], base);
  }

  const normalizedText = normalize(ingredientText);
  const matchedForbiddenKeywordIds = matchForbiddenKeywordIds(
    normalizedText,
    ingredientAllergenKeywords,
    forbiddenFoodItems,
    forbiddenFoodGroups,
  );

  if (matchedForbiddenKeywordIds.length > 0) {
    return finish("product_blocked", ["product_ingredient_forbidden_keyword_match"], {
      ...base,
      matchedForbiddenKeywordIds,
    });
  }

  const dietConflict = detectDietTypeConflictInLabel(normalizedText, dietTypeRules);
  if (dietConflict) {
    return finish("product_blocked", ["product_ingredient_diet_type_conflict", dietConflict.group], {
      ...base,
      dietTypeConflict: true,
      dietTypeConflictGroup: dietConflict.group,
    });
  }

  return finish("product_allowed", ["product_ingredient_no_forbidden_match"], base);
}

function matchForbiddenKeywordIds(normalizedText, ingredientAllergenKeywords, forbiddenFoodItems, forbiddenFoodGroups) {
  const candidates = uniqueKeywords([...ingredientAllergenKeywords, ...forbiddenFoodItems]);
  const matched = [];

  for (const keyword of candidates) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword || !normalizedText.includes(normalizedKeyword)) continue;
    if (!isForbiddenKeywordForClient(keyword, forbiddenFoodItems, forbiddenFoodGroups, ingredientAllergenKeywords)) {
      continue;
    }
    matched.push(buildKeywordId(keyword));
  }

  return Array.from(new Set(matched));
}

function isForbiddenKeywordForClient(keyword, forbiddenFoodItems, forbiddenFoodGroups, ingredientAllergenKeywords) {
  const normalizedKeyword = normalize(keyword);
  if (forbiddenFoodItems.some((item) => tokensMatch(normalizedKeyword, item))) {
    return true;
  }

  const groups = inferFoodGroups(normalizedKeyword);
  if (groups.some((group) => forbiddenFoodGroups.includes(group))) {
    return true;
  }

  return ingredientAllergenKeywords.some((item) => tokensMatch(normalizedKeyword, item));
}

function detectDietTypeConflictInLabel(normalizedText, dietTypeRules) {
  if (!dietTypeRules || dietTypeRules === "Genel denge" || dietTypeRules === "Akdeniz" || dietTypeRules === "Dusuk karbonhidrat" || dietTypeRules === "Diyabet dostu") {
    return null;
  }

  const forbiddenGroups = DIET_TYPE_FORBIDDEN_GROUPS[dietTypeRules] || [];
  for (const group of forbiddenGroups) {
    const keywords = LABEL_GROUP_KEYWORDS[group] || [];
    if (keywords.some((keyword) => normalizedText.includes(normalize(keyword)))) {
      return { group, dietType: dietTypeRules };
    }
  }

  return null;
}

function inferFoodGroups(token) {
  const normalized = normalize(token);
  return Object.entries(LABEL_GROUP_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalize(keyword)) || tokensMatch(normalized, keyword)))
    .map(([group]) => group);
}

function buildKeywordId(keyword) {
  return `keyword:${normalize(keyword)}`;
}

function finish(decision, reasons, metadata) {
  return {
    ...metadata,
    decision,
    reasons,
  };
}

function normalize(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

function tokensMatch(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

function arrayify(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueKeywords(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const token = normalize(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    result.push(value);
  }
  return result;
}
