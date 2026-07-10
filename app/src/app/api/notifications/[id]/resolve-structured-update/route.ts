import { NextResponse } from "next/server";
import {
  getFallbackState,
  resolveStructuredRecordUpdateNotification,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  isSupabaseStoreConfigured,
  resolveSupabaseStructuredRecordUpdateNotification,
} from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await resolveSupabaseStructuredRecordUpdateNotification(id, tenantContext));
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
      saveFallbackState(resolveStructuredRecordUpdateNotification(getFallbackState(), id)),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
