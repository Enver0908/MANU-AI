import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import {
  finalizeExpiredMediaAsset,
  finalizeRevokedMediaAsset,
  isMediaAssetDueForExpiry,
} from "./phase-85-stage-4b3-media-lifecycle";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import { buildConversationAudioStreamUrl } from "./phase-85-stage-4b4-bounded-audio";
import { getFallbackStage4B4AudioStorage } from "./phase-85-stage-4b4-fallback-audio-storage";
import { prepareAudioAssetDeletionInState, processDueStage4B4AudioExpirySagaInState } from "./phase-85-stage-4b4-audio-lifecycle-saga";
import type { AudioPendingObjectKeyRecord } from "./phase-85-stage-4b4-audio-lifecycle-saga";
import type { Stage4B4AudioStoragePort } from "./phase-85-stage-4b4-audio-storage";
import {
  STAGE_4B4_MEDIA_RETENTION_DAYS,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionRecord,
  type AudioTranscriptCorrectionRecord,
} from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B4_AUDIO_LIFECYCLE_VERSION = "p85-stage-4b4-audio-lifecycle-v2";
export const STAGE_4B4_VOICE_EXPORT_FILE = "voice_transcripts.json";

const TERMINAL_ASSET_STATUSES = new Set<MediaAssetRecord["status"]>(["expired", "revoked"]);
const ACCEPTED_TRANSCRIPTION_STATUSES = new Set<AudioTranscriptionRecord["status"]>(["accepted"]);

export type Stage4B4AudioOrphanKind = "object_without_row" | "row_without_object";

export type Stage4B4AudioOrphanEntry = {
  kind: Stage4B4AudioOrphanKind;
  objectKey?: string;
  assetId?: string;
  tenantId?: string;
};

export type Stage4B4AudioOrphanReport = {
  version: string;
  generatedAt: string;
  orphanCount: number;
  entries: Stage4B4AudioOrphanEntry[];
};

export type Stage4B4AudioOperationalHealth = {
  version: string;
  pendingExpiryCount: number;
  expiredVoiceAssetCount: number;
  revokedVoiceAssetCount: number;
  pendingTranscriptionEvidenceCount: number;
  orphanObjectCount: number;
  orphanRowCount: number;
  failedDeletionCount: number;
  status: "healthy" | "degraded" | "blocked";
};

export type Stage4B4VoiceTranscriptExportEntry = {
  transcriptionId: string;
  messageId: string;
  conversationId: string;
  mediaAssetId: string;
  status: AudioTranscriptionRecord["status"];
  transcriptionRevision: number;
  transcriptSummary: string | null;
  locale: string;
  correctionCount: number;
  storedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  authorizedStreamUrl: string | null;
};

export type Stage4B4VoiceCorrectionExportEntry = {
  correctionId: string;
  transcriptionId: string;
  targetMessageId: string;
  status: AudioTranscriptCorrectionRecord["status"];
  createdAt: string;
};

export type Stage4B4VoiceDsarExportPackage = {
  version: string;
  retentionDays: number;
  transcripts: Stage4B4VoiceTranscriptExportEntry[];
  corrections: Stage4B4VoiceCorrectionExportEntry[];
};

export type Stage4B4AudioRedactionInvariantResult = {
  passed: boolean;
  blockingReasons: string[];
};

const EXPORT_LEAK_MARKERS = [
  "sanitizedAudioObjectKey",
  "sanitized_audio_object_key",
  "objectKey",
  "object_key",
  "providerMediaId",
  "provider_media_id",
  "overallConfidence",
  "overall_confidence",
  "segmentConfidence",
  "segments",
  "observation",
  "qualityDecision",
  "rawProviderPayload",
  "contentSha256",
] as const;

export function isVoiceMediaAsset(
  asset: Pick<MediaAssetRecord, "mediaKind" | "voiceMessage" | "sanitizedAudioObjectKey">,
): boolean {
  return asset.mediaKind === "audio" || asset.voiceMessage === true || Boolean(asset.sanitizedAudioObjectKey);
}

export function collectMediaAssetAudioObjectKeys(
  asset: Pick<MediaAssetRecord, "sanitizedAudioObjectKey">,
): string[] {
  return typeof asset.sanitizedAudioObjectKey === "string" && asset.sanitizedAudioObjectKey.trim().length > 0
    ? [asset.sanitizedAudioObjectKey]
    : [];
}

export function isAudioAssetDueForExpiry(asset: MediaAssetRecord, now: string): boolean {
  if (!isVoiceMediaAsset(asset)) {
    return false;
  }
  return isMediaAssetDueForExpiry(asset, now);
}

export function redactAudioTranscriptionObservationForLifecycle(
  observation: AudioTranscriptionObservationV1 | null,
  options: { preserveTranscriptText?: boolean } = {},
): AudioTranscriptionObservationV1 | null {
  if (!observation) {
    return null;
  }

  return {
    schemaVersion: observation.schemaVersion,
    locale: observation.locale,
    transcriptText: options.preserveTranscriptText ? observation.transcriptText : PHASE_74_REDACTION_MARKER,
    overallConfidence: 0,
    segments: [],
    uncertainSpanCount: 0,
    providerId: PHASE_74_REDACTION_MARKER,
    providerVersion: PHASE_74_REDACTION_MARKER,
  };
}

export function redactAudioTranscriptionForLifecycle(
  record: AudioTranscriptionRecord,
  now: string,
): AudioTranscriptionRecord {
  const preserveTranscriptText = ACCEPTED_TRANSCRIPTION_STATUSES.has(record.status);

  return {
    ...record,
    observation: redactAudioTranscriptionObservationForLifecycle(record.observation, {
      preserveTranscriptText,
    }),
    qualityDecision: null,
    rejectionReasons: [],
    retrievalEligible: false,
    updatedAt: now,
  };
}

export function redactAudioTranscriptCorrectionForLifecycle(
  correction: AudioTranscriptCorrectionRecord,
  now: string,
): AudioTranscriptCorrectionRecord {
  return {
    ...correction,
    explanation: PHASE_74_REDACTION_MARKER,
    correctedTranscript: PHASE_74_REDACTION_MARKER,
    updatedAt: now,
  };
}

export function redactAudioTranscriptionEvidenceForAssetInState(
  state: ManuAppState,
  mediaAssetId: string,
  now: string,
): ManuAppState {
  return {
    ...state,
    audioTranscriptionRecords: state.audioTranscriptionRecords.map((record) =>
      record.mediaAssetId === mediaAssetId ? redactAudioTranscriptionForLifecycle(record, now) : record,
    ),
  };
}

export function redactStage4B4AudioRecordsForClientInState(
  state: ManuAppState,
  clientId: string,
  now: string,
): { state: ManuAppState; objectKeys: string[] } {
  let next = state;
  const objectKeys: string[] = [];

  for (const asset of next.mediaAssets.filter((item) => item.clientId === clientId && isVoiceMediaAsset(item))) {
    if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.status === "deletion_pending") {
      continue;
    }
    const prepared = prepareAudioAssetDeletionInState(next, asset.id, "revoked", now);
    next = prepared.state;
    objectKeys.push(...prepared.pendingObjectKeys.map((entry) => entry.objectKey));
  }

  next = {
    ...next,
    audioTranscriptionRecords: next.audioTranscriptionRecords.map((record) =>
      record.clientId === clientId ? redactAudioTranscriptionForLifecycle(record, now) : record,
    ),
    audioTranscriptCorrections: next.audioTranscriptCorrections.map((correction) =>
      correction.clientId === clientId ? redactAudioTranscriptCorrectionForLifecycle(correction, now) : correction,
    ),
    auditEvents: [
      ...next.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: next.tenant.id,
        eventType: "audio_lifecycle_client_redacted",
        entityType: "client",
        entityId: clientId,
        metadata: {
          voiceAssetCount: next.mediaAssets.filter((asset) => asset.clientId === clientId && isVoiceMediaAsset(asset))
            .length,
          objectCount: objectKeys.length,
          minimized: true,
        },
        createdAt: now,
      },
    ],
  };

  return { state: next, objectKeys };
}

export async function purgeStage4B4AudioObjectKeys(
  storage: Stage4B4AudioStoragePort,
  objectKeys: string[],
): Promise<void> {
  for (const objectKey of [...new Set(objectKeys)]) {
    try {
      await storage.deleteObject(objectKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("not_found") && !message.includes("Object not found")) {
        throw error;
      }
    }
  }
}

export function purgeFallbackStage4B4AudioObjectKeys(objectKeys: string[]): void {
  const storage = getFallbackStage4B4AudioStorage();
  if (!("objects" in storage)) {
    return;
  }
  for (const objectKey of [...new Set(objectKeys)]) {
    storage.objects.delete(objectKey);
  }
}

export async function processDueStage4B4AudioExpiryInState(
  state: ManuAppState,
  input: { now?: string; storage?: Stage4B4AudioStoragePort; legalHoldClientIds?: Set<string> } = {},
): Promise<ManuAppState> {
  const now = input.now ?? new Date().toISOString();
  const dueAssets = state.mediaAssets.filter((asset) => isAudioAssetDueForExpiry(asset, now));
  if (dueAssets.length === 0) {
    return state;
  }

  const next = await processDueStage4B4AudioExpirySagaInState(state, input);

  return {
    ...next,
    auditEvents: [
      ...next.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: next.tenant.id,
        eventType: "audio_asset_expired",
        entityType: "media_asset",
        entityId: dueAssets[0]!.id,
        metadata: {
          expiredCount: dueAssets.length,
          retentionDays: STAGE_4B4_MEDIA_RETENTION_DAYS,
          minimized: true,
        },
        createdAt: now,
      },
    ],
  };
}

export function detectStage4B4AudioOrphans(
  state: ManuAppState,
  storage: Stage4B4AudioStoragePort & { objects?: Map<string, unknown> },
): Stage4B4AudioOrphanReport {
  const knownKeys = new Set(
    state.mediaAssets
      .filter((asset) => isVoiceMediaAsset(asset))
      .flatMap((asset) => collectMediaAssetAudioObjectKeys(asset)),
  );
  const entries: Stage4B4AudioOrphanEntry[] = [];

  if (storage.objects) {
    for (const objectKey of storage.objects.keys()) {
      if (!knownKeys.has(objectKey)) {
        entries.push({ kind: "object_without_row", objectKey });
      }
    }
  }

  for (const asset of state.mediaAssets.filter((item) => isVoiceMediaAsset(item))) {
    if (TERMINAL_ASSET_STATUSES.has(asset.status) || asset.deletedAt) {
      continue;
    }
    for (const objectKey of collectMediaAssetAudioObjectKeys(asset)) {
      if (storage.objects && !storage.objects.has(objectKey)) {
        entries.push({
          kind: "row_without_object",
          objectKey,
          assetId: asset.id,
          tenantId: asset.tenantId,
        });
      }
    }
  }

  return {
    version: STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
    generatedAt: new Date().toISOString(),
    orphanCount: entries.length,
    entries,
  };
}

export function buildStage4B4AudioOperationalHealth(
  state: ManuAppState,
  orphanReport?: Stage4B4AudioOrphanReport,
): Stage4B4AudioOperationalHealth {
  const now = new Date().toISOString();
  const voiceAssets = state.mediaAssets.filter((asset) => isVoiceMediaAsset(asset));
  const pendingExpiryCount = voiceAssets.filter((asset) => isAudioAssetDueForExpiry(asset, now)).length;
  const expiredVoiceAssetCount = voiceAssets.filter((asset) => asset.status === "expired").length;
  const revokedVoiceAssetCount = voiceAssets.filter((asset) => asset.status === "revoked").length;
  const pendingTranscriptionEvidenceCount = state.audioTranscriptionRecords.filter(
    (record) =>
      record.retrievalEligible !== false &&
      (record.observation?.segments.length ?? 0) > 0 &&
      !TERMINAL_ASSET_STATUSES.has(
        state.mediaAssets.find((asset) => asset.id === record.mediaAssetId)?.status ?? "admitted",
      ),
  ).length;
  const orphanObjectCount =
    orphanReport?.entries.filter((entry) => entry.kind === "object_without_row").length ?? 0;
  const orphanRowCount =
    orphanReport?.entries.filter((entry) => entry.kind === "row_without_object").length ?? 0;
  const failedDeletionCount = voiceAssets.filter((asset) => asset.failureCode === "object_delete_failed").length;

  const blocked = failedDeletionCount > 0;
  const degraded =
    !blocked && (orphanObjectCount > 0 || orphanRowCount > 0 || pendingExpiryCount > 0 || pendingTranscriptionEvidenceCount > 0);

  return {
    version: STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
    pendingExpiryCount,
    expiredVoiceAssetCount,
    revokedVoiceAssetCount,
    pendingTranscriptionEvidenceCount,
    orphanObjectCount,
    orphanRowCount,
    failedDeletionCount,
    status: blocked ? "blocked" : degraded ? "degraded" : "healthy",
  };
}

function resolveTranscriptSummaryForExport(
  state: ManuAppState,
  record: AudioTranscriptionRecord,
): string | null {
  const message = state.messages.find((entry) => entry.id === record.messageId);
  if (message && message.body.trim().length > 0 && !message.body.startsWith("[client voice message]")) {
    return message.body;
  }
  if (ACCEPTED_TRANSCRIPTION_STATUSES.has(record.status) && record.observation?.transcriptText.trim()) {
    return record.observation.transcriptText.trim();
  }
  return null;
}

function resolveAuthorizedVoiceStreamUrl(
  asset: MediaAssetRecord | undefined,
  now: string,
): string | null {
  if (!asset || asset.deletedAt || asset.status === "expired" || asset.status === "revoked") {
    return null;
  }
  if (asset.expiresAt && asset.expiresAt <= now) {
    return null;
  }
  if (!["analysis_ready", "deletion_pending"].includes(asset.status)) {
    return null;
  }
  return buildConversationAudioStreamUrl(asset.conversationId, asset.id);
}

export function buildStage4B4VoiceCorrectionExport(
  state: ManuAppState,
  clientId: string,
): Stage4B4VoiceCorrectionExportEntry[] {
  return state.audioTranscriptCorrections
    .filter((correction) => correction.clientId === clientId)
    .map((correction) => ({
      correctionId: correction.id,
      transcriptionId: correction.transcriptionId,
      targetMessageId: correction.targetMessageId,
      status: correction.status,
      createdAt: correction.createdAt,
    }));
}

export function buildStage4B4VoiceTranscriptExport(
  state: ManuAppState,
  clientId: string,
  now: string = new Date().toISOString(),
): Stage4B4VoiceTranscriptExportEntry[] {
  const voiceAssetIds = new Set(
    state.mediaAssets.filter((asset) => asset.clientId === clientId && isVoiceMediaAsset(asset)).map((asset) => asset.id),
  );

  return state.audioTranscriptionRecords
    .filter((record) => record.clientId === clientId && voiceAssetIds.has(record.mediaAssetId))
    .map((record) => {
      const asset = state.mediaAssets.find((entry) => entry.id === record.mediaAssetId);
      const correctionCount = state.audioTranscriptCorrections.filter(
        (correction) => correction.transcriptionId === record.id,
      ).length;
      return {
        transcriptionId: record.id,
        messageId: record.messageId,
        conversationId: record.conversationId,
        mediaAssetId: record.mediaAssetId,
        status: record.status,
        transcriptionRevision: record.transcriptionRevision,
        transcriptSummary: resolveTranscriptSummaryForExport(state, record),
        locale: record.locale,
        correctionCount,
        storedAt: asset?.storedAt ?? null,
        expiresAt: asset?.expiresAt ?? null,
        deletedAt: asset?.deletedAt ?? null,
        authorizedStreamUrl: resolveAuthorizedVoiceStreamUrl(asset, now),
      };
    });
}

export function buildStage4B4VoiceDsarExportPackage(
  state: ManuAppState,
  clientId: string,
  now: string = new Date().toISOString(),
): Stage4B4VoiceDsarExportPackage {
  return {
    version: STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
    retentionDays: STAGE_4B4_MEDIA_RETENTION_DAYS,
    transcripts: buildStage4B4VoiceTranscriptExport(state, clientId, now),
    corrections: buildStage4B4VoiceCorrectionExport(state, clientId),
  };
}

export function serializeStage4B4VoiceTranscriptExport(state: ManuAppState, clientId: string): string {
  return JSON.stringify(buildStage4B4VoiceDsarExportPackage(state, clientId), null, 2);
}

export function detectStage4B4VoiceTranscriptExportLeaks(payload: unknown): { passed: boolean; failures: string[] } {
  const serialized = JSON.stringify(payload);
  const failures = EXPORT_LEAK_MARKERS.filter((marker) => serialized.includes(marker));
  return { passed: failures.length === 0, failures: [...failures] };
}

export function evaluateStage4B4AudioRedactionInvariants(
  state: ManuAppState,
  clientId: string,
  storage: Stage4B4AudioStoragePort & { objects?: Map<string, unknown> } = getFallbackStage4B4AudioStorage(),
): Stage4B4AudioRedactionInvariantResult {
  const blockingReasons: string[] = [];
  const clientVoiceAssets = state.mediaAssets.filter((asset) => asset.clientId === clientId && isVoiceMediaAsset(asset));

  if (clientVoiceAssets.some((asset) => collectMediaAssetAudioObjectKeys(asset).length > 0)) {
    blockingReasons.push("audio object keys must be cleared");
  }

  if (clientVoiceAssets.some((asset) => asset.providerMediaId)) {
    blockingReasons.push("provider media ids must be cleared");
  }

  if (clientVoiceAssets.some((asset) => !TERMINAL_ASSET_STATUSES.has(asset.status) || !asset.deletedAt)) {
    blockingReasons.push("voice media assets must be expired or revoked with deletedAt");
  }

  if (
    state.audioTranscriptionRecords
      .filter((record) => record.clientId === clientId)
      .some((record) => (record.observation?.segments.length ?? 0) > 0)
  ) {
    blockingReasons.push("audio transcription provider segments must be redacted");
  }

  if (
    state.audioTranscriptionRecords
      .filter((record) => record.clientId === clientId)
      .some((record) => typeof record.observation?.overallConfidence === "number" && record.observation.overallConfidence > 0)
  ) {
    blockingReasons.push("audio transcription confidence must be redacted");
  }

  if (
    state.audioTranscriptCorrections
      .filter((correction) => correction.clientId === clientId)
      .some(
        (correction) =>
          correction.explanation !== PHASE_74_REDACTION_MARKER ||
          correction.correctedTranscript !== PHASE_74_REDACTION_MARKER,
      )
  ) {
    blockingReasons.push("audio transcript corrections must be redacted");
  }

  if (storage.objects) {
    for (const asset of clientVoiceAssets) {
      for (const objectKey of collectMediaAssetAudioObjectKeys(asset)) {
        if (storage.objects.has(objectKey)) {
          blockingReasons.push("client audio objects must be deleted from storage");
          break;
        }
      }
    }
  }

  return { passed: blockingReasons.length === 0, blockingReasons };
}

export function finalizeExpiredVoiceAsset(asset: MediaAssetRecord, now: string): MediaAssetRecord {
  return {
    ...finalizeExpiredMediaAsset(asset, now),
    sanitizedAudioObjectKey: null,
  };
}

export function finalizeRevokedVoiceAsset(asset: MediaAssetRecord, now: string): MediaAssetRecord {
  return {
    ...finalizeRevokedMediaAsset(asset, now),
    sanitizedAudioObjectKey: null,
  };
}

export type { AudioPendingObjectKeyRecord };
