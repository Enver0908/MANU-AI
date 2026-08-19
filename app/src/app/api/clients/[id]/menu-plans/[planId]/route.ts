import { type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, saveMenuPlanInState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { type SaveClientMenuPlanV1Input } from "@/lib/phase-77f-client-menu-plan";
import { isSupabaseStoreConfigured, saveSupabaseClientMenuPlan } from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseMenuSaveEnvelope,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectMenuMutation } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    const { id, planId } = await context.params;
    const envelope = parseMenuSaveEnvelope(await request.json());
    const input = { revision: envelope.revision, plan: envelope.plan } as SaveClientMenuPlanV1Input;

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
      if (cached) return stage6JsonResponse(cached);
      const result = await saveSupabaseClientMenuPlan(id, planId, input, tenantContext, envelope.requestId);
      idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
      return stage6JsonResponse(result);
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const next = saveFallbackState(saveMenuPlanInState(getFallbackState(), id, planId, input));
    const result = projectMenuMutation(next, id, "client_menu_save", envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error, "menu_plan");
  }
}
