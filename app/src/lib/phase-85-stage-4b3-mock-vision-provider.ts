import {
  buildInsufficientUnknownObservation,
  buildVisualObservationFromFixtureTemplate,
  createStage4B3VisionFixtureManifest,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
  type Stage4B3VisionFixtureManifest,
  type Stage4B3VisionFixtureSceneId,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import type {
  Stage4B3VisionProviderInput,
  Stage4B3VisionProviderPort,
  Stage4B3VisionProviderResult,
} from "./phase-85-stage-4b3-vision-provider";

export const STAGE_4B3_MOCK_VISION_PROVIDER_KIND = "p85-stage-4b3-mock-vision-provider-v1";

export type Stage4B3MockVisionProviderOptions = {
  manifest?: Stage4B3VisionFixtureManifest;
  simulateTimeout?: boolean;
  invalidOutput?: boolean;
  onAnalyze?: (input: Stage4B3VisionProviderInput) => void;
};

export function createStage4B3MockVisionProvider(
  options: Stage4B3MockVisionProviderOptions = {},
): Stage4B3VisionProviderPort {
  const manifest = options.manifest ?? createStage4B3VisionFixtureManifest();

  return {
    async analyze(input: Stage4B3VisionProviderInput): Promise<Stage4B3VisionProviderResult> {
      options.onAnalyze?.(input);

      if (!input.contentSha256?.trim()) {
        return { ok: false, failureCode: "missing_content_sha256", retryable: false };
      }

      if (options.simulateTimeout) {
        return { ok: false, failureCode: "provider_timeout", retryable: true };
      }

      if (options.invalidOutput) {
        return { ok: true, observation: { sceneType: "meal", leakedClinicalAdvice: "eat more sugar" } };
      }

      const sceneId = manifest[input.contentSha256] as Stage4B3VisionFixtureSceneId | undefined;
      if (!sceneId) {
        return { ok: true, observation: buildInsufficientUnknownObservation() };
      }

      const template = STAGE_4B3_VISION_FIXTURE_TEMPLATES[sceneId];
      return { ok: true, observation: buildVisualObservationFromFixtureTemplate(template) };
    },
  };
}
