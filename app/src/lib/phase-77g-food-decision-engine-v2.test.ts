import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { findPhase77DFoodsByName } from "./phase-77d-master-food-catalog";
import { createClientMenuPlanV1InState } from "./phase-77f-client-menu-plan";
import {
  getClientFoodRuleProfileV2Record,
  getClientFoodRuleProfileV2State,
  saveClientFoodRuleProfileV2InState,
} from "./phase-77e-client-food-rule-profile";
import {
  evaluateClientFoodDecisionV2,
  evaluateFoodDecisionEngineV2,
  mapFoodDecisionV2ToLegacyFoodRule,
  matchCatalogFoodCandidates,
} from "./phase-77g-food-decision-engine-v2";
import { buildFoodUnderstandingV3Context } from "./phase-77r-food-understanding-v3";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

const PEYNIR_FOOD_ID = "sut-urunleri__peynir__beyaz-peynir";
const EGG_FOOD_ID = "yumurta__tavuk-yumurtasi__tavuk-yumurtasi";
const EGG_FOOD_NAME = findPhase77DFoodsByName("Tavuk yumurtası")[0]?.food.name || "Tavuk yumurtası";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

function profileBody(profile: NonNullable<ReturnType<typeof getClientFoodRuleProfileV2State>>) {
  const { conflicts, ...body } = profile;
  void conflicts;
  return body;
}

describe("phase 77g food decision engine v2", () => {
  it("matches catalog foods deterministically", () => {
    const matches = matchCatalogFoodCandidates("beyaz peynir");
    expect(matches.some((match) => match.foodId === PEYNIR_FOOD_ID)).toBe(true);
  });

  it("forbids explicitly forbidden catalog foods", () => {
    let state = seedPublishedFormResponse();
    const profile = getClientFoodRuleProfileV2State(state, "client-mert");
    state = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: profile!.revision,
      profile: {
        ...profileBody(profile!),
        forbiddenCatalogFoodIds: [PEYNIR_FOOD_ID],
      },
    });

    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Beyaz peynir yiyebilir miyim?");
    expect(result.decision).toBe("forbid");
    expect(result.legacyFoodRuleDecision).toBe("forbidden_food_rejection");
  });

  it("allows foods that are on the active menu", () => {
    const state = seedPublishedFormResponse();
    const seeded = createClientMenuPlanV1InState(state, "client-mert", { templateType: "weekly_meal_framework" });
    const draft = seeded.clientMenuPlans.find((plan) => plan.clientId === "client-mert");
    const profile = getClientFoodRuleProfileV2Record(state, "client-mert");
    const activeMenu = {
      ...draft!,
      status: "active" as const,
      mealSlots: draft!.mealSlots.map((slot) =>
        slot.mealKey === "kahvalti"
          ? {
              ...slot,
              items: [
                {
                  id: "item-egg",
                  label: "",
                  freeText: "Tavuk yumurtasi",
                  catalogFoodIds: [EGG_FOOD_ID],
                  catalogMatch: {
                    query: "Tavuk yumurtasi",
                    catalogFoodId: EGG_FOOD_ID,
                    catalogFoodName: EGG_FOOD_NAME,
                    matchConfidence: "exact" as const,
                  },
                  portionNote: "",
                  recipe: null,
                },
              ],
            }
          : slot,
      ),
    };

    const result = evaluateFoodDecisionEngineV2({
      message: "Tavuk yumurtası yiyebilir miyim?",
      riskLevel: "green",
      tenantId: DEMO_TENANT_ID,
      foodAliasContext: buildFoodUnderstandingV3Context(DEMO_TENANT_ID),
      foodProfile: profile,
      activeMenu,
      personalForm: { goalType: "Kilo verme", goalKey: "kilo_verme" },
    });
    expect(result.menuOnPlan).toBe(true);
    expect(result.decision).toBe("allow");
  });

  it("discourages off-menu foods under restricted flexibility", () => {
    let state = seedPublishedFormResponse();
    const profile = getClientFoodRuleProfileV2State(state, "client-mert");
    state = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: profile!.revision,
      profile: {
        ...profileBody(profile!),
        flexibilityGlobal: "restricted",
        flexibilityByGoal: {
          ...profileBody(profile!).flexibilityByGoal,
          kilo_verme: "restricted",
        },
      },
    });

    const result = evaluateClientFoodDecisionV2(
      state,
      "client-mert",
      "Bugun plan disi hamburger yiyebilir miyim?",
    );
    expect(["discourage", "needs_review"]).toContain(result.decision);
    if (result.decision === "discourage") {
      expect(result.effectiveFlexibility).toBe("restricted");
    }
  });

  it("requests written ingredients for product questions without label text", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Bir tane cikolata yiyebilir miyim?");
    expect(result.decision).toBe("needs_label");
    expect(mapFoodDecisionV2ToLegacyFoodRule("needs_label", "product_ingredient")).toBe(
      "product_ingredient_unknown",
    );
  });

  it("fails closed on mixed clinical and food intent", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(
      state,
      "client-mert",
      "Kahvaltida yumurta yerine peynir yiyebilir miyim ve ilac saatimi degistirebilir miyim?",
    );
    expect(result.decision).toBe("needs_review");
    expect(result.providerEligible).toBe(false);
  });

  it("returns not_applicable for non-green risk", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateClientFoodDecisionV2(state, "client-mert", "Badem yiyebilir miyim?", {
      riskLevel: "yellow",
    });
    expect(result.decision).toBe("not_applicable");
  });

  it("evaluates product label evidence through Phase 76H verification", () => {
    const state = seedPublishedFormResponse();
    const result = evaluateFoodDecisionEngineV2({
      message: "Icindekiler: seker, sut tozu, kakao",
      riskLevel: "green",
      foodProfile: getClientFoodRuleProfileV2Record(state, "client-mert"),
      activeMenu: null,
      productIngredientEvidence: {
        ingredientSourceType: "user_label_text",
        ingredientText: "seker, sut tozu, kakao",
        ingredientConfidence: "exact",
      },
      personalForm: { goalType: "Kilo verme", goalKey: "kilo_verme" },
    });
    expect(["forbid", "needs_review", "allow"]).toContain(result.decision);
  });
});
