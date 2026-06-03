import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { withApprovedPlaceholderScopeCorpus } from "./scope-corpus";
import { applyScopeGuardToRiskDecision } from "./scope-guard-runtime";
import { classifyClinicalSafetyRisk } from "dietitian-ai-assistant-architecture";

describe("scope guard runtime", () => {
  it("no-ops when corpus is inactive", async () => {
    const state = createInitialState();
    const baseDecision = classifyClinicalSafetyRisk({
      message: "Can you change my diet plan?",
      recentMessages: [],
      clientProfile: { healthProfile: {} },
    });

    const result = await applyScopeGuardToRiskDecision({
      state,
      message: "Can you change my diet plan?",
      baseDecision,
    });

    expect(result.corpusActive).toBe(false);
    expect(result.decision.level).toBe(baseDecision.level);
    expect(result.evaluationRecord?.status).toBe("noop");
  });

  it("escalates green message when approved corpus matches plan change", async () => {
    const state = withApprovedPlaceholderScopeCorpus(createInitialState(), createInitialState().dietitian.id);
    const baseDecision = classifyClinicalSafetyRisk({
      message: "Can you change my diet plan and calorie target?",
      recentMessages: [],
      clientProfile: { healthProfile: {} },
    });

    const result = await applyScopeGuardToRiskDecision({
      state,
      message: "Can you change my diet plan and calorie target?",
      baseDecision,
    });

    expect(result.corpusActive).toBe(true);
    expect(["yellow", "red"]).toContain(result.decision.level);
    expect(result.evaluationRecord?.status).toBe("matched");
    expect((result.evaluationRecord?.matchedRuleIds || []).length).toBeGreaterThan(0);
  });

  it("does not store raw message text in evaluation record", async () => {
    const state = withApprovedPlaceholderScopeCorpus(createInitialState(), createInitialState().dietitian.id);
    const message = "Please adjust insulin dose for me";
    const baseDecision = classifyClinicalSafetyRisk({
      message,
      recentMessages: [],
      clientProfile: { healthProfile: {} },
    });

    const result = await applyScopeGuardToRiskDecision({ state, message, baseDecision });
    const serialized = JSON.stringify(result.evaluationRecord);
    expect(serialized).not.toContain(message);
  });
});
