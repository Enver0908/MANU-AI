import {
  buildTranscriptionLineageFieldsFromObservation,
  createPendingTranscriptionLineageDefaults,
  parseAudioTranscriptionObservationV1,
  resolveTranscriptionOriginFromObservation,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionOrigin,
  type AudioTranscriptionQualityDecision,
  type AudioTranscriptionRecord,
  type AudioTranscriptCorrectionRecord,
  type AudioTranscriptionStatus,
  type AudioSpeakerState,
  type AudioTranscriptCorrectionReasonCode,
  type AudioTranscriptCorrectionStatus,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";

export type DbAudioTranscriptionRecord = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  message_id: string;
  media_asset_id: string;
  bundle_id: string | null;
  transcription_revision: number;
  status: AudioTranscriptionStatus;
  locale: Stage4B4SupportedLocale;
  observation: AudioTranscriptionObservationV1 | null;
  quality_decision: AudioTranscriptionQualityDecision | null;
  rejection_reasons: string[];
  source_modality: "voice_transcript";
  provider_mode: "mock";
  retrieval_eligible: boolean;
  evidence_expires_at: string | null;
  origin: AudioTranscriptionOrigin | null;
  transcript_text: string | null;
  detected_locale: Stage4B4SupportedLocale | null;
  overall_confidence: number | null;
  minimum_segment_confidence: number | null;
  uncertain_span_count: number | null;
  segment_count: number | null;
  speaker_state: AudioSpeakerState | null;
  supersedes_transcription_id: string | null;
  superseded_by_transcription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAudioTranscriptCorrection = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  transcription_id: string;
  source_transcription_id: string | null;
  corrected_transcription_id: string | null;
  target_message_id: string | null;
  superseded_decision_id: string | null;
  rerun_decision_id: string | null;
  dietitian_id: string;
  status: AudioTranscriptCorrectionStatus;
  reason_code: AudioTranscriptCorrectionReasonCode;
  explanation: string;
  corrected_transcript: string;
  conversation_revision_at_submit: number;
  transcription_revision_at_submit: number;
  result_action: AudioTranscriptCorrectionRecord["resultAction"];
  created_at: string;
  updated_at: string;
};

function parseObservation(value: unknown): AudioTranscriptionObservationV1 | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  try {
    return parseAudioTranscriptionObservationV1(value);
  } catch {
    return null;
  }
}

function parseQualityDecision(value: unknown): AudioTranscriptionQualityDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.accepted !== "boolean" || !Array.isArray(record.reasonCodes)) {
    return null;
  }
  return {
    accepted: record.accepted,
    reasonCodes: record.reasonCodes.filter((entry): entry is AudioTranscriptionQualityDecision["reasonCodes"][number] => typeof entry === "string"),
  };
}

function resolveLineageFields(
  row: DbAudioTranscriptionRecord,
  observation: AudioTranscriptionObservationV1 | null,
): Pick<
  AudioTranscriptionRecord,
  | "origin"
  | "transcriptText"
  | "detectedLocale"
  | "overallConfidence"
  | "minimumSegmentConfidence"
  | "uncertainSpanCount"
  | "segmentCount"
  | "speakerState"
  | "supersedesTranscriptionId"
  | "supersededByTranscriptionId"
> {
  if (
    row.origin != null ||
    row.transcript_text != null ||
    row.detected_locale != null ||
    row.overall_confidence != null ||
    row.minimum_segment_confidence != null ||
    row.uncertain_span_count != null ||
    row.segment_count != null ||
    row.speaker_state != null ||
    row.supersedes_transcription_id != null ||
    row.superseded_by_transcription_id != null
  ) {
    return {
      origin: row.origin,
      transcriptText: row.transcript_text,
      detectedLocale: row.detected_locale,
      overallConfidence: row.overall_confidence,
      minimumSegmentConfidence: row.minimum_segment_confidence,
      uncertainSpanCount: row.uncertain_span_count,
      segmentCount: row.segment_count,
      speakerState: row.speaker_state,
      supersedesTranscriptionId: row.supersedes_transcription_id,
      supersededByTranscriptionId: row.superseded_by_transcription_id,
    };
  }

  if (!observation) {
    return createPendingTranscriptionLineageDefaults();
  }

  return buildTranscriptionLineageFieldsFromObservation({
    observation,
    origin: resolveTranscriptionOriginFromObservation(observation),
    supersedesTranscriptionId: row.supersedes_transcription_id,
    supersededByTranscriptionId: row.superseded_by_transcription_id,
  });
}

export function mapAudioTranscriptionRecord(row: DbAudioTranscriptionRecord): AudioTranscriptionRecord {
  const observation = parseObservation(row.observation);
  const lineage = resolveLineageFields(row, observation);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    mediaAssetId: row.media_asset_id,
    bundleId: row.bundle_id,
    transcriptionRevision: row.transcription_revision,
    status: row.status,
    locale: row.locale,
    observation,
    qualityDecision: parseQualityDecision(row.quality_decision),
    rejectionReasons: row.rejection_reasons.filter((entry): entry is AudioTranscriptionRecord["rejectionReasons"][number] => typeof entry === "string"),
    sourceModality: "voice_transcript",
    providerMode: "mock",
    retrievalEligible: row.retrieval_eligible,
    evidenceExpiresAt: row.evidence_expires_at,
    ...lineage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAudioTranscriptCorrection(row: DbAudioTranscriptCorrection): AudioTranscriptCorrectionRecord {
  const sourceTranscriptionId = row.source_transcription_id ?? row.transcription_id;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    transcriptionId: row.transcription_id,
    sourceTranscriptionId,
    correctedTranscriptionId: row.corrected_transcription_id,
    targetMessageId: row.target_message_id ?? "",
    supersededDecisionId: row.superseded_decision_id,
    rerunDecisionId: row.rerun_decision_id,
    dietitianId: row.dietitian_id,
    status: row.status,
    reasonCode: row.reason_code,
    explanation: row.explanation,
    correctedTranscript: row.corrected_transcript,
    conversationRevisionAtSubmit: row.conversation_revision_at_submit,
    transcriptionRevisionAtSubmit: row.transcription_revision_at_submit,
    resultAction: row.result_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
