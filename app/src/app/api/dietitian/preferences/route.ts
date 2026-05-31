import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, updateDietitianPreferencesInState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, updateSupabaseDietitianPreferences } from "@/lib/supabase-store";

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { uiLanguage?: unknown };

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await updateSupabaseDietitianPreferences(body, tenantContext));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(saveFallbackState(updateDietitianPreferencesInState(getFallbackState(), body)));
}
