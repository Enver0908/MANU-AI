import { NextResponse } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { getFallbackState } from "@/lib/app-state-store";
import { listFallbackAssignments } from "@/lib/phase-85-stage-4b-api";
import { assertConversationId } from "@/lib/phase-85-stage-4b2-api";
import {
  parseConversationMediaStreamVariant,
} from "@/lib/phase-85-stage-4b3-bounded-media";
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

    const url = new URL(request.url);
    const variant = parseConversationMediaStreamVariant(url.searchParams.get("variant"));

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      requireConversationApiActor(tenantContext);
      const stream = await streamConversationMediaFromSupabase({
        context: tenantContext,
        conversationId,
        assetId: normalizedAssetId,
        variant,
      });
      if (!stream.ok) {
        return NextResponse.json({ error: stream.code }, { status: stream.status });
      }
      return new NextResponse(new Uint8Array(stream.body), { status: 200, headers: stream.headers });
    }

    const tenantContext = await resolveAppTenantContext().catch(() => null);
    const state = getFallbackState();
    const stream = await streamConversationMediaFromFallbackState({
      state,
      context:
        tenantContext ??
        ({
          tenantId: state.tenant.id,
          userId: "fallback-user",
          dietitianId: state.dietitian.id,
          role: "owner",
        } as const),
      assignments: listFallbackAssignments(),
      conversationId,
      assetId: normalizedAssetId,
      variant,
    });
    if (!stream.ok) {
      return NextResponse.json({ error: stream.code }, { status: stream.status });
    }
    return new NextResponse(new Uint8Array(stream.body), { status: 200, headers: stream.headers });
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
