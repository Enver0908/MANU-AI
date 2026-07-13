import { APPROVED_SOURCE_ANSWERABILITY_VERSION } from "./approved-source-answerability.js";

export const VISUAL_ANSWERABILITY_V1_VERSION = "visual-answerability-v1-v0.1.0";

const VISUAL_SOURCE_CATEGORY_BY_INTENT = {
  green_visual_progress_acknowledgement: ["active_menu_plan", "visual_menu_exact"],
  green_visual_product_conflict: ["trusted_product_evidence", "structured_ingredient_keywords", "visual_label_conflict"],
  green_visual_screenshot_confirmation: ["active_menu_plan", "visual_screenshot_approved_source"],
  green_allowed_food_confirmation: ["active_menu_plan", "visual_menu_exact"],
};

export function evaluateVisualAnswerability(input = {}) {
  const canonicalIntent = input.canonicalIntent;
  const meaning = input.meaning;
  const overlay = input.visualRiskOverlay;

  if (!canonicalIntent || canonicalIntent.decision !== "canonical_intent_resolved") {
    return null;
  }

  if (!overlay?.allowlisted) {
    return buildDecision({
      allowed: false,
      decision: "handoff_required",
      intentFamily: canonicalIntent.intentFamily,
      reasons: ["visual_answerability_not_allowlisted"],
      sourceCategories: [],
      sources: [],
    });
  }

  const intentFamily = canonicalIntent.intentFamily;
  const sourceCategories = VISUAL_SOURCE_CATEGORY_BY_INTENT[intentFamily] || [];
  if (sourceCategories.length === 0) {
    return buildDecision({
      allowed: false,
      decision: "handoff_required",
      intentFamily,
      reasons: ["visual_answerability_unknown_intent"],
      sourceCategories: [],
      sources: [],
    });
  }

  const sources = buildVisualSourceRefs(meaning, intentFamily);
  if (sources.length === 0) {
    return buildDecision({
      allowed: false,
      decision: "handoff_required",
      intentFamily,
      reasons: ["visual_answerability_missing_source_refs"],
      sourceCategories,
      sources: [],
    });
  }

  return buildDecision({
    allowed: true,
    decision: "source_backed_green",
    intentFamily,
    reasons: ["visual_answerability_source_backed_green", intentFamily],
    sourceCategories,
    sources,
  });
}

function buildVisualSourceRefs(meaning, intentFamily) {
  const segment = meaning?.visualSegments?.[0];
  if (!segment) return [];

  if (
    intentFamily === "green_visual_progress_acknowledgement" ||
    intentFamily === "green_allowed_food_confirmation"
  ) {
    if (segment.menuMatch?.menuItemId) {
      return [
        {
          category: "active_menu_plan",
          segmentType: "visual_menu_exact",
          sourceId: segment.menuMatch.menuItemId,
          authority: "approved_menu_exact",
          origin: "visual_observation",
        },
      ];
    }
    return [];
  }

  if (intentFamily === "green_visual_product_conflict") {
    return [
      {
        category: "trusted_product_evidence",
        segmentType: "visual_label_conflict",
        sourceId: segment.analysisId,
        authority: "limited_visual_label_conflict",
        origin: "visual_observation",
      },
    ];
  }

  if (intentFamily === "green_visual_screenshot_confirmation") {
    return [
      {
        category: "active_menu_plan",
        segmentType: "visual_screenshot_approved_source",
        sourceId: segment.menuMatch?.menuItemId || segment.analysisId,
        authority: "approved_source_only",
        origin: "visual_observation",
      },
    ];
  }

  return [];
}

function buildDecision({ allowed, decision, intentFamily, reasons, sourceCategories, sources }) {
  return {
    version: VISUAL_ANSWERABILITY_V1_VERSION,
    baseVersion: APPROVED_SOURCE_ANSWERABILITY_VERSION,
    allowed,
    decision,
    intentFamily,
    reasons,
    sourceCategories,
    sources,
  };
}
