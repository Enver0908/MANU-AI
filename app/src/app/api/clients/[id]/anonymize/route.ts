import { NextResponse } from "next/server";
import { anonymizeClientDataInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { anonymizeSupabaseClientData, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await anonymizeSupabaseClientData(id, await resolveAppTenantContext()));
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
