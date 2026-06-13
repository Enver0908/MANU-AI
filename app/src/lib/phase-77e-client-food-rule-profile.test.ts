import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { createClientUpdateProposalInState } from "./client-update-proposals";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { buildClientScopedExport } from "./data-governance";
import { applyPhase74TransactionalRedactionInState } from "./phase-74-data-lifecycle-policy";
import {
  detectClientFoodRuleProfileConflicts,
  getClientFoodRuleProfileV2Record,
  getClientFoodRuleProfileV2State,
  migrateLegacyAnswersToProfileV2,
  profileContainsUnredactedFoodRuleData,
  resolveClientFoodRuleProfileFlexibility,
  saveClientFoodRuleProfileV2InState,
} from "./phase-77e-client-food-rule-profile";
import { createInitialState } from "./seed-data";

const SAMPLE_FOOD_ID = "yumurta__tavuk-yumurtasi__tavuk-yumurtasi";

function profileBody(profile: NonNullable<ReturnType<typeof getClientFoodRuleProfileV2State>>) {
  const { conflicts, ...body } = profile;
  void conflicts;
  return body;
}

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77e client food rule profile v2", () => {
  it("lazy-migrates legacy form answers into a profile record", () => {
    const state = seedPublishedFormResponse();
    const profile = getClientFoodRuleProfileV2Record(state, "client-mert");

    expect(profile).not.toBeNull();
    expect(profile?.migratedFromLegacy76d).toBe(true);
    expect(profile?.forbiddenFoodGroups.length).toBeGreaterThan(0);
    expect(profile?.flexibilityGlobal).toBe("moderate");
  });

  it("saves profile v2, bridges legacy answers, and audits the save", () => {
    const state = seedPublishedFormResponse();
    const current = getClientFoodRuleProfileV2State(state, "client-mert");
    expect(current).not.toBeNull();

    const next = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: current!.revision,
      profile: {
        ...profileBody(current!),
        allowedCatalogFoodIds: [SAMPLE_FOOD_ID],
        notes: "manual profile save",
      },
    });

    const saved = next.clientFoodRuleProfiles.find((item) => item.clientId === "client-mert");
    const response = next.clientFormResponses.find((item) => item.clientId === "client-mert");
    expect(saved?.revision).toBe(current!.revision + 1);
    expect(saved?.allowedCatalogFoodIds).toContain(SAMPLE_FOOD_ID);
    expect(response?.answers.food_rule_profile_v2_revision).toBe(saved?.revision);
    expect(response?.answers.food_rule_profile_v2_allowed_food_ids).toContain(SAMPLE_FOOD_ID);
    expect(next.auditEvents.at(-1)?.eventType).toBe("client_food_rule_profile_saved");
    expect(next.clients.find((client) => client.id === "client-mert")?.contextRevision).toBe(
      state.clients.find((client) => client.id === "client-mert")!.contextRevision + 1,
    );
  });

  it("blocks hard conflicts on save", () => {
    const state = seedPublishedFormResponse();
    const current = getClientFoodRuleProfileV2State(state, "client-mert");

    expect(() =>
      saveClientFoodRuleProfileV2InState(state, "client-mert", {
        revision: current!.revision,
        profile: {
          ...profileBody(current!),
          allowedCatalogFoodIds: [SAMPLE_FOOD_ID],
          forbiddenCatalogFoodIds: [SAMPLE_FOOD_ID],
        },
      }),
    ).toThrowError(AppDomainError);
  });

  it("detects flexibility precedence and diet-type conflicts as warnings", () => {
    expect(resolveClientFoodRuleProfileFlexibility(["flexible", "restricted", "moderate"])).toBe("restricted");

    const conflicts = detectClientFoodRuleProfileConflicts({
      allowedCatalogFoodIds: [],
      forbiddenCatalogFoodIds: [SAMPLE_FOOD_ID],
      allowedFoodGroups: ["Sut urunleri"],
      forbiddenFoodGroups: [],
      dietTypeRestrictions: ["Vegan"],
      flexibilityByMeal: { kahvalti: "flexible", ogle: "moderate", aksam: "moderate", ara_ogun: "moderate" },
      forbiddenCatalogMainCategoryIds: [],
      forbiddenCatalogSubCategoryIds: [],
    });

    expect(conflicts.some((item) => item.code === "flexible_meal_with_forbidden_food")).toBe(true);
    expect(conflicts.some((item) => item.code === "diet_type_conflict")).toBe(true);
  });

  it("rejects stale revision saves", () => {
    const state = seedPublishedFormResponse();
    const current = getClientFoodRuleProfileV2State(state, "client-mert");

    expect(() =>
      saveClientFoodRuleProfileV2InState(state, "client-mert", {
        revision: (current?.revision || 1) - 1,
        profile: profileBody(current!),
      }),
    ).toThrowError(AppDomainError);
  });

  it("exports and redacts profile v2 records", () => {
    let state = seedPublishedFormResponse();
    const current = getClientFoodRuleProfileV2State(state, "client-mert");
    state = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: current!.revision,
      profile: {
        ...profileBody(current!),
        notes: "export me",
      },
    });

    const exported = buildClientScopedExport(state, "client-mert");
    expect(exported.clientFoodRuleProfiles).toHaveLength(1);
    expect(exported.clientFoodRuleProfiles[0]?.notes).toBe("export me");

    const redacted = applyPhase74TransactionalRedactionInState(state, "client-mert", "anonymization").state;
    const profile = redacted.clientFoodRuleProfiles.find((item) => item.clientId === "client-mert");
    expect(profileContainsUnredactedFoodRuleData(profile!)).toBe(false);
  });

  it("keeps chat proposal mutation blocked while profile saves stay manual", () => {
    expect(() =>
      createClientUpdateProposalInState(createInitialState(), "client-mert", {
        sourceText: "forbidden_food_items: walnut",
      }),
    ).toThrowError(AppDomainError);

    const migrated = migrateLegacyAnswersToProfileV2(createInitialState(), "client-mert", {
      food_rule_profile_v2_id: "profile-stable-id",
      forbidden_food_groups: ["Gluten"],
    });
    expect(migrated.id).toBe("profile-stable-id");
  });
});
