import { domainErrorResponse } from "@/lib/app-errors";
import { submitFallbackTranscriptCorrection } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertConversationId } from "@/lib/phase-85-stage-4b2-api";
import { conversationApiJsonResponse, requireConversationApiActor } from "@/lib/phase-85-stage-4b2-read-api";
import { parseTranscriptCorrectionMutationBody } from "@/lib/phase-85-stage-4b4-transcript-correction-bounded";
import { isSupabaseStoreConfigured, submitSupabaseTranscriptCorrection } from "@/lib/supabase-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const conversationId = assertConversationId(id);
    const body = await request.json();
    const parsed = parseTranscriptCorrectionMutationBody(body);

    const tenantContext = await resolveAppTenantContext();
    requireCapability(tenantContext, "read_app_state");
    requireConversationApiActor(tenantContext);

    if (isSupabaseStoreConfigured()) {
      return conversationApiJsonResponse(
        await submitSupabaseTranscriptCorrection(conversationId, parsed, tenantContext),
      );
    }

    return conversationApiJsonResponse(submitFallbackTranscriptCorrection(conversationId, parsed, tenantContext));
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
