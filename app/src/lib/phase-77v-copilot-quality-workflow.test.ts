import { describe, expect, it } from "vitest";
import { buildPhase74ExportPackage } from "./phase-74-data-lifecycle-policy";
import { exportClientInState, simulateInState } from "./app-state-store";
import { approveDraftMessageInState } from "./simulator";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { createInitialState } from "./seed-data";
import { patchClientInState } from "./app-state-store";
import {
  COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  PHASE_77V_COPILOT_QUALITY_WORKFLOW_VERSION,
  assertStyleEditDoesNotMutateClinicalDecision,
  buildDraftCopilotQualityReviewContext,
  detectClientExportMetadataLeaks,
  evaluatePhase77vClientExportSafety,
} from "./phase-77v-copilot-quality-workflow";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

function seedCopilotDraftState() {
  const published = seedPublishedFormResponse();
  const copilotState = patchClientInState(published, "client-mert", { aiMode: "copilot" });
  return simulateInState(copilotState, {
    clientId: "client-mert",
    body: "Ara ogun icin ne yiyebilirim?",
    idempotencyKey: "phase-77v-draft",
    now: "2026-06-13T12:00:00.000Z",
  });
}

describe("phase 77v copilot quality workflow v1", () => {
  it("exposes workflow version", () => {
    expect(COPILOT_QUALITY_WORKFLOW_V1_VERSION).toBe("copilot-quality-workflow-v1-v0.1.0");
    expect(PHASE_77V_COPILOT_QUALITY_WORKFLOW_VERSION).toBe("phase-77v-copilot-quality-workflow-v1");
  });

  it("sanitizes client export and phase74 ai_decisions.jsonl", async () => {
    const state = await simulateInState(seedPublishedFormResponse(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "phase-77v-export",
      now: "2026-06-13T12:00:00.000Z",
    });

    const bundle = exportClientInState(state, "client-mert");
    const exportSafety = evaluatePhase77vClientExportSafety(bundle);
    expect(exportSafety.status).toBe("pass");
    expect(bundle.aiDecisions.every((decision) => decision.contextManifest == null)).toBe(true);
    expect(bundle.aiDecisions.every((decision) => decision.blockedReason == null)).toBe(true);

    const exportPackage = buildPhase74ExportPackage(state, "client-mert");
    const aiDecisionsJsonl = exportPackage.files["ai_decisions.jsonl"];
    expect(detectClientExportMetadataLeaks(aiDecisionsJsonl)).toEqual([]);
    expect(aiDecisionsJsonl).toContain("exportSanitizationVersion");
  });

  it("builds internal draft review context without exposing raw manifest objects in export paths", async () => {
    const state = await seedCopilotDraftState();

    const draft = state.messages.find((message) => message.status === "draft");
    expect(draft).toBeTruthy();

    const review = buildDraftCopilotQualityReviewContext(state, draft!.id);
    expect(review?.internalOnly).toBe(true);
    expect(review?.responsePlanSummary).toBeTruthy();
    expect(JSON.stringify(review)).not.toContain("style-dna-v2");
    expect(evaluatePhase77vClientExportSafety(exportClientInState(state, "client-mert")).status).toBe("pass");
  });

  it("keeps clinical decision snapshot stable when dietitian edits draft wording", async () => {
    const state = await seedCopilotDraftState();

    const draft = state.messages.find((message) => message.status === "draft");
    const decision = state.aiDecisions.find((item) => item.id === draft?.generatedByAiDecisionId);
    const beforePlan = (decision?.contextManifest as { responsePlan?: Record<string, unknown> } | null)?.responsePlan;

    const next = approveDraftMessageInState(state, draft!.id, "Duzenlenmis ama ayni klinik karar metni.");
    const afterDecision = next.aiDecisions.find((item) => item.id === decision?.id);
    const afterPlan = (afterDecision?.contextManifest as { responsePlan?: Record<string, unknown> } | null)?.responsePlan;

    expect(() => assertStyleEditDoesNotMutateClinicalDecision(beforePlan, afterPlan)).not.toThrow();
    expect(next.styleEditHistory.length).toBeGreaterThan(0);
  });
});
