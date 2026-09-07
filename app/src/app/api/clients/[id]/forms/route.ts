import { type NextRequest } from "next/server";
import { getFallbackState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, loadSupabaseStage6Forms } from "@/lib/supabase-store";
import { projectStage6Forms } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return stage6JsonResponse(await loadSupabaseStage6Forms(id, tenantContext));
    }
    return stage6JsonResponse(projectStage6Forms(getFallbackState(), id));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
