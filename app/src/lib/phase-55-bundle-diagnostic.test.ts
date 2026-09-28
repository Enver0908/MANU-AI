import { describe, expect, it } from "vitest";
import {
  resolvePhase55BundlePolicyFromRuntime,
} from "./phase-55-bundle-diagnostic";

describe("phase 5.5 bundle diagnostic policy", () => {
  it("keeps the current eager policy unless the trace-only B flag is explicit", () => {
    expect(resolvePhase55BundlePolicyFromRuntime({ traceEnabled: false })).toBe("current_eager");
    expect(
      resolvePhase55BundlePolicyFromRuntime({
        traceEnabled: true,
        policy: "current_eager",
      }),
    ).toBe("current_eager");
    expect(
      resolvePhase55BundlePolicyFromRuntime({
        traceEnabled: true,
        policy: "deferred_dynamic",
      }),
    ).toBe("deferred_dynamic");
  });
});
