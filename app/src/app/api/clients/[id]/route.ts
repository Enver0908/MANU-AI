import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, patchClientInState, saveFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
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
      return NextResponse.json(await patchSupabaseClientRecord(id, patch, await resolveAppTenantContext()));
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  const state = getFallbackState();

  if (!state.clients.some((client) => client.id === id)) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  return NextResponse.json(saveFallbackState(patchClientInState(state, id, patch)));
}
