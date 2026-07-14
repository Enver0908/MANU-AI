import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAssetStatus } from "./phase-85-stage-4b3-media-contracts";
import {
  collectMediaAssetObjectKeys,
  finalizeExpiredMediaAsset,
  finalizeRevokedMediaAsset,
  isMediaAssetDueForExpiry,
  type Stage4B3MediaOrphanEntry,
  type Stage4B3MediaOrphanReport,
  STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
} from "./phase-85-stage-4b3-media-lifecycle";
import type { Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MEDIA_LIFECYCLE_SAGA_VERSION = "p85-stage-4b3-media-lifecycle-saga-v1";
export const STAGE_4B3_MEDIA_OBJECT_DELETE_MAX_RETRIES = 3;
export const STAGE_4B3_MEDIA_ORPHAN_SCAN_PAGE_SIZE = 256;

export type MediaDeletionTerminalIntent = "expired" | "revoked";

export type MediaPendingObjectKeyRecord = {
  assetId: string;
  objectKey: string;
  objectKind: "full" | "thumbnail";
  terminalIntent: MediaDeletionTerminalIntent;
};

export type Stage4B3MediaLifecycleWorkerSummary = {
  version: string;
  generatedAt: string;
  tenantId: string;
  workerId: string;
  expiryPrepared: number;
  legalHoldResumed: number;
  objectOperationsClaimed: number;
  objectOperationsCompleted: number;
  objectOperationsFailed: number;
  evidenceRedacted: number;
  orphanObjectOpsEnqueued: number;
  rowWithoutObjectFailures: number;
};

export type Stage4B3PaginatedMediaStoragePort = Stage4B3MediaStoragePort & {
  listObjectKeys?(prefix: string, input?: { limit?: number; offset?: number }): Promise<string[]>;
};

export function prepareMediaAssetDeletionInState(
  state: ManuAppState,
  assetId: string,
  terminalIntent: MediaDeletionTerminalIntent,
  now: string,
): { state: ManuAppState; pendingObjectKeys: MediaPendingObjectKeyRecord[] } {
  const asset = state.mediaAssets.find((item) => item.id === assetId);
  if (!asset || asset.status === "expired" || asset.status === "revoked" || asset.status === "deletion_pending") {
    return { state, pendingObjectKeys: [] };
  }

  if (terminalIntent === "expired" && !isMediaAssetDueForExpiry(asset, now)) {
    return { state, pendingObjectKeys: [] };
  }

  const pendingObjectKeys = collectMediaAssetObjectKeys(asset).map((objectKey) => ({
    assetId: asset.id,
    objectKey,
    objectKind: objectKey === asset.thumbnailObjectKey ? ("thumbnail" as const) : ("full" as const),
    terminalIntent,
  }));

  const nextAssets = state.mediaAssets.map((item) =>
    item.id === assetId
      ? {
          ...item,
          status: "deletion_pending" as MediaAssetStatus,
          sanitizedFullObjectKey: null,
          thumbnailObjectKey: null,
          updatedAt: now,
        }
      : item,
  );

  const nextAnalyses = state.visualAnalysisRecords.map((record) =>
    record.mediaAssetId === assetId ? { ...record, retrievalEligible: false, updatedAt: now } : record,
  );

  const nextMessages = state.messages.map((message) =>
    message.id === asset.messageId
      ? {
          ...message,
          retrievalEligibility:
            terminalIntent === "revoked" ? ("excluded_revoked" as const) : ("excluded_media_expired" as const),
          contentStatus: terminalIntent === "revoked" ? ("revoked" as const) : message.contentStatus,
          observedAt: now,
        }
      : message,
  );

  return {
    state: {
      ...state,
      mediaAssets: nextAssets,
      visualAnalysisRecords: nextAnalyses,
      messages: nextMessages,
    },
    pendingObjectKeys,
  };
}

export function finalizeMediaAssetDeletionInState(
  state: ManuAppState,
  assetId: string,
  terminalIntent: MediaDeletionTerminalIntent,
  now: string,
): ManuAppState {
  return {
    ...state,
    mediaAssets: state.mediaAssets.map((asset) => {
      if (asset.id !== assetId) {
        return asset;
      }
      return terminalIntent === "revoked"
        ? finalizeRevokedMediaAsset(asset, now)
        : finalizeExpiredMediaAsset(asset, now);
    }),
  };
}

export async function processDueStage4B3MediaExpirySagaInState(
  state: ManuAppState,
  input: {
    now?: string;
    storage?: Stage4B3PaginatedMediaStoragePort;
    legalHoldClientIds?: Set<string>;
  } = {},
): Promise<ManuAppState> {
  const now = input.now ?? new Date().toISOString();
  const storage = input.storage;
  const legalHoldClientIds = input.legalHoldClientIds ?? new Set<string>();
  let next = state;

  for (const asset of state.mediaAssets.filter((item) => isMediaAssetDueForExpiry(item, now))) {
    const prepared = prepareMediaAssetDeletionInState(next, asset.id, "expired", now);
    next = prepared.state;

    if (legalHoldClientIds.has(asset.clientId)) {
      continue;
    }

    if (storage && prepared.pendingObjectKeys.length > 0) {
      await purgeStage4B3PendingObjectKeys(storage, prepared.pendingObjectKeys);
      next = finalizeMediaAssetDeletionInState(next, asset.id, "expired", now);
    } else if (prepared.pendingObjectKeys.length === 0) {
      next = finalizeMediaAssetDeletionInState(next, asset.id, "expired", now);
    }
  }

  return next;
}

export async function purgeStage4B3PendingObjectKeys(
  storage: Stage4B3MediaStoragePort,
  pendingObjectKeys: MediaPendingObjectKeyRecord[],
): Promise<void> {
  for (const entry of pendingObjectKeys) {
    try {
      await storage.deleteObject(entry.objectKey);
    } catch (error) {
      if (!isStorageObjectAlreadyDeletedError(error)) {
        throw error;
      }
    }
  }
}

export function isStorageObjectAlreadyDeletedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("not_found") || message.includes("Object not found");
}

export async function detectStage4B3MediaOrphansFromStorage(
  state: ManuAppState,
  storage: Stage4B3PaginatedMediaStoragePort,
  tenantPrefix: string,
): Promise<Stage4B3MediaOrphanReport> {
  const knownKeys = new Set(
    state.mediaAssets.flatMap((asset) => collectMediaAssetObjectKeys(asset)),
  );
  const entries: Stage4B3MediaOrphanEntry[] = [];
  const inMemoryObjects =
    "objects" in storage && storage.objects instanceof Map ? storage.objects : null;
  const listedKeys = storage.listObjectKeys
    ? await listAllStorageObjectKeys(storage, tenantPrefix)
    : inMemoryObjects
      ? [...inMemoryObjects.keys()]
      : [];

  for (const objectKey of listedKeys) {
    if (!objectKey.startsWith(tenantPrefix)) {
      continue;
    }
    if (!knownKeys.has(objectKey)) {
      entries.push({ kind: "object_without_row", objectKey });
    }
  }

  for (const asset of state.mediaAssets) {
    if (asset.status === "expired" || asset.status === "revoked" || asset.deletedAt) {
      continue;
    }
    for (const objectKey of collectMediaAssetObjectKeys(asset)) {
      const exists = inMemoryObjects
        ? inMemoryObjects.has(objectKey)
        : listedKeys.includes(objectKey);
      if (!exists) {
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

async function listAllStorageObjectKeys(
  storage: Stage4B3PaginatedMediaStoragePort,
  prefix: string,
): Promise<string[]> {
  if (!storage.listObjectKeys) {
    return [];
  }

  const keys: string[] = [];
  let offset = 0;
  while (true) {
    const page = await storage.listObjectKeys(prefix, {
      limit: STAGE_4B3_MEDIA_ORPHAN_SCAN_PAGE_SIZE,
      offset,
    });
    keys.push(...page);
    if (page.length < STAGE_4B3_MEDIA_ORPHAN_SCAN_PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }
  return keys;
}

export function redactStaleVisualEvidenceInState(state: ManuAppState, now: string): ManuAppState {
  const cutoffDate = new Date(now);
  cutoffDate.setMonth(cutoffDate.getMonth() - 24);
  const cutoff = cutoffDate.getTime();
  const staleAnalysisIds = new Set(
    state.visualAnalysisRecords
      .filter((record) => Date.parse(record.createdAt) <= cutoff)
      .map((record) => record.id),
  );

  if (staleAnalysisIds.size === 0) {
    return state;
  }

  return {
    ...state,
    visualAnalysisRecords: state.visualAnalysisRecords.map((record) => {
      if (!staleAnalysisIds.has(record.id)) {
        return record;
      }
      return {
        ...record,
        retrievalEligible: false,
        observation: record.observation
          ? {
              ...record.observation,
              entityCandidates: [],
              ocrBlocks: [],
              sensitivitySignals: ["REDACTED_BY_PHASE74_POLICY"],
              promptInjectionSignals: ["REDACTED_BY_PHASE74_POLICY"],
            }
          : record.observation,
        failureCode: record.failureCode ? "REDACTED_BY_PHASE74_POLICY" : null,
        updatedAt: now,
      };
    }),
    visualCorrections: state.visualCorrections.map((correction) =>
      staleAnalysisIds.has(correction.analysisId)
        ? {
            ...correction,
            explanation: "REDACTED_BY_PHASE74_POLICY",
            correctedOcrText: correction.correctedOcrText ? "REDACTED_BY_PHASE74_POLICY" : null,
            correctedEntityLabels: [],
            updatedAt: now,
          }
        : correction,
    ),
  };
}

type ClaimedObjectOperationRow = {
  id: string;
  tenant_id: string;
  media_asset_id: string | null;
  object_key: string;
  operation_kind: string;
  lease_token: string | null;
};

export async function runStage4B3MediaLifecycleWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  storage: Stage4B3MediaStoragePort;
  batchLimit?: number;
}): Promise<Stage4B3MediaLifecycleWorkerSummary> {
  const workerId = input.workerId ?? "stage4b3-media-lifecycle-worker";
  const summary: Stage4B3MediaLifecycleWorkerSummary = {
    version: STAGE_4B3_MEDIA_LIFECYCLE_SAGA_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    expiryPrepared: 0,
    legalHoldResumed: 0,
    objectOperationsClaimed: 0,
    objectOperationsCompleted: 0,
    objectOperationsFailed: 0,
    evidenceRedacted: 0,
    orphanObjectOpsEnqueued: 0,
    rowWithoutObjectFailures: 0,
  };

  const { data: expiryBatch, error: expiryError } = await input.supabase.rpc(
    "p85_stage_4b3_process_due_media_expiry_batch_v2",
    {
      p_tenant_id: input.tenantId,
      p_limit: input.batchLimit ?? 32,
    },
  );
  if (expiryError) {
    throw expiryError;
  }
  summary.expiryPrepared = Number(expiryBatch?.prepared ?? 0);

  const { data: legalHoldBatch, error: legalHoldError } = await input.supabase.rpc(
    "p85_stage_4b3_resume_legal_hold_media_deletions_v2",
    {
      p_tenant_id: input.tenantId,
      p_limit: input.batchLimit ?? 32,
    },
  );
  if (legalHoldError) {
    throw legalHoldError;
  }
  summary.legalHoldResumed = Number(legalHoldBatch?.enqueued ?? 0);

  const { data: evidenceBatch, error: evidenceError } = await input.supabase.rpc(
    "p85_stage_4b3_redact_stale_visual_evidence_v2",
    {
      p_tenant_id: input.tenantId,
      p_limit: input.batchLimit ?? 64,
    },
  );
  if (evidenceError) {
    throw evidenceError;
  }
  summary.evidenceRedacted = Number(evidenceBatch?.analysesRedacted ?? 0);

  for (let index = 0; index < (input.batchLimit ?? 8); index += 1) {
    const { data: claimedRows, error: claimError } = await input.supabase.rpc(
      "p85_stage_4b3_claim_media_object_operation_v2",
      {
        p_tenant_id: input.tenantId,
        p_worker_id: workerId,
      },
    );
    if (claimError) {
      throw claimError;
    }

    const claimed = (claimedRows?.[0] ?? null) as ClaimedObjectOperationRow | null;
    if (!claimed?.id || !claimed.lease_token) {
      break;
    }
    summary.objectOperationsClaimed += 1;

    let success = false;
    let failureCode: string | null = null;
    try {
      await input.storage.deleteObject(claimed.object_key);
      success = true;
    } catch (error) {
      if (isStorageObjectAlreadyDeletedError(error)) {
        success = true;
      } else {
        failureCode = "object_delete_failed";
      }
    }

    const { error: releaseError } = await input.supabase.rpc("p85_stage_4b3_release_media_object_operation_v2", {
      p_tenant_id: input.tenantId,
      p_operation_id: claimed.id,
      p_worker_id: workerId,
      p_lease_token: claimed.lease_token,
      p_success: success,
      p_failure_code: failureCode,
    });
    if (releaseError) {
      throw releaseError;
    }

    if (success) {
      summary.objectOperationsCompleted += 1;
    } else {
      summary.objectOperationsFailed += 1;
    }
  }

  return summary;
}

export async function runStage4B3MediaLifecycleWorkerLoop(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  storage: Stage4B3MediaStoragePort;
  intervalMs?: number;
  once?: boolean;
  shouldContinue?: () => boolean;
}): Promise<void> {
  const intervalMs = input.intervalMs ?? 60_000;
  const shouldContinue = input.shouldContinue ?? (() => true);

  do {
    const summary = await runStage4B3MediaLifecycleWorkerBatch({
      supabase: input.supabase,
      tenantId: input.tenantId,
      workerId: input.workerId,
      storage: input.storage,
    });
    console.log("[worker:media:lifecycle]", JSON.stringify(summary));
    if (input.once) {
      break;
    }
    if (!shouldContinue()) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

export function finalizePreparedClientMediaDeletionsInState(
  state: ManuAppState,
  clientId: string,
  terminalIntent: MediaDeletionTerminalIntent,
  now: string,
): ManuAppState {
  let next = state;
  for (const asset of state.mediaAssets.filter(
    (item) => item.clientId === clientId && item.status === "deletion_pending",
  )) {
    next = finalizeMediaAssetDeletionInState(next, asset.id, terminalIntent, now);
  }
  return next;
}

export async function prepareSupabaseClientMediaDsar(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("p85_stage_4b3_prepare_client_media_dsar_v2", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
  });
  if (error) {
    throw error;
  }
  return (data ?? {}) as Record<string, unknown>;
}
