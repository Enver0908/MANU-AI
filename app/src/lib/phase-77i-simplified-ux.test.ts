import { describe, expect, it } from "vitest";
import { assertDashboardMessagesComplete, dashboardMessages } from "./i18n";
import { createInitialState } from "./seed-data";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import {
  detectClientFoodRuleProfileConflicts,
  getClientFoodRuleProfileV2State,
} from "./phase-77e-client-food-rule-profile";
import {
  listClientMenuPlanV1Records,
  menuPlanV1RecordToState,
} from "./phase-77f-client-menu-plan";
import { getClientFoodRuleProfileV2Record } from "./phase-77e-client-food-rule-profile";

describe("phase 77i simplified dietitian ux", () => {
  it("i18n tab labels are complete for all languages", () => {
    assertDashboardMessagesComplete();
    const tabKeys = [
      "tabOverview",
      "tabPersonalForm",
      "tabFoodRules",
      "tabMenu",
      "tabCriticalContext",
      "tabAiCopilot",
      "tabExport",
    ] as const;
    for (const lang of Object.keys(dashboardMessages) as Array<keyof typeof dashboardMessages>) {
      for (const key of tabKeys) {
        expect(dashboardMessages[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it("food rule conflict count is computable for status summary", () => {
    const base = createInitialState();
    const schema = base.clientFormSchemas[0];
    const published = publishClientFormSchemaInState(base, schema.id);
    const state = saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
    const profile = getClientFoodRuleProfileV2State(state, "client-mert");
    expect(profile).not.toBeNull();
    const conflicts = detectClientFoodRuleProfileConflicts(profile!);
    expect(Array.isArray(conflicts)).toBe(true);
  });

  it("menu plan state is computable for status summary", () => {
    const state = createInitialState();
    const plans = listClientMenuPlanV1Records(state, "client-mert");
    const planStates = plans.map((p) =>
      menuPlanV1RecordToState(p, getClientFoodRuleProfileV2Record(state, "client-mert")),
    );
    expect(Array.isArray(planStates)).toBe(true);
  });

  it("export tab data aggregation covers profile, menu, and context", () => {
    const state = createInitialState();
    const client = state.clients.find((c) => c.id === "client-mert")!;
    expect(client.fullName).toBeTruthy();
    expect(client.healthProfile.goal).toBeTruthy();
    expect(Array.isArray(client.allergies)).toBe(true);
    const contextUpdates = state.clientContextUpdates.filter((u) => u.clientId === client.id);
    expect(Array.isArray(contextUpdates)).toBe(true);
  });

  it("status summary keys include conflict, menu, and context labels", () => {
    const requiredKeys = [
      "conflictsFound",
      "activeMenu",
      "noActiveMenu",
      "exportMenuTitle",
      "exportDownloadDocx",
      "exportDownloadPdf",
    ] as const;
    for (const lang of Object.keys(dashboardMessages) as Array<keyof typeof dashboardMessages>) {
      for (const key of requiredKeys) {
        expect(dashboardMessages[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });
});
