export const FOOD_RULE_PROMPT_SEGMENTS_VERSION = "food-rule-prompt-segments-v0.1.0";

export const FOOD_RULE_PROMPT_SEGMENT_TYPES = [
  "food_rule_decision",
  "allowed_food_rules",
  "forbidden_food_rules",
  "equivalent_exchange_rules",
  "diet_type_rules",
  "ingredient_verification",
];

export const BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS = 480;

export const FOOD_RULE_PROVIDER_INSTRUCTION =
  "Follow the food_rule_decision segment exactly. Do not invent new food alternatives, portion increases, calorie or macro changes, or skip relaxations unless the engine decision and structured rules explicitly allow them. When the decision rejects a food, tell the client not to eat it using approved dietitian tone only.";

export function buildFoodRulePromptSegments({
  structuredFoodRules = null,
  foodRuleDecision = null,
  productIngredientEvidence = null,
} = {}) {
  const segments = [];

  const decisionSegment = buildFoodRuleDecisionSegment(foodRuleDecision);
  if (decisionSegment) segments.push(decisionSegment);

  if (structuredFoodRules) {
    const allowed = buildAllowedFoodRulesSegment(structuredFoodRules);
    if (allowed) segments.push(allowed);

    const forbidden = buildForbiddenFoodRulesSegment(structuredFoodRules);
    if (forbidden) segments.push(forbidden);

    const exchange = buildEquivalentExchangeRulesSegment(structuredFoodRules);
    if (exchange) segments.push(exchange);

    const dietType = buildDietTypeRulesSegment(structuredFoodRules);
    if (dietType) segments.push(dietType);
  }

  const ingredient = buildIngredientVerificationSegment(foodRuleDecision, productIngredientEvidence);
  if (ingredient) segments.push(ingredient);

  return segments.filter(Boolean);
}

function buildFoodRuleDecisionSegment(foodRuleDecision) {
  if (!foodRuleDecision || !foodRuleDecision.decision || foodRuleDecision.decision === "not_applicable") {
    return null;
  }

  const lines = [
    `decision: ${foodRuleDecision.decision}`,
    foodRuleDecision.queryType ? `queryType: ${foodRuleDecision.queryType}` : null,
    foodRuleDecision.matchedFood ? `matchedFood: ${foodRuleDecision.matchedFood}` : null,
    foodRuleDecision.exchangeGroupId ? `exchangeGroupId: ${foodRuleDecision.exchangeGroupId}` : null,
    foodRuleDecision.skipTarget ? `skipTarget: ${foodRuleDecision.skipTarget}` : null,
    Array.isArray(foodRuleDecision.reasons) && foodRuleDecision.reasons.length > 0
      ? `reasons: ${foodRuleDecision.reasons.join(",")}`
      : null,
  ].filter(Boolean);

  return textSegment("food_rule_decision", "food_rule_decision", boundedText(lines.join("\n")));
}

function buildAllowedFoodRulesSegment(structuredFoodRules) {
  const items = arrayify(structuredFoodRules.allowedFoodItems);
  const groups = arrayify(structuredFoodRules.allowedFoodGroups);
  if (items.length === 0 && groups.length === 0) return null;

  const lines = [];
  if (items.length > 0) lines.push(`items(${items.length}): ${summarizeList(items)}`);
  if (groups.length > 0) lines.push(`groups(${groups.length}): ${summarizeList(groups)}`);

  return textSegment("allowed_food_rules", "allowed_food_rules", boundedText(lines.join("\n")), {
    authority: "dietitian_approved_context",
  });
}

function buildForbiddenFoodRulesSegment(structuredFoodRules) {
  const items = arrayify(structuredFoodRules.forbiddenFoodItems);
  const groups = arrayify(structuredFoodRules.forbiddenFoodGroups);
  if (items.length === 0 && groups.length === 0) return null;

  const lines = [];
  if (items.length > 0) lines.push(`items(${items.length}): ${summarizeList(items)}`);
  if (groups.length > 0) lines.push(`groups(${groups.length}): ${summarizeList(groups)}`);

  return textSegment("forbidden_food_rules", "forbidden_food_rules", boundedText(lines.join("\n")), {
    authority: "dietitian_approved_context",
  });
}

function buildEquivalentExchangeRulesSegment(structuredFoodRules) {
  const groups = Array.isArray(structuredFoodRules.equivalentExchangeGroups)
    ? structuredFoodRules.equivalentExchangeGroups
    : [];
  if (groups.length === 0) return null;

  const summary = groups
    .map((group) => `${group.groupId || "group"}[${(group.items || []).length}]`)
    .join("; ");

  return textSegment(
    "equivalent_exchange_rules",
    "equivalent_exchange_rules",
    boundedText(`groups(${groups.length}): ${summary}`),
    { authority: "dietitian_approved_context" },
  );
}

function buildDietTypeRulesSegment(structuredFoodRules) {
  const dietType = structuredFoodRules.dietTypeRules ? String(structuredFoodRules.dietTypeRules).trim() : "";
  if (!dietType) return null;

  const skipTolerance = structuredFoodRules.skipToleranceRules
    ? String(structuredFoodRules.skipToleranceRules).trim()
    : null;

  const lines = [`dietType: ${dietType}`, skipTolerance ? `skipTolerance: ${skipTolerance}` : null].filter(Boolean);

  return textSegment("diet_type_rules", "diet_type_rules", boundedText(lines.join("\n")), {
    authority: "dietitian_approved_context",
  });
}

function buildIngredientVerificationSegment(foodRuleDecision, productIngredientEvidence) {
  const verification = foodRuleDecision?.verification;
  if (verification) {
    const lines = [
      `decision: ${verification.decision}`,
      `sourceType: ${verification.ingredientSourceType}`,
      `confidence: ${verification.ingredientConfidence}`,
      verification.matchedForbiddenKeywordIds?.length
        ? `keywordIds: ${verification.matchedForbiddenKeywordIds.join(",")}`
        : null,
      verification.dietTypeConflict ? "dietTypeConflict: true" : null,
    ].filter(Boolean);

    return textSegment("ingredient_verification", "ingredient_verification", boundedText(lines.join("\n")), {
      authority: "food_rule_engine",
    });
  }

  if (!productIngredientEvidence?.ingredientText) return null;

  const lines = [
    `sourceType: ${productIngredientEvidence.ingredientSourceType || "unknown"}`,
    `confidence: ${productIngredientEvidence.ingredientConfidence || "unknown"}`,
    "labelText: omitted_from_prompt",
  ];

  return textSegment("ingredient_verification", "ingredient_verification_pending", boundedText(lines.join("\n")), {
    authority: "food_rule_engine",
  });
}

function textSegment(type, sourceId, text, metadata = {}) {
  const value = boundedText(text);
  if (!value.trim()) return null;

  return {
    id: `${type}-${String(sourceId || "none")}`,
    type,
    sourceId,
    origin: metadata.origin || null,
    createdAt: metadata.createdAt || null,
    authority: metadata.authority || "food_rule_engine",
    importance: metadata.importance || null,
    text: value,
    truncated: value.length < String(text || "").length,
  };
}

function boundedText(text) {
  const value = String(text || "").trim();
  if (value.length <= BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS) return value;
  return `${value.slice(0, BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS - 3)}...`;
}

function summarizeList(values, maxItems = 8) {
  const items = arrayify(values);
  if (items.length <= maxItems) return items.join(", ");
  return `${items.slice(0, maxItems).join(", ")}, +${items.length - maxItems} more`;
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
