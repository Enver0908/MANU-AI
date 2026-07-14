import { describe, expect, it } from "vitest";
import { getFallbackState, runFallbackStage4B3WorkerTick } from "./app-state-store";

describe("phase 85 stage 4b-3 local worker runner", () => {
  it("runs one local Stage 4B-3 worker tick", async () => {
    const before = getFallbackState();
    const summary = await runFallbackStage4B3WorkerTick();
    const after = getFallbackState();

    expect(summary.version).toBe("p85-stage-4b3-local-worker-v1");
    expect(after).toBeTruthy();
    expect(after.mediaAssets.length).toBeGreaterThanOrEqual(before.mediaAssets.length);
  });
});
