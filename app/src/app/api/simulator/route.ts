import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, simulateInState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isSupabaseStoreConfigured, runSupabaseSimulation } from "@/lib/supabase-store";
import type { SimulationRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SimulationRequest;

  if (!body.body?.trim() || (body.sourceConversationType !== "group" && !body.clientId)) {
    return NextResponse.json({ error: "clientId_and_body_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "simulate_inbound");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:simulator:${body.sourceConversationType === "group" ? "group" : body.clientId}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.simulator,
      });
      return NextResponse.json(
        await runSupabaseSimulation(
          {
            ...body,
            idempotencyKey: body.idempotencyKey || `sim-${Date.now()}`,
          },
          tenantContext,
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
    await assertRateLimit({
      key: `fallback:simulator:${body.sourceConversationType === "group" ? "group" : body.clientId}`,
      ...RATE_LIMITS.simulator,
    });
    const nextState = await simulateInState(getFallbackState(), {
      ...body,
      idempotencyKey: body.idempotencyKey || `sim-${Date.now()}`,
    });

    return NextResponse.json(saveFallbackState(nextState));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
