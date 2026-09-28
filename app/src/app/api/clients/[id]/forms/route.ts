import { type NextRequest } from "next/server";
import { getFallbackState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, loadSupabaseStage6Forms } from "@/lib/supabase-store";
import { projectStage6Forms } from "@/lib/phase-85-stage-6-client-workspace";
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
      const payload = await loadSupabaseStage6Forms(id, tenantContext);
      const storeCompletedAt = performance.now();
      const response = stage6JsonResponse(payload);
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
    return stage6JsonResponse(projectStage6Forms(getFallbackState(), id));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
