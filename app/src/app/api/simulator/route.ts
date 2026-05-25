import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, simulateInState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, runSupabaseSimulation } from "@/lib/supabase-store";
import type { SimulationRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SimulationRequest;

  if (!body.clientId || !body.body?.trim()) {
    return NextResponse.json({ error: "clientId_and_body_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(
        await runSupabaseSimulation(
          {
            ...body,
            idempotencyKey: body.idempotencyKey || `sim-${Date.now()}`,
          },
          await resolveAppTenantContext(),
        ),
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
    const nextState = await simulateInState(getFallbackState(), {
      ...body,
      idempotencyKey: body.idempotencyKey || `sim-${Date.now()}`,
    });

    return NextResponse.json(saveFallbackState(nextState));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
