import { AppDomainError } from "./app-errors";
import type {
  ClientFormFieldDefinition,
  DietitianFormResponseRecord,
  DietitianFormSchemaRecord,
  ManuAppState,
} from "./types";

export function saveDietitianFormResponseInState(
  state: ManuAppState,
  dietitianId: string,
  schemaId: string,
  answers: Record<string, unknown>,
  createdAt = new Date().toISOString(),
) {
  if (state.dietitian.id !== dietitianId) {
    throw new AppDomainError(404, "dietitian_not_found");
  }

  const schema = state.dietitianFormSchemas.find((item) => item.id === schemaId && item.status === "published");
  if (!schema) throw new AppDomainError(404, "published_dietitian_form_schema_not_found");

  validateAnswers(schema, answers);

  const existing = state.dietitianFormResponses.find(
    (response) => response.dietitianId === dietitianId && response.schemaId === schemaId,
  );
  const response: DietitianFormResponseRecord = {
    id: existing?.id || crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId,
    schemaId,
    schemaVersion: schema.version,
    schemaSnapshot: schema,
    languageCode: schema.languageCode,
    answers,
    createdAt: existing?.createdAt || createdAt,
    updatedAt: createdAt,
  };

  return {
    ...state,
    dietitianFormResponses: [
      ...state.dietitianFormResponses.filter((item) => item.id !== response.id),
      response,
    ],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "dietitian_form_response_saved",
        entityType: "dietitian_form_response",
        entityId: response.id,
        metadata: { source: "local_app", schemaVersion: schema.version },
        createdAt,
      },
    ],
  };
}

export function getActiveDietitianFormSchema(state: ManuAppState) {
  return (
    [...state.dietitianFormSchemas]
      .filter((schema) => schema.status === "published")
      .sort((a, b) => b.version - a.version)[0] || null
  );
}

function validateAnswers(schema: DietitianFormSchemaRecord, answers: Record<string, unknown>) {
  for (const field of schema.fields) {
    const value = answers[field.id];
    if (field.required && !hasValue(value)) {
      throw new AppDomainError(400, `dietitian_form_field_required_${field.id}`);
    }
    if (!hasValue(value)) continue;
    if ((field.type === "select" || field.type === "multiselect") && field.options?.length) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((item) => !field.options?.includes(String(item)))) {
        throw new AppDomainError(400, `dietitian_form_field_invalid_option_${field.id}`);
      }
    }
  }
}

function hasValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function normalizeDietitianFormField(field: ClientFormFieldDefinition): ClientFormFieldDefinition {
  return {
    ...field,
    id: field.id.trim(),
    label: field.label.trim(),
    required: Boolean(field.required),
    options: field.options?.map((option) => option.trim()).filter(Boolean),
    llmVisibility: field.llmVisibility === "prompt_allowed" ? "prompt_allowed" : "never",
  };
}
