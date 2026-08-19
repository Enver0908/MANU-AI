import { type NextRequest } from "next/server";
import { activateMenuPlanInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { AppDomainError } from "@/lib/app-errors";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  isSupabaseStoreConfigured,
  activateSupabaseClientMenuPlan,
  runSupabaseStage6IdempotentMutation,
} from "@/lib/supabase-store";
import {
  assertExpectedRevision,
  idempotencyLookup,
  idempotencyRemember,
  parseMenuActivateEnvelope,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectMenuMutation } from "@/lib/phase-85-stage-6-client-workspace";
import { listClientMenuPlanV1Records } from "@/lib/phase-77f-client-menu-plan";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    const { id, planId } = await context.params;
    const envelope = parseMenuActivateEnvelope(await request.json().catch(() => ({})));

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return stage6JsonResponse(
        await runSupabaseStage6IdempotentMutation(tenantContext, envelope.requestId, "client_menu_activate", () =>
          activateSupabaseClientMenuPlan(
            id,
            planId,
            tenantContext,
            envelope.requestId,
            envelope.expectedPlanRevision,
          ),
        ),
      );
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const base = getFallbackState();
    const existing = listClientMenuPlanV1Records(base, id).find((plan) => plan.id === planId);
    if (!existing) throw new AppDomainError(404, "client_menu_plan_not_found");
    assertExpectedRevision(existing.revision, envelope.expectedPlanRevision, "menu_plan");
    const next = saveFallbackState(activateMenuPlanInState(base, id, planId));
    const result = projectMenuMutation(next, id, "client_menu_activate", envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error, "menu_plan");
  }
}
