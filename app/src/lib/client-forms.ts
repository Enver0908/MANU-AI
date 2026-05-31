import { AppDomainError } from "./app-errors";
import type {
  ClientFormFieldDefinition,
  ClientFormResponseRecord,
  ClientFormSchemaRecord,
  ManuAppState,
} from "./types";
import { normalizeE164Phone, normalizeLanguageCode } from "./languages";

export function createClientFormSchemaInState(
  state: ManuAppState,
  input: { title: string; fields: ClientFormFieldDefinition[]; languageCode?: unknown },
  createdAt = new Date().toISOString(),
) {
  const title = input.title.trim();
  if (!title) throw new AppDomainError(400, "form_schema_title_required");

  const schema: ClientFormSchemaRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    title,
    languageCode: normalizeLanguageCode(input.languageCode),
    version: nextSchemaVersion(state),
    status: "draft",
    fields: input.fields.map(normalizeField),
    createdAt,
    publishedAt: null,
  };

  return {
    ...state,
    clientFormSchemas: [...state.clientFormSchemas, schema],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "client_form_schema_created", "client_form_schema", schema.id, createdAt),
    ],
  };
}

export function publishClientFormSchemaInState(
  state: ManuAppState,
  schemaId: string,
  createdAt = new Date().toISOString(),
) {
  const schema = state.clientFormSchemas.find((item) => item.id === schemaId);
  if (!schema) throw new AppDomainError(404, "form_schema_not_found");
  if (schema.fields.length === 0) throw new AppDomainError(400, "form_schema_fields_required");

  return {
    ...state,
    clientFormSchemas: state.clientFormSchemas.map((item) =>
      item.id === schemaId ? { ...item, status: "published" as const, publishedAt: createdAt } : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "client_form_schema_published", "client_form_schema", schemaId, createdAt),
    ],
  };
}

export function saveClientFormResponseInState(
  state: ManuAppState,
  clientId: string,
  schemaId: string,
  answers: Record<string, unknown>,
  createdAt = new Date().toISOString(),
  options: { submittedPhoneE164?: unknown } = {},
) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");

  const schema = state.clientFormSchemas.find((item) => item.id === schemaId && item.status === "published");
  if (!schema) throw new AppDomainError(404, "published_form_schema_not_found");

  const submittedPhoneE164 = normalizeE164Phone(options.submittedPhoneE164);
  if (options.submittedPhoneE164 && !submittedPhoneE164) {
    throw new AppDomainError(400, "submitted_phone_e164_invalid");
  }
  if (submittedPhoneE164 && client.primaryPhoneE164 && submittedPhoneE164 !== client.primaryPhoneE164) {
    throw new AppDomainError(409, "form_phone_client_mismatch");
  }

  validateAnswers(schema, answers);

  const existing = state.clientFormResponses.find(
    (response) => response.clientId === clientId && response.schemaId === schemaId,
  );
  const response: ClientFormResponseRecord = {
    id: existing?.id || crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId,
    schemaId,
    schemaVersion: schema.version,
    schemaSnapshot: schema,
    languageCode: schema.languageCode,
    submittedPhoneE164: submittedPhoneE164 || client.primaryPhoneE164,
    answers,
    createdAt: existing?.createdAt || createdAt,
    updatedAt: createdAt,
  };

  const nextState = {
    ...state,
    clients: state.clients.map((item) =>
      item.id === clientId
        ? {
            ...item,
            communicationLanguage: schema.languageCode,
            healthProfile: { ...item.healthProfile, preferredLanguage: schema.languageCode },
            contextRevision: item.contextRevision + 1,
          }
        : item,
    ),
    clientFormResponses: [
      ...state.clientFormResponses.filter((item) => item.id !== response.id),
      response,
    ],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "client_form_response_saved", "client_form_response", response.id, createdAt),
    ],
  };

  return invalidatePendingDraftsForFormChange(nextState, clientId, createdAt);
}

export function buildClientFormSummary(state: ManuAppState, clientId: string) {
  const responses = state.clientFormResponses.filter((response) => response.clientId === clientId);
  const parts: string[] = [];

  for (const response of responses) {
    const fields = response.schemaSnapshot.fields.filter((field) => field.llmVisibility === "prompt_allowed");
    for (const field of fields) {
      const value = response.answers[field.id];
      if (value === undefined || value === null || value === "") continue;
      parts.push(`${field.label}: ${formatAnswer(value)}`);
    }
  }

  return parts.join("\n");
}

export function getActiveFormSchema(state: ManuAppState) {
  return [...state.clientFormSchemas]
    .filter((schema) => schema.status === "published")
    .sort((a, b) => b.version - a.version)[0] || null;
}

function validateAnswers(schema: ClientFormSchemaRecord, answers: Record<string, unknown>) {
  for (const field of schema.fields) {
    const value = answers[field.id];
    if (field.required && (value === undefined || value === null || value === "")) {
      throw new AppDomainError(400, `form_field_required_${field.id}`);
    }

    if (value === undefined || value === null || value === "") continue;
    if ((field.type === "select" || field.type === "multiselect") && field.options?.length) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((item) => !field.options?.includes(String(item)))) {
        throw new AppDomainError(400, `form_field_invalid_option_${field.id}`);
      }
    }
  }
}

function normalizeField(field: ClientFormFieldDefinition): ClientFormFieldDefinition {
  return {
    id: field.id.trim(),
    label: field.label.trim(),
    type: field.type,
    required: Boolean(field.required),
    options: field.options?.map((option) => option.trim()).filter(Boolean),
    llmVisibility: field.llmVisibility === "prompt_allowed" ? "prompt_allowed" : "never",
  };
}

function nextSchemaVersion(state: ManuAppState) {
  return Math.max(0, ...state.clientFormSchemas.map((schema) => schema.version)) + 1;
}

function formatAnswer(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function buildAudit(
  state: ManuAppState,
  eventType: string,
  entityType: string,
  entityId: string,
  createdAt: string,
) {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType,
    entityId,
    metadata: { source: "local_app" },
    createdAt,
  };
}

function invalidatePendingDraftsForFormChange(state: ManuAppState, clientId: string, createdAt: string): ManuAppState {
  const clientConversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );
  const draftMessages = state.messages.filter(
    (message) =>
      message.origin === "ai_generated" &&
      message.status === "draft" &&
      clientConversationIds.has(message.conversationId),
  );
  if (draftMessages.length === 0) return state;

  const decisionIds = new Set(draftMessages.map((message) => message.generatedByAiDecisionId).filter(Boolean));
  return {
    ...state,
    messages: state.messages.map((message) =>
      draftMessages.some((draft) => draft.id === message.id) ? { ...message, status: "blocked" as const } : message,
    ),
    aiDecisions: state.aiDecisions.map((decision) =>
      decisionIds.has(decision.id)
        ? { ...decision, sendStatus: "draft_invalidated" as const, blockedReason: "client_form_response_changed" }
        : decision,
    ),
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "draft_context_invalidated", "client", clientId, createdAt),
    ],
  };
}
