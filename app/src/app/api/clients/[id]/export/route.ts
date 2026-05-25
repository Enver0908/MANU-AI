import { NextResponse } from "next/server";
import { exportClientInState, getFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { exportSupabaseClientData, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(await exportSupabaseClientData(id, await resolveAppTenantContext()));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(exportClientInState(getFallbackState(), id));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
