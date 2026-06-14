export const FOOD_UNDERSTANDING_V3_VERSION = "food-understanding-v3-v0.1.0";

const BRAND_PACKAGED_PATTERN =
  /\b(?:ulker|ülker|eti|nutella|oreo|lays|doritos|milka|ferrero|cappy|marka|brand|ambalaj|paketli|packaged|gofret|biskuvi|bisküvi)\b/i;

const MIXED_DISH_PATTERN =
  /\b(?:kisir|kısır|menemen|dolma|sarma|corba|çorba|salata|karisik|karışık|stew|casserole|bowl|pilav tabagi|pizza|lahmacun|kofte|köfte)\b/i;

export function normalizeFoodPhrase(value = "") {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00e7/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateFoodAliasEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!entry.id || !entry.alias || !entry.foodId) return false;
  if (!entry.tenantId) return false;
  if (entry.matchType !== "exact") return false;
  return true;
}

export function buildFoodAliasDictionaryManifest({ version, checksum, entries = [] }) {
  const validEntries = entries.filter(validateFoodAliasEntry);
  return {
    version: version || FOOD_UNDERSTANDING_V3_VERSION,
    checksum: checksum || null,
    entryCount: validEntries.length,
    entries: validEntries,
  };
}

export function resolveFoodAliasMatches(phrase, { globalAliases = [], tenantApprovedAliases = [] } = {}) {
  const normalizedPhrase = normalizeFoodPhrase(phrase);
  if (!normalizedPhrase) return [];

  const matches = [];
  const seenFoodIds = new Set();

  for (const entry of [...tenantApprovedAliases, ...globalAliases]) {
    if (!validateFoodAliasEntry(entry)) continue;
    if (!aliasPhraseMatches(normalizedPhrase, entry.alias)) continue;
    if (seenFoodIds.has(entry.foodId)) continue;
    seenFoodIds.add(entry.foodId);

    const tenantScoped = entry.tenantId !== "global";
    const autopilotEligible = tenantScoped || (entry.qaApproved === true && entry.autopilotEligible === true);

    matches.push({
      foodId: entry.foodId,
      foodName: entry.foodName || entry.alias,
      confidence: autopilotEligible ? "exact" : "keyword",
      path: entry.path || "alias_dictionary_v3",
      aliasId: entry.id,
      aliasScope: tenantScoped ? "tenant_approved" : "global",
      autopilotEligible,
    });
  }

  return matches;
}

export function filterAutopilotEligibleCatalogMatches(matches = []) {
  return matches.filter((match) => match.confidence === "exact" && match.autopilotEligible !== false);
}

export function isBrandOrPackagedProductQuery(message = "") {
  return BRAND_PACKAGED_PATTERN.test(normalizeFoodPhrase(message));
}

export function isMixedDishQuery(message = "") {
  return MIXED_DISH_PATTERN.test(normalizeFoodPhrase(message));
}

export function findMenuRecipeForPhrase(menu, phrase) {
  if (!menu || !phrase) return null;
  const normalizedPhrase = normalizeFoodPhrase(phrase);

  for (const slot of menu.mealSlots || []) {
    for (const item of [...(slot.items || []), ...(slot.alternatives || [])]) {
      const candidates = [
        item.freeText,
        item.label,
        item.catalogMatch?.catalogFoodName,
        item.recipe?.title,
      ]
        .map((value) => normalizeFoodPhrase(value || ""))
        .filter(Boolean);

      const phraseMatches = candidates.some(
        (candidate) => candidate === normalizedPhrase || candidate.includes(normalizedPhrase) || normalizedPhrase.includes(candidate),
      );
      if (!phraseMatches) continue;
      if (item.recipe?.ingredients?.length) {
        return {
          title: item.recipe.title,
          ingredients: [...item.recipe.ingredients],
          menuItemId: item.id,
        };
      }
      return null;
    }
  }

  return null;
}

export function evaluateMixedDishUnderstanding({ message, menu, foodPhrase = null }) {
  if (!isMixedDishQuery(message)) {
    return { applicable: false, decision: null, reasonCodes: [] };
  }

  const phrase = normalizeFoodPhrase(foodPhrase || extractSimpleFoodPhrase(message));
  const recipe = findMenuRecipeForPhrase(menu, phrase);
  if (!recipe) {
    return {
      applicable: true,
      decision: "needs_review",
      reasonCodes: ["food_understanding_v3_mixed_dish_no_recipe"],
      evidenceManifest: { foodPhrase: phrase, recipeFound: false },
    };
  }

  return {
    applicable: true,
    decision: null,
    reasonCodes: [],
    evidenceManifest: {
      foodPhrase: phrase,
      recipeFound: true,
      recipeTitle: recipe.title,
      ingredientCount: recipe.ingredients.length,
      menuItemId: recipe.menuItemId,
    },
  };
}

function aliasPhraseMatches(normalizedPhrase, alias) {
  const normalizedAlias = normalizeFoodPhrase(alias);
  if (!normalizedAlias) return false;
  return normalizedPhrase === normalizedAlias;
}

function extractSimpleFoodPhrase(message) {
  const normalized = normalizeFoodPhrase(message);
  const match = normalized.match(/^(.+?)\s+(?:yiyebilir miyim|yerim mi|yiyebilir mi)(?:\?|$)/i);
  return match?.[1] || normalized;
}
