import { NextResponse } from "next/server";
import {
  activateClientAiInState,
  assertClientExistsInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { activateSupabaseClientAi, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    requestedAiMode?: "copilot" | "autopilot";
    expectedConversationRevision?: number;
    expectedClientContextRevision?: number;
  };

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await activateSupabaseClientAi(id, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    const state = getFallbackState();
    assertClientExistsInState(state, id);
    return NextResponse.json(
      saveFallbackState(
        activateClientAiInState(state, id, {
          requestedAiMode: body.requestedAiMode,
          expectedConversationRevision: body.expectedConversationRevision,
          expectedClientContextRevision: body.expectedClientContextRevision,
          activationSource: "activate_ai_api",
        }),
      ),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
