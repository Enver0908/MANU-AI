import { assertMockVoiceTranscriptionAllowed } from "./phase-85-stage-4b4-provider-gate";
import {
  buildTranscriptionObservationForScene,
  createStage4B4TranscriptionFixtureManifest,
  type Stage4B4TranscriptionFixtureManifest,
  type Stage4B4TranscriptionFixtureSceneId,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import type {
  Stage4B4TranscriptionProviderInput,
  Stage4B4TranscriptionProviderPort,
  Stage4B4TranscriptionProviderResult,
} from "./phase-85-stage-4b4-transcription-provider";

export const STAGE_4B4_MOCK_TRANSCRIPTION_PROVIDER_KIND = "p85-stage-4b4-mock-transcription-provider-v1";

export type Stage4B4MockTranscriptionProviderOptions = {
  env?: NodeJS.ProcessEnv;
  manifest?: Stage4B4TranscriptionFixtureManifest;
  simulateTimeout?: boolean;
  invalidOutput?: boolean;
  onTranscribe?: (input: Stage4B4TranscriptionProviderInput) => void;
};

export function createStage4B4MockTranscriptionProvider(
  options: Stage4B4MockTranscriptionProviderOptions = {},
): Stage4B4TranscriptionProviderPort {
  const env = options.env ?? process.env;
  const manifest = options.manifest ?? createStage4B4TranscriptionFixtureManifest();

  return {
    async transcribe(input: Stage4B4TranscriptionProviderInput): Promise<Stage4B4TranscriptionProviderResult> {
      try {
        assertMockVoiceTranscriptionAllowed(env);
      } catch {
        return { ok: false, failureCode: "provider_gate_disabled", retryable: false };
      }

      options.onTranscribe?.(input);

      if (!input.contentSha256?.trim()) {
        return { ok: false, failureCode: "missing_content_sha256", retryable: false };
      }
      if (!input.wavBytes?.byteLength) {
        return { ok: false, failureCode: "missing_wav_bytes", retryable: false };
      }

      if (options.simulateTimeout) {
        return { ok: false, failureCode: "provider_timeout", retryable: true };
      }

      if (options.invalidOutput) {
        return { ok: true, observation: { leakedProviderPayload: true } };
      }

      const sceneId = manifest[input.contentSha256] as Stage4B4TranscriptionFixtureSceneId | undefined;
      if (!sceneId) {
        return { ok: false, failureCode: "unknown_fixture", retryable: false };
      }

      return {
        ok: true,
        observation: buildTranscriptionObservationForScene(sceneId),
      };
    },
  };
}
