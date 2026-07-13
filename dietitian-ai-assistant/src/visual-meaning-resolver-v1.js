import { findMenuRecipeForPhrase, normalizeFoodPhrase } from "./food-understanding-v3.js";
import { evaluateProductIngredientVerification } from "./product-ingredient-verification.js";

export const VISUAL_MEANING_RESOLVER_V1_VERSION = "visual-meaning-resolver-v1-v0.1.0";

export const VISUAL_SOURCE_AUTHORITY_STATES = [
  "untrusted_visual",
  "limited_visual_label_conflict",
  "approved_menu_exact",
  "approved_source_only",
  "no_authority",
];

export const VISUAL_WORKFLOW_STATES = [
  "meal_exact_menu",
  "meal_ambiguous",
  "meal_no_match",
  "meal_mixed_dish",
  "label_conflict_high_integrity",
  "label_incomplete",
  "label_absence_not_allowed",
  "screenshot_query",
  "screenshot_multiple_questions",
  "screenshot_no_approved_source",
  "screenshot_approved_source_hit",
  "supplement_review",
  "body_review",
  "lab_review",
  "sensitive_review",
  "unknown_insufficient",
];

const HIGH_CONFIDENCE_THRESHOLD = 0.95;

export function resolveVisualMeaningV1(input = {}) {
  const envelope = input.envelope;
  if (!envelope) {
    throw new VisualMeaningResolverError("envelope_required");
  }

  const textBinding = resolveTextBinding(envelope, input.messagesByProviderMessageId || {});
  const segmentResolutions = (envelope.visualSegments || []).map((segment, index) =>
    resolveVisualSegment({
      segment,
      index,
      envelope,
      textBinding,
      activeMenu: input.activeMenu || null,
      foodRules: input.foodRules || {},
    }),
  );

  const sourceAuthorityState = deriveSourceAuthorityState(segmentResolutions);
  const absenceAllowedCount = segmentResolutions.filter(
    (resolution) => resolution.productDecision === "product_allowed",
  ).length;

  return {
    schemaVersion: VISUAL_MEANING_RESOLVER_V1_VERSION,
    bundleId: envelope.bundleId,
    textBinding,
    visualSegments: segmentResolutions,
    sourceAuthorityState,
    extractedQuestions: extractQuestions(envelope),
    absenceOfEvidenceAllowedCount: absenceAllowedCount,
    ocrNeverApprovedSource: true,
    providerContextBound: input.providerContext || null,
  };
}

function resolveVisualSegment({ segment, index, envelope, textBinding, activeMenu, foodRules }) {
  const observation = segment.observation;
  const sceneType = observation.sceneType;
  const base = {
    analysisId: segment.analysisId,
    mediaAssetId: segment.mediaAssetId,
    sceneType,
    reasonCodes: [],
    sourceAuthority: "no_authority",
    workflowState: "unknown_insufficient",
    menuMatch: null,
    labelEvidence: null,
    screenshotQuery: null,
    screenshotApprovedSourceHit: false,
    productDecision: null,
  };

  if (sceneType === "meal") {
    return resolveMealSegment({ ...base, segment, observation, activeMenu, textBinding, foodRules });
  }
  if (sceneType === "packaged_food_label") {
    return resolveLabelSegment({ ...base, observation, foodRules });
  }
  if (sceneType === "screenshot_or_document") {
    return resolveScreenshotSegment({ ...base, observation, activeMenu, envelope });
  }
  if (sceneType === "supplement_or_medication") {
    return {
      ...base,
      workflowState: "supplement_review",
      sourceAuthority: "untrusted_visual",
      reasonCodes: ["supplement_scene_non_autopilot"],
    };
  }
  if (sceneType === "body_or_symptom") {
    return {
      ...base,
      workflowState: "body_review",
      sourceAuthority: "untrusted_visual",
      reasonCodes: ["body_scene_non_autopilot"],
    };
  }
  if (sceneType === "lab_or_medical_document") {
    return {
      ...base,
      workflowState: "lab_review",
      sourceAuthority: "untrusted_visual",
      reasonCodes: ["lab_scene_non_autopilot"],
    };
  }
  if (sceneType === "sensitive_identity_document") {
    return {
      ...base,
      workflowState: "sensitive_review",
      sourceAuthority: "untrusted_visual",
      reasonCodes: ["sensitive_identity_scene"],
    };
  }

  return {
    ...base,
    workflowState: "unknown_insufficient",
    sourceAuthority: "no_authority",
    reasonCodes: ["scene_unknown_or_insufficient"],
  };
}

function resolveMealSegment({ segment, observation, activeMenu, textBinding, foodRules, ...base }) {
  const highConfidenceCandidates = observation.entityCandidates.filter(
    (candidate) => candidate.confidence >= HIGH_CONFIDENCE_THRESHOLD,
  );

  if (highConfidenceCandidates.length > 1) {
    return {
      ...base,
      workflowState: "meal_ambiguous",
      sourceAuthority: "no_authority",
      reasonCodes: ["multiple_high_confidence_food_candidates"],
      menuMatch: { status: "ambiguous", matches: highConfidenceCandidates.map((candidate) => candidate.normalizedLabel) },
    };
  }

  const phrase =
    textBinding.primaryBinding === "caption" && segment.captionText?.trim()
      ? segment.captionText
      : textBinding.primaryBinding === "reply" && textBinding.replyText
        ? textBinding.replyText
        : highConfidenceCandidates[0]?.normalizedLabel || textBinding.sequentialTexts.join(" ");

  const recipe = activeMenu ? findMenuRecipeForPhrase(activeMenu, phrase) : null;
  const exactMenuItem = activeMenu ? findExactMenuItemMatch(activeMenu, phrase) : null;

  if (exactMenuItem && highConfidenceCandidates.length === 1) {
    return {
      ...base,
      workflowState: "meal_exact_menu",
      sourceAuthority: "approved_menu_exact",
      reasonCodes: recipe ? ["active_menu_exact_match", "active_menu_recipe_present"] : ["active_menu_exact_match"],
      menuMatch: {
        status: "exact",
        menuItemId: exactMenuItem.menuItemId,
        matchedLabel: exactMenuItem.matchedLabel,
        confidence: highConfidenceCandidates[0].confidence,
      },
    };
  }

  if (highConfidenceCandidates.length === 1 && !exactMenuItem) {
    return {
      ...base,
      workflowState: "meal_no_match",
      sourceAuthority: "no_authority",
      reasonCodes: ["no_active_menu_exact_match"],
      menuMatch: { status: "no_match", matchedLabel: highConfidenceCandidates[0].normalizedLabel },
    };
  }

  if (isMixedDishSignal(observation, phrase)) {
    return {
      ...base,
      workflowState: "meal_mixed_dish",
      sourceAuthority: "no_authority",
      reasonCodes: ["mixed_dish_without_exact_recipe"],
      menuMatch: { status: "ambiguous", matchedLabel: normalizeFoodPhrase(phrase) },
    };
  }

  return {
    ...base,
    workflowState: "meal_no_match",
    sourceAuthority: "no_authority",
    reasonCodes: ["meal_context_unresolved"],
    menuMatch: { status: "no_match", matchedLabel: normalizeFoodPhrase(phrase) },
  };
}

function resolveLabelSegment({ observation, foodRules, ...base }) {
  const highIntegrity = hasHighIntegrityLabel(observation);
  if (!highIntegrity) {
    return {
      ...base,
      workflowState: "label_incomplete",
      sourceAuthority: "no_authority",
      reasonCodes: ["label_integrity_insufficient"],
      labelEvidence: { status: "incomplete", canInferAllowed: false },
      productDecision: "requires_review",
    };
  }

  const ingredientText = observation.ocrBlocks
    .filter((block) => block.blockKind === "label" && block.confidence >= HIGH_CONFIDENCE_THRESHOLD)
    .map((block) => block.text)
    .join(" ")
    .trim();

  const verification = evaluateProductIngredientVerification({
    ingredientSourceType: "user_label_text",
    ingredientText,
    ingredientConfidence: "high",
    ingredientAllergenKeywords: foodRules.ingredientAllergenKeywords || [],
    forbiddenFoodItems: foodRules.forbiddenFoodItems || [],
    forbiddenFoodGroups: foodRules.forbiddenFoodGroups || [],
    dietTypeRules: foodRules.dietTypeRules || null,
  });

  if (verification.decision === "product_allowed") {
    return {
      ...base,
      workflowState: "label_absence_not_allowed",
      sourceAuthority: "no_authority",
      reasonCodes: ["label_absence_not_evidence", ...(verification.reasons || [])],
      labelEvidence: { status: "absence_not_allowed", canInferAllowed: false },
      productDecision: "requires_review",
    };
  }

  if (verification.decision === "product_blocked") {
    return {
      ...base,
      workflowState: "label_conflict_high_integrity",
      sourceAuthority: "limited_visual_label_conflict",
      reasonCodes: [...(verification.reasons || []), "visual_label_ocr_forbidden_only"],
      labelEvidence: { status: "high_integrity_forbidden_only", canInferAllowed: false },
      productDecision: "product_blocked",
    };
  }

  return {
    ...base,
    workflowState: "label_incomplete",
    sourceAuthority: "no_authority",
    reasonCodes: [...(verification.reasons || []), "label_requires_review"],
    labelEvidence: { status: "incomplete", canInferAllowed: false },
    productDecision: "requires_review",
  };
}

function resolveScreenshotSegment({ observation, activeMenu, envelope, ...base }) {
  const screenshotBlocks = observation.ocrBlocks.filter((block) => block.blockKind === "screenshot");
  const screenshotQuery = screenshotBlocks.map((block) => block.text).join(" ").trim();
  const questions = extractQuestions(envelope).filter((question) =>
    screenshotBlocks.some((block) => block.text.includes(question)),
  );

  if (questions.length > 1) {
    return {
      ...base,
      workflowState: "screenshot_multiple_questions",
      sourceAuthority: "untrusted_visual",
      reasonCodes: ["multiple_screenshot_questions"],
      screenshotQuery,
      screenshotApprovedSourceHit: false,
    };
  }

  const approvedSourceHit = evaluateScreenshotApprovedSourceHit(screenshotQuery, activeMenu);
  return {
    ...base,
    workflowState: approvedSourceHit ? "screenshot_approved_source_hit" : "screenshot_no_approved_source",
    sourceAuthority: approvedSourceHit ? "approved_source_only" : "untrusted_visual",
    reasonCodes: approvedSourceHit ? ["screenshot_query_matches_approved_source"] : ["screenshot_query_untrusted"],
    screenshotQuery: screenshotQuery || null,
    screenshotApprovedSourceHit: approvedSourceHit,
  };
}

export function resolveTextBinding(envelope, messagesByProviderMessageId = {}) {
  const textSegments = envelope.textSegments || [];
  const visualSegments = envelope.visualSegments || [];

  for (const textSegment of textSegments) {
    if (!textSegment.replyToProviderMessageId) continue;
    const targetMessage = messagesByProviderMessageId[textSegment.replyToProviderMessageId];
    if (!targetMessage?.id) continue;
    const visual = visualSegments.find((segment) => segment.messageId === targetMessage.id);
    if (visual) {
      return {
        primaryBinding: "reply",
        captionText: visual.captionText,
        replyText: textSegment.body,
        sequentialTexts: textSegments.map((segment) => segment.body),
        replyToProviderMessageId: textSegment.replyToProviderMessageId,
      };
    }
  }

  const captionedVisual = visualSegments.find((segment) => segment.captionText?.trim());
  if (captionedVisual) {
    return {
      primaryBinding: "caption",
      captionText: captionedVisual.captionText,
      replyText: null,
      sequentialTexts: textSegments.map((segment) => segment.body),
      replyToProviderMessageId: null,
    };
  }

  return {
    primaryBinding: textSegments.length > 0 ? "sequential_bundle" : "none",
    captionText: null,
    replyText: null,
    sequentialTexts: textSegments.map((segment) => segment.body),
    replyToProviderMessageId: null,
  };
}

export function findExactMenuItemMatch(menu, phrase) {
  const normalizedPhrase = normalizeFoodPhrase(phrase);
  if (!normalizedPhrase || !menu) return null;

  const matches = [];
  for (const slot of menu.mealSlots || []) {
    for (const item of [...(slot.items || []), ...(slot.alternatives || [])]) {
      const candidates = [item.freeText, item.label, item.catalogMatch?.catalogFoodName, item.recipe?.title]
        .map((value) => normalizeFoodPhrase(value || ""))
        .filter(Boolean);
      if (candidates.some((candidate) => candidate === normalizedPhrase)) {
        matches.push({
          menuItemId: item.id,
          matchedLabel: normalizedPhrase,
        });
      }
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}

export function evaluateScreenshotApprovedSourceHit(query, activeMenu) {
  const normalizedQuery = normalizeFoodPhrase(query);
  if (!normalizedQuery || !activeMenu) return false;
  if (findExactMenuItemMatch(activeMenu, normalizedQuery)) {
    return true;
  }

  const extracted = extractScreenshotFoodPhrase(normalizedQuery);
  return Boolean(extracted && findExactMenuItemMatch(activeMenu, extracted));
}

function extractScreenshotFoodPhrase(normalizedQuery) {
  const match = normalizedQuery.match(/^(.+?)\s+(?:uygun mu|yiyebilir miyim|yerim mi)(?:\?|$)/i);
  return match?.[1]?.trim() || null;
}

export function hasHighIntegrityLabel(observation) {
  if (observation.sceneConfidence < HIGH_CONFIDENCE_THRESHOLD || observation.overallConfidence < HIGH_CONFIDENCE_THRESHOLD) {
    return false;
  }
  if (!observation.labelIntegrity?.ingredientsHeaderPresent || !observation.labelIntegrity?.completePanel) {
    return false;
  }
  if (observation.labelIntegrity?.cropOrGlareSuspected) {
    return false;
  }
  const labelBlocks = (observation.ocrBlocks || []).filter((block) => block.blockKind === "label");
  if (labelBlocks.length === 0) {
    return false;
  }
  return labelBlocks.every((block) => block.confidence >= HIGH_CONFIDENCE_THRESHOLD);
}

function deriveSourceAuthorityState(segmentResolutions) {
  if (segmentResolutions.length === 0) {
    return "unresolved";
  }
  const authorities = segmentResolutions.map((resolution) => resolution.sourceAuthority);
  if (authorities.every((authority) => authority === "approved_menu_exact" || authority === "approved_source_only")) {
    return "approved_only";
  }
  if (authorities.some((authority) => authority === "approved_menu_exact" || authority === "approved_source_only")) {
    return "partial";
  }
  return "unresolved";
}

function extractQuestions(envelope) {
  const questions = [];
  for (const segment of envelope.textSegments || []) {
    for (const line of String(segment.body || "").split(/\n+/)) {
      const trimmed = line.trim();
      if (trimmed.includes("?")) questions.push(trimmed);
    }
  }
  for (const segment of envelope.visualSegments || []) {
    for (const block of segment.observation?.ocrBlocks || []) {
      if (block.blockKind !== "screenshot") continue;
      for (const line of String(block.text || "").split(/\n+/)) {
        const trimmed = line.trim();
        if (trimmed.includes("?")) questions.push(trimmed);
      }
    }
  }
  return questions;
}

function isMixedDishSignal(observation, phrase) {
  const normalized = normalizeFoodPhrase(phrase);
  return (
    observation.entityCandidates.length > 1 ||
    /\b(?:karisik|karışık|menemen|kisir|kısır|pizza|bowl)\b/i.test(normalized)
  );
}

export class VisualMeaningResolverError extends Error {
  constructor(code) {
    super(code);
    this.name = "VisualMeaningResolverError";
    this.code = code;
  }
}
