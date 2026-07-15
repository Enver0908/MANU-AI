import { describe, expect, it } from "vitest";
import { projectConversationMessage } from "./phase-85-stage-4b2-api";
import type { ConversationProjectionMessage } from "./phase-85-stage-4b2-contracts";
import { projectConversationMessageWithMedia } from "./phase-85-stage-4b3-bounded-media";
import { FORBIDDEN_CLIENT_AUDIO_DTO_KEYS } from "./phase-85-stage-4b4-voice-contracts";
import {
  buildConversationAudioStreamUrl,
  filterStage4B4VoiceProjectionForConversation,
  projectMessageAudioDto,
  projectMessageVoiceTranscriptDto,
  STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL,
} from "./phase-85-stage-4b4-bounded-audio";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { buildAsset } from "./phase-85-stage-4b3-bounded-media.test";

function buildVoiceMessage(conversationId: string, messageId: string): ConversationProjectionMessage {
  return {
    id: messageId,
    tenantId: DEMO_TENANT_ID,
    conversationId,
    sender: "client",
    body: "[client voice message]",
    origin: "client_inbound",
    sourceMessageId: null,
    conversationSequence: 1,
    contentStatus: "available",
    retrievalEligibility: "excluded_voice_pending",
    status: "received",
    createdAt: "2026-07-14T10:00:00.000Z",
  };
}

describe("phase-85-stage-4b4-bounded-audio", () => {
  it("projects audio and transcript DTOs without forbidden keys", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const messageId = "voice-message-1";
    const assetId = "voice-asset-1";
    const transcriptionId = "voice-tx-1";

    state.mediaAssets = [
      buildAsset({
        id: assetId,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaKind: "audio",
        voiceMessage: true,
        durationMs: 12_000,
        sanitizedAudioObjectKey: "tenant/voice.wav",
        declaredMimeType: "audio/ogg",
        detectedMimeType: "audio/wav",
        status: "analysis_ready",
      }),
    ];
    state.audioTranscriptionRecords = [
      {
        id: transcriptionId,
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaAssetId: assetId,
        bundleId: "bundle-voice-1",
        transcriptionRevision: 1,
        status: "accepted",
        locale: "tr-TR",
        observation: {
          schemaVersion: "audio-transcription-observation-v1-v0.1.0",
          locale: "tr-TR",
          transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
          overallConfidence: 0.98,
          segments: [],
          uncertainSpanCount: 0,
          providerId: "mock-local-stt",
          providerVersion: "mock-v1",
        },
        qualityDecision: { accepted: true, reasonCodes: [] },
      rejectionReasons: [],
        supersededByTranscriptionId: null,
        failureCode: null,
        retryCount: 0,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        sourceModality: "voice_transcript",
        providerMode: "mock",
        createdAt: "2026-07-14T10:01:00.000Z",
        updatedAt: "2026-07-14T10:01:00.000Z",
      },
    ];

    const voice = filterStage4B4VoiceProjectionForConversation(
      {
        mediaAssets: state.mediaAssets,
        audioTranscriptionRecords: state.audioTranscriptionRecords,
        audioTranscriptCorrections: state.audioTranscriptCorrections,
      },
      DEMO_TENANT_ID,
      conversation.id,
    );
    const message = buildVoiceMessage(conversation.id, messageId);
    const dto = projectConversationMessageWithMedia(
      message,
      { tenantId: DEMO_TENANT_ID, dietitianId: state.dietitian.id, role: "dietitian" },
      undefined,
      projectConversationMessage(message),
      voice,
    );

    expect(dto.audio?.assetId).toBe(assetId);
    expect(dto.audio?.streamUrl).toBe(buildConversationAudioStreamUrl(conversation.id, assetId));
    expect(dto.voiceTranscript?.transcriptionRevision).toBe(1);
    expect(dto.voiceTranscript?.correctionAllowed).toBe(true);
    for (const key of FORBIDDEN_CLIENT_AUDIO_DTO_KEYS) {
      expect(dto.audio).not.toHaveProperty(key);
      expect(dto.voiceTranscript).not.toHaveProperty(key);
    }
  });

  it("hides correction controls from assistant role", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const messageId = "voice-message-2";
    const assetId = "voice-asset-2";
    state.mediaAssets = [
      buildAsset({
        id: assetId,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaKind: "audio",
        voiceMessage: true,
        durationMs: 4_000,
        sanitizedAudioObjectKey: "tenant/voice-2.wav",
        status: "analysis_ready",
      }),
    ];
    state.audioTranscriptionRecords = [
      {
        id: "voice-tx-2",
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaAssetId: assetId,
        bundleId: null,
        transcriptionRevision: 1,
        status: "accepted",
        locale: "tr-TR",
        observation: {
          schemaVersion: "audio-transcription-observation-v1-v0.1.0",
          locale: "tr-TR",
          transcriptText: "Merhaba",
          overallConfidence: 0.98,
          segments: [],
          uncertainSpanCount: 0,
          providerId: "mock-local-stt",
          providerVersion: "mock-v1",
        },
        qualityDecision: { accepted: true, reasonCodes: [] },
      rejectionReasons: [],
        supersededByTranscriptionId: null,
        failureCode: null,
        retryCount: 0,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        sourceModality: "voice_transcript",
        providerMode: "mock",
        createdAt: "2026-07-14T10:01:00.000Z",
        updatedAt: "2026-07-14T10:01:00.000Z",
      },
    ];
    const voice = filterStage4B4VoiceProjectionForConversation(
      {
        mediaAssets: state.mediaAssets,
        audioTranscriptionRecords: state.audioTranscriptionRecords,
        audioTranscriptCorrections: [],
      },
      DEMO_TENANT_ID,
      conversation.id,
    );

    const dietitianTranscript = projectMessageVoiceTranscriptDto(
      messageId,
      { tenantId: DEMO_TENANT_ID, dietitianId: state.dietitian.id, role: "dietitian" },
      voice,
    );
    const assistantTranscript = projectMessageVoiceTranscriptDto(
      messageId,
      { tenantId: DEMO_TENANT_ID, dietitianId: state.dietitian.id, role: "assistant" },
      voice,
    );

    expect(dietitianTranscript?.correctionAllowed).toBe(true);
    expect(assistantTranscript?.correctionAllowed).toBe(false);
    expect(projectMessageAudioDto(messageId, conversation.id, voice)?.playbackState).toBe("available");
    expect(STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL).toBe("Sesli mesaj");
  });
});
