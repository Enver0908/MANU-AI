import { type NextRequest } from "next/server";
import {
  addFallbackManualReplyWithResponse,
  getFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { conversationApiJsonResponse } from "@/lib/phase-85-stage-4b2-read-api";
import { parseConversationManualReplyRequest, resolveConversationIdFromManualRequest } from "@/lib/phase-85-stage-4b2-mutations";
import { addSupabaseManualReply, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(request: NextRequest) {
  let parsed;
  try {
    const body = await request.json();
    parsed = parseConversationManualReplyRequest(body, (raw) =>
      resolveConversationIdFromManualRequest(getFallbackState(), raw),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "manual_reply");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:manual:${parsed.conversationId}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.manualReply,
      });
      return conversationApiJsonResponse(await addSupabaseManualReply(parsed, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    await assertRateLimit({
      key: `fallback:manual:${parsed.conversationId}`,
      ...RATE_LIMITS.manualReply,
    });
    return conversationApiJsonResponse(addFallbackManualReplyWithResponse(parsed));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
