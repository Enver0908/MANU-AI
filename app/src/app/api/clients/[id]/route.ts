import { type NextRequest } from "next/server";
import {
  buildClientPatchValidationState,
  mergeScopedClientPatchIntoAppState,
} from "@/lib/phase-79c-scoped-client-mutation";
import { getFallbackState, patchClientInState, saveFallbackState } from "@/lib/app-state-store";
import { AppDomainError } from "@/lib/app-errors";
import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  isSupabaseStoreConfigured,
  loadSupabaseStage6Workspace,
  patchSupabaseClientRecord,
  runSupabaseStage6IdempotentMutation,
} from "@/lib/supabase-store";
import {
  assertExpectedRevision,
  idempotencyLookup,
  idempotencyRemember,
  parseClientPatchEnvelope,
  scopedMutation,
} from "@/lib/phase-85-stage-6-dashboard-contracts";
import { projectStage6Workspace } from "@/lib/phase-85-stage-6-client-workspace";
import { stage6ErrorResponse, stage6JsonResponse } from "@/lib/phase-85-stage-6-api";
import type { ClientRecord } from "@/lib/types";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "read_app_state");
      const loaded = await loadSupabaseStage6Workspace(id, tenantContext);
      return stage6JsonResponse(loaded.summary);
    }
    return stage6JsonResponse(projectStage6Workspace(getFallbackState(), id, { role: "dietitian" }));
  } catch (error) {
    return stage6ErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const envelope = parseClientPatchEnvelope(await request.json());
    rejectDirectAiActivationPatch(envelope.patch);

    if (isSupabaseStoreConfigured()) {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "update_client");
      return stage6JsonResponse(
        await runSupabaseStage6IdempotentMutation(tenantContext, envelope.requestId, "client_patch", async () => {
          const loaded = await loadSupabaseStage6Workspace(id, tenantContext);
          assertExpectedRevision(loaded.summary.contextRevision, envelope.expectedRevision, "client");
          const patched = await patchSupabaseClientRecord(id, envelope.patch, tenantContext);
          return scopedMutation(
            "client_patch",
            patched.client.id,
            { client: patched.client },
            { clientContextRevision: patched.client.contextRevision },
            envelope.requestId,
          );
        }),
      );
    }

    const cached = idempotencyLookup("fallback", envelope.requestId);
    if (cached) return stage6JsonResponse(cached);
    const base = getFallbackState();
    const current = base.clients.find((item) => item.id === id);
    if (!current || current.lifecycleStatus === "removed_anonymized") {
      throw new AppDomainError(404, "client_not_found");
    }
    assertExpectedRevision(current.contextRevision, envelope.expectedRevision, "client");
    const validationState = buildClientPatchValidationState(base, id);
    const patched = patchClientInState(validationState, id, envelope.patch);
    const updatedClient = patched.clients.find((client) => client.id === id);
    if (!updatedClient) throw new AppDomainError(404, "client_not_found");
    saveFallbackState(mergeScopedClientPatchIntoAppState(base, updatedClient));
    const response = scopedMutation(
      "client_patch",
      updatedClient.id,
      { client: updatedClient },
      { clientContextRevision: updatedClient.contextRevision },
      envelope.requestId,
    );
    idempotencyRemember("fallback", envelope.requestId, response);
    return stage6JsonResponse(response);
  } catch (error) {
    return stage6ErrorResponse(error, "client");
  }
}

function rejectDirectAiActivationPatch(patch: Partial<ClientRecord>) {
  if (patch.aiStatus === "active") {
    throw new AppDomainError(409, "direct_ai_activation_requires_activate_ai_endpoint");
  }
}
