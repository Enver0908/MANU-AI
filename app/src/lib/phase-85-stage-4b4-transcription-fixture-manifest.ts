import {
  AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
  type AudioTranscriptionObservationV1,
  type Stage4B4SupportedLocale,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_MOCK_TRANSCRIPTION_PROVIDER_ID = "mock-local-stt";
export const STAGE_4B4_MOCK_TRANSCRIPTION_PROVIDER_VERSION = "mock-v1";

export const STAGE_4B4_TRANSCRIPTION_FIXTURE_SCENE_IDS = [
  "meal_update_tr",
  "low_confidence_tr",
  "wrong_language_tr",
  "empty_transcript",
  "uncertain_span_tr",
  "missing_confidence_segment",
] as const;

export type Stage4B4TranscriptionFixtureSceneId = (typeof STAGE_4B4_TRANSCRIPTION_FIXTURE_SCENE_IDS)[number];

export type Stage4B4TranscriptionFixtureManifest = Record<string, Stage4B4TranscriptionFixtureSceneId>;

export type Stage4B4TranscriptionFixtureTemplate = {
  locale: Stage4B4SupportedLocale;
  transcriptText: string;
  overallConfidence: number;
  segmentConfidence: number;
  uncertain: boolean;
  uncertainSpanCount: number;
};

export const STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES: Record<
  Stage4B4TranscriptionFixtureSceneId,
  Stage4B4TranscriptionFixtureTemplate
> = {
  meal_update_tr: {
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segmentConfidence: 0.97,
    uncertain: false,
    uncertainSpanCount: 0,
  },
  low_confidence_tr: {
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.8,
    segmentConfidence: 0.97,
    uncertain: false,
    uncertainSpanCount: 0,
  },
  wrong_language_tr: {
    locale: "en-US",
    transcriptText: "I had lentil soup for lunch today.",
    overallConfidence: 0.98,
    segmentConfidence: 0.97,
    uncertain: false,
    uncertainSpanCount: 0,
  },
  empty_transcript: {
    locale: "tr-TR",
    transcriptText: "",
    overallConfidence: 0.98,
    segmentConfidence: 0.97,
    uncertain: false,
    uncertainSpanCount: 0,
  },
  uncertain_span_tr: {
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segmentConfidence: 0.97,
    uncertain: true,
    uncertainSpanCount: 1,
  },
  missing_confidence_segment: {
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segmentConfidence: 0.5,
    uncertain: false,
    uncertainSpanCount: 0,
  },
};

export function createStage4B4TranscriptionFixtureManifest(): Stage4B4TranscriptionFixtureManifest {
  return {};
}

export function registerStage4B4TranscriptionFixtureHash(
  manifest: Stage4B4TranscriptionFixtureManifest,
  contentSha256: string,
  sceneId: Stage4B4TranscriptionFixtureSceneId,
): Stage4B4TranscriptionFixtureManifest {
  return {
    ...manifest,
    [contentSha256]: sceneId,
  };
}

export function buildTranscriptionObservationFromFixtureTemplate(
  template: Stage4B4TranscriptionFixtureTemplate,
): AudioTranscriptionObservationV1 {
  const durationMs = Math.max(1, template.transcriptText.length * 40);
  return {
    schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
    locale: template.locale,
    transcriptText: template.transcriptText,
    overallConfidence: template.overallConfidence,
    segments: [
      {
        startMs: 0,
        endMs: durationMs,
        text: template.transcriptText,
        confidence: template.segmentConfidence,
        uncertain: template.uncertain,
      },
    ],
    uncertainSpanCount: template.uncertainSpanCount,
    providerId: STAGE_4B4_MOCK_TRANSCRIPTION_PROVIDER_ID,
    providerVersion: STAGE_4B4_MOCK_TRANSCRIPTION_PROVIDER_VERSION,
  };
}

export function buildTranscriptionObservationForScene(
  sceneId: Stage4B4TranscriptionFixtureSceneId,
): AudioTranscriptionObservationV1 {
  return buildTranscriptionObservationFromFixtureTemplate(STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES[sceneId]);
}
