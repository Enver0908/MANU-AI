import type { ChannelEventKind, MessageRetrievalEligibility, RiskLevel, SupportedLanguageCode, TenantRole } from "./types";
import type { MediaAssetStatus } from "./phase-85-stage-4b3-media-contracts";

export const PHASE_85_STAGE_4B4_VOICE_CONTRACT_VERSION = "p85-stage-4b4-voice-contracts-v2";
export const STAGE_4B4_DIETITIAN_CORRECTION_PROVIDER_ID = "dietitian-correction";

export const AUDIO_TRANSCRIPTION_ORIGINS = ["mock_provider", "dietitian_correction"] as const;
export type AudioTranscriptionOrigin = (typeof AUDIO_TRANSCRIPTION_ORIGINS)[number];

export const AUDIO_SPEAKER_STATES = ["single_speaker", "multiple_speakers", "unknown"] as const;
export type AudioSpeakerState = (typeof AUDIO_SPEAKER_STATES)[number];
export const AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION = "audio-transcription-observation-v1-v0.1.0";

export const STAGE_4B4_AUDIO_CHANNEL_EVENT_KIND = "client_message_audio" as const satisfies ChannelEventKind;

export const STAGE_4B4_MAX_INPUT_BYTES = 16 * 1024 * 1024;
export const STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS = 300_000;
export const STAGE_4B4_MAX_VOICE_NOTES_PER_BUNDLE = 4;
export const STAGE_4B4_MAX_BUNDLE_VOICE_DURATION_MS = 600_000;
export const STAGE_4B4_MAX_TRANSCRIPT_CODEPOINTS = 4_096;
export const STAGE_4B4_MIN_TRANSCRIPT_CODEPOINTS = 1;
export const STAGE_4B4_MAX_TRANSCRIPT_SEGMENTS = 128;
export const STAGE_4B4_OVERALL_CONFIDENCE_THRESHOLD = 0.95;
export const STAGE_4B4_MIN_SEGMENT_CONFIDENCE_THRESHOLD = 0.9;
export const STAGE_4B4_MEDIA_RETENTION_DAYS = 30;
export const STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ = 16_000;
export const STAGE_4B4_CANONICAL_AUDIO_CHANNELS = 1;
export const STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES = ["audio/ogg", "audio/ogg; codecs=opus"] as const;
export const STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY = "[client voice message]";

export const STAGE_4B4_SUPPORTED_LOCALES = [
  "tr-TR",
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
  "pt-PT",
  "cs-CZ",
] as const;

export type Stage4B4SupportedLocale = (typeof STAGE_4B4_SUPPORTED_LOCALES)[number];

export const COMMUNICATION_LANGUAGE_TO_LOCALE: Record<SupportedLanguageCode, Stage4B4SupportedLocale> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-PT",
  cs: "cs-CZ",
};

export const AUDIO_TRANSCRIPTION_STATUSES = [
  "pending",
  "processing",
  "accepted",
  "rejected",
  "failed",
  "superseded",
  "review_required",
] as const;

export type AudioTranscriptionStatus = (typeof AUDIO_TRANSCRIPTION_STATUSES)[number];

export const AUDIO_ADMISSION_DECISIONS = [
  "admitted",
  "review_required",
  "unsupported_media",
  "missing_identity",
  "group_context",
  "untrusted_forward",
  "duplicate_media",
] as const;

export type AudioAdmissionDecision = (typeof AUDIO_ADMISSION_DECISIONS)[number];

export const AUDIO_INGRESS_SOURCE_AUTHORITIES = [
  "verified_direct",
  "forwarded",
  "group",
  "business_echo",
  "unknown",
] as const;

export type AudioIngressSourceAuthority = (typeof AUDIO_INGRESS_SOURCE_AUTHORITIES)[number];

export const AUDIO_QUALITY_CODES = [
  "overall_confidence_low",
  "segment_confidence_low",
  "uncertain_spans_present",
  "wrong_language",
  "empty_transcript",
  "overlong_transcript",
  "missing_confidence",
  "malformed_observation",
  "provider_disabled",
  "unknown_fixture",
  "segment_overlap",
  "segment_timing_invalid",
  "multiple_speakers_present",
  "unknown_speaker_state",
] as const;

export type AudioQualityCode = (typeof AUDIO_QUALITY_CODES)[number];

export const VOICE_TRANSCRIPT_ELIGIBILITY_VALUES = [
  "eligible",
  "excluded_pending",
  "excluded_rejected",
  "excluded_failed",
  "excluded_superseded",
  "excluded_expired",
  "excluded_review_required",
] as const;

export type VoiceTranscriptEligibility = (typeof VOICE_TRANSCRIPT_ELIGIBILITY_VALUES)[number];

export const AUDIO_TRANSCRIPT_CORRECTION_STATUSES = [
  "submitted",
  "applied_to_pending",
  "manual_follow_up_required",
  "closed",
] as const;

export type AudioTranscriptCorrectionStatus = (typeof AUDIO_TRANSCRIPT_CORRECTION_STATUSES)[number];

export const AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES = [
  "wrong_word",
  "wrong_number",
  "wrong_medication",
  "wrong_language_fragment",
  "incomplete_transcript",
  "other_clinical_mismatch",
] as const;

export type AudioTranscriptCorrectionReasonCode = (typeof AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES)[number];

export const STAGE_4B4_VOICE_RETRIEVAL_EXCLUSIONS = [
  "excluded_voice_pending",
  "excluded_voice_only",
  "excluded_voice_expired",
] as const satisfies readonly MessageRetrievalEligibility[];

export const FORBIDDEN_CLIENT_AUDIO_DTO_KEYS = [
  "objectKey",
  "object_key",
  "sanitizedAudioObjectKey",
  "sanitized_audio_object_key",
  "providerMediaId",
  "provider_media_id",
  "providerMediaIdHash",
  "contentSha256",
  "content_sha256",
  "confidence",
  "overallConfidence",
  "overall_confidence",
  "segmentConfidence",
  "segment_confidence",
  "segments",
  "rawProviderPayload",
  "raw_provider_payload",
  "modelName",
  "model_name",
  "providerId",
  "provider_id",
  "providerVersion",
  "provider_version",
  "observation",
  "qualityDecision",
  "rejectionReasons",
  "canonicalAudioHash",
] as const;

export type AudioTranscriptSegmentV1 = {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  uncertain: boolean;
};

export type AudioTranscriptionObservationV1 = {
  schemaVersion: typeof AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION;
  locale: Stage4B4SupportedLocale;
  transcriptText: string;
  overallConfidence: number;
  segments: AudioTranscriptSegmentV1[];
  uncertainSpanCount: number;
  providerId: string;
  providerVersion: string;
  speakerState?: AudioSpeakerState;
};

export type AudioTranscriptionDerivedMetrics = {
  transcriptText: string;
  detectedLocale: Stage4B4SupportedLocale;
  overallConfidence: number;
  minimumSegmentConfidence: number;
  uncertainSpanCount: number;
  segmentCount: number;
  speakerState: AudioSpeakerState;
};

export type AudioTranscriptionQualityDecision = {
  accepted: boolean;
  reasonCodes: AudioQualityCode[];
};

export type AudioTranscriptionRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  messageId: string;
  mediaAssetId: string;
  bundleId: string | null;
  transcriptionRevision: number;
  status: AudioTranscriptionStatus;
  locale: Stage4B4SupportedLocale;
  observation: AudioTranscriptionObservationV1 | null;
  qualityDecision: AudioTranscriptionQualityDecision | null;
  rejectionReasons: AudioQualityCode[];
  sourceModality: "voice_transcript";
  providerMode: "mock";
  retrievalEligible?: boolean;
  evidenceExpiresAt?: string | null;
  retryCount?: number;
  nextAttemptAt?: string | null;
  failureCode?: string | null;
  origin: AudioTranscriptionOrigin | null;
  transcriptText: string | null;
  detectedLocale: Stage4B4SupportedLocale | null;
  overallConfidence: number | null;
  minimumSegmentConfidence: number | null;
  uncertainSpanCount: number | null;
  segmentCount: number | null;
  speakerState: AudioSpeakerState | null;
  supersedesTranscriptionId: string | null;
  supersededByTranscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AudioTranscriptCorrectionRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  /** @deprecated Use sourceTranscriptionId for new writes. */
  transcriptionId: string;
  sourceTranscriptionId: string;
  correctedTranscriptionId: string | null;
  targetMessageId: string;
  supersededDecisionId: string | null;
  rerunDecisionId: string | null;
  dietitianId: string;
  status: AudioTranscriptCorrectionStatus;
  reasonCode: AudioTranscriptCorrectionReasonCode;
  explanation: string;
  correctedTranscript: string;
  conversationRevisionAtSubmit: number;
  transcriptionRevisionAtSubmit: number;
  resultAction: "supersede_rerun" | "invalidate_pending" | "manual_follow_up" | "closed_without_send";
  createdAt: string;
  updatedAt: string;
};

export type ConversationAudioDto = {
  assetId: string;
  durationMs: number | null;
  streamUrl: string;
  expiresAt: string | null;
  playbackState: "available" | "pending" | "review_required" | "failed" | "expired";
};

export type ConversationVoiceTranscriptDto = {
  transcriptionId: string;
  transcriptionRevision: number;
  status: "pending" | "accepted" | "corrected" | "review_required" | "failed" | "expired";
  transcriptText: string | null;
  correctionAllowed: boolean;
  latestCorrectionId: string | null;
};

export type TranscriptCorrectionRequest = {
  transcriptionId: string;
  requestId: string;
  expectedConversationRevision: number;
  expectedTranscriptionRevision: number;
  reasonCode: AudioTranscriptCorrectionReasonCode;
  explanation: string;
  correctedTranscript: string;
};

export type AudioIngressMetadataInput = {
  messageType: string | null;
  voiceFlag: boolean | null;
  mimeType: string | null;
  providerMediaId: string | null;
  fromIdentity: string | null;
  sourceAuthority?: AudioIngressSourceAuthority;
  isGroupContext: boolean;
  isForwarded: boolean;
  isBusinessEcho: boolean;
  isTrustedDirectClient: boolean;
  byteSize: number | null;
  durationMs: number | null;
  isDuplicateMedia: boolean;
};

export type AudioIngressEvaluation = {
  decision: AudioAdmissionDecision;
  reviewRequired: boolean;
  failureCodes: string[];
  normalizedEventKind: typeof STAGE_4B4_AUDIO_CHANNEL_EVENT_KIND | "client_message_media_unsupported";
};

export type TranscriptCorrectionIdempotencyReplay = {
  correctionId: string;
  resultAction: string;
};

export type Stage4B4VoiceStateSlice = {
  audioTranscriptionRecords: AudioTranscriptionRecord[];
  audioTranscriptCorrections: AudioTranscriptCorrectionRecord[];
  processedTranscriptCorrectionRequestIds: string[];
  transcriptCorrectionReplayByRequestId: Record<string, TranscriptCorrectionIdempotencyReplay>;
  processedTranscriptBridgeKeys: string[];
};

const RISK_RANK: Record<RiskLevel, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

export class Stage4B4VoiceContractError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Stage4B4VoiceContractError";
    this.code = code;
  }
}

export function createEmptyStage4B4VoiceCollections(): Stage4B4VoiceStateSlice {
  return {
    audioTranscriptionRecords: [],
    audioTranscriptCorrections: [],
    processedTranscriptCorrectionRequestIds: [],
    transcriptCorrectionReplayByRequestId: {},
    processedTranscriptBridgeKeys: [],
  };
}

export function isAudioTranscriptionOrigin(value: unknown): value is AudioTranscriptionOrigin {
  return typeof value === "string" && (AUDIO_TRANSCRIPTION_ORIGINS as readonly string[]).includes(value);
}

export function isAudioSpeakerState(value: unknown): value is AudioSpeakerState {
  return typeof value === "string" && (AUDIO_SPEAKER_STATES as readonly string[]).includes(value);
}

export function resolveTranscriptionOriginFromObservation(
  observation: Pick<AudioTranscriptionObservationV1, "providerId">,
): AudioTranscriptionOrigin {
  return observation.providerId === STAGE_4B4_DIETITIAN_CORRECTION_PROVIDER_ID
    ? "dietitian_correction"
    : "mock_provider";
}

export function createPendingTranscriptionLineageDefaults(): Pick<
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
  return {
    origin: null,
    transcriptText: null,
    detectedLocale: null,
    overallConfidence: null,
    minimumSegmentConfidence: null,
    uncertainSpanCount: null,
    segmentCount: null,
    speakerState: null,
    supersedesTranscriptionId: null,
    supersededByTranscriptionId: null,
  };
}

export function computeTranscriptionDerivedMetrics(
  observation: AudioTranscriptionObservationV1,
): AudioTranscriptionDerivedMetrics {
  const segmentConfidences = observation.segments.map((segment) => segment.confidence);
  const minimumSegmentConfidence = Math.min(...segmentConfidences);
  const uncertainSpanCount = observation.segments.filter((segment) => segment.uncertain).length;
  const speakerState = observation.speakerState ?? "single_speaker";

  return {
    transcriptText: observation.transcriptText,
    detectedLocale: observation.locale,
    overallConfidence: minimumSegmentConfidence,
    minimumSegmentConfidence,
    uncertainSpanCount,
    segmentCount: observation.segments.length,
    speakerState,
  };
}

export function buildTranscriptionLineageFieldsFromObservation(input: {
  observation: AudioTranscriptionObservationV1;
  origin?: AudioTranscriptionOrigin;
  supersedesTranscriptionId?: string | null;
  supersededByTranscriptionId?: string | null;
}): Pick<
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
  const metrics = computeTranscriptionDerivedMetrics(input.observation);
  const origin = input.origin ?? resolveTranscriptionOriginFromObservation(input.observation);
  const confidenceFields =
    origin === "dietitian_correction"
      ? {
          overallConfidence: null,
          minimumSegmentConfidence: null,
        }
      : {
          overallConfidence: metrics.overallConfidence,
          minimumSegmentConfidence: metrics.minimumSegmentConfidence,
        };

  return {
    origin,
    transcriptText: metrics.transcriptText,
    detectedLocale: metrics.detectedLocale,
    ...confidenceFields,
    uncertainSpanCount: metrics.uncertainSpanCount,
    segmentCount: metrics.segmentCount,
    speakerState: metrics.speakerState,
    supersedesTranscriptionId: input.supersedesTranscriptionId ?? null,
    supersededByTranscriptionId: input.supersededByTranscriptionId ?? null,
  };
}

export function isAudioTranscriptionStatus(value: unknown): value is AudioTranscriptionStatus {
  return typeof value === "string" && (AUDIO_TRANSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function isAudioQualityCode(value: unknown): value is AudioQualityCode {
  return typeof value === "string" && (AUDIO_QUALITY_CODES as readonly string[]).includes(value);
}

export function isStage4B4SupportedLocale(value: unknown): value is Stage4B4SupportedLocale {
  return typeof value === "string" && (STAGE_4B4_SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isUnitConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function mapCommunicationLanguageToLocale(language: SupportedLanguageCode): Stage4B4SupportedLocale {
  return COMMUNICATION_LANGUAGE_TO_LOCALE[language];
}

export function countUnicodeCodepoints(value: string): number {
  return [...value].length;
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Stage4B4VoiceContractError(`${label}_must_be_object`);
  }
  return value as Record<string, unknown>;
}

function assertNoUnknownKeys(record: Record<string, unknown>, allowedKeys: readonly string[], label: string) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      throw new Stage4B4VoiceContractError(`${label}_unknown_key:${key}`);
    }
  }
}

function parseSegments(value: unknown): AudioTranscriptSegmentV1[] {
  if (!Array.isArray(value)) {
    throw new Stage4B4VoiceContractError("segments_must_be_array");
  }
  if (value.length < 1) {
    throw new Stage4B4VoiceContractError("segments_required");
  }
  if (value.length > STAGE_4B4_MAX_TRANSCRIPT_SEGMENTS) {
    throw new Stage4B4VoiceContractError("segments_limit_exceeded");
  }

  const segments: AudioTranscriptSegmentV1[] = [];
  let previousEndMs = -1;

  for (let index = 0; index < value.length; index += 1) {
    const record = assertPlainObject(value[index], `segment_${index}`);
    assertNoUnknownKeys(record, ["startMs", "endMs", "text", "confidence", "uncertain"], `segment_${index}`);

    if (typeof record.startMs !== "number" || !Number.isFinite(record.startMs) || record.startMs < 0) {
      throw new Stage4B4VoiceContractError(`segment_${index}_start_ms_invalid`);
    }
    if (typeof record.endMs !== "number" || !Number.isFinite(record.endMs) || record.endMs < record.startMs) {
      throw new Stage4B4VoiceContractError(`segment_${index}_end_ms_invalid`);
    }
    if (record.startMs < previousEndMs) {
      throw new Stage4B4VoiceContractError(`segment_${index}_overlap`);
    }
    if (typeof record.text !== "string") {
      throw new Stage4B4VoiceContractError(`segment_${index}_text_required`);
    }
    if (countUnicodeCodepoints(record.text.trim()) < 1) {
      throw new Stage4B4VoiceContractError(`segment_${index}_text_empty`);
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new Stage4B4VoiceContractError(`segment_${index}_confidence_invalid`);
    }
    if (typeof record.uncertain !== "boolean") {
      throw new Stage4B4VoiceContractError(`segment_${index}_uncertain_invalid`);
    }

    previousEndMs = record.endMs;
    segments.push({
      startMs: record.startMs,
      endMs: record.endMs,
      text: record.text,
      confidence: record.confidence,
      uncertain: record.uncertain,
    });
  }

  return segments;
}

export function parseAudioTranscriptionObservationV1(input: unknown): AudioTranscriptionObservationV1 {
  const record = assertPlainObject(input, "audio_transcription_observation");
  assertNoUnknownKeys(
    record,
    [
      "schemaVersion",
      "locale",
      "transcriptText",
      "overallConfidence",
      "segments",
      "uncertainSpanCount",
      "providerId",
      "providerVersion",
      "speakerState",
    ],
    "audio_transcription_observation",
  );

  if (record.schemaVersion !== AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_schema_version_invalid");
  }
  if (!isStage4B4SupportedLocale(record.locale)) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_locale_invalid");
  }
  if (typeof record.transcriptText !== "string") {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_transcript_text_required");
  }
  if (!isUnitConfidence(record.overallConfidence)) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_overall_confidence_invalid");
  }
  if (typeof record.uncertainSpanCount !== "number" || !Number.isInteger(record.uncertainSpanCount) || record.uncertainSpanCount < 0) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_uncertain_span_count_invalid");
  }
  if (typeof record.providerId !== "string" || !record.providerId.trim()) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_provider_id_required");
  }
  if (typeof record.providerVersion !== "string" || !record.providerVersion.trim()) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_provider_version_required");
  }

  const segments = parseSegments(record.segments);
  const speakerState =
    record.speakerState === undefined
      ? "single_speaker"
      : isAudioSpeakerState(record.speakerState)
        ? record.speakerState
        : (() => {
            throw new Stage4B4VoiceContractError("audio_transcription_observation_speaker_state_invalid");
          })();
  const codepointCount = countUnicodeCodepoints(record.transcriptText);
  if (codepointCount > STAGE_4B4_MAX_TRANSCRIPT_CODEPOINTS) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_transcript_overlong");
  }

  const derivedUncertainSpanCount = segments.filter((segment) => segment.uncertain).length;
  if (record.uncertainSpanCount !== derivedUncertainSpanCount) {
    throw new Stage4B4VoiceContractError("audio_transcription_observation_uncertain_span_count_mismatch");
  }

  return {
    schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
    locale: record.locale,
    transcriptText: record.transcriptText,
    overallConfidence: record.overallConfidence,
    segments,
    uncertainSpanCount: derivedUncertainSpanCount,
    providerId: record.providerId,
    providerVersion: record.providerVersion,
    speakerState,
  };
}

export function evaluateTranscriptQualityGate(input: {
  observation: AudioTranscriptionObservationV1;
  expectedLocale: Stage4B4SupportedLocale;
}): AudioTranscriptionQualityDecision {
  const reasonCodes: AudioQualityCode[] = [];
  const { observation, expectedLocale } = input;
  const metrics = computeTranscriptionDerivedMetrics(observation);
  const codepointCount = countUnicodeCodepoints(observation.transcriptText.trim());

  if (codepointCount < STAGE_4B4_MIN_TRANSCRIPT_CODEPOINTS) {
    reasonCodes.push("empty_transcript");
  }
  if (countUnicodeCodepoints(observation.transcriptText) > STAGE_4B4_MAX_TRANSCRIPT_CODEPOINTS) {
    reasonCodes.push("overlong_transcript");
  }
  if (metrics.detectedLocale !== expectedLocale) {
    reasonCodes.push("wrong_language");
  }
  if (!isUnitConfidence(metrics.overallConfidence)) {
    reasonCodes.push("missing_confidence");
  } else if (metrics.overallConfidence < STAGE_4B4_OVERALL_CONFIDENCE_THRESHOLD) {
    reasonCodes.push("overall_confidence_low");
  }

  for (const segment of observation.segments) {
    if (!isUnitConfidence(segment.confidence)) {
      reasonCodes.push("missing_confidence");
      break;
    }
    if (segment.confidence < STAGE_4B4_MIN_SEGMENT_CONFIDENCE_THRESHOLD) {
      reasonCodes.push("segment_confidence_low");
      break;
    }
    if (segment.uncertain) {
      reasonCodes.push("uncertain_spans_present");
      break;
    }
  }

  if (metrics.uncertainSpanCount > 0) {
    reasonCodes.push("uncertain_spans_present");
  }

  if (metrics.speakerState === "multiple_speakers") {
    reasonCodes.push("multiple_speakers_present");
  } else if (metrics.speakerState === "unknown") {
    reasonCodes.push("unknown_speaker_state");
  }

  return {
    accepted: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function isSupportedVoiceMimeType(mimeType: string | null): boolean {
  if (!mimeType) {
    return false;
  }
  const normalized = mimeType.trim().toLowerCase();
  return STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES.some((candidate) => normalized === candidate.toLowerCase());
}

function resolveEffectiveSourceAuthority(input: AudioIngressMetadataInput): AudioIngressSourceAuthority {
  if (input.sourceAuthority) {
    return input.sourceAuthority;
  }
  if (input.isBusinessEcho) {
    return "business_echo";
  }
  if (input.isGroupContext) {
    return "group";
  }
  if (input.isForwarded || !input.isTrustedDirectClient) {
    return "forwarded";
  }
  return "verified_direct";
}

export function evaluateAudioIngressMetadata(input: AudioIngressMetadataInput): AudioIngressEvaluation {
  const failureCodes: string[] = [];
  const sourceAuthority = resolveEffectiveSourceAuthority(input);

  if (sourceAuthority === "business_echo") {
    return {
      decision: "unsupported_media",
      reviewRequired: true,
      failureCodes: ["business_human_voice_out_of_scope"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (input.messageType !== "audio") {
    return {
      decision: "unsupported_media",
      reviewRequired: true,
      failureCodes: ["message_type_not_audio"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (input.voiceFlag !== true) {
    return {
      decision: "unsupported_media",
      reviewRequired: true,
      failureCodes: ["audio_not_voice_note"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (!isSupportedVoiceMimeType(input.mimeType)) {
    failureCodes.push("unsupported_mime_type");
  }

  if (sourceAuthority === "group") {
    return {
      decision: "group_context",
      reviewRequired: true,
      failureCodes: [...failureCodes, "group_voice_out_of_scope"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (sourceAuthority === "forwarded") {
    return {
      decision: "untrusted_forward",
      reviewRequired: true,
      failureCodes: [...failureCodes, "forwarded_or_untrusted_voice"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (sourceAuthority === "unknown") {
    return {
      decision: "review_required",
      reviewRequired: true,
      failureCodes: [...failureCodes, "unknown_source_authority"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (!input.fromIdentity) {
    return {
      decision: "missing_identity",
      reviewRequired: true,
      failureCodes: [...failureCodes, "missing_sender_identity"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (!input.providerMediaId) {
    return {
      decision: "review_required",
      reviewRequired: true,
      failureCodes: [...failureCodes, "missing_provider_media_id"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (input.isDuplicateMedia) {
    return {
      decision: "duplicate_media",
      reviewRequired: true,
      failureCodes: [...failureCodes, "duplicate_provider_media"],
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  if (input.byteSize !== null && input.byteSize > STAGE_4B4_MAX_INPUT_BYTES) {
    failureCodes.push("input_size_exceeded");
  }

  if (input.durationMs === null) {
    failureCodes.push("duration_unknown");
  } else if (input.durationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS) {
    failureCodes.push("duration_exceeded");
  }

  if (failureCodes.length > 0) {
    return {
      decision: "review_required",
      reviewRequired: true,
      failureCodes,
      normalizedEventKind: "client_message_media_unsupported",
    };
  }

  return {
    decision: "admitted",
    reviewRequired: false,
    failureCodes: [],
    normalizedEventKind: STAGE_4B4_AUDIO_CHANNEL_EVENT_KIND,
  };
}

export function resolveVoiceTranscriptEligibility(input: {
  transcriptionStatus: AudioTranscriptionStatus | null;
  assetStatus: MediaAssetStatus | null;
}): VoiceTranscriptEligibility {
  if (input.assetStatus === "expired" || input.assetStatus === "revoked") {
    return "excluded_expired";
  }
  switch (input.transcriptionStatus) {
    case "accepted":
      return "eligible";
    case "pending":
    case "processing":
      return "excluded_pending";
    case "rejected":
    case "review_required":
      return "excluded_review_required";
    case "failed":
      return "excluded_failed";
    case "superseded":
      return "excluded_superseded";
    default:
      return "excluded_pending";
  }
}

export function mergeVoiceRiskOverlay(baseRisk: RiskLevel, transcriptRisk: RiskLevel): RiskLevel {
  return RISK_RANK[transcriptRisk] > RISK_RANK[baseRisk] ? transcriptRisk : baseRisk;
}

export function resolveConversationAudioPlaybackState(input: {
  assetStatus: MediaAssetStatus;
  transcriptionStatus: AudioTranscriptionStatus | null;
}): ConversationAudioDto["playbackState"] {
  if (input.assetStatus === "expired" || input.assetStatus === "revoked") {
    return "expired";
  }
  if (input.assetStatus === "failed") {
    return "failed";
  }
  if (input.transcriptionStatus === "review_required" || input.transcriptionStatus === "rejected") {
    return "review_required";
  }
  if (
    input.assetStatus === "download_pending" ||
    input.assetStatus === "analysis_pending" ||
    input.transcriptionStatus === "pending" ||
    input.transcriptionStatus === "processing"
  ) {
    return "pending";
  }
  return "available";
}

export function buildConversationAudioDto(input: {
  assetId: string;
  durationMs: number | null;
  streamUrl: string;
  expiresAt: string | null;
  assetStatus: MediaAssetStatus;
  transcriptionStatus: AudioTranscriptionStatus | null;
}): ConversationAudioDto {
  return {
    assetId: input.assetId,
    durationMs: input.durationMs,
    streamUrl: input.streamUrl,
    expiresAt: input.expiresAt,
    playbackState: resolveConversationAudioPlaybackState({
      assetStatus: input.assetStatus,
      transcriptionStatus: input.transcriptionStatus,
    }),
  };
}

export function canAccessVoiceTranscriptCorrection(role: TenantRole): boolean {
  return role === "owner" || role === "admin" || role === "dietitian";
}

export function buildConversationVoiceTranscriptDto(input: {
  role: TenantRole;
  transcription: Pick<
    AudioTranscriptionRecord,
    "id" | "status" | "observation" | "qualityDecision" | "transcriptionRevision" | "transcriptText"
  >;
  latestCorrectionId: string | null;
  correctedTranscript?: string | null;
}): ConversationVoiceTranscriptDto | null {
  if (!canAccessVoiceTranscriptCorrection(input.role) && input.transcription.status !== "accepted") {
    return null;
  }

  const accepted = input.transcription.status === "accepted" && input.transcription.qualityDecision?.accepted === true;
  const corrected = Boolean(input.correctedTranscript);
  const transcriptText =
    corrected && input.correctedTranscript
      ? input.correctedTranscript
      : accepted
        ? input.transcription.transcriptText ??
          input.transcription.observation?.transcriptText ??
          null
        : null;

  let status: ConversationVoiceTranscriptDto["status"] = "pending";
  if (corrected) {
    status = "corrected";
  } else if (accepted) {
    status = "accepted";
  } else if (input.transcription.status === "review_required" || input.transcription.status === "rejected") {
    status = "review_required";
  } else if (input.transcription.status === "failed") {
    status = "failed";
  } else if (input.transcription.status === "superseded") {
    status = "expired";
  }

  return {
    transcriptionId: input.transcription.id,
    transcriptionRevision: input.transcription.transcriptionRevision,
    status,
    transcriptText,
    correctionAllowed: canAccessVoiceTranscriptCorrection(input.role) && (accepted || corrected),
    latestCorrectionId: input.latestCorrectionId,
  };
}

export function assertClientSafeAudioPayload(value: unknown, label = "client_audio_payload"): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertClientSafeAudioPayload(entry, label);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_CLIENT_AUDIO_DTO_KEYS as readonly string[]).includes(key)) {
      throw new Stage4B4VoiceContractError(`${label}_forbidden_key:${key}`);
    }
    assertClientSafeAudioPayload(record[key], `${label}.${key}`);
  }
}

export function assertAudioTranscriptionStatusExhaustive(status: AudioTranscriptionStatus): AudioTranscriptionStatus {
  switch (status) {
    case "pending":
    case "processing":
    case "accepted":
    case "rejected":
    case "failed":
    case "superseded":
    case "review_required":
      return status;
    default:
      throw new Stage4B4VoiceContractError(`unsupported_transcription_status:${String(status)}`);
  }
}
