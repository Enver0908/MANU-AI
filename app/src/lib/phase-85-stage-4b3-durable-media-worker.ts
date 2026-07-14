import type { SupabaseClient } from "@supabase/supabase-js";
import { createStage4B3DurableMediaTransport } from "./phase-85-stage-4b3-durable-media-transport";
import {
  commitSanitizedMediaAssetV2,
  finalizeTerminalAdmissionFailureV2,
  sanitizeInboundMediaBytes,
  uploadSanitizedMediaObjectsWithRollback,
} from "./phase-85-stage-4b3-durable-media-admission";
import type { Stage4B3MediaAdmissionFailureCode } from "./phase-85-stage-4b3-image-admission";
import { createSupabaseStage4B3MediaStorage } from "./phase-85-stage-4b3-supabase-media-storage";

export const STAGE_4B3_DURABLE_MEDIA_WORKER_VERSION = "p85-stage-4b3-durable-media-worker-v1";
export const STAGE_4B3_WORKER_BATCH_LIMIT = 8;
export const STAGE_4B3_WORKER_ITEM_TIMEOUT_MS = 45_000;
export const STAGE_4B3_WORKER_LEASE_RENEW_MS = 30_000;

export type Stage4B3DurableMediaWorkerSummary = {
  version: string;
  generatedAt: string;
  tenantId: string;
  workerId: string;
  claimed: number;
  sanitized: number;
  failed: number;
  terminalFailures: number;
};

type ClaimedAssetRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  message_id: string;
  provider_media_id: string | null;
  declared_mime_type: string;
  content_sha256: string | null;
  status: string;
  retry_count: number;
  lease_token: string | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("worker_item_timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function renewMediaLease(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  workerId: string,
  leaseToken: string,
) {
  await supabase
    .from("media_assets")
    .update({
      lease_expires_at: new Date(Date.now() + STAGE_4B3_WORKER_LEASE_RENEW_MS).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", assetId)
    .eq("lease_owner", workerId)
    .eq("lease_token", leaseToken);
}

export async function runStage4B3DurableMediaWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  batchLimit?: number;
}): Promise<Stage4B3DurableMediaWorkerSummary> {
  const workerId = input.workerId ?? "stage4b3-durable-media-worker";
  const transport = createStage4B3DurableMediaTransport();
  const storage = createSupabaseStage4B3MediaStorage(input.supabase);
  const summary: Stage4B3DurableMediaWorkerSummary = {
    version: STAGE_4B3_DURABLE_MEDIA_WORKER_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    claimed: 0,
    sanitized: 0,
    failed: 0,
    terminalFailures: 0,
  };

  for (let index = 0; index < (input.batchLimit ?? STAGE_4B3_WORKER_BATCH_LIMIT); index += 1) {
    const { data: claimedRows, error: claimError } = await input.supabase.rpc("p85_stage_4b3_claim_media_work_v2", {
      p_tenant_id: input.tenantId,
      p_worker_id: workerId,
    });
    if (claimError) {
      throw claimError;
    }
    const claimed = (claimedRows?.[0] ?? null) as ClaimedAssetRow | null;
    if (!claimed?.id || !claimed.lease_token) {
      break;
    }
    summary.claimed += 1;

    try {
      await withTimeout(
        processClaimedMediaAsset({
          supabase: input.supabase,
          transport,
          storage,
          workerId,
          asset: claimed,
          onTerminalFailure: () => {
            summary.terminalFailures += 1;
          },
        }),
        STAGE_4B3_WORKER_ITEM_TIMEOUT_MS,
      );
      summary.sanitized += 1;
    } catch (error) {
      summary.failed += 1;
      const failureCode = resolveWorkerFailureCode(error);
      const nextRetry = (claimed.retry_count ?? 0) + 1;
      await input.supabase.rpc("p85_stage_4b3_release_media_work_v2", {
        p_tenant_id: input.tenantId,
        p_asset_id: claimed.id,
        p_worker_id: workerId,
        p_lease_token: claimed.lease_token,
        p_success: false,
        p_failure_code: failureCode,
      });

      if (nextRetry >= 3) {
        const bundleId = await resolveBundleIdForAsset(input.supabase, input.tenantId, claimed.id);
        await finalizeTerminalAdmissionFailureV2({
          supabase: input.supabase,
          tenantId: input.tenantId,
          assetId: claimed.id,
          bundleId,
          failureCode,
          notification: bundleId
            ? {
                id: crypto.randomUUID(),
                clientId: claimed.client_id,
                conversationId: claimed.conversation_id,
                messageId: claimed.message_id,
                dedupeKey: `stage4b3:visual-review:${claimed.id}`,
              }
            : undefined,
        });
        summary.terminalFailures += 1;
      }
    }
  }

  return summary;
}

async function processClaimedMediaAsset(input: {
  supabase: SupabaseClient;
  transport: ReturnType<typeof createStage4B3DurableMediaTransport>;
  storage: ReturnType<typeof createSupabaseStage4B3MediaStorage>;
  workerId: string;
  asset: ClaimedAssetRow;
  onTerminalFailure: () => void;
}) {
  if (input.asset.status !== "download_pending") {
    await input.supabase.rpc("p85_stage_4b3_release_media_work_v2", {
      p_tenant_id: input.asset.tenant_id,
      p_asset_id: input.asset.id,
      p_worker_id: input.workerId,
      p_lease_token: input.asset.lease_token,
      p_success: true,
    });
    return;
  }

  const providerMediaId = input.asset.provider_media_id;
  if (!providerMediaId) {
    throw new Error("missing_provider_media_id");
  }

  await renewMediaLease(
    input.supabase,
    input.asset.tenant_id,
    input.asset.id,
    input.workerId,
    input.asset.lease_token!,
  );

  const fetched = await input.transport.fetchProviderMedia(providerMediaId);
  if (!fetched.ok) {
    throw new Error(fetched.failureCode);
  }

  const sanitized = await sanitizeInboundMediaBytes({
    bytes: fetched.bytes,
    declaredMimeType: input.asset.declared_mime_type,
    expectedSha256: input.asset.content_sha256,
  });
  if (!sanitized.ok) {
    throw new Error(sanitized.failureCode);
  }

  const objectKeys = await uploadSanitizedMediaObjectsWithRollback({
    storage: input.storage,
    tenantId: input.asset.tenant_id,
    assetId: input.asset.id,
    artifacts: sanitized.artifacts,
    supabase: input.supabase,
  });

  const storedAt = new Date().toISOString();
  await commitSanitizedMediaAssetV2({
    supabase: input.supabase,
    tenantId: input.asset.tenant_id,
    assetId: input.asset.id,
    workerId: input.workerId,
    leaseToken: input.asset.lease_token!,
    artifacts: sanitized.artifacts,
    objectKeys,
    storedAt,
    status: "sanitized",
  });

  await input.supabase.rpc("p85_stage_4b3_release_media_work_v2", {
    p_tenant_id: input.asset.tenant_id,
    p_asset_id: input.asset.id,
    p_worker_id: input.workerId,
    p_lease_token: input.asset.lease_token,
    p_success: true,
  });
}

async function resolveBundleIdForAsset(supabase: SupabaseClient, tenantId: string, assetId: string) {
  const { data } = await supabase
    .from("inbound_message_bundle_items")
    .select("bundle_id")
    .eq("tenant_id", tenantId)
    .eq("media_asset_id", assetId)
    .maybeSingle();
  return data?.bundle_id ? String(data.bundle_id) : null;
}

function resolveWorkerFailureCode(error: unknown): Stage4B3MediaAdmissionFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("worker_item_timeout")) {
    return "storage_upload_failed";
  }
  if (
    message === "missing_provider_media_id" ||
    message === "transport_unavailable" ||
    message === "mime_spoof" ||
    message === "hash_mismatch" ||
    message === "corrupt_image" ||
    message === "animated_image" ||
    message === "dimensions_too_small" ||
    message === "dimensions_too_large" ||
    message === "megapixels_too_large" ||
    message === "decompression_bomb" ||
    message === "stream_too_large" ||
    message === "unsupported_mime" ||
    message === "storage_upload_failed"
  ) {
    return message as Stage4B3MediaAdmissionFailureCode;
  }
  return "storage_upload_failed";
}

export async function runStage4B3DurableMediaWorkerLoop(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  intervalMs?: number;
  once?: boolean;
  shouldContinue?: () => boolean;
}) {
  const intervalMs = input.intervalMs ?? Number(process.env.MANU_STAGE4B3_WORKER_INTERVAL_MS || "3000");
  const shouldContinue = input.shouldContinue ?? (() => true);

  do {
    if (!shouldContinue()) {
      break;
    }
    await runStage4B3DurableMediaWorkerBatch({
      supabase: input.supabase,
      tenantId: input.tenantId,
      workerId: input.workerId,
    });
    if (input.once) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}
