import { type NextRequest } from "next/server";
import { addClientContextUpdateInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  addSupabaseClientContextUpdate,
  isSupabaseStoreConfigured,
  loadSupabaseStage6ContextUpdates,
} from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseContextCreateEnvelope,
  parseContextUpdateQuery,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { latestContextUpdate, projectContextCreate, projectStage6ContextUpdates } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const query = parseContextUpdateQuery({
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return stage6JsonResponse(await loadSupabaseStage6ContextUpdates(id, tenantContext, query));
    }
    return stage6JsonResponse(projectStage6ContextUpdates(getFallbackState(), id, query));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseContextCreateEnvelope(await request.json());

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
      if (cached) return stage6JsonResponse(cached);
      const result = await addSupabaseClientContextUpdate(
        id,
        {
          source: envelope.source,
          occurredAt: envelope.occurredAt,
          title: envelope.title,
          summary: envelope.summary,
          details: envelope.details,
          importance: envelope.importance,
        },
        tenantContext,
        envelope.requestId,
      );
      idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
      return stage6JsonResponse(result);
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const next = saveFallbackState(
      addClientContextUpdateInState(getFallbackState(), id, {
        source: envelope.source,
        occurredAt: envelope.occurredAt,
        title: envelope.title,
        summary: envelope.summary,
        details: envelope.details,
        importance: envelope.importance,
      }),
    );
    const created = latestContextUpdate(next, id);
    if (!created) throw new Error("client_context_update_not_found");
    const result = projectContextCreate(next, id, created, envelope.requestId);
    idempotencyRemember("fallback", envelope.requestId, result);
    return stage6JsonResponse(result);
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
