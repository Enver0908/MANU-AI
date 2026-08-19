import {
  activateClientAiInState,
  assertClientExistsInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  activateSupabaseClientAi,
  isSupabaseStoreConfigured,
  runSupabaseStage6IdempotentMutation,
} from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseAiActivateEnvelope,
  Stage6ContractError,
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
      if (!envelope.requestId) {
        throw new Stage6ContractError(400, "request_id_required");
      }
      return stage6JsonResponse(
        await runSupabaseStage6IdempotentMutation(tenantContext, envelope.requestId, "client_ai_activate", () =>
          activateSupabaseClientAi(
            id,
            {
              requestedAiMode: envelope.requestedAiMode,
              expectedConversationRevision: envelope.expectedConversationRevision,
              expectedClientContextRevision: envelope.expectedClientContextRevision,
            },
            tenantContext,
            envelope.requestId,
          ),
        ),
      );
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
