import { NextResponse, type NextRequest } from "next/server";
import { activateMenuPlanInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, activateSupabaseClientMenuPlan } from "@/lib/supabase-store";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await activateSupabaseClientMenuPlan(id, planId, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(activateMenuPlanInState(getFallbackState(), id, planId)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
