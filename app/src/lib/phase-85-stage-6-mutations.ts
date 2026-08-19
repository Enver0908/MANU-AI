import { getActiveFormSchema } from "./client-forms";
import { getFallbackState, saveFallbackState, saveFormResponseInState } from "./app-state-store";
import { requireCapability, type AppTenantContext } from "./auth-context";
import { isSupabaseStoreConfigured, saveSupabaseFormResponse } from "./supabase-store";
import {
  assertExpectedRevision,
  idempotencyLookup,
  idempotencyRemember,
  type Stage6FormSaveEnvelope,
} from "./phase-85-stage-6-dashboard-contracts";
import { projectFormSave } from "./phase-85-stage-6-client-workspace";

export async function saveStage6FormResponse(
  clientId: string,
  envelope: Stage6FormSaveEnvelope,
  tenantContext?: AppTenantContext,
) {
  if (isSupabaseStoreConfigured()) {
    if (!tenantContext) throw new Error("tenant_context_required");
    requireCapability(tenantContext, "update_client");
    const cached = idempotencyLookup(tenantContext.tenantId, envelope.requestId);
    if (cached) return cached;
    const result = await saveSupabaseFormResponse(
      {
        clientId,
        schemaId: envelope.schemaId,
        answers: envelope.answers,
        submittedPhoneE164: envelope.submittedPhoneE164,
      },
      tenantContext,
      envelope.requestId,
    );
    idempotencyRemember(tenantContext.tenantId, envelope.requestId, result);
    return result;
  }

  const cached = idempotencyLookup("fallback", envelope.requestId);
  if (cached) return cached;
  const base = getFallbackState();
  const client = base.clients.find((item) => item.id === clientId);
  const schema = getActiveFormSchema(base);
  if (client) assertExpectedRevision(client.contextRevision, envelope.expectedClientContextRevision, "client_context");
  if (schema) assertExpectedRevision(schema.version, envelope.expectedSchemaRevision, "form_schema");
  const next = saveFallbackState(
    saveFormResponseInState(base, {
      clientId,
      schemaId: envelope.schemaId,
      answers: envelope.answers,
      submittedPhoneE164: envelope.submittedPhoneE164,
    }),
  );
  const result = projectFormSave(next, clientId, envelope.schemaId, envelope.requestId);
  idempotencyRemember("fallback", envelope.requestId, result);
  return result;
}
