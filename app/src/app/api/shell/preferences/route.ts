import { type NextRequest } from "next/server";
import { shellErrorResponse, shellJsonResponse } from "@/lib/phase-85-stage-5-shell-api";
import { parseShellPreferencesPatchBody } from "@/lib/phase-85-stage-5-shell-contracts";
import { rejectClientSuppliedSessionIdentity } from "@/lib/phase-85-stage-5-shell-session";
import {
  enforceShellPreferencesRateLimit,
  resolveShellReadAccountContext,
} from "@/lib/phase-85-stage-5-shell-route";
import { updateShellPreferences } from "@/lib/phase-85-stage-5-shell-store";
import { addPerformanceServerTiming } from "@/lib/performance-diagnostic";

export async function PATCH(request: NextRequest) {
  const routeStartedAt = performance.now();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return shellJsonResponse({ error: "invalid_json" }, 400);
  }

  try {
    rejectClientSuppliedSessionIdentity(body);
    const patch = parseShellPreferencesPatchBody(body);
    const context = await resolveShellReadAccountContext();
    const authCompletedAt = performance.now();
    const rateLimitStartedAt = performance.now();
    await enforceShellPreferencesRateLimit(context);
    const rateLimitCompletedAt = performance.now();
    const storeStartedAt = performance.now();
    const payload = await updateShellPreferences(context, patch);
    const storeCompletedAt = performance.now();
    const response = shellJsonResponse(payload);
    const jsonCompletedAt = performance.now();
    return addPerformanceServerTiming(response, {
      auth: authCompletedAt - routeStartedAt,
      auth_get_user: context.authTiming?.getUserMs,
      auth_membership: context.authTiming?.membershipMs,
      auth_dietitian: context.authTiming?.dietitianMs,
      auth_get_session: context.authTiming?.getSessionMs,
      auth_session_activity: context.authTiming?.sessionActivityMs,
      auth_total: context.authTiming?.totalMs,
      entitlement: context.authTiming?.entitlementMs,
      rate_limit: rateLimitCompletedAt - rateLimitStartedAt,
      store: storeCompletedAt - storeStartedAt,
      json: jsonCompletedAt - storeCompletedAt,
      route: jsonCompletedAt - routeStartedAt,
    });
  } catch (error) {
    return shellErrorResponse(error);
  }
}
