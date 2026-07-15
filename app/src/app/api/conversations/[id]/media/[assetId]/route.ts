import { NextResponse } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { getFallbackState } from "@/lib/app-state-store";
import { listFallbackAssignments } from "@/lib/phase-85-stage-4b-api";
import { assertConversationId } from "@/lib/phase-85-stage-4b2-api";
import { parseConversationMediaStreamVariant } from "@/lib/phase-85-stage-4b3-bounded-media";
import {
  streamConversationMediaFromFallbackState,
  streamConversationMediaFromSupabase,
} from "@/lib/phase-85-stage-4b3-media-stream";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { requireConversationApiActor } from "@/lib/phase-85-stage-4b2-read-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; assetId: string }> },
) {
  try {
    const { id, assetId } = await context.params;
    const conversationId = assertConversationId(id);
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return NextResponse.json({ error: "invalid_asset_id" }, { status: 400 });
    }

    const tenantContext = await resolveAppTenantContext();
    requireCapability(tenantContext, "read_app_state");
    requireConversationApiActor(tenantContext);

    const url = new URL(request.url);
    const variant = parseConversationMediaStreamVariant(url.searchParams.get("variant"));
    const rangeHeader = request.headers.get("range");

    if (isSupabaseStoreConfigured()) {
      const stream = await streamConversationMediaFromSupabase({
        context: tenantContext,
        conversationId,
        assetId: normalizedAssetId,
        variant,
        rangeHeader,
      });
      if (!stream.ok) {
        if (stream.status === 416) {
          return new NextResponse(null, { status: 416, headers: { "Content-Range": "bytes */0" } });
        }
        return NextResponse.json({ error: stream.code }, { status: stream.status });
      }
      return new NextResponse(new Uint8Array(stream.body), { status: stream.status, headers: stream.headers });
    }

    const stream = await streamConversationMediaFromFallbackState({
      state: getFallbackState(),
      context: tenantContext,
      assignments: listFallbackAssignments(),
      conversationId,
      assetId: normalizedAssetId,
      variant,
      rangeHeader,
    });
    if (!stream.ok) {
      if (stream.status === 416) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": "bytes */0" } });
      }
      return NextResponse.json({ error: stream.code }, { status: stream.status });
    }
    return new NextResponse(new Uint8Array(stream.body), { status: stream.status, headers: stream.headers });
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
