import { NextResponse } from "next/server";
import { anonymizeClientDataInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { anonymizeSupabaseClientData, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "anonymize_client");
      return NextResponse.json(await anonymizeSupabaseClientData(id, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(anonymizeClientDataInState(getFallbackState(), id)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
