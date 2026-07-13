import { buildClaimManifestV1 } from "./claim-manifest-v1.js";
import { buildStyleDnaV2 } from "./style-dna-v2.js";

export const RESPONSE_PLAN_V1_VERSION = "response-plan-v1-v0.1.0";

export const RESPONSE_PLAN_REPLY_MODES = [
  "send",
  "draft",
  "clarify",
  "ask_label",
  "handoff",
  "block",
];

export const CLAIM_MANIFEST_PLACEHOLDER_VERSION = "claim-manifest-v0.1.0-placeholder";
export { CLAIM_MANIFEST_V1_VERSION } from "./claim-manifest-v1.js";
export const STYLE_DNA_PLACEHOLDER_VERSION = "style-dna-v0.1.0-placeholder";
export { STYLE_DNA_V2_VERSION } from "./style-dna-v2.js";

const INTENT_TEMPLATE_IDS = {
  green_allowed_substitution: "allowed_substitution_v1",
  green_plan_lookup: "plan_lookup_v1",
  green_allowed_food_confirmation: "allowed_food_answer_v1",
  green_forbidden_food_reminder: "forbidden_food_response_v1",
  green_food_decision_discourage: "discouraged_food_response_v1",
  green_product_ingredient_check: "ingredient_label_request_v1",
  green_logistics: "logistics_reply_v1",
  green_meal_reminder: "meal_reminder_v1",
  green_low_risk_clarification: "low_risk_clarification_v1",
  green_context_recap: "context_recap_v1",
  green_visual_progress_acknowledgement: "visual_progress_ack_v1",
  green_visual_product_conflict: "forbidden_food_response_v1",
  green_visual_screenshot_confirmation: "allowed_food_answer_v1",
  unknown_intent: "unknown_intent_clarify_v1",
};

export function buildResponsePlanV1({
  riskDecision,
  canonicalIntent = null,
  greenIntent = null,
  answerability = null,
  foodDecisionV2 = null,
  foodRule = null,
  modeDecision = null,
  tenantId = null,
  dietitianId = null,
  voiceProfile = null,
  styleEditHistorySignals = null,
  knownClientNames = [],
}) {
  const intentFamily =
    answerability?.intentFamily || canonicalIntent?.intentFamily || greenIntent?.intentFamily || null;
  const replyMode = resolveReplyMode({
    riskDecision,
    canonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2,
    modeDecision,
  });
  const templateId = resolveTemplateId(replyMode, intentFamily, foodDecisionV2);
  const sourceRefs = buildSourceRefs(answerability);
  const foodDecision = summarizeFoodDecision(foodDecisionV2, foodRule);
  const responsePlanDraft = {
    version: RESPONSE_PLAN_V1_VERSION,
    intentFamily,
    replyMode,
    templateId,
    sourceRefs,
    foodDecision,
    riskClass: riskDecision?.level || null,
    clientMessagePlan: null,
    internalReason: null,
    claimManifest: null,
    styleDna: null,
    providerEligible: isResponsePlanProviderEligible({ replyMode }),
  };
  const claimManifest = buildClaimManifestV1({ responsePlan: responsePlanDraft });
  const styleDna = buildStyleDnaV2({
    tenantId,
    dietitianId,
    voiceProfile,
    editHistorySignals: styleEditHistorySignals,
    knownClientNames,
  });
  const clientMessagePlan = buildClientMessagePlan({ replyMode, intentFamily, templateId });
  const internalReason = buildInternalReason({
    canonicalIntent,
    greenIntent,
    answerability,
    modeDecision,
    replyMode,
  });

  return {
    ...responsePlanDraft,
    clientMessagePlan,
    internalReason,
    claimManifest,
    styleDna,
  };
}

export function isResponsePlanProviderEligible(responsePlan) {
  if (!responsePlan || typeof responsePlan !== "object") return false;
  return responsePlan.replyMode === "send" || responsePlan.replyMode === "draft";
}

export function resolveReplyMode({
  riskDecision,
  canonicalIntent,
  greenIntent,
  answerability,
  foodDecisionV2,
  modeDecision,
}) {
  if (greenIntent?.allowed === false || canonicalIntent?.allowed === false) {
    if (canonicalIntent?.workflowState === "needs_label" || foodDecisionV2?.decision === "needs_label") {
      return "ask_label";
    }
    if (canonicalIntent?.workflowState === "clarify" || canonicalIntent?.intentFamily === "unknown_intent") {
      return "clarify";
    }
    return "handoff";
  }

  if (foodDecisionV2?.decision === "needs_label") return "ask_label";
  if (canonicalIntent?.workflowState === "needs_label") return "ask_label";

  if (!answerability?.allowed) return "handoff";

  if (modeDecision?.action === "handoff") return "handoff";
  if (modeDecision?.action === "ignore" || modeDecision?.action === "no_ai") return "block";

  if (riskDecision?.level === "yellow" || modeDecision?.action === "draft_for_approval") return "draft";
  if (modeDecision?.action === "auto_send") return "send";

  return "block";
}

export function resolveTemplateId(replyMode, intentFamily, foodDecisionV2 = null) {
  if (replyMode === "handoff" || replyMode === "block") return null;
  if (replyMode === "ask_label" || foodDecisionV2?.decision === "needs_label") {
    return "ingredient_label_request_v1";
  }
  if (replyMode === "clarify" || intentFamily === "unknown_intent") {
    return "unknown_intent_clarify_v1";
  }
  if (intentFamily && INTENT_TEMPLATE_IDS[intentFamily]) {
    return INTENT_TEMPLATE_IDS[intentFamily];
  }
  if (replyMode === "draft") return "provider_styled_draft_v1";
  if (replyMode === "send") return "provider_styled_send_v1";
  return null;
}

function buildSourceRefs(answerability) {
  const refs = [];
  const seen = new Set();

  for (const source of answerability?.sources || []) {
    const id = source.sourceId || `${source.category}:${source.segmentType}`;
    if (seen.has(id)) continue;
    seen.add(id);
    refs.push({
      id,
      category: source.category,
      segmentType: source.segmentType,
      authority: source.authority || null,
      origin: source.origin || null,
    });
  }

  for (const category of answerability?.sourceCategories || []) {
    const id = `category:${category}`;
    if (seen.has(id)) continue;
    seen.add(id);
    refs.push({
      id,
      category,
      segmentType: null,
      authority: null,
      origin: null,
    });
  }

  return refs;
}

function summarizeFoodDecision(foodDecisionV2, foodRule) {
  if (foodDecisionV2?.decision && foodDecisionV2.decision !== "not_applicable") {
    return {
      engine: "food_decision_v2",
      decision: foodDecisionV2.decision,
      queryType: foodDecisionV2.queryType || null,
      providerEligible: foodDecisionV2.providerEligible ?? null,
      reasonCodes: Array.isArray(foodDecisionV2.reasonCodes) ? [...foodDecisionV2.reasonCodes] : [],
    };
  }

  if (foodRule?.decision && foodRule.decision !== "not_applicable") {
    return {
      engine: "food_rule",
      decision: foodRule.decision,
      queryType: foodRule.queryType || null,
      providerEligible: null,
      reasonCodes: Array.isArray(foodRule.reasons) ? [...foodRule.reasons] : [],
    };
  }

  return null;
}

function buildStyleDnaPlaceholder() {
  return buildStyleDnaV2();
}

function buildClientMessagePlan({ replyMode, intentFamily, templateId }) {
  const mustAsk = replyMode === "ask_label" ? ["ingredient_label"] : [];
  const mustAvoid = ["clinical_claims_outside_manifest", "raw_internal_metadata", "raw_product_label_text"];

  return {
    replyMode,
    templateId,
    intentFamily,
    mustAsk,
    mustAvoid,
    summary: buildBoundedSummary(replyMode, intentFamily, templateId),
  };
}

function buildBoundedSummary(replyMode, intentFamily, templateId) {
  return [
    `replyMode=${replyMode}`,
    intentFamily ? `intentFamily=${intentFamily}` : null,
    templateId ? `templateId=${templateId}` : null,
  ]
    .filter(Boolean)
    .join("; ")
    .slice(0, 240);
}

function buildInternalReason({ canonicalIntent, greenIntent, answerability, modeDecision, replyMode }) {
  const reasons = [
    ...(canonicalIntent?.reasons || []),
    ...(greenIntent?.reasons || []),
    ...(answerability?.reasons || []),
    modeDecision?.reason ? `mode:${modeDecision.reason}` : null,
    `replyMode:${replyMode}`,
  ].filter(Boolean);

  return [...new Set(reasons)].slice(0, 12).join("|").slice(0, 480);
}
