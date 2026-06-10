import rawCatalog from "./phase-77d-master-food-catalog-data.json";

export const PHASE_77D_MASTER_FOOD_CATALOG_VERSION = "phase-77d-master-food-catalog-v1";

export const PHASE_77D_CATALOG_SELECTION_FIELD_IDS = [
  "food_catalog_version",
  "food_catalog_source_sha256",
  "food_catalog_record_set_sha256",
  "food_catalog_forbidden_main_category_ids",
  "food_catalog_forbidden_sub_category_ids",
  "food_catalog_forbidden_food_ids",
] as const;

export type Phase77DFood = {
  id: string;
  name: string;
  sourceBlockIndex: number;
  sourceRowNumber: number;
};

export type Phase77DFoodSubcategory = {
  id: string;
  name: string;
  foods: Phase77DFood[];
};

export type Phase77DFoodMainCategory = {
  id: string;
  name: string;
  subcategories: Phase77DFoodSubcategory[];
};

export type Phase77DMasterFoodCatalogData = {
  metadata: {
    version: string;
    sourceWorkbook: string;
    sourceSheet: string;
    sourceWorkbookSha256: string;
    recordSetSha256: string;
    extractedAt: string;
    counts: {
      mainCategories: number;
      subcategories: number;
      foods: number;
    };
  };
  categories: Phase77DFoodMainCategory[];
};

export type Phase77DFoodCatalogSelection = {
  forbiddenMainCategoryIds: string[];
  forbiddenSubCategoryIds: string[];
  forbiddenFoodIds: string[];
};

export type Phase77DFoodCatalogExpansion = {
  selection: Phase77DFoodCatalogSelection;
  forbiddenMainCategoryNames: string[];
  forbiddenSubCategoryNames: string[];
  forbiddenGroupNames: string[];
  forbiddenFoodNames: string[];
  expandedSubCategoryIds: string[];
  expandedFoodIds: string[];
  warnings: string[];
};

export const PHASE_77D_MASTER_FOOD_CATALOG = rawCatalog as Phase77DMasterFoodCatalogData;

type CatalogIndexes = {
  mainById: Map<string, Phase77DFoodMainCategory>;
  subById: Map<string, { main: Phase77DFoodMainCategory; subcategory: Phase77DFoodSubcategory }>;
  foodById: Map<
    string,
    { main: Phase77DFoodMainCategory; subcategory: Phase77DFoodSubcategory; food: Phase77DFood }
  >;
};

function buildIndexes(catalog: Phase77DMasterFoodCatalogData): CatalogIndexes {
  const mainById = new Map<string, Phase77DFoodMainCategory>();
  const subById = new Map<string, { main: Phase77DFoodMainCategory; subcategory: Phase77DFoodSubcategory }>();
  const foodById = new Map<
    string,
    { main: Phase77DFoodMainCategory; subcategory: Phase77DFoodSubcategory; food: Phase77DFood }
  >();

  for (const main of catalog.categories) {
    mainById.set(main.id, main);
    for (const subcategory of main.subcategories) {
      subById.set(subcategory.id, { main, subcategory });
      for (const food of subcategory.foods) {
        foodById.set(food.id, { main, subcategory, food });
      }
    }
  }

  return { mainById, subById, foodById };
}

const DEFAULT_INDEXES = buildIndexes(PHASE_77D_MASTER_FOOD_CATALOG);

export function getPhase77DMasterFoodCatalog() {
  return PHASE_77D_MASTER_FOOD_CATALOG;
}

export function getPhase77DMainCategoryById(id: string) {
  return DEFAULT_INDEXES.mainById.get(id) || null;
}

export function getPhase77DSubCategoryById(id: string) {
  return DEFAULT_INDEXES.subById.get(id) || null;
}

export function getPhase77DFoodById(id: string) {
  return DEFAULT_INDEXES.foodById.get(id) || null;
}

export function findPhase77DFoodsByName(name: string, catalog = PHASE_77D_MASTER_FOOD_CATALOG) {
  const needle = normalizeName(name);
  if (!needle) return [];
  const matches: Array<{
    main: Phase77DFoodMainCategory;
    subcategory: Phase77DFoodSubcategory;
    food: Phase77DFood;
  }> = [];

  for (const main of catalog.categories) {
    for (const subcategory of main.subcategories) {
      for (const food of subcategory.foods) {
        if (normalizeName(food.name) === needle) {
          matches.push({ main, subcategory, food });
        }
      }
    }
  }

  return matches;
}

export function createEmptyPhase77DFoodCatalogSelection(): Phase77DFoodCatalogSelection {
  return {
    forbiddenMainCategoryIds: [],
    forbiddenSubCategoryIds: [],
    forbiddenFoodIds: [],
  };
}

function arrayifyIds(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function pushUniqueName(values: string[], value: string) {
  const normalized = normalizeName(value);
  if (values.some((item) => normalizeName(item) === normalized)) return;
  values.push(value);
}

export function normalizePhase77DFoodCatalogSelection(
  selection: Partial<Phase77DFoodCatalogSelection> | null | undefined,
): Phase77DFoodCatalogSelection {
  if (!selection) return createEmptyPhase77DFoodCatalogSelection();
  return {
    forbiddenMainCategoryIds: dedupe(arrayifyIds(selection.forbiddenMainCategoryIds)),
    forbiddenSubCategoryIds: dedupe(arrayifyIds(selection.forbiddenSubCategoryIds)),
    forbiddenFoodIds: dedupe(arrayifyIds(selection.forbiddenFoodIds)),
  };
}

export function buildPhase77DFoodCatalogSelectionFromAnswers(
  answers: Record<string, unknown> | null | undefined,
): Phase77DFoodCatalogSelection {
  if (!answers) return createEmptyPhase77DFoodCatalogSelection();
  return normalizePhase77DFoodCatalogSelection({
    forbiddenMainCategoryIds: arrayifyIds(answers.food_catalog_forbidden_main_category_ids),
    forbiddenSubCategoryIds: arrayifyIds(answers.food_catalog_forbidden_sub_category_ids),
    forbiddenFoodIds: arrayifyIds(answers.food_catalog_forbidden_food_ids),
  });
}

export function expandPhase77DForbiddenSelection(
  selection: Partial<Phase77DFoodCatalogSelection> | null | undefined,
  catalog: Phase77DMasterFoodCatalogData = PHASE_77D_MASTER_FOOD_CATALOG,
): Phase77DFoodCatalogExpansion {
  const normalized = normalizePhase77DFoodCatalogSelection(selection);
  const indexes = catalog === PHASE_77D_MASTER_FOOD_CATALOG ? DEFAULT_INDEXES : buildIndexes(catalog);
  const warnings: string[] = [];
  const forbiddenMainCategoryNames: string[] = [];
  const forbiddenSubCategoryNames: string[] = [];
  const forbiddenFoodNames: string[] = [];
  const expandedSubCategoryIds: string[] = [];
  const expandedFoodIds: string[] = [];

  const addSubcategory = (subcategory: Phase77DFoodSubcategory) => {
    if (!expandedSubCategoryIds.includes(subcategory.id)) expandedSubCategoryIds.push(subcategory.id);
    pushUniqueName(forbiddenSubCategoryNames, subcategory.name);
    for (const food of subcategory.foods) {
      if (!expandedFoodIds.includes(food.id)) expandedFoodIds.push(food.id);
      pushUniqueName(forbiddenFoodNames, food.name);
    }
  };

  for (const mainId of normalized.forbiddenMainCategoryIds) {
    const main = indexes.mainById.get(mainId);
    if (!main) {
      warnings.push(`unknown_main_category:${mainId}`);
      continue;
    }
    pushUniqueName(forbiddenMainCategoryNames, main.name);
    for (const subcategory of main.subcategories) addSubcategory(subcategory);
  }

  for (const subcategoryId of normalized.forbiddenSubCategoryIds) {
    const entry = indexes.subById.get(subcategoryId);
    if (!entry) {
      warnings.push(`unknown_subcategory:${subcategoryId}`);
      continue;
    }
    addSubcategory(entry.subcategory);
  }

  for (const foodId of normalized.forbiddenFoodIds) {
    const entry = indexes.foodById.get(foodId);
    if (!entry) {
      warnings.push(`unknown_food:${foodId}`);
      continue;
    }
    if (!expandedFoodIds.includes(entry.food.id)) expandedFoodIds.push(entry.food.id);
    pushUniqueName(forbiddenFoodNames, entry.food.name);
  }

  return {
    selection: normalized,
    forbiddenMainCategoryNames,
    forbiddenSubCategoryNames,
    forbiddenGroupNames: [...forbiddenMainCategoryNames, ...forbiddenSubCategoryNames],
    forbiddenFoodNames,
    expandedSubCategoryIds,
    expandedFoodIds,
    warnings,
  };
}

export function removePhase77DExpandedForbiddenNames(values: string[], expandedNames: string[]) {
  const expanded = new Set(expandedNames.map(normalizeName));
  return values.filter((value) => !expanded.has(normalizeName(value)));
}

export function getPhase77DMasterFoodCatalogStats(catalog = PHASE_77D_MASTER_FOOD_CATALOG) {
  const foodNames = new Map<string, number>();
  const triples = new Set<string>();
  let subcategories = 0;
  let foods = 0;
  let duplicateTriples = 0;

  for (const main of catalog.categories) {
    subcategories += main.subcategories.length;
    for (const subcategory of main.subcategories) {
      foods += subcategory.foods.length;
      for (const food of subcategory.foods) {
        const foodName = normalizeName(food.name);
        foodNames.set(foodName, (foodNames.get(foodName) || 0) + 1);
        const triple = `${normalizeName(main.name)}|${normalizeName(subcategory.name)}|${foodName}`;
        if (triples.has(triple)) duplicateTriples += 1;
        triples.add(triple);
      }
    }
  }

  return {
    mainCategories: catalog.categories.length,
    subcategories,
    foods,
    duplicateTriples,
    duplicateFoodNameCount: [...foodNames.values()].filter((count) => count > 1).length,
  };
}

export function validatePhase77DMasterFoodCatalog(catalog = PHASE_77D_MASTER_FOOD_CATALOG) {
  const errors: string[] = [];
  const stats = getPhase77DMasterFoodCatalogStats(catalog);

  if (catalog.metadata.version !== PHASE_77D_MASTER_FOOD_CATALOG_VERSION) {
    errors.push("catalog_version_mismatch");
  }
  if (stats.mainCategories !== catalog.metadata.counts.mainCategories) {
    errors.push("main_category_count_mismatch");
  }
  if (stats.subcategories !== catalog.metadata.counts.subcategories) {
    errors.push("subcategory_count_mismatch");
  }
  if (stats.foods !== catalog.metadata.counts.foods) {
    errors.push("food_count_mismatch");
  }
  if (stats.duplicateTriples > 0) {
    errors.push("duplicate_catalog_triples");
  }

  return {
    valid: errors.length === 0,
    errors,
    stats,
  };
}
