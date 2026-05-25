import { NextResponse } from "next/server";
import { getFallbackState, resetFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, loadSupabaseState, resetSupabaseState } from "@/lib/supabase-store";

export async function GET() {
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return NextResponse.json(await loadSupabaseState(tenantContext));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(getFallbackState());
}

export async function POST() {
  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "reset_app_state");
      return NextResponse.json(await resetSupabaseState(tenantContext));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(resetFallbackState());
}
