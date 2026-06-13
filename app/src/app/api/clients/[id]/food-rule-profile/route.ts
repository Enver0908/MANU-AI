import { NextResponse, type NextRequest } from "next/server";
import {
  getFallbackState,
  saveClientFoodRuleProfileV2InState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  getClientFoodRuleProfileV2State,
  type SaveClientFoodRuleProfileV2Input,
} from "@/lib/phase-77e-client-food-rule-profile";
import {
  isSupabaseStoreConfigured,
  loadSupabaseClientFoodRuleProfile,
  saveSupabaseClientFoodRuleProfile,
} from "@/lib/supabase-store";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      const state = await loadSupabaseClientFoodRuleProfile(id, tenantContext);
      const profile = getClientFoodRuleProfileV2State(state, id);
      if (!profile) return NextResponse.json({ error: "client_food_rule_profile_not_found" }, { status: 404 });
      return NextResponse.json(profile);
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  const profile = getClientFoodRuleProfileV2State(getFallbackState(), id);
  if (!profile) return NextResponse.json({ error: "client_food_rule_profile_not_found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as SaveClientFoodRuleProfileV2Input;

  if (!body.profile || typeof body.revision !== "number") {
    return NextResponse.json({ error: "client_food_rule_profile_invalid" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await saveSupabaseClientFoodRuleProfile(id, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(saveClientFoodRuleProfileV2InState(getFallbackState(), id, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
