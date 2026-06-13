import {
  CANONICAL_INTENT_RESOLVER_V2_VERSION,
  mapCanonicalIntentToGreenTaxonomy,
  resolveCanonicalIntentV2,
} from "./canonical-intent-resolver-v2.js";

export const GREEN_INTENT_TAXONOMY_VERSION = "green-intent-taxonomy-v0.3.0";

export { resolveCanonicalIntentV2, mapCanonicalIntentToGreenTaxonomy };

export function evaluateGreenIntentTaxonomy({
  promptContext,
  riskDecision,
  answerability,
  canonicalIntent = null,
  foodDecisionV2 = null,
  foodRule = null,
}) {
  const resolvedCanonicalIntent =
    canonicalIntent ||
    resolveCanonicalIntentV2({
      message: currentMessageText(promptContext),
      riskDecision,
      foodDecisionV2,
      foodRule,
    });

  const mapped = mapCanonicalIntentToGreenTaxonomy(resolvedCanonicalIntent);

  if (riskDecision?.level === "green" && !promptContext?.segments) {
    return buildDecision({
      ...mapped,
      decision: "blocked_sensitive_intent",
      allowed: false,
      intentFamily: null,
      blockedFamily: "prompt_context_missing",
      reasons: ["green_intent_taxonomy_prompt_context_missing"],
      sourceCategories: answerability?.sourceCategories || [],
      canonicalIntent: resolvedCanonicalIntent,
    });
  }

  return buildDecision({
    ...mapped,
    sourceCategories: answerability?.sourceCategories || [],
    canonicalIntent: resolvedCanonicalIntent,
  });
}

function currentMessageText(promptContext) {
  return (promptContext?.segments || []).find((segment) => segment.type === "current_message")?.text || "";
}

function buildDecision({
  decision,
  allowed,
  intentFamily,
  blockedFamily,
  reasons,
  sourceCategories,
  canonicalIntent,
  workflowState = null,
}) {
  return {
    version: GREEN_INTENT_TAXONOMY_VERSION,
    decision,
    allowed,
    intentFamily,
    blockedFamily,
    reasons,
    sourceCategories: Array.from(new Set(sourceCategories || [])),
    canonicalIntent,
    workflowState,
    canonicalIntentVersion: canonicalIntent?.version || CANONICAL_INTENT_RESOLVER_V2_VERSION,
  };
}
