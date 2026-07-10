import { NextResponse } from "next/server";
import {
  activateClientAiInState,
  assertClientExistsInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { AppDomainError, domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { activateSupabaseClientAi, isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const body = (await request.json()) as {
        requestedAiMode?: "copilot" | "autopilot";
        expectedConversationRevision: number;
        expectedClientContextRevision: number;
      };
      assertExpectedRevisions(body);
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
    const body = (await request.json()) as {
      requestedAiMode?: "copilot" | "autopilot";
      expectedConversationRevision: number;
      expectedClientContextRevision: number;
    };
    assertExpectedRevisions(body);
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

function assertExpectedRevisions(input: {
  expectedConversationRevision?: unknown;
  expectedClientContextRevision?: unknown;
}) {
  if (!Number.isInteger(input.expectedConversationRevision)) {
    throw new AppDomainError(400, "expected_conversation_revision_required");
  }
  if (!Number.isInteger(input.expectedClientContextRevision)) {
    throw new AppDomainError(400, "expected_client_context_revision_required");
  }
}
