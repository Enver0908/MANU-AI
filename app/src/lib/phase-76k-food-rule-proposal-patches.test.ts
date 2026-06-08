import { describe, expect, it } from "vitest";
import {
  extractFoodRuleProposalPatches,
  foodRuleProposalSafetyFlags,
  hasFoodRuleProposalPatch,
} from "./phase-76k-food-rule-proposal-patches";

describe("phase 76k food rule proposal patches", () => {
  it("extracts forbidden dairy group from consumption ban phrasing", () => {
    const patches = extractFoodRuleProposalPatches("Mert artik sut urunleri tuketmemeli");
    expect(patches).toEqual([
      expect.objectContaining({
        fieldId: "forbidden_food_groups",
        value: "Sut urunleri",
        category: "food_rule",
      }),
    ]);
  });

  it("extracts equivalent exchange groups from substitution phrasing", () => {
    const patches = extractFoodRuleProposalPatches("Badem yerine findik ayni degisim grubunda kabul");
    expect(patches).toEqual([
      expect.objectContaining({
        fieldId: "equivalent_exchange_groups",
        operation: "merge_exchange_group",
        value: "yemis: badem|findik",
      }),
    ]);
    expect(patches.some((patch) => patch.fieldId === "allowed_food_items")).toBe(false);
  });

  it("extracts optional meal phrasing", () => {
    const patches = extractFoodRuleProposalPatches("Aksam ara ogun opsiyonel olabilir");
    expect(patches).toEqual([
      expect.objectContaining({
        fieldId: "optional_foods_or_meals",
        value: "Aksam Ara Ogun",
      }),
    ]);
    expect(patches).toHaveLength(1);
  });

  it("extracts gluten forbidden group from ban phrasing", () => {
    const patches = extractFoodRuleProposalPatches("Gluten iceren urunleri yasakla");
    expect(patches).toEqual([
      expect.objectContaining({
        fieldId: "forbidden_food_groups",
        value: "Gluten",
      }),
    ]);
    expect(patches.some((patch) => patch.fieldId === "ingredient_allergen_keywords")).toBe(false);
  });

  it("extracts ingredient keywords and allowed dairy group from acceptance phrasing", () => {
    const patches = extractFoodRuleProposalPatches("Laktoz, whey ve casein iceren urunleri sut urunu kabul et");
    expect(patches.map((patch) => `${patch.fieldId}:${patch.value}`)).toEqual([
      "ingredient_allergen_keywords:laktoz",
      "ingredient_allergen_keywords:whey",
      "ingredient_allergen_keywords:casein",
      "allowed_food_groups:Sut urunleri",
    ]);
  });

  it("adds food-rule safety flags for proposal review", () => {
    const patches = extractFoodRuleProposalPatches("Gluten iceren urunleri yasakla");
    expect(hasFoodRuleProposalPatch(patches)).toBe(true);
    expect(foodRuleProposalSafetyFlags(patches)).toEqual([
      "food_rule_clinical_review_recommended",
      "food_rule_production_approval_required",
    ]);
  });
});
