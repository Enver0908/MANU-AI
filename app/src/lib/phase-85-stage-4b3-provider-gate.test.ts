import { describe, expect, it } from "vitest";
import {
  evaluateStage4B3VisionProviderGate,
  isStage4B3MockVisionAllowed,
  isStage4B3RealVisionEgressAllowed,
  STAGE_4B3_MOCK_VISION_ENV_FLAG,
} from "./phase-85-stage-4b3-provider-gate";

describe("phase-85-stage-4b3-provider-gate", () => {
  it("allows mock vision only when MANU_ALLOW_MOCK_VISION is true", () => {
    expect(isStage4B3MockVisionAllowed({ [STAGE_4B3_MOCK_VISION_ENV_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isStage4B3MockVisionAllowed({ [STAGE_4B3_MOCK_VISION_ENV_FLAG]: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isStage4B3MockVisionAllowed({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("keeps real vision egress disabled even when explicitly requested", () => {
    expect(isStage4B3RealVisionEgressAllowed()).toBe(false);
    const evaluation = evaluateStage4B3VisionProviderGate({
      MANU_ALLOW_REAL_VISION_EGRESS: "true",
    } as NodeJS.ProcessEnv);
    expect(evaluation.realVisionEgressAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain("mock_vision_gate_disabled");
    expect(evaluation.blockingReasons).toContain("real_vision_egress_forbidden");
  });
});
