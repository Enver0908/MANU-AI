import { NextResponse } from "next/server";
import {
  assertHandoffExistsInState,
  getFallbackState,
  saveFallbackState,
  updateHandoffStatusInState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, updateSupabaseHandoffStatus } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await updateSupabaseHandoffStatus(id, "resolved", await resolveAppTenantContext()));
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
    return NextResponse.json(saveFallbackState(updateHandoffStatusInState(state, id, "resolved")));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
