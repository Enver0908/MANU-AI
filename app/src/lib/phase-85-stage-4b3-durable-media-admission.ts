import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStage4B3MediaObjectKeys,
  validateAndSanitizeImageBytes,
  type Stage4B3MediaAdmissionFailureCode,
  type Stage4B3SanitizedImageArtifacts,
} from "./phase-85-stage-4b3-image-admission";
import type { Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";

export const STAGE_4B3_DURABLE_MEDIA_ADMISSION_VERSION = "p85-stage-4b3-durable-media-admission-v1";

export async function uploadSanitizedMediaObjectsWithRollback(input: {
  storage: Stage4B3MediaStoragePort;
  tenantId: string;
  assetId: string;
  artifacts: Stage4B3SanitizedImageArtifacts;
  supabase?: SupabaseClient;
}): Promise<{ sanitizedFullObjectKey: string; thumbnailObjectKey: string }> {
  const objectKeys = buildStage4B3MediaObjectKeys(input.tenantId, input.assetId);
  let uploadedFull = false;

  try {
    await input.storage.uploadObject(
      objectKeys.sanitizedFullObjectKey,
      input.artifacts.sanitizedFullBytes,
      "image/jpeg",
    );
    uploadedFull = true;
    await input.storage.uploadObject(objectKeys.thumbnailObjectKey, input.artifacts.thumbnailBytes, "image/jpeg");
  } catch (error) {
    if (uploadedFull) {
      try {
        await input.storage.deleteObject(objectKeys.sanitizedFullObjectKey);
      } catch {
        if (input.supabase) {
          await input.supabase.rpc("p85_stage_4b3_enqueue_media_object_operation_v2", {
            p_tenant_id: input.tenantId,
            p_media_asset_id: input.assetId,
            p_object_key: objectKeys.sanitizedFullObjectKey,
            p_operation_kind: "delete_object",
            p_failure_code: "partial_upload_rollback_delete_failed",
          });
        }
      }
    }
    throw error;
  }

  return objectKeys;
}

export async function commitSanitizedMediaAssetV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  assetId: string;
  workerId: string;
  leaseToken: string;
  artifacts: Stage4B3SanitizedImageArtifacts;
  objectKeys: { sanitizedFullObjectKey: string; thumbnailObjectKey: string };
  storedAt: string;
  status?: "sanitized" | "analysis_pending";
}): Promise<void> {
  const { error } = await input.supabase.rpc("p85_stage_4b3_commit_sanitized_media_v2", {
    p_tenant_id: input.tenantId,
    p_asset_id: input.assetId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_payload: {
      detectedMimeType: input.artifacts.detectedMimeType,
      width: input.artifacts.dimensions.width,
      height: input.artifacts.dimensions.height,
      byteSize: input.artifacts.sanitizedFullBytes.byteLength,
      contentSha256: input.artifacts.contentSha256,
      sanitizedFullObjectKey: input.objectKeys.sanitizedFullObjectKey,
      thumbnailObjectKey: input.objectKeys.thumbnailObjectKey,
      status: input.status ?? "sanitized",
      storedAt: input.storedAt,
      expiresAt: input.artifacts.expiresAt,
    },
  });

  if (error) {
    await input.supabase.rpc("p85_stage_4b3_enqueue_media_object_operation_v2", {
      p_tenant_id: input.tenantId,
      p_media_asset_id: input.assetId,
      p_object_key: input.objectKeys.sanitizedFullObjectKey,
    });
    await input.supabase.rpc("p85_stage_4b3_enqueue_media_object_operation_v2", {
      p_tenant_id: input.tenantId,
      p_media_asset_id: input.assetId,
      p_object_key: input.objectKeys.thumbnailObjectKey,
    });
    throw error;
  }
}

export async function finalizeTerminalAdmissionFailureV2(input: {
  supabase: SupabaseClient;
  tenantId: string;
  assetId: string;
  bundleId: string | null;
  failureCode: Stage4B3MediaAdmissionFailureCode;
  notification?: {
    id: string;
    clientId: string;
    conversationId: string;
    messageId: string;
    dedupeKey: string;
  };
}): Promise<void> {
  const { error } = await input.supabase.rpc("p85_stage_4b3_finalize_terminal_admission_failure_v2", {
    p_tenant_id: input.tenantId,
    p_asset_id: input.assetId,
    p_bundle_id: input.bundleId,
    p_failure_code: input.failureCode,
    p_notification: input.notification
      ? {
          id: input.notification.id,
          type: "visual_message_review",
          kind: "visual_message_review",
          priority: "review_required",
          entityType: "inbound_message_bundle",
          entityId: input.bundleId,
          title: "Visual message review required",
          body: "Media admission failed and requires dietitian review.",
          dedupeKey: input.notification.dedupeKey,
          clientId: input.notification.clientId,
          conversationId: input.notification.conversationId,
          messageId: input.notification.messageId,
          occurrenceCount: 1,
          lastOccurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
      : null,
  });
  if (error) {
    throw error;
  }
}

export async function sanitizeInboundMediaBytes(input: {
  bytes: Buffer;
  declaredMimeType: string;
  expectedSha256?: string | null;
  now?: string;
}) {
  return validateAndSanitizeImageBytes({
    bytes: input.bytes,
    declaredMimeType: input.declaredMimeType,
    expectedSha256: input.expectedSha256,
    now: input.now ? new Date(input.now) : undefined,
  });
}
