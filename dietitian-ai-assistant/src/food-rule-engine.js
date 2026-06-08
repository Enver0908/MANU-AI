export const FOOD_RULE_ENGINE_VERSION = "food-rule-engine-v0.1.0";

export const FOOD_RULE_DECISIONS = [
  "allowed_food_confirmation",
  "forbidden_food_rejection",
  "equivalent_substitution_allowed",
  "diet_type_compatible",
  "diet_type_conflict",
  "optional_skip_allowed",
  "mandatory_skip_blocked",
  "unknown_food_requires_review",
  "product_ingredient_conflict",
  "product_ingredient_unknown",
  "mixed_intent_blocked",
  "not_applicable",
];

const MIXED_INTENT_PATTERN =
  /\b(?:ilac\w*|insulin\w*|metformin|takviye|supplement|medication|dose|doz|tahlil|lab|kan sonucu|belirti|symptom|hamile|pregnan|nefes|gogus|acil|emergency|kalori hedef|makro hedef|porsiyon.*artir|portion.*increase|plan.*degistir)\b/i;

const FOOD_GROUP_KEYWORDS = {
  "Sut urunleri": ["sut", "milk", "peynir", "cheese", "yogurt", "lor", "labne", "whey", "casein", "laktoz", "dairy"],
  Gluten: ["gluten", "bugday", "ekmek", "bread", "pasta", "un"],
  "Kabuklu yemis": ["findik", "badem", "ceviz", "fistik", "peanut", "hazelnut", "walnut", "almond", "nut"],
  "Kirmizi et": ["et", "kirmizi et", "beef", "red meat", "kuzu"],
  "Islenmis seker": ["seker", "cikolata", "chocolate", "candy", "sugar"],
  Yumurta: ["yumurta", "egg"],
  Balik: ["balik", "fish", "somon", "salmon"],
  Soya: ["soya", "soy"],
  Laktoz: ["laktoz", "lactose"],
};

const FOOD_ALIASES = {
  tavuk: "chicken",
  yumurta: "eggs",
  yumurtayi: "eggs",
  badem: "almond",
  ceviz: "walnut",
  findik: "hazelnut",
  fistik: "peanut",
  sut: "milk",
  peynir: "cheese",
  lor: "lor",
};

const DIET_TYPE_FORBIDDEN_GROUPS = {
  Vegan: ["Sut urunleri", "Yumurta", "Balik", "Kirmizi et"],
  Vejetaryen: ["Balik", "Kirmizi et"],
  Glutensiz: ["Gluten"],
  "Dusuk FODMAP": ["Gluten", "Sut urunleri", "Islenmis seker"],
};

export function evaluateFoodRuleDecision(input = {}) {
  const message = String(input.message || "").trim();
  const rules = normalizeStructuredFoodRules(input.structuredFoodRules);
  const productEvidence = input.productIngredientEvidence || null;

  if (!message) {
    return buildResult("not_applicable", ["food_rule_empty_message"], { queryType: null });
  }

  if (input.mixedIntentBlocked === true || MIXED_INTENT_PATTERN.test(normalize(message))) {
    return buildResult("mixed_intent_blocked", ["food_rule_mixed_intent"], { queryType: "mixed" });
  }

  const queryType = detectFoodQueryType(message);
  if (!queryType) {
    return buildResult("not_applicable", ["food_rule_query_not_detected"], { queryType: null });
  }

  if (!hasStructuredRules(rules)) {
    return buildResult("unknown_food_requires_review", ["food_rule_structured_rules_missing"], { queryType });
  }

  if (queryType === "product_ingredient") {
    return evaluateProductIngredientDecision(message, rules, productEvidence);
  }

  if (queryType === "meal_skip") {
    return evaluateSkipDecision(message, rules);
  }

  if (queryType === "food_substitution") {
    return evaluateSubstitutionDecision(message, rules);
  }

  return evaluateFoodPermissionDecision(message, rules);
}

function evaluateFoodPermissionDecision(message, rules) {
  const foods = extractSingleFoodTargets(message);
  if (foods.length === 0) {
    return buildResult("unknown_food_requires_review", ["food_rule_food_target_missing"], {
      queryType: "food_permission",
    });
  }

  for (const food of foods) {
    const forbidden = matchForbiddenFood(food, rules);
    if (forbidden) {
      return buildResult("forbidden_food_rejection", ["food_rule_forbidden_match", forbidden.reason], {
        queryType: "food_permission",
        matchedFood: food,
        matchedSource: forbidden.source,
      });
    }
  }

  for (const food of foods) {
    const allowed = matchAllowedFood(food, rules);
    if (allowed) {
      return buildResult("allowed_food_confirmation", ["food_rule_allowed_match", allowed.reason], {
        queryType: "food_permission",
        matchedFood: food,
        matchedSource: allowed.source,
      });
    }
  }

  for (const food of foods) {
    const diet = evaluateDietTypeCompatibility(food, rules);
    if (diet === "conflict") {
      return buildResult("diet_type_conflict", ["food_rule_diet_type_conflict"], {
        queryType: "food_permission",
        matchedFood: food,
        dietType: rules.dietTypeRules,
      });
    }
    if (diet === "compatible") {
      return buildResult("diet_type_compatible", ["food_rule_diet_type_compatible"], {
        queryType: "food_permission",
        matchedFood: food,
        dietType: rules.dietTypeRules,
      });
    }
  }

  return failClosedUnknown(rules, "food_permission");
}

function evaluateSubstitutionDecision(message, rules) {
  const pair = extractSubstitutionPair(message);
  if (!pair) {
    return buildResult("unknown_food_requires_review", ["food_rule_substitution_pair_missing"], {
      queryType: "food_substitution",
    });
  }

  for (const group of rules.equivalentExchangeGroups) {
    const sourceIndex = findItemIndex(pair.source, group.items);
    const targetIndex = findItemIndex(pair.target, group.items);
    if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
      return buildResult("equivalent_substitution_allowed", ["food_rule_exchange_group_match", group.groupId], {
        queryType: "food_substitution",
        exchangeGroupId: group.groupId,
        sourceFood: pair.source,
        targetFood: pair.target,
      });
    }
  }

  const targetForbidden = matchForbiddenFood(pair.target, rules);
  if (targetForbidden) {
    return buildResult("forbidden_food_rejection", ["food_rule_substitution_target_forbidden", targetForbidden.reason], {
      queryType: "food_substitution",
      matchedFood: pair.target,
      matchedSource: targetForbidden.source,
    });
  }

  return failClosedUnknown(rules, "food_substitution");
}

function evaluateSkipDecision(message, rules) {
  const referenced = extractSkipTarget(message, rules);
  const tolerance = String(rules.skipToleranceRules || "").trim();

  if (referenced.mandatoryHit) {
    if (tolerance === "Bugunluk esnek" && /\b(?:bugun|today)\b/i.test(normalize(message))) {
      return buildResult("optional_skip_allowed", ["food_rule_today_only_skip_tolerance"], {
        queryType: "meal_skip",
        skipTarget: referenced.target,
      });
    }
    return buildResult("mandatory_skip_blocked", ["food_rule_mandatory_skip_blocked"], {
      queryType: "meal_skip",
      skipTarget: referenced.target,
    });
  }

  if (referenced.optionalHit) {
    if (tolerance === "Atlanamaz") {
      return buildResult("mandatory_skip_blocked", ["food_rule_skip_tolerance_disallows"], {
        queryType: "meal_skip",
        skipTarget: referenced.target,
      });
    }
    if (tolerance === "Haftada 1 kez esnek" || tolerance === "Bugunluk esnek") {
      return buildResult("optional_skip_allowed", ["food_rule_optional_skip_allowed", tolerance], {
        queryType: "meal_skip",
        skipTarget: referenced.target,
      });
    }
    if (tolerance === "Diyetisyen onayi gerekli") {
      return buildResult("unknown_food_requires_review", ["food_rule_skip_requires_dietitian_review"], {
        queryType: "meal_skip",
        skipTarget: referenced.target,
      });
    }
  }

  if (/\b(?:atla|skip|atlayabilir)\b/i.test(normalize(message)) && tolerance && tolerance !== "Atlanamaz") {
    return buildResult("optional_skip_allowed", ["food_rule_general_skip_tolerance", tolerance], {
      queryType: "meal_skip",
    });
  }

  return failClosedUnknown(rules, "meal_skip");
}

function evaluateProductIngredientDecision(message, rules, productEvidence) {
  if (!productEvidence || !String(productEvidence.ingredientText || "").trim()) {
    return buildResult("product_ingredient_unknown", ["food_rule_product_evidence_missing"], {
      queryType: "product_ingredient",
    });
  }

  const confidence = String(productEvidence.ingredientConfidence || "unknown").toLowerCase();
  if (confidence !== "exact" && confidence !== "high") {
    return buildResult("product_ingredient_unknown", ["food_rule_product_confidence_insufficient", confidence], {
      queryType: "product_ingredient",
      ingredientConfidence: confidence,
    });
  }

  const ingredientText = normalize(productEvidence.ingredientText);
  const matchedKeywords = rules.ingredientAllergenKeywords.filter((keyword) =>
    ingredientText.includes(normalize(keyword)),
  );

  if (matchedKeywords.length === 0) {
    return buildResult("allowed_food_confirmation", ["food_rule_product_no_forbidden_keyword_match"], {
      queryType: "product_ingredient",
      matchedKeywords: [],
    });
  }

  const forbiddenKeyword = matchedKeywords.find((keyword) => isForbiddenKeyword(keyword, rules));
  if (forbiddenKeyword) {
    return buildResult("product_ingredient_conflict", ["food_rule_product_forbidden_keyword_match", forbiddenKeyword], {
      queryType: "product_ingredient",
      matchedKeywords,
      ingredientConfidence: confidence,
      ingredientSourceType: productEvidence.ingredientSourceType || "unknown",
    });
  }

  return failClosedUnknown(rules, "product_ingredient");
}

function isForbiddenKeyword(keyword, rules) {
  const normalizedKeyword = normalize(keyword);
  return (
    rules.forbiddenFoodItems.some((item) => tokensMatch(normalizedKeyword, item)) ||
    rules.ingredientAllergenKeywords.some((item) => tokensMatch(normalizedKeyword, item))
  );
}

function matchForbiddenFood(food, rules) {
  const hit = rules.forbiddenFoodItems.find((item) => tokensMatch(food, item));
  if (hit) return { reason: `forbidden_item:${hit}`, source: "forbidden_food_items" };

  const groups = inferFoodGroups(food);
  const forbiddenGroup = groups.find((group) => rules.forbiddenFoodGroups.includes(group));
  if (forbiddenGroup) {
    return { reason: `forbidden_group:${forbiddenGroup}`, source: "forbidden_food_groups" };
  }

  return null;
}

function matchAllowedFood(food, rules) {
  const hit = rules.allowedFoodItems.find((item) => tokensMatch(food, item));
  if (hit) return { reason: `allowed_item:${hit}`, source: "allowed_food_items" };

  const groups = inferFoodGroups(food);
  const allowedGroup = groups.find((group) => rules.allowedFoodGroups.includes(group));
  if (allowedGroup) {
    return { reason: `allowed_group:${allowedGroup}`, source: "allowed_food_groups" };
  }

  return null;
}

function evaluateDietTypeCompatibility(food, rules) {
  const dietType = rules.dietTypeRules;
  if (!dietType || dietType === "Genel denge" || dietType === "Akdeniz" || dietType === "Dusuk karbonhidrat" || dietType === "Diyabet dostu") {
    return "unknown";
  }

  const forbiddenGroups = DIET_TYPE_FORBIDDEN_GROUPS[dietType] || [];
  const groups = inferFoodGroups(food);
  if (groups.some((group) => forbiddenGroups.includes(group))) {
    return "conflict";
  }

  if (groups.length > 0) {
    return "compatible";
  }

  return "unknown";
}

function inferFoodGroups(food) {
  const normalizedFood = normalize(food);
  return Object.entries(FOOD_GROUP_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalizedFood.includes(normalize(keyword))))
    .map(([group]) => group);
}

function extractSingleFoodTargets(message) {
  const normalized = normalize(message);
  const targets = [];

  const leadingPatterns = [
    /^(?:can i eat|eat)\s+(.+?)(?:\?|$)/i,
    /^(.+?)\s+(?:yiyebilir miyim|yerim mi|yiyebilir mi|yiyebilir miyiz)(?:\?|$)/i,
  ];

  for (const pattern of leadingPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      targets.push(cleanFoodPhrase(match[1]));
      return uniqueFoods(targets);
    }
  }

  const inline = normalized.match(/(?:yiyebilir miyim|yerim mi|can i eat)\s+(.+?)(?:\?|$)/i);
  if (inline?.[1]) targets.push(cleanFoodPhrase(inline[1]));

  return uniqueFoods(targets);
}

function extractSubstitutionPair(message) {
  const normalized = normalize(message);
  const match =
    normalized.match(/(.+?)\s+(?:yerine|instead of|swap for|degistir(?:ebilir)?)\s+(.+?)(?:\?|$)/i) ||
    normalized.match(/(?:yerine|instead of|swap for)\s+(.+?)\s+(?:kullan|yiyebilir|olur mu)\s+(.+?)(?:\?|$)/i);

  if (!match) return null;
  return {
    source: cleanFoodPhrase(match[1]),
    target: cleanFoodPhrase(match[2]),
  };
}

function extractSkipTarget(message, rules) {
  const normalized = normalize(message);
  const mandatoryHit = rules.mandatoryFoodsOrMeals.find((item) => normalized.includes(normalize(item)));
  const optionalHit = rules.optionalFoodsOrMeals.find((item) => normalized.includes(normalize(item)));
  return {
    mandatoryHit: Boolean(mandatoryHit),
    optionalHit: Boolean(optionalHit),
    target: mandatoryHit || optionalHit || null,
  };
}

function detectFoodQueryType(message) {
  const normalized = normalize(message);
  if (/\b(?:icerik\w*|ingredient\w*|etiket\w*|label|icinde\w*|içinde\w*)\b/i.test(normalized)) {
    return "product_ingredient";
  }
  if (
    /\b(?:atlayabilir|atlamak|skip|atla)\b/i.test(normalized) &&
    /\b(?:ogun\w*|meal|kahvalti|ogle|aksam|snack|ara|breakfast|lunch|dinner)\b/i.test(normalized)
  ) {
    return "meal_skip";
  }
  if (/\b(?:yerine|instead of|alternatif|swap|degistir)\b/i.test(normalized)) {
    return "food_substitution";
  }
  if (/\b(?:yiyebilir|yerim|can i eat|eat)\b/i.test(normalized)) {
    return "food_permission";
  }
  return null;
}

function failClosedUnknown(rules, queryType) {
  const policy = String(rules.uncertaintyPolicy || "").trim();
  if (policy === "Emin degilse green ret") {
    return buildResult("forbidden_food_rejection", ["food_rule_uncertainty_policy_reject"], { queryType });
  }
  return buildResult("unknown_food_requires_review", ["food_rule_uncertainty_fail_closed", policy || "unset"], {
    queryType,
  });
}

function hasStructuredRules(rules) {
  return (
    rules.forbiddenFoodItems.length > 0 ||
    rules.forbiddenFoodGroups.length > 0 ||
    rules.allowedFoodItems.length > 0 ||
    rules.allowedFoodGroups.length > 0 ||
    rules.equivalentExchangeGroups.length > 0 ||
    Boolean(rules.dietTypeRules)
  );
}

function normalizeStructuredFoodRules(input = {}) {
  const rules = input && typeof input === "object" ? input : {};
  return {
    forbiddenFoodItems: arrayify(rules.forbiddenFoodItems),
    forbiddenFoodGroups: arrayify(rules.forbiddenFoodGroups),
    allowedFoodItems: arrayify(rules.allowedFoodItems),
    allowedFoodGroups: arrayify(rules.allowedFoodGroups),
    dietTypeRules: rules.dietTypeRules ? String(rules.dietTypeRules).trim() : null,
    equivalentExchangeGroups: Array.isArray(rules.equivalentExchangeGroups) ? rules.equivalentExchangeGroups : [],
    mandatoryFoodsOrMeals: arrayify(rules.mandatoryFoodsOrMeals),
    optionalFoodsOrMeals: arrayify(rules.optionalFoodsOrMeals),
    skipToleranceRules: rules.skipToleranceRules ? String(rules.skipToleranceRules).trim() : null,
    portionBoundaries: rules.portionBoundaries ? String(rules.portionBoundaries).trim() : null,
    ingredientAllergenKeywords: arrayify(rules.ingredientAllergenKeywords),
    productLabelReviewPolicy: rules.productLabelReviewPolicy ? String(rules.productLabelReviewPolicy).trim() : null,
    uncertaintyPolicy: rules.uncertaintyPolicy ? String(rules.uncertaintyPolicy).trim() : null,
  };
}

function findItemIndex(food, items) {
  return items.findIndex((item) => tokensMatch(food, item));
}

function canonicalFoodToken(value) {
  const normalized = normalize(value);
  return FOOD_ALIASES[normalized] || normalized;
}

function tokensMatch(left, right) {
  const a = canonicalFoodToken(left);
  const b = canonicalFoodToken(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  return false;
}

function cleanFoodPhrase(value) {
  return String(value || "")
    .replace(/\b(?:bugun|today|simdi|now|bir|the)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueFoods(values) {
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

function arrayify(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function buildResult(decision, reasons, metadata = {}) {
  return {
    version: FOOD_RULE_ENGINE_VERSION,
    decision,
    allowed: ![
      "unknown_food_requires_review",
      "product_ingredient_unknown",
      "mixed_intent_blocked",
      "not_applicable",
    ].includes(decision),
    reasons,
    ...metadata,
  };
}
