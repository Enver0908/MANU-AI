import { type NextRequest } from "next/server";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { parseFormSaveEnvelope } from "@/lib/phase-85-stage-6-dashboard-contracts";
import { saveStage6FormResponse } from "@/lib/phase-85-stage-6-mutations";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function POST(request: NextRequest) {
  try {
    const envelope = parseFormSaveEnvelope(await request.json());
    if (!envelope.clientId) {
      return stage6JsonResponse({ error: "clientId_schemaId_answers_required" }, 400);
    }
    const tenantContext = isSupabaseStoreConfigured()
      ? await (async () => {
          const context = await resolveAppTenantContext();
          requireCapability(context, "update_client");
          return context;
        })()
      : undefined;
    return stage6JsonResponse(await saveStage6FormResponse(envelope.clientId, envelope, tenantContext));
  } catch (error) {
    return stage6ErrorResponse(error, "form_schema");
  }
}
