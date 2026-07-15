import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import {
  finalizeMediaAssetDeletionInState,
  prepareMediaAssetDeletionInState,
  processDueStage4B3MediaExpirySagaInState,
} from "./phase-85-stage-4b3-media-lifecycle-saga";
import {
  STAGE_4B3_MEDIA_RETENTION_DAYS,
  type InboundMessageBundleRecord,
  type MediaAssetRecord,
  type VisualAnalysisRecord,
  type VisualCorrectionRecord,
  type VisualObservationV1,
} from "./phase-85-stage-4b3-media-contracts";
import { getFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import type { Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MEDIA_LIFECYCLE_VERSION = "p85-stage-4b3-media-lifecycle-v2";
export const STAGE_4B3_MEDIA_ANALYSIS_EVIDENCE_RETENTION_MONTHS = 24;
export const STAGE_4B3_MEDIA_EXPORT_FILE = "media_metadata.json";

export type Stage4B3MediaOrphanKind = "object_without_row" | "row_without_object";

export type Stage4B3MediaOrphanEntry = {
  kind: Stage4B3MediaOrphanKind;
  objectKey?: string;
  assetId?: string;
  tenantId?: string;
};

export type Stage4B3MediaOrphanReport = {
  version: string;
  generatedAt: string;
  orphanCount: number;
  entries: Stage4B3MediaOrphanEntry[];
};

export type Stage4B3MediaOperationalHealth = {
  version: string;
  pendingExpiryCount: number;
  expiredAssetCount: number;
  revokedAssetCount: number;
  openBundleCount: number;
  orphanObjectCount: number;
  orphanRowCount: number;
  failedDeletionCount: number;
  status: "healthy" | "degraded" | "blocked";
};

export type Stage4B3MediaExportMetadataEntry = {
  assetId: string;
  messageId: string;
  conversationId: string;
  status: MediaAssetRecord["status"];
  declaredMimeType: string;
  detectedMimeType: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  storedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  analysisStatus: VisualAnalysisRecord["status"] | null;
  correctionCount: number;
};

export type Stage4B3MediaRedactionInvariantResult = {
  passed: boolean;
  blockingReasons: string[];
};

const TERMINAL_ASSET_STATUSES = new Set<MediaAssetRecord["status"]>(["expired", "revoked"]);
const OPEN_BUNDLE_STATUSES = new Set<InboundMessageBundleRecord["status"]>(["open", "ready", "processing"]);

const EXPORT_LEAK_MARKERS = [
  "sanitizedFullObjectKey",
  "thumbnailObjectKey",
  "providerMediaId",
  "providerMediaIdHash",
  "object_key",
  "ocrBlocks",
  "promptText",
  "rawBytes",
] as const;

export function collectMediaAssetObjectKeys(
  asset: Pick<MediaAssetRecord, "sanitizedFullObjectKey" | "thumbnailObjectKey">,
): string[] {
  return [asset.sanitizedFullObjectKey, asset.thumbnailObjectKey].filter(
    (key): key is string => typeof key === "string" && key.trim().length > 0,
  );
}

export function isMediaAssetDueForExpiry(asset: MediaAssetRecord, now: string): boolean {
  if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.deletedAt) {
    return false;
  }
  if (!asset.expiresAt) {
    return false;
  }
  return Date.parse(asset.expiresAt) <= Date.parse(now);
}

export function isMediaAnalysisRetrievalExcluded(asset: MediaAssetRecord, now: string): boolean {
  if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.deletedAt) {
    return true;
  }
  if (!asset.expiresAt) {
    return false;
  }
  return Date.parse(asset.expiresAt) <= Date.parse(now);
}

export function finalizeExpiredMediaAsset(asset: MediaAssetRecord, now: string): MediaAssetRecord {
  return {
    ...asset,
    status: "expired",
    providerMediaId: null,
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: null,
    sanitizedAudioObjectKey: null,
    deletedAt: now,
    updatedAt: now,
  };
}

export function finalizeRevokedMediaAsset(asset: MediaAssetRecord, now: string): MediaAssetRecord {
  return {
    ...asset,
    status: "revoked",
    providerMediaId: null,
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: null,
    sanitizedAudioObjectKey: null,
    deletedAt: now,
    updatedAt: now,
  };
}

export function redactVisualObservationForLifecycle(
  observation: VisualObservationV1 | null,
): VisualObservationV1 | null {
  if (!observation) {
    return null;
  }

  return {
    ...observation,
    entityCandidates: [],
    ocrBlocks: [],
    sensitivitySignals: observation.sensitivitySignals.map(() => PHASE_74_REDACTION_MARKER),
    promptInjectionSignals: observation.promptInjectionSignals.map(() => PHASE_74_REDACTION_MARKER),
  };
}

export function redactVisualAnalysisForLifecycle(
  analysis: VisualAnalysisRecord,
  now: string,
): VisualAnalysisRecord {
  return {
    ...analysis,
    observation: redactVisualObservationForLifecycle(analysis.observation),
    failureCode: analysis.failureCode ? PHASE_74_REDACTION_MARKER : null,
    updatedAt: now,
  };
}

export function redactVisualCorrectionForLifecycle(
  correction: VisualCorrectionRecord,
  now: string,
): VisualCorrectionRecord {
  return {
    ...correction,
    explanation: PHASE_74_REDACTION_MARKER,
    correctedOcrText: correction.correctedOcrText ? PHASE_74_REDACTION_MARKER : null,
    correctedEntityLabels: correction.correctedEntityLabels.map(() => PHASE_74_REDACTION_MARKER),
    updatedAt: now,
  };
}

export function cancelOpenInboundBundlesForClientInState(
  state: ManuAppState,
  clientId: string,
  now: string,
): ManuAppState {
  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((bundle) =>
      bundle.clientId === clientId && OPEN_BUNDLE_STATUSES.has(bundle.status)
        ? {
            ...bundle,
            status: "superseded",
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: now,
          }
        : bundle,
    ),
  };
}

export function revokeMediaAssetsForMessageInState(
  state: ManuAppState,
  messageId: string,
  now: string,
): { state: ManuAppState; objectKeys: string[] } {
  const asset = state.mediaAssets.find(
    (item) => item.messageId === messageId && !TERMINAL_ASSET_STATUSES.has(item.status) && item.status !== "deletion_pending",
  );
  if (!asset) {
    return { state, objectKeys: [] };
  }

  const prepared = prepareMediaAssetDeletionInState(state, asset.id, "revoked", now);
  return {
    state: prepared.state,
    objectKeys: prepared.pendingObjectKeys.map((entry) => entry.objectKey),
  };
}

export function redactStage4B3MediaRecordsForClientInState(
  state: ManuAppState,
  clientId: string,
  now: string,
): { state: ManuAppState; objectKeys: string[] } {
  let next = cancelOpenInboundBundlesForClientInState(state, clientId, now);
  const objectKeys: string[] = [];

  for (const asset of next.mediaAssets.filter((item) => item.clientId === clientId)) {
    if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.status === "deletion_pending") {
      continue;
    }
    const prepared = prepareMediaAssetDeletionInState(next, asset.id, "revoked", now);
    next = prepared.state;
    objectKeys.push(...prepared.pendingObjectKeys.map((entry) => entry.objectKey));
  }

  next = {
    ...next,
    visualAnalysisRecords: next.visualAnalysisRecords.map((record) =>
      record.clientId === clientId ? redactVisualAnalysisForLifecycle(record, now) : record,
    ),
    visualCorrections: next.visualCorrections.map((correction) =>
      correction.clientId === clientId ? redactVisualCorrectionForLifecycle(correction, now) : correction,
    ),
    auditEvents: [
      ...next.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: next.tenant.id,
        eventType: "media_lifecycle_client_redacted",
        entityType: "client",
        entityId: clientId,
        metadata: {
          assetCount: next.mediaAssets.filter((asset) => asset.clientId === clientId).length,
          objectCount: objectKeys.length,
          minimized: true,
        },
        createdAt: now,
      },
    ],
  };

  return { state: next, objectKeys };
}

export async function purgeStage4B3MediaObjectKeys(
  storage: Stage4B3MediaStoragePort,
  objectKeys: string[],
): Promise<void> {
  for (const objectKey of [...new Set(objectKeys)]) {
    await storage.deleteObject(objectKey);
  }
}

export function purgeFallbackStage4B3MediaObjectKeys(objectKeys: string[]): void {
  const storage = getFallbackStage4B3MediaStorage();
  if (!("objects" in storage)) {
    return;
  }
  for (const objectKey of [...new Set(objectKeys)]) {
    storage.objects.delete(objectKey);
  }
}

export async function processDueStage4B3MediaExpiryInState(
  state: ManuAppState,
  input: { now?: string; storage?: Stage4B3MediaStoragePort } = {},
): Promise<ManuAppState> {
  const now = input.now ?? new Date().toISOString();
  const storage = input.storage ?? getFallbackStage4B3MediaStorage();
  const dueAssets = state.mediaAssets.filter((asset) => isMediaAssetDueForExpiry(asset, now));
  if (dueAssets.length === 0) {
    return state;
  }

  const next = await processDueStage4B3MediaExpirySagaInState(state, {
    now,
    storage,
  });

  return {
    ...next,
    auditEvents: [
      ...next.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: next.tenant.id,
        eventType: "media_asset_expired",
        entityType: "media_asset",
        entityId: dueAssets[0]!.id,
        metadata: {
          expiredCount: dueAssets.length,
          retentionDays: STAGE_4B3_MEDIA_RETENTION_DAYS,
          minimized: true,
        },
        createdAt: now,
      },
    ],
  };
}

export function detectStage4B3MediaOrphans(
  state: ManuAppState,
  storage: Stage4B3MediaStoragePort & { objects?: Map<string, unknown> },
): Stage4B3MediaOrphanReport {
  const knownKeys = new Set(
    state.mediaAssets.flatMap((asset) => collectMediaAssetObjectKeys(asset)),
  );
  const entries: Stage4B3MediaOrphanEntry[] = [];

  if (storage.objects) {
    for (const objectKey of storage.objects.keys()) {
      if (!knownKeys.has(objectKey)) {
        entries.push({ kind: "object_without_row", objectKey });
      }
    }
  }

  for (const asset of state.mediaAssets) {
    if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.deletedAt) {
      continue;
    }
    for (const objectKey of collectMediaAssetObjectKeys(asset)) {
      if (storage.objects && !storage.objects.has(objectKey)) {
        entries.push({
          kind: "row_without_object",
          objectKey,
          assetId: asset.id,
          tenantId: asset.tenantId,
        });
      }
    }
  }

  return {
    version: STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
    generatedAt: new Date().toISOString(),
    orphanCount: entries.length,
    entries,
  };
}

export function buildStage4B3MediaOperationalHealth(
  state: ManuAppState,
  orphanReport?: Stage4B3MediaOrphanReport,
): Stage4B3MediaOperationalHealth {
  const now = new Date().toISOString();
  const pendingExpiryCount = state.mediaAssets.filter((asset) => isMediaAssetDueForExpiry(asset, now)).length;
  const expiredAssetCount = state.mediaAssets.filter((asset) => asset.status === "expired").length;
  const revokedAssetCount = state.mediaAssets.filter((asset) => asset.status === "revoked").length;
  const openBundleCount = state.inboundMessageBundles.filter((bundle) => OPEN_BUNDLE_STATUSES.has(bundle.status)).length;
  const orphanObjectCount =
    orphanReport?.entries.filter((entry) => entry.kind === "object_without_row").length ?? 0;
  const orphanRowCount =
    orphanReport?.entries.filter((entry) => entry.kind === "row_without_object").length ?? 0;
  const failedDeletionCount = state.mediaAssets.filter(
    (asset) => asset.failureCode === "object_delete_failed",
  ).length;

  const blocked = failedDeletionCount > 0;
  const degraded = !blocked && (orphanObjectCount > 0 || orphanRowCount > 0 || pendingExpiryCount > 0);

  return {
    version: STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
    pendingExpiryCount,
    expiredAssetCount,
    revokedAssetCount,
    openBundleCount,
    orphanObjectCount,
    orphanRowCount,
    failedDeletionCount,
    status: blocked ? "blocked" : degraded ? "degraded" : "healthy",
  };
}

export function buildStage4B3MediaExportMetadata(
  state: ManuAppState,
  clientId: string,
): Stage4B3MediaExportMetadataEntry[] {
  const assets = state.mediaAssets.filter((asset) => asset.clientId === clientId);
  return assets.map((asset) => {
    const analysis = state.visualAnalysisRecords.find((record) => record.mediaAssetId === asset.id) ?? null;
    const correctionCount = state.visualCorrections.filter(
      (correction) => correction.analysisId === analysis?.id,
    ).length;
    return {
      assetId: asset.id,
      messageId: asset.messageId,
      conversationId: asset.conversationId,
      status: asset.status,
      declaredMimeType: asset.declaredMimeType,
      detectedMimeType: asset.detectedMimeType,
      width: asset.dimensions?.width ?? null,
      height: asset.dimensions?.height ?? null,
      byteSize: asset.byteSize,
      storedAt: asset.storedAt,
      expiresAt: asset.expiresAt,
      deletedAt: asset.deletedAt,
      analysisStatus: analysis?.status ?? null,
      correctionCount,
    };
  });
}

export function serializeStage4B3MediaExportMetadata(state: ManuAppState, clientId: string): string {
  return JSON.stringify(
    {
      version: STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
      retentionDays: STAGE_4B3_MEDIA_RETENTION_DAYS,
      analysisEvidenceRetentionMonths: STAGE_4B3_MEDIA_ANALYSIS_EVIDENCE_RETENTION_MONTHS,
      assets: buildStage4B3MediaExportMetadata(state, clientId),
    },
    null,
    2,
  );
}

export function detectStage4B3MediaExportLeaks(payload: unknown): { passed: boolean; failures: string[] } {
  const serialized = JSON.stringify(payload);
  const failures = EXPORT_LEAK_MARKERS.filter((marker) => serialized.includes(marker));
  return { passed: failures.length === 0, failures: [...failures] };
}

export function evaluateStage4B3MediaRedactionInvariants(
  state: ManuAppState,
  clientId: string,
  storage: Stage4B3MediaStoragePort & { objects?: Map<string, unknown> } = getFallbackStage4B3MediaStorage(),
): Stage4B3MediaRedactionInvariantResult {
  const blockingReasons: string[] = [];
  const clientAssets = state.mediaAssets.filter((asset) => asset.clientId === clientId);

  if (clientAssets.some((asset) => collectMediaAssetObjectKeys(asset).length > 0)) {
    blockingReasons.push("media object keys must be cleared");
  }

  if (clientAssets.some((asset) => asset.providerMediaId)) {
    blockingReasons.push("provider media ids must be cleared");
  }

  if (
    clientAssets.some(
      (asset) => !TERMINAL_ASSET_STATUSES.has(asset.status) || !asset.deletedAt,
    )
  ) {
    blockingReasons.push("media assets must be expired or revoked with deletedAt");
  }

  if (
    state.visualAnalysisRecords
      .filter((record) => record.clientId === clientId)
      .some((record) => (record.observation?.ocrBlocks.length ?? 0) > 0)
  ) {
    blockingReasons.push("visual analysis OCR must be redacted");
  }

  if (
    state.visualCorrections
      .filter((correction) => correction.clientId === clientId)
      .some(
        (correction) =>
          (correction.correctedOcrText && correction.correctedOcrText !== PHASE_74_REDACTION_MARKER) ||
          correction.correctedEntityLabels?.some((label) => label !== PHASE_74_REDACTION_MARKER) ||
          (correction.explanation && correction.explanation !== PHASE_74_REDACTION_MARKER),
      )
  ) {
    blockingReasons.push("visual corrections must be redacted");
  }

  if (
    state.inboundMessageBundles.some(
      (bundle) => bundle.clientId === clientId && OPEN_BUNDLE_STATUSES.has(bundle.status),
    )
  ) {
    blockingReasons.push("open inbound bundles must be cancelled");
  }

  if (storage.objects) {
    for (const asset of clientAssets) {
      for (const objectKey of collectMediaAssetObjectKeys(asset)) {
        if (storage.objects.has(objectKey)) {
          blockingReasons.push("client media objects must be deleted from storage");
          break;
        }
      }
    }
  }

  return { passed: blockingReasons.length === 0, blockingReasons };
}
