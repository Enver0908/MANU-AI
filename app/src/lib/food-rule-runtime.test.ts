import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  buildStructuredFoodRulesFromClientState,
  evaluateClientFoodRuleDecision,
} from "./food-rule-runtime";
import { getClientFoodRuleDashboardState, saveClientFoodRulesInState } from "./phase-76j-food-rule-dashboard";

describe("food rule runtime bridge", () => {
  it("builds structured food rules from seeded client form answers", () => {
    const state = createInitialState();
    const rules = buildStructuredFoodRulesFromClientState(state, "client-mert");

    expect(rules?.forbiddenFoodItems).toContain("peanut");
    expect(rules?.equivalentExchangeGroups).toHaveLength(2);
  });

  it("evaluates forbidden food rejection for seeded client", () => {
    const state = createInitialState();
    const result = evaluateClientFoodRuleDecision(state, "client-mert", "Fistik yiyebilir miyim?");

    expect(result.decision).toBe("forbidden_food_rejection");
    expect(result.queryType).toBe("food_permission");
  });

  it("evaluates equivalent substitution for seeded client", () => {
    const state = createInitialState();
    const result = evaluateClientFoodRuleDecision(state, "client-mert", "Walnut yerine almond yiyebilir miyim?");

    expect(result.decision).toBe("equivalent_substitution_allowed");
    expect(result.exchangeGroupId).toBe("nut_swap");
  });

  it("uses expanded Phase 77D catalog selections as forbidden food rules", () => {
    const state = createInitialState();
    const loaded = getClientFoodRuleDashboardState(state, "client-mert");
    const next = saveClientFoodRulesInState(state, "client-mert", {
      ...loaded,
      forbiddenFoodItems: [],
      forbiddenFoodGroups: [],
      forbiddenCatalogSubCategoryIds: ["yag__hayvansal-yaglar"],
    });

    const result = evaluateClientFoodRuleDecision(next, "client-mert", "Tereyağı yiyebilir miyim?");
    expect(result.decision).toBe("forbidden_food_rejection");
    expect(result.matchedSource).toBe("forbidden_food_items");
  });

  it("returns unknown when client form answers are missing", () => {
    const state = { ...createInitialState(), clientFormResponses: [] };
    const result = evaluateClientFoodRuleDecision(state, "client-mert", "Badem yiyebilir miyim?");

    expect(result.decision).toBe("unknown_food_requires_review");
    expect(result.reasons).toContain("food_rule_structured_rules_missing");
  });
});
