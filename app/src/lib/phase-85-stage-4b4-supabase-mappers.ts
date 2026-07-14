import {
  parseAudioTranscriptionObservationV1,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionQualityDecision,
  type AudioTranscriptionRecord,
  type AudioTranscriptCorrectionRecord,
  type AudioTranscriptionStatus,
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
  created_at: string;
  updated_at: string;
};

export type DbAudioTranscriptCorrection = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  transcription_id: string;
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

export function mapAudioTranscriptionRecord(row: DbAudioTranscriptionRecord): AudioTranscriptionRecord {
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
    observation: parseObservation(row.observation),
    qualityDecision: parseQualityDecision(row.quality_decision),
    rejectionReasons: row.rejection_reasons.filter((entry): entry is AudioTranscriptionRecord["rejectionReasons"][number] => typeof entry === "string"),
    sourceModality: "voice_transcript",
    providerMode: "mock",
    retrievalEligible: row.retrieval_eligible,
    evidenceExpiresAt: row.evidence_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAudioTranscriptCorrection(row: DbAudioTranscriptCorrection): AudioTranscriptCorrectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    transcriptionId: row.transcription_id,
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
