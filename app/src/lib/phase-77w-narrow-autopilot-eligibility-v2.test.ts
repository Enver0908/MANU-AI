import { describe, expect, it } from "vitest";
import { evaluateNarrowAutopilotEligibilityV2 } from "dietitian-ai-assistant-architecture";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("phase 77W narrow autopilot eligibility v2", () => {
  it("keeps exact substitution golden path on autopilot send", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "phase-77w-send-1",
      now: "2026-06-14T10:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      narrowAutopilotEligibility?: { version?: string; eligible?: boolean; applies?: boolean; reasonCodes?: string[] };
      responsePlan?: { replyMode?: string };
      answerability?: { reasons?: string[] };
      foodRule?: { decision?: string; queryType?: string };
      foodDecisionV2?: unknown;
    };

    expect(manifest?.foodRule?.queryType).toBe("food_substitution");
    expect(state.lastSimulation?.action).toBe("sent");
    expect(manifest?.narrowAutopilotEligibility?.applies).toBe(true);
    expect(manifest?.narrowAutopilotEligibility?.eligible).toBe(true);
    expect(manifest?.responsePlan?.replyMode).toBe("send");
  });

  it("downgrades vague substitution autopilot to draft_for_approval", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvalti icin pratik bir degisim onerir misin?",
      idempotencyKey: "phase-77w-draft-1",
      now: "2026-06-14T10:01:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      narrowAutopilotEligibility?: { eligible?: boolean; reasonCodes?: string[] };
      responsePlan?: { replyMode?: string };
      answerability?: { reasons?: string[] };
      foodRule?: { decision?: string; queryType?: string };
    };

    expect(manifest?.narrowAutopilotEligibility?.eligible).toBe(false);
    expect(state.lastSimulation?.action).toBe("draft_for_approval");
    expect(manifest?.narrowAutopilotEligibility?.reasonCodes).toContain("alias_not_exact_or_approved");
    expect(manifest?.responsePlan?.replyMode).toBe("draft");
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(true);
  });

  it("keeps unknown intent on handoff without narrow autopilot send", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Merhaba",
      idempotencyKey: "phase-77w-unknown-1",
      now: "2026-06-14T10:02:00.000Z",
    });

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(state.aiDecisions.at(-1)?.providerAttempted).toBe(false);
  });

  it("evaluates unit-level logistics path as narrow-autopilot eligible", () => {
    const result = evaluateNarrowAutopilotEligibilityV2({
      clientAiMode: "autopilot",
      riskDecision: { level: "green" },
      modeDecision: { action: "auto_send", reason: "green_autopilot" },
      canonicalIntent: { intentFamily: "green_logistics", allowed: true, workflowState: "send" },
      greenIntent: { allowed: true, intentFamily: "green_logistics", decision: "green_intent_allowed" },
      answerability: { allowed: true, decision: "source_backed_green", reasons: ["intent_specific_source_backed_green"] },
      responsePlan: {
        intentFamily: "green_logistics",
        replyMode: "send",
        templateId: "logistics_reply_v1",
        sourceRefs: [{ id: "plan-1", category: "active_diet_plan" }],
        claimManifest: {
          version: "claim-manifest-v1-v0.1.0",
          complete: true,
          claims: [{ type: "logistics_guidance" }],
        },
      },
    });

    expect(result.eligible).toBe(true);
  });
});
