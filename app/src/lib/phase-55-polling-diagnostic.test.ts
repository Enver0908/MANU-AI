import { describe, expect, it } from "vitest";
import {
  resolvePhase55PollingPolicyFromRuntime,
  shouldPausePhase55PollingAt,
} from "./phase-55-polling-diagnostic";

describe("phase 5.5 polling diagnostic policy", () => {
  it("keeps the current policy unless the trace-only B flag is explicit", () => {
    expect(resolvePhase55PollingPolicyFromRuntime({ traceEnabled: false })).toBe("current");
    expect(resolvePhase55PollingPolicyFromRuntime({ traceEnabled: true, policy: "current" })).toBe("current");
    expect(
      resolvePhase55PollingPolicyFromRuntime({
        traceEnabled: true,
        policy: "navigation_window_pause_cancel",
      }),
    ).toBe("navigation_window_pause_cancel");
  });

  it("pauses only while the navigation window is still open", () => {
    expect(shouldPausePhase55PollingAt("current", 10_500, 10_000)).toBe(false);
    expect(shouldPausePhase55PollingAt("navigation_window_pause_cancel", 10_500, 10_000)).toBe(true);
    expect(shouldPausePhase55PollingAt("navigation_window_pause_cancel", 10_500, 10_500)).toBe(false);
    expect(shouldPausePhase55PollingAt("navigation_window_pause_cancel", null, 10_000)).toBe(false);
  });
});
