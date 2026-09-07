import { PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS } from "./phase-70-form-registry";
import type { ClientFormFieldDefinition, ClientFormResponseRecord, ClientRecord } from "./types";

export const CLIENT_FORM_SECTION_LABELS: Record<string, string> = {
  "2.1": "Kimlik ve iletişim",
  "2.2": "Antropometri",
  "2.3": "Hedefler",
  "2.4": "Yaşam tarzı",
  "2.5": "Klinik geçmiş",
  "2.6": "Üreme ve risk",
  "2.7": "Beslenme alışkanlıkları",
  "2.8": "Alerji ve intolerans",
  "2.9": "Sindirim",
  "2.10": "Notlar",
};

const autopilotFieldIdSet = new Set<string>(PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS);

export function isAutopilotRequiredField(fieldId: string) {
  return autopilotFieldIdSet.has(fieldId);
}

export function hasFormFieldValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function groupFormFieldsBySection(fields: ClientFormFieldDefinition[]) {
  const sections = new Map<string, ClientFormFieldDefinition[]>();
  for (const field of fields) {
    const sectionKey = field.section?.trim() || "other";
    sections.set(sectionKey, [...(sections.get(sectionKey) || []), field]);
  }
  return [...sections.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
}

export function getPromptAccessLabel(promptAccess: ClientFormFieldDefinition["promptAccess"]) {
  switch (promptAccess) {
    case "prompt_allowed":
      return "AI prompt";
    case "dietitian_only":
      return "Diyetisyen";
    case "sensitive_never_prompt":
      return "Hassas";
    case "system_rule":
      return "Sistem kuralı";
    default:
      return "Diyetisyen";
  }
}

export function getPromptAccessTone(promptAccess: ClientFormFieldDefinition["promptAccess"]) {
  switch (promptAccess) {
    case "prompt_allowed":
      return "emerald" as const;
    case "system_rule":
      return "amber" as const;
    case "sensitive_never_prompt":
      return "red" as const;
    default:
      return "stone" as const;
  }
}

export function formatSectionLabel(sectionKey: string) {
  return CLIENT_FORM_SECTION_LABELS[sectionKey] || `Bölüm ${sectionKey}`;
}

export function serializeFieldValueForInput(field: ClientFormFieldDefinition, value: unknown) {
  if (value === undefined || value === null) return "";
  if (field.type === "multiselect" && Array.isArray(value)) return value.map(String);
  if (field.type === "boolean") return value === true || value === "true";
  return String(value);
}

export function normalizeFieldValueForSave(field: ClientFormFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (field.type === "multiselect") {
    const values = Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value)].filter(Boolean);
    return values.length > 0 ? values : undefined;
  }
  if (field.type === "boolean") return Boolean(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}

export function buildInitialClientFormAnswers(
  client: ClientRecord,
  response: Pick<ClientFormResponseRecord, "answers"> | null,
): Record<string, unknown> {
  const answers: Record<string, unknown> = { ...(response?.answers || {}) };
  const [firstName = "", ...rest] = client.fullName.trim().split(/\s+/);
  const lastName = rest.join(" ");

  if (!hasFormFieldValue(answers.first_name) && firstName) answers.first_name = firstName;
  if (!hasFormFieldValue(answers.last_name) && lastName) answers.last_name = lastName;
  if (!hasFormFieldValue(answers.mobile_phone_e164) && client.primaryPhoneE164) {
    answers.mobile_phone_e164 = client.primaryPhoneE164;
  }
  if (!hasFormFieldValue(answers.whatsapp_phone_e164) && client.primaryPhoneE164) {
    answers.whatsapp_phone_e164 = client.primaryPhoneE164;
  }
  if (!hasFormFieldValue(answers.communication_language) && client.communicationLanguage) {
    answers.communication_language = client.communicationLanguage.toUpperCase();
  }
  if (!hasFormFieldValue(answers.channel_permission_state) && client.channelPermission) {
    answers.channel_permission_state = client.channelPermission;
  }
  if (!hasFormFieldValue(answers.primary_goal) && client.healthProfile.goal) {
    answers.primary_goal = client.healthProfile.goal;
  }
  if (!hasFormFieldValue(answers.allergies) && client.allergies.length > 0) {
    answers.allergies = client.allergies.join(", ");
  }

  return answers;
}

export function summarizeAutopilotFieldStatus(
  fields: ClientFormFieldDefinition[],
  answers: Record<string, unknown>,
) {
  const tracked = fields.filter((field) => isAutopilotRequiredField(field.id));
  const missing = tracked.filter((field) => !hasFormFieldValue(answers[field.id])).map((field) => field.id);
  return {
    total: tracked.length,
    complete: tracked.length - missing.length,
    missing,
  };
}

export function buildClientFormAnswersPayload(
  fields: ClientFormFieldDefinition[],
  draftAnswers: Record<string, unknown>,
) {
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    const normalized = normalizeFieldValueForSave(field, draftAnswers[field.id]);
    if (normalized !== undefined) answers[field.id] = normalized;
  }
  return answers;
}
