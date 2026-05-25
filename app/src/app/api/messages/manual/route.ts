import { NextResponse, type NextRequest } from "next/server";
import { addManualReplyInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { addSupabaseManualReply, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { clientId?: string; body?: string };

  if (!body.clientId || !body.body?.trim()) {
    return NextResponse.json({ error: "clientId_and_body_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "manual_reply");
      return NextResponse.json(await addSupabaseManualReply(body.clientId, body.body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(addManualReplyInState(getFallbackState(), body.clientId, body.body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
