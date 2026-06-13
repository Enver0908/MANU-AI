import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, saveMenuPlanInState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { type SaveClientMenuPlanV1Input } from "@/lib/phase-77f-client-menu-plan";
import { isSupabaseStoreConfigured, saveSupabaseClientMenuPlan } from "@/lib/supabase-store";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await context.params;
  const body = (await request.json()) as SaveClientMenuPlanV1Input;

  if (!body.plan || typeof body.revision !== "number") {
    return NextResponse.json({ error: "client_menu_plan_invalid" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await saveSupabaseClientMenuPlan(id, planId, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(saveMenuPlanInState(getFallbackState(), id, planId, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
