import { CANONICAL_INTENT_RESOLVER_V2_VERSION } from "./canonical-intent-resolver-v2.js";
import { evaluateMultiImageSourceIdentity } from "./visual-source-gate-v1.js";

export const VISUAL_INTENT_BRIDGE_V1_VERSION = "visual-intent-bridge-v1-v0.1.0";

export const VISUAL_GREEN_INTENT_FAMILIES = [
  "green_visual_progress_acknowledgement",
  "green_visual_product_conflict",
  "green_visual_screenshot_confirmation",
];

const FOOD_QUESTION_PATTERN = /\b(?:uygun mu|yiyebilir miyim|yerim mi|icer miyim|olur mu)\b/i;

export function resolveVisualCanonicalIntent(input = {}) {
  const meaning = input.meaning;
  const envelope = input.envelope;
  const mergedRisk = input.mergedRiskDecision || input.riskDecision;

  if (!meaning?.visualSegments?.length) {
    return null;
  }

  if (mergedRisk?.level !== "green") {
    return buildCanonicalIntent({
      decision: "not_applicable_non_green",
      allowed: true,
      intentFamily: null,
      blockedFamily: null,
      precedenceStage: "visual_non_green",
      workflowState: null,
      reasons: ["visual_intent_non_green"],
    });
  }

  if (meaning.visualSegments.length > 1) {
    const identity = evaluateMultiImageSourceIdentity(meaning.visualSegments);
    if (!identity.consistent) {
      return buildCanonicalIntent({
        decision: "blocked_sensitive_intent",
        allowed: false,
        intentFamily: null,
        blockedFamily: identity.reasonCode || "visual_multiple_images_ambiguous",
        precedenceStage: "visual_ambiguous",
        workflowState: "handoff",
        reasons: [identity.reasonCode || "visual_multiple_images_ambiguous"],
      });
    }

    const workflows = new Set(meaning.visualSegments.map((segment) => segment.workflowState));
    if (workflows.size > 1) {
      return buildCanonicalIntent({
        decision: "blocked_sensitive_intent",
        allowed: false,
        intentFamily: null,
        blockedFamily: "visual_multiple_images_ambiguous",
        precedenceStage: "visual_ambiguous",
        workflowState: "handoff",
        reasons: ["visual_multiple_images_ambiguous"],
      });
    }
  }

  const primary = meaning.visualSegments[0];
  const questionText = resolveBundleQuestionText(envelope, input.textMessage);

  switch (primary.workflowState) {
    case "meal_exact_menu":
      if (FOOD_QUESTION_PATTERN.test(questionText)) {
        return buildCanonicalIntent({
          decision: "canonical_intent_resolved",
          allowed: true,
          intentFamily: "green_allowed_food_confirmation",
          blockedFamily: null,
          precedenceStage: "visual_meal_exact_menu",
          workflowState: null,
          reasons: ["visual_meal_exact_menu_question"],
        });
      }
      return buildCanonicalIntent({
        decision: "canonical_intent_resolved",
        allowed: true,
        intentFamily: "green_visual_progress_acknowledgement",
        blockedFamily: null,
        precedenceStage: "visual_meal_exact_menu",
        workflowState: null,
        reasons: ["visual_meal_exact_menu_progress"],
      });
    case "label_conflict_high_integrity":
      return buildCanonicalIntent({
        decision: "canonical_intent_resolved",
        allowed: true,
        intentFamily: "green_visual_product_conflict",
        blockedFamily: null,
        precedenceStage: "visual_label_conflict",
        workflowState: null,
        reasons: ["visual_label_conflict_high_integrity"],
      });
    case "screenshot_approved_source_hit":
      return buildCanonicalIntent({
        decision: "canonical_intent_resolved",
        allowed: true,
        intentFamily: "green_visual_screenshot_confirmation",
        blockedFamily: null,
        precedenceStage: "visual_screenshot_approved_source",
        workflowState: null,
        reasons: ["visual_screenshot_approved_source_hit"],
      });
    case "supplement_review":
    case "body_review":
    case "lab_review":
    case "sensitive_review":
      return buildCanonicalIntent({
        decision: "blocked_sensitive_intent",
        allowed: false,
        intentFamily: null,
        blockedFamily: "yellow_medication_supplement_request",
        precedenceStage: "visual_sensitive_scene",
        workflowState: "handoff",
        reasons: [`visual_sensitive_scene:${primary.workflowState}`],
      });
    default:
      return buildCanonicalIntent({
        decision: "blocked_unknown_intent",
        allowed: false,
        intentFamily: "unknown_intent",
        blockedFamily: null,
        precedenceStage: "visual_unresolved",
        workflowState: "handoff",
        reasons: [`visual_unresolved_workflow:${primary.workflowState}`],
      });
  }
}

function resolveBundleQuestionText(envelope, textMessage = "") {
  const explicit = String(textMessage || "").trim();
  if (explicit) return explicit;
  if (envelope?.primaryQuestionText) return envelope.primaryQuestionText;
  return (envelope?.textSegments || []).map((segment) => segment.body).join("\n");
}

function buildCanonicalIntent(fields) {
  return {
    version: CANONICAL_INTENT_RESOLVER_V2_VERSION,
    ...fields,
  };
}
