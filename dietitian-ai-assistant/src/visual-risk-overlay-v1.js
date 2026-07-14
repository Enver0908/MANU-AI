import { mergeVisualRiskOverlay } from "./visual-observation-v1.js";
import { evaluateMultiImageSourceIdentity } from "./visual-source-gate-v1.js";

export const VISUAL_RISK_OVERLAY_V1_VERSION = "visual-risk-overlay-v1-v0.1.0";

export const VISUAL_INELIGIBILITY_REASON_CODES = [
  "visual_scene_not_allowlisted",
  "visual_confidence_insufficient",
  "visual_context_unresolved",
  "visual_ocr_incomplete",
  "visual_prompt_injection",
  "visual_sensitive_class",
  "visual_multiple_images_ambiguous",
];

const HIGH_CONFIDENCE_THRESHOLD = 0.95;

const ALLOWLISTED_WORKFLOW_STATES = new Set([
  "meal_exact_menu",
  "label_conflict_high_integrity",
  "screenshot_approved_source_hit",
]);

const RISK_RANK = { green: 0, yellow: 1, red: 2 };

const EMERGENCY_OCR_PATTERN =
  /\b(?:acil|emergency|nefes dar|gogsum sikis|gogus agr|intihar|bayil)\b/i;

export function evaluateVisualRiskOverlay(input = {}) {
  const baseLevel = input.baseRiskDecision?.level || "green";
  const meaning = input.meaning;
  const envelope = input.envelope;

  if (!meaning?.visualSegments?.length) {
    return buildOverlayResult({
      baseLevel,
      visualLevel: "green",
      mergedLevel: baseLevel,
      ineligibilityReasons: [],
      allowlisted: false,
      reasonCodes: ["visual_overlay_not_applicable"],
      providerBlocked: false,
    });
  }

  let visualLevel = "green";
  const ineligibilityReasons = [];
  const reasonCodes = [];
  let allowlisted = false;

  if (meaning.visualSegments.length > 1) {
    const identity = evaluateMultiImageSourceIdentity(meaning.visualSegments);
    if (!identity.consistent) {
      visualLevel = escalateRisk(visualLevel, "yellow");
      pushUnique(ineligibilityReasons, identity.reasonCode || "visual_multiple_images_ambiguous");
      reasonCodes.push(identity.reasonCode || "visual_multiple_images_ambiguous");
    } else {
      const workflowStates = meaning.visualSegments.map((segment) => segment.workflowState);
      const uniqueWorkflows = new Set(workflowStates);
      const allowlistedCount = workflowStates.filter((state) => ALLOWLISTED_WORKFLOW_STATES.has(state)).length;
      if (uniqueWorkflows.size > 1 || (allowlistedCount > 0 && allowlistedCount < meaning.visualSegments.length)) {
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_multiple_images_ambiguous");
        reasonCodes.push("visual_multiple_images_ambiguous");
      }
    }
  }

  for (const segment of meaning.visualSegments) {
    const envelopeSegment = (envelope?.visualSegments || []).find(
      (entry) => entry.analysisId === segment.analysisId || entry.mediaAssetId === segment.mediaAssetId,
    );
    const observation = envelopeSegment?.observation;

    if (observation?.promptInjectionSignals?.length) {
      visualLevel = escalateRisk(visualLevel, "yellow");
      pushUnique(ineligibilityReasons, "visual_prompt_injection");
      reasonCodes.push("visual_prompt_injection_signal");
    }

    if (hasEmergencyOcrSignal(observation)) {
      visualLevel = escalateRisk(visualLevel, "red");
      pushUnique(ineligibilityReasons, "visual_sensitive_class");
      reasonCodes.push("visual_emergency_ocr_signal");
    }

    if (
      observation &&
      (observation.sceneConfidence < HIGH_CONFIDENCE_THRESHOLD ||
        observation.overallConfidence < HIGH_CONFIDENCE_THRESHOLD)
    ) {
      visualLevel = escalateRisk(visualLevel, "yellow");
      pushUnique(ineligibilityReasons, "visual_confidence_insufficient");
      reasonCodes.push("visual_confidence_below_threshold");
    }

    if (ALLOWLISTED_WORKFLOW_STATES.has(segment.workflowState)) {
      allowlisted = true;
      reasonCodes.push(`visual_allowlisted:${segment.workflowState}`);
      continue;
    }

    switch (segment.workflowState) {
      case "lab_review":
      case "sensitive_review":
        visualLevel = escalateRisk(visualLevel, "red");
        pushUnique(ineligibilityReasons, "visual_sensitive_class");
        reasonCodes.push(`visual_sensitive_scene:${segment.workflowState}`);
        break;
      case "supplement_review":
      case "body_review":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_scene_not_allowlisted");
        reasonCodes.push(`visual_non_autopilot_scene:${segment.workflowState}`);
        break;
      case "label_incomplete":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_ocr_incomplete");
        reasonCodes.push("visual_label_integrity_insufficient");
        break;
      case "label_absence_not_allowed":
      case "meal_ambiguous":
        if (segment.reasonCodes?.includes("caption_entity_contradiction")) {
          visualLevel = escalateRisk(visualLevel, "yellow");
          pushUnique(ineligibilityReasons, "visual_context_unresolved");
          reasonCodes.push("visual_caption_entity_contradiction");
          break;
        }
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_context_unresolved");
        reasonCodes.push(`visual_context_unresolved:${segment.workflowState}`);
        break;
      case "meal_no_match":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_context_unresolved");
        reasonCodes.push(`visual_context_unresolved:${segment.workflowState}`);
        break;
      case "meal_mixed_dish":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_context_unresolved");
        reasonCodes.push(`visual_context_unresolved:${segment.workflowState}`);
        break;
      case "screenshot_no_approved_source":
      case "screenshot_query":
      case "screenshot_multiple_questions":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_scene_not_allowlisted");
        reasonCodes.push(`visual_screenshot_untrusted:${segment.workflowState}`);
        break;
      case "unknown_insufficient":
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_confidence_insufficient");
        reasonCodes.push("visual_unknown_or_insufficient");
        break;
      default:
        visualLevel = escalateRisk(visualLevel, "yellow");
        pushUnique(ineligibilityReasons, "visual_scene_not_allowlisted");
        reasonCodes.push(`visual_unhandled_workflow:${segment.workflowState}`);
        break;
    }
  }

  const mergedLevel = mergeVisualRiskOverlay(baseLevel, visualLevel);
  const providerBlocked = mergedLevel !== "green" || ineligibilityReasons.length > 0;

  return buildOverlayResult({
    baseLevel,
    visualLevel,
    mergedLevel,
    ineligibilityReasons,
    allowlisted,
    reasonCodes,
    providerBlocked,
  });
}

function buildOverlayResult({
  baseLevel,
  visualLevel,
  mergedLevel,
  ineligibilityReasons,
  allowlisted,
  reasonCodes,
  providerBlocked,
}) {
  return {
    version: VISUAL_RISK_OVERLAY_V1_VERSION,
    baseRiskLevel: baseLevel,
    visualRiskLevel: visualLevel,
    mergedRiskLevel: mergedLevel,
    riskEscalated: RISK_RANK[mergedLevel] > RISK_RANK[baseLevel],
    ineligibilityReasons,
    allowlisted,
    reasonCodes,
    providerBlocked,
    providerAttempted: false,
  };
}

function escalateRisk(current, next) {
  return RISK_RANK[next] > RISK_RANK[current] ? next : current;
}

function pushUnique(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function hasEmergencyOcrSignal(observation) {
  if (!observation) return false;
  if ((observation.sensitivitySignals || []).some((signal) => /emergency|acil|sensitive/i.test(signal))) {
    return true;
  }
  return (observation.ocrBlocks || []).some((block) => EMERGENCY_OCR_PATTERN.test(block.text || ""));
}
