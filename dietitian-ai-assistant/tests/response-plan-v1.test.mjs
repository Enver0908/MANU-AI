import test from "node:test";
import assert from "node:assert/strict";
import {
  RESPONSE_PLAN_V1_VERSION,
  buildResponsePlanV1,
  isResponsePlanProviderEligible,
  resolveReplyMode,
  resolveTemplateId,
} from "../src/response-plan-v1.js";
import {
  appendResponsePlanPromptSegments,
  assertBoundedProviderSegment,
  buildResponsePlanPromptSegments,
} from "../src/response-plan-prompt-segments.js";

test("response plan v1 exposes version and provider eligibility", () => {
  assert.equal(RESPONSE_PLAN_V1_VERSION, "response-plan-v1-v0.1.0");
  assert.equal(isResponsePlanProviderEligible({ replyMode: "send" }), true);
  assert.equal(isResponsePlanProviderEligible({ replyMode: "draft" }), true);
  assert.equal(isResponsePlanProviderEligible({ replyMode: "handoff" }), false);
  assert.equal(isResponsePlanProviderEligible({ replyMode: "clarify" }), false);
});

test("response plan maps autopilot green to send and copilot to draft", () => {
  const sendPlan = buildResponsePlanV1({
    riskDecision: { level: "green" },
    canonicalIntent: { intentFamily: "green_allowed_substitution", allowed: true },
    greenIntent: { allowed: true, intentFamily: "green_allowed_substitution" },
    answerability: {
      allowed: true,
      intentFamily: "green_allowed_substitution",
      sourceCategories: ["active_diet_plan"],
      sources: [{ category: "active_diet_plan", segmentType: "diet_plan_summary", sourceId: "plan-1" }],
    },
    modeDecision: { action: "auto_send", reason: "green_autopilot" },
  });

  assert.equal(sendPlan.replyMode, "send");
  assert.equal(sendPlan.templateId, "allowed_substitution_v1");
  assert.equal(sendPlan.providerEligible, true);
  assert.ok(sendPlan.sourceRefs.length > 0);
  assert.ok(sendPlan.claimManifest);
  assert.ok(sendPlan.styleDna);

  const draftPlan = buildResponsePlanV1({
    riskDecision: { level: "green" },
    canonicalIntent: { intentFamily: "green_plan_lookup", allowed: true },
    greenIntent: { allowed: true, intentFamily: "green_plan_lookup" },
    answerability: { allowed: true, intentFamily: "green_plan_lookup", sourceCategories: ["active_diet_plan"], sources: [] },
    modeDecision: { action: "draft_for_approval", reason: "client_copilot_mode" },
  });

  assert.equal(draftPlan.replyMode, "draft");
  assert.equal(draftPlan.providerEligible, true);
});

test("response plan maps unknown intent to clarify without provider eligibility", () => {
  const replyMode = resolveReplyMode({
    riskDecision: { level: "green" },
    canonicalIntent: { intentFamily: "unknown_intent", allowed: false, workflowState: "clarify" },
    greenIntent: { allowed: false, intentFamily: "unknown_intent" },
    answerability: { allowed: false },
    modeDecision: { action: "handoff", reason: "canonical_unknown_intent" },
  });

  assert.equal(replyMode, "clarify");
  assert.equal(resolveTemplateId(replyMode, "unknown_intent"), "unknown_intent_clarify_v1");
});

test("response plan prompt segments are bounded and append to prompt context", () => {
  const responsePlan = buildResponsePlanV1({
    riskDecision: { level: "green" },
    canonicalIntent: { intentFamily: "green_logistics", allowed: true },
    greenIntent: { allowed: true, intentFamily: "green_logistics" },
    answerability: { allowed: true, intentFamily: "green_logistics", sourceCategories: ["prompt_allowed_form_response"], sources: [] },
    modeDecision: { action: "auto_send", reason: "green_autopilot" },
  });

  const segments = buildResponsePlanPromptSegments({ responsePlan });
  assert.equal(segments.length, 3);
  assert.deepEqual(
    segments.map((segment) => segment.type),
    ["response_plan", "claim_manifest", "style_dna"],
  );
  for (const segment of segments) {
    assertBoundedProviderSegment(segment);
    assert.ok(!segment.text.includes("internalReason"));
  }

  const appended = appendResponsePlanPromptSegments(
    { segments: [{ type: "diet_plan_summary", text: "Breakfast plan" }] },
    responsePlan,
  );
  assert.equal(appended.segments.length, 4);
});

test("response plan prompt segments reject raw internal metadata markers", () => {
  assert.throws(
    () =>
      assertBoundedProviderSegment({
        type: "response_plan",
        text: "internal_reason=leak",
      }),
    /provider_segment_forbidden_marker/,
  );
});
