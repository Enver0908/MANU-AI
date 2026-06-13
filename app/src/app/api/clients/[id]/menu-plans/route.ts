import { NextResponse, type NextRequest } from "next/server";
import {
  createMenuPlanInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  getActiveClientMenuPlanV1Record,
  listClientMenuPlanV1Records,
  menuPlanV1RecordToState,
  type CreateClientMenuPlanV1Input,
} from "@/lib/phase-77f-client-menu-plan";
import { getClientFoodRuleProfileV2Record } from "@/lib/phase-77e-client-food-rule-profile";
import {
  createSupabaseClientMenuPlan,
  isSupabaseStoreConfigured,
  listSupabaseClientMenuPlans,
} from "@/lib/supabase-store";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      const state = await listSupabaseClientMenuPlans(id, tenantContext);
      const profile = getClientFoodRuleProfileV2Record(state, id);
      const plans = listClientMenuPlanV1Records(state, id).map((plan) => menuPlanV1RecordToState(plan, profile));
      const active = getActiveClientMenuPlanV1Record(state, id);
      return NextResponse.json({ plans, activePlanId: active?.id || null });
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  const state = getFallbackState();
  const profile = getClientFoodRuleProfileV2Record(state, id);
  const plans = listClientMenuPlanV1Records(state, id).map((plan) => menuPlanV1RecordToState(plan, profile));
  const active = getActiveClientMenuPlanV1Record(state, id);
  return NextResponse.json({ plans, activePlanId: active?.id || null });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as CreateClientMenuPlanV1Input;

  if (!body.templateType) {
    return NextResponse.json({ error: "client_menu_plan_invalid" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await createSupabaseClientMenuPlan(id, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(createMenuPlanInState(getFallbackState(), id, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
