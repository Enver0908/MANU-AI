import { type NextRequest } from "next/server";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { parseFormSaveEnvelope } from "@/lib/phase-85-stage-6-dashboard-contracts";
import { saveStage6FormResponse } from "@/lib/phase-85-stage-6-mutations";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; schemaId: string }> }) {
  try {
    const { id, schemaId } = await context.params;
    const envelope = parseFormSaveEnvelope({ ...(await request.json()), schemaId, clientId: id });
    const tenantContext = isSupabaseStoreConfigured()
      ? await (async () => {
          const ctx = await resolveAppTenantContext();
          requireCapability(ctx, "update_client");
          return ctx;
        })()
      : undefined;
    return stage6JsonResponse(await saveStage6FormResponse(id, envelope, tenantContext));
  } catch (error) {
    return stage6ErrorResponse(error, "form_schema");
  }
}
