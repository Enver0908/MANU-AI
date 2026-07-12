import { domainErrorResponse } from "@/lib/app-errors";
import { listFallbackConversations } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { parseConversationListQuery } from "@/lib/phase-85-stage-4b2-api";
import {
  conversationApiJsonResponse,
  requireConversationApiActor,
} from "@/lib/phase-85-stage-4b2-read-api";
import { isSupabaseStoreConfigured, listSupabaseConversations } from "@/lib/supabase-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = parseConversationListQuery({
      status: url.searchParams.get("status"),
      query: url.searchParams.get("query"),
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
    });

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      requireConversationApiActor(tenantContext);
      return conversationApiJsonResponse(
        await listSupabaseConversations(tenantContext, {
          status: query.status,
          query: query.query,
          cursor: query.cursor,
          limit: query.limit,
        }),
      );
    }

    return conversationApiJsonResponse(
      listFallbackConversations({
        status: query.status,
        query: query.query,
        cursor: query.cursor,
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
