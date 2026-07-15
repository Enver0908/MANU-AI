import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAssetStatus } from "./phase-85-stage-4b3-media-contracts";
import { isStorageObjectAlreadyDeletedError } from "./phase-85-stage-4b3-media-lifecycle-saga";
import {
  buildStage4B4VoiceDsarExportPackage,
  collectMediaAssetAudioObjectKeys,
  finalizeExpiredVoiceAsset,
  finalizeRevokedVoiceAsset,
  isAudioAssetDueForExpiry,
  isVoiceMediaAsset,
  redactAudioTranscriptionEvidenceForAssetInState,
  STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
  type Stage4B4AudioOrphanEntry,
  type Stage4B4AudioOrphanReport,
  type Stage4B4VoiceDsarExportPackage,
} from "./phase-85-stage-4b4-audio-lifecycle";
import type { Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import type { ManuAppState } from "./types";

export const STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION = "p85-stage-4b4-audio-lifecycle-saga-v2";
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
  legalHoldDeferred: number;
  legalHoldResumed: number;
  claimed: number;
  completed: number;
  retried: number;
  failures: number;
  evidenceRedacted: number;
  orphanEnqueued: number;
  rowWithoutObjectFailures: number;
  orphanObjectCount: number;
  orphanRowCount: number;
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
  retry_count: number | null;
};

async function reconcileStage4B4AudioOrphans(input: {
  supabase: SupabaseClient;
  tenantId: string;
  storage: Stage4B4PaginatedAudioStoragePort;
  state: ManuAppState;
  summary: Stage4B4AudioLifecycleWorkerSummary;
}): Promise<void> {
  const orphanReport = await detectStage4B4AudioOrphansFromStorage(input.state, input.storage, `${input.tenantId}/`);
  input.summary.orphanObjectCount = orphanReport.entries.filter((entry) => entry.kind === "object_without_row").length;
  input.summary.orphanRowCount = orphanReport.entries.filter((entry) => entry.kind === "row_without_object").length;

  for (const entry of orphanReport.entries) {
    if (entry.kind === "object_without_row" && entry.objectKey) {
      const { error } = await input.supabase.rpc("p85_stage_4b4_enqueue_audio_orphan_cleanup_v1", {
        p_tenant_id: input.tenantId,
        p_object_key: entry.objectKey,
      });
      if (!error) {
        input.summary.orphanEnqueued += 1;
      }
      continue;
    }

    if (entry.kind === "row_without_object" && entry.assetId && entry.objectKey) {
      const { error } = await input.supabase.rpc("p85_stage_4b4_fail_audio_row_without_object_v1", {
        p_tenant_id: input.tenantId,
        p_asset_id: entry.assetId,
        p_object_key: entry.objectKey,
      });
      if (!error) {
        input.summary.rowWithoutObjectFailures += 1;
      }
    }
  }
}

export async function runStage4B4AudioLifecycleWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  storage: Stage4B4PaginatedAudioStoragePort;
  state?: ManuAppState;
  batchLimit?: number;
}): Promise<Stage4B4AudioLifecycleWorkerSummary> {
  const workerId = input.workerId ?? "stage4b4-audio-lifecycle-worker";
  const summary: Stage4B4AudioLifecycleWorkerSummary = {
    version: STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    expiryPrepared: 0,
    legalHoldDeferred: 0,
    legalHoldResumed: 0,
    claimed: 0,
    completed: 0,
    retried: 0,
    failures: 0,
    evidenceRedacted: 0,
    orphanEnqueued: 0,
    rowWithoutObjectFailures: 0,
    orphanObjectCount: 0,
    orphanRowCount: 0,
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

  if (input.state) {
    await reconcileStage4B4AudioOrphans({
      supabase: input.supabase,
      tenantId: input.tenantId,
      storage: input.storage,
      state: input.state,
      summary,
    });
  }

  for (let index = 0; index < (input.batchLimit ?? 8); index += 1) {
    const { data: claimedRows, error: claimError } = await input.supabase.rpc(
      "p85_stage_4b4_claim_audio_lifecycle_work_v1",
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
    summary.claimed += 1;

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

    const releaseRpc = success
      ? "p85_stage_4b4_complete_audio_lifecycle_work_v1"
      : "p85_stage_4b4_release_audio_lifecycle_work_v1";
    const releaseArgs = success
      ? {
          p_tenant_id: input.tenantId,
          p_operation_id: claimed.id,
          p_worker_id: workerId,
          p_lease_token: claimed.lease_token,
        }
      : {
          p_tenant_id: input.tenantId,
          p_operation_id: claimed.id,
          p_worker_id: workerId,
          p_lease_token: claimed.lease_token,
          p_success: false,
          p_failure_code: failureCode,
        };

    const { data: releaseData, error: releaseError } = await input.supabase.rpc(releaseRpc, releaseArgs);
    if (releaseError) {
      throw releaseError;
    }

    if (success) {
      summary.completed += 1;
    } else if (releaseData && typeof releaseData === "object" && (releaseData as { status?: string }).status === "pending") {
      summary.retried += 1;
    } else {
      summary.failures += 1;
    }
  }

  return summary;
}

export async function runStage4B4AudioLifecycleWorkerLoop(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  storage: Stage4B4PaginatedAudioStoragePort;
  state?: ManuAppState;
  intervalMs?: number;
  once?: boolean;
  shouldContinue?: () => boolean;
}): Promise<void> {
  const intervalMs = input.intervalMs ?? 60_000;
  const shouldContinue = input.shouldContinue ?? (() => true);

  do {
    const summary = await runStage4B4AudioLifecycleWorkerBatch({
      supabase: input.supabase,
      tenantId: input.tenantId,
      workerId: input.workerId,
      storage: input.storage,
      state: input.state,
    });
    console.log("[worker:audio:lifecycle:stage4b4]", JSON.stringify(summary));
    if (input.once) {
      break;
    }
    if (!shouldContinue()) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

export async function prepareSupabaseClientAudioDsar(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
  state?: ManuAppState,
): Promise<{ rpc: Record<string, unknown>; exportPackage?: Stage4B4VoiceDsarExportPackage }> {
  const { data, error } = await supabase.rpc("p85_stage_4b4_prepare_client_audio_dsar_v1", {
    p_tenant_id: tenantId,
    p_client_id: clientId,
  });
  if (error) {
    throw error;
  }
  const rpc = (data ?? {}) as Record<string, unknown>;
  return {
    rpc,
    exportPackage: state ? buildStage4B4VoiceDsarExportPackage(state, clientId) : undefined,
  };
}

export type { Stage4B4AudioOrphanEntry, Stage4B4AudioOrphanReport };
