import { type NextRequest } from "next/server";
import { applyFallbackDraftMutationWithResponse } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { conversationApiJsonResponse } from "@/lib/phase-85-stage-4b2-read-api";
import { parseConversationDraftMutationRequest } from "@/lib/phase-85-stage-4b2-mutations";
import { applySupabaseDraftMutation, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let parsed;
  try {
    parsed = parseConversationDraftMutationRequest(await request.json());
  } catch (error) {
    return domainErrorResponse(error);
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "draft_review");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:draft:${id}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.draftReview,
      });
      return conversationApiJsonResponse(await applySupabaseDraftMutation(id, parsed, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    await assertRateLimit({ key: `fallback:draft:${id}`, ...RATE_LIMITS.draftReview });
    return conversationApiJsonResponse(applyFallbackDraftMutationWithResponse(id, parsed));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
