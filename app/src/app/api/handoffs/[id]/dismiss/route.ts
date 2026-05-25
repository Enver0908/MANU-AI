import { NextResponse } from "next/server";
import {
  assertHandoffExistsInState,
  getFallbackState,
  saveFallbackState,
  updateHandoffStatusInState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, updateSupabaseHandoffStatus } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "handoff_update");
      return NextResponse.json(await updateSupabaseHandoffStatus(id, "dismissed", tenantContext));
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
    assertHandoffExistsInState(state, id);
    return NextResponse.json(saveFallbackState(updateHandoffStatusInState(state, id, "dismissed")));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
