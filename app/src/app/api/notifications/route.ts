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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = parseNotificationStatusFilter(url.searchParams.get("status"));
  const priority = parseNotificationPriorityFilter(url.searchParams.get("priority"));
  const category = parseNotificationCategoryFilter(url.searchParams.get("category"));
  const query = parseStage4BQuery(url.searchParams.get("query"));
  const cursor = url.searchParams.get("cursor");
  const limit = parseStage4BLimit(url.searchParams.get("limit"));

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return NextResponse.json(
        await listSupabaseNotifications(tenantContext, {
          status,
          priority,
          category,
          query,
          cursor,
          limit,
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

  try {
    return NextResponse.json(
      listFallbackNotifications({ status, priority, category, query, cursor, limit }),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
