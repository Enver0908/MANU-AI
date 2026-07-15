import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import { evaluateStage4B4VoiceTranscriptionProviderGate } from "./phase-85-stage-4b4-provider-gate";
import type { Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import {
  invokeStage4B4TranscriptionProviderWithDeadline,
  isRetryableTranscriptionProviderFailure,
  mapTranscriptionProviderFailureToQualityCode,
  type Stage4B4TranscriptionProviderPort,
} from "./phase-85-stage-4b4-transcription-provider";
import { applyTranscriptQualityGate } from "./phase-85-stage-4b4-transcript-quality";
import {
  applyAcceptedTranscriptionBridge,
  processStage4B4AcceptedTranscriptionBridges,
  reconcileBundleForVoiceTranscriptionOutcome,
} from "./phase-85-stage-4b4-transcript-bridge";
import {
  COMMUNICATION_LANGUAGE_TO_LOCALE,
  buildTranscriptionLineageFieldsFromObservation,
  parseAudioTranscriptionObservationV1,
  type AudioQualityCode,
  type AudioTranscriptionRecord,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B4_TRANSCRIPTION_WORKER_VERSION = "p85-stage-4b4-transcription-worker-v2";
export const STAGE_4B4_TRANSCRIPTION_IN_PROCESS_RETRIES = 2;
export const STAGE_4B4_TRANSCRIPTION_MAX_DURABLE_RETRIES = 3;
export const STAGE_4B4_TRANSCRIPTION_RETRY_DELAY_MS = [30_000, 120_000, 300_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveClientLocale(state: ManuAppState, clientId: string): Stage4B4SupportedLocale {
  const client = state.clients.find((entry) => entry.id === clientId);
  if (!client?.communicationLanguage) {
    return "tr-TR";
  }
  return COMMUNICATION_LANGUAGE_TO_LOCALE[client.communicationLanguage] ?? "tr-TR";
}

function updateMediaAsset(state: ManuAppState, assetId: string, patch: Partial<MediaAssetRecord>): ManuAppState {
  const now = new Date().toISOString();
  return {
    ...state,
    mediaAssets: state.mediaAssets.map((asset) =>
      asset.id === assetId && asset.tenantId === state.tenant.id ? { ...asset, ...patch, updatedAt: now } : asset,
    ),
  };
}

function updateTranscriptionRecord(
  state: ManuAppState,
  transcriptionId: string,
  patch: Partial<AudioTranscriptionRecord>,
): ManuAppState {
  const now = new Date().toISOString();
  return {
    ...state,
    audioTranscriptionRecords: state.audioTranscriptionRecords.map((record) =>
      record.id === transcriptionId && record.tenantId === state.tenant.id
        ? { ...record, ...patch, updatedAt: now }
        : record,
    ),
  };
}

async function invokeProviderWithRetries(
  provider: Stage4B4TranscriptionProviderPort,
  input: {
    requestId: string;
    contentSha256: string;
    locale: Stage4B4SupportedLocale;
    wavBytes: Buffer;
  },
): Promise<{ observation: AudioTranscriptionRecord["observation"]; failureCode: string | null }> {
  let lastFailureCode: string | null = null;
  for (let attempt = 0; attempt <= STAGE_4B4_TRANSCRIPTION_IN_PROCESS_RETRIES; attempt += 1) {
    const result = await invokeStage4B4TranscriptionProviderWithDeadline(provider, input);
    if (!result.ok) {
      lastFailureCode = result.failureCode;
      const retryable = result.retryable || isRetryableTranscriptionProviderFailure(result.failureCode);
      if (retryable && attempt < STAGE_4B4_TRANSCRIPTION_IN_PROCESS_RETRIES) {
        await sleep(50);
        continue;
      }
      return { observation: null, failureCode: lastFailureCode ?? "provider_invalid_output" };
    }

    try {
      return {
        observation: parseAudioTranscriptionObservationV1(result.observation),
        failureCode: null,
      };
    } catch {
      return { observation: null, failureCode: "observation_validation_failed" };
    }
  }

  return { observation: null, failureCode: lastFailureCode ?? "provider_timeout" };
}

function finalizeReviewRequiredTranscription(
  state: ManuAppState,
  record: AudioTranscriptionRecord,
  asset: MediaAssetRecord,
  rejectionReasons: AudioQualityCode[],
  now?: string,
  retryCount?: number,
): ManuAppState {
  const observedAt = now ?? new Date().toISOString();
  let workingState = updateTranscriptionRecord(state, record.id, {
    status: "review_required",
    observation: null,
    qualityDecision: { accepted: false, reasonCodes: rejectionReasons },
    rejectionReasons,
    retryCount: retryCount ?? record.retryCount ?? 0,
    nextAttemptAt: null,
    failureCode: rejectionReasons[0] ?? "malformed_observation",
    updatedAt: observedAt,
  });
  workingState = updateMediaAsset(workingState, asset.id, {
    status: "analysis_pending",
    failureCode: rejectionReasons[0] ?? "malformed_observation",
    updatedAt: observedAt,
  });
  workingState = reconcileBundleForVoiceTranscriptionOutcome(workingState, record.id, observedAt);
  return workingState;
}

export async function transcribeSinglePendingAudioRecord(
  state: ManuAppState,
  transcriptionId: string,
  options: {
    env: NodeJS.ProcessEnv;
    provider: Stage4B4TranscriptionProviderPort;
    storage: Stage4B4AudioStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  const gate = evaluateStage4B4VoiceTranscriptionProviderGate(options.env);
  const record = state.audioTranscriptionRecords.find(
    (entry) => entry.id === transcriptionId && entry.tenantId === state.tenant.id,
  );
  if (!record || record.status !== "pending") {
    return state;
  }

  const asset = state.mediaAssets.find(
    (entry) => entry.id === record.mediaAssetId && entry.tenantId === state.tenant.id,
  );
  if (!asset || asset.mediaKind !== "audio" || asset.status !== "analysis_pending") {
    return state;
  }

  if (!gate.mockVoiceTranscriptionAllowed) {
    return finalizeReviewRequiredTranscription(state, record, asset, ["provider_disabled"], options.now);
  }

  if (!asset.contentSha256 || !asset.sanitizedAudioObjectKey) {
    return finalizeReviewRequiredTranscription(state, record, asset, ["malformed_observation"], options.now);
  }

  const now = options.now ?? new Date().toISOString();
  let workingState = updateTranscriptionRecord(state, transcriptionId, {
    status: "processing",
    updatedAt: now,
  });

  const stored = await options.storage.downloadObject(asset.sanitizedAudioObjectKey);
  if (!stored?.bytes?.byteLength) {
    const nextRetryCount = (record.retryCount ?? 0) + 1;
    if (nextRetryCount >= STAGE_4B4_TRANSCRIPTION_MAX_DURABLE_RETRIES) {
      return finalizeReviewRequiredTranscription(
        workingState,
        record,
        asset,
        ["retry_limit_exceeded"],
        now,
        nextRetryCount,
      );
    }
    const retryDelay =
      STAGE_4B4_TRANSCRIPTION_RETRY_DELAY_MS[
        Math.min(nextRetryCount - 1, STAGE_4B4_TRANSCRIPTION_RETRY_DELAY_MS.length - 1)
      ];
    const retryAt = new Date(new Date(now).getTime() + retryDelay).toISOString();
    return updateTranscriptionRecord(workingState, transcriptionId, {
      status: "pending",
      retryCount: nextRetryCount,
      nextAttemptAt: retryAt,
      rejectionReasons: [mapTranscriptionProviderFailureToQualityCode("storage_upload_failed")],
      updatedAt: now,
    });
  }

  const providerResult = await invokeProviderWithRetries(options.provider, {
    requestId: transcriptionId,
    contentSha256: asset.contentSha256,
    locale: record.locale ?? resolveClientLocale(state, asset.clientId),
    wavBytes: stored.bytes,
  });

  if (!providerResult.observation) {
    const failureCode = providerResult.failureCode ?? "provider_invalid_output";
    const qualityCode = mapTranscriptionProviderFailureToQualityCode(failureCode);
    const retryable = isRetryableTranscriptionProviderFailure(failureCode);
    const nextRetryCount = (record.retryCount ?? 0) + 1;
    if (!retryable || nextRetryCount >= STAGE_4B4_TRANSCRIPTION_MAX_DURABLE_RETRIES) {
      const terminalReasons: AudioQualityCode[] =
        retryable && nextRetryCount >= STAGE_4B4_TRANSCRIPTION_MAX_DURABLE_RETRIES
          ? ["retry_limit_exceeded"]
          : [qualityCode];
      return finalizeReviewRequiredTranscription(
        workingState,
        record,
        asset,
        terminalReasons,
        now,
        nextRetryCount,
      );
    }

    const retryDelay =
      STAGE_4B4_TRANSCRIPTION_RETRY_DELAY_MS[
        Math.min(nextRetryCount - 1, STAGE_4B4_TRANSCRIPTION_RETRY_DELAY_MS.length - 1)
      ];
    const retryAt = new Date(new Date(now).getTime() + retryDelay).toISOString();
    return updateTranscriptionRecord(workingState, transcriptionId, {
      status: "pending",
      retryCount: nextRetryCount,
      nextAttemptAt: retryAt,
      rejectionReasons: [qualityCode],
      updatedAt: now,
    });
  }

  const quality = applyTranscriptQualityGate({
    observation: providerResult.observation,
    expectedLocale: record.locale ?? resolveClientLocale(state, asset.clientId),
  });

  const completedAt = options.now ?? new Date().toISOString();
  workingState = updateTranscriptionRecord(workingState, transcriptionId, {
    status: quality.terminalStatus,
    observation: providerResult.observation,
    qualityDecision: quality.qualityDecision,
    rejectionReasons: quality.rejectionReasons,
    retrievalEligible: quality.terminalStatus === "accepted",
    ...buildTranscriptionLineageFieldsFromObservation({
      observation: providerResult.observation,
    }),
    updatedAt: completedAt,
  });

  if (quality.terminalStatus === "accepted") {
    workingState = updateMediaAsset(workingState, asset.id, {
      status: "analysis_ready",
      failureCode: null,
      nextAttemptAt: null,
      updatedAt: completedAt,
    });
    workingState = applyAcceptedTranscriptionBridge(workingState, transcriptionId, completedAt);
    return workingState;
  }

  workingState = updateMediaAsset(workingState, asset.id, {
    status: "analysis_pending",
    failureCode: quality.rejectionReasons[0] ?? "overall_confidence_low",
    updatedAt: completedAt,
  });
  workingState = reconcileBundleForVoiceTranscriptionOutcome(workingState, transcriptionId, completedAt);
  return workingState;
}

export async function processStage4B4PendingTranscriptions(
  state: ManuAppState,
  options: {
    env: NodeJS.ProcessEnv;
    provider: Stage4B4TranscriptionProviderPort;
    storage: Stage4B4AudioStoragePort;
    now?: string;
  },
): Promise<ManuAppState> {
  const now = options.now ?? new Date().toISOString();
  const dueRecords = state.audioTranscriptionRecords.filter((record) => {
    if (record.tenantId !== state.tenant.id || record.status !== "pending") {
      return false;
    }
    const asset = state.mediaAssets.find((entry) => entry.id === record.mediaAssetId);
    if (!asset || asset.status !== "analysis_pending") {
      return false;
    }
    if (!record.nextAttemptAt) {
      return true;
    }
    return new Date(record.nextAttemptAt).getTime() <= new Date(now).getTime();
  });

  let workingState = state;
  for (const record of dueRecords) {
    workingState = await transcribeSinglePendingAudioRecord(workingState, record.id, options);
  }

  return processStage4B4AcceptedTranscriptionBridges(workingState, now);
}
