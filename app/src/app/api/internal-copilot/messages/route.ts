import { NextResponse, type NextRequest } from "next/server";
import {
  assembleBoundedInternalCopilotToolState,
  mergeInternalCopilotMutationIntoAppState,
} from "@/lib/phase-79d-bounded-internal-copilot-loaders";
import {
  getFallbackState,
  runInternalCopilotMessageInState,
  saveFallbackState,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isSupabaseStoreConfigured, runSupabaseInternalCopilotMessage } from "@/lib/supabase-store";

type InternalCopilotRequest = {
  body?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as InternalCopilotRequest;

  if (!payload.body?.trim()) {
    return NextResponse.json({ error: "internal_copilot_body_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "internal_copilot_chat");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:internal-copilot:${tenantContext.dietitianId}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.internalCopilot,
      });
      return NextResponse.json(await runSupabaseInternalCopilotMessage(payload.body, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    await assertRateLimit({ key: "fallback:internal-copilot", ...RATE_LIMITS.internalCopilot });
    const base = getFallbackState();
    const toolState = assembleBoundedInternalCopilotToolState(base, payload.body);
    const mutationResult = runInternalCopilotMessageInState(toolState, payload.body);
    return NextResponse.json(saveFallbackState(mergeInternalCopilotMutationIntoAppState(base, mutationResult)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
