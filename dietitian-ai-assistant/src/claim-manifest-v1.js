export const CLAIM_MANIFEST_V1_VERSION = "claim-manifest-v1-v0.1.0";

export const CLAIM_MANIFEST_CLAIM_TYPES = [
  "plan_alignment_guidance",
  "allowed_food_confirmation",
  "forbidden_food_reminder",
  "discouraged_food_reminder",
  "substitution_within_rules",
  "ingredient_label_request",
  "clarification_request",
  "portion_clarification_request",
  "logistics_guidance",
  "meal_timing_reminder",
  "context_recap_guidance",
  "review_hold_notice",
  "source_scope_limit",
  "generic_plan_guidance",
];

const TEMPLATE_CLAIM_BINDINGS = {
  allowed_food_answer_v1: ["plan_alignment_guidance", "allowed_food_confirmation"],
  allowed_substitution_v1: ["plan_alignment_guidance", "substitution_within_rules"],
  plan_lookup_v1: ["plan_alignment_guidance", "generic_plan_guidance"],
  forbidden_food_response_v1: ["forbidden_food_reminder", "plan_alignment_guidance"],
  discouraged_food_response_v1: ["discouraged_food_reminder", "plan_alignment_guidance"],
  ingredient_label_request_v1: ["ingredient_label_request"],
  low_risk_clarification_v1: ["portion_clarification_request", "clarification_request"],
  unknown_intent_clarify_v1: ["clarification_request"],
  source_unsupported_answer_v1: ["source_scope_limit"],
  yellow_red_handoff_v1: ["review_hold_notice"],
  logistics_reply_v1: ["logistics_guidance"],
  meal_reminder_v1: ["meal_timing_reminder", "plan_alignment_guidance"],
  context_recap_v1: ["context_recap_guidance", "plan_alignment_guidance"],
  provider_styled_send_v1: ["generic_plan_guidance", "plan_alignment_guidance"],
  provider_styled_draft_v1: ["generic_plan_guidance", "review_hold_notice"],
};

const FOOD_DECISION_CLAIM_BINDINGS = {
  allow: ["allowed_food_confirmation"],
  discourage: ["discouraged_food_reminder"],
  forbid: ["forbidden_food_reminder"],
  needs_label: ["ingredient_label_request"],
};

const OUTPUT_SIGNALS = [
  {
    code: "food_eat_approval",
    patterns: [
      /\b(?:yiyebilirsin|yiyebilir|tuketebilirsin|tuketebilir|icebilirsin|icebilir)\b/i,
      /\b(?:you can (?:eat|have|consume)|that is fine to eat|go ahead and eat)\b/i,
    ],
    allowedClaimTypes: ["allowed_food_confirmation", "substitution_within_rules"],
  },
  {
    code: "portion_macro_change",
    patterns: [
      /\b(?:porsiyon|portion)\w*.{0,32}(?:artir|buyut|increase|raise)\w*/i,
      /\b(?:kalori|calorie|makro|macro)\w*.{0,32}(?:artir|increase|yuksek|raise)\w*/i,
    ],
    allowedClaimTypes: [
      "plan_alignment_guidance",
      "generic_plan_guidance",
      "allowed_food_confirmation",
      "substitution_within_rules",
      "discouraged_food_reminder",
    ],
  },
  {
    code: "unauthorized_substitution",
    patterns: [
      /\b(?:deneyebilir|try)\b.{0,24}\b(?:yerine|instead)\b/i,
      /\b(?:bunun yerine|instead of that)\b/i,
      /\b(?:alternatif olarak|as an alternative)\b/i,
    ],
    allowedClaimTypes: ["substitution_within_rules", "allowed_food_confirmation", "generic_plan_guidance"],
  },
];

export function buildClaimManifestV1({ responsePlan }) {
  if (!responsePlan || typeof responsePlan !== "object") {
    return incompleteManifest({ templateId: null, intentFamily: null, sourceIds: [] });
  }

  const templateId = responsePlan.templateId || null;
  const intentFamily = responsePlan.intentFamily || null;
  const sourceIds = (responsePlan.sourceRefs || []).map((ref) => ref.id).filter(Boolean);
  const claimTypes = new Set();

  for (const claimType of TEMPLATE_CLAIM_BINDINGS[templateId] || []) {
    claimTypes.add(claimType);
  }

  const foodDecision = responsePlan.foodDecision;
  if (foodDecision?.decision && FOOD_DECISION_CLAIM_BINDINGS[foodDecision.decision]) {
    for (const claimType of FOOD_DECISION_CLAIM_BINDINGS[foodDecision.decision]) {
      claimTypes.add(claimType);
    }
  }

  if (claimTypes.size === 0 && templateId) {
    claimTypes.add("generic_plan_guidance");
  }

  const claims = [...claimTypes].map((type, index) => ({
    id: `${templateId || "none"}:${type}:${index + 1}`,
    type,
    authority: resolveClaimAuthority(type, foodDecision),
    sourceIds: selectSourceIdsForClaim(type, responsePlan.sourceRefs || [], sourceIds),
  }));

  return {
    version: CLAIM_MANIFEST_V1_VERSION,
    templateId,
    intentFamily,
    claims,
    sourceIds,
    complete: claims.length > 0,
  };
}

export function isClaimManifestComplete(claimManifest, { providerEligible = false } = {}) {
  if (!claimManifest || claimManifest.version !== CLAIM_MANIFEST_V1_VERSION) return false;
  if (!Array.isArray(claimManifest.claims) || claimManifest.claims.length === 0) return false;
  if (providerEligible && !claimManifest.complete) return false;
  return claimManifest.claims.every((claim) => CLAIM_MANIFEST_CLAIM_TYPES.includes(claim.type));
}

export function detectClaimManifestOutputViolations(output, { claimManifest = null } = {}) {
  if (!claimManifest || claimManifest.version !== CLAIM_MANIFEST_V1_VERSION) {
    return ["claim_manifest_incomplete"];
  }

  if (!Array.isArray(claimManifest.claims) || claimManifest.claims.length === 0) {
    return ["claim_manifest_incomplete"];
  }

  const allowedTypes = new Set(claimManifest.claims.map((claim) => claim.type));
  const normalizedText = normalizeManifestGuardText(output);
  const violations = [];

  for (const signal of OUTPUT_SIGNALS) {
    if (!signal.patterns.some((pattern) => pattern.test(normalizedText))) continue;
    const covered = signal.allowedClaimTypes.some((claimType) => allowedTypes.has(claimType));
    if (!covered) {
      violations.push("claim_outside_manifest");
    }
  }

  if (
    allowedTypes.has("forbidden_food_reminder") &&
    !allowedTypes.has("allowed_food_confirmation") &&
    !allowedTypes.has("substitution_within_rules") &&
    OUTPUT_SIGNALS[0].patterns.some((pattern) => pattern.test(normalizedText))
  ) {
    violations.push("claim_outside_manifest");
  }

  if (
    allowedTypes.has("ingredient_label_request") &&
    !allowedTypes.has("allowed_food_confirmation") &&
    OUTPUT_SIGNALS[0].patterns.some((pattern) => pattern.test(normalizedText))
  ) {
    violations.push("claim_outside_manifest");
  }

  return [...new Set(violations)];
}

export function summarizeClaimManifestClaimTypes(claimManifest) {
  if (!claimManifest?.claims?.length) return "none";
  return claimManifest.claims
    .map((claim) => claim.type)
    .slice(0, 8)
    .join(",");
}

function incompleteManifest({ templateId, intentFamily, sourceIds }) {
  return {
    version: CLAIM_MANIFEST_V1_VERSION,
    templateId,
    intentFamily,
    claims: [],
    sourceIds,
    complete: false,
  };
}

function resolveClaimAuthority(claimType, foodDecision) {
  if (foodDecision?.engine === "food_decision_v2" && FOOD_DECISION_CLAIM_BINDINGS[foodDecision.decision]?.includes(claimType)) {
    return "food_decision_v2";
  }
  if (foodDecision?.engine === "food_rule" && FOOD_DECISION_CLAIM_BINDINGS[foodDecision.decision]?.includes(claimType)) {
    return "food_rule";
  }
  if (claimType === "source_scope_limit") return "source_ref";
  return "template_library_v1";
}

function selectSourceIdsForClaim(claimType, sourceRefs, fallbackSourceIds) {
  if (claimType === "ingredient_label_request") {
    return pickSourceIds(sourceRefs, ["food_profile_v2", "structured_ingredient_keywords", "trusted_product_evidence"], fallbackSourceIds);
  }
  if (claimType === "allowed_food_confirmation" || claimType === "substitution_within_rules") {
    return pickSourceIds(
      sourceRefs,
      ["active_diet_plan", "structured_allowed_food", "structured_equivalent_exchange_groups", "food_decision_v2_authority"],
      fallbackSourceIds,
    );
  }
  if (claimType === "forbidden_food_reminder" || claimType === "discouraged_food_reminder") {
    return pickSourceIds(
      sourceRefs,
      ["structured_forbidden_food", "food_decision_v2_authority", "food_rule_profile_v2"],
      fallbackSourceIds,
    );
  }
  return fallbackSourceIds.slice(0, 6);
}

function pickSourceIds(sourceRefs, categories, fallbackSourceIds) {
  const ids = sourceRefs
    .filter((ref) => categories.includes(ref.category))
    .map((ref) => ref.id)
    .filter(Boolean);
  return ids.length > 0 ? ids.slice(0, 6) : fallbackSourceIds.slice(0, 6);
}

function normalizeManifestGuardText(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}
