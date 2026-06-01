import { NextResponse } from "next/server";
import { getFallbackState, resolveAndReactivateRedRiskInState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, resolveAndReactivateSupabaseRedRisk } from "@/lib/supabase-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    reactivationReason?: string;
    aiMode?: "copilot" | "autopilot";
  };

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "handoff_update");
      return NextResponse.json(await resolveAndReactivateSupabaseRedRisk(id, body, tenantContext));
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
    return NextResponse.json(saveFallbackState(resolveAndReactivateRedRiskInState(state, id, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
