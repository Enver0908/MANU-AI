import { describe, expect, it } from "vitest";
import {
  expandPhase77DForbiddenSelection,
  findPhase77DFoodsByName,
  getPhase77DMainCategoryById,
  getPhase77DMasterFoodCatalog,
  getPhase77DMasterFoodCatalogStats,
  removePhase77DExpandedForbiddenNames,
  validatePhase77DMasterFoodCatalog,
} from "./phase-77d-master-food-catalog";

describe("phase 77d master food catalog", () => {
  it("loads the user-supplied Besin Veritabani hierarchy with stable counts", () => {
    const catalog = getPhase77DMasterFoodCatalog();
    const stats = getPhase77DMasterFoodCatalogStats();
    const validation = validatePhase77DMasterFoodCatalog();

    expect(catalog.metadata.sourceSheet).toBe("Besin Veritabani");
    expect(catalog.metadata.sourceWorkbookSha256).toBe(
      "db3af129bc9e814dbb5247e5a2fbcd49a0184fb0b6bc046b75de99f78a266c21",
    );
    expect(catalog.metadata.recordSetSha256).toBe(
      "6b9e53577dfcba8f9af2839f0bb3017163f756b5880582ac2e18f6d274042e9f",
    );
    expect(stats).toMatchObject({
      mainCategories: 12,
      subcategories: 113,
      foods: 518,
      duplicateTriples: 0,
      duplicateFoodNameCount: 18,
    });
    expect(validation.valid).toBe(true);
  });

  it("expands a forbidden main category to every subcategory and food under it", () => {
    const expansion = expandPhase77DForbiddenSelection({
      forbiddenMainCategoryIds: ["sut-urunleri"],
      forbiddenSubCategoryIds: [],
      forbiddenFoodIds: [],
    });

    expect(expansion.forbiddenMainCategoryNames).toEqual(["Süt Ürünleri"]);
    expect(expansion.forbiddenSubCategoryNames).toContain("Süt");
    expect(expansion.forbiddenFoodNames).toContain("Tam yağlı süt");
    expect(expansion.forbiddenFoodNames).toContain("Yoğurt");
    expect(expansion.forbiddenFoodNames).toHaveLength(38);
    expect(expansion.warnings).toEqual([]);
  });

  it("expands a forbidden subcategory without forbidding the whole parent category", () => {
    const expansion = expandPhase77DForbiddenSelection({
      forbiddenMainCategoryIds: [],
      forbiddenSubCategoryIds: ["yag__hayvansal-yaglar"],
      forbiddenFoodIds: [],
    });

    expect(expansion.forbiddenMainCategoryNames).toEqual([]);
    expect(expansion.forbiddenSubCategoryNames).toEqual(["Hayvansal Yağlar"]);
    expect(expansion.forbiddenFoodNames).toEqual([
      "Tereyağı",
      "Ghee (sadeyağ)",
      "Kuyruk yağı",
      "İç yağ (don yağı / lard)",
    ]);
  });

  it("keeps an individual food selection scoped to that food record", () => {
    const expansion = expandPhase77DForbiddenSelection({
      forbiddenMainCategoryIds: [],
      forbiddenSubCategoryIds: [],
      forbiddenFoodIds: ["sut-urunleri__sut__tam-yagli-sut"],
    });

    expect(expansion.forbiddenMainCategoryNames).toEqual([]);
    expect(expansion.forbiddenSubCategoryNames).toEqual([]);
    expect(expansion.forbiddenFoodNames).toEqual(["Tam yağlı süt"]);
    expect(expansion.expandedFoodIds).toEqual(["sut-urunleri__sut__tam-yagli-sut"]);
  });

  it("supports exact normalized lookup while preserving duplicate food identities", () => {
    const duplicateName = "Tereya\u011f\u0131";
    const main = getPhase77DMainCategoryById("yag");
    const matches = findPhase77DFoodsByName(duplicateName);

    expect(main?.name).toBe("Ya\u011f");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches.map((match) => match.food.id)).toContain("yag__hayvansal-yaglar__tereyagi");
    expect(matches.map((match) => match.main.id)).toContain("sut-urunleri");
    expect(matches.every((match) => match.food.name === duplicateName)).toBe(true);
  });

  it("deduplicates overlapping category, subcategory, and food selections", () => {
    const expansion = expandPhase77DForbiddenSelection({
      forbiddenMainCategoryIds: ["yag"],
      forbiddenSubCategoryIds: ["yag__hayvansal-yaglar"],
      forbiddenFoodIds: ["yag__hayvansal-yaglar__tereyagi"],
    });

    expect(expansion.forbiddenFoodNames.filter((food) => food === "Tereyağı")).toHaveLength(1);
    expect(expansion.forbiddenFoodNames).toHaveLength(29);
  });

  it("can subtract catalog-expanded names from manual forbidden fields on load", () => {
    const expansion = expandPhase77DForbiddenSelection({
      forbiddenMainCategoryIds: ["sut-urunleri"],
      forbiddenSubCategoryIds: [],
      forbiddenFoodIds: [],
    });

    expect(
      removePhase77DExpandedForbiddenNames(["Tam yağlı süt", "Manual özel yasak"], expansion.forbiddenFoodNames),
    ).toEqual(["Manual özel yasak"]);
  });
});
