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
import {
  createSupabaseStage4B4AudioStorage,
  STAGE_4B4_AUDIO_BUCKET_ID,
  type Stage4B4AudioStoragePort,
  type Stage4B4ObjectByteRange,
} from "./phase-85-stage-4b4-audio-storage";
import { getFallbackStage4B4AudioStorage } from "./phase-85-stage-4b4-fallback-audio-storage";
import {
  buildAudioStreamEtag,
  buildAudioStreamResponseHeaders,
  buildRangeNotSatisfiableHeaders,
  parseHttpByteRangeHeader,
  type ParsedHttpByteRange,
} from "./phase-85-stage-4b4-media-range";

export type ConversationMediaStreamResult =
  | { ok: true; body: Buffer; status: 200 | 206; headers: Record<string, string> }
  | { ok: false; status: 404 | 410 | 416; code: string; headers?: Record<string, string> };

function buildImageStreamResponse(
  body: Buffer,
  contentType: string,
): ConversationMediaStreamResult {
  return {
    ok: true,
    body,
    status: 200,
    headers: buildConversationMediaStreamHeaders(contentType, body.byteLength),
  };
}

function buildAudioStreamResponse(input: {
  body: Buffer;
  contentType: string;
  totalSize: number;
  parsedRange: ParsedHttpByteRange;
  etag?: string;
}): ConversationMediaStreamResult {
  const headers = buildAudioStreamResponseHeaders({
    contentType: input.contentType,
    totalSize: input.totalSize,
    range: input.parsedRange,
    cacheControl: STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
    etag: buildAudioStreamEtag(input.etag),
  });

  if (input.parsedRange.kind === "partial") {
    return {
      ok: true,
      body: input.body,
      status: 206,
      headers,
    };
  }

  return {
    ok: true,
    body: input.body,
    status: 200,
    headers,
  };
}

async function streamAudioObjectWithRange(input: {
  storage: Stage4B4AudioStoragePort;
  objectKey: string;
  contentType: string;
  byteSize: number | null;
  etag: string | null;
  rangeHeader: string | null | undefined;
}): Promise<ConversationMediaStreamResult> {
  const stat =
    input.byteSize != null && input.byteSize > 0
      ? { totalSize: input.byteSize, contentType: input.contentType }
      : await input.storage.statObject(input.objectKey);
  if (!stat || stat.totalSize <= 0) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const parsedRange = parseHttpByteRangeHeader(input.rangeHeader, stat.totalSize);
  if (parsedRange.kind === "unsatisfied") {
    return {
      ok: false,
      status: 416,
      code: "range_not_satisfiable",
      headers: buildRangeNotSatisfiableHeaders(stat.totalSize),
    };
  }

  const requestedRange: Stage4B4ObjectByteRange | null =
    parsedRange.kind === "partial"
      ? { start: parsedRange.start, end: parsedRange.end }
      : null;
  const ranged = await input.storage.downloadObjectRange(input.objectKey, requestedRange);
  if (!ranged) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  return buildAudioStreamResponse({
    body: ranged.bytes,
    contentType: ranged.contentType || stat.contentType || input.contentType,
    totalSize: stat.totalSize,
    parsedRange,
    etag: input.etag ?? undefined,
  });
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

  if (variant === "audio") {
    return streamAudioObjectWithRange({
      storage: getFallbackStage4B4AudioStorage(),
      objectKey,
      contentType: "audio/wav",
      byteSize: asset.byteSize,
      etag: asset.contentSha256,
      rangeHeader: input.rangeHeader,
    });
  }

  const downloaded = await getFallbackStage4B3MediaStorage().downloadObject(objectKey);
  if (!downloaded) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const contentType = downloaded.contentType || resolveMediaStreamContentType(asset, variant);
  return buildImageStreamResponse(downloaded.bytes, contentType);
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

  const payload = rpc.data as {
    object_key?: string;
    content_type?: string;
    bucket_id?: string;
    byte_size?: number | null;
    etag?: string | null;
  } | null;
  const objectKey = payload?.object_key;
  const contentType = payload?.content_type ?? (variant === "audio" ? "audio/wav" : "image/jpeg");
  const bucketId = payload?.bucket_id ?? (variant === "audio" ? STAGE_4B4_AUDIO_BUCKET_ID : STAGE_4B3_MEDIA_BUCKET_ID);
  if (!objectKey) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  if (variant === "audio") {
    return streamAudioObjectWithRange({
      storage: createSupabaseStage4B4AudioStorage(supabase),
      objectKey,
      contentType,
      byteSize: payload?.byte_size ?? null,
      etag: payload?.etag ?? null,
      rangeHeader: input.rangeHeader,
    });
  }

  const downloaded = await supabase.storage.from(bucketId).download(objectKey);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, status: 410, code: "media_asset_unavailable" };
  }

  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return buildImageStreamResponse(bytes, contentType);
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
