import { NextResponse } from "next/server";
import { generateVoiceProfile, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { generateSupabaseVoiceProfile, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST() {
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await generateSupabaseVoiceProfile(tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(generateVoiceProfile(getFallbackState())));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
