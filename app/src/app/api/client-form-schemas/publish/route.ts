import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, publishFormSchemaInState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, publishSupabaseFormSchema } from "@/lib/supabase-store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { schemaId?: string };
  if (!body.schemaId) {
    return NextResponse.json({ error: "schemaId_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(await publishSupabaseFormSchema(body.schemaId, tenantContext));
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    return NextResponse.json(saveFallbackState(publishFormSchemaInState(getFallbackState(), body.schemaId)));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
