import { isMetaProviderMediaFetch } from "./phase-85-stage-4b3-fixture-resolver";
import { resolveAllowlistedStage4B4AudioFixtureBytes } from "./phase-85-stage-4b4-audio-fixture-resolver";

export const STAGE_4B4_AUDIO_TRANSPORT_VERSION = "p85-stage-4b4-audio-transport-v1";

export type Stage4B4AudioTransportFetchSuccess = {
  ok: true;
  bytes: Buffer;
  mimeType: string;
  sha256: string;
};

export type Stage4B4AudioTransportFetchFailure = {
  ok: false;
  failureCode: Stage4B4AudioTransportFailureCode;
};

export type Stage4B4AudioTransportFetchResult = Stage4B4AudioTransportFetchSuccess | Stage4B4AudioTransportFetchFailure;

export const STAGE_4B4_AUDIO_TRANSPORT_FAILURE_CODES = [
  "missing_provider_media_id",
  "transport_unavailable",
  "stream_too_large",
] as const;

export type Stage4B4AudioTransportFailureCode = (typeof STAGE_4B4_AUDIO_TRANSPORT_FAILURE_CODES)[number];

export type Stage4B4AudioTransportPort = {
  fetchProviderMedia(providerMediaId: string): Promise<Stage4B4AudioTransportFetchResult>;
};

export function createStage4B4DurableAudioTransport(): Stage4B4AudioTransportPort {
  return {
    async fetchProviderMedia(providerMediaId) {
      if (!providerMediaId.trim()) {
        return { ok: false, failureCode: "missing_provider_media_id" };
      }
      if (isMetaProviderMediaFetch(providerMediaId)) {
        return { ok: false, failureCode: "transport_unavailable" };
      }
      const fixture = resolveAllowlistedStage4B4AudioFixtureBytes(providerMediaId);
      if (!fixture) {
        return { ok: false, failureCode: "transport_unavailable" };
      }
      return {
        ok: true,
        bytes: fixture.bytes,
        mimeType: fixture.mimeType,
        sha256: fixture.sha256,
      };
    },
  };
}
