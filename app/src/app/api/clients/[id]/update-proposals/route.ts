import { NextResponse, type NextRequest } from "next/server";
import {
  createUpdateProposalInState,
  getFallbackState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  createSupabaseClientUpdateProposal,
  isSupabaseStoreConfigured,
} from "@/lib/supabase-store";

type CreateProposalRequest = {
  sourceText?: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as CreateProposalRequest;

  if (!body.sourceText?.trim()) {
    return NextResponse.json({ error: "client_update_proposal_source_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await createSupabaseClientUpdateProposal(id, { sourceText: body.sourceText }, tenantContext));
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
      saveFallbackState(createUpdateProposalInState(getFallbackState(), id, { sourceText: body.sourceText })),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
