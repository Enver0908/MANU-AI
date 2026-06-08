import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("intent-specific answerability runtime", () => {
  it("records food-rule-backed forbidden intent on autopilot green path", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Fistik yiyebilir miyim?",
      idempotencyKey: "phase76f-forbidden-1",
      now: "2026-06-08T10:00:00.000Z",
    });

    const answerability = state.aiDecisions.at(-1)?.contextManifest?.answerability as {
      intentFamily?: string;
      foodRuleDecision?: string;
      decision?: string;
    } | undefined;

    expect(state.lastSimulation?.action).toBe("sent");
    expect(answerability?.intentFamily).toBe("green_forbidden_food_reminder");
    expect(answerability?.foodRuleDecision).toBe("forbidden_food_rejection");
    expect(answerability?.decision).toBe("source_backed_green");
  });

  it("allows legacy substitution path with active diet plan when structured engine is not required", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "phase76f-swap-1",
      now: "2026-06-08T10:01:00.000Z",
    });

    const answerability = state.aiDecisions.at(-1)?.contextManifest?.answerability as {
      intentFamily?: string;
      decision?: string;
    } | undefined;

    expect(state.lastSimulation?.action).toBe("sent");
    expect(answerability?.decision).toBe("source_backed_green");
    expect(answerability?.intentFamily).toBe("green_allowed_substitution");
  });
});
