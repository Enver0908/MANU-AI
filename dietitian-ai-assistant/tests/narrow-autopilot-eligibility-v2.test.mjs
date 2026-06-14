import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildClaimManifestV1 } from "../src/claim-manifest-v1.js";
import {
  NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
  applyNarrowAutopilotModeDowngrade,
  evaluateNarrowAutopilotEligibilityV2,
} from "../src/narrow-autopilot-eligibility-v2.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenCases = readFileSync(join(__dirname, "narrow-autopilot-golden-cases.jsonl"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function buildSendPlan(intentFamily, templateId, foodDecision = null) {
  const responsePlan = {
    intentFamily,
    replyMode: "send",
    templateId,
    sourceRefs: [{ id: "plan-1", category: "active_diet_plan" }],
    foodDecision,
  };
  return {
    ...responsePlan,
    claimManifest: buildClaimManifestV1({ responsePlan }),
  };
}

const baseEligibleInput = {
  clientAiMode: "autopilot",
  riskDecision: { level: "green" },
  modeDecision: { action: "auto_send", reason: "green_autopilot" },
  canonicalIntent: { intentFamily: "green_allowed_substitution", allowed: true, workflowState: "send" },
  greenIntent: { allowed: true, intentFamily: "green_allowed_substitution", decision: "green_intent_allowed" },
  answerability: { allowed: true, decision: "source_backed_green", reasons: ["intent_specific_source_backed_green"] },
  foodDecisionV2: {
    decision: "allow",
    providerEligible: true,
    menuOnPlan: true,
    catalogMatches: [{ confidence: "exact", autopilotEligible: true, foodId: "egg-alt" }],
  },
};

test("narrow autopilot eligibility exposes version", () => {
  assert.equal(NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION, "narrow-autopilot-eligibility-v2-v0.1.0");
});

test("eligible golden substitution path passes narrow autopilot", () => {
  const result = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    responsePlan: buildSendPlan("green_allowed_substitution", "allowed_substitution_v1"),
  });

  assert.equal(result.applies, true);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasonCodes, []);
});

test("substitution legacy fallback without unknown food review is ineligible", () => {
  const result = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    answerability: {
      allowed: true,
      decision: "source_backed_green",
      reasons: ["intent_specific_substitution_legacy_fallback", "active_diet_plan"],
      foodRuleDecision: "not_applicable",
      matchedSourceCategories: ["active_diet_plan", "structured_allowed_substitutions"],
    },
    foodRule: { decision: "not_applicable", queryType: null },
    foodDecisionV2: null,
    responsePlan: buildSendPlan("green_allowed_substitution", "allowed_substitution_v1"),
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes("alias_not_exact_or_approved"));
});

test("substitution legacy fallback with unknown food review stays eligible", () => {
  const result = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    answerability: {
      allowed: true,
      decision: "source_backed_green",
      reasons: ["intent_specific_substitution_legacy_fallback", "active_diet_plan"],
      foodRuleDecision: "unknown_food_requires_review",
    },
    foodRule: { decision: "unknown_food_requires_review", queryType: "food_substitution" },
    foodDecisionV2: null,
    responsePlan: buildSendPlan("green_allowed_substitution", "allowed_substitution_v1"),
  });

  assert.equal(result.eligible, true);
});

test("unknown intent and label-pending cases are ineligible", () => {
  const unknown = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    canonicalIntent: { intentFamily: "unknown_intent", allowed: false, workflowState: "clarify" },
    greenIntent: { allowed: false, intentFamily: "unknown_intent" },
    answerability: { allowed: false, decision: "handoff_required" },
    responsePlan: buildSendPlan("unknown_intent", "unknown_intent_clarify_v1"),
  });
  assert.equal(unknown.eligible, false);
  assert.ok(unknown.reasonCodes.includes("unknown_intent"));

  const needsLabel = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    canonicalIntent: {
      intentFamily: "green_product_ingredient_check",
      allowed: false,
      workflowState: "needs_label",
    },
    foodDecisionV2: { decision: "needs_label", providerEligible: false },
    responsePlan: buildSendPlan("green_product_ingredient_check", "ingredient_label_request_v1", {
      decision: "needs_label",
    }),
  });
  assert.equal(needsLabel.eligible, false);
  assert.ok(needsLabel.reasonCodes.includes("brand_without_label"));
});

test("mixed dish without recipe is ineligible", () => {
  const result = evaluateNarrowAutopilotEligibilityV2({
    ...baseEligibleInput,
    canonicalIntent: { intentFamily: "green_allowed_food_confirmation", allowed: true },
    greenIntent: { allowed: true, intentFamily: "green_allowed_food_confirmation" },
    foodDecisionV2: {
      decision: "needs_review",
      queryType: "mixed_dish",
      reasonCodes: ["food_understanding_v3_mixed_dish_no_recipe"],
      providerEligible: false,
    },
    responsePlan: buildSendPlan("green_allowed_food_confirmation", "allowed_food_answer_v1"),
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes("mixed_dish_without_recipe"));
});

test("applyNarrowAutopilotModeDowngrade routes ineligible autopilot to draft", () => {
  const downgraded = applyNarrowAutopilotModeDowngrade(
    { action: "auto_send", reason: "green_autopilot" },
    {
      applies: true,
      eligible: false,
      fallbackModeAction: "draft_for_approval",
      fallbackReason: "narrow_autopilot_ineligible",
    },
  );

  assert.deepEqual(downgraded, {
    action: "draft_for_approval",
    reason: "narrow_autopilot_ineligible",
  });
});

test("jsonl golden cases align with narrow autopilot expectations", () => {
  for (const entry of goldenCases) {
    const responsePlan = buildSendPlan(entry.intentFamily, entry.templateId, entry.foodDecision || null);
    const result = evaluateNarrowAutopilotEligibilityV2({
      clientAiMode: "autopilot",
      riskDecision: { level: "green" },
      modeDecision: { action: "auto_send", reason: "green_autopilot" },
      canonicalIntent: entry.canonicalIntent,
      greenIntent: entry.greenIntent,
      answerability: entry.answerability,
      foodDecisionV2: entry.foodDecisionV2 || null,
      foodRule: entry.foodRule || null,
      responsePlan,
    });

    assert.equal(result.eligible, entry.expectEligible, entry.id);
    for (const reasonCode of entry.expectReasonCodes || []) {
      assert.ok(result.reasonCodes.includes(reasonCode), `${entry.id}:${reasonCode}`);
    }
  }
});
