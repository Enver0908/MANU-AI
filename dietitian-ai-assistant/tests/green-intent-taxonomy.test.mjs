import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGreenIntentTaxonomy } from "../src/green-intent-taxonomy.js";

function promptContextFor(message) {
  return {
    segments: [{ type: "current_message", text: message }],
  };
}

test("phase 68 recalibration allows safe off-menu food flexibility requests", () => {
  const result = evaluateGreenIntentTaxonomy({
    promptContext: promptContextFor("Bugun plan disi hamburger yiyebilir miyim?"),
    riskDecision: { level: "green", reasons: [] },
    answerability: null,
  });

  assert.equal(result.decision, "green_intent_allowed");
  assert.equal(result.allowed, true);
});

test("phase 68 recalibration still blocks structural plan change requests", () => {
  const result = evaluateGreenIntentTaxonomy({
    promptContext: promptContextFor("Diyet planimi yeniden yapilandirmak istiyorum."),
    riskDecision: { level: "green", reasons: [] },
    answerability: null,
  });

  assert.equal(result.decision, "blocked_sensitive_intent");
  assert.equal(result.blockedFamily, "yellow_active_plan_structural_change");
});
