import { describe, expect, it } from "vitest";
import { saveClientFormResponseInState } from "./client-forms";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { createInitialState } from "./seed-data";
import { evaluateClientAutopilotQualification } from "./phase-70-form-hardening";
import {
  buildStructuredFoodRuleFieldManifest,
  buildStructuredFoodRuleManifest,
  evaluateStructuredFoodRuleCompleteness,
  parseEquivalentExchangeGroups,
  syncClientRecordFromFoodRuleAnswers,
} from "./phase-76d-food-rule-model";
import { PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS } from "./phase-76d-food-rule-fields";

describe("phase 76d structured food rule model", () => {
  it("parses equivalent exchange groups deterministically", () => {
    const groups = parseEquivalentExchangeGroups("nut_swap: almond|walnut|hazelnut; dairy_alt: lor|labne");

    expect(groups).toEqual([
      { groupId: "nut_swap", items: ["almond", "walnut", "hazelnut"] },
      { groupId: "dairy_alt", items: ["lor", "labne"] },
    ]);
  });

  it("builds structured manifest from seeded answers", () => {
    const manifest = buildStructuredFoodRuleManifest(buildPhase70QualifiedClientAnswers());

    expect(manifest.forbiddenFoodItems).toContain("peanut");
    expect(manifest.equivalentExchangeGroups).toHaveLength(2);
    expect(manifest.uncertaintyPolicy).toBe("Emin degilse yellow");
    expect(manifest.populatedFieldIds.length).toBe(PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS.length);
  });

  it("fails closed when structured food rule fields are incomplete", () => {
    const result = evaluateStructuredFoodRuleCompleteness({
      ...buildPhase70QualifiedClientAnswers(),
      forbidden_food_items: "",
      equivalent_exchange_groups: "invalid-no-colon",
    });

    expect(result.complete).toBe(false);
    expect(result.missing).toContain("structured_food_rule_missing_forbidden_food_items");
    expect(result.missing).toContain("structured_food_rule_invalid_equivalent_exchange_groups");
  });

  it("syncs allergies and restricted foods onto client record on form save", () => {
    const state = createInitialState();
    const schema = state.clientFormSchemas.find((item) => item.status === "published");
    const next = saveClientFormResponseInState(state, "client-mert", schema?.id || "", buildPhase70QualifiedClientAnswers());
    const client = next.clients.find((item) => item.id === "client-mert");

    expect(client?.allergies).toEqual(expect.arrayContaining(["peanut", "peanut butter"]));
    expect(client?.restrictedFoods).toEqual(expect.arrayContaining(["Kabuklu yemis"]));
  });

  it("keeps seeded autopilot client qualified with structured food rules", () => {
    const state = createInitialState();
    const result = evaluateClientAutopilotQualification(state, "client-mert");

    expect(result.status).toBe("qualified");
    expect(result.missing).toEqual([]);
  });

  it("exposes field-level structured food rule manifest segments", () => {
    const manifest = buildStructuredFoodRuleFieldManifest(buildPhase70QualifiedClientAnswers());
    const exchange = manifest.find((entry) => entry.fieldId === "equivalent_exchange_groups");

    expect(exchange?.hasValue).toBe(true);
    expect(exchange?.segmentCount).toBe(2);
  });

  it("merges duplicate allergy tokens when syncing client record", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert");
    const synced = syncClientRecordFromFoodRuleAnswers(client!, {
      allergies: "peanut",
      forbidden_food_items: "peanut, peanut butter",
      forbidden_food_groups: ["Kabuklu yemis"],
      restricted_foods_medical: "peanut",
    });

    expect(synced.allergies.filter((item) => item.toLowerCase() === "peanut")).toHaveLength(1);
    expect(synced.restrictedFoods).toEqual(expect.arrayContaining(["Kabuklu yemis"]));
  });
});
