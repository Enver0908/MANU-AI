import { NextResponse, type NextRequest } from "next/server";
import {
  addVoiceSamplesInState,
  getFallbackState,
  saveFallbackState,
  updateVoiceSampleStatus,
} from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, updateSupabaseVoiceSamples } from "@/lib/supabase-store";
import type { VoiceSampleStatus } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { rawInput?: string };
  if (!body.rawInput?.trim()) {
    return NextResponse.json({ error: "voice_samples_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await updateSupabaseVoiceSamples({ rawInput: body.rawInput }, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  return NextResponse.json(saveFallbackState(addVoiceSamplesInState(getFallbackState(), body.rawInput)));
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { sampleId?: string; status?: VoiceSampleStatus };
  if (!body.sampleId || !body.status) {
    return NextResponse.json({ error: "sampleId_and_status_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(
        await updateSupabaseVoiceSamples({ sampleId: body.sampleId, status: body.status }, tenantContext),
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
    return NextResponse.json(
      saveFallbackState(updateVoiceSampleStatus(getFallbackState(), body.sampleId, body.status)),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
