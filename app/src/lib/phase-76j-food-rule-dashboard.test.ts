import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";
import {
  buildFoodRuleAnswersFromDashboardState,
  getClientFoodRuleDashboardState,
  loadFoodRuleDashboardState,
  mergeFoodRuleDashboardIntoAnswers,
  saveClientFoodRulesInState,
} from "./phase-76j-food-rule-dashboard";

describe("phase 76j food rule dashboard", () => {
  it("loads and serializes structured food rule dashboard state", () => {
    const answers = buildPhase70QualifiedClientAnswers();
    const loaded = loadFoodRuleDashboardState(answers);

    expect(loaded.forbiddenFoodItems).toContain("peanut");
    expect(loaded.forbiddenFoodGroups).toContain("Kabuklu yemis");
    expect(loaded.dietTypeRules).toBe("Genel denge");
    expect(loaded.equivalentExchangeGroups).toContain("nut_swap:");

    const rebuilt = buildFoodRuleAnswersFromDashboardState(loaded);
    expect(rebuilt.forbidden_food_items).toContain("peanut");
    expect(rebuilt.ingredient_allergen_keywords).toEqual(expect.arrayContaining(["fistik", "sut"]));
  });

  it("merges dashboard edits into existing form answers without dropping unrelated fields", () => {
    const merged = mergeFoodRuleDashboardIntoAnswers(buildPhase70QualifiedClientAnswers(), {
      ...loadFoodRuleDashboardState(buildPhase70QualifiedClientAnswers()),
      forbiddenFoodItems: ["peanut", "walnut"],
      dietTypeRules: "Vegan",
    });

    expect(merged.primary_goal).toBeTruthy();
    expect(merged.forbidden_food_items).toContain("walnut");
    expect(merged.diet_type_rules).toBe("Vegan");
  });

  it("serializes hierarchical catalog selections into expanded forbidden fields", () => {
    const state = {
      ...loadFoodRuleDashboardState(buildPhase70QualifiedClientAnswers()),
      forbiddenFoodItems: ["manual-only"],
      forbiddenFoodGroups: ["manual-group"],
      forbiddenCatalogMainCategoryIds: ["sut-urunleri"],
      forbiddenCatalogSubCategoryIds: ["yag__hayvansal-yaglar"],
      forbiddenCatalogFoodIds: ["yumurta__tavuk-yumurtasi__tavuk-yumurtasi"],
    };

    const rebuilt = buildFoodRuleAnswersFromDashboardState(state);
    expect(rebuilt.food_catalog_version).toBe("phase-77d-master-food-catalog-v1");
    expect(rebuilt.food_catalog_forbidden_main_category_ids).toEqual(["sut-urunleri"]);
    expect(rebuilt.food_catalog_forbidden_sub_category_ids).toEqual(["yag__hayvansal-yaglar"]);
    expect(String(rebuilt.forbidden_food_items)).toContain("Tam yağlı süt");
    expect(String(rebuilt.forbidden_food_items)).toContain("Tereyağı");
    expect(String(rebuilt.forbidden_food_items)).toContain("Tavuk yumurtası");
    expect(rebuilt.forbidden_food_groups).toEqual(
      expect.arrayContaining(["manual-group", "Süt Ürünleri", "Süt", "Hayvansal Yağlar"]),
    );

    const loaded = loadFoodRuleDashboardState(rebuilt);
    expect(loaded.forbiddenFoodItems).toEqual(["manual-only"]);
    expect(loaded.forbiddenFoodGroups).toEqual(["manual-group"]);
    expect(loaded.forbiddenCatalogMainCategoryIds).toEqual(["sut-urunleri"]);
  });

  it("increments context revision, syncs restrictions, and audits food-rule saves", () => {
    const state = createInitialState();
    const beforeRevision = state.clients.find((client) => client.id === "client-mert")?.contextRevision || 0;
    const loaded = getClientFoodRuleDashboardState(state, "client-mert");

    const next = saveClientFoodRulesInState(state, "client-mert", {
      ...loaded,
      forbiddenFoodItems: [...loaded.forbiddenFoodItems, "walnut"],
      dietTypeRules: "Vegan",
    });

    const client = next.clients.find((item) => item.id === "client-mert");
    expect(client?.contextRevision).toBe(beforeRevision + 1);
    expect(client?.restrictedFoods.join(",")).toContain("walnut");
    expect(next.auditEvents.at(-1)?.eventType).toBe("client_food_rules_updated");
    expect(next.clientFormResponses.find((response) => response.clientId === "client-mert")?.answers.forbidden_food_items).toContain(
      "walnut",
    );
  });

  it("invalidates pending drafts when food rules are saved from the dashboard path", async () => {
    let state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "phase76j-food-draft-1",
    });
    const draft = state.messages.find((message) => message.status === "draft");
    const loaded = getClientFoodRuleDashboardState(state, "client-elif");

    state = saveClientFoodRulesInState(state, "client-elif", {
      ...loaded,
      optionalFoodsOrMeals: [...loaded.optionalFoodsOrMeals, "evening snack"],
    });

    expect(state.messages.find((message) => message.id === draft?.id)?.status).toBe("blocked");
    expect(state.aiDecisions.find((decision) => decision.id === draft?.generatedByAiDecisionId)?.sendStatus).toBe(
      "draft_invalidated",
    );
  });
});
