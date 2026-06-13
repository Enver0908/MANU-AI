export const FOOD_DECISION_V2_PROMPT_SEGMENTS_VERSION = "food-decision-v2-prompt-segments-v0.1.0";

export const FOOD_DECISION_V2_PROMPT_SEGMENT_TYPES = [
  "food_decision_v2",
  "food_profile_summary",
  "menu_authority",
  "flexibility_modifier",
  "ingredient_evidence_v2",
  "food_source_manifest",
];

export const FOOD_DECISION_V2_PROVIDER_INSTRUCTION =
  "Follow the food_decision_v2 segment exactly. Style the reply in dietitian tone only. Do not invent new foods, portions, calorie or macro changes, skip relaxations, or strong approvals that contradict the V2 decision. For discourage, acknowledge the request without strong approval. For needs_label, ask only for written ingredient text. Never include raw product label text in the reply.";

export function buildFoodDecisionV2PromptSegments({ foodDecisionV2 = null } = {}) {
  if (!foodDecisionV2?.decision || foodDecisionV2.decision === "not_applicable") {
    return [];
  }

  const segments = [
    buildFoodDecisionV2Segment(foodDecisionV2),
    buildFoodProfileSummarySegment(foodDecisionV2),
    buildMenuAuthoritySegment(foodDecisionV2),
    buildFlexibilityModifierSegment(foodDecisionV2),
    buildIngredientEvidenceV2Segment(foodDecisionV2),
    buildFoodSourceManifestSegment(foodDecisionV2),
  ];

  return segments.filter(Boolean);
}

function buildFoodDecisionV2Segment(foodDecisionV2) {
  const lines = [
    `decision: ${foodDecisionV2.decision}`,
    foodDecisionV2.queryType ? `queryType: ${foodDecisionV2.queryType}` : null,
    foodDecisionV2.menuOnPlan === null ? null : `menuOnPlan: ${foodDecisionV2.menuOnPlan}`,
    foodDecisionV2.effectiveFlexibility ? `flexibility: ${foodDecisionV2.effectiveFlexibility}` : null,
    Array.isArray(foodDecisionV2.reasonCodes) && foodDecisionV2.reasonCodes.length > 0
      ? `reasonCodes: ${foodDecisionV2.reasonCodes.join(",")}`
      : null,
    foodDecisionV2.legacyFoodRuleDecision
      ? `legacyDecision: ${foodDecisionV2.legacyFoodRuleDecision}`
      : null,
    Array.isArray(foodDecisionV2.catalogMatches) && foodDecisionV2.catalogMatches.length > 0
      ? `catalogFoodId: ${foodDecisionV2.catalogMatches[0].foodId}`
      : null,
  ].filter(Boolean);

  return textSegment("food_decision_v2", "food_decision_v2", boundedText(lines.join("\n")), {
    authority: "food_decision_engine_v2",
  });
}

function buildFoodProfileSummarySegment(foodDecisionV2) {
  const manifest = foodDecisionV2.evidenceManifest || {};
  const profile = manifest.profileSummary;
  if (!profile || typeof profile !== "object") return null;

  const lines = [
    profile.forbiddenFoodCount != null ? `forbiddenFoods: ${profile.forbiddenFoodCount}` : null,
    profile.forbiddenGroupCount != null ? `forbiddenGroups: ${profile.forbiddenGroupCount}` : null,
    profile.allowedFoodCount != null ? `allowedFoods: ${profile.allowedFoodCount}` : null,
    profile.dietType ? `dietType: ${profile.dietType}` : null,
  ].filter(Boolean);

  if (lines.length === 0) return null;

  return textSegment("food_profile_summary", "food_profile_summary", boundedText(lines.join("\n")), {
    authority: "food_rule_profile_v2",
  });
}

function buildMenuAuthoritySegment(foodDecisionV2) {
  const manifest = foodDecisionV2.evidenceManifest || {};
  const menu = manifest.menuSummary;
  if (!menu || typeof menu !== "object") return null;

  const lines = [
    menu.templateType ? `template: ${menu.templateType}` : null,
    menu.status ? `status: ${menu.status}` : null,
    foodDecisionV2.menuOnPlan === null ? null : `onPlan: ${foodDecisionV2.menuOnPlan}`,
    menu.mealSlotCount != null ? `mealSlots: ${menu.mealSlotCount}` : null,
  ].filter(Boolean);

  if (lines.length === 0) return null;

  return textSegment("menu_authority", "menu_authority", boundedText(lines.join("\n")), {
    authority: "menu_plan_v1",
  });
}

function buildFlexibilityModifierSegment(foodDecisionV2) {
  if (!foodDecisionV2.effectiveFlexibility) return null;

  const manifest = foodDecisionV2.evidenceManifest || {};
  const lines = [
    `level: ${foodDecisionV2.effectiveFlexibility}`,
    manifest.goalKey ? `goalKey: ${manifest.goalKey}` : null,
    manifest.mealKey ? `mealKey: ${manifest.mealKey}` : null,
  ].filter(Boolean);

  return textSegment("flexibility_modifier", "flexibility_modifier", boundedText(lines.join("\n")), {
    authority: "food_rule_profile_v2",
  });
}

function buildIngredientEvidenceV2Segment(foodDecisionV2) {
  const verification = foodDecisionV2.evidenceManifest?.verification;
  if (!verification || typeof verification !== "object") return null;

  const lines = [
    verification.decision ? `decision: ${verification.decision}` : null,
    verification.ingredientSourceType ? `sourceType: ${verification.ingredientSourceType}` : null,
    verification.ingredientConfidence ? `confidence: ${verification.ingredientConfidence}` : null,
    Array.isArray(verification.matchedForbiddenKeywordIds) && verification.matchedForbiddenKeywordIds.length > 0
      ? `keywordIds: ${verification.matchedForbiddenKeywordIds.join(",")}`
      : null,
    verification.dietTypeConflict ? "dietTypeConflict: true" : null,
    "labelText: omitted_from_prompt",
  ].filter(Boolean);

  return textSegment("ingredient_evidence_v2", "ingredient_evidence_v2", boundedText(lines.join("\n")), {
    authority: "product_ingredient_verification",
  });
}

function buildFoodSourceManifestSegment(foodDecisionV2) {
  const refs = Array.isArray(foodDecisionV2.sourceReferences) ? foodDecisionV2.sourceReferences : [];
  if (refs.length === 0) return null;

  return textSegment(
    "food_source_manifest",
    "food_source_manifest",
    boundedText(`sources: ${refs.join(",")}`),
    { authority: "food_decision_engine_v2" },
  );
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
    authority: metadata.authority || "food_decision_engine_v2",
    importance: metadata.importance || null,
    text: value,
    truncated: value.length < String(text || "").length,
  };
}

function boundedText(text) {
  const value = String(text || "").trim();
  const maxChars = 480;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 3)}...`;
}
