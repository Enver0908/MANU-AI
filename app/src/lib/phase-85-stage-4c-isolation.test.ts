import { describe, expect, it } from "vitest";
import {
  verifyStage4CCopilotTabRemoved,
  verifyStage4CSourceIsolation,
} from "./phase-85-stage-4c-isolation";

describe("phase 85 stage 4c isolation", () => {
  it("blocks Stage 4C AI Chat code from importing legacy internal copilot modules", () => {
    const report = verifyStage4CSourceIsolation();
    expect(report.verified).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.scannedFileCount).toBeGreaterThan(0);
  });

  it("removes hidden legacy copilot render entry points", () => {
    const report = verifyStage4CCopilotTabRemoved();
    expect(report.verified).toBe(true);
    expect(report.violations).toEqual([]);
  });
});
