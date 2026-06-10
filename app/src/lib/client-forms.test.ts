import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import {
  buildClientFormSummary,
  createClientFormSchemaInState,
  publishClientFormSchemaInState,
  saveClientFormResponseInState,
} from "./client-forms";
import { runInboundSimulation } from "./simulator";

describe("dynamic client forms", () => {
  it("stores versioned responses and exposes only prompt-allowed answers", () => {
    let state = createClientFormSchemaInState(createInitialState(), {
      title: "Follow-up form",
      languageCode: "en",
      fields: [
        { id: "routine", label: "Routine", type: "textarea", required: true, llmVisibility: "prompt_allowed" },
        { id: "private", label: "Private", type: "textarea", required: false, llmVisibility: "never" },
      ],
    });
    const schema = state.clientFormSchemas.at(-1);
    state = publishClientFormSchemaInState(state, schema?.id || "");
    state = saveClientFormResponseInState(state, "client-mert", schema?.id || "", {
      routine: "Walks after dinner.",
      private: "Do not prompt this.",
    });

    expect(state.clientFormResponses.at(-1)?.schemaVersion).toBe(schema?.version);
    expect(state.clientFormResponses.at(-1)?.languageCode).toBe("en");
    expect(state.clients.find((client) => client.id === "client-mert")?.communicationLanguage).toBe("en");
    expect(buildClientFormSummary(state, "client-mert")).toContain("Walks after dinner");
    expect(buildClientFormSummary(state, "client-mert")).not.toContain("Do not prompt");
  });

  it("invalidates pending drafts when a promptable form response changes", async () => {
    let state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "form-draft-1",
    });
    const draft = state.messages.find((message) => message.status === "draft");
    const schema = state.clientFormSchemas.find((item) => item.status === "published");

    state = saveClientFormResponseInState(state, "client-elif", schema?.id || "", {
      ...buildPhase70QualifiedClientAnswers(),
      ai_mode: "copilot",
      work_hours: "Works late.",
    });

    expect(state.messages.find((message) => message.id === draft?.id)?.status).toBe("blocked");
    expect(state.aiDecisions.find((decision) => decision.id === draft?.generatedByAiDecisionId)?.sendStatus).toBe(
      "draft_invalidated",
    );
  });

  it("rejects form responses submitted for a mismatched phone number", () => {
    const state = createInitialState();
    const schema = state.clientFormSchemas.find((item) => item.status === "published");

    expect(() =>
      saveClientFormResponseInState(
        state,
        "client-mert",
        schema?.id || "",
        { ...buildPhase70QualifiedClientAnswers(), primary_goal: "Updated goal summary." },
        new Date().toISOString(),
        { submittedPhoneE164: "+905551110099" },
      ),
    ).toThrowError(/form_phone_client_mismatch/);
  });
});
