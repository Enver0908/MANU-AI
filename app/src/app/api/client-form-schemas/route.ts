import { NextResponse, type NextRequest } from "next/server";
import { createFormSchemaInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { createSupabaseFormSchema, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { ClientFormFieldDefinition } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { title?: string; fields?: ClientFormFieldDefinition[]; languageCode?: unknown };

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(
        await createSupabaseFormSchema(
          { title: body.title || "", fields: body.fields || [], languageCode: body.languageCode },
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
    return NextResponse.json(
      saveFallbackState(
        createFormSchemaInState(getFallbackState(), {
          title: body.title || "",
          fields: body.fields || [],
          languageCode: body.languageCode,
        }),
      ),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
