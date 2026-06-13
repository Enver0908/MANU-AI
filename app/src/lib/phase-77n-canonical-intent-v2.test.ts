import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 77N canonical intent runtime", () => {
  it("routes unknown intent to handoff instead of autopilot send", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Merhaba",
      idempotencyKey: "phase-77n-unknown-1",
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(state.lastSimulation?.blockedReason).toBe("canonical_unknown_intent");

    const canonicalIntent = state.aiDecisions.at(-1)?.contextManifest?.canonicalIntent as {
      intentFamily?: string;
      allowed?: boolean;
      workflowState?: string;
    };

    expect(canonicalIntent?.intentFamily).toBe("unknown_intent");
    expect(canonicalIntent?.allowed).toBe(false);
    expect(canonicalIntent?.workflowState).toBe("clarify");
  });

  it("keeps substitution and food-rule intent families aligned across manifest layers", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Fistik yiyebilir miyim?",
      idempotencyKey: "phase-77n-forbidden-1",
      now: "2026-06-13T10:01:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      canonicalIntent?: { intentFamily?: string };
      greenIntent?: { intentFamily?: string | null; canonicalIntent?: { intentFamily?: string } };
      answerability?: { intentFamily?: string };
    };

    expect(manifest?.canonicalIntent?.intentFamily).toBe("green_forbidden_food_reminder");
    expect(manifest?.greenIntent?.intentFamily).toBe("green_forbidden_food_reminder");
    expect(manifest?.answerability?.intentFamily).toBe("green_forbidden_food_reminder");
  });
});
