import {
  isMetaProviderMediaFetch,
  resolveAllowlistedFixtureBytes,
} from "./phase-85-stage-4b3-fixture-resolver";
import type { Stage4B3MediaTransportPort } from "./phase-85-stage-4b3-media-transport";

export const STAGE_4B3_DURABLE_MEDIA_TRANSPORT_VERSION = "p85-stage-4b3-durable-media-transport-v1";

export function createStage4B3DurableMediaTransport(): Stage4B3MediaTransportPort {
  return {
    async fetchProviderMedia(providerMediaId) {
      if (!providerMediaId.trim()) {
        return { ok: false, failureCode: "missing_provider_media_id" };
      }
      if (isMetaProviderMediaFetch(providerMediaId)) {
        return { ok: false, failureCode: "transport_unavailable" };
      }
      const fixture = await resolveAllowlistedFixtureBytes(providerMediaId);
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
