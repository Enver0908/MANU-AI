import { createBlankClient, createInitialState } from "./seed-data";
import { AppDomainError } from "./app-errors";
import { anonymizeClientInState, buildClientScopedExport, recordClientExportInState } from "./data-governance";
import {
  createClientFormSchemaInState,
  publishClientFormSchemaInState,
  saveClientFormResponseInState,
} from "./client-forms";
import { createClientContextUpdateInState } from "./client-context-updates";
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
  runInboundSimulation,
  updateClientInState,
  markNotificationReadInState,
  acknowledgeNotificationInState,
} from "./simulator";
import type { ClientRecord, ManuAppState, SimulationRequest } from "./types";
import type { CreateClientContextUpdateInput } from "./client-context-updates";
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
  input: Pick<ClientRecord, "fullName" | "channel" | "channelUserId">,
) {
  const client = createBlankClient({
    fullName: input.fullName.trim(),
    channel: input.channel,
    channelUserId: input.channelUserId.trim(),
  });
  return addClientToState(state, client);
}

export function patchClientInState(state: ManuAppState, clientId: string, patch: Partial<ClientRecord>) {
  return updateClientInState(state, clientId, patch);
}

export function exportClientInState(state: ManuAppState, clientId: string) {
  return buildClientScopedExport(state, clientId);
}

export function recordClientExportRequestInState(state: ManuAppState, clientId: string) {
  return recordClientExportInState(state, clientId);
}

export function anonymizeClientDataInState(state: ManuAppState, clientId: string) {
  return anonymizeClientInState(state, clientId);
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
  return {
    ...state,
    handoffCases: state.handoffCases.map((handoff) =>
      handoff.id === handoffId && handoff.status === "open" ? { ...handoff, status } : handoff,
    ),
  };
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
  input: { title: string; fields: ClientFormFieldDefinition[] },
) {
  return createClientFormSchemaInState(state, input);
}

export function publishFormSchemaInState(state: ManuAppState, schemaId: string) {
  return publishClientFormSchemaInState(state, schemaId);
}

export function saveFormResponseInState(
  state: ManuAppState,
  input: { clientId: string; schemaId: string; answers: Record<string, unknown> },
) {
  return saveClientFormResponseInState(state, input.clientId, input.schemaId, input.answers);
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

export function assertNotificationExistsInState(state: ManuAppState, notificationId: string) {
  if (!state.notifications.some((notification) => notification.id === notificationId)) {
    throw new AppDomainError(404, "notification_not_found");
  }
}
