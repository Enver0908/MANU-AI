import { type NextRequest } from "next/server";
import { shellBoundedJsonResponse, shellErrorResponse } from "@/lib/phase-85-stage-5-shell-api";
import { parseShellActiveClientIdParam } from "@/lib/phase-85-stage-5-shell-contracts";
import {
  enforceShellBootstrapRateLimit,
  resolveShellReadAccountContext,
} from "@/lib/phase-85-stage-5-shell-route";
import { loadShellBootstrap } from "@/lib/phase-85-stage-5-shell-store";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";

export async function GET(request: NextRequest) {
  try {
    const routeStartedAt = performance.now();
    const context = await resolveShellReadAccountContext();
    const contextCompletedAt = performance.now();
    const rateLimitStartedAt = performance.now();
    await enforceShellBootstrapRateLimit(context);
    const rateLimitCompletedAt = performance.now();
    const activeClientId = parseShellActiveClientIdParam(
      request.nextUrl.searchParams.get("activeClientId"),
    );
    const payload = await loadShellBootstrap(context, activeClientId);
    const storeCompletedAt = performance.now();
    const response = shellBoundedJsonResponse(payload);
    const jsonCompletedAt = performance.now();
    return addPerformanceServerTiming(response, {
      auth: contextCompletedAt - routeStartedAt,
      auth_get_user: context.authTiming?.getUserMs,
      auth_membership: context.authTiming?.membershipMs,
      auth_dietitian: context.authTiming?.dietitianMs,
      auth_get_session: context.authTiming?.getSessionMs,
      auth_session_activity: context.authTiming?.sessionActivityMs,
      auth_total: context.authTiming?.totalMs,
      entitlement: context.authTiming?.entitlementMs,
      rate_limit: rateLimitCompletedAt - rateLimitStartedAt,
      store: storeCompletedAt - rateLimitCompletedAt,
      json: jsonCompletedAt - storeCompletedAt,
      route: jsonCompletedAt - routeStartedAt,
    });
  } catch (error) {
    return shellErrorResponse(error);
  }
}
