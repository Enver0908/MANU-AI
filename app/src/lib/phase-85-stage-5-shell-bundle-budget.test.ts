import { describe, expect, it } from "vitest";
import {
  STAGE5_SHELL_BUNDLE_BUDGET_MULTIPLIER,
  evaluateShellBundleBudget,
  gzipByteLength,
} from "./phase-85-stage-5-shell-bundle-budget";

describe("phase-85-stage-5-shell-bundle-budget", () => {
  it("enforces +10% ceiling over locked baseline", () => {
    expect(STAGE5_SHELL_BUNDLE_BUDGET_MULTIPLIER).toBe(1.1);
    expect(evaluateShellBundleBudget(110, 100).withinBudget).toBe(true);
    expect(evaluateShellBundleBudget(111, 100).withinBudget).toBe(false);
    expect(gzipByteLength(Buffer.from("hello shell"))).toBeGreaterThan(0);
  });
});
