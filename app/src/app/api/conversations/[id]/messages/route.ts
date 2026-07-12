import { domainErrorResponse } from "@/lib/app-errors";
import { getFallbackConversationDetail } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertConversationId, parseConversationDetailQuery } from "@/lib/phase-85-stage-4b2-api";
import {
  conversationApiJsonResponse,
  requireConversationApiActor,
} from "@/lib/phase-85-stage-4b2-read-api";
import { getSupabaseConversationMessages, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const conversationId = assertConversationId(id);
    const url = new URL(request.url);
    const query = parseConversationDetailQuery({
      direction: url.searchParams.get("direction"),
      cursor: url.searchParams.get("cursor"),
      anchorMessageId: url.searchParams.get("anchorMessageId"),
      limit: url.searchParams.get("limit"),
    });

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      requireConversationApiActor(tenantContext);
      return conversationApiJsonResponse(
        await getSupabaseConversationMessages(tenantContext, conversationId, {
          direction: query.direction,
          cursor: query.cursor,
          anchorMessageId: query.anchorMessageId,
          limit: query.limit,
        }),
      );
    }

    return conversationApiJsonResponse(
      getFallbackConversationDetail(conversationId, {
        direction: query.direction,
        cursor: query.cursor,
        anchorMessageId: query.anchorMessageId,
        limit: query.limit,
      }),
    );
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
