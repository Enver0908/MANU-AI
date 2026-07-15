import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import {
  applyStage4B4TranscriptCorrectionFollowUpNotification,
} from "./phase-85-stage-4b4-bundle-notifications";
import {
  buildDietitianCorrectionTranscriptionLineage,
  type AudioTranscriptionRecord,
  type TranscriptCorrectionRequest,
} from "./phase-85-stage-4b4-voice-contracts";
import { invalidatePendingDrafts } from "./simulator";
import type { ManuAppState } from "./types";

export const STAGE_4B4_ATOMIC_TRANSCRIPT_CORRECTION_VERSION = "p85-stage-4b4-atomic-transcript-correction-v3";
export const STAGE_4B4_TRANSCRIPT_CORRECTION_OUTCOME_VERSION = "p85-stage-4b4-transcript-correction-outcome-v2";

export type AtomicTranscriptCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string; replay: boolean }
  | { ok: false; failureCode: string; state: ManuAppState };

function buildCorrectedTranscriptionRecord(input: {
  source: AudioTranscriptionRecord;
  correctedTranscript: string;
  correctedTranscriptionId: string;
  now: string;
}): AudioTranscriptionRecord {
  const lineage = buildDietitianCorrectionTranscriptionLineage({
    correctedTranscript: input.correctedTranscript,
    locale: input.source.locale,
    supersedesTranscriptionId: input.source.id,
  });

  return {
    id: input.correctedTranscriptionId,
    tenantId: input.source.tenantId,
    clientId: input.source.clientId,
    conversationId: input.source.conversationId,
    messageId: input.source.messageId,
    mediaAssetId: input.source.mediaAssetId,
    bundleId: input.source.bundleId,
    transcriptionRevision: input.source.transcriptionRevision + 1,
    status: "accepted",
    locale: input.source.locale,
    observation: null,
    qualityDecision: { accepted: true, reasonCodes: [] },
    rejectionReasons: [],
    sourceModality: "voice_transcript",
    providerMode: "mock",
    retrievalEligible: true,
    evidenceExpiresAt: input.source.evidenceExpiresAt ?? null,
    ...lineage,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function supersedeTranscriptCorrectionDecision(
  state: ManuAppState,
  decisionId: string,
): ManuAppState {
  return {
    ...state,
    aiDecisions: state.aiDecisions.map((decision) =>
      decision.id === decisionId
        ? {
            ...decision,
            sendStatus: "draft_invalidated",
            blockedReason: "transcript_correction_superseded",
          }
        : decision,
    ),
  };
}

export function commitAtomicTranscriptCorrectionV2(
  baseState: ManuAppState,
  request: TranscriptCorrectionRequest & { dietitianId: string },
): AtomicTranscriptCorrectionSubmitResult {
  const now = new Date().toISOString();
  const requestId = request.requestId.trim();
  const correctedTranscript = request.correctedTranscript.trim();

  if (baseState.processedTranscriptCorrectionRequestIds.includes(requestId)) {
    const replay = baseState.transcriptCorrectionReplayByRequestId[requestId];
    const correction = replay
      ? baseState.audioTranscriptCorrections.find((entry) => entry.id === replay.correctionId)
      : null;
    if (correction) {
      return {
        ok: true,
        state: baseState,
        correctionId: correction.id,
        resultAction: correction.resultAction,
        replay: true,
      };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state: baseState };
  }

  const transcription = baseState.audioTranscriptionRecords.find(
    (entry) => entry.id === request.transcriptionId && entry.tenantId === baseState.tenant.id,
  );
  if (!transcription) {
    return { ok: false, failureCode: "transcription_not_found", state: baseState };
  }
  if (transcription.status !== "accepted") {
    return { ok: false, failureCode: "transcription_not_correctable", state: baseState };
  }
  if (transcription.transcriptionRevision !== request.expectedTranscriptionRevision) {
    return { ok: false, failureCode: "stale_transcription_revision", state: baseState };
  }
  if (request.targetMessageId !== transcription.messageId) {
    return { ok: false, failureCode: "transcript_correction_target_message_mismatch", state: baseState };
  }
  if (transcription.tenantId !== baseState.tenant.id) {
    return { ok: false, failureCode: "transcript_correction_tenant_mismatch", state: baseState };
  }

  const conversation = baseState.conversations.find((entry) => entry.id === transcription.conversationId);
  if (!conversation) {
    return { ok: false, failureCode: "conversation_not_found", state: baseState };
  }
  if (conversationRevisionOrDefault(conversation) !== request.expectedConversationRevision) {
    return { ok: false, failureCode: "stale_conversation_revision", state: baseState };
  }

  const message = baseState.messages.find(
    (entry) => entry.id === transcription.messageId && entry.tenantId === baseState.tenant.id,
  );
  if (!message) {
    return { ok: false, failureCode: "message_not_found", state: baseState };
  }

  const bundle =
    transcription.bundleId != null
      ? baseState.inboundMessageBundles.find((entry) => entry.id === transcription.bundleId)
      : null;
  const linkedDecision = bundle?.decisionId
    ? baseState.aiDecisions.find((entry) => entry.id === bundle.decisionId)
    : null;
  const linkedOutbound = linkedDecision
    ? baseState.messages.find(
        (candidate) =>
          candidate.generatedByAiDecisionId === linkedDecision.id &&
          candidate.origin === "ai_generated" &&
          candidate.status === "sent",
      )
    : null;
  const pendingDraft = linkedDecision
    ? baseState.messages.find(
        (candidate) =>
          candidate.generatedByAiDecisionId === linkedDecision.id &&
          candidate.origin === "ai_generated" &&
          candidate.status === "draft",
      )
    : null;

  let resultAction: "supersede_rerun" | "invalidate_pending" | "manual_follow_up" | "closed_without_send";
  let status: "submitted" | "applied_to_pending" | "manual_follow_up_required" | "closed";

  if (linkedOutbound) {
    resultAction = "manual_follow_up";
    status = "manual_follow_up_required";
  } else if (pendingDraft || (bundle && !bundle.decisionId)) {
    resultAction = pendingDraft ? "invalidate_pending" : "supersede_rerun";
    status = "applied_to_pending";
  } else if (bundle?.decisionId) {
    resultAction = "invalidate_pending";
    status = "applied_to_pending";
  } else {
    resultAction = "supersede_rerun";
    status = "submitted";
  }

  const correctionId = crypto.randomUUID();
  const correctedTranscriptionId = crypto.randomUUID();
  const correctedTranscription = buildCorrectedTranscriptionRecord({
    source: transcription,
    correctedTranscript,
    correctedTranscriptionId,
    now,
  });

  const sentBefore = baseState.messages.filter(
    (entry) => entry.origin === "ai_generated" && entry.status === "sent",
  ).length;
  const redLockBefore = baseState.clients.find((entry) => entry.id === transcription.clientId)?.redRiskLock;

  let nextState: ManuAppState = {
    ...baseState,
    audioTranscriptCorrections: [
      ...baseState.audioTranscriptCorrections,
      {
        id: correctionId,
        tenantId: baseState.tenant.id,
        clientId: transcription.clientId,
        conversationId: transcription.conversationId,
        transcriptionId: transcription.id,
        sourceTranscriptionId: transcription.id,
        correctedTranscriptionId,
        targetMessageId: transcription.messageId,
        supersededDecisionId: bundle?.decisionId ?? null,
        rerunDecisionId: null,
        dietitianId: request.dietitianId,
        status,
        reasonCode: request.reasonCode,
        explanation: request.explanation.trim(),
        correctedTranscript,
        conversationRevisionAtSubmit: request.expectedConversationRevision,
        transcriptionRevisionAtSubmit: request.expectedTranscriptionRevision,
        resultAction,
        createdAt: now,
        updatedAt: now,
      },
    ],
    audioTranscriptionRecords: [
      ...baseState.audioTranscriptionRecords.map((entry) =>
        entry.id === transcription.id
          ? {
              ...entry,
              status: "superseded" as const,
              supersededByTranscriptionId: correctedTranscriptionId,
              updatedAt: now,
            }
          : entry,
      ),
      correctedTranscription,
    ],
    messages: baseState.messages.map((entry) =>
      entry.id === message.id
        ? {
            ...entry,
            body: correctedTranscript,
            contentStatus: "available",
            retrievalEligibility: "eligible",
          }
        : entry,
    ),
    mediaAssets: baseState.mediaAssets.map((asset) =>
      asset.id === transcription.mediaAssetId && asset.tenantId === baseState.tenant.id
        ? { ...asset, transcriptionId: correctedTranscriptionId, updatedAt: now }
        : asset,
    ),
    inboundMessageBundleItems: baseState.inboundMessageBundleItems.map((item) =>
      item.transcriptionId === transcription.id
        ? { ...item, transcriptionId: correctedTranscriptionId }
        : item,
    ),
    auditEvents: [
      ...baseState.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: baseState.tenant.id,
        eventType: "transcript_correction_submitted_atomic_v2",
        entityType: "audio_transcript_correction",
        entityId: correctionId,
        metadata: {
          transcriptionId: transcription.id,
          correctedTranscriptionId,
          resultAction,
          requestId,
          version: STAGE_4B4_TRANSCRIPT_CORRECTION_OUTCOME_VERSION,
        },
        createdAt: now,
      },
    ],
    processedTranscriptCorrectionRequestIds: [...baseState.processedTranscriptCorrectionRequestIds, requestId],
    transcriptCorrectionReplayByRequestId: {
      ...baseState.transcriptCorrectionReplayByRequestId,
      [requestId]: { correctionId, resultAction },
    },
  };

  if (resultAction === "invalidate_pending" || resultAction === "supersede_rerun") {
    if (bundle?.decisionId) {
      nextState = supersedeTranscriptCorrectionDecision(nextState, bundle.decisionId);
    }
    nextState = invalidatePendingDrafts(nextState, now, "transcript_correction_submitted");
    if (bundle) {
      nextState = {
        ...nextState,
        inboundMessageBundles: nextState.inboundMessageBundles.map((entry) =>
          entry.id === bundle.id
            ? {
                ...entry,
                status: entry.status === "decided" || entry.status === "completed" ? "ready" : entry.status,
                decisionId: null,
                leaseExpiresAt: null,
                bundleRevision: entry.bundleRevision + 1,
                updatedAt: now,
              }
            : entry,
        ),
      };
    }
  }

  if (resultAction === "manual_follow_up") {
    const client = baseState.clients.find((entry) => entry.id === transcription.clientId);
    if (client) {
      nextState = {
        ...nextState,
        clients: nextState.clients.map((entry) =>
          entry.id === client.id
            ? {
                ...entry,
                aiStatus: "passive" as const,
                aiMode: "manual" as const,
                humanTakeoverLocked: true,
                contextRevision: entry.contextRevision + 1,
                redRiskLock: entry.redRiskLock,
              }
            : entry,
        ),
        auditEvents: [
          ...nextState.auditEvents,
          {
            id: crypto.randomUUID(),
            tenantId: baseState.tenant.id,
            eventType: "transcript_correction_manual_follow_up_required",
            entityType: "client",
            entityId: client.id,
            metadata: {
              correctionId,
              priorDecisionId: bundle?.decisionId ?? null,
              priorOutboundMessageId: linkedOutbound?.id ?? null,
            },
            createdAt: now,
          },
        ],
      };
      nextState = applyStage4B4TranscriptCorrectionFollowUpNotification(nextState, {
        correctionId,
        clientId: client.id,
        conversationId: transcription.conversationId,
        transcriptionId: transcription.id,
        clientName: client.fullName,
        now,
      });
    }
  }

  const sentAfter = nextState.messages.filter(
    (entry) => entry.origin === "ai_generated" && entry.status === "sent",
  ).length;
  if (resultAction === "manual_follow_up" && sentAfter !== sentBefore) {
    return { ok: false, failureCode: "sent_correction_auto_message_forbidden", state: baseState };
  }

  const redLockAfter = nextState.clients.find((entry) => entry.id === transcription.clientId)?.redRiskLock;
  if (redLockBefore?.status === "locked" && redLockAfter?.status !== "locked") {
    return { ok: false, failureCode: "red_risk_lock_must_remain", state: baseState };
  }

  return { ok: true, state: nextState, correctionId, resultAction, replay: false };
}

export function buildTranscriptCorrectionRpcOutcome(input: {
  state: ManuAppState;
  baseState: ManuAppState;
  correctionId: string;
  resultAction: string;
  request: TranscriptCorrectionRequest & { dietitianId: string };
}): Record<string, unknown> {
  const correction = input.state.audioTranscriptCorrections.find((entry) => entry.id === input.correctionId);
  if (!correction) {
    throw new Error("transcript_correction_missing");
  }

  const sourceTranscription = input.state.audioTranscriptionRecords.find(
    (entry) => entry.id === correction.sourceTranscriptionId,
  );
  const correctedTranscription =
    input.state.audioTranscriptionRecords.find((entry) => entry.id === correction.correctedTranscriptionId) ??
    input.state.audioTranscriptionRecords.find(
      (entry) =>
        entry.mediaAssetId === sourceTranscription?.mediaAssetId &&
        entry.transcriptionRevision === (sourceTranscription?.transcriptionRevision ?? 0) + 1 &&
        entry.status === "accepted",
    ) ??
    null;

  const bundle =
    sourceTranscription?.bundleId != null
      ? (input.state.inboundMessageBundles.find((entry) => entry.id === sourceTranscription.bundleId) ?? null)
      : null;

  const baseDraftIds = new Set(
    input.baseState.messages.filter((message) => message.status === "draft").map((message) => message.id),
  );
  const draftInvalidations = input.state.messages.filter(
    (message) => baseDraftIds.has(message.id) && message.status !== "draft",
  );

  const baseMessage = input.baseState.messages.find((entry) => entry.id === sourceTranscription?.messageId);
  const nextMessage = input.state.messages.find((entry) => entry.id === sourceTranscription?.messageId);

  const baseClient = input.baseState.clients.find((entry) => entry.id === correction.clientId);
  const nextClient = input.state.clients.find((entry) => entry.id === correction.clientId);

  return {
    version: STAGE_4B4_TRANSCRIPT_CORRECTION_OUTCOME_VERSION,
    correctionId: correction.id,
    transcriptionId: correction.transcriptionId,
    expectedConversationRevision: correction.conversationRevisionAtSubmit,
    expectedTranscriptionRevision: correction.transcriptionRevisionAtSubmit,
    resultAction: input.resultAction,
    correction: {
      ...correction,
      correctedTranscriptionId: correction.correctedTranscriptionId,
    },
    correctedTranscriptionId: correctedTranscription?.id ?? null,
    correctedTranscription,
    messageUpdate:
      baseMessage && nextMessage && baseMessage.body !== nextMessage.body
        ? {
            messageId: nextMessage.id,
            body: nextMessage.body,
            retrievalEligibility: nextMessage.retrievalEligibility,
            contentStatus: nextMessage.contentStatus,
          }
        : null,
    bundleUpdate: bundle
      ? {
          status: bundle.status,
          decisionId: bundle.decisionId,
          bundleRevision: bundle.bundleRevision,
        }
      : null,
    bundleItemTranscriptionId: correctedTranscription?.id ?? null,
    mediaAssetTranscriptionId: correctedTranscription?.id ?? null,
    draftInvalidations,
    outboundMessages: [],
    notifications: input.state.notifications.filter(
      (notification) => !input.baseState.notifications.some((entry) => entry.id === notification.id),
    ),
    auditEvents: input.state.auditEvents.filter(
      (audit) => !input.baseState.auditEvents.some((entry) => entry.id === audit.id),
    ),
    clientUpdate:
      baseClient && nextClient && baseClient !== nextClient
        ? {
            aiStatus: nextClient.aiStatus,
            aiMode: nextClient.aiMode,
            humanTakeoverLocked: nextClient.humanTakeoverLocked,
            contextRevision: nextClient.contextRevision,
            redRiskLock: nextClient.redRiskLock,
          }
        : null,
  };
}
