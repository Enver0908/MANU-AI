import { AppDomainError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import {
  assertConversationMediaReadable,
  buildConversationMediaStreamHeaders,
  parseConversationMediaStreamVariant,
  resolveMediaStreamContentType,
  resolveMediaStreamHttpStatus,
  resolveMediaStreamObjectKey,
  STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
} from "./phase-85-stage-4b3-bounded-media";
import { getFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import { STAGE_4B3_MEDIA_BUCKET_ID } from "./phase-85-stage-4b3-media-storage";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  assertConversationReadable,
  resolveConversationPermissions,
} from "./phase-85-stage-4b2-api";
import type { ConversationAssignmentInput } from "./phase-85-stage-4b2-contracts";
import { conversationActorFromContext } from "./phase-85-stage-4b2-messaging";
import type { ManuAppState } from "./types";
import { getSupabaseAdminClient } from "./supabase";
import { STAGE_4B4_AUDIO_BUCKET_ID } from "./phase-85-stage-4b4-audio-storage";
import { getFallbackStage4B4AudioStorage } from "./phase-85-stage-4b4-fallback-audio-storage";
import {
  buildAudioStreamResponseHeaders,
  parseHttpByteRangeHeader,
  sliceBufferForRange,
} from "./phase-85-stage-4b4-media-range";

export type ConversationMediaStreamResult =
  | { ok: true; body: Buffer; status: 200 | 206; headers: Record<string, string> }
  | { ok: false; status: 404 | 410 | 416; code: string };

function buildStreamResponse(
  body: Buffer,
  contentType: string,
  variant: ReturnType<typeof parseConversationMediaStreamVariant>,
  rangeHeader: string | null | undefined,
): ConversationMediaStreamResult {
  if (variant !== "audio") {
    return {
      ok: true,
      body,
      status: 200,
      headers: buildConversationMediaStreamHeaders(contentType, body.byteLength),
    };
  }

  const parsedRange = parseHttpByteRangeHeader(rangeHeader, body.byteLength);
  if (parsedRange.kind === "unsatisfied") {
    return { ok: false, status: 416, code: "range_not_satisfiable" };
  }

  if (parsedRange.kind === "partial") {
    const chunk = sliceBufferForRange(body, parsedRange);
    return {
      ok: true,
      body: chunk,
      status: 206,
      headers: buildAudioStreamResponseHeaders({
        contentType,
        totalSize: body.byteLength,
        range: parsedRange,
        cacheControl: STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
      }),
    };
  }

  return {
    ok: true,
    body,
    status: 200,
    headers: buildAudioStreamResponseHeaders({
      contentType,
      totalSize: body.byteLength,
      range: parsedRange,
      cacheControl: STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
    }),
  };
}

export async function streamConversationMediaFromFallbackState(input: {
  state: ManuAppState;
  context: AppTenantContext;
  assignments: readonly ConversationAssignmentInput[];
  conversationId: string;
  assetId: string;
  variant: string | null | undefined;
  rangeHeader?: string | null;
}): Promise<ConversationMediaStreamResult> {
  const actor = conversationActorFromContext(input.context);
  const conversation = input.state.conversations.find(
    (entry) => entry.tenantId === actor.tenantId && entry.id === input.conversationId,
  );
  const client = conversation
    ? input.state.clients.find(
        (entry) =>
          entry.tenantId === actor.tenantId &&
          entry.id === conversation.clientId &&
          entry.lifecycleStatus === "active",
      )
    : undefined;
  if (!conversation || !client) {
    return { ok: false, status: 404, code: "conversation_not_found" };
  }

  const permissions = resolveConversationPermissions({
    actor,
    conversation,
    client,
    assignments: input.assignments,
  });
  assertConversationReadable(permissions);

  const asset = input.state.mediaAssets.find(
    (entry) =>
      entry.tenantId === actor.tenantId &&
      entry.id === input.assetId &&
      entry.conversationId === input.conversationId,
  );
  if (!asset) {
    return { ok: false, status: 404, code: "media_asset_not_found" };
  }

  try {
    assertConversationMediaReadable(permissions, asset, input.conversationId);
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 404) {
      return { ok: false, status: 404, code: error.message };
    }
    throw error;
  }

  const variant = parseConversationMediaStreamVariant(input.variant);
  const httpStatus = resolveMediaStreamHttpStatus(asset, variant);
  if (httpStatus === 410) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const objectKey = resolveMediaStreamObjectKey(asset, variant);
  if (!objectKey) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const downloaded =
    variant === "audio"
      ? await getFallbackStage4B4AudioStorage().downloadObject(objectKey)
      : await getFallbackStage4B3MediaStorage().downloadObject(objectKey);
  if (!downloaded) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const contentType = downloaded.contentType || resolveMediaStreamContentType(asset, variant);
  return buildStreamResponse(downloaded.bytes, contentType, variant, input.rangeHeader);
}

export async function streamConversationMediaFromSupabase(input: {
  context: AppTenantContext;
  conversationId: string;
  assetId: string;
  variant: string | null | undefined;
  rangeHeader?: string | null;
}): Promise<ConversationMediaStreamResult> {
  const actor = conversationActorFromContext(input.context);
  const variant = parseConversationMediaStreamVariant(input.variant);
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("supabase_unavailable");
  }
  const rpc = await supabase.rpc("p85_stage_4b3_resolve_media_stream_v2", {
    p_tenant_id: actor.tenantId,
    p_user_id: actor.userId,
    p_dietitian_id: actor.dietitianId,
    p_role: actor.role,
    p_conversation_id: input.conversationId,
    p_asset_id: input.assetId,
    p_variant: variant,
  });
  if (rpc.error) {
    const message = rpc.error.message || "media_stream_failed";
    if (message.includes("conversation_not_found") || message.includes("media_asset_not_found")) {
      return {
        ok: false,
        status: 404,
        code: message.includes("media_asset_not_found") ? "media_asset_not_found" : "conversation_not_found",
      };
    }
    if (message.includes("media_asset_unavailable")) {
      return { ok: false, status: 410, code: "media_asset_unavailable" };
    }
    throw new Error("media_stream_failed");
  }

  const payload = rpc.data as { object_key?: string; content_type?: string; bucket_id?: string } | null;
  const objectKey = payload?.object_key;
  const contentType = payload?.content_type ?? (variant === "audio" ? "audio/wav" : "image/jpeg");
  const bucketId = payload?.bucket_id ?? (variant === "audio" ? STAGE_4B4_AUDIO_BUCKET_ID : STAGE_4B3_MEDIA_BUCKET_ID);
  if (!objectKey) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const downloaded = await supabase.storage.from(bucketId).download(objectKey);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return buildStreamResponse(bytes, contentType, variant, input.rangeHeader);
}

export function findConversationMediaAsset(
  state: ManuAppState,
  tenantId: string,
  conversationId: string,
  assetId: string,
): MediaAssetRecord | null {
  return (
    state.mediaAssets.find(
      (asset) => asset.tenantId === tenantId && asset.conversationId === conversationId && asset.id === assetId,
    ) ?? null
  );
}
