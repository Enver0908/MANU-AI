import { describe, expect, it } from "vitest";
import {
  AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
  buildTranscriptionLineageFieldsFromObservation,
} from "./phase-85-stage-4b4-voice-contracts";
import {
  mapAudioTranscriptionRecord,
  mapAudioTranscriptCorrection,
  type DbAudioTranscriptionRecord,
  type DbAudioTranscriptCorrection,
} from "./phase-85-stage-4b4-supabase-mappers";

const baseObservation = {
  schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
  locale: "tr-TR" as const,
  transcriptText: "Merhaba",
  overallConfidence: 0.91,
  segments: [
    {
      startMs: 0,
      endMs: 1200,
      text: "Merhaba",
      confidence: 0.91,
      uncertain: false,
    },
  ],
  uncertainSpanCount: 0,
  providerId: "mock-stt-v1",
  providerVersion: "v0.1.0",
};

const baseTranscription: DbAudioTranscriptionRecord = {
  id: "transcription-1",
  tenant_id: "tenant-1",
  client_id: "client-1",
  conversation_id: "conversation-1",
  message_id: "message-1",
  media_asset_id: "asset-1",
  bundle_id: "bundle-1",
  transcription_revision: 1,
  status: "accepted",
  locale: "tr-TR",
  observation: baseObservation,
  quality_decision: {
    accepted: true,
    reasonCodes: [],
  },
  rejection_reasons: [],
  source_modality: "voice_transcript",
  provider_mode: "mock",
  retrieval_eligible: true,
  evidence_expires_at: "2026-08-12T00:00:00.000Z",
  origin: "mock_provider",
  transcript_text: "Merhaba",
  detected_locale: "tr-TR",
  overall_confidence: 0.91,
  minimum_segment_confidence: 0.91,
  uncertain_span_count: 0,
  segment_count: 1,
  speaker_state: "single_speaker",
  supersedes_transcription_id: null,
  superseded_by_transcription_id: null,
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
};

describe("phase-85-stage-4b4-supabase-mappers", () => {
  it("maps audio transcription rows into domain records", () => {
    const mapped = mapAudioTranscriptionRecord(baseTranscription);
    expect(mapped.tenantId).toBe("tenant-1");
    expect(mapped.status).toBe("accepted");
    expect(mapped.observation?.transcriptText).toBe("Merhaba");
    expect(mapped.transcriptText).toBe("Merhaba");
    expect(mapped.origin).toBe("mock_provider");
    expect(mapped.speakerState).toBe("single_speaker");
    expect(mapped.qualityDecision).toEqual({ accepted: true, reasonCodes: [] });
    expect(mapped.providerMode).toBe("mock");
  });

  it("derives lineage columns from observation when row columns are absent", () => {
    const mapped = mapAudioTranscriptionRecord({
      ...baseTranscription,
      origin: null,
      transcript_text: null,
      detected_locale: null,
      overall_confidence: null,
      minimum_segment_confidence: null,
      uncertain_span_count: null,
      segment_count: null,
      speaker_state: null,
    });
    expect(mapped).toMatchObject(buildTranscriptionLineageFieldsFromObservation({ observation: baseObservation }));
  });

  it("returns null observation when json is invalid", () => {
    const mapped = mapAudioTranscriptionRecord({
      ...baseTranscription,
      observation: { schemaVersion: "broken" },
    });
    expect(mapped.observation).toBeNull();
  });

  it("maps audio transcript correction rows into domain records", () => {
    const row: DbAudioTranscriptCorrection = {
      id: "correction-1",
      tenant_id: "tenant-1",
      client_id: "client-1",
      conversation_id: "conversation-1",
      transcription_id: "transcription-1",
      source_transcription_id: "transcription-1",
      corrected_transcription_id: "transcription-2",
      target_message_id: "message-1",
      superseded_decision_id: null,
      rerun_decision_id: null,
      dietitian_id: "dietitian-1",
      status: "submitted",
      reason_code: "wrong_word",
      explanation: "Kelime hatali",
      corrected_transcript: "Merhaba dunya",
      conversation_revision_at_submit: 2,
      transcription_revision_at_submit: 1,
      result_action: "supersede_rerun",
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
    };

    const mapped = mapAudioTranscriptCorrection(row);
    expect(mapped.transcriptionId).toBe("transcription-1");
    expect(mapped.sourceTranscriptionId).toBe("transcription-1");
    expect(mapped.correctedTranscriptionId).toBe("transcription-2");
    expect(mapped.targetMessageId).toBe("message-1");
    expect(mapped.reasonCode).toBe("wrong_word");
    expect(mapped.resultAction).toBe("supersede_rerun");
  });
});
