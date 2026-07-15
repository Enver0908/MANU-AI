import { describe, expect, it } from "vitest";
import { FORBIDDEN_CLIENT_AUDIO_DTO_KEYS } from "./phase-85-stage-4b4-voice-contracts";
import {
  mapBoundedAudioRpcPayload,
  STAGE_4B4_BOUNDED_AUDIO_RPC_VERSION,
} from "./phase-85-stage-4b4-bounded-audio-rpc";
import {
  projectMessageVoiceTranscriptDto,
} from "./phase-85-stage-4b4-bounded-audio";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

describe("phase-85-stage-4b4-bounded-audio-rpc", () => {
  it("maps v2 RPC payload with transcript_text when observation is absent", () => {
    const conversation = createInitialState().conversations[0]!;
    const messageId = "voice-message-rpc";
    const assetId = "voice-asset-rpc";
    const transcriptionId = "voice-tx-rpc";

    const source = mapBoundedAudioRpcPayload({
      tenantId: DEMO_TENANT_ID,
      conversationId: conversation.id,
      clientId: conversation.clientId,
      payload: {
        media_assets: [
          {
            id: assetId,
            message_id: messageId,
            status: "analysis_ready",
            declared_mime_type: "audio/ogg",
            detected_mime_type: "audio/wav",
            duration_ms: 8_000,
            expires_at: null,
            media_kind: "audio",
            voice_message: true,
            has_audio: true,
          },
        ],
        audio_transcription_records: [
          {
            id: transcriptionId,
            media_asset_id: assetId,
            message_id: messageId,
            transcription_revision: 1,
            status: "accepted",
            origin: "mock_provider",
            transcript_text: "Bounded transcript metni",
            supersedes_transcription_id: null,
            transcript_status: "accepted",
            latest_correction_id: null,
          },
        ],
      },
    });

    expect(STAGE_4B4_BOUNDED_AUDIO_RPC_VERSION).toContain("v2");
    expect(source.audioTranscriptionRecords[0]?.observation).toBeNull();
    expect(source.audioTranscriptionRecords[0]?.transcriptText).toBe("Bounded transcript metni");

    const dto = projectMessageVoiceTranscriptDto(
      messageId,
      { tenantId: DEMO_TENANT_ID, dietitianId: "dietitian-1", role: "dietitian" },
      source,
    );
    expect(dto?.status).toBe("accepted");
    expect(dto?.transcriptText).toBe("Bounded transcript metni");
    for (const key of FORBIDDEN_CLIENT_AUDIO_DTO_KEYS) {
      expect(dto).not.toHaveProperty(key);
    }
  });

  it("maps correction lineage fields and corrected transcript revision", () => {
    const conversation = createInitialState().conversations[0]!;
    const messageId = "voice-message-corrected";
    const assetId = "voice-asset-corrected";
    const sourceTranscriptionId = "voice-tx-source";
    const correctedTranscriptionId = "voice-tx-corrected";
    const correctionId = "voice-correction-1";

    const source = mapBoundedAudioRpcPayload({
      tenantId: DEMO_TENANT_ID,
      conversationId: conversation.id,
      clientId: conversation.clientId,
      payload: {
        media_assets: [
          {
            id: assetId,
            message_id: messageId,
            status: "analysis_ready",
            declared_mime_type: "audio/ogg",
            detected_mime_type: "audio/wav",
            duration_ms: 8_000,
            expires_at: null,
            media_kind: "audio",
            voice_message: true,
            has_audio: true,
          },
        ],
        audio_transcription_records: [
          {
            id: correctedTranscriptionId,
            media_asset_id: assetId,
            message_id: messageId,
            transcription_revision: 2,
            status: "accepted",
            origin: "dietitian_correction",
            transcript_text: "Duzeltilmis bounded metin",
            supersedes_transcription_id: sourceTranscriptionId,
            transcript_status: "corrected",
            latest_correction_id: correctionId,
          },
        ],
        audio_transcript_corrections: [
          {
            id: correctionId,
            transcription_id: sourceTranscriptionId,
            source_transcription_id: sourceTranscriptionId,
            corrected_transcription_id: correctedTranscriptionId,
            target_message_id: messageId,
            status: "applied_to_pending",
            corrected_transcript: "Duzeltilmis bounded metin",
            created_at: "2026-07-15T10:00:00.000Z",
          },
        ],
      },
    });

    expect(source.audioTranscriptCorrections[0]?.targetMessageId).toBe(messageId);
    expect(source.audioTranscriptCorrections[0]?.correctedTranscriptionId).toBe(correctedTranscriptionId);

    const dto = projectMessageVoiceTranscriptDto(
      messageId,
      { tenantId: DEMO_TENANT_ID, dietitianId: "dietitian-1", role: "dietitian" },
      source,
    );
    expect(dto?.status).toBe("corrected");
    expect(dto?.transcriptText).toBe("Duzeltilmis bounded metin");
    expect(dto?.latestCorrectionId).toBe(correctionId);
  });
});
