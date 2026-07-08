import {
  getPhase77DFoodById,
  getPhase77DMainCategoryById,
  getPhase77DSubCategoryById,
  PHASE_77D_MASTER_FOOD_CATALOG,
} from "./phase-77d-master-food-catalog";
import type {
  ClientFoodRuleProfileV2Conflict,
  ClientFoodRuleProfileV2ConflictCode,
} from "./phase-77e-client-food-rule-profile";
import type { ClientFoodRuleProfileV2Record } from "./types";

export type CatalogSelectionSide = "none" | "allowed" | "forbidden";

export type CatalogSelectionTarget =
  | { level: "main"; id: string }
  | { level: "sub"; id: string; mainId: string }
  | { level: "food"; id: string; mainId: string; subId: string };

export type CatalogSelectionProfile = Pick<
  ClientFoodRuleProfileV2Record,
  | "allowedCatalogMainCategoryIds"
  | "allowedCatalogSubCategoryIds"
  | "allowedCatalogFoodIds"
  | "forbiddenCatalogMainCategoryIds"
  | "forbiddenCatalogSubCategoryIds"
  | "forbiddenCatalogFoodIds"
>;

const HARD_CONFLICT_CODES = new Set<ClientFoodRuleProfileV2ConflictCode>([
  "food_allowed_and_forbidden",
  "group_allowed_and_forbidden",
]);

export function isHardFoodRuleConflict(code: ClientFoodRuleProfileV2ConflictCode) {
  return HARD_CONFLICT_CODES.has(code);
}

export function hasHardFoodRuleConflicts(conflicts: ClientFoodRuleProfileV2Conflict[]) {
  return conflicts.some((conflict) => isHardFoodRuleConflict(conflict.code));
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function without(values: string[], remove: string[]) {
  const blocked = new Set(remove);
  return values.filter((value) => !blocked.has(value));
}

function collectSubIdsForMain(mainId: string) {
  const main = getPhase77DMainCategoryById(mainId);
  return main?.subcategories.map((item) => item.id) || [];
}

function collectFoodIdsForMain(mainId: string) {
  const main = getPhase77DMainCategoryById(mainId);
  if (!main) return [];
  return main.subcategories.flatMap((subcategory) => subcategory.foods.map((food) => food.id));
}

function collectFoodIdsForSub(subId: string) {
  const entry = getPhase77DSubCategoryById(subId);
  return entry?.subcategory.foods.map((food) => food.id) || [];
}

export function resolveCatalogMainSide(profile: CatalogSelectionProfile, mainId: string): CatalogSelectionSide {
  if (profile.allowedCatalogMainCategoryIds.includes(mainId)) return "allowed";
  if (profile.forbiddenCatalogMainCategoryIds.includes(mainId)) return "forbidden";
  return "none";
}

export function resolveCatalogSubSide(profile: CatalogSelectionProfile, subId: string, mainId: string): CatalogSelectionSide {
  const explicitAllowed = profile.allowedCatalogSubCategoryIds.includes(subId);
  const explicitForbidden = profile.forbiddenCatalogSubCategoryIds.includes(subId);
  if (explicitAllowed) return "allowed";
  if (explicitForbidden) return "forbidden";
  return resolveCatalogMainSide(profile, mainId);
}

export function resolveCatalogFoodSide(profile: CatalogSelectionProfile, foodId: string): CatalogSelectionSide {
  if (profile.allowedCatalogFoodIds.includes(foodId)) return "allowed";
  if (profile.forbiddenCatalogFoodIds.includes(foodId)) return "forbidden";

  const located = getPhase77DFoodById(foodId);
  if (!located) return "none";

  const subSide = resolveCatalogSubSide(profile, located.subcategory.id, located.main.id);
  if (subSide !== "none") return subSide;
  return resolveCatalogMainSide(profile, located.main.id);
}

export function applyCatalogSelection(
  profile: CatalogSelectionProfile,
  target: CatalogSelectionTarget,
  side: CatalogSelectionSide,
): CatalogSelectionProfile {
  if (target.level === "main") {
    return applyMainSelection(profile, target.id, side);
  }
  if (target.level === "sub") {
    return applySubSelection(profile, target.id, target.mainId, side);
  }
  return applyFoodSelection(profile, target.id, side);
}

function applyMainSelection(profile: CatalogSelectionProfile, mainId: string, side: CatalogSelectionSide): CatalogSelectionProfile {
  const subIds = collectSubIdsForMain(mainId);
  const foodIds = collectFoodIdsForMain(mainId);

  if (side === "allowed") {
    return {
      ...profile,
      allowedCatalogMainCategoryIds: dedupe([...profile.allowedCatalogMainCategoryIds, mainId]),
      forbiddenCatalogMainCategoryIds: profile.forbiddenCatalogMainCategoryIds.filter((item) => item !== mainId),
      forbiddenCatalogSubCategoryIds: without(profile.forbiddenCatalogSubCategoryIds, subIds),
      forbiddenCatalogFoodIds: without(profile.forbiddenCatalogFoodIds, foodIds),
    };
  }

  if (side === "forbidden") {
    return {
      ...profile,
      forbiddenCatalogMainCategoryIds: dedupe([...profile.forbiddenCatalogMainCategoryIds, mainId]),
      allowedCatalogMainCategoryIds: profile.allowedCatalogMainCategoryIds.filter((item) => item !== mainId),
      allowedCatalogSubCategoryIds: without(profile.allowedCatalogSubCategoryIds, subIds),
      allowedCatalogFoodIds: without(profile.allowedCatalogFoodIds, foodIds),
    };
  }

  return {
    ...profile,
    allowedCatalogMainCategoryIds: profile.allowedCatalogMainCategoryIds.filter((item) => item !== mainId),
    forbiddenCatalogMainCategoryIds: profile.forbiddenCatalogMainCategoryIds.filter((item) => item !== mainId),
  };
}

function applySubSelection(
  profile: CatalogSelectionProfile,
  subId: string,
  mainId: string,
  side: CatalogSelectionSide,
): CatalogSelectionProfile {
  const foodIds = collectFoodIdsForSub(subId);

  if (side === "allowed") {
    return {
      ...profile,
      allowedCatalogSubCategoryIds: dedupe([...profile.allowedCatalogSubCategoryIds, subId]),
      forbiddenCatalogSubCategoryIds: profile.forbiddenCatalogSubCategoryIds.filter((item) => item !== subId),
      forbiddenCatalogFoodIds: without(profile.forbiddenCatalogFoodIds, foodIds),
      forbiddenCatalogMainCategoryIds: profile.forbiddenCatalogMainCategoryIds.filter((item) => item !== mainId),
    };
  }

  if (side === "forbidden") {
    return {
      ...profile,
      forbiddenCatalogSubCategoryIds: dedupe([...profile.forbiddenCatalogSubCategoryIds, subId]),
      allowedCatalogSubCategoryIds: profile.allowedCatalogSubCategoryIds.filter((item) => item !== subId),
      allowedCatalogFoodIds: without(profile.allowedCatalogFoodIds, foodIds),
      allowedCatalogMainCategoryIds: profile.allowedCatalogMainCategoryIds.filter((item) => item !== mainId),
    };
  }

  return {
    ...profile,
    allowedCatalogSubCategoryIds: profile.allowedCatalogSubCategoryIds.filter((item) => item !== subId),
    forbiddenCatalogSubCategoryIds: profile.forbiddenCatalogSubCategoryIds.filter((item) => item !== subId),
  };
}

function applyFoodSelection(profile: CatalogSelectionProfile, foodId: string, side: CatalogSelectionSide): CatalogSelectionProfile {
  if (side === "allowed") {
    return {
      ...profile,
      allowedCatalogFoodIds: dedupe([...profile.allowedCatalogFoodIds, foodId]),
      forbiddenCatalogFoodIds: profile.forbiddenCatalogFoodIds.filter((item) => item !== foodId),
    };
  }

  if (side === "forbidden") {
    return {
      ...profile,
      forbiddenCatalogFoodIds: dedupe([...profile.forbiddenCatalogFoodIds, foodId]),
      allowedCatalogFoodIds: profile.allowedCatalogFoodIds.filter((item) => item !== foodId),
    };
  }

  return {
    ...profile,
    allowedCatalogFoodIds: profile.allowedCatalogFoodIds.filter((item) => item !== foodId),
    forbiddenCatalogFoodIds: profile.forbiddenCatalogFoodIds.filter((item) => item !== foodId),
  };
}

export function summarizeCatalogSelections(profile: CatalogSelectionProfile) {
  return {
    allowedFoods: profile.allowedCatalogFoodIds.length,
    forbiddenFoods: profile.forbiddenCatalogFoodIds.length,
    allowedSubs: profile.allowedCatalogSubCategoryIds.length,
    forbiddenSubs: profile.forbiddenCatalogSubCategoryIds.length,
    allowedMains: profile.allowedCatalogMainCategoryIds.length,
    forbiddenMains: profile.forbiddenCatalogMainCategoryIds.length,
    totalFoods: PHASE_77D_MASTER_FOOD_CATALOG.metadata.counts.foods,
  };
}

export function filterCatalogTree(query: string) {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) {
    return PHASE_77D_MASTER_FOOD_CATALOG.categories.map((main) => ({
      main,
      subcategories: main.subcategories.map((subcategory) => ({
        subcategory,
        foods: subcategory.foods,
      })),
    }));
  }

  const filtered: Array<{
    main: (typeof PHASE_77D_MASTER_FOOD_CATALOG.categories)[number];
    subcategories: Array<{
      subcategory: (typeof PHASE_77D_MASTER_FOOD_CATALOG.categories)[number]["subcategories"][number];
      foods: (typeof PHASE_77D_MASTER_FOOD_CATALOG.categories)[number]["subcategories"][number]["foods"];
    }>;
  }> = [];

  for (const main of PHASE_77D_MASTER_FOOD_CATALOG.categories) {
    const mainHaystack = main.name.toLocaleLowerCase("tr-TR");
    const subcategories = [];

    for (const subcategory of main.subcategories) {
      const subHaystack = `${main.name} ${subcategory.name}`.toLocaleLowerCase("tr-TR");
      const foods = subcategory.foods.filter((food) => {
        const foodHaystack = `${food.name} ${subcategory.name} ${main.name}`.toLocaleLowerCase("tr-TR");
        return foodHaystack.includes(needle) || subHaystack.includes(needle) || mainHaystack.includes(needle);
      });
      if (foods.length > 0 || subHaystack.includes(needle) || mainHaystack.includes(needle)) {
        subcategories.push({
          subcategory,
          foods: foods.length > 0 ? foods : subcategory.foods,
        });
      }
    }

    if (subcategories.length > 0) {
      filtered.push({ main, subcategories });
    }
  }

  return filtered;
}
