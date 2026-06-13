import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { patchClientInState } from "./app-state-store";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { buildClientScopedExport } from "./data-governance";
import { applyPhase74TransactionalRedactionInState } from "./phase-74-data-lifecycle-policy";
import {
  saveClientFoodRuleProfileV2InState,
  getClientFoodRuleProfileV2State,
} from "./phase-77e-client-food-rule-profile";
import {
  activateClientMenuPlanV1InState,
  assertDietPlanSummaryPatchAllowed,
  createClientMenuPlanV1InState,
  deriveDietPlanSummaryFromMenuPlan,
  getActiveClientMenuPlanV1Record,
  listClientMenuPlanV1Records,
  menuPlanV1RecordToState,
  migrateLegacyDietPlanToMenuPlanV1,
  saveClientMenuPlanV1InState,
} from "./phase-77f-client-menu-plan";
import { createInitialState } from "./seed-data";

const SAMPLE_FOOD_ID = "yumurta__tavuk-yumurtasi__tavuk-yumurtasi";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

function planBody(plan: NonNullable<ReturnType<typeof menuPlanV1RecordToState>>) {
  const { conflicts, ...body } = plan;
  void conflicts;
  return body;
}

describe("phase 77f client menu plan v1", () => {
  it("lazy-migrates legacy diet plan into a draft menu plan", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert");
    const migrated = migrateLegacyDietPlanToMenuPlanV1(state, client!);
    expect(migrated?.migratedFromLegacyDietPlan).toBe(true);
    expect(migrated?.clientFacingNotes).toContain("Three meals");
    expect(listClientMenuPlanV1Records(state, "client-mert")).toHaveLength(1);
  });

  it("creates, saves, and activates a menu plan with derived legacy summary", () => {
    let state = seedPublishedFormResponse();
    state = createClientMenuPlanV1InState(state, "client-mert", { templateType: "weekly_meal_framework" });
    const created = state.clientMenuPlans.find((plan) => plan.clientId === "client-mert");
    expect(created).toBeTruthy();

    const profile = getClientFoodRuleProfileV2State(state, "client-mert");
    const editable = menuPlanV1RecordToState(created!, profile);
    const slot = editable.mealSlots.find((item) => item.mealKey === "kahvalti");
    state = saveClientMenuPlanV1InState(state, "client-mert", created!.id, {
      revision: editable.revision,
      plan: {
        ...planBody(editable),
        mealSlots: editable.mealSlots.map((item) =>
          item.id === slot?.id
            ? {
                ...item,
                items: [
                  {
                    id: "item-1",
                    label: "Breakfast",
                    freeText: "Yogurt",
                    catalogFoodIds: [],
                    catalogMatch: null,
                    portionNote: "1 bowl",
                    recipe: null,
                  },
                ],
              }
            : item,
        ),
        clientFacingNotes: "Weekly breakfast focus",
      },
    });

    const saved = state.clientMenuPlans.find((plan) => plan.id === created!.id);
    expect(saved?.revision).toBe(2);
    expect(saved?.mealSlots.find((item) => item.mealKey === "kahvalti")?.items[0]?.freeText).toBe("Yogurt");

    state = activateClientMenuPlanV1InState(state, "client-mert", created!.id);
    const active = getActiveClientMenuPlanV1Record(state, "client-mert");
    const client = state.clients.find((item) => item.id === "client-mert");
    expect(active?.status).toBe("active");
    expect(client?.dietPlan.summary).toContain("Weekly meal framework");
    expect(client?.dietPlan.breakfast).toBe("Yogurt");
    expect(state.auditEvents.at(-1)?.eventType).toBe("client_menu_plan_activated");
  });

  it("blocks activation when menu items conflict with forbidden food profile rules", () => {
    let state = seedPublishedFormResponse();
    const profile = getClientFoodRuleProfileV2State(state, "client-mert");
    state = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: profile!.revision,
      profile: {
        ...planBody(profile!),
        forbiddenCatalogFoodIds: [SAMPLE_FOOD_ID],
      },
    });
    const foodProfile = getClientFoodRuleProfileV2State(state, "client-mert");
    state = createClientMenuPlanV1InState(state, "client-mert", { templateType: "simple_guidance" });
    const created = state.clientMenuPlans.at(-1)!;
    const editable = menuPlanV1RecordToState(created, foodProfile);
    const slot = editable.mealSlots[0];
    state = saveClientMenuPlanV1InState(state, "client-mert", created.id, {
      revision: editable.revision,
      plan: {
        ...planBody(editable),
        mealSlots: [
          {
            ...slot,
            items: [
              {
                id: "forbidden-item",
                label: "",
                freeText: "",
                catalogFoodIds: [SAMPLE_FOOD_ID],
                catalogMatch: {
                  query: "Tavuk yumurtasi",
                  catalogFoodId: SAMPLE_FOOD_ID,
                  catalogFoodName: "Tavuk yumurtasi",
                  matchConfidence: "exact",
                },
                portionNote: "",
                recipe: null,
              },
            ],
          },
        ],
      },
    });

    expect(() => activateClientMenuPlanV1InState(state, "client-mert", created.id)).toThrowError(AppDomainError);
  });

  it("locks direct diet plan summary patches when an active menu exists", () => {
    let state = seedPublishedFormResponse();
    state = createClientMenuPlanV1InState(state, "client-mert", { templateType: "simple_guidance" });
    const created = state.clientMenuPlans.at(-1)!;
    state = activateClientMenuPlanV1InState(state, "client-mert", created.id);

    expect(() =>
      assertDietPlanSummaryPatchAllowed(state, "client-mert", { dietPlan: { summary: "manual override" } }),
    ).toThrowError(AppDomainError);

    expect(() =>
      patchClientInState(state, "client-mert", { dietPlan: { summary: "manual override" } }),
    ).toThrowError(AppDomainError);
  });

  it("exports and redacts menu plan records", () => {
    let state = seedPublishedFormResponse();
    state = createClientMenuPlanV1InState(state, "client-mert", { templateType: "simple_guidance", title: "Export plan" });
    const exported = buildClientScopedExport(state, "client-mert");
    expect(exported.clientMenuPlans).toHaveLength(1);

    const redacted = applyPhase74TransactionalRedactionInState(state, "client-mert", "anonymization").state;
    expect(redacted.clientMenuPlans[0]?.mealSlots).toEqual([]);
  });

  it("derives a bounded legacy summary from active menu content", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert");
    const migrated = migrateLegacyDietPlanToMenuPlanV1(state, client!)!;
    const summary = deriveDietPlanSummaryFromMenuPlan(migrated);
    expect(summary).toContain("Legacy diet plan");
    expect(summary.length).toBeLessThanOrEqual(2000);
  });
});
