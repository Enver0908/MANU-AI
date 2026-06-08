import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 76g clinical second-layer false-yellow calibration", () => {
  it("keeps seeded forbidden-food question green without false yellow on risk assessment", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Peanut yiyebilir miyim?",
      idempotencyKey: "phase76g-forbidden-risk-1",
      now: "2026-06-08T11:00:00.000Z",
    });

    const riskAssessment = state.riskAssessments.at(-1);
    expect(state.lastSimulation?.action).toBe("sent");
    expect(riskAssessment?.level).toBe("green");
    expect(riskAssessment?.classifierVersion).toContain("clinical-safety-second-layer-v0.2.0");
    expect(riskAssessment?.reasons).not.toContain("second_layer_client_allergy_or_restriction_mentioned");
  });

  it("does not carve out ingestion reaction messages", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Peanut yedim ve kasiniyorum",
      idempotencyKey: "phase76g-reaction-1",
      now: "2026-06-08T11:01:00.000Z",
    });

    expect(state.lastSimulation?.action).not.toBe("sent");
    expect(state.riskAssessments.at(-1)?.level).not.toBe("green");
  });
});
