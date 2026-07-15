import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAssetStatus } from "./phase-85-stage-4b3-media-contracts";
import { isStorageObjectAlreadyDeletedError } from "./phase-85-stage-4b3-media-lifecycle-saga";
import {
  collectMediaAssetAudioObjectKeys,
  finalizeExpiredVoiceAsset,
  finalizeRevokedVoiceAsset,
  isAudioAssetDueForExpiry,
  isVoiceMediaAsset,
  redactAudioTranscriptionEvidenceForAssetInState,
  STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
  type Stage4B4AudioOrphanEntry,
  type Stage4B4AudioOrphanReport,
} from "./phase-85-stage-4b4-audio-lifecycle";
import type { Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import type { ManuAppState } from "./types";

export const STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION = "p85-stage-4b4-audio-lifecycle-saga-v1";
export const STAGE_4B4_AUDIO_OBJECT_DELETE_MAX_RETRIES = 3;
export const STAGE_4B4_AUDIO_ORPHAN_SCAN_PAGE_SIZE = 256;

export type AudioDeletionTerminalIntent = "expired" | "revoked";

export type AudioPendingObjectKeyRecord = {
  assetId: string;
  objectKey: string;
  objectKind: "audio";
  terminalIntent: AudioDeletionTerminalIntent;
};

export type Stage4B4AudioLifecycleWorkerSummary = {
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

export type Stage4B4PaginatedAudioStoragePort = Stage4B4AudioStoragePort & {
  listObjectKeys?(prefix: string, input?: { limit?: number; offset?: number }): Promise<string[]>;
  objects?: Map<string, { bytes: Buffer; contentType: string }>;
};

export function prepareAudioAssetDeletionInState(
  state: ManuAppState,
  assetId: string,
  terminalIntent: AudioDeletionTerminalIntent,
  now: string,
): { state: ManuAppState; pendingObjectKeys: AudioPendingObjectKeyRecord[] } {
  const asset = state.mediaAssets.find((item) => item.id === assetId);
  if (
    !asset ||
    !isVoiceMediaAsset(asset) ||
    asset.status === "expired" ||
    asset.status === "revoked" ||
    asset.status === "deletion_pending"
  ) {
    return { state, pendingObjectKeys: [] };
  }

  if (terminalIntent === "expired" && !isAudioAssetDueForExpiry(asset, now)) {
    return { state, pendingObjectKeys: [] };
  }

  const pendingObjectKeys = collectMediaAssetAudioObjectKeys(asset).map((objectKey) => ({
    assetId: asset.id,
    objectKey,
    objectKind: "audio" as const,
    terminalIntent,
  }));

  const nextAssets = state.mediaAssets.map((item) =>
    item.id === assetId
      ? {
          ...item,
          status: "deletion_pending" as MediaAssetStatus,
          sanitizedAudioObjectKey: null,
          updatedAt: now,
        }
      : item,
  );

  const nextMessages = state.messages.map((message) =>
    message.id === asset.messageId
      ? {
          ...message,
          retrievalEligibility:
            terminalIntent === "revoked" ? ("excluded_revoked" as const) : ("excluded_voice_expired" as const),
          contentStatus: terminalIntent === "revoked" ? ("revoked" as const) : message.contentStatus,
          observedAt: now,
        }
      : message,
  );

  let nextState: ManuAppState = {
    ...state,
    mediaAssets: nextAssets,
    messages: nextMessages,
  };
  nextState = redactAudioTranscriptionEvidenceForAssetInState(nextState, assetId, now);

  return { state: nextState, pendingObjectKeys };
}

export function finalizeAudioAssetDeletionInState(
  state: ManuAppState,
  assetId: string,
  terminalIntent: AudioDeletionTerminalIntent,
  now: string,
): ManuAppState {
  return {
    ...state,
    mediaAssets: state.mediaAssets.map((asset) => {
      if (asset.id !== assetId) {
        return asset;
      }
      return terminalIntent === "revoked"
        ? finalizeRevokedVoiceAsset(asset, now)
        : finalizeExpiredVoiceAsset(asset, now);
    }),
  };
}

export async function purgeStage4B4PendingAudioObjectKeys(
  storage: Stage4B4AudioStoragePort,
  pendingObjectKeys: AudioPendingObjectKeyRecord[],
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

export async function processDueStage4B4AudioExpirySagaInState(
  state: ManuAppState,
  input: {
    now?: string;
    storage?: Stage4B4PaginatedAudioStoragePort;
    legalHoldClientIds?: Set<string>;
  } = {},
): Promise<ManuAppState> {
  const now = input.now ?? new Date().toISOString();
  const storage = input.storage;
  const legalHoldClientIds = input.legalHoldClientIds ?? new Set<string>();
  let next = state;

  for (const asset of state.mediaAssets.filter((item) => isAudioAssetDueForExpiry(item, now))) {
    const prepared = prepareAudioAssetDeletionInState(next, asset.id, "expired", now);
    next = prepared.state;

    if (legalHoldClientIds.has(asset.clientId)) {
      continue;
    }

    if (storage && prepared.pendingObjectKeys.length > 0) {
      await purgeStage4B4PendingAudioObjectKeys(storage, prepared.pendingObjectKeys);
      next = finalizeAudioAssetDeletionInState(next, asset.id, "expired", now);
    } else if (prepared.pendingObjectKeys.length === 0) {
      next = finalizeAudioAssetDeletionInState(next, asset.id, "expired", now);
    }
  }

  return next;
}

export async function detectStage4B4AudioOrphansFromStorage(
  state: ManuAppState,
  storage: Stage4B4PaginatedAudioStoragePort,
  tenantPrefix: string,
): Promise<Stage4B4AudioOrphanReport> {
  const knownKeys = new Set(
    state.mediaAssets
      .filter((asset) => isVoiceMediaAsset(asset))
      .flatMap((asset) => collectMediaAssetAudioObjectKeys(asset)),
  );
  const entries: Stage4B4AudioOrphanEntry[] = [];
  const inMemoryObjects = storage.objects instanceof Map ? storage.objects : null;
  const listedKeys = storage.listObjectKeys
    ? await listAllAudioStorageObjectKeys(storage, tenantPrefix)
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

  for (const asset of state.mediaAssets.filter((item) => isVoiceMediaAsset(item))) {
    if (asset.status === "expired" || asset.status === "revoked" || asset.deletedAt) {
      continue;
    }
    for (const objectKey of collectMediaAssetAudioObjectKeys(asset)) {
      const exists = inMemoryObjects ? inMemoryObjects.has(objectKey) : listedKeys.includes(objectKey);
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
    version: STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
    generatedAt: new Date().toISOString(),
    orphanCount: entries.length,
    entries,
  };
}

async function listAllAudioStorageObjectKeys(
  storage: Stage4B4PaginatedAudioStoragePort,
  prefix: string,
): Promise<string[]> {
  if (!storage.listObjectKeys) {
    return [];
  }

  const keys: string[] = [];
  let offset = 0;
  while (true) {
    const page = await storage.listObjectKeys(prefix, {
      limit: STAGE_4B4_AUDIO_ORPHAN_SCAN_PAGE_SIZE,
      offset,
    });
    keys.push(...page);
    if (page.length < STAGE_4B4_AUDIO_ORPHAN_SCAN_PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }
  return keys;
}

export function finalizePreparedClientAudioDeletionsInState(
  state: ManuAppState,
  clientId: string,
  terminalIntent: AudioDeletionTerminalIntent,
  now: string,
): ManuAppState {
  let next = state;
  for (const asset of state.mediaAssets.filter(
    (item) => item.clientId === clientId && item.status === "deletion_pending" && isVoiceMediaAsset(item),
  )) {
    next = finalizeAudioAssetDeletionInState(next, asset.id, terminalIntent, now);
  }
  return next;
}

type ClaimedObjectOperationRow = {
  id: string;
  tenant_id: string;
  media_asset_id: string | null;
  object_key: string;
  operation_kind: string;
  lease_token: string | null;
};

export async function runStage4B4AudioLifecycleWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  storage: Stage4B4AudioStoragePort;
  batchLimit?: number;
}): Promise<Stage4B4AudioLifecycleWorkerSummary> {
  const workerId = input.workerId ?? "stage4b4-audio-lifecycle-worker";
  const summary: Stage4B4AudioLifecycleWorkerSummary = {
    version: STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION,
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
    "p85_stage_4b4_process_due_audio_expiry_batch_v1",
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
    "p85_stage_4b4_resume_legal_hold_audio_deletions_v1",
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
    "p85_stage_4b4_redact_stale_audio_transcription_evidence_v1",
    {
      p_tenant_id: input.tenantId,
      p_limit: input.batchLimit ?? 64,
    },
  );
  if (evidenceError) {
    throw evidenceError;
  }
  summary.evidenceRedacted = Number(evidenceBatch?.transcriptionsRedacted ?? 0);

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
    if (!claimed.object_key.includes("/voice.wav")) {
      continue;
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

export async function prepareSupabaseClientAudioDsar(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("p85_stage_4b4_prepare_client_audio_dsar_v1", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
  });
  if (error) {
    throw error;
  }
  return (data ?? {}) as Record<string, unknown>;
}
