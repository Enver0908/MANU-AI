import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState, saveFormResponseInState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, saveSupabaseFormResponse } from "@/lib/supabase-store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId?: string;
    schemaId?: string;
    answers?: Record<string, unknown>;
    submittedPhoneE164?: unknown;
  };

  if (!body.clientId || !body.schemaId || !body.answers) {
    return NextResponse.json({ error: "clientId_schemaId_answers_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return NextResponse.json(
        await saveSupabaseFormResponse(
          { clientId: body.clientId, schemaId: body.schemaId, answers: body.answers, submittedPhoneE164: body.submittedPhoneE164 },
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
        saveFormResponseInState(getFallbackState(), {
          clientId: body.clientId,
          schemaId: body.schemaId,
          answers: body.answers,
          submittedPhoneE164: body.submittedPhoneE164,
        }),
      ),
    );
  } catch (error) {
    return domainErrorResponse(error);
  }
}
