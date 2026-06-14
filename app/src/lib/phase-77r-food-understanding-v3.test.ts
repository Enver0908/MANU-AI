import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { createClientMenuPlanV1InState } from "./phase-77f-client-menu-plan";
import { evaluateClientFoodDecisionV2, evaluateFoodDecisionEngineV2 } from "./phase-77g-food-decision-engine-v2";
import { getClientFoodRuleProfileV2Record } from "./phase-77e-client-food-rule-profile";
import {
  buildFoodUnderstandingV3Context,
  loadFoodAliasDictionaryV3,
} from "./phase-77r-food-understanding-v3";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77r food understanding v3", () => {
  it("loads checksum-backed alias dictionary from JSONL", () => {
    const dictionary = loadFoodAliasDictionaryV3();
    expect(dictionary.entryCount).toBeGreaterThanOrEqual(4);
    expect(dictionary.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(dictionary.dictionaryVersion).toBe("food-alias-dictionary-v3-v0.1.0");
  });

  it("scopes tenant-approved aliases to tenant id", () => {
    const context = buildFoodUnderstandingV3Context(DEMO_TENANT_ID);
    expect(context.tenantApprovedAliases.some((entry) => entry.alias === "lor peyniri")).toBe(true);
    expect(context.globalAliases.some((entry) => entry.alias === "beyaz peynir")).toBe(true);
  });

  it("routes brand products to needs_label without ingredient inference", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Ulker gofret yiyebilir miyim?");
    expect(result.decision).toBe("needs_label");
    expect(result.reasonCodes).toContain("food_decision_v2_product_label_required");
  });

  it("routes recipe-less mixed dishes to needs_review", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Kisir yiyebilir miyim?");
    expect(result.decision).toBe("needs_review");
    expect(result.reasonCodes).toContain("food_understanding_v3_mixed_dish_no_recipe");
  });

  it("does not false-match alias et inside et suyu", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Et suyu yiyebilir miyim?");
    expect(result.reasonCodes).not.toContain("food_understanding_v3_alias_pending_qa");
    expect(["needs_review", "discourage", "forbid"]).toContain(result.decision);
  });

  it("keeps pending-QA global aliases out of autopilot", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Et yiyebilir miyim?");
    expect(result.decision).toBe("needs_review");
    expect(result.reasonCodes).toContain("food_understanding_v3_alias_pending_qa");
  });

  it("allows mixed dish path to continue when menu recipe exists", () => {
    const state = seedPublishedFormResponse();
    const seeded = createClientMenuPlanV1InState(state, "client-mert", { templateType: "weekly_meal_framework" });
    const draft = seeded.clientMenuPlans.find((plan) => plan.clientId === "client-mert");
    const profile = getClientFoodRuleProfileV2Record(state, "client-mert");
    const activeMenu = {
      ...draft!,
      status: "active" as const,
      mealSlots: draft!.mealSlots.map((slot) =>
        slot.mealKey === "ogle"
          ? {
              ...slot,
              items: [
                {
                  id: "item-kisir",
                  label: "Kisir",
                  freeText: "kisir",
                  catalogFoodIds: [],
                  catalogMatch: null,
                  portionNote: "",
                  recipe: {
                    title: "Kisir",
                    ingredients: ["bulgur", "maydanoz", "domates"],
                    instructions: "Karistir",
                  },
                },
              ],
            }
          : slot,
      ),
    };

    const result = evaluateFoodDecisionEngineV2({
      message: "Kisir yiyebilir miyim?",
      riskLevel: "green",
      tenantId: DEMO_TENANT_ID,
      foodAliasContext: buildFoodUnderstandingV3Context(DEMO_TENANT_ID),
      foodProfile: profile,
      activeMenu,
      personalForm: { goalType: "Kilo verme", goalKey: "kilo_verme" },
    });
    expect(result.reasonCodes).not.toContain("food_understanding_v3_mixed_dish_no_recipe");
    expect(result.decision).not.toBe("needs_label");
  });
});
