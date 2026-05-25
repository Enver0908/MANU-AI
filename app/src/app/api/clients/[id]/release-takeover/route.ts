import { NextResponse } from "next/server";
import {
  assertClientExistsInState,
  getFallbackState,
  releaseHumanTakeoverInState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, releaseSupabaseHumanTakeover } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await releaseSupabaseHumanTakeover(id, await resolveAppTenantContext()));
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
    assertClientExistsInState(state, id);
    return NextResponse.json(saveFallbackState(releaseHumanTakeoverInState(state, id)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
