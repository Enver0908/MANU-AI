import { NextResponse } from "next/server";
import {
  exportClientInState,
  getFallbackState,
  recordClientExportRequestInState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { exportSupabaseClientData, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "export_client");
      return NextResponse.json(await exportSupabaseClientData(id, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    const nextState = saveFallbackState(recordClientExportRequestInState(getFallbackState(), id));
    return NextResponse.json(exportClientInState(nextState, id));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
