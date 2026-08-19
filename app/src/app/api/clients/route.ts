import { type NextRequest } from "next/server";
import {
  buildClientCreateValidationState,
  mergeScopedClientCreateIntoAppState,
} from "@/lib/phase-79c-scoped-client-mutation";
import { createClientInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { createSupabaseClientRecord, isSupabaseStoreConfigured, listSupabaseStage6Roster } from "@/lib/supabase-store";
import {
  idempotencyLookup,
  idempotencyRemember,
  parseClientCreateEnvelope,
  parseRosterQuery,
  scopedMutation,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectStage6Roster } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";

export async function GET(request: NextRequest) {
  try {
    const query = parseRosterQuery({
      query: request.nextUrl.searchParams.get("query"),
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      return stage6JsonResponse(await listSupabaseStage6Roster(tenantContext, query));
    }
    return stage6JsonResponse(projectStage6Roster(getFallbackState(), query));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = parseClientCreateEnvelope(body);

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "create_client");
      const cached = idempotencyLookup(tenantContext.tenantId, input.requestId);
      if (cached) return stage6JsonResponse(cached);
      const created = await createSupabaseClientRecord(
        {
          fullName: input.fullName,
          channel: input.channel,
          channelUserId: input.channelUserId,
          primaryPhoneE164: input.primaryPhoneE164,
          communicationLanguage: input.communicationLanguage,
        },
        tenantContext,
      );
      const response = scopedMutation(
        "client_create",
        created.client.id,
        { client: created.client, conversation: created.conversation ?? null },
        { clientContextRevision: created.client.contextRevision },
        input.requestId,
      );
      idempotencyRemember(tenantContext.tenantId, input.requestId, response);
      return stage6JsonResponse(response);
    }

    const cached = idempotencyLookup("fallback", input.requestId);
    if (cached) return stage6JsonResponse(cached);
    const base = getFallbackState();
    const validationState = buildClientCreateValidationState(base);
    const next = createClientInState(validationState, {
      fullName: input.fullName,
      channel: input.channel,
      channelUserId: input.channelUserId,
      primaryPhoneE164: input.primaryPhoneE164,
      communicationLanguage: input.communicationLanguage,
    });
    const newClient = next.clients[next.clients.length - 1];
    const newConversation = next.conversations.find((item) => item.clientId === newClient.id) ?? null;
    saveFallbackState(mergeScopedClientCreateIntoAppState(base, newClient, newConversation ?? undefined));
    const response = scopedMutation(
      "client_create",
      newClient.id,
      { client: newClient, conversation: newConversation },
      { clientContextRevision: newClient.contextRevision },
      input.requestId,
    );
    idempotencyRemember("fallback", input.requestId, response);
    return stage6JsonResponse(response);
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}
