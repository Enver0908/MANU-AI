import { NextResponse } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { listFallbackClinicalAlerts } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  parseAlertSeverityFilter,
  parseStage4BLimit,
  parseStage4BQuery,
} from "@/lib/phase-85-stage-4b-api";
import { isSupabaseStoreConfigured, listSupabaseClinicalAlerts } from "@/lib/supabase-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const severity = parseAlertSeverityFilter(url.searchParams.get("severity"));
  const query = parseStage4BQuery(url.searchParams.get("query"));
  const cursor = url.searchParams.get("cursor");
  const limit = parseStage4BLimit(url.searchParams.get("limit"));

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return NextResponse.json(
        await listSupabaseClinicalAlerts(tenantContext, { severity, query, cursor, limit }),
      );
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(listFallbackClinicalAlerts({ severity, query, cursor, limit }));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
