import { NextResponse } from "next/server";
import { getFallbackState, acknowledgeNotification, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { acknowledgeSupabaseNotification, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "notification_update");
      return NextResponse.json(await acknowledgeSupabaseNotification(id, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    const state = getFallbackState();
    return NextResponse.json(saveFallbackState(acknowledgeNotification(state, id)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
