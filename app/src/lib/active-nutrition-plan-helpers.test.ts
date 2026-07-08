import { describe, expect, it } from "vitest";
import {
  applyCatalogSelection,
  filterCatalogTree,
  hasHardFoodRuleConflicts,
  resolveCatalogFoodSide,
  resolveCatalogMainSide,
  summarizeCatalogSelections,
} from "./active-nutrition-plan-helpers";
import type { ClientFoodRuleProfileV2Conflict } from "./phase-77e-client-food-rule-profile";

const emptyProfile = {
  allowedCatalogMainCategoryIds: [],
  allowedCatalogSubCategoryIds: [],
  allowedCatalogFoodIds: [],
  forbiddenCatalogMainCategoryIds: [],
  forbiddenCatalogSubCategoryIds: [],
  forbiddenCatalogFoodIds: [],
};

describe("active nutrition plan helpers", () => {
  it("applies mutually exclusive food selections", () => {
    const allowed = applyCatalogSelection(emptyProfile, {
      level: "food",
      id: "yumurta__tavuk-yumurtasi__tavuk-yumurtasi",
      mainId: "yumurta",
      subId: "yumurta__tavuk-yumurtasi",
    }, "allowed");
    expect(allowed.allowedCatalogFoodIds).toContain("yumurta__tavuk-yumurtasi__tavuk-yumurtasi");

    const forbidden = applyCatalogSelection(allowed, {
      level: "food",
      id: "yumurta__tavuk-yumurtasi__tavuk-yumurtasi",
      mainId: "yumurta",
      subId: "yumurta__tavuk-yumurtasi",
    }, "forbidden");
    expect(forbidden.forbiddenCatalogFoodIds).toContain("yumurta__tavuk-yumurtasi__tavuk-yumurtasi");
    expect(forbidden.allowedCatalogFoodIds).not.toContain("yumurta__tavuk-yumurtasi__tavuk-yumurtasi");
  });

  it("inherits parent category side for child foods", () => {
    const profile = applyCatalogSelection(emptyProfile, { level: "main", id: "sut-urunleri" }, "forbidden");
    expect(resolveCatalogMainSide(profile, "sut-urunleri")).toBe("forbidden");
    expect(resolveCatalogFoodSide(profile, "sut-urunleri__sut__tam-yagli-sut")).toBe("forbidden");
  });

  it("clears child allowed foods when a main category is forbidden", () => {
    const withAllowedFood = {
      ...emptyProfile,
      allowedCatalogFoodIds: ["sut-urunleri__sut__tam-yagli-sut"],
    };
    const profile = applyCatalogSelection(withAllowedFood, { level: "main", id: "sut-urunleri" }, "forbidden");
    expect(profile.forbiddenCatalogMainCategoryIds).toContain("sut-urunleri");
    expect(profile.allowedCatalogFoodIds).not.toContain("sut-urunleri__sut__tam-yagli-sut");
  });

  it("filters the catalog tree by query", () => {
    const filtered = filterCatalogTree("yumurta");
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.some((entry) =>
        entry.subcategories.some((sub) => sub.foods.some((food) => food.name.toLocaleLowerCase("tr-TR").includes("yumurta"))),
      ),
    ).toBe(true);
  });

  it("detects hard conflicts that block save", () => {
    const conflicts: ClientFoodRuleProfileV2Conflict[] = [
      { code: "food_allowed_and_forbidden", message: "blocked" },
      { code: "food_allowed_but_parent_category_forbidden", message: "warning" },
    ];
    expect(hasHardFoodRuleConflicts(conflicts)).toBe(true);
    expect(summarizeCatalogSelections({
      ...emptyProfile,
      allowedCatalogFoodIds: ["a"],
      forbiddenCatalogFoodIds: ["b", "c"],
    }).forbiddenFoods).toBe(2);
  });
});
