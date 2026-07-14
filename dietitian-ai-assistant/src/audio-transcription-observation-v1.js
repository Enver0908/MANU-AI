export const AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION = "audio-transcription-observation-v1-v0.1.0";

export const STAGE_4B4_SUPPORTED_LOCALES = [
  "tr-TR",
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
  "pt-PT",
  "cs-CZ",
];

export const MAX_TRANSCRIPT_SEGMENTS = 128;
export const MAX_TRANSCRIPT_CODEPOINTS = 4096;
export const OVERALL_CONFIDENCE_THRESHOLD = 0.95;
export const MIN_SEGMENT_CONFIDENCE_THRESHOLD = 0.9;

const ALLOWED_OBSERVATION_KEYS = new Set([
  "schemaVersion",
  "locale",
  "transcriptText",
  "overallConfidence",
  "segments",
  "uncertainSpanCount",
  "providerId",
  "providerVersion",
]);

export class AudioTranscriptionObservationValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = "AudioTranscriptionObservationValidationError";
    this.code = code;
  }
}

export function isStage4B4SupportedLocale(value) {
  return typeof value === "string" && STAGE_4B4_SUPPORTED_LOCALES.includes(value);
}

export function isUnitConfidence(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function countUnicodeCodepoints(value) {
  return [...value].length;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AudioTranscriptionObservationValidationError(`${label}_must_be_object`);
  }
  return value;
}

function assertNoUnknownKeys(record, allowedKeys, label) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new AudioTranscriptionObservationValidationError(`${label}_unknown_key:${key}`);
    }
  }
}

function parseSegments(value) {
  if (!Array.isArray(value)) {
    throw new AudioTranscriptionObservationValidationError("segments_must_be_array");
  }
  if (value.length > MAX_TRANSCRIPT_SEGMENTS) {
    throw new AudioTranscriptionObservationValidationError("segments_limit_exceeded");
  }

  const segments = [];
  let previousEndMs = -1;

  for (let index = 0; index < value.length; index += 1) {
    const record = assertPlainObject(value[index], `segment_${index}`);
    assertNoUnknownKeys(record, new Set(["startMs", "endMs", "text", "confidence", "uncertain"]), `segment_${index}`);

    if (typeof record.startMs !== "number" || !Number.isFinite(record.startMs) || record.startMs < 0) {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_start_ms_invalid`);
    }
    if (typeof record.endMs !== "number" || !Number.isFinite(record.endMs) || record.endMs < record.startMs) {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_end_ms_invalid`);
    }
    if (record.startMs < previousEndMs) {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_overlap`);
    }
    if (typeof record.text !== "string") {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_text_required`);
    }
    if (!isUnitConfidence(record.confidence)) {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_confidence_invalid`);
    }
    if (typeof record.uncertain !== "boolean") {
      throw new AudioTranscriptionObservationValidationError(`segment_${index}_uncertain_invalid`);
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

export function validateAudioTranscriptionObservationV1(input) {
  const record = assertPlainObject(input, "audio_transcription_observation");
  assertNoUnknownKeys(record, ALLOWED_OBSERVATION_KEYS, "audio_transcription_observation");

  if (record.schemaVersion !== AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_schema_version_invalid");
  }
  if (!isStage4B4SupportedLocale(record.locale)) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_locale_invalid");
  }
  if (typeof record.transcriptText !== "string") {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_transcript_text_required");
  }
  if (!isUnitConfidence(record.overallConfidence)) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_overall_confidence_invalid");
  }
  if (
    typeof record.uncertainSpanCount !== "number" ||
    !Number.isInteger(record.uncertainSpanCount) ||
    record.uncertainSpanCount < 0
  ) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_uncertain_span_count_invalid");
  }
  if (typeof record.providerId !== "string" || !record.providerId.trim()) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_provider_id_required");
  }
  if (typeof record.providerVersion !== "string" || !record.providerVersion.trim()) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_provider_version_required");
  }

  const segments = parseSegments(record.segments);
  if (countUnicodeCodepoints(record.transcriptText) > MAX_TRANSCRIPT_CODEPOINTS) {
    throw new AudioTranscriptionObservationValidationError("audio_transcription_observation_transcript_overlong");
  }

  return {
    schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_V1_VERSION,
    locale: record.locale,
    transcriptText: record.transcriptText,
    overallConfidence: record.overallConfidence,
    segments,
    uncertainSpanCount: record.uncertainSpanCount,
    providerId: record.providerId,
    providerVersion: record.providerVersion,
  };
}

export function evaluateTranscriptQualityGate(input) {
  const reasonCodes = [];
  const { observation, expectedLocale } = input;
  const codepointCount = countUnicodeCodepoints(observation.transcriptText);

  if (codepointCount < 1) {
    reasonCodes.push("empty_transcript");
  }
  if (codepointCount > MAX_TRANSCRIPT_CODEPOINTS) {
    reasonCodes.push("overlong_transcript");
  }
  if (observation.locale !== expectedLocale) {
    reasonCodes.push("wrong_language");
  }
  if (!isUnitConfidence(observation.overallConfidence)) {
    reasonCodes.push("missing_confidence");
  } else if (observation.overallConfidence < OVERALL_CONFIDENCE_THRESHOLD) {
    reasonCodes.push("overall_confidence_low");
  }

  for (const segment of observation.segments) {
    if (!isUnitConfidence(segment.confidence)) {
      reasonCodes.push("missing_confidence");
      break;
    }
    if (segment.confidence < MIN_SEGMENT_CONFIDENCE_THRESHOLD) {
      reasonCodes.push("segment_confidence_low");
      break;
    }
    if (segment.uncertain) {
      reasonCodes.push("uncertain_spans_present");
      break;
    }
  }

  if (observation.uncertainSpanCount > 0) {
    reasonCodes.push("uncertain_spans_present");
  }

  return {
    accepted: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function mergeVoiceRiskOverlay(baseRisk, transcriptRisk) {
  const rank = { green: 0, yellow: 1, red: 2 };
  return rank[transcriptRisk] > rank[baseRisk] ? transcriptRisk : baseRisk;
}
