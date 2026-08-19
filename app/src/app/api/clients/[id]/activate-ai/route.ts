import {
  activateClientAiInState,
  assertClientExistsInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { activateSupabaseClientAi, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseAiActivateEnvelope,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectAiControl } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseAiActivateEnvelope(await request.json());

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
      if (cached) return stage6JsonResponse(cached);
      const result = await activateSupabaseClientAi(
        id,
        {
          requestedAiMode: envelope.requestedAiMode,
          expectedConversationRevision: envelope.expectedConversationRevision,
          expectedClientContextRevision: envelope.expectedClientContextRevision,
        },
        tenantContext,
        envelope.requestId,
      );
      idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
      return stage6JsonResponse(result);
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const state = getFallbackState();
    assertClientExistsInState(state, id);
    const next = saveFallbackState(
      activateClientAiInState(state, id, {
        requestedAiMode: envelope.requestedAiMode,
        expectedConversationRevision: envelope.expectedConversationRevision,
        expectedClientContextRevision: envelope.expectedClientContextRevision,
        activationSource: "activate_ai_api",
      }),
    );
    const result = projectAiControl(next, id, "client_ai_activate", envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error, "conversation");
  }
}
