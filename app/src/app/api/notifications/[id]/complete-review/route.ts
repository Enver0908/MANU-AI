import { NextResponse } from "next/server";
import { completeFallbackUnsupportedMediaReview } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { completeSupabaseUnsupportedMediaReview, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "notification_update");
      return NextResponse.json(await completeSupabaseUnsupportedMediaReview(id, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(completeFallbackUnsupportedMediaReview(id));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
