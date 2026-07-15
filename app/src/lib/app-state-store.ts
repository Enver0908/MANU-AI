import { createBlankClient, createInitialState } from "./seed-data";
import { AppDomainError } from "./app-errors";
import { normalizeE164Phone, normalizeLanguageCode } from "./languages";
import { buildClientScopedExport, recordClientExportInState } from "./data-governance";
import { sanitizeClientScopedExportForClientFacing } from "./phase-77v-copilot-quality-workflow";
import { applyPhase79LifecycleRedactionContract } from "./phase-79e-lifecycle-redaction-evidence";
import {
  createClientFormSchemaInState,
  publishClientFormSchemaInState,
  saveClientFormResponseInState,
} from "./client-forms";
import { createClientContextUpdateInState } from "./client-context-updates";
import {
  saveClientFoodRuleProfileV2InState as saveClientFoodRuleProfileV2RecordInState,
  type SaveClientFoodRuleProfileV2Input,
} from "./phase-77e-client-food-rule-profile";
import {
  activateClientMenuPlanV1InState,
  assertDietPlanSummaryPatchAllowed,
  createClientMenuPlanV1InState,
  saveClientMenuPlanV1InState,
  type CreateClientMenuPlanV1Input,
  type SaveClientMenuPlanV1Input,
} from "./phase-77f-client-menu-plan";
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
  approveDraftMessageInStateWithRevision,
  addClientToState,
  appendDietitianManualReply,
  appendDietitianManualReplyByConversation,
  activateClientAiWithControlledRiskResolutionInState,
  dismissDraftMessageInState,
  dismissDraftMessageInStateWithRevision,
  releaseHumanTakeoverLockInState,
  resolveAndReactivateRedRiskInState as resolveAndReactivateRedRiskInStateImpl,
  reviewSendManualFromYellowDraftInState,
  runInboundSimulation,
  updateClientInState,
  markNotificationReadInState,
  acknowledgeNotificationInState,
} from "./simulator";
import type { ControlledAiActivationInput } from "./phase-85-if-f-risk-reactivation";
import { resolveStructuredRecordUpdateNotificationInState } from "./phase-85-if-e-historical-retrieval";
import {
  buildClinicalAlertsListResponse,
  buildNotificationMutationResponse,
  buildNotificationReadAllResponse,
  buildSystemNotificationsListResponse,
  assertNotificationAccessibleInState,
  listFallbackAssignments,
  projectSystemNotificationListItems,
  type NotificationListStatus,
} from "./phase-85-stage-4b-api";
import {
  buildConversationDetailResponseFromAppState,
  buildConversationListResponseFromAppState,
  conversationActorFromContext,
  conversationProjectionSourceFromAppState,
  type ConversationDetailBuildInput,
  type ConversationListBuildInput,
} from "./phase-85-stage-4b2-messaging";
import {
  buildConversationMarkReadMutationResponse,
  markConversationReadInState,
} from "./phase-85-stage-4b2-read-api";
import type {
  ConversationDraftMutationRequest,
  ConversationManualReplyRequest,
  ConversationMutationResponse,
} from "./phase-85-stage-4b2-contracts";
import {
  assertConversationMutationAllowed,
  buildConversationMutationResponseFromState,
  getFallbackConversationMutationIdempotency,
  resetFallbackConversationMutationIdempotency,
  storeFallbackConversationMutationIdempotency,
  resolveDraftMutationResultMessage,
} from "./phase-85-stage-4b2-mutations";
import { resolveConversationPermissions } from "./phase-85-stage-4b2-api";
import {
  assertVisualCorrectionAllowed,
  parseVisualCorrectionMutationBody,
} from "./phase-85-stage-4b3-bounded-media";
import type { VisualCorrectionRequest } from "./phase-85-stage-4b3-media-contracts";
import { submitVisualCorrection } from "./phase-85-stage-4b3-visual-corrections";
import {
  assertTranscriptCorrectionAllowed,
  parseTranscriptCorrectionMutationBody,
} from "./phase-85-stage-4b4-transcript-correction-bounded";
import { submitTranscriptCorrection } from "./phase-85-stage-4b4-transcript-corrections";
import type { TranscriptCorrectionRequest } from "./phase-85-stage-4b4-voice-contracts";
import type { NotificationCategory, NotificationPriority } from "./phase-85-stage-4b-contracts";
import type { ClinicalAlertFilterSeverity } from "./phase-85-stage-4b-alerts";
import {
  completeUnsupportedMediaReviewInState,
  markAllVisibleNotificationReceiptsReadInState,
  normalizeNotificationsInState,
} from "./phase-85-stage-4b-notifications";
import type { AppTenantContext } from "./auth-context";
import type { ClientRecord, ManuAppState, MessageRecord, SimulationRequest } from "./types";
import { setChannelAdapterRollbackInState as applyChannelAdapterRollbackInState } from "./channel-adapter-rollback";
import type { ApplyClientUpdateProposalInput, CreateClientUpdateProposalInput } from "./client-update-proposals";
import type { CreateClientContextUpdateInput } from "./client-context-updates";
import type { ClientFormFieldDefinition, VoiceSampleStatus } from "./types";
import {
  applyContextIntakeProposalInState,
  confirmContextIntakeProposalInState,
  createContextIntakeProposalInState,
  recheckContextIntakeProposalInState,
  rejectContextIntakeProposalInState,
  type CreateContextIntakeProposalInput,
  type ResolveContextIntakeClientInput,
} from "./phase-85-if-g-context-intake";

const globalStore = globalThis as typeof globalThis & {
  manuAiFallbackState?: ManuAppState;
};

export function getFallbackState() {
  globalStore.manuAiFallbackState ??= createInitialState();
  return globalStore.manuAiFallbackState;
}

export function resetFallbackState() {
  resetFallbackConversationMutationIdempotency();
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

  assertDietPlanSummaryPatchAllowed(state, clientId, normalizedPatch);

  return updateClientInState(state, clientId, normalizedPatch);
}

export function createMenuPlanInState(state: ManuAppState, clientId: string, input: CreateClientMenuPlanV1Input) {
  return createClientMenuPlanV1InState(state, clientId, input);
}

export function saveMenuPlanInState(
  state: ManuAppState,
  clientId: string,
  planId: string,
  input: SaveClientMenuPlanV1Input,
) {
  return saveClientMenuPlanV1InState(state, clientId, planId, input);
}

export function activateMenuPlanInState(state: ManuAppState, clientId: string, planId: string) {
  return activateClientMenuPlanV1InState(state, clientId, planId);
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
  return sanitizeClientScopedExportForClientFacing(buildClientScopedExport(state, clientId));
}

export function recordClientExportRequestInState(state: ManuAppState, clientId: string) {
  return recordClientExportInState(state, clientId);
}

export function anonymizeClientDataInState(state: ManuAppState, clientId: string) {
  return applyPhase79LifecycleRedactionContract(state, clientId, "anonymization").state;
}

export function removeClientDataInState(state: ManuAppState, clientId: string) {
  return applyPhase79LifecycleRedactionContract(state, clientId, "deletion").state;
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

export function activateClientAiInState(
  state: ManuAppState,
  clientId: string,
  input: ControlledAiActivationInput,
) {
  assertClientExistsInState(state, clientId);
  return activateClientAiWithControlledRiskResolutionInState(state, clientId, input);
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

function fallbackTenantContext(state: ManuAppState): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "fallback-user",
    role: "owner",
  };
}

export function markFallbackNotificationRead(notificationId: string) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const assignments = listFallbackAssignments();
  assertNotificationAccessibleInState(state, notificationId, context, assignments);
  const next = markNotificationReadInState(state, notificationId);
  saveFallbackState(next);
  return buildNotificationMutationResponse(next, context, assignments, notificationId);
}

export function acknowledgeFallbackNotification(notificationId: string) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const assignments = listFallbackAssignments();
  assertNotificationAccessibleInState(state, notificationId, context, assignments);
  const next = acknowledgeNotificationInState(state, notificationId);
  saveFallbackState(next);
  return buildNotificationMutationResponse(next, context, assignments, notificationId);
}

export function markAllFallbackNotificationsRead() {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const assignments = listFallbackAssignments();
  const unreadIds = projectSystemNotificationListItems(state, context, assignments)
    .filter((item) => !item.readAt)
    .map((item) => item.id);
  const next = markAllVisibleNotificationReceiptsReadInState(
    state,
    context.dietitianId,
    new Set(unreadIds),
    new Date().toISOString(),
  );
  saveFallbackState(next);
  return buildNotificationReadAllResponse(next, context, assignments, unreadIds.length);
}

export function completeFallbackUnsupportedMediaReview(notificationId: string) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const assignments = listFallbackAssignments();
  assertNotificationAccessibleInState(state, notificationId, context, assignments);
  const next = completeUnsupportedMediaReviewInState(state, notificationId, context.dietitianId);
  saveFallbackState(next);
  return buildNotificationMutationResponse(next, context, assignments, notificationId);
}

export function listFallbackClinicalAlerts(input: {
  severity?: ClinicalAlertFilterSeverity;
  query?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  return buildClinicalAlertsListResponse(state, context, listFallbackAssignments(), input);
}

export function listFallbackNotifications(input: {
  status?: NotificationListStatus;
  priority?: NotificationPriority | null;
  category?: NotificationCategory | null;
  query?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  return buildSystemNotificationsListResponse(state, context, listFallbackAssignments(), input);
}

export function listFallbackConversations(input: ConversationListBuildInput = {}) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  return buildConversationListResponseFromAppState(state, context, listFallbackAssignments(), input);
}

export function getFallbackConversationDetail(conversationId: string, input: ConversationDetailBuildInput = {}) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  return buildConversationDetailResponseFromAppState(
    state,
    context,
    listFallbackAssignments(),
    conversationId,
    input,
  );
}

export function markFallbackConversationRead(conversationId: string, throughSequence: number) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const assignments = listFallbackAssignments();
  const actor = conversationActorFromContext(context);
  const next = markConversationReadInState(state, actor, conversationId, throughSequence, assignments);
  saveFallbackState(next);
  const source = conversationProjectionSourceFromAppState(next);
  const receipt =
    source.receipts?.find(
      (item) =>
        item.tenantId === actor.tenantId &&
        item.conversationId === conversationId &&
        item.dietitianId === actor.dietitianId,
    ) ?? null;
  if (!receipt) {
    throw new AppDomainError(409, "conversation_read_mutation_empty");
  }
  return buildConversationMarkReadMutationResponse(
    source,
    actor,
    assignments,
    conversationId,
    receipt,
  );
}

export function addFallbackManualReplyWithResponse(request: ConversationManualReplyRequest) {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const actor = conversationActorFromContext(context);
  const assignments = listFallbackAssignments();
  const cached = getFallbackConversationMutationIdempotency(context.tenantId, request.requestId);
  if (cached) return cached;

  assertConversationMutationAllowedForFallback(actor, state, assignments, request.conversationId, "manual_reply");
  const { nextState, message } = appendDietitianManualReplyByConversation(state, {
    conversationId: request.conversationId,
    body: request.body,
    expectedConversationRevision: request.expectedConversationRevision,
    authorDietitianId: context.dietitianId,
  });
  saveFallbackState(nextState);
  const response = buildConversationMutationResponseFromState(
    nextState,
    actor,
    assignments,
    "manual_reply",
    request.conversationId,
    message,
  );
  storeFallbackConversationMutationIdempotency(context.tenantId, request.requestId, response);
  return response;
}

export function applyFallbackDraftMutationWithResponse(
  messageId: string,
  request: ConversationDraftMutationRequest,
): ConversationMutationResponse {
  const state = getFallbackState();
  const context = fallbackTenantContext(state);
  const actor = conversationActorFromContext(context);
  const assignments = listFallbackAssignments();
  const cached = getFallbackConversationMutationIdempotency(context.tenantId, request.requestId);
  if (cached) return cached;

  const draft = state.messages.find((item) => item.id === messageId);
  if (!draft) {
    throw new AppDomainError(404, "message_not_found");
  }
  const conversationId = draft.conversationId;
  assertConversationMutationAllowedForFallback(actor, state, assignments, conversationId, "draft_review");

  let nextState = state;
  let resultMessage: MessageRecord | null = null;

  if (request.action === "dismiss") {
    nextState = dismissDraftMessageInStateWithRevision(state, messageId, request.expectedConversationRevision);
  } else if (request.action === "review_send_manual") {
    const result = reviewSendManualFromYellowDraftInState(state, messageId, {
      body: request.body,
      expectedConversationRevision: request.expectedConversationRevision,
      expectedClientContextRevision: request.expectedClientContextRevision,
    });
    nextState = result.nextState;
    resultMessage = resolveDraftMutationResultMessage(request.action, draft, result.message);
  } else {
    const result = approveDraftMessageInStateWithRevision(state, messageId, {
      body: request.action === "edit_send" ? request.body : undefined,
      expectedConversationRevision: request.expectedConversationRevision,
      expectedClientContextRevision: request.expectedClientContextRevision,
    });
    nextState = result.nextState;
    resultMessage = resolveDraftMutationResultMessage(request.action, draft, result.message);
  }

  saveFallbackState(nextState);
  const response = buildConversationMutationResponseFromState(
    nextState,
    actor,
    assignments,
    "draft_review",
    conversationId,
    resultMessage,
  );
  storeFallbackConversationMutationIdempotency(context.tenantId, request.requestId, response);
  return response;
}

function assertConversationMutationAllowedForFallback(
  actor: ReturnType<typeof conversationActorFromContext>,
  state: ManuAppState,
  assignments: ReturnType<typeof listFallbackAssignments>,
  conversationId: string,
  operation: "manual_reply" | "draft_review",
) {
  const source = conversationProjectionSourceFromAppState(state);
  assertConversationMutationAllowed(actor, source, assignments, conversationId, operation);
}

export function acknowledgeNotification(state: ManuAppState, notificationId: string) {
  assertNotificationExistsInState(state, notificationId);
  return acknowledgeNotificationInState(state, notificationId);
}

export function resolveStructuredRecordUpdateNotification(state: ManuAppState, notificationId: string) {
  return resolveStructuredRecordUpdateNotificationInState(state, notificationId, state.dietitian.id);
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

export function saveClientFoodRuleProfileV2InState(
  state: ManuAppState,
  clientId: string,
  input: SaveClientFoodRuleProfileV2Input,
) {
  return saveClientFoodRuleProfileV2RecordInState(state, clientId, input);
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

export function createContextIntakeProposal(
  state: ManuAppState,
  resolution: ResolveContextIntakeClientInput,
  input: CreateContextIntakeProposalInput,
) {
  return createContextIntakeProposalInState(state, resolution, input);
}

export function confirmContextIntakeProposal(state: ManuAppState, clientId: string, proposalId: string) {
  return confirmContextIntakeProposalInState(state, clientId, proposalId);
}

export function recheckContextIntakeProposal(state: ManuAppState, clientId: string, proposalId: string) {
  return recheckContextIntakeProposalInState(state, clientId, proposalId);
}

export function applyContextIntakeProposal(state: ManuAppState, clientId: string, proposalId: string) {
  return applyContextIntakeProposalInState(state, clientId, proposalId);
}

export function rejectContextIntakeProposal(state: ManuAppState, clientId: string, proposalId: string) {
  return rejectContextIntakeProposalInState(state, clientId, proposalId);
}

export function assertNotificationExistsInState(state: ManuAppState, notificationId: string) {
  if (!state.notifications.some((notification) => notification.id === notificationId)) {
    throw new AppDomainError(404, "notification_not_found");
  }
}

export function setChannelAdapterRollbackInState(
  state: ManuAppState,
  input: Parameters<typeof applyChannelAdapterRollbackInState>[1],
) {
  return applyChannelAdapterRollbackInState(state, input);
}

export function submitFallbackVisualCorrection(
  conversationId: string,
  request: VisualCorrectionRequest,
  context?: AppTenantContext,
) {
  const state = getFallbackState();
  const tenantContext = context ?? fallbackTenantContext(state);
  const actor = conversationActorFromContext(tenantContext);
  const assignments = listFallbackAssignments();
  const conversation = state.conversations.find((entry) => entry.id === conversationId);
  const client = conversation
    ? state.clients.find((entry) => entry.id === conversation.clientId && entry.lifecycleStatus === "active")
    : undefined;
  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  const permissions = resolveConversationPermissions({
    actor,
    conversation,
    client,
    assignments,
  });
  assertVisualCorrectionAllowed(permissions, actor.role);
  parseVisualCorrectionMutationBody(request);

  const result = submitVisualCorrection(state, {
    ...request,
    dietitianId: tenantContext.dietitianId,
  });
  if (!result.ok) {
    throw new AppDomainError(409, result.failureCode);
  }

  saveFallbackState(result.state);
  const detail = buildConversationDetailResponseFromAppState(
    result.state,
    tenantContext,
    assignments,
    conversationId,
  );
  return {
    version: "p85-stage-4b3-visual-correction-v1",
    generatedAt: new Date().toISOString(),
    correctionId: result.correctionId,
    resultAction: result.resultAction,
    conversationId,
    detail,
  };
}

export async function submitFallbackTranscriptCorrection(
  conversationId: string,
  request: TranscriptCorrectionRequest,
  context?: AppTenantContext,
) {
  const state = getFallbackState();
  const tenantContext = context ?? fallbackTenantContext(state);
  const actor = conversationActorFromContext(tenantContext);
  const assignments = listFallbackAssignments();
  const conversation = state.conversations.find((entry) => entry.id === conversationId);
  const client = conversation
    ? state.clients.find((entry) => entry.id === conversation.clientId && entry.lifecycleStatus === "active")
    : undefined;
  if (!conversation || !client) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  const transcription = state.audioTranscriptionRecords.find(
    (entry) => entry.id === request.transcriptionId && entry.conversationId === conversationId,
  );
  if (!transcription) {
    throw new AppDomainError(404, "transcription_not_found");
  }

  const permissions = resolveConversationPermissions({
    actor,
    conversation,
    client,
    assignments,
  });
  assertTranscriptCorrectionAllowed(permissions, actor.role);
  parseTranscriptCorrectionMutationBody(request);

  const result = await submitTranscriptCorrection(state, {
    ...request,
    dietitianId: tenantContext.dietitianId,
  });
  if (!result.ok) {
    throw new AppDomainError(409, result.failureCode);
  }

  saveFallbackState(result.state);
  const detail = buildConversationDetailResponseFromAppState(
    result.state,
    tenantContext,
    assignments,
    conversationId,
  );
  return {
    version: "p85-stage-4b4-transcript-correction-v1",
    generatedAt: new Date().toISOString(),
    correctionId: result.correctionId,
    resultAction: result.resultAction,
    conversationId,
    detail,
  };
}

export async function runFallbackStage4B3VisualSimulation(
  request: import("./phase-85-stage-4b3-visual-simulator").Stage4B3VisualSimulationRequest,
) {
  const state = getFallbackState();
  const { runStage4B3VisualSimulationInState } = await import("./phase-85-stage-4b3-visual-simulator");
  const result = await runStage4B3VisualSimulationInState(state, request, {
    providedSecret: process.env.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET ?? null,
  });
  saveFallbackState(result.state);
  return result.state;
}

export async function runFallbackStage4B4VoiceSimulation(
  request: import("./phase-85-stage-4b4-voice-simulator").Stage4B4VoiceSimulationRequest,
) {
  const state = getFallbackState();
  const { runStage4B4VoiceSimulationInState } = await import("./phase-85-stage-4b4-voice-simulator");
  const result = await runStage4B4VoiceSimulationInState(state, request, {
    providedSecret: process.env.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET ?? null,
  });
  saveFallbackState(result.state);
  return result.state;
}

export async function runFallbackStage4B3WorkerTick() {
  const state = getFallbackState();
  const { runStage4B3LocalWorkerTick } = await import("./phase-85-stage-4b3-canonical-ingress");
  const next = await runStage4B3LocalWorkerTick(state, { runOrchestration: true });
  saveFallbackState(next);
  return {
    version: "p85-stage-4b3-local-worker-v1",
    generatedAt: new Date().toISOString(),
    pendingMediaAssets: next.mediaAssets.filter((asset) => asset.status === "download_pending" || asset.status === "analysis_pending").length,
    openBundles: next.inboundMessageBundles.filter((bundle) => bundle.status === "open" || bundle.status === "ready" || bundle.status === "processing").length,
    lastSimulation: next.lastSimulation,
  };
}

export async function runFallbackStage4B3MediaLifecycleTick() {
  const state = getFallbackState();
  const { processDueStage4B3MediaExpiryInState, STAGE_4B3_MEDIA_LIFECYCLE_VERSION } = await import(
    "./phase-85-stage-4b3-media-lifecycle"
  );
  const next = await processDueStage4B3MediaExpiryInState(state);
  saveFallbackState(next);
  return {
    version: STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
    generatedAt: new Date().toISOString(),
    expiredAssets: next.mediaAssets.filter((asset) => asset.status === "expired").length,
    revokedAssets: next.mediaAssets.filter((asset) => asset.status === "revoked").length,
  };
}
