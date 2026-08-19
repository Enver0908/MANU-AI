import {
  assertClientExistsInState,
  getFallbackState,
  releaseHumanTakeoverInState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, releaseSupabaseHumanTakeover } from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseReleaseTakeoverEnvelope,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectAiControl } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseReleaseTakeoverEnvelope(await request.json().catch(() => ({})));

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "release_takeover");
      const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
      if (cached) return stage6JsonResponse(cached);
      const result = await releaseSupabaseHumanTakeover(id, tenantContext, envelope.requestId);
      idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
      return stage6JsonResponse(result);
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const state = getFallbackState();
    assertClientExistsInState(state, id);
    const next = saveFallbackState(releaseHumanTakeoverInState(state, id));
    const result = projectAiControl(next, id, "client_release_takeover", envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
