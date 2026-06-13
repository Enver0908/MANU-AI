import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_INTENT_RESOLVER_V2_VERSION,
  resolveCanonicalIntentV2,
} from "../src/canonical-intent-resolver-v2.js";
import {
  evaluateGreenIntentTaxonomy,
  mapCanonicalIntentToGreenTaxonomy,
} from "../src/green-intent-taxonomy.js";
import { resolveEffectiveIntentFamily } from "../src/intent-specific-answerability.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadGoldenCases() {
  const raw = readFileSync(join(moduleDir, "canonical-intent-golden-cases.jsonl"), "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function promptContextFor(message) {
  return {
    segments: [{ type: "current_message", text: message }],
  };
}

test("canonical intent resolver exposes version constant", () => {
  assert.equal(CANONICAL_INTENT_RESOLVER_V2_VERSION, "canonical-intent-resolver-v2-v0.1.0");
});

test("canonical intent golden cases satisfy phase 77N acceptance", () => {
  const failures = [];
  for (const goldenCase of loadGoldenCases()) {
    const canonicalIntent = resolveCanonicalIntentV2({
      message: goldenCase.message,
      riskDecision: { level: goldenCase.riskLevel || "green" },
      foodDecisionV2: goldenCase.foodDecisionV2 || null,
      foodRule: goldenCase.foodRule || null,
    });
    const taxonomy = evaluateGreenIntentTaxonomy({
      promptContext: promptContextFor(goldenCase.message),
      riskDecision: { level: goldenCase.riskLevel || "green" },
      canonicalIntent,
      foodDecisionV2: goldenCase.foodDecisionV2 || null,
      foodRule: goldenCase.foodRule || null,
    });
    const effectiveFamily = resolveEffectiveIntentFamily(
      taxonomy,
      goldenCase.foodRule || null,
      goldenCase.foodDecisionV2 || null,
      canonicalIntent,
    );

    if (canonicalIntent.intentFamily !== goldenCase.expectIntentFamily) {
      failures.push(`${goldenCase.id}: intentFamily expected ${goldenCase.expectIntentFamily}, got ${canonicalIntent.intentFamily}`);
    }
    if (canonicalIntent.allowed !== goldenCase.expectAllowed) {
      failures.push(`${goldenCase.id}: allowed expected ${goldenCase.expectAllowed}, got ${canonicalIntent.allowed}`);
    }
    if (goldenCase.expectBlockedFamily && canonicalIntent.blockedFamily !== goldenCase.expectBlockedFamily) {
      failures.push(`${goldenCase.id}: blockedFamily expected ${goldenCase.expectBlockedFamily}, got ${canonicalIntent.blockedFamily}`);
    }
    if (goldenCase.expectWorkflowState && canonicalIntent.workflowState !== goldenCase.expectWorkflowState) {
      failures.push(`${goldenCase.id}: workflowState expected ${goldenCase.expectWorkflowState}, got ${canonicalIntent.workflowState}`);
    }
    if (goldenCase.expectPrecedenceStage && canonicalIntent.precedenceStage !== goldenCase.expectPrecedenceStage) {
      failures.push(`${goldenCase.id}: precedenceStage expected ${goldenCase.expectPrecedenceStage}, got ${canonicalIntent.precedenceStage}`);
    }
    if (effectiveFamily !== (goldenCase.expectIntentFamily ?? null)) {
      failures.push(`${goldenCase.id}: effectiveFamily mismatch ${effectiveFamily}`);
    }
    if (taxonomy.canonicalIntent?.intentFamily !== canonicalIntent.intentFamily) {
      failures.push(`${goldenCase.id}: taxonomy canonicalIntent drift`);
    }
  }

  assert.deepEqual(failures, []);
});

test("unknown intent maps to blocked taxonomy decision", () => {
  const canonicalIntent = resolveCanonicalIntentV2({
    message: "Merhaba",
    riskDecision: { level: "green" },
  });
  const mapped = mapCanonicalIntentToGreenTaxonomy(canonicalIntent);
  assert.equal(mapped.decision, "blocked_unknown_intent");
  assert.equal(mapped.intentFamily, "unknown_intent");
  assert.equal(mapped.allowed, false);
});

test("phase 68 recalibration still allows safe off-menu food flexibility requests", () => {
  const result = evaluateGreenIntentTaxonomy({
    promptContext: promptContextFor("Bugun plan disi hamburger yiyebilir miyim?"),
    riskDecision: { level: "green", reasons: [] },
  });

  assert.equal(result.decision, "green_intent_allowed");
  assert.equal(result.allowed, true);
  assert.equal(result.intentFamily, "green_allowed_food_confirmation");
});

test("phase 68 recalibration still blocks structural plan change requests", () => {
  const result = evaluateGreenIntentTaxonomy({
    promptContext: promptContextFor("Diyet planimi yeniden yapilandirmak istiyorum."),
    riskDecision: { level: "green", reasons: [] },
  });

  assert.equal(result.decision, "blocked_sensitive_intent");
  assert.equal(result.blockedFamily, "yellow_active_plan_structural_change");
});
