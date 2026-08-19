import { type NextRequest } from "next/server";
import { createMenuPlanInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { type CreateClientMenuPlanV1Input } from "@/lib/phase-77f-client-menu-plan";
import {
  createSupabaseClientMenuPlan,
  isSupabaseStoreConfigured,
  loadSupabaseStage6ClientState,
} from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseMenuCreateEnvelope,
  parseMenuPlanQuery,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectMenuMutation, projectStage6MenuPlans } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const query = parseMenuPlanQuery({
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      const state = await loadSupabaseStage6ClientState(id, tenantContext);
      return stage6JsonResponse(projectStage6MenuPlans(state, id, query));
    }
    return stage6JsonResponse(projectStage6MenuPlans(getFallbackState(), id, query));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseMenuCreateEnvelope(await request.json());
    const input = { templateType: envelope.templateType, title: envelope.title } as CreateClientMenuPlanV1Input;

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
      if (cached) return stage6JsonResponse(cached);
      const result = await createSupabaseClientMenuPlan(id, input, tenantContext, envelope.requestId);
      idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
      return stage6JsonResponse(result);
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const next = saveFallbackState(createMenuPlanInState(getFallbackState(), id, input));
    const result = projectMenuMutation(next, id, "client_menu_create", envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
