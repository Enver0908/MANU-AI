import { describe, expect, it } from "vitest";
import {
  buildStyleDnaV2,
  buildResponsePlanV1,
  clinicalSnapshotsEqual,
  detectHardStyleGuardViolations,
  extractClinicalDecisionSnapshot,
  measureSoftStyleMismatch,
} from "dietitian-ai-assistant-architecture";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { runInboundSimulation } from "./simulator";
import { buildStyleDnaV2ContextFromState } from "./phase-77s-dietitian-voice-engine-v2";
import {
  getStyleEditHistorySignals,
  recordStyleEditHistoryInState,
} from "./phase-77s-style-edit-history";
import { createInitialState } from "./seed-data";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77s dietitian voice engine v2", () => {
  it("builds tenant/dietitian scoped styleDna from state", () => {
    const state = seedPublishedFormResponse();
    const styleDna = buildStyleDnaV2ContextFromState(state, "client-mert");
    expect(styleDna.version).toBe("style-dna-v2-v0.1.0");
    expect(styleDna.scope).toContain("tenant-manu-demo");
    expect(styleDna.clinicalIsolation).toBe(true);
  });

  it("does not let style variants change clinical response-plan decisions", () => {
    const base = {
      riskDecision: { level: "green" as const },
      canonicalIntent: {
        intentFamily: "green_allowed_substitution",
        allowed: true,
        workflowState: null,
        reasons: [],
      },
      greenIntent: { intentFamily: "green_allowed_substitution", allowed: true, reasons: [] },
      answerability: {
        allowed: true,
        intentFamily: "green_allowed_substitution",
        reasons: [],
        sourceCategories: ["active_diet_plan"],
      },
      foodDecisionV2: {
        decision: "allow",
        reasonCodes: ["food_decision_v2_on_menu"],
        queryType: "food_permission",
      },
      modeDecision: { action: "auto_send", reason: "autopilot_green" },
      tenantId: "tenant-manu-demo",
      dietitianId: "dietitian-demo",
    };

    const formalPlan = buildResponsePlanV1({
      ...base,
      voiceProfile: {
        averageMessageChars: 80,
        formality: "formal",
        emojiPolicy: "none",
        commonGreetings: ["Merhaba"],
        commonClosings: [],
        styleNotes: "Kisa",
      },
    });
    const informalPlan = buildResponsePlanV1({
      ...base,
      voiceProfile: {
        averageMessageChars: 240,
        formality: "informal",
        emojiPolicy: "regular",
        commonGreetings: ["Selam"],
        commonClosings: ["Kolay gelsin"],
        styleNotes: "Uzun",
      },
    });

    expect(
      clinicalSnapshotsEqual(
        extractClinicalDecisionSnapshot(formalPlan),
        extractClinicalDecisionSnapshot(informalPlan),
      ),
    ).toBe(true);
    expect(formalPlan.styleDna.warmthTone).not.toBe(informalPlan.styleDna.warmthTone);
  });

  it("records edit-history signals without storing raw draft text", () => {
    let state = seedPublishedFormResponse();
    state = recordStyleEditHistoryInState(state, {
      aiDraft: "Merhaba, bugun planina uygun ilerleyebilirsin.",
      dietitianFinal: "Merhaba, bugun planina uygun ilerleyebilirsin. Kolay gelsin.",
      clientId: "client-mert",
    });

    expect(state.styleEditHistory).toHaveLength(1);
    expect(state.styleEditHistory[0].aiDraftHash).toBeTruthy();
    expect((state.styleEditHistory[0] as { aiDraft?: string }).aiDraft).toBeUndefined();
    expect(getStyleEditHistorySignals(state).sampleCount).toBe(1);
  });

  it("enforces hard emoji guard and measures soft mismatch separately", () => {
    const styleDna = buildStyleDnaV2({
      tenantId: "tenant-manu-demo",
      dietitianId: "dietitian-demo",
      voiceProfile: {
        averageMessageChars: 140,
        formality: "formal",
        emojiPolicy: "none",
        commonGreetings: [],
        commonClosings: [],
        styleNotes: "",
      },
    });

    expect(detectHardStyleGuardViolations("Planina uygun ilerleyebilirsin 🙂", styleDna)).toContain(
      "style_hard_emoji_forbidden",
    );
    const mismatch = measureSoftStyleMismatch("Canim harika gidiyorsun", styleDna);
    expect(mismatch.hardBlock).toBe(false);
    expect(mismatch.exceedsThreshold).toBe(true);
  });

  it("records styleDna v2 on successful autopilot simulation", async () => {
    const state = await runInboundSimulation(seedPublishedFormResponse(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "phase-77s-style-1",
      now: "2026-06-13T12:00:00.000Z",
    });

    const styleDna = state.aiDecisions.at(-1)?.contextManifest?.styleDna as { version?: string } | undefined;
    expect(styleDna?.version).toBe("style-dna-v2-v0.1.0");
  });
});
