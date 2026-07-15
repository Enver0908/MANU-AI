import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalizeOggOpusVoiceBytes } from "./phase-85-stage-4b4-audio-canonicalizer";
import type { Stage4B4AudioAdmissionFailureCode } from "./phase-85-stage-4b4-audio-admission";
import { createStage4B4DurableAudioTransport } from "./phase-85-stage-4b4-audio-transport";
import { createSupabaseStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import {
  COMMUNICATION_LANGUAGE_TO_LOCALE,
  STAGE_4B4_MEDIA_RETENTION_DAYS,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";
import {
  commitCompleteAudioAdmissionV2,
  uploadCanonicalAudioObjectWithRollback,
} from "./phase-85-stage-4b4-durable-pipeline-saga";

export const STAGE_4B4_DURABLE_ADMISSION_WORKER_VERSION = "p85-stage-4b4-durable-admission-worker-v1";
export const STAGE_4B4_ADMISSION_WORKER_BATCH_LIMIT = 8;
export const STAGE_4B4_ADMISSION_WORKER_ITEM_TIMEOUT_MS = 45_000;
export const STAGE_4B4_ADMISSION_WORKER_LEASE_RENEW_MS = 20_000;

export type Stage4B4DurableAdmissionWorkerSummary = {
  version: string;
  generatedAt: string;
  tenantId: string;
  workerId: string;
  claimed: number;
  admitted: number;
  failed: number;
  retriesScheduled: number;
};

type ClaimedAudioAssetRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  message_id: string;
  provider_media_id: string | null;
  declared_mime_type: string;
  content_sha256: string | null;
  duration_ms: number | null;
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

function computeMediaExpiresAt(now: Date = new Date()): string {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + STAGE_4B4_MEDIA_RETENTION_DAYS);
  return expiresAt.toISOString();
}

async function renewAudioAdmissionLease(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  workerId: string,
  leaseToken: string,
) {
  await supabase.rpc("p85_stage_4b4_renew_audio_admission_lease_v2", {
    p_tenant_id: tenantId,
    p_asset_id: assetId,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
  });
}

async function resolveClientLocale(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<Stage4B4SupportedLocale> {
  const { data } = await supabase
    .from("clients")
    .select("communication_language")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle();
  const language = data?.communication_language;
  if (typeof language === "string" && language in COMMUNICATION_LANGUAGE_TO_LOCALE) {
    return COMMUNICATION_LANGUAGE_TO_LOCALE[language as keyof typeof COMMUNICATION_LANGUAGE_TO_LOCALE];
  }
  return "tr-TR";
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

function resolveAdmissionFailureCode(error: unknown): Stage4B4AudioAdmissionFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("worker_item_timeout")) {
    return "storage_upload_failed";
  }
  if (
    message === "missing_provider_media_id" ||
    message === "transport_unavailable" ||
    message === "stream_too_large" ||
    message === "unsupported_mime" ||
    message === "mime_spoof" ||
    message === "hash_mismatch" ||
    message === "corrupt_ogg" ||
    message === "corrupt_ogg_page" ||
    message === "missing_opus_head" ||
    message === "invalid_opus_head" ||
    message === "non_opus_codec" ||
    message === "stereo_not_allowed" ||
    message === "duration_exceeded" ||
    message === "granule_duration_exceeded" ||
    message === "decode_sample_limit_exceeded" ||
    message === "decode_failed" ||
    message === "storage_upload_failed"
  ) {
    return message as Stage4B4AudioAdmissionFailureCode;
  }
  return "storage_upload_failed";
}

async function processClaimedAudioAsset(input: {
  supabase: SupabaseClient;
  workerId: string;
  asset: ClaimedAudioAssetRow;
  transport: ReturnType<typeof createStage4B4DurableAudioTransport>;
  storage: ReturnType<typeof createSupabaseStage4B4AudioStorage>;
}) {
  if (input.asset.status !== "download_pending") {
    return;
  }

  const providerMediaId = input.asset.provider_media_id;
  if (!providerMediaId) {
    throw new Error("missing_provider_media_id");
  }

  await renewAudioAdmissionLease(
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

  const canonical = await canonicalizeOggOpusVoiceBytes({
    bytes: fetched.bytes,
    declaredMimeType: input.asset.declared_mime_type,
    expectedSha256: input.asset.content_sha256,
    declaredDurationMs: input.asset.duration_ms,
  });
  if (!canonical.ok) {
    throw new Error(canonical.failureCode);
  }

  const objectKey = await uploadCanonicalAudioObjectWithRollback({
    storage: input.storage,
    supabase: input.supabase,
    tenantId: input.asset.tenant_id,
    assetId: input.asset.id,
    artifacts: canonical.artifacts,
  });

  const storedAt = new Date().toISOString();
  const locale = await resolveClientLocale(input.supabase, input.asset.tenant_id, input.asset.client_id);
  const bundleId = await resolveBundleIdForAsset(input.supabase, input.asset.tenant_id, input.asset.id);

  await commitCompleteAudioAdmissionV2({
    supabase: input.supabase,
    tenantId: input.asset.tenant_id,
    assetId: input.asset.id,
    workerId: input.workerId,
    leaseToken: input.asset.lease_token!,
    transcriptionId: crypto.randomUUID(),
    locale,
    artifacts: canonical.artifacts,
    objectKey,
    storedAt,
    expiresAt: computeMediaExpiresAt(),
    bundleId,
  });
}

export async function runStage4B4DurableAdmissionWorkerBatch(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  batchLimit?: number;
}): Promise<Stage4B4DurableAdmissionWorkerSummary> {
  const workerId = input.workerId ?? "stage4b4-durable-admission-worker";
  const transport = createStage4B4DurableAudioTransport();
  const storage = createSupabaseStage4B4AudioStorage(input.supabase);
  const summary: Stage4B4DurableAdmissionWorkerSummary = {
    version: STAGE_4B4_DURABLE_ADMISSION_WORKER_VERSION,
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    workerId,
    claimed: 0,
    admitted: 0,
    failed: 0,
    retriesScheduled: 0,
  };

  for (let index = 0; index < (input.batchLimit ?? STAGE_4B4_ADMISSION_WORKER_BATCH_LIMIT); index += 1) {
    const { data: claimedRows, error: claimError } = await input.supabase.rpc(
      "p85_stage_4b4_claim_audio_admission_work_v2",
      {
        p_tenant_id: input.tenantId,
        p_worker_id: workerId,
      },
    );
    if (claimError) {
      throw claimError;
    }

    const claimed = (claimedRows?.[0] ?? null) as ClaimedAudioAssetRow | null;
    if (!claimed?.id || !claimed.lease_token) {
      break;
    }
    summary.claimed += 1;

    try {
      await withTimeout(
        processClaimedAudioAsset({
          supabase: input.supabase,
          workerId,
          asset: claimed,
          transport,
          storage,
        }),
        STAGE_4B4_ADMISSION_WORKER_ITEM_TIMEOUT_MS,
      );
      summary.admitted += 1;
    } catch (error) {
      const failureCode = resolveAdmissionFailureCode(error);
      const result = await input.supabase.rpc("p85_stage_4b4_fail_audio_admission_v2", {
        p_tenant_id: input.tenantId,
        p_asset_id: claimed.id,
        p_worker_id: workerId,
        p_lease_token: claimed.lease_token,
        p_failure_code: failureCode,
        p_terminal_class: failureCode === "storage_upload_failed" || failureCode === "transport_unavailable"
          ? "transient"
          : "security",
      });
      if (result.error) {
        throw result.error;
      }
      if (result.data?.status === "retry_scheduled") {
        summary.retriesScheduled += 1;
      } else {
        summary.failed += 1;
      }
    }
  }

  return summary;
}

export async function runStage4B4DurableAdmissionWorkerLoop(input: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId?: string;
  intervalMs?: number;
  once?: boolean;
  shouldContinue?: () => boolean;
}) {
  const intervalMs = input.intervalMs ?? Number(process.env.MANU_STAGE4B4_ADMISSION_WORKER_INTERVAL_MS || "3000");
  const shouldContinue = input.shouldContinue ?? (() => true);

  do {
    if (!shouldContinue()) {
      break;
    }
    await runStage4B4DurableAdmissionWorkerBatch({
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
