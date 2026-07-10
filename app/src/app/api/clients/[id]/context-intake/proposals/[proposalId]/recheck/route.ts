import { NextResponse, type NextRequest } from "next/server";
import {
  getFallbackState,
  recheckContextIntakeProposal,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, recheckSupabaseContextIntakeProposal } from "@/lib/supabase-store";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; proposalId: string }> },
) {
  const { id, proposalId } = await context.params;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await recheckSupabaseContextIntakeProposal(id, proposalId, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(
      saveFallbackState(recheckContextIntakeProposal(getFallbackState(), id, proposalId)),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
