import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77P deterministic template library v1", () => {
  it("renders ingredient label request for needs_label without diet plan echo", async () => {
    const state = await runInboundSimulation(seedPublishedFormResponse(), {
      clientId: "client-mert",
      body: "Bir tane cikolata yiyebilir miyim?",
      idempotencyKey: "phase-77p-needs-label-1",
      now: "2026-06-13T12:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      responsePlan?: { replyMode?: string; templateId?: string };
      deterministicClientMessage?: { templateId?: string; text?: string };
    };

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(manifest?.responsePlan?.replyMode).toBe("ask_label");
    expect(manifest?.responsePlan?.templateId).toBe("ingredient_label_request_v1");
    expect(manifest?.deterministicClientMessage?.templateId).toBe("ingredient_label_request_v1");
    expect(manifest?.deterministicClientMessage?.text).toMatch(/icindekiler|etiket/i);
    expect(manifest?.deterministicClientMessage?.text).not.toMatch(/kahvalti|ogle|aksam|Three meals/i);
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(false);
  });

  it("uses template-backed provider draft on copilot path", async () => {
    const base = seedPublishedFormResponse();
    const state = await runInboundSimulation(
      {
        ...base,
        clients: base.clients.map((entry) =>
          entry.id === "client-mert" ? { ...entry, aiMode: "copilot" as const } : entry,
        ),
      },
      {
        clientId: "client-mert",
        body: "Randevu saatini hatirlatir misin?",
        idempotencyKey: "phase-77p-draft-1",
        now: "2026-06-13T12:01:00.000Z",
      },
    );

    const draft = state.messages.filter((message) => message.status === "draft").at(-1)?.body;
    expect(state.lastSimulation?.action).toBe("draft_for_approval");
    expect(draft).toBeTruthy();
    expect(draft).not.toContain("Three meals");
    expect(state.aiDecisions.at(-1)?.contextManifest?.responsePlan?.templateId).toBeTruthy();
  });

  it("keeps unknown intent on handoff without provider generation", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Merhaba",
      idempotencyKey: "phase-77p-clarify-1",
      now: "2026-06-13T12:02:00.000Z",
    });

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(false);
  });
});
