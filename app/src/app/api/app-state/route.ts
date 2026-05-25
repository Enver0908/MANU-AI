import { NextResponse } from "next/server";
import { getFallbackState, resetFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, loadSupabaseState, resetSupabaseState } from "@/lib/supabase-store";

export async function GET() {
  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await loadSupabaseState(await resolveAppTenantContext()));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(getFallbackState());
}

export async function POST() {
  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await resetSupabaseState(await resolveAppTenantContext()));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  return NextResponse.json(resetFallbackState());
}
