import { NextResponse } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { listFallbackNotifications } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  parseNotificationCategoryFilter,
  parseNotificationPriorityFilter,
  parseNotificationStatusFilter,
  parseStage4BLimit,
  parseStage4BQuery,
} from "@/lib/phase-85-stage-4b-api";
import { isSupabaseStoreConfigured, listSupabaseNotifications } from "@/lib/supabase-store";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";

export async function GET(request: Request) {
  try {
    const routeStartedAt = performance.now();
    const url = new URL(request.url);
    const status = parseNotificationStatusFilter(url.searchParams.get("status"));
    const priority = parseNotificationPriorityFilter(url.searchParams.get("priority"));
    const category = parseNotificationCategoryFilter(url.searchParams.get("category"));
    const query = parseStage4BQuery(url.searchParams.get("query"));
    const cursor = url.searchParams.get("cursor");
    const limit = parseStage4BLimit(url.searchParams.get("limit"));

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      const authCompletedAt = performance.now();
      requireCapability(tenantContext, "read_app_state");
      const storeStartedAt = performance.now();
      const payload = await listSupabaseNotifications(tenantContext, {
        status,
        priority,
        category,
        query,
        cursor,
        limit,
      });
      const storeCompletedAt = performance.now();
      const response = NextResponse.json(payload);
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

    return NextResponse.json(
      listFallbackNotifications({ status, priority, category, query, cursor, limit }),
    );
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
