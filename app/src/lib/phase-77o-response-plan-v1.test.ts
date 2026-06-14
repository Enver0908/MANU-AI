import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 77O response plan contract v1", () => {
  it("records responsePlan on successful green autopilot path", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "phase-77o-send-1",
      now: "2026-06-13T11:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      responsePlan?: {
        version?: string;
        replyMode?: string;
        templateId?: string;
        intentFamily?: string;
        sourceRefs?: unknown[];
      };
      claimManifest?: { version?: string };
      styleDna?: { version?: string };
    };

    expect(state.lastSimulation?.action).toBe("sent");
    expect(manifest?.responsePlan?.version).toBe("response-plan-v1-v0.1.0");
    expect(manifest?.responsePlan?.replyMode).toBe("send");
    expect(manifest?.responsePlan?.templateId).toBeTruthy();
    expect(manifest?.responsePlan?.intentFamily).toBe("green_allowed_substitution");
    expect(manifest?.responsePlan?.sourceRefs?.length).toBeGreaterThan(0);
    expect(manifest?.claimManifest?.version).toBe("claim-manifest-v1-v0.1.0");
    expect(manifest?.claimManifest?.claims?.length).toBeGreaterThan(0);
    expect(manifest?.styleDna?.version).toContain("style-dna");
  });

  it("does not call provider for unknown intent without provider-eligible responsePlan", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Merhaba",
      idempotencyKey: "phase-77o-unknown-1",
      now: "2026-06-13T11:01:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      responsePlan?: { replyMode?: string; providerEligible?: boolean };
    };

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(false);
    expect(manifest?.responsePlan).toBeUndefined();
  });

  it("records draft responsePlan on copilot path", async () => {
    const base = createInitialState();
    const client = base.clients.find((entry) => entry.id === "client-mert");
    if (!client) throw new Error("missing client");

    const state = await runInboundSimulation(
      {
        ...base,
        clients: base.clients.map((entry) =>
          entry.id === client.id ? { ...entry, aiMode: "copilot" as const } : entry,
        ),
      },
      {
        clientId: "client-mert",
        body: "Randevu saatini hatirlatir misin?",
        idempotencyKey: "phase-77o-draft-1",
        now: "2026-06-13T11:02:00.000Z",
      },
    );

    expect(state.lastSimulation?.action).toBe("draft_for_approval");
    expect(state.aiDecisions.at(-1)?.contextManifest?.responsePlan?.replyMode).toBe("draft");
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(true);
  });
});
