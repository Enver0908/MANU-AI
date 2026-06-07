import { isSafetyChecklistComplete } from "./safety-checklist";
import {
  PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS,
  getPhase70RegistryField,
} from "./phase-70-form-registry";
import type {
  AutopilotQualificationStatus,
  ClientFormFieldDefinition,
  ManuAppState,
} from "./types";

const PROMPT_SUMMARY_MAX_CHARS = 240;

export type AutopilotQualificationResult = {
  status: AutopilotQualificationStatus;
  missing: string[];
  answerabilityFieldIds: string[];
};

export function isPromptVisibleField(field: ClientFormFieldDefinition) {
  const promptAccess = field.promptAccess || (field.llmVisibility === "prompt_allowed" ? "prompt_allowed" : "dietitian_only");
  return promptAccess === "prompt_allowed";
}

export function sanitizePromptSummaryValue(value: unknown, _field: ClientFormFieldDefinition) {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "").trim();
  if (!text) return "";
  const sanitized = text.replace(/\s+/g, " ");
  if (sanitized.length <= PROMPT_SUMMARY_MAX_CHARS) return sanitized;
  return `${sanitized.slice(0, PROMPT_SUMMARY_MAX_CHARS - 3)}...`;
}

export function buildAnswerabilityFieldManifest(state: ManuAppState, clientId: string) {
  const response = getLatestClientFormResponse(state, clientId);
  if (!response) return [];

  return response.schemaSnapshot.fields
    .filter((field) => field.answerabilityRole === "answerability_source")
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      hasValue: hasAnswerValue(response.answers[field.id]),
      answerabilityRole: field.answerabilityRole || "none",
      registryVersion: response.schemaSnapshot.registryVersion || null,
    }))
    .filter((entry) => entry.hasValue);
}

export function evaluateClientAutopilotQualification(
  state: ManuAppState,
  clientId: string,
): AutopilotQualificationResult {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client || client.lifecycleStatus === "removed_anonymized") {
    return { status: "not_qualified", missing: ["client_not_found_or_removed"], answerabilityFieldIds: [] };
  }

  const missing: string[] = [];

  if (client.healthProfile.adultStatus !== "adult") {
    missing.push("adult_status_not_adult");
  }
  if (!client.communicationLanguage) {
    missing.push("communication_language_missing");
  }
  if (client.channelPermission !== "ready") {
    missing.push("channel_permission_not_ready");
  }
  if (client.aiStatus !== "active") {
    missing.push("ai_status_not_active");
  }
  if (client.aiMode !== "autopilot") {
    missing.push("ai_mode_not_autopilot");
  }
  if (!client.mandatorySafetyComplete || !isSafetyChecklistComplete(client)) {
    missing.push("safety_checklist_incomplete");
  }

  const response = getLatestClientFormResponse(state, clientId);
  if (!response) {
    missing.push("published_client_form_response_missing");
    return {
      status: missing.some((item) => item.startsWith("adult_status") || item.includes("channel_permission"))
        ? "not_qualified"
        : "incomplete",
      missing,
      answerabilityFieldIds: [],
    };
  }

  for (const fieldId of PHASE_70_MINIMUM_AUTOPILOT_CLIENT_FIELD_IDS) {
    const field = response.schemaSnapshot.fields.find((item) => item.id === fieldId);
    if (!field) {
      missing.push(`registry_field_missing_${fieldId}`);
      continue;
    }
    if (!hasAnswerValue(response.answers[fieldId])) {
      missing.push(`form_field_missing_${fieldId}`);
    }
  }

  const consent = String(response.answers.sensitive_data_consent_status || "");
  if (consent !== "approved") {
    missing.push("sensitive_data_consent_not_approved");
  }

  const promptAck = String(response.answers.form_prompt_visibility_ack || "");
  if (promptAck !== "Evet") {
    missing.push("form_prompt_visibility_not_acknowledged");
  }

  const channelState = String(response.answers.channel_permission_state || "");
  if (channelState !== "ready") {
    missing.push("form_channel_permission_not_ready");
  }

  const adultForm = String(response.answers.adult_status || "");
  if (adultForm !== "Adult") {
    missing.push("form_adult_status_not_adult");
  }

  const answerabilityFieldIds = buildAnswerabilityFieldManifest(state, clientId).map((entry) => entry.fieldId);

  if (
    missing.includes("adult_status_not_adult") ||
    missing.includes("channel_permission_not_ready") ||
    missing.includes("sensitive_data_consent_not_approved") ||
    missing.includes("form_adult_status_not_adult") ||
    missing.includes("form_channel_permission_not_ready")
  ) {
    return { status: "not_qualified", missing, answerabilityFieldIds };
  }

  if (missing.length > 0) {
    return { status: "incomplete", missing, answerabilityFieldIds };
  }

  return { status: "qualified", missing: [], answerabilityFieldIds };
}

export function isPromptAffectingFormField(field: ClientFormFieldDefinition) {
  const registry = getPhase70RegistryField(field.id);
  const promptAccess =
    field.promptAccess || registry?.promptAccess || (field.llmVisibility === "prompt_allowed" ? "prompt_allowed" : "dietitian_only");
  return (
    promptAccess === "prompt_allowed" ||
    field.answerabilityRole === "answerability_source" ||
    field.answerabilityRole === "logistics_only"
  );
}

function getLatestClientFormResponse(state: ManuAppState, clientId: string) {
  return (
    [...state.clientFormResponses]
      .filter((response) => response.clientId === clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
  );
}

function hasAnswerValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
