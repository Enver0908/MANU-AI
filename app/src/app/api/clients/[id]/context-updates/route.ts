import { NextResponse, type NextRequest } from "next/server";
import {
  addClientContextUpdateInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { addSupabaseClientContextUpdate, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { CreateClientContextUpdateInput } from "@/lib/client-context-updates";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as CreateClientContextUpdateInput;

  if (!body.title?.trim() || !body.summary?.trim()) {
    return NextResponse.json({ error: "context_update_title_and_summary_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await addSupabaseClientContextUpdate(id, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(addClientContextUpdateInState(getFallbackState(), id, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
