import { NextResponse, type NextRequest } from "next/server";
import { approveDraftInState, dismissDraftInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { approveSupabaseDraftMessage, dismissSupabaseDraftMessage, isSupabaseStoreConfigured } from "@/lib/supabase-store";

type DraftActionRequest = {
  action?: "approve" | "edit_send" | "dismiss";
  body?: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as DraftActionRequest;

  if (!body.action) {
    return NextResponse.json({ error: "action_required" }, { status: 400 });
  }

  if (body.action === "edit_send" && !body.body?.trim()) {
    return NextResponse.json({ error: "body_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      if (body.action === "dismiss") {
        return NextResponse.json(await dismissSupabaseDraftMessage(id, tenantContext));
      }

      return NextResponse.json(
        await approveSupabaseDraftMessage(id, body.action === "edit_send" ? body.body : undefined, tenantContext),
      );
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
    const nextState =
      body.action === "dismiss"
        ? dismissDraftInState(state, id)
        : approveDraftInState(state, id, body.action === "edit_send" ? body.body : undefined);

    return NextResponse.json(saveFallbackState(nextState));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
