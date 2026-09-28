import { type NextRequest } from "next/server";
import {
  getFallbackState,
  saveClientFoodRuleProfileV2InState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  getClientFoodRuleProfileV2State,
  type SaveClientFoodRuleProfileV2Input,
} from "@/lib/phase-77e-client-food-rule-profile";
import {
  isSupabaseStoreConfigured,
  loadSupabaseClientFoodRuleProfile,
  runSupabaseStage6IdempotentMutation,
  saveSupabaseClientFoodRuleProfile,
} from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseFoodRuleSaveEnvelope,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectFoodRuleSave } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const routeStartedAt = performance.now();
    const { id } = await context.params;
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      const authCompletedAt = performance.now();
      requireCapability(tenantContext, "read_app_state");
      const storeStartedAt = performance.now();
      const state = await loadSupabaseClientFoodRuleProfile(id, tenantContext);
      const storeCompletedAt = performance.now();
      const profile = getClientFoodRuleProfileV2State(state, id);
      const response = profile
        ? stage6JsonResponse({ clientId: id, profile, revision: profile.revision })
        : stage6JsonResponse({ error: "client_food_rule_profile_not_found" }, 404);
      const jsonCompletedAt = performance.now();
      return addPerformanceServerTiming(response, {
        auth: authCompletedAt - routeStartedAt,
        auth_get_user: tenantContext.authTiming?.getUserMs,
        auth_membership: tenantContext.authTiming?.membershipMs,
        auth_dietitian: tenantContext.authTiming?.dietitianMs,
        auth_get_session: tenantContext.authTiming?.getSessionMs,
        auth_session_activity: tenantContext.authTiming?.sessionActivityMs,
        auth_total: tenantContext.authTiming?.totalMs,
        entitlement: tenantContext.authTiming?.entitlementMs,
        store: storeCompletedAt - storeStartedAt,
        json: jsonCompletedAt - storeCompletedAt,
        route: jsonCompletedAt - routeStartedAt,
      });
    }
    const profile = getClientFoodRuleProfileV2State(getFallbackState(), id);
    if (!profile) return stage6JsonResponse({ error: "client_food_rule_profile_not_found" }, 404);
    return stage6JsonResponse({ clientId: id, profile, revision: profile.revision });
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseFoodRuleSaveEnvelope(await request.json());
    const input = { revision: envelope.revision, profile: envelope.profile } as SaveClientFoodRuleProfileV2Input;

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return stage6JsonResponse(
        await runSupabaseStage6IdempotentMutation(tenantContext, envelope.requestId, "client_food_rule_save", () =>
          saveSupabaseClientFoodRuleProfile(id, input, tenantContext, envelope.requestId),
        ),
      );
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const next = saveFallbackState(saveClientFoodRuleProfileV2InState(getFallbackState(), id, input));
    const result = projectFoodRuleSave(next, id, envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error, "food_rule_profile");
  }
}
