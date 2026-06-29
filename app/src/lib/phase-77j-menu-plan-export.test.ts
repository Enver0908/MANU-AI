import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import {
  PHASE_74_EXPORT_INCLUDED_FILES,
  buildPhase74ExportPackage,
} from "./phase-74-data-lifecycle-policy";
import { getClientFoodRuleProfileV2State } from "./phase-77e-client-food-rule-profile";
import {
  activateClientMenuPlanV1InState,
  createClientMenuPlanV1InState,
  getActiveClientMenuPlanV1Record,
  menuPlanV1RecordToState,
  saveClientMenuPlanV1InState,
} from "./phase-77f-client-menu-plan";
import {
  generateMenuPlanDocxBuffer,
  generateMenuPlanPdfBuffer,
} from "./phase-77j-menu-plan-export-binary";
import {
  assertMenuPlanExportEligible,
  buildClientFacingMenuPlanExportDocument,
  buildMenuPlanExportPreviewText,
  menuPlanExportDocumentExcludesInternalFields,
  TURKISH_EXPORT_SAMPLE,
} from "./phase-77j-menu-plan-export";
import { createInitialState } from "./seed-data";

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

function seedActiveExportableMenuPlan() {
  let state = seedPublishedFormResponse();
  state = createClientMenuPlanV1InState(state, "client-mert", { templateType: "weekly_meal_framework" });
  const created = state.clientMenuPlans.find((plan) => plan.clientId === "client-mert")!;
  const profile = getClientFoodRuleProfileV2State(state, "client-mert");
  const editable = menuPlanV1RecordToState(created, profile);
  const slot = editable.mealSlots.find((item) => item.mealKey === "kahvalti");
  state = saveClientMenuPlanV1InState(state, "client-mert", created.id, {
    revision: editable.revision,
    plan: {
      ...planBody(editable),
      dietitianNotes: "Internal only",
      clientFacingNotes: "Client-facing guidance",
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
                  recipe: {
                    title: "Simple yogurt bowl",
                    ingredients: ["Yogurt", "Honey"],
                    instructions: "Mix and serve.",
                  },
                },
              ],
            }
          : item,
      ),
    },
  });
  state = activateClientMenuPlanV1InState(state, "client-mert", created.id);
  const client = state.clients.find((item) => item.id === "client-mert")!;
  const plan = getActiveClientMenuPlanV1Record(state, "client-mert")!;
  return { state, client, plan };
}

describe("phase 77j menu plan export", () => {
  it("builds a client-facing document without internal fields", () => {
    const { client, plan } = seedActiveExportableMenuPlan();
    const document = buildClientFacingMenuPlanExportDocument(client, plan, { includeRecipes: true });

    expect(document.clientName).toBe(client.fullName);
    expect(document.clientFacingNotes).toBe("Client-facing guidance");
    expect(menuPlanExportDocumentExcludesInternalFields(document)).toBe(true);
    expect(JSON.stringify(document)).not.toContain("Internal only");
    expect(JSON.stringify(document)).not.toContain("dietitianNotes");
  });

  it("includes Turkish sample text in preview output", () => {
    const { client, plan } = seedActiveExportableMenuPlan();
    const preview = buildMenuPlanExportPreviewText(
      buildClientFacingMenuPlanExportDocument(client, plan, { includeRecipes: false }),
    );

    expect(preview).toContain(TURKISH_EXPORT_SAMPLE);
    expect(preview).toContain("Yogurt");
    expect(preview).not.toContain("Recipe:");
  });

  it("generates DOCX and PDF buffers with expected signatures", async () => {
    const { client, plan } = seedActiveExportableMenuPlan();
    const document = buildClientFacingMenuPlanExportDocument(client, plan, { includeRecipes: true });

    const docx = await generateMenuPlanDocxBuffer(document);
    const pdf = await generateMenuPlanPdfBuffer(document);

    expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("blocks export when plan is not active or not export-visible", () => {
    const { plan } = seedActiveExportableMenuPlan();

    expect(() => assertMenuPlanExportEligible(plan)).not.toThrow();

    expect(() =>
      assertMenuPlanExportEligible({
        ...plan,
        status: "draft",
      }),
    ).toThrowError(AppDomainError);

    expect(() =>
      assertMenuPlanExportEligible({
        ...plan,
        exportVisible: false,
      }),
    ).toThrowError(AppDomainError);
  });

  it("extends phase 74 export package to lifecycle v1.2 files", () => {
    const { state } = seedActiveExportableMenuPlan();
    const exportPackage = buildPhase74ExportPackage(state, "client-mert");

    expect(exportPackage.manifest.exportVersion).toBe("phase74-export-v1.3");
    expect(exportPackage.manifest.includedFiles).toEqual([...PHASE_74_EXPORT_INCLUDED_FILES]);
    expect(exportPackage.files["personal_form_v2.json"]).toContain("phase-77j-data-lifecycle-v1.2");
    expect(exportPackage.files["catalog_version_refs.json"]).toContain("clientBoundRefs");
    expect(JSON.parse(exportPackage.files["client_update_proposals.json"])).toEqual([]);
  });
});
