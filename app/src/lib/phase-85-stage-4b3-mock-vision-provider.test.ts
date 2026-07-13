import { describe, expect, it, vi } from "vitest";
import { createStage4B3MockVisionProvider } from "./phase-85-stage-4b3-mock-vision-provider";
import {
  buildVisualObservationFromFixtureTemplate,
  createStage4B3VisionFixtureManifest,
  registerStage4B3VisionFixtureHash,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";

describe("phase-85-stage-4b3-mock-vision-provider", () => {
  it("returns deterministic fixture observations keyed by sanitized hash", async () => {
    const hash = "fixture-hash-meal";
    const manifest = registerStage4B3VisionFixtureHash(createStage4B3VisionFixtureManifest(), hash, "meal_plate");
    const provider = createStage4B3MockVisionProvider({ manifest });

    const first = await provider.analyze({ contentSha256: hash, detectedMimeType: "image/jpeg" });
    const second = await provider.analyze({ contentSha256: hash, detectedMimeType: "image/jpeg" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.observation).toEqual(second.observation);
    expect(first.observation).toEqual(buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate));
  });

  it("returns insufficient unknown observation for unregistered hashes", async () => {
    const provider = createStage4B3MockVisionProvider();
    const result = await provider.analyze({ contentSha256: "unknown-hash", detectedMimeType: "image/jpeg" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation).toMatchObject({
      sceneType: "unknown",
      overallConfidence: 0.15,
      qualityFlags: expect.arrayContaining(["insufficient"]),
    });
  });

  it("does not perform external network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network should not be used"));
    const provider = createStage4B3MockVisionProvider();
    await provider.analyze({ contentSha256: "hash", detectedMimeType: "image/jpeg" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("surfaces retryable timeout failures for worker retry logic", async () => {
    const provider = createStage4B3MockVisionProvider({ simulateTimeout: true });
    const result = await provider.analyze({ contentSha256: "hash", detectedMimeType: "image/jpeg" });
    expect(result).toEqual({ ok: false, failureCode: "provider_timeout", retryable: true });
  });
});
