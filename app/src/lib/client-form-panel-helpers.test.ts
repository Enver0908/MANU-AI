import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  buildClientFormAnswersPayload,
  buildInitialClientFormAnswers,
  getPromptAccessLabel,
  groupFormFieldsBySection,
  hasFormFieldValue,
  summarizeAutopilotFieldStatus,
} from "./client-form-panel-helpers";
import { PHASE_70_CLIENT_FIELDS, toFormFieldDefinition } from "./phase-70-form-registry";

describe("client form panel helpers", () => {
  it("groups schema fields by section in numeric order", () => {
    const fields = PHASE_70_CLIENT_FIELDS.map(toFormFieldDefinition);
    const sections = groupFormFieldsBySection(fields);
    expect(sections[0]?.[0]).toBe("2.1");
    expect(sections.at(-1)?.[0]).toBe("2.10");
    expect(sections.find(([key]) => key === "2.3")?.[1].some((field) => field.id === "primary_goal")).toBe(true);
  });

  it("maps prompt access labels for dietitian-facing cues", () => {
    expect(getPromptAccessLabel("prompt_allowed")).toBe("AI prompt");
    expect(getPromptAccessLabel("dietitian_only")).toBe("Diyetisyen");
    expect(getPromptAccessLabel("sensitive_never_prompt")).toBe("Hassas");
  });

  it("prefills answers from client record without overwriting saved response", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert");
    const response = state.clientFormResponses.find((item) => item.clientId === "client-mert") || null;
    expect(client).toBeTruthy();

    const answers = buildInitialClientFormAnswers(client!, response);
    expect(answers.first_name).toBe("Mert");
    expect(answers.mobile_phone_e164).toBe("+905551110001");
    expect(hasFormFieldValue(answers.primary_goal)).toBe(true);
  });

  it("summarizes autopilot-required missing fields", () => {
    const fields = PHASE_70_CLIENT_FIELDS.map(toFormFieldDefinition);
    const status = summarizeAutopilotFieldStatus(fields, { first_name: "Ada" });
    expect(status.total).toBe(27);
    expect(status.complete).toBe(1);
    expect(status.missing).toContain("last_name");
  });

  it("normalizes save payload values by field type", () => {
    const fields = PHASE_70_CLIENT_FIELDS.map(toFormFieldDefinition);
    const payload = buildClientFormAnswersPayload(fields, {
      current_weight_kg: "82",
      nutrition_model: ["Akdeniz diyeti", "Aralikli oruc"],
      profession: "  Engineer  ",
      city: "",
    });
    expect(payload.current_weight_kg).toBe(82);
    expect(payload.nutrition_model).toEqual(["Akdeniz diyeti", "Aralikli oruc"]);
    expect(payload.profession).toBe("Engineer");
    expect(payload.city).toBeUndefined();
  });
});
