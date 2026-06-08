import { createBlankClient, createInitialState } from "./seed-data";
import { AppDomainError } from "./app-errors";
import { normalizeE164Phone, normalizeLanguageCode } from "./languages";
import { buildClientScopedExport, recordClientExportInState } from "./data-governance";
import { applyPhase74TransactionalRedactionInState } from "./phase-74-data-lifecycle-policy";
import {
  createClientFormSchemaInState,
  publishClientFormSchemaInState,
  saveClientFormResponseInState,
} from "./client-forms";
import { createClientContextUpdateInState } from "./client-context-updates";
import {
  applyClientUpdateProposalInState,
  createClientUpdateProposalInState,
  rejectClientUpdateProposalInState,
} from "./client-update-proposals";
import { runInternalCopilotInState } from "./internal-copilot";
import {
  addVoiceSamplesToState,
  generateVoiceProfileInState,
  updateVoiceSampleStatusInState,
} from "./voice-profile-workflow";
import {
  approveDraftMessageInState,
  addClientToState,
  appendDietitianManualReply,
  dismissDraftMessageInState,
  releaseHumanTakeoverLockInState,
  resolveAndReactivateRedRiskInState as resolveAndReactivateRedRiskInStateImpl,
  runInboundSimulation,
  updateClientInState,
  markNotificationReadInState,
  acknowledgeNotificationInState,
} from "./simulator";
import type { ClientRecord, ManuAppState, SimulationRequest } from "./types";
import type { CreateClientContextUpdateInput } from "./client-context-updates";
import type { ApplyClientUpdateProposalInput, CreateClientUpdateProposalInput } from "./client-update-proposals";
import type { ClientFormFieldDefinition, VoiceSampleStatus } from "./types";

const globalStore = globalThis as typeof globalThis & {
  manuAiFallbackState?: ManuAppState;
};

export function getFallbackState() {
  globalStore.manuAiFallbackState ??= createInitialState();
  return globalStore.manuAiFallbackState;
}

export function resetFallbackState() {
  globalStore.manuAiFallbackState = createInitialState();
  return globalStore.manuAiFallbackState;
}

export function saveFallbackState(state: ManuAppState) {
  globalStore.manuAiFallbackState = state;
  return state;
}

export function createClientInState(
  state: ManuAppState,
  input: Pick<ClientRecord, "fullName" | "channel" | "channelUserId"> &
    Partial<Pick<ClientRecord, "primaryPhoneE164" | "communicationLanguage">>,
) {
  const primaryPhoneE164 = normalizeE164Phone(input.primaryPhoneE164);
  const communicationLanguage = normalizeLanguageCode(input.communicationLanguage);
  if (!primaryPhoneE164) throw new AppDomainError(400, "primary_phone_e164_required");
  if (state.clients.some((client) => client.primaryPhoneE164 === primaryPhoneE164)) {
    throw new AppDomainError(409, "primary_phone_e164_duplicate");
  }
  const client = createBlankClient({
    fullName: input.fullName.trim(),
    channel: input.channel,
    channelUserId: input.channelUserId.trim(),
    primaryPhoneE164,
    communicationLanguage,
    healthProfile: {
      goal: "",
      preferredLanguage: communicationLanguage,
      adultStatus: "unknown",
      diagnosedConditionFlag: false,
      medicationOrSupplementFlag: false,
      pregnancyOrBreastfeedingFlag: false,
      eatingDisorderRiskFlag: false,
    },
  });
  return addClientToState(state, client);
}

export function patchClientInState(state: ManuAppState, clientId: string, patch: Partial<ClientRecord>) {
  const existingClient = state.clients.find((client) => client.id === clientId);
  if (!existingClient) throw new AppDomainError(404, "client_not_found");
  const normalizedPatch: Partial<ClientRecord> = { ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, "communicationLanguage")) {
    normalizedPatch.communicationLanguage = normalizeLanguageCode(patch.communicationLanguage);
    normalizedPatch.healthProfile = {
      ...existingClient.healthProfile,
      ...(patch.healthProfile || {}),
      preferredLanguage: normalizedPatch.communicationLanguage,
    };
  }

  if (Object.prototype.hasOwnProperty.call(patch, "primaryPhoneE164")) {
    const normalizedPhone = normalizeE164Phone(patch.primaryPhoneE164);
    if (!normalizedPhone) throw new AppDomainError(400, "primary_phone_e164_invalid");
    if (state.clients.some((client) => client.id !== clientId && client.primaryPhoneE164 === normalizedPhone)) {
      throw new AppDomainError(409, "primary_phone_e164_duplicate");
    }
    normalizedPatch.primaryPhoneE164 = normalizedPhone;
  }

  return updateClientInState(state, clientId, normalizedPatch);
}

export function updateDietitianPreferencesInState(
  state: ManuAppState,
  input: { uiLanguage?: unknown },
): ManuAppState {
  return {
    ...state,
    dietitian: {
      ...state.dietitian,
      uiLanguage: normalizeLanguageCode(input.uiLanguage),
    },
  };
}

export function exportClientInState(state: ManuAppState, clientId: string) {
  return buildClientScopedExport(state, clientId);
}

export function recordClientExportRequestInState(state: ManuAppState, clientId: string) {
  return recordClientExportInState(state, clientId);
}

export function anonymizeClientDataInState(state: ManuAppState, clientId: string) {
  return applyPhase74TransactionalRedactionInState(state, clientId, "anonymization").state;
}

export function removeClientDataInState(state: ManuAppState, clientId: string) {
  return applyPhase74TransactionalRedactionInState(state, clientId, "deletion").state;
}

export async function simulateInState(state: ManuAppState, request: SimulationRequest) {
  return runInboundSimulation(state, request);
}

export function addManualReplyInState(state: ManuAppState, clientId: string, body: string) {
  return appendDietitianManualReply(state, clientId, body);
}

export function approveDraftInState(state: ManuAppState, messageId: string, body?: string) {
  return approveDraftMessageInState(state, messageId, body);
}

export function dismissDraftInState(state: ManuAppState, messageId: string) {
  return dismissDraftMessageInState(state, messageId);
}

export function releaseHumanTakeoverInState(state: ManuAppState, clientId: string) {
  return releaseHumanTakeoverLockInState(state, clientId);
}

export function updateHandoffStatusInState(
  state: ManuAppState,
  handoffId: string,
  status: "resolved" | "dismissed",
) {
  const handoff = state.handoffCases.find((item) => item.id === handoffId);
  if (!handoff) throw new AppDomainError(404, "handoff_not_found");
  const client = state.clients.find((item) => item.id === handoff.clientId);
  if (client?.redRiskLock.status === "locked" && client.redRiskLock.handoffId === handoffId) {
    if (status === "dismissed") {
      throw new AppDomainError(409, "red_risk_handoff_cannot_be_dismissed");
    }
    throw new AppDomainError(409, "red_risk_reactivation_required");
  }

  return {
    ...state,
    handoffCases: state.handoffCases.map((handoff) =>
      handoff.id === handoffId && handoff.status === "open" ? { ...handoff, status } : handoff,
    ),
  };
}

export function resolveAndReactivateRedRiskInState(
  state: ManuAppState,
  handoffId: string,
  input: { reactivationReason?: string; aiMode?: "copilot" | "autopilot" },
) {
  return resolveAndReactivateRedRiskInStateImpl(state, handoffId, input);
}

export function assertClientExistsInState(state: ManuAppState, clientId: string) {
  if (!state.clients.some((client) => client.id === clientId)) {
    throw new AppDomainError(404, "client_not_found");
  }
}

export function assertHandoffExistsInState(state: ManuAppState, handoffId: string) {
  if (!state.handoffCases.some((handoff) => handoff.id === handoffId)) {
    throw new AppDomainError(404, "handoff_not_found");
  }
}

export function markNotificationRead(state: ManuAppState, notificationId: string) {
  assertNotificationExistsInState(state, notificationId);
  return markNotificationReadInState(state, notificationId);
}

export function acknowledgeNotification(state: ManuAppState, notificationId: string) {
  assertNotificationExistsInState(state, notificationId);
  return acknowledgeNotificationInState(state, notificationId);
}

export function addVoiceSamplesInState(state: ManuAppState, rawInput: string) {
  return addVoiceSamplesToState(state, rawInput);
}

export function updateVoiceSampleStatus(state: ManuAppState, sampleId: string, status: VoiceSampleStatus) {
  return updateVoiceSampleStatusInState(state, sampleId, status);
}

export function generateVoiceProfile(state: ManuAppState) {
  return generateVoiceProfileInState(state);
}

export function createFormSchemaInState(
  state: ManuAppState,
  input: { title: string; fields: ClientFormFieldDefinition[]; languageCode?: unknown },
) {
  return createClientFormSchemaInState(state, input);
}

export function publishFormSchemaInState(state: ManuAppState, schemaId: string) {
  return publishClientFormSchemaInState(state, schemaId);
}

export function saveFormResponseInState(
  state: ManuAppState,
  input: { clientId: string; schemaId: string; answers: Record<string, unknown>; submittedPhoneE164?: unknown },
) {
  return saveClientFormResponseInState(state, input.clientId, input.schemaId, input.answers, undefined, {
    submittedPhoneE164: input.submittedPhoneE164,
  });
}

export function addClientContextUpdateInState(
  state: ManuAppState,
  clientId: string,
  input: CreateClientContextUpdateInput,
) {
  return createClientContextUpdateInState(state, clientId, input);
}

export function runInternalCopilotMessageInState(state: ManuAppState, body: string) {
  return runInternalCopilotInState(state, body);
}

export function createUpdateProposalInState(
  state: ManuAppState,
  clientId: string,
  input: CreateClientUpdateProposalInput,
) {
  return createClientUpdateProposalInState(state, clientId, input);
}

export function applyUpdateProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  input?: ApplyClientUpdateProposalInput,
) {
  return applyClientUpdateProposalInState(state, clientId, proposalId, new Date().toISOString(), input);
}

export function rejectUpdateProposalInState(state: ManuAppState, clientId: string, proposalId: string) {
  return rejectClientUpdateProposalInState(state, clientId, proposalId);
}

export function assertNotificationExistsInState(state: ManuAppState, notificationId: string) {
  if (!state.notifications.some((notification) => notification.id === notificationId)) {
    throw new AppDomainError(404, "notification_not_found");
  }
}
