import { createHash } from "node:crypto";
import type { Stage4B3MediaAdmissionFailureCode } from "./phase-85-stage-4b3-image-admission";
import { hashMediaBytes, isAllowedDeclaredMimeType } from "./phase-85-stage-4b3-image-admission";

export const STAGE_4B3_MEDIA_TRANSPORT_VERSION = "p85-stage-4b3-media-transport-v1";

export type Stage4B3MockMediaRegistryEntry = {
  bytes: Buffer;
  mimeType: string;
  sha256: string;
};

export type Stage4B3MockMediaRegistry = Map<string, Stage4B3MockMediaRegistryEntry>;

export type Stage4B3MediaTransportFetchSuccess = {
  ok: true;
  bytes: Buffer;
  mimeType: string;
  sha256: string;
};

export type Stage4B3MediaTransportFetchFailure = {
  ok: false;
  failureCode: Stage4B3MediaAdmissionFailureCode;
};

export type Stage4B3MediaTransportFetchResult = Stage4B3MediaTransportFetchSuccess | Stage4B3MediaTransportFetchFailure;

export type Stage4B3MediaTransportPort = {
  fetchProviderMedia(providerMediaId: string): Promise<Stage4B3MediaTransportFetchResult>;
};

export function createEmptyStage4B3MockMediaRegistry(): Stage4B3MockMediaRegistry {
  return new Map();
}

export function registerStage4B3MockMediaAsset(
  registry: Stage4B3MockMediaRegistry,
  providerMediaId: string,
  bytes: Buffer,
  mimeType: string,
): Stage4B3MockMediaRegistryEntry {
  if (!isAllowedDeclaredMimeType(mimeType)) {
    throw new Error("mock_media_mime_not_allowed");
  }
  const entry: Stage4B3MockMediaRegistryEntry = {
    bytes,
    mimeType,
    sha256: hashMediaBytes(bytes),
  };
  registry.set(providerMediaId, entry);
  return entry;
}

export function createInMemoryStage4B3MediaTransport(registry: Stage4B3MockMediaRegistry): Stage4B3MediaTransportPort {
  return {
    async fetchProviderMedia(providerMediaId) {
      if (!providerMediaId.trim()) {
        return { ok: false, failureCode: "missing_provider_media_id" };
      }
      const entry = registry.get(providerMediaId);
      if (!entry) {
        return { ok: false, failureCode: "transport_unavailable" };
      }
      return {
        ok: true,
        bytes: entry.bytes,
        mimeType: entry.mimeType,
        sha256: entry.sha256,
      };
    },
  };
}

export function hashProviderMediaId(providerMediaId: string): string {
  return createHash("sha256").update(providerMediaId).digest("hex");
}
