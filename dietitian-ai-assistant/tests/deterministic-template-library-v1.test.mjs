import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION,
  KNOWN_TEMPLATE_IDS,
  assertClientFacingTemplateId,
  assertTemplateTextSafeForClient,
  isKnownTemplateId,
  parseTemplateIdFromResponsePlanSegment,
  renderDeterministicTemplate,
} from "../src/deterministic-template-library-v1.js";
import { buildResponsePlanV1, resolveTemplateId } from "../src/response-plan-v1.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadGoldenCases() {
  const raw = readFileSync(join(moduleDir, "deterministic-template-golden-cases.jsonl"), "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("deterministic template library exposes version and known template ids", () => {
  assert.equal(DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION, "deterministic-template-library-v1-v0.1.0");
  assert.ok(KNOWN_TEMPLATE_IDS.includes("ingredient_label_request_v1"));
  assert.equal(isKnownTemplateId("ingredient_label_request_v1"), true);
  assert.equal(isKnownTemplateId(null), false);
});

test("assertClientFacingTemplateId fails closed without template id", () => {
  assert.throws(() => assertClientFacingTemplateId(null), /client_facing_template_id_required/);
  assert.throws(() => assertClientFacingTemplateId("missing_template_v9"), /client_facing_template_id_required/);
});

test("response plan maps needs_label to ingredient label template", () => {
  const templateId = resolveTemplateId("ask_label", "green_product_ingredient_check", {
    decision: "needs_label",
  });
  assert.equal(templateId, "ingredient_label_request_v1");
});

test("deterministic template golden cases satisfy phase 77P acceptance", () => {
  const failures = [];

  for (const goldenCase of loadGoldenCases()) {
    const text = renderDeterministicTemplate({
      templateId: goldenCase.templateId,
      language: goldenCase.language || "tr",
      replyMode: goldenCase.replyMode || null,
      riskClass: goldenCase.riskClass || null,
    });

    try {
      assertTemplateTextSafeForClient(text);
    } catch (error) {
      failures.push(`${goldenCase.id}: unsafe template text ${error.message}`);
    }

    for (const fragment of goldenCase.expectContains || []) {
      if (!text.toLowerCase().includes(String(fragment).toLowerCase())) {
        failures.push(`${goldenCase.id}: expected to contain ${fragment}`);
      }
    }

    for (const fragment of goldenCase.expectNotContains || []) {
      if (text.toLowerCase().includes(String(fragment).toLowerCase())) {
        failures.push(`${goldenCase.id}: expected not to contain ${fragment}`);
      }
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

test("parseTemplateIdFromResponsePlanSegment reads bounded response plan text", () => {
  const segment =
    "version=response-plan-v1-v0.1.0; intentFamily=green_plan_lookup; replyMode=send; templateId=plan_lookup_v1; riskClass=green";
  assert.equal(parseTemplateIdFromResponsePlanSegment(segment), "plan_lookup_v1");
  assert.equal(parseTemplateIdFromResponsePlanSegment("templateId=none"), null);
});

test("buildResponsePlanV1 ask_label plan carries ingredient template id", () => {
  const plan = buildResponsePlanV1({
    riskDecision: { level: "green" },
    canonicalIntent: { intentFamily: "green_product_ingredient_check", allowed: true },
    greenIntent: { allowed: true, intentFamily: "green_product_ingredient_check" },
    answerability: { allowed: true, intentFamily: "green_product_ingredient_check", sourceCategories: ["food_profile_v2"], sources: [] },
    foodDecisionV2: { decision: "needs_label", queryType: "product_ingredient" },
    modeDecision: { action: "auto_send", reason: "green_autopilot" },
  });

  assert.equal(plan.replyMode, "ask_label");
  assert.equal(plan.templateId, "ingredient_label_request_v1");
  assert.equal(plan.providerEligible, false);
});
