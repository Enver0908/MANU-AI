import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, patchClientInState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, patchSupabaseClientRecord } from "@/lib/supabase-store";
import type { ClientRecord } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<ClientRecord>;

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await patchSupabaseClientRecord(id, patch, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  const state = getFallbackState();

  if (!state.clients.some((client) => client.id === id)) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  try {
    return NextResponse.json(saveFallbackState(patchClientInState(state, id, patch)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
