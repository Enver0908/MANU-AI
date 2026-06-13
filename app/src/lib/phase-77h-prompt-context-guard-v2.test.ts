import { describe, expect, it } from "vitest";
import { assertMockProviderInputPolicy, buildMockProviderInput } from "./ai-provider";
import { evaluatePhase75PromptContextFieldEligibility } from "./phase-75-gemini-provider-gate";
import { mapFoodDecisionV2ToPermissionIntents } from "./phase-72-permission-graph";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 77H prompt context and guard v2", () => {
  it("allows food decision v2 segment types at the mock provider boundary", () => {
    expect(() =>
      assertMockProviderInputPolicy(
        buildMockProviderInput(
          {
            segments: [
              { type: "food_decision_v2", text: "decision: allow" },
              { type: "food_profile_summary", text: "forbiddenFoods: 1" },
              { type: "menu_authority", text: "status: active" },
              { type: "flexibility_modifier", text: "level: moderate" },
              { type: "food_source_manifest", text: "sources: food_profile_v2" },
            ],
          },
          "green",
        ),
      ),
    ).not.toThrow();
  });

  it("allows food decision v2 fields in the Phase 75 allowlist", () => {
    expect(evaluatePhase75PromptContextFieldEligibility("food_decision_v2").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("menu_authority").providerInputAllowed).toBe(true);
  });

  it("maps food decision v2 decisions to permission graph intents", () => {
    expect(mapFoodDecisionV2ToPermissionIntents({ decision: "forbid" })).toEqual(["forbidden_food_reminder"]);
    expect(mapFoodDecisionV2ToPermissionIntents({ decision: "discourage" })).toEqual([
      "equivalent_substitution_allowed",
    ]);
    expect(mapFoodDecisionV2ToPermissionIntents({ decision: "needs_review" })).toEqual(["food_rule_uncertain_review"]);
  });

  it("includes food decision v2 prompt segments in simulator context paths for profile-backed clients", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Fistik yiyebilir miyim?",
      idempotencyKey: "phase77h-food-v2-segments-1",
      now: "2026-06-10T12:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      foodDecisionV2?: { decision?: string };
      segments?: Array<{ type: string }>;
    };

    expect(manifest?.foodDecisionV2?.decision).toBe("forbid");
    const segmentTypes = (manifest?.segments || []).map((segment) => segment.type);
    expect(segmentTypes).toContain("food_decision_v2");
  });

  it("keeps non-food green plan lookup flows working without v2 segments", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne var?",
      idempotencyKey: "phase77h-plan-lookup-1",
      now: "2026-06-10T12:00:00.000Z",
    });

    const decision = state.aiDecisions.at(-1);
    expect(decision?.risk).toBe("green");
    expect(decision?.action).not.toBe("handoff");
  });
});
