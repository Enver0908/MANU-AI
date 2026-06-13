import { describe, expect, it } from "vitest";
import {
  evaluateFoodDecisionV2GoldenCase,
  evaluatePhase77kFoodDecisionV2GoldenSuite,
  loadFoodDecisionV2GoldenCases,
  PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION,
} from "./phase-77k-food-decision-v2-golden";

describe("phase 77k food decision v2 golden suite", () => {
  it("loads fourteen golden categories from jsonl", () => {
    const cases = loadFoodDecisionV2GoldenCases();
    expect(cases).toHaveLength(14);
    expect(cases.map((item) => item.category)).toContain("allowed_food");
    expect(cases.map((item) => item.category)).toContain("pregnancy_context");
  });

  it("evaluates each golden case independently", () => {
    for (const goldenCase of loadFoodDecisionV2GoldenCases()) {
      const result = evaluateFoodDecisionV2GoldenCase(goldenCase);
      expect(result.passed, `${goldenCase.id}: ${result.failures.join(", ")}`).toBe(true);
    }
  });

  it("passes bundled golden metrics with zero inappropriate approvals", () => {
    const metrics = evaluatePhase77kFoodDecisionV2GoldenSuite();
    expect(metrics.goldenVersion).toBe(PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION);
    expect(metrics.status).toBe("pass");
    expect(metrics.passedCaseCount).toBe(14);
    expect(metrics.inappropriateApprovalCount).toBe(0);
    expect(metrics.forbiddenFoodApprovalCount).toBe(0);
    expect(metrics.categoryCoverage.length).toBeGreaterThanOrEqual(14);
  });
});
