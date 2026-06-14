import { isClaimManifestComplete } from "./claim-manifest-v1.js";
import { isKnownTemplateId } from "./deterministic-template-library-v1.js";

export const NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION = "narrow-autopilot-eligibility-v2-v0.1.0";

export const NARROW_AUTOPILOT_INELIGIBLE_REASON_CODES = [
  "not_autopilot_mode",
  "risk_not_green",
  "reply_mode_not_send",
  "unknown_intent",
  "sensitive_hint",
  "pending_label",
  "pending_clarification",
  "source_not_backed",
  "food_decision_ineligible",
  "brand_without_label",
  "mixed_dish_without_recipe",
  "alias_not_exact_or_approved",
  "template_missing",
  "claim_manifest_incomplete",
  "source_conflict",
  "output_guard_violation",
];

const SUPPORTED_NARROW_AUTOPILOT_INTENT_FAMILIES = new Set([
  "green_allowed_substitution",
  "green_plan_lookup",
  "green_allowed_food_confirmation",
  "green_forbidden_food_reminder",
  "green_food_decision_discourage",
  "green_logistics",
  "green_meal_reminder",
  "green_context_recap",
]);

const FOOD_GROUNDED_INTENT_FAMILIES = new Set([
  "green_allowed_substitution",
  "green_allowed_food_confirmation",
  "green_forbidden_food_reminder",
  "green_food_decision_discourage",
]);

const SUBSTITUTION_LEGACY_FALLBACK_REASON = "intent_specific_substitution_legacy_fallback";

const SOURCE_CONFLICT_REASON_MARKERS = [
  "food_decision_v2_catalog_match_ambiguous",
  "diet_type_conflict",
  "source_conflict",
];

const PENDING_WORKFLOW_STATES = new Set(["needs_label", "clarify", "needs_review", "handoff", "block"]);

export function evaluateNarrowAutopilotEligibilityV2(input = {}) {
  const phase = input.phase === "post_provider" ? "post_provider" : "pre_provider";
  const reasonCodes = [];

  if (input.clientAiMode !== "autopilot") {
    return buildResult({ eligible: false, applies: false, reasonCodes: ["not_autopilot_mode"], phase });
  }

  if (input.riskDecision?.level !== "green") {
    return buildResult({ eligible: false, applies: false, reasonCodes: ["risk_not_green"], phase });
  }

  if (input.modeDecision?.action !== "auto_send" || input.responsePlan?.replyMode !== "send") {
    return buildResult({ eligible: false, applies: false, reasonCodes: ["reply_mode_not_send"], phase });
  }

  if (phase === "post_provider" && input.providerOutputSafety?.allowed === false) {
    reasonCodes.push("output_guard_violation");
    return buildIneligibleResult(reasonCodes, phase, "post_provider");
  }

  if (phase === "pre_provider") {
    collectPreProviderIneligibleReasons(input, reasonCodes);
  }

  const eligible = reasonCodes.length === 0;
  if (eligible) {
    return buildResult({
      eligible: true,
      applies: true,
      reasonCodes: [],
      phase,
      fallbackModeAction: null,
      fallbackReason: null,
    });
  }

  return buildIneligibleResult(reasonCodes, phase, "pre_provider");
}

function collectPreProviderIneligibleReasons(input, reasonCodes) {
  const intentFamily =
    input.greenIntent?.intentFamily || input.canonicalIntent?.intentFamily || input.responsePlan?.intentFamily || null;
  const workflowState =
    input.canonicalIntent?.workflowState || input.greenIntent?.workflowState || input.answerability?.workflowState || null;

  if (
    !isSupportedNarrowAutopilotIntentFamily(intentFamily, input)
  ) {
    reasonCodes.push("unknown_intent");
  }

  if (workflowState && PENDING_WORKFLOW_STATES.has(workflowState)) {
    if (workflowState === "needs_label") reasonCodes.push("pending_label");
    else if (workflowState === "clarify") reasonCodes.push("pending_clarification");
    else reasonCodes.push("food_decision_ineligible");
  }

  if (
    input.canonicalIntent?.decision === "blocked_sensitive_intent" ||
    input.greenIntent?.decision === "blocked_sensitive_intent" ||
    hasReason(input.answerability?.reasons, "mixed_or_sensitive_answerability_marker")
  ) {
    reasonCodes.push("sensitive_hint");
  }

  if (!input.answerability?.allowed || input.answerability?.decision !== "source_backed_green") {
    reasonCodes.push("source_not_backed");
  }

  if (input.foodDecisionV2?.decision === "needs_label") {
    reasonCodes.push("brand_without_label");
  }

  if (input.foodDecisionV2?.decision === "needs_review") {
    if (
      input.foodDecisionV2?.queryType === "mixed_dish" ||
      hasReason(input.foodDecisionV2?.reasonCodes, "food_understanding_v3_mixed_dish_no_recipe")
    ) {
      reasonCodes.push("mixed_dish_without_recipe");
    } else {
      reasonCodes.push("food_decision_ineligible");
    }
  }

  if (input.foodDecisionV2?.providerEligible === false) {
    reasonCodes.push("food_decision_ineligible");
  }

  if (hasSourceConflict(input)) {
    reasonCodes.push("source_conflict");
  }

  if (FOOD_GROUNDED_INTENT_FAMILIES.has(intentFamily) && !hasApprovedFoodGrounding(input, intentFamily)) {
    reasonCodes.push("alias_not_exact_or_approved");
  }

  if (
    intentFamily === "green_product_ingredient_check" &&
    input.foodRule?.decision === "product_ingredient_conflict" &&
    !hasApprovedFoodGrounding(input, intentFamily)
  ) {
    reasonCodes.push("alias_not_exact_or_approved");
  }

  if (!input.responsePlan?.templateId || !isKnownTemplateId(input.responsePlan.templateId)) {
    reasonCodes.push("template_missing");
  }

  if (!isClaimManifestComplete(input.responsePlan?.claimManifest, { providerEligible: true })) {
    reasonCodes.push("claim_manifest_incomplete");
  }
}

function hasSourceConflict(input) {
  if (input.foodRule?.decision === "diet_type_conflict") return true;

  const reasonBuckets = [
    ...(input.foodDecisionV2?.reasonCodes || []),
    ...(input.answerability?.reasons || []),
    ...(input.foodRule?.reasons || []),
  ];

  return reasonBuckets.some((reason) =>
    SOURCE_CONFLICT_REASON_MARKERS.some((marker) => String(reason).includes(marker)),
  );
}

function hasApprovedFoodGrounding(input, intentFamily) {
  const foodDecisionV2 = input.foodDecisionV2;
  const foodRule = input.foodRule;

  if (intentFamily === "green_allowed_substitution" && hasApprovedSubstitutionLegacyGrounding(input)) {
    return true;
  }

  if (intentFamily === "green_allowed_substitution" && hasExplicitApprovedSubstitutionFoodRule(input.foodRule)) {
    return true;
  }

  if (intentFamily === "green_product_ingredient_check" && input.foodRule?.decision === "product_ingredient_conflict") {
    return true;
  }

  if (!foodDecisionV2 || foodDecisionV2.decision === "not_applicable") {
    if (!FOOD_GROUNDED_INTENT_FAMILIES.has(intentFamily)) {
      return true;
    }

    if (intentFamily === "green_allowed_substitution") {
      return false;
    }

    if (
      foodRule?.decision &&
      foodRule.decision !== "not_applicable" &&
      foodRule.decision !== "unknown_food_requires_review"
    ) {
      return true;
    }

    return false;
  }

  if (["needs_label", "needs_review", "not_applicable"].includes(foodDecisionV2.decision)) {
    return false;
  }

  if (foodDecisionV2.providerEligible === false) {
    return false;
  }

  const exactAutopilotMatch = (foodDecisionV2.catalogMatches || []).some(
    (match) => match.confidence === "exact" && match.autopilotEligible !== false,
  );
  if (exactAutopilotMatch) return true;
  if (foodDecisionV2.menuOnPlan === true) return true;

  if (foodDecisionV2.decision === "forbid" && (foodDecisionV2.catalogMatches || []).length > 0) {
    return true;
  }

  if (intentFamily === "green_allowed_substitution") {
    return false;
  }

  return foodDecisionV2.decision === "allow" || foodDecisionV2.decision === "discourage" || foodDecisionV2.decision === "forbid";
}

function isSupportedNarrowAutopilotIntentFamily(intentFamily, input) {
  if (!intentFamily || input.canonicalIntent?.intentFamily === "unknown_intent" || input.canonicalIntent?.allowed === false) {
    return false;
  }

  if (SUPPORTED_NARROW_AUTOPILOT_INTENT_FAMILIES.has(intentFamily)) {
    return true;
  }

  return (
    intentFamily === "green_product_ingredient_check" && input.foodRule?.decision === "product_ingredient_conflict"
  );
}

function hasExplicitApprovedSubstitutionFoodRule(foodRule) {
  return (
    foodRule?.queryType === "food_substitution" &&
    (foodRule.decision === "equivalent_substitution_allowed" || foodRule.decision === "approved_substitution")
  );
}

function hasApprovedSubstitutionLegacyGrounding(input) {
  if (!hasReason(input.answerability?.reasons, SUBSTITUTION_LEGACY_FALLBACK_REASON)) {
    return false;
  }

  const foodRule = input.foodRule;
  if (!foodRule || foodRule.decision === "not_applicable") {
    return ["unknown_food_requires_review", "approved_substitution", "equivalent_substitution_allowed"].includes(
      input.answerability?.foodRuleDecision,
    );
  }

  if (foodRule.queryType !== "food_substitution") {
    return false;
  }

  return (
    foodRule.decision === "unknown_food_requires_review" ||
    foodRule.decision === "approved_substitution" ||
    foodRule.decision === "equivalent_substitution_allowed"
  );
}

function hasReason(reasons, marker) {
  return Array.isArray(reasons) && reasons.some((reason) => String(reason).includes(marker));
}

function buildIneligibleResult(reasonCodes, phase, fallbackPhase) {
  return buildResult({
    eligible: false,
    applies: true,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    phase,
    fallbackModeAction: "draft_for_approval",
    fallbackReason:
      fallbackPhase === "post_provider" ? "narrow_autopilot_post_provider_ineligible" : "narrow_autopilot_ineligible",
  });
}

function uniqueReasonCodes(reasonCodes) {
  return Array.from(new Set(reasonCodes.filter(Boolean)));
}

function buildResult({
  eligible,
  applies,
  reasonCodes,
  phase,
  fallbackModeAction = null,
  fallbackReason = null,
}) {
  return {
    version: NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
    eligible,
    applies,
    phase,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    fallbackModeAction,
    fallbackReason,
  };
}

export function applyNarrowAutopilotModeDowngrade(modeDecision, narrowAutopilotEligibility) {
  if (!narrowAutopilotEligibility?.applies || narrowAutopilotEligibility.eligible) {
    return modeDecision;
  }

  return {
    action: narrowAutopilotEligibility.fallbackModeAction || "draft_for_approval",
    reason: narrowAutopilotEligibility.fallbackReason || "narrow_autopilot_ineligible",
  };
}
