import { describe, expect, it } from "vitest";
import { assertMockProviderInputPolicy, buildMockProviderInput } from "./ai-provider";
import { evaluatePhase75PromptContextFieldEligibility } from "./phase-75-gemini-provider-gate";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 76I prompt context and provider guard", () => {
  it("allows food-rule provider segment types at the mock provider boundary", () => {
    expect(() =>
      assertMockProviderInputPolicy(
        buildMockProviderInput(
          {
            segments: [
              { type: "food_rule_decision", text: "decision: forbidden_food_rejection" },
              { type: "forbidden_food_rules", text: "items(1): fistik" },
              { type: "ingredient_verification", text: "decision: product_blocked" },
            ],
          },
          "green",
        ),
      ),
    ).not.toThrow();
  });

  it("allows food-rule prompt fields in the Phase 75 allowlist", () => {
    expect(evaluatePhase75PromptContextFieldEligibility("food_rule_decision").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("ingredient_verification").providerInputAllowed).toBe(true);
  });

  it("includes food-rule prompt segments in simulator context manifest paths", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Fistik yiyebilir miyim?",
      idempotencyKey: "phase76i-food-segments-1",
      now: "2026-06-08T12:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      foodRule?: { decision?: string };
      segments?: Array<{ type: string }>;
    };

    expect(manifest?.foodRule?.decision).toBe("forbidden_food_rejection");
    const segmentTypes = (manifest?.segments || []).map((segment) => segment.type);
    expect(segmentTypes).toContain("food_rule_decision");
    expect(segmentTypes).toContain("forbidden_food_rules");
  });
});
