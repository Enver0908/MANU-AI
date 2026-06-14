import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLAIM_MANIFEST_V1_VERSION,
  buildClaimManifestV1,
  detectClaimManifestOutputViolations,
  isClaimManifestComplete,
} from "../src/claim-manifest-v1.js";
import { buildResponsePlanV1 } from "../src/response-plan-v1.js";
import { guardProviderOutput } from "../src/response-quality-guard.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadGoldenCases() {
  const raw = readFileSync(join(moduleDir, "claim-manifest-golden-cases.jsonl"), "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildPlanFromGoldenCase(goldenCase) {
  return buildResponsePlanV1({
    riskDecision: { level: "green" },
    canonicalIntent: {
      intentFamily: goldenCase.intentFamily || "green_allowed_substitution",
      allowed: true,
    },
    greenIntent: {
      allowed: true,
      intentFamily: goldenCase.intentFamily || "green_allowed_substitution",
    },
    answerability: {
      allowed: true,
      intentFamily: goldenCase.intentFamily || "green_allowed_substitution",
      sourceCategories: ["active_diet_plan", "structured_allowed_food"],
      sources: [
        {
          category: "active_diet_plan",
          segmentType: "diet_plan_summary",
          sourceId: "plan-1",
        },
      ],
    },
    foodDecisionV2:
      goldenCase.foodDecision?.decision === "forbid"
        ? { decision: "forbid", queryType: "food_permission", reasonCodes: [] }
        : goldenCase.foodDecision?.decision === "needs_label"
          ? { decision: "needs_label", queryType: "product_ingredient", reasonCodes: [] }
          : null,
    modeDecision: { action: goldenCase.replyMode === "draft" ? "draft_for_approval" : "auto_send" },
  });
}

test("claim manifest v1 exposes version", () => {
  assert.equal(CLAIM_MANIFEST_V1_VERSION, "claim-manifest-v1-v0.1.0");
});

test("buildResponsePlanV1 attaches complete claim manifest for provider-eligible plans", () => {
  const plan = buildPlanFromGoldenCase({
    intentFamily: "green_allowed_substitution",
    replyMode: "send",
  });

  assert.equal(plan.claimManifest.version, CLAIM_MANIFEST_V1_VERSION);
  assert.ok(plan.claimManifest.claims.length > 0);
  assert.equal(isClaimManifestComplete(plan.claimManifest, { providerEligible: true }), true);
});

test("claim manifest golden cases satisfy phase 77Q acceptance", () => {
  const failures = [];

  for (const goldenCase of loadGoldenCases()) {
    if (goldenCase.category === "incomplete_manifest") {
      const manifest = buildClaimManifestV1({
        responsePlan: { templateId: null, intentFamily: null, sourceRefs: [], foodDecision: null },
      });
      if (isClaimManifestComplete(manifest, { providerEligible: true }) !== false) {
        failures.push(`${goldenCase.id}: expected incomplete provider manifest`);
      }
      continue;
    }

    if (goldenCase.category === "complete_manifest" || goldenCase.category === "incomplete_manifest") {
      const plan = buildPlanFromGoldenCase(goldenCase);
      const manifest = plan.claimManifest;
      const complete = isClaimManifestComplete(manifest, { providerEligible: goldenCase.expectComplete !== false });

      if (complete !== goldenCase.expectComplete) {
        failures.push(`${goldenCase.id}: complete expected ${goldenCase.expectComplete}, got ${complete}`);
      }

      for (const claimType of goldenCase.expectClaimTypes || []) {
        if (!manifest.claims.some((claim) => claim.type === claimType)) {
          failures.push(`${goldenCase.id}: missing claim type ${claimType}`);
        }
      }
      continue;
    }

    const manifest = buildClaimManifestV1({
      responsePlan: {
        templateId: goldenCase.manifestTemplateId,
        intentFamily: "green_allowed_food_confirmation",
        sourceRefs: [{ id: "plan-1", category: "active_diet_plan" }],
        foodDecision: null,
      },
    });
    const violations = detectClaimManifestOutputViolations(goldenCase.output, { claimManifest: manifest });
    const expected = goldenCase.expectViolations || [];

    if (violations.join(",") !== expected.join(",")) {
      failures.push(`${goldenCase.id}: violations expected ${expected.join(",")}, got ${violations.join(",")}`);
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

test("guardProviderOutput blocks claim outside manifest without deriving authority from output", () => {
  const manifest = buildClaimManifestV1({
    responsePlan: {
      templateId: "forbidden_food_response_v1",
      intentFamily: "green_forbidden_food_reminder",
      sourceRefs: [{ id: "forbidden-1", category: "structured_forbidden_food" }],
      foodDecision: { engine: "food_decision_v2", decision: "forbid" },
    },
  });

  const result = guardProviderOutput({
    output: "Bugun rahatca fistik yiyebilirsin.",
    capsule: { client: { fullName: "Mert" }, persona: { behavior: {} }, voiceProfile: {} },
    riskDecision: { level: "green" },
    claimManifest: manifest,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.issues.some((issue) => issue.code === "claim_outside_manifest"));
});
