import { AppDomainError } from "./app-errors";
import { getActiveFormSchema, saveClientFormResponseInState } from "./client-forms";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { PHASE_76D_DIET_TYPE_OPTIONS, PHASE_76D_FOOD_GROUP_OPTIONS } from "./phase-76d-food-rule-fields";
import {
  buildFoodRuleAnswersFromDashboardState,
  loadFoodRuleDashboardState,
  type FoodRuleDashboardState,
} from "./phase-76j-food-rule-dashboard";
import {
  getPhase77DFoodById,
  PHASE_77D_MASTER_FOOD_CATALOG,
} from "./phase-77d-master-food-catalog";
import type { ClientFoodRuleProfileV2Record, ManuAppState, Phase77EFlexibilityLevel } from "./types";

export const PHASE_77E_CLIENT_FOOD_RULE_PROFILE_VERSION = "phase-77e-client-food-rule-profile-v2";

export const PHASE_77E_MEAL_KEYS = ["kahvalti", "ogle", "aksam", "ara_ogun"] as const;
export const PHASE_77E_GOAL_KEYS = ["kilo_verme", "kilo_alma", "koruma", "klinik", "performans"] as const;
export const PHASE_77E_FLEXIBILITY_LEVELS: Phase77EFlexibilityLevel[] = ["restricted", "moderate", "flexible"];

export type ClientFoodRuleProfileV2ConflictCode =
  | "food_allowed_but_group_forbidden"
  | "food_allowed_but_parent_category_forbidden"
  | "group_allowed_and_forbidden"
  | "food_allowed_and_forbidden"
  | "flexible_meal_with_forbidden_food"
  | "diet_type_conflict";

export type ClientFoodRuleProfileV2Conflict = {
  code: ClientFoodRuleProfileV2ConflictCode;
  message: string;
};

export type ClientFoodRuleProfileV2State = Omit<
  ClientFoodRuleProfileV2Record,
  "id" | "tenantId" | "clientId" | "dietitianId" | "version" | "status" | "createdAt" | "updatedAt" | "publishedAt" | "migratedFromLegacy76d" | "catalogVersion" | "catalogSourceSha256" | "catalogRecordSetSha256"
> & {
  conflicts: ClientFoodRuleProfileV2Conflict[];
};

export type SaveClientFoodRuleProfileV2Input = {
  revision: number;
  profile: Omit<ClientFoodRuleProfileV2State, "conflicts" | "revision">;
};

const FLEXIBILITY_RANK: Record<Phase77EFlexibilityLevel, number> = {
  restricted: 3,
  moderate: 2,
  flexible: 1,
};

const PERSONAL_FORM_FLEXIBILITY_MAP: Record<string, Phase77EFlexibilityLevel> = {
  kisitli: "restricted",
  "orta esnek": "moderate",
  esnek: "flexible",
};

const DIET_TYPE_GROUP_CONFLICTS: Record<string, string[]> = {
  Vegan: ["Sut urunleri", "Yumurta", "Balik", "Kirmizi et"],
  Vejetaryen: ["Balik", "Kirmizi et"],
  Glutensiz: ["Gluten"],
};

function dedupeIds(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLocaleLowerCase("tr-TR");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}

function normalizeFlexibilityMap(
  input: Record<string, Phase77EFlexibilityLevel> | null | undefined,
  allowedKeys: readonly string[],
  fallback: Phase77EFlexibilityLevel,
) {
  const next: Record<string, Phase77EFlexibilityLevel> = {};
  for (const key of allowedKeys) {
    const value = input?.[key];
    next[key] = PHASE_77E_FLEXIBILITY_LEVELS.includes(value as Phase77EFlexibilityLevel)
      ? (value as Phase77EFlexibilityLevel)
      : fallback;
  }
  return next;
}

export function mapPersonalFormFlexibilityToProfile(value: unknown): Phase77EFlexibilityLevel {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  return PERSONAL_FORM_FLEXIBILITY_MAP[normalized] || "moderate";
}

export function resolveClientFoodRuleProfileFlexibility(
  levels: Array<Phase77EFlexibilityLevel | null | undefined>,
  fallback: Phase77EFlexibilityLevel = "moderate",
): Phase77EFlexibilityLevel {
  const candidates = levels.filter((item): item is Phase77EFlexibilityLevel => Boolean(item));
  if (candidates.length === 0) return fallback;
  return candidates.reduce((current, next) =>
    FLEXIBILITY_RANK[next] > FLEXIBILITY_RANK[current] ? next : current,
  );
}

export function searchPhase77DCatalogFoods(query: string, limit = 20) {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return [];
  const matches: Array<{ id: string; name: string; path: string }> = [];
  for (const main of PHASE_77D_MASTER_FOOD_CATALOG.categories) {
    for (const subcategory of main.subcategories) {
      for (const food of subcategory.foods) {
        const haystack = `${food.name} ${subcategory.name} ${main.name}`.toLocaleLowerCase("tr-TR");
        if (!haystack.includes(needle)) continue;
        matches.push({
          id: food.id,
          name: food.name,
          path: `${main.name} / ${subcategory.name}`,
        });
        if (matches.length >= limit) return matches;
      }
    }
  }
  return matches;
}

export function detectClientFoodRuleProfileConflicts(
  profile: Pick<
    ClientFoodRuleProfileV2Record,
    | "allowedCatalogFoodIds"
    | "forbiddenCatalogFoodIds"
    | "allowedFoodGroups"
    | "forbiddenFoodGroups"
    | "dietTypeRestrictions"
    | "flexibilityByMeal"
    | "forbiddenCatalogMainCategoryIds"
    | "forbiddenCatalogSubCategoryIds"
  >,
): ClientFoodRuleProfileV2Conflict[] {
  const conflicts: ClientFoodRuleProfileV2Conflict[] = [];
  const allowedFoodSet = new Set(profile.allowedCatalogFoodIds);
  const forbiddenFoodSet = new Set(profile.forbiddenCatalogFoodIds);

  for (const foodId of allowedFoodSet) {
    if (forbiddenFoodSet.has(foodId)) {
      const food = getPhase77DFoodById(foodId);
      conflicts.push({
        code: "food_allowed_and_forbidden",
        message: `${food?.food.name || foodId} hem izinli hem yasakli secildi.`,
      });
    }
    const located = getPhase77DFoodById(foodId);
    if (!located) continue;
    if (profile.forbiddenCatalogMainCategoryIds.includes(located.main.id)) {
      conflicts.push({
        code: "food_allowed_but_parent_category_forbidden",
        message: `${located.food.name} izinli, ancak ana kategori ${located.main.name} yasakli.`,
      });
    }
    if (profile.forbiddenCatalogSubCategoryIds.includes(located.subcategory.id)) {
      conflicts.push({
        code: "food_allowed_but_parent_category_forbidden",
        message: `${located.food.name} izinli, ancak alt kategori ${located.subcategory.name} yasakli.`,
      });
    }
  }

  for (const group of profile.allowedFoodGroups) {
    if (profile.forbiddenFoodGroups.includes(group)) {
      conflicts.push({
        code: "group_allowed_and_forbidden",
        message: `${group} grubu hem izinli hem yasakli.`,
      });
    }
  }

  const hasForbiddenCatalogSelection =
    profile.forbiddenCatalogFoodIds.length > 0 ||
    profile.forbiddenCatalogMainCategoryIds.length > 0 ||
    profile.forbiddenCatalogSubCategoryIds.length > 0 ||
    profile.forbiddenFoodGroups.length > 0;

  if (hasForbiddenCatalogSelection) {
    for (const mealKey of PHASE_77E_MEAL_KEYS) {
      const mealFlex = profile.flexibilityByMeal[mealKey];
      if (mealFlex === "flexible" || mealFlex === "moderate") {
        conflicts.push({
          code: "flexible_meal_with_forbidden_food",
          message: `${mealKey} ogunu esnek/orta esnek, ancak yasakli besin veya grup secimi var.`,
        });
        break;
      }
    }
  }

  for (const dietType of profile.dietTypeRestrictions) {
    const blockedGroups = DIET_TYPE_GROUP_CONFLICTS[dietType] || [];
    for (const group of blockedGroups) {
      if (profile.allowedFoodGroups.includes(group)) {
        conflicts.push({
          code: "diet_type_conflict",
          message: `${dietType} diyeti ile ${group} izinli grubu celisiyor.`,
        });
      }
    }
  }

  return conflicts;
}

function profileToDashboardState(profile: ClientFoodRuleProfileV2Record): FoodRuleDashboardState {
  const legacy = loadFoodRuleDashboardState({});
  return {
    ...legacy,
    forbiddenFoodItems: profile.freeTextForbiddenFoods,
    allowedFoodItems: profile.freeTextAllowedFoods,
    forbiddenFoodGroups: profile.forbiddenFoodGroups,
    allowedFoodGroups: profile.allowedFoodGroups,
    forbiddenCatalogMainCategoryIds: profile.forbiddenCatalogMainCategoryIds,
    forbiddenCatalogSubCategoryIds: profile.forbiddenCatalogSubCategoryIds,
    forbiddenCatalogFoodIds: profile.forbiddenCatalogFoodIds,
    ingredientAllergenKeywords: profile.forbiddenIngredientKeywords,
    dietTypeRules: profile.dietTypeRestrictions[0] || legacy.dietTypeRules,
  };
}

export function profileV2RecordToState(record: ClientFoodRuleProfileV2Record): ClientFoodRuleProfileV2State {
  return {
    ...record,
    conflicts: detectClientFoodRuleProfileConflicts(record),
  };
}

export function createDefaultClientFoodRuleProfileV2Record(
  state: ManuAppState,
  clientId: string,
  createdAt = new Date().toISOString(),
): ClientFoodRuleProfileV2Record {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId,
    dietitianId: state.dietitian.id,
    version: 1,
    status: "published",
    revision: 1,
    allowedCatalogMainCategoryIds: [],
    allowedCatalogSubCategoryIds: [],
    allowedCatalogFoodIds: [],
    forbiddenCatalogMainCategoryIds: [],
    forbiddenCatalogSubCategoryIds: [],
    forbiddenCatalogFoodIds: [],
    allowedFoodGroups: [],
    forbiddenFoodGroups: [],
    freeTextAllowedFoods: [],
    freeTextForbiddenFoods: [],
    forbiddenIngredientKeywords: [],
    dietTypeRestrictions: [],
    flexibilityGlobal: "moderate",
    flexibilityByMeal: normalizeFlexibilityMap({}, PHASE_77E_MEAL_KEYS, "moderate"),
    flexibilityByGoal: normalizeFlexibilityMap({}, PHASE_77E_GOAL_KEYS, "moderate"),
    flexibilityByFoodGroup: normalizeFlexibilityMap({}, PHASE_76D_FOOD_GROUP_OPTIONS, "moderate"),
    notes: "",
    migratedFromLegacy76d: false,
    catalogVersion: PHASE_77D_MASTER_FOOD_CATALOG.metadata.version,
    catalogSourceSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.sourceWorkbookSha256,
    catalogRecordSetSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.recordSetSha256,
    createdAt,
    updatedAt: createdAt,
    publishedAt: createdAt,
  };
}

export function migrateLegacyAnswersToProfileV2(
  state: ManuAppState,
  clientId: string,
  answers: Record<string, unknown>,
  createdAt = new Date().toISOString(),
): ClientFoodRuleProfileV2Record {
  const dashboard = loadFoodRuleDashboardState(answers);
  const profile = createDefaultClientFoodRuleProfileV2Record(state, clientId, createdAt);
  const stableProfileId = String(answers.food_rule_profile_v2_id || "").trim() || profile.id;
  return {
    ...profile,
    id: stableProfileId,
    forbiddenCatalogMainCategoryIds: dashboard.forbiddenCatalogMainCategoryIds,
    forbiddenCatalogSubCategoryIds: dashboard.forbiddenCatalogSubCategoryIds,
    forbiddenCatalogFoodIds: dashboard.forbiddenCatalogFoodIds,
    allowedFoodGroups: dashboard.allowedFoodGroups,
    forbiddenFoodGroups: dashboard.forbiddenFoodGroups,
    freeTextAllowedFoods: dashboard.allowedFoodItems,
    freeTextForbiddenFoods: dashboard.forbiddenFoodItems,
    forbiddenIngredientKeywords: dashboard.ingredientAllergenKeywords,
    dietTypeRestrictions: dashboard.dietTypeRules ? [dashboard.dietTypeRules] : [],
    flexibilityGlobal: mapPersonalFormFlexibilityToProfile(answers.general_flexibility_score),
    flexibilityByGoal: normalizeFlexibilityMap(
      {
        kilo_verme: mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
        kilo_alma: mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
        koruma: mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
        klinik: mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
        performans: mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
      },
      PHASE_77E_GOAL_KEYS,
      mapPersonalFormFlexibilityToProfile(answers.goal_flexibility_score),
    ),
    migratedFromLegacy76d: true,
    updatedAt: createdAt,
    publishedAt: createdAt,
  };
}

export function getClientFoodRuleProfileV2Record(state: ManuAppState, clientId: string) {
  const existing = state.clientFoodRuleProfiles.find((item) => item.clientId === clientId);
  if (existing) return existing;

  const schema = getActiveFormSchema(state);
  const response = schema
    ? state.clientFormResponses.find((item) => item.clientId === clientId && item.schemaId === schema.id)
    : null;
  if (!response?.answers) return null;

  return migrateLegacyAnswersToProfileV2(state, clientId, response.answers);
}

export function getClientFoodRuleProfileV2State(state: ManuAppState, clientId: string) {
  const record = getClientFoodRuleProfileV2Record(state, clientId);
  if (!record) return null;
  return profileV2RecordToState(record);
}

export function saveClientFoodRuleProfileV2InState(
  state: ManuAppState,
  clientId: string,
  input: SaveClientFoodRuleProfileV2Input,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const schema = getActiveFormSchema(state);
  if (!schema) throw new AppDomainError(404, "published_form_schema_not_found");

  const existing = state.clientFoodRuleProfiles.find((item) => item.clientId === clientId);
  const migrated = existing || getClientFoodRuleProfileV2Record(state, clientId);
  if (!migrated) throw new AppDomainError(404, "client_food_rule_profile_not_found");
  if (migrated.revision !== input.revision) throw new AppDomainError(409, "profile_stale_recreate_required");

  const nextRecord: ClientFoodRuleProfileV2Record = {
    ...migrated,
    ...input.profile,
    allowedCatalogMainCategoryIds: dedupeIds(input.profile.allowedCatalogMainCategoryIds),
    allowedCatalogSubCategoryIds: dedupeIds(input.profile.allowedCatalogSubCategoryIds),
    allowedCatalogFoodIds: dedupeIds(input.profile.allowedCatalogFoodIds),
    forbiddenCatalogMainCategoryIds: dedupeIds(input.profile.forbiddenCatalogMainCategoryIds),
    forbiddenCatalogSubCategoryIds: dedupeIds(input.profile.forbiddenCatalogSubCategoryIds),
    forbiddenCatalogFoodIds: dedupeIds(input.profile.forbiddenCatalogFoodIds),
    allowedFoodGroups: dedupeStrings(input.profile.allowedFoodGroups),
    forbiddenFoodGroups: dedupeStrings(input.profile.forbiddenFoodGroups),
    freeTextAllowedFoods: dedupeStrings(input.profile.freeTextAllowedFoods),
    freeTextForbiddenFoods: dedupeStrings(input.profile.freeTextForbiddenFoods),
    forbiddenIngredientKeywords: dedupeStrings(input.profile.forbiddenIngredientKeywords),
    dietTypeRestrictions: dedupeStrings(input.profile.dietTypeRestrictions),
    flexibilityByMeal: normalizeFlexibilityMap(input.profile.flexibilityByMeal, PHASE_77E_MEAL_KEYS, input.profile.flexibilityGlobal),
    flexibilityByGoal: normalizeFlexibilityMap(input.profile.flexibilityByGoal, PHASE_77E_GOAL_KEYS, input.profile.flexibilityGlobal),
    flexibilityByFoodGroup: normalizeFlexibilityMap(
      input.profile.flexibilityByFoodGroup,
      PHASE_76D_FOOD_GROUP_OPTIONS,
      input.profile.flexibilityGlobal,
    ),
    revision: migrated.revision + 1,
    version: migrated.version,
    status: "published",
    updatedAt: createdAt,
    publishedAt: createdAt,
    catalogVersion: PHASE_77D_MASTER_FOOD_CATALOG.metadata.version,
    catalogSourceSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.sourceWorkbookSha256,
    catalogRecordSetSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.recordSetSha256,
  };

  const conflicts = detectClientFoodRuleProfileConflicts(nextRecord);
  if (conflicts.some((item) => item.code === "food_allowed_and_forbidden" || item.code === "group_allowed_and_forbidden")) {
    throw new AppDomainError(409, "client_food_rule_profile_conflict");
  }

  const existingResponse = state.clientFormResponses.find(
    (item) => item.clientId === clientId && item.schemaId === schema.id,
  );
  const bridgedAnswers = {
    ...(existingResponse?.answers || {}),
    ...buildFoodRuleAnswersFromDashboardState(profileToDashboardState(nextRecord)),
    food_rule_profile_v2_id: nextRecord.id,
    food_rule_profile_v2_revision: nextRecord.revision,
    food_rule_profile_v2_version: PHASE_77E_CLIENT_FOOD_RULE_PROFILE_VERSION,
    food_rule_profile_v2_flexibility_global: nextRecord.flexibilityGlobal,
    food_rule_profile_v2_flexibility_by_meal: nextRecord.flexibilityByMeal,
    food_rule_profile_v2_flexibility_by_goal: nextRecord.flexibilityByGoal,
    food_rule_profile_v2_flexibility_by_food_group: nextRecord.flexibilityByFoodGroup,
    food_rule_profile_v2_allowed_food_ids: nextRecord.allowedCatalogFoodIds,
    food_rule_profile_v2_notes: nextRecord.notes,
  };

  let nextState: ManuAppState = {
    ...state,
    clientFoodRuleProfiles: [
      ...state.clientFoodRuleProfiles.filter((item) => item.clientId !== clientId),
      nextRecord,
    ],
  };

  nextState = saveClientFormResponseInState(nextState, clientId, schema.id, bridgedAnswers, createdAt);

  return {
    ...nextState,
    auditEvents: [
      ...nextState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_food_rule_profile_saved",
        entityType: "client_food_rule_profile",
        entityId: nextRecord.id,
        metadata: {
          source: "food_rule_profile_v2",
          clientId,
          revision: nextRecord.revision,
          conflictCount: conflicts.length,
          migratedFromLegacy76d: nextRecord.migratedFromLegacy76d,
        },
        createdAt,
      },
    ],
  };
}

export function buildClientFoodRuleProfileV2ExportSection(profiles: ClientFoodRuleProfileV2Record[]) {
  return profiles.map((profile) => ({
    id: profile.id,
    clientId: profile.clientId,
    version: profile.version,
    revision: profile.revision,
    status: profile.status,
    catalogVersion: profile.catalogVersion,
    allowedCatalogFoodCount: profile.allowedCatalogFoodIds.length,
    forbiddenCatalogFoodCount: profile.forbiddenCatalogFoodIds.length,
    allowedFoodGroupCount: profile.allowedFoodGroups.length,
    forbiddenFoodGroupCount: profile.forbiddenFoodGroups.length,
    flexibilityGlobal: profile.flexibilityGlobal,
    migratedFromLegacy76d: profile.migratedFromLegacy76d,
    updatedAt: profile.updatedAt,
    notesIncluded: profile.notes.trim().length > 0,
  }));
}

export function redactClientFoodRuleProfileV2(profile: ClientFoodRuleProfileV2Record): ClientFoodRuleProfileV2Record {
  return {
    ...profile,
    allowedCatalogMainCategoryIds: [],
    allowedCatalogSubCategoryIds: [],
    allowedCatalogFoodIds: [],
    forbiddenCatalogMainCategoryIds: [],
    forbiddenCatalogSubCategoryIds: [],
    forbiddenCatalogFoodIds: [],
    allowedFoodGroups: [],
    forbiddenFoodGroups: [],
    freeTextAllowedFoods: [],
    freeTextForbiddenFoods: [],
    forbiddenIngredientKeywords: [],
    dietTypeRestrictions: [],
    notes: PHASE_74_REDACTION_MARKER,
    flexibilityGlobal: "moderate",
    flexibilityByMeal: normalizeFlexibilityMap({}, PHASE_77E_MEAL_KEYS, "moderate"),
    flexibilityByGoal: normalizeFlexibilityMap({}, PHASE_77E_GOAL_KEYS, "moderate"),
    flexibilityByFoodGroup: normalizeFlexibilityMap({}, PHASE_76D_FOOD_GROUP_OPTIONS, "moderate"),
  };
}

export function profileContainsUnredactedFoodRuleData(profile: ClientFoodRuleProfileV2Record) {
  return (
    profile.allowedCatalogFoodIds.length > 0 ||
    profile.forbiddenCatalogFoodIds.length > 0 ||
    profile.allowedFoodGroups.length > 0 ||
    profile.forbiddenFoodGroups.length > 0 ||
    profile.freeTextAllowedFoods.length > 0 ||
    profile.freeTextForbiddenFoods.length > 0 ||
    profile.forbiddenIngredientKeywords.length > 0 ||
    (profile.notes.trim().length > 0 && profile.notes !== PHASE_74_REDACTION_MARKER)
  );
}

export const PHASE_77E_FOOD_GROUP_OPTIONS = [...PHASE_76D_FOOD_GROUP_OPTIONS];
export const PHASE_77E_DIET_TYPE_OPTIONS = [...PHASE_76D_DIET_TYPE_OPTIONS];
