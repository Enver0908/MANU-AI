import {
  PHASE_76D_DIET_TYPE_OPTIONS,
  PHASE_76D_FOOD_GROUP_OPTIONS,
  PHASE_76D_INGREDIENT_KEYWORD_OPTIONS,
  PHASE_76D_SKIP_TOLERANCE_OPTIONS,
} from "./phase-76d-food-rule-fields";
import type { ClientUpdateProposalPatch } from "./types";

export const PHASE_76K_FOOD_RULE_PROPOSAL_PATCH_VERSION = "phase-76k-food-rule-proposal-v1";

export const PHASE_76K_FOOD_RULE_MULTISELECT_FIELD_IDS = new Set([
  "forbidden_food_groups",
  "allowed_food_groups",
  "ingredient_allergen_keywords",
]);

export const PHASE_76K_FOOD_RULE_FIELD_IDS = new Set([
  "forbidden_food_items",
  "forbidden_food_groups",
  "allowed_food_items",
  "allowed_food_groups",
  "diet_type_rules",
  "equivalent_exchange_groups",
  "mandatory_foods_or_meals",
  "optional_foods_or_meals",
  "skip_tolerance_rules",
  "portion_boundaries",
  "ingredient_allergen_keywords",
]);

const FOOD_GROUP_ALIASES: Array<{ needles: string[]; group: (typeof PHASE_76D_FOOD_GROUP_OPTIONS)[number] }> = [
  { needles: ["sut urunleri", "sut urunu", "dairy"], group: "Sut urunleri" },
  { needles: ["gluten", "gluten iceren"], group: "Gluten" },
  { needles: ["kabuklu yemis"], group: "Kabuklu yemis" },
  { needles: ["kirmizi et"], group: "Kirmizi et" },
  { needles: ["islenmis seker"], group: "Islenmis seker" },
  { needles: ["yumurta grubu"], group: "Yumurta" },
  { needles: ["balik grubu"], group: "Balik" },
  { needles: ["soya grubu"], group: "Soya" },
  { needles: ["laktoz grubu"], group: "Laktoz" },
];

const INGREDIENT_KEYWORD_ALIASES: Array<{ needles: string[]; keyword: (typeof PHASE_76D_INGREDIENT_KEYWORD_OPTIONS)[number] }> =
  PHASE_76D_INGREDIENT_KEYWORD_OPTIONS.map((keyword) => ({
    needles: [normalizeText(keyword)],
    keyword,
  }));

const DIET_TYPE_ALIASES: Array<{ needles: string[]; dietType: (typeof PHASE_76D_DIET_TYPE_OPTIONS)[number] }> = [
  { needles: ["vegan"], dietType: "Vegan" },
  { needles: ["vejetaryen"], dietType: "Vejetaryen" },
  { needles: ["akdeniz"], dietType: "Akdeniz" },
  { needles: ["glutensiz"], dietType: "Glutensiz" },
  { needles: ["dusuk karbonhidrat", "low carb"], dietType: "Dusuk karbonhidrat" },
  { needles: ["diyabet dostu"], dietType: "Diyabet dostu" },
  { needles: ["dusuk fodmap", "fodmap"], dietType: "Dusuk FODMAP" },
  { needles: ["genel denge"], dietType: "Genel denge" },
];

const SKIP_TOLERANCE_ALIASES: Array<{ needles: string[]; rule: (typeof PHASE_76D_SKIP_TOLERANCE_OPTIONS)[number] }> = [
  { needles: ["atlanamaz", "zorunlu"], rule: "Atlanamaz" },
  { needles: ["haftada 1", "haftalik esnek"], rule: "Haftada 1 kez esnek" },
  { needles: ["bugunluk esnek", "bugun esnek"], rule: "Bugunluk esnek" },
  { needles: ["diyetisyen onayi"], rule: "Diyetisyen onayi gerekli" },
];

export function extractFoodRuleProposalPatches(clause: string): ClientUpdateProposalPatch[] {
  const normalized = normalizeText(clause);
  if (!normalized) return [];

  const patches: ClientUpdateProposalPatch[] = [];
  const exchangePatches = extractExchangeGroupPatches(clause, normalized);
  const optionalPatches = extractOptionalMealPatches(clause, normalized);
  const forbiddenPatches = extractForbiddenPatches(clause, normalized);

  patches.push(...exchangePatches);
  patches.push(...optionalPatches);
  patches.push(...extractSkipTolerancePatches(normalized));
  patches.push(...extractDietTypePatches(normalized));
  patches.push(...forbiddenPatches);

  if (forbiddenPatches.length === 0) {
    patches.push(...extractIngredientKeywordPatches(clause, normalized));
    if (exchangePatches.length === 0 && optionalPatches.length === 0) {
      patches.push(...extractAllowedPatches(clause, normalized));
    }
  }

  return dedupeFoodRulePatches(patches);
}

export function hasFoodRuleProposalPatch(patches: ClientUpdateProposalPatch[]) {
  return patches.some((patch) => patch.category === "food_rule" || PHASE_76K_FOOD_RULE_FIELD_IDS.has(patch.fieldId));
}

export function foodRuleProposalSafetyFlags(patches: ClientUpdateProposalPatch[]) {
  if (!hasFoodRuleProposalPatch(patches)) return [];
  return ["food_rule_clinical_review_recommended", "food_rule_production_approval_required"];
}

function extractForbiddenPatches(clause: string, normalized: string) {
  if (!hasAny(normalized, ["yasak", "yemesin", "yememeli", "tuketmemeli", "tuketmesin", "olmasin", "listeden cikar"])) {
    return [];
  }

  const group = matchFoodGroup(normalized);
  if (group) {
    return [foodRulePatch("forbidden_food_groups", "Yasak besin grubu", group)];
  }

  const item = extractForbiddenItem(clause, normalized);
  return item ? [foodRulePatch("forbidden_food_items", "Yasak besin", item)] : [];
}

function extractAllowedPatches(clause: string, normalized: string) {
  if (!hasAny(normalized, ["serbest", "izinli", "uygun", "kabul", "olabilir"])) return [];

  const group = matchFoodGroup(normalized);
  if (group) {
    return [foodRulePatch("allowed_food_groups", "Izinli besin grubu", group)];
  }

  const item = extractAllowedItem(clause, normalized);
  return item ? [foodRulePatch("allowed_food_items", "Izinli besin", item)] : [];
}

function extractIngredientKeywordPatches(clause: string, normalized: string) {
  if (!normalized.includes("iceren")) return [];

  const beforeMarker = clause.split(/içeren|iceren/i)[0] || "";
  const tokens = beforeMarker
    .replace(/\burunleri\b/gi, "")
    .split(/[,;]|\s+ve\s+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  const patches: ClientUpdateProposalPatch[] = [];
  for (const token of tokens) {
    const keyword = matchIngredientKeyword(normalizeText(token));
    if (keyword) {
      patches.push(foodRulePatch("ingredient_allergen_keywords", "Alerjen anahtar kelime", keyword));
    }
  }
  return patches;
}

function extractExchangeGroupPatches(clause: string, normalized: string) {
  if (!hasAny(normalized, ["degisim", "esdeger", "kabul"]) || !normalized.includes("yerine")) return [];

  const match = clause.match(/(.+?)\s+yerine\s+(.+?)(?:\s+.*)?$/i);
  if (!match) return [];

  const fromItem = cleanFoodTerm(match[1]);
  const toItem = cleanFoodTerm(
    match[2].replace(/\b(ayni|esdeger|degisim|grubunda|grubu|kabul|olabilir|serbest)\b/gi, "").split(/[,;.]/)[0] || "",
  );
  if (!fromItem || !toItem) return [];

  const groupId = inferExchangeGroupId(fromItem, toItem);
  const normalizedItems = [fromItem, toItem].map((item) => normalizeText(item)).filter(Boolean);
  return [
    foodRulePatch(
      "equivalent_exchange_groups",
      "Esdeger degisim grubu",
      `${groupId}: ${normalizedItems.join("|")}`,
      "merge_exchange_group",
    ),
  ];
}

function extractOptionalMealPatches(_clause: string, normalized: string) {
  if (!normalized.includes("opsiyonel")) return [];

  const meal = normalized
    .replace(/\bopsiyonel\b/g, "")
    .replace(/\bolabilir\b/g, "")
    .replace(/\bartik\b/g, "")
    .trim();
  if (!meal || meal.length < 3) return [];

  return [foodRulePatch("optional_foods_or_meals", "Opsiyonel ogun/besin", formatMealLabel(meal))];
}

function extractSkipTolerancePatches(normalized: string) {
  for (const alias of SKIP_TOLERANCE_ALIASES) {
    if (alias.needles.some((needle) => normalized.includes(needle))) {
      return [foodRulePatch("skip_tolerance_rules", "Atlama toleransi", alias.rule, "set_value")];
    }
  }
  return [];
}

function extractDietTypePatches(normalized: string) {
  for (const alias of DIET_TYPE_ALIASES) {
    if (alias.needles.some((needle) => normalized.includes(needle))) {
      return [foodRulePatch("diet_type_rules", "Diyet tipi", alias.dietType, "set_value")];
    }
  }
  return [];
}

function extractForbiddenItem(clause: string, normalized: string) {
  const marker = /(yemesin|yememeli|yasakla?|tuketmemeli|tuketmesin|olmasin|listeden cikar)/i;
  const markerMatch = clause.match(marker);
  if (!markerMatch || markerMatch.index === undefined) return "";

  const before = clause.slice(0, markerMatch.index);
  const after = clause.slice(markerMatch.index + markerMatch[0].length);
  const raw = cleanFoodTerm(before) || cleanFoodTerm(after);
  if (!raw) return "";

  if (matchFoodGroup(normalizeText(raw))) return "";
  return raw;
}

function extractAllowedItem(clause: string, normalized: string) {
  const marker = /(serbest|izinli|uygun|kabul|olabilir)/i;
  const markerMatch = clause.match(marker);
  if (!markerMatch || markerMatch.index === undefined) return "";

  const before = clause.slice(0, markerMatch.index);
  const raw = cleanFoodTerm(before) || cleanFoodTerm(clause);
  if (!raw || matchFoodGroup(normalizeText(raw))) return "";
  if (hasAny(normalized, ["yasak", "tuketmemeli", "yemesin"])) return "";
  return raw;
}

function matchFoodGroup(normalized: string) {
  for (const alias of FOOD_GROUP_ALIASES) {
    if (alias.needles.some((needle) => normalized.includes(needle))) {
      return alias.group;
    }
  }
  return null;
}

function matchIngredientKeyword(normalized: string) {
  for (const alias of INGREDIENT_KEYWORD_ALIASES) {
    if (alias.needles.some((needle) => normalized === needle || normalized.includes(needle))) {
      return alias.keyword;
    }
  }
  return null;
}

function inferExchangeGroupId(fromItem: string, toItem: string) {
  const combined = normalizeText(`${fromItem} ${toItem}`);
  if (hasAny(combined, ["badem", "findik", "ceviz", "fistik", "yemis"])) return "yemis";
  if (hasAny(combined, ["sut", "peynir", "yogurt"])) return "sut";
  return "degisim";
}

function formatMealLabel(value: string) {
  return value
    .split(/\s+/)
    .map((word) => (word ? word[0].toLocaleUpperCase("tr-TR") + word.slice(1) : word))
    .join(" ")
    .trim();
}

function foodRulePatch(
  fieldId: string,
  label: string,
  value: string,
  operation: ClientUpdateProposalPatch["operation"] = "append_unique",
): ClientUpdateProposalPatch {
  return {
    target: "client_form_answer",
    fieldId,
    label,
    operation,
    value,
    category: "food_rule",
    editable: true,
    impactLabel: "Updates structured food-rule fields after dietitian approval.",
  };
}

function dedupeFoodRulePatches(patches: ClientUpdateProposalPatch[]) {
  return [...new Map(patches.map((patch) => [`${patch.fieldId}:${normalizeText(patch.value)}:${patch.operation}`, patch])).values()];
}

function cleanFoodTerm(value: string) {
  return value
    .replace(/["'`]/g, "")
    .replace(/\b(mert|danisan|artik|bu|icin|urunleri|urun|tuket)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function normalizeText(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
