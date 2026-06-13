import { AppDomainError } from "./app-errors";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import {
  findPhase77DFoodsByName,
  getPhase77DFoodById,
  PHASE_77D_MASTER_FOOD_CATALOG,
} from "./phase-77d-master-food-catalog";
import {
  getClientFoodRuleProfileV2Record,
  searchPhase77DCatalogFoods,
} from "./phase-77e-client-food-rule-profile";
import { updateClientInState } from "./simulator";
import type {
  ClientFoodRuleProfileV2Record,
  ClientMenuPlanV1Record,
  ClientRecord,
  ManuAppState,
  Phase77FMenuPlanTemplateType,
} from "./types";

export const PHASE_77F_CLIENT_MENU_PLAN_VERSION = "phase-77f-client-menu-plan-v1";

export const PHASE_77F_MENU_PLAN_TEMPLATE_TYPES: Phase77FMenuPlanTemplateType[] = [
  "day_by_day_detailed",
  "weekly_meal_framework",
  "exchange_option_based",
  "simple_guidance",
];

export const PHASE_77F_MENU_PLAN_TEMPLATE_LABELS: Record<Phase77FMenuPlanTemplateType, string> = {
  day_by_day_detailed: "Day-by-day detailed",
  weekly_meal_framework: "Weekly meal framework",
  exchange_option_based: "Exchange / option based",
  simple_guidance: "Simple guidance",
};

export const PHASE_77F_MEAL_KEYS = ["kahvalti", "ogle", "aksam", "ara_ogun"] as const;
export const PHASE_77F_DAY_KEYS = ["pzt", "sal", "car", "per", "cum", "cmt", "paz"] as const;

export type ClientMenuPlanV1ConflictCode =
  | "menu_item_forbidden_food"
  | "menu_item_forbidden_category"
  | "menu_item_forbidden_group"
  | "menu_preferred_conflicts_with_forbidden";

export type ClientMenuPlanV1Conflict = {
  code: ClientMenuPlanV1ConflictCode;
  message: string;
  mealSlotId?: string;
  itemId?: string;
};

export type ClientMenuPlanV1State = Omit<
  ClientMenuPlanV1Record,
  "tenantId" | "clientId" | "dietitianId" | "version" | "createdAt" | "updatedAt" | "activatedAt"
> & {
  conflicts: ClientMenuPlanV1Conflict[];
};

export type SaveClientMenuPlanV1Input = {
  revision: number;
  plan: Omit<ClientMenuPlanV1State, "conflicts" | "revision" | "id">;
};

export type CreateClientMenuPlanV1Input = {
  templateType: Phase77FMenuPlanTemplateType;
  title?: string;
};

function emptyMealItem(): ClientMenuPlanV1MealItemNormalized {
  return {
    id: crypto.randomUUID(),
    label: "",
    freeText: "",
    catalogFoodIds: [],
    catalogMatch: null,
    portionNote: "",
    recipe: null,
  };
}

type ClientMenuPlanV1MealSlotNormalized = ClientMenuPlanV1Record["mealSlots"][number];
type ClientMenuPlanV1MealItemNormalized = ClientMenuPlanV1MealSlotNormalized["items"][number];

function normalizeCatalogMatch(
  input: ClientMenuPlanV1MealItemNormalized["catalogMatch"] | null | undefined,
  freeText: string,
): ClientMenuPlanV1MealItemNormalized["catalogMatch"] {
  if (input?.catalogFoodId) {
    const located = getPhase77DFoodById(input.catalogFoodId);
    return {
      query: input.query || freeText,
      catalogFoodId: input.catalogFoodId,
      catalogFoodName: located?.food.name || input.catalogFoodName || input.catalogFoodId,
      matchConfidence: input.matchConfidence || "exact",
    };
  }
  return matchFreeTextToCatalog(freeText);
}

export function matchFreeTextToCatalog(freeText: string): ClientMenuPlanV1MealItemNormalized["catalogMatch"] {
  const query = freeText.trim();
  if (!query) return null;

  const exactMatches = findPhase77DFoodsByName(query);
  if (exactMatches.length === 1) {
    return {
      query,
      catalogFoodId: exactMatches[0].food.id,
      catalogFoodName: exactMatches[0].food.name,
      matchConfidence: "exact",
    };
  }

  const partialMatches = searchPhase77DCatalogFoods(query, 2);
  if (partialMatches.length === 1) {
    return {
      query,
      catalogFoodId: partialMatches[0].id,
      catalogFoodName: partialMatches[0].name,
      matchConfidence: "partial",
    };
  }

  return {
    query,
    catalogFoodId: null,
    catalogFoodName: null,
    matchConfidence: "none",
  };
}

function normalizeMealItem(item: ClientMenuPlanV1MealItemNormalized): ClientMenuPlanV1MealItemNormalized {
  const freeText = item.freeText.trim();
  const catalogFoodIds = [...new Set([...item.catalogFoodIds, item.catalogMatch?.catalogFoodId].filter(Boolean) as string[])];
  const catalogMatch = normalizeCatalogMatch(item.catalogMatch, freeText);
  const mergedCatalogFoodIds = [
    ...new Set([...catalogFoodIds, catalogMatch?.catalogFoodId].filter(Boolean) as string[]),
  ];

  return {
    id: item.id || crypto.randomUUID(),
    label: item.label.trim(),
    freeText,
    catalogFoodIds: mergedCatalogFoodIds,
    catalogMatch,
    portionNote: item.portionNote.trim(),
    recipe: item.recipe
      ? {
          title: item.recipe.title.trim(),
          ingredients: [...new Set(item.recipe.ingredients.map((value) => value.trim()).filter(Boolean))],
          instructions: item.recipe.instructions.trim(),
        }
      : null,
  };
}

function normalizeMealSlot(slot: ClientMenuPlanV1MealSlotNormalized): ClientMenuPlanV1MealSlotNormalized {
  return {
    id: slot.id || crypto.randomUUID(),
    dayKey: slot.dayKey?.trim() || null,
    mealKey: slot.mealKey.trim() || "genel",
    title: slot.title.trim(),
    items: slot.items.map(normalizeMealItem),
    alternatives: slot.alternatives.map(normalizeMealItem),
    exchangeGuidance: slot.exchangeGuidance.trim(),
    weeklyTargetNote: slot.weeklyTargetNote.trim(),
  };
}

function createDefaultMealSlots(templateType: Phase77FMenuPlanTemplateType): ClientMenuPlanV1MealSlotNormalized[] {
  if (templateType === "day_by_day_detailed") {
    return PHASE_77F_DAY_KEYS.flatMap((dayKey) =>
      PHASE_77F_MEAL_KEYS.map((mealKey) => ({
        id: crypto.randomUUID(),
        dayKey,
        mealKey,
        title: `${dayKey} / ${mealKey}`,
        items: [],
        alternatives: [],
        exchangeGuidance: "",
        weeklyTargetNote: "",
      })),
    );
  }

  if (templateType === "weekly_meal_framework" || templateType === "exchange_option_based") {
    return PHASE_77F_MEAL_KEYS.map((mealKey) => ({
      id: crypto.randomUUID(),
      dayKey: null,
      mealKey,
      title: mealKey,
      items: [],
      alternatives: [],
      exchangeGuidance: templateType === "exchange_option_based" ? "Choose one option per meal slot." : "",
      weeklyTargetNote: "",
    }));
  }

  return [
    {
      id: crypto.randomUUID(),
      dayKey: null,
      mealKey: "genel",
      title: "Daily structure",
      items: [],
      alternatives: [],
      exchangeGuidance: "",
      weeklyTargetNote: "",
    },
  ];
}

export function createDefaultClientMenuPlanV1Record(
  state: ManuAppState,
  clientId: string,
  input: CreateClientMenuPlanV1Input,
  createdAt = new Date().toISOString(),
): ClientMenuPlanV1Record {
  const templateType = PHASE_77F_MENU_PLAN_TEMPLATE_TYPES.includes(input.templateType)
    ? input.templateType
    : "simple_guidance";

  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId,
    dietitianId: state.dietitian.id,
    templateType,
    status: "draft",
    version: 1,
    revision: 1,
    title: input.title?.trim() || PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[templateType],
    effectiveDate: null,
    mealSlots: createDefaultMealSlots(templateType),
    preferredFoods: [],
    avoidFoods: [],
    dietitianNotes: "",
    clientFacingNotes: "",
    exportVisible: true,
    migratedFromLegacyDietPlan: false,
    catalogVersion: PHASE_77D_MASTER_FOOD_CATALOG.metadata.version,
    catalogSourceSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.sourceWorkbookSha256,
    catalogRecordSetSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.recordSetSha256,
    createdAt,
    updatedAt: createdAt,
    activatedAt: null,
  };
}

export function migrateLegacyDietPlanToMenuPlanV1(
  state: ManuAppState,
  client: ClientRecord,
  createdAt = new Date().toISOString(),
): ClientMenuPlanV1Record | null {
  const hasLegacy =
    Boolean(client.dietPlan.summary.trim()) ||
    Boolean(client.dietPlan.breakfast?.trim()) ||
    Boolean(client.dietPlan.lunch?.trim()) ||
    Boolean(client.dietPlan.dinner?.trim());

  if (!hasLegacy) return null;

  const plan = createDefaultClientMenuPlanV1Record(state, client.id, {
    templateType: "simple_guidance",
    title: "Legacy diet plan",
  });

  const items: ClientMenuPlanV1MealItemNormalized[] = [];
  if (client.dietPlan.breakfast?.trim()) {
    items.push({ ...emptyMealItem(), label: "Breakfast", freeText: client.dietPlan.breakfast });
  }
  if (client.dietPlan.lunch?.trim()) {
    items.push({ ...emptyMealItem(), label: "Lunch", freeText: client.dietPlan.lunch });
  }
  if (client.dietPlan.dinner?.trim()) {
    items.push({ ...emptyMealItem(), label: "Dinner", freeText: client.dietPlan.dinner });
  }

  return {
    ...plan,
    mealSlots: [
      {
        ...plan.mealSlots[0],
        items: items.length > 0 ? items.map(normalizeMealItem) : plan.mealSlots[0].items,
      },
    ],
    preferredFoods: [],
    avoidFoods: [...client.restrictedFoods],
    clientFacingNotes: client.dietPlan.summary,
    migratedFromLegacyDietPlan: true,
    updatedAt: createdAt,
  };
}

export function listClientMenuPlanV1Records(state: ManuAppState, clientId: string) {
  const persisted = state.clientMenuPlans.filter((plan) => plan.clientId === clientId);
  if (persisted.length > 0) return persisted;

  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return [];
  const migrated = migrateLegacyDietPlanToMenuPlanV1(state, client);
  return migrated ? [migrated] : [];
}

export function getActiveClientMenuPlanV1Record(state: ManuAppState, clientId: string) {
  const persistedActive = state.clientMenuPlans.find((plan) => plan.clientId === clientId && plan.status === "active");
  if (persistedActive) return persistedActive;
  return null;
}

export function clientHasActiveMenuPlanV1(state: ManuAppState, clientId: string) {
  return Boolean(getActiveClientMenuPlanV1Record(state, clientId));
}

function collectMenuCatalogFoodIds(plan: Pick<ClientMenuPlanV1Record, "mealSlots">) {
  const foodIds = new Set<string>();
  for (const slot of plan.mealSlots) {
    for (const item of [...slot.items, ...slot.alternatives]) {
      for (const foodId of item.catalogFoodIds) foodIds.add(foodId);
      if (item.catalogMatch?.catalogFoodId) foodIds.add(item.catalogMatch.catalogFoodId);
    }
  }
  return [...foodIds];
}

function foodNameForConflict(foodId: string) {
  return getPhase77DFoodById(foodId)?.food.name || foodId;
}

export function detectClientMenuPlanFoodRuleConflicts(
  plan: Pick<ClientMenuPlanV1Record, "mealSlots" | "preferredFoods" | "avoidFoods">,
  profile: ClientFoodRuleProfileV2Record | null,
): ClientMenuPlanV1Conflict[] {
  if (!profile) return [];

  const conflicts: ClientMenuPlanV1Conflict[] = [];
  const forbiddenFoodSet = new Set(profile.forbiddenCatalogFoodIds);
  const forbiddenMainSet = new Set(profile.forbiddenCatalogMainCategoryIds);
  const forbiddenSubSet = new Set(profile.forbiddenCatalogSubCategoryIds);
  const forbiddenGroups = new Set(profile.forbiddenFoodGroups.map((value) => value.toLocaleLowerCase("tr-TR")));
  const forbiddenFreeText = profile.freeTextForbiddenFoods.map((value) => value.toLocaleLowerCase("tr-TR"));

  const inspectItem = (slot: ClientMenuPlanV1MealSlotNormalized, item: ClientMenuPlanV1MealItemNormalized) => {
    for (const foodId of collectMenuCatalogFoodIds({ mealSlots: [{ ...slot, items: [item], alternatives: [] }] })) {
      if (forbiddenFoodSet.has(foodId)) {
        conflicts.push({
          code: "menu_item_forbidden_food",
          message: `${foodNameForConflict(foodId)} menu planinda var, ancak profilde yasakli.`,
          mealSlotId: slot.id,
          itemId: item.id,
        });
      }
      const located = getPhase77DFoodById(foodId);
      if (!located) continue;
      if (forbiddenMainSet.has(located.main.id) || forbiddenSubSet.has(located.subcategory.id)) {
        conflicts.push({
          code: "menu_item_forbidden_category",
          message: `${located.food.name} menu planinda var, ancak yasakli kategori altinda.`,
          mealSlotId: slot.id,
          itemId: item.id,
        });
      }
      const groupKeys = [located.main.name, located.subcategory.name].map((value) => value.toLocaleLowerCase("tr-TR"));
      if (groupKeys.some((group) => forbiddenGroups.has(group))) {
        conflicts.push({
          code: "menu_item_forbidden_group",
          message: `${located.food.name} menu planinda var, ancak yasakli besin grubunda.`,
          mealSlotId: slot.id,
          itemId: item.id,
        });
      }
    }

    const haystack = `${item.label} ${item.freeText}`.toLocaleLowerCase("tr-TR");
    for (const forbidden of forbiddenFreeText) {
      if (forbidden && haystack.includes(forbidden)) {
        conflicts.push({
          code: "menu_item_forbidden_food",
          message: `"${item.freeText || item.label}" menu metni yasakli besin listesiyle celisiyor.`,
          mealSlotId: slot.id,
          itemId: item.id,
        });
        break;
      }
    }
  };

  for (const slot of plan.mealSlots) {
    for (const item of slot.items) inspectItem(slot, item);
    for (const item of slot.alternatives) inspectItem(slot, item);
  }

  for (const preferred of plan.preferredFoods) {
    const preferredKey = preferred.toLocaleLowerCase("tr-TR");
    if (forbiddenFreeText.some((forbidden) => preferredKey.includes(forbidden))) {
      conflicts.push({
        code: "menu_preferred_conflicts_with_forbidden",
        message: `Tercih edilen "${preferred}" yasakli besin listesiyle celisiyor.`,
      });
    }
  }

  return conflicts;
}

export function menuPlanV1RecordToState(
  record: ClientMenuPlanV1Record,
  profile: ClientFoodRuleProfileV2Record | null,
): ClientMenuPlanV1State {
  return {
    ...record,
    conflicts: detectClientMenuPlanFoodRuleConflicts(record, profile),
  };
}

export type ClientMenuPlanV1SummarySource = Pick<
  ClientMenuPlanV1Record,
  "templateType" | "title" | "clientFacingNotes" | "mealSlots"
>;

export function deriveDietPlanSummaryFromMenuPlan(plan: ClientMenuPlanV1SummarySource) {
  const parts: string[] = [`[${PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[plan.templateType]}] ${plan.title}`];
  if (plan.clientFacingNotes.trim()) parts.push(plan.clientFacingNotes.trim());

  for (const slot of plan.mealSlots) {
    const labels = [...slot.items, ...slot.alternatives]
      .map((item) => item.freeText.trim() || item.catalogMatch?.catalogFoodName || item.label.trim())
      .filter(Boolean);
    if (labels.length > 0) parts.push(`${slot.title}: ${labels.join(", ")}`);
    if (parts.join(" | ").length > 1800) break;
  }

  return parts.join(" | ").slice(0, 2000);
}

export function deriveLegacyDietPlanFieldsFromMenuPlan(plan: ClientMenuPlanV1Record) {
  const summary = deriveDietPlanSummaryFromMenuPlan(plan);
  const findMealText = (mealKey: string) => {
    const slot = plan.mealSlots.find((item) => item.mealKey === mealKey && item.items.length > 0);
    if (!slot) return undefined;
    const first = slot.items[0];
    return first.freeText.trim() || first.catalogMatch?.catalogFoodName || first.label.trim() || undefined;
  };

  return {
    summary,
    breakfast: findMealText("kahvalti"),
    lunch: findMealText("ogle"),
    dinner: findMealText("aksam"),
  };
}

function applyDerivedDietPlanToClient(state: ManuAppState, clientId: string, plan: ClientMenuPlanV1Record) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  const derived = deriveLegacyDietPlanFieldsFromMenuPlan(plan);
  return updateClientInState(state, clientId, {
    dietPlan: {
      ...client.dietPlan,
      summary: derived.summary,
      breakfast: derived.breakfast,
      lunch: derived.lunch,
      dinner: derived.dinner,
    },
    contextRevision: client.contextRevision + 1,
  });
}

function archiveOtherActivePlans(
  plans: ClientMenuPlanV1Record[],
  clientId: string,
  keepPlanId: string,
  updatedAt: string,
) {
  return plans.map((plan) =>
    plan.clientId === clientId && plan.id !== keepPlanId && plan.status === "active"
      ? { ...plan, status: "archived" as const, updatedAt, activatedAt: plan.activatedAt }
      : plan,
  );
}

export function createClientMenuPlanV1InState(
  state: ManuAppState,
  clientId: string,
  input: CreateClientMenuPlanV1Input,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const record = createDefaultClientMenuPlanV1Record(state, clientId, input, createdAt);
  return {
    ...state,
    clientMenuPlans: [...state.clientMenuPlans, record],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_menu_plan_created",
        entityType: "client_menu_plan",
        entityId: record.id,
        metadata: { clientId, templateType: record.templateType, revision: record.revision },
        createdAt,
      },
    ],
  };
}

export function saveClientMenuPlanV1InState(
  state: ManuAppState,
  clientId: string,
  planId: string,
  input: SaveClientMenuPlanV1Input,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const existing =
    state.clientMenuPlans.find((plan) => plan.id === planId && plan.clientId === clientId) ||
    listClientMenuPlanV1Records(state, clientId).find((plan) => plan.id === planId);
  if (!existing) throw new AppDomainError(404, "client_menu_plan_not_found");
  if (existing.revision !== input.revision) throw new AppDomainError(409, "profile_stale_recreate_required");

  const nextRecord: ClientMenuPlanV1Record = {
    ...existing,
    ...input.plan,
    title: input.plan.title.trim() || existing.title,
    mealSlots: input.plan.mealSlots.map(normalizeMealSlot),
    preferredFoods: [...new Set(input.plan.preferredFoods.map((value) => value.trim()).filter(Boolean))],
    avoidFoods: [...new Set(input.plan.avoidFoods.map((value) => value.trim()).filter(Boolean))],
    dietitianNotes: input.plan.dietitianNotes.trim(),
    clientFacingNotes: input.plan.clientFacingNotes.trim(),
    revision: existing.revision + 1,
    updatedAt: createdAt,
    catalogVersion: PHASE_77D_MASTER_FOOD_CATALOG.metadata.version,
    catalogSourceSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.sourceWorkbookSha256,
    catalogRecordSetSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.recordSetSha256,
  };

  let nextState: ManuAppState = {
    ...state,
    clientMenuPlans: [
      ...state.clientMenuPlans.filter((plan) => plan.id !== planId),
      nextRecord,
    ],
  };

  if (nextRecord.status === "active") {
    nextState = applyDerivedDietPlanToClient(nextState, clientId, nextRecord);
  }

  return {
    ...nextState,
    auditEvents: [
      ...nextState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_menu_plan_saved",
        entityType: "client_menu_plan",
        entityId: nextRecord.id,
        metadata: {
          clientId,
          status: nextRecord.status,
          revision: nextRecord.revision,
          conflictCount: detectClientMenuPlanFoodRuleConflicts(
            nextRecord,
            getClientFoodRuleProfileV2Record(state, clientId),
          ).length,
        },
        createdAt,
      },
    ],
  };
}

export function activateClientMenuPlanV1InState(
  state: ManuAppState,
  clientId: string,
  planId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const existing =
    state.clientMenuPlans.find((plan) => plan.id === planId && plan.clientId === clientId) ||
    listClientMenuPlanV1Records(state, clientId).find((plan) => plan.id === planId);
  if (!existing) throw new AppDomainError(404, "client_menu_plan_not_found");

  const profile = getClientFoodRuleProfileV2Record(state, clientId);
  const conflicts = detectClientMenuPlanFoodRuleConflicts(existing, profile);
  if (
    conflicts.some(
      (conflict) =>
        conflict.code === "menu_item_forbidden_food" ||
        conflict.code === "menu_item_forbidden_category" ||
        conflict.code === "menu_item_forbidden_group",
    )
  ) {
    throw new AppDomainError(409, "client_menu_plan_conflict");
  }

  const activated: ClientMenuPlanV1Record = {
    ...existing,
    status: "active",
    updatedAt: createdAt,
    activatedAt: createdAt,
    revision: existing.revision + 1,
  };

  let nextState: ManuAppState = {
    ...state,
    clientMenuPlans: archiveOtherActivePlans(
      [...state.clientMenuPlans.filter((plan) => plan.id !== planId), activated],
      clientId,
      planId,
      createdAt,
    ),
  };

  nextState = applyDerivedDietPlanToClient(nextState, clientId, activated);

  return {
    ...nextState,
    auditEvents: [
      ...nextState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_menu_plan_activated",
        entityType: "client_menu_plan",
        entityId: activated.id,
        metadata: {
          clientId,
          templateType: activated.templateType,
          revision: activated.revision,
          derivedSummaryLength: deriveDietPlanSummaryFromMenuPlan(activated).length,
        },
        createdAt,
      },
    ],
  };
}

export function buildClientMenuPlanV1ExportSection(plans: ClientMenuPlanV1Record[]) {
  return plans.map((plan) => ({
    id: plan.id,
    clientId: plan.clientId,
    templateType: plan.templateType,
    status: plan.status,
    version: plan.version,
    revision: plan.revision,
    title: plan.title,
    effectiveDate: plan.effectiveDate,
    mealSlotCount: plan.mealSlots.length,
    exportVisible: plan.exportVisible,
    migratedFromLegacyDietPlan: plan.migratedFromLegacyDietPlan,
    updatedAt: plan.updatedAt,
    activatedAt: plan.activatedAt,
  }));
}

export function redactClientMenuPlanV1(plan: ClientMenuPlanV1Record): ClientMenuPlanV1Record {
  return {
    ...plan,
    title: PHASE_74_REDACTION_MARKER,
    effectiveDate: null,
    mealSlots: [],
    preferredFoods: [],
    avoidFoods: [],
    dietitianNotes: PHASE_74_REDACTION_MARKER,
    clientFacingNotes: PHASE_74_REDACTION_MARKER,
    exportVisible: false,
    status: "archived",
  };
}

export function menuPlanContainsUnredactedData(plan: ClientMenuPlanV1Record) {
  return (
    plan.mealSlots.length > 0 ||
    plan.preferredFoods.length > 0 ||
    plan.avoidFoods.length > 0 ||
    (plan.dietitianNotes.trim().length > 0 && plan.dietitianNotes !== PHASE_74_REDACTION_MARKER) ||
    (plan.clientFacingNotes.trim().length > 0 && plan.clientFacingNotes !== PHASE_74_REDACTION_MARKER) ||
    (plan.title.trim().length > 0 && plan.title !== PHASE_74_REDACTION_MARKER)
  );
}

export function assertDietPlanSummaryPatchAllowed(state: ManuAppState, clientId: string, patch: Partial<ClientRecord>) {
  if (!Object.prototype.hasOwnProperty.call(patch, "dietPlan")) return;
  const summaryPatch = patch.dietPlan?.summary;
  if (summaryPatch === undefined) return;
  if (!clientHasActiveMenuPlanV1(state, clientId)) return;
  throw new AppDomainError(409, "active_menu_plan_summary_locked");
}
