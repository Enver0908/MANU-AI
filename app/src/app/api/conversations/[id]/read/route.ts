import { domainErrorResponse } from "@/lib/app-errors";
import { markFallbackConversationRead } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertConversationId } from "@/lib/phase-85-stage-4b2-api";
import {
  conversationApiJsonResponse,
  parseConversationMarkReadBody,
  requireConversationApiActor,
} from "@/lib/phase-85-stage-4b2-read-api";
import { isSupabaseStoreConfigured, markSupabaseConversationReadWithResponse } from "@/lib/supabase-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let throughSequence: number;
  try {
    throughSequence = parseConversationMarkReadBody(await request.json()).throughSequence;
  } catch (error) {
    return domainErrorResponse(error);
  }

  const conversationId = assertConversationId(id);

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      requireConversationApiActor(tenantContext);
      return conversationApiJsonResponse(
        await markSupabaseConversationReadWithResponse(conversationId, throughSequence, tenantContext),
      );
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return conversationApiJsonResponse(markFallbackConversationRead(conversationId, throughSequence));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
