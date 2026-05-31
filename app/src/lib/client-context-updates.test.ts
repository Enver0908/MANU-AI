import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { createClientContextUpdateInState } from "./client-context-updates";
import { runInboundSimulation, updateClientInState } from "./simulator";
import { buildClientScopedExport, anonymizeClientInState } from "./data-governance";

describe("client context updates", () => {
  it("stores dietitian-confirmed context, increments revision, and audits the update", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert");
    const next = createClientContextUpdateInState(state, "client-mert", {
      source: "phone",
      occurredAt: "2026-05-30T12:00:00.000Z",
      title: "Phone follow-up",
      summary: "Client will travel tomorrow and needs portable snack guidance.",
      details: "Dietitian confirmed yogurt is not practical during travel.",
      importance: "critical",
    });

    expect(next.clientContextUpdates).toHaveLength(1);
    expect(next.clients.find((item) => item.id === "client-mert")?.contextRevision).toBe(
      (client?.contextRevision || 0) + 1,
    );
    expect(next.auditEvents.some((event) => event.eventType === "client_context_update_created")).toBe(true);
    expect(next.messages.at(-1)?.body).toContain("Dietitian context update added");
  });

  it("invalidates pending drafts for the same client", async () => {
    const draftState = await runInboundSimulation(
      updateClientInState(createInitialState(), "client-elif", { clinicalRiskNotes: [] }),
      {
        clientId: "client-elif",
        body: "Bugun kahvaltida ne yiyebilirim?",
        idempotencyKey: "context-update-draft",
      },
    );
    const draft = draftState.messages.find((message) => message.status === "draft");

    const next = createClientContextUpdateInState(draftState, "client-elif", {
      source: "zoom",
      title: "Zoom check-in",
      summary: "Dietitian updated snack preference after the draft was created.",
      importance: "important",
    });

    expect(next.messages.find((message) => message.id === draft?.id)?.status).toBe("blocked");
    expect(next.aiDecisions.find((decision) => decision.id === draft?.generatedByAiDecisionId)?.sendStatus).toBe(
      "draft_invalidated",
    );
  });

  it("includes context updates in export and redacts them during anonymization", () => {
    const state = createClientContextUpdateInState(createInitialState(), "client-mert", {
      source: "in_person",
      title: "Clinic visit",
      summary: "Client reported a new work schedule.",
      details: "Long detail",
      importance: "important",
    });

    expect(buildClientScopedExport(state, "client-mert").clientContextUpdates).toHaveLength(1);

    const anonymized = anonymizeClientInState(state, "client-mert");
    const update = anonymized.clientContextUpdates[0];
    expect(update.title).toBe("[client data anonymized]");
    expect(update.details).toBe("");
    expect(update.status).toBe("superseded");
  });
});
