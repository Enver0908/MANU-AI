import { NextResponse, type NextRequest } from "next/server";
import {
  applyUpdateProposalInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  applySupabaseClientUpdateProposal,
  isSupabaseStoreConfigured,
} from "@/lib/supabase-store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; proposalId: string }> }) {
  const { id, proposalId } = await context.params;
  const body = await request.json().catch(() => ({}));

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await applySupabaseClientUpdateProposal(id, proposalId, body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(applyUpdateProposalInState(getFallbackState(), id, proposalId, body)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
