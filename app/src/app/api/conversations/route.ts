import { domainErrorResponse } from "@/lib/app-errors";
import { listFallbackConversations } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { parseConversationListQuery } from "@/lib/phase-85-stage-4b2-api";
import {
  conversationApiJsonResponse,
  requireConversationApiActor,
} from "@/lib/phase-85-stage-4b2-read-api";
import { isSupabaseStoreConfigured, listSupabaseConversations } from "@/lib/supabase-store";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";

export async function GET(request: Request) {
  try {
    const routeStartedAt = performance.now();
    const url = new URL(request.url);
    const query = parseConversationListQuery({
      status: url.searchParams.get("status"),
      query: url.searchParams.get("query"),
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
    });

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      const authCompletedAt = performance.now();
      requireCapability(tenantContext, "read_app_state");
      requireConversationApiActor(tenantContext);
      const storeStartedAt = performance.now();
      const payload = await listSupabaseConversations(tenantContext, {
        status: query.status,
        query: query.query,
        cursor: query.cursor,
        limit: query.limit,
      });
      const storeCompletedAt = performance.now();
      const response = conversationApiJsonResponse(payload);
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

    return conversationApiJsonResponse(
      listFallbackConversations({
        status: query.status,
        query: query.query,
        cursor: query.cursor,
        limit: query.limit,
      }),
    );
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
