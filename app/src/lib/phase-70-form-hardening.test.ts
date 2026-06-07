import { describe, expect, it } from "vitest";
import { buildClientFormSummary, saveClientFormResponseInState } from "./client-forms";
import { createInitialState } from "./seed-data";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import {
  buildAnswerabilityFieldManifest,
  evaluateClientAutopilotQualification,
  isPromptVisibleField,
  sanitizePromptSummaryValue,
} from "./phase-70-form-hardening";
import { PHASE_70_CLIENT_FIELDS, PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS } from "./phase-70-form-registry";
import { runInboundSimulation } from "./simulator";

describe("phase 70 form hardening", () => {
  it("never exposes sensitive or system-rule fields in prompt summaries", () => {
    const state = createInitialState();
    const summary = buildClientFormSummary(state, "client-mert");

    expect(summary).toContain("Ana hedef");
    expect(summary).not.toContain("Hassas veri onayi");
    expect(summary).not.toContain("Yetiskin/minor");
    expect(summary).not.toContain("Diyetisyen ic notlari");
  });

  it("classifies registry fields with answerability and prompt access metadata", () => {
    const answerabilityField = PHASE_70_CLIENT_FIELDS.find((field) => field.id === "active_diet_plan_summary");
    const sensitiveField = PHASE_70_CLIENT_FIELDS.find((field) => field.id === "dietitian_only_notes");

    expect(answerabilityField?.answerabilityRole).toBe("answerability_source");
    expect(isPromptVisibleField(answerabilityField!)).toBe(true);
    expect(isPromptVisibleField(sensitiveField!)).toBe(false);
  });

  it("sanitizes long prompt summary values", () => {
    const field = PHASE_70_CLIENT_FIELDS.find((item) => item.id === "primary_goal")!;
    const longText = "a".repeat(300);
    const sanitized = sanitizePromptSummaryValue(longText, field);

    expect(sanitized.length).toBeLessThanOrEqual(240);
    expect(sanitized.endsWith("...")).toBe(true);
  });

  it("marks seeded autopilot client as qualified", () => {
    const state = createInitialState();
    const result = evaluateClientAutopilotQualification(state, "client-mert");

    expect(result.status).toBe("qualified");
    expect(result.missing).toEqual([]);
    expect(result.answerabilityFieldIds.length).toBeGreaterThan(0);
  });

  it("blocks autopilot when minimum client form fields are incomplete", async () => {
    let state = createInitialState();
    state = {
      ...state,
      clientFormResponses: [],
    };

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvalti icin pratik bir degisim onerir misin?",
      idempotencyKey: "phase70-incomplete-1",
      now: "2026-05-22T10:01:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("autopilot_qualification_incomplete");
    expect(next.lastSimulation?.reasons).toContain("published_client_form_response_missing");
  });

  it("marks non-adult clients as not qualified", () => {
    const state = createInitialState();
    const deniz = state.clients.find((client) => client.id === "client-deniz");
    const result = evaluateClientAutopilotQualification(state, deniz?.id || "");

    expect(result.status).toBe("not_qualified");
    expect(result.missing).toContain("adult_status_not_adult");
  });

  it("builds answerability manifest from populated source fields", () => {
    const state = createInitialState();
    const manifest = buildAnswerabilityFieldManifest(state, "client-mert");

    expect(manifest.some((entry) => entry.fieldId === "active_diet_plan_summary")).toBe(true);
    expect(manifest.every((entry) => entry.hasValue)).toBe(true);
  });

  it("requires all minimum autopilot field ids in qualification checks", () => {
    expect(PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS).toHaveLength(22);
  });

  it("invalidates drafts when prompt-visible form answers change", async () => {
    let state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "phase70-draft-1",
    });
    const draft = state.messages.find((message) => message.status === "draft");
    const schema = state.clientFormSchemas.find((item) => item.status === "published");

    state = saveClientFormResponseInState(state, "client-elif", schema?.id || "", {
      ...buildPhase70QualifiedClientAnswers(),
      ai_mode: "copilot",
      work_school_schedule: "Works late and skips breakfast.",
    });

    expect(state.messages.find((message) => message.id === draft?.id)?.status).toBe("blocked");
  });
});
