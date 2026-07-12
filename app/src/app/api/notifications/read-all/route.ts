import { NextResponse } from "next/server";
import { markAllFallbackNotificationsRead } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, markAllSupabaseNotificationsRead } from "@/lib/supabase-store";

export async function POST() {
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "notification_update");
      return NextResponse.json(await markAllSupabaseNotificationsRead(tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(markAllFallbackNotificationsRead());
  } catch (error) {
    return domainErrorResponse(error);
  }
}
