import { NextResponse, type NextRequest } from "next/server";
import { API_NO_STORE_HEADERS } from "@/lib/app-errors";
import { getFallbackState, resetFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { buildPhase79WindowedDashboardPayload } from "@/lib/phase-79b-windowed-read-contracts";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";
import {
  isSupabaseStoreConfigured,
  loadSupabaseState,
  loadSupabaseWindowedDashboardPayload,
  resetSupabaseState,
} from "@/lib/supabase-store";

function numberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function windowedOptions(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    clientCursor: params.get("clientCursor"),
    clientLimit: numberParam(params.get("clientLimit")),
    handoffCursor: params.get("handoffCursor"),
    handoffLimit: numberParam(params.get("handoffLimit")),
    notificationCursor: params.get("notificationCursor"),
    notificationLimit: numberParam(params.get("notificationLimit")),
    detailClientId: params.get("detailClientId"),
    timelineClientId: params.get("timelineClientId"),
    timelineCursor: params.get("timelineCursor"),
    timelineLimit: numberParam(params.get("timelineLimit")),
  };
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view");
  if (isSupabaseStoreConfigured()) {
    try {
      const routeStartedAt = performance.now();
      const tenantContext = await resolveAppTenantContext();
      const authCompletedAt = performance.now();
      requireCapability(tenantContext, "read_app_state");
      const storeStartedAt = performance.now();
      let payload;
      if (view === "windowed") {
        payload = await loadSupabaseWindowedDashboardPayload(tenantContext, windowedOptions(request));
      } else {
        payload = await loadSupabaseState(tenantContext);
      }
      const storeCompletedAt = performance.now();
      const response = NextResponse.json(payload, {
        headers: API_NO_STORE_HEADERS,
      });
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
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  if (view === "windowed") {
    return NextResponse.json(buildPhase79WindowedDashboardPayload(getFallbackState(), windowedOptions(request)));
  }

  return NextResponse.json(getFallbackState());
}

export async function POST() {
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "reset_app_state");
      return NextResponse.json(await resetSupabaseState(tenantContext), {
        headers: API_NO_STORE_HEADERS,
      });
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(resetFallbackState());
}
