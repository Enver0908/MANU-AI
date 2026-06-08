import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { applyPhase74TransactionalRedactionInState } from "./phase-74-data-lifecycle-policy";
import { buildPhase74ExportPackage } from "./phase-74-data-lifecycle-policy";
import { saveFormResponseInState, simulateInState } from "./app-state-store";
import { createClientUpdateProposalInState } from "./client-update-proposals";
import { createInitialState, DEMO_FORM_SCHEMA_ID } from "./seed-data";
import { buildStructuredFoodRulesFromClientState, evaluateClientFoodRuleDecision } from "./food-rule-runtime";
import {
  answersContainUnredactedFoodRuleData,
  buildFoodRuleExportSection,
  buildProposalExportSection,
  clientContainsUnredactedFoodRuleProfile,
  proposalContainsUnredactedFoodRuleData,
  redactStructuredFoodRuleAnswers,
} from "./phase-76n-food-rule-lifecycle";

describe("phase 76n food rule lifecycle", () => {
  it("exports structured food rule manifest categories", () => {
    const answers = buildPhase70QualifiedClientAnswers();
    const section = buildFoodRuleExportSection([
      {
        id: "response-1",
        tenantId: "tenant-demo",
        clientId: "client-mert",
        schemaId: DEMO_FORM_SCHEMA_ID,
        schemaVersion: 1,
        schemaSnapshot: { id: DEMO_FORM_SCHEMA_ID, tenantId: "tenant-demo", version: 1, status: "published", fields: [] },
        languageCode: "tr",
        submittedPhoneE164: "+905551110001",
        answers,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z",
      },
    ]);

    expect(section.manifest?.forbiddenFoodItems.length).toBeGreaterThan(0);
    expect(section.populatedFieldIds).toContain("forbidden_food_items");
  });

  it("redacts structured food rule answers and proposal export sections", () => {
    const answers = buildPhase70QualifiedClientAnswers();
    const redacted = redactStructuredFoodRuleAnswers(answers);

    expect(answersContainUnredactedFoodRuleData(redacted)).toBe(false);
    expect(redacted.forbidden_food_items).toBe(PHASE_74_REDACTION_MARKER);

    const proposals = buildProposalExportSection([
      {
        id: "proposal-1",
        tenantId: "tenant-demo",
        clientId: "client-mert",
        dietitianId: "dietitian-demo",
        sourceText: "Mert sut urunleri tuketmemeli.",
        proposedPatches: [
          {
            target: "form",
            fieldId: "forbidden_food_items",
            category: "food_rule",
            operation: "append",
            value: "sut",
          },
        ],
        safetyFlags: [],
        status: "pending",
        expectedContextRevision: 1,
        createdAt: "2026-06-08T00:00:00.000Z",
        resolvedAt: null,
      },
    ]);

    expect(proposals[0]?.foodRulePatchFieldIds).toContain("forbidden_food_items");
    expect(proposals[0]?.patchCategories).toContain("food_rule");
  });

  it("clears food rule profile data and blocks removed clients from food-rule engine use", async () => {
    const withForm = saveFormResponseInState(createInitialState(), {
      clientId: "client-mert",
      schemaId: DEMO_FORM_SCHEMA_ID,
      submittedPhoneE164: "+905551110001",
      answers: buildPhase70QualifiedClientAnswers(),
    });
    const withMessage = await simulateInState(withForm, {
      clientId: "client-mert",
      body: "Fistik yerine badem olur mu?",
      idempotencyKey: "phase76n-food-rule",
    });
    const proposed = createClientUpdateProposalInState(withMessage, "client-mert", {
      sourceText: "Mert sut urunleri tuketmemeli.",
    });

    const { state } = applyPhase74TransactionalRedactionInState(proposed, "client-mert", "deletion");
    const client = state.clients.find((item) => item.id === "client-mert");

    expect(client).toBeDefined();
    expect(clientContainsUnredactedFoodRuleProfile(client!)).toBe(false);
    expect(
      state.clientUpdateProposals
        .filter((proposal) => proposal.clientId === "client-mert")
        .every((proposal) => !proposalContainsUnredactedFoodRuleData(proposal)),
    ).toBe(true);

    expect(buildStructuredFoodRulesFromClientState(state, "client-mert")).toBeNull();

    const engineResult = evaluateClientFoodRuleDecision(state, "client-mert", "Sutlu cikolata yiyebilir miyim?");
    expect(engineResult.reasons).toContain("food_rule_structured_rules_missing");

    await expect(
      simulateInState(state, {
        clientId: "client-mert",
        body: "Merhaba",
        idempotencyKey: "phase76n-removed",
      }),
    ).rejects.toThrowError(/client_removed_anonymized/);
  });

  it("includes food rule export files in the phase 74 export package", () => {
    const state = saveFormResponseInState(createInitialState(), {
      clientId: "client-mert",
      schemaId: DEMO_FORM_SCHEMA_ID,
      submittedPhoneE164: "+905551110001",
      answers: buildPhase70QualifiedClientAnswers(),
    });
    const exportPackage = buildPhase74ExportPackage(state, "client-mert");

    expect(exportPackage.manifest.includedFiles).toContain("structured_food_rules.json");
    expect(exportPackage.manifest.includedFiles).toContain("client_update_proposals.json");
    expect(exportPackage.files["structured_food_rules.json"]).toContain("forbiddenFoodItems");
  });
});
