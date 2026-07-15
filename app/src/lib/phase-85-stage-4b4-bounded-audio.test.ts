import { describe, expect, it } from "vitest";
import { projectConversationMessage } from "./phase-85-stage-4b2-api";
import type { ConversationProjectionMessage } from "./phase-85-stage-4b2-contracts";
import { projectConversationMessageWithMedia } from "./phase-85-stage-4b3-bounded-media";
import { FORBIDDEN_CLIENT_AUDIO_DTO_KEYS } from "./phase-85-stage-4b4-voice-contracts";
import {
  buildConversationAudioStreamUrl,
  buildStage4B4VoiceProjectionSourceFromState,
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

  it("projects corrected transcript status from the latest active revision without confidence fields", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const messageId = "voice-message-corrected";
    const assetId = "voice-asset-corrected";
    const sourceTranscriptionId = "voice-tx-source";
    const correctedTranscriptionId = "voice-tx-corrected";
    const correctionId = "voice-correction-1";

    state.mediaAssets = [
      buildAsset({
        id: assetId,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaKind: "audio",
        voiceMessage: true,
        durationMs: 4_000,
        sanitizedAudioObjectKey: "tenant/voice-corrected.wav",
        status: "analysis_ready",
        transcriptionId: correctedTranscriptionId,
      }),
    ];
    state.audioTranscriptionRecords = [
      {
        id: sourceTranscriptionId,
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaAssetId: assetId,
        bundleId: null,
        transcriptionRevision: 1,
        status: "superseded",
        locale: "tr-TR",
        observation: {
          schemaVersion: "audio-transcription-observation-v1-v0.1.0",
          locale: "tr-TR",
          transcriptText: "Eski metin",
          overallConfidence: 0.98,
          segments: [],
          uncertainSpanCount: 0,
          providerId: "mock-local-stt",
          providerVersion: "mock-v1",
        },
        qualityDecision: { accepted: true, reasonCodes: [] },
        rejectionReasons: [],
        origin: "mock_provider",
        transcriptText: "Eski metin",
        detectedLocale: "tr-TR",
        overallConfidence: 0.98,
        minimumSegmentConfidence: 0.98,
        uncertainSpanCount: 0,
        segmentCount: 1,
        speakerState: "single_speaker",
        supersedesTranscriptionId: null,
        supersededByTranscriptionId: correctedTranscriptionId,
        sourceModality: "voice_transcript",
        providerMode: "mock",
        createdAt: "2026-07-14T10:01:00.000Z",
        updatedAt: "2026-07-14T10:02:00.000Z",
      },
      {
        id: correctedTranscriptionId,
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaAssetId: assetId,
        bundleId: null,
        transcriptionRevision: 2,
        status: "accepted",
        locale: "tr-TR",
        observation: null,
        qualityDecision: { accepted: true, reasonCodes: [] },
        rejectionReasons: [],
        origin: "dietitian_correction",
        transcriptText: "Duzeltilmis metin",
        detectedLocale: "tr-TR",
        overallConfidence: null,
        minimumSegmentConfidence: null,
        uncertainSpanCount: null,
        segmentCount: null,
        speakerState: "single_speaker",
        supersedesTranscriptionId: sourceTranscriptionId,
        supersededByTranscriptionId: null,
        sourceModality: "voice_transcript",
        providerMode: "mock",
        createdAt: "2026-07-14T10:03:00.000Z",
        updatedAt: "2026-07-14T10:03:00.000Z",
      },
    ];
    state.audioTranscriptCorrections = [
      {
        id: correctionId,
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        transcriptionId: sourceTranscriptionId,
        sourceTranscriptionId,
        correctedTranscriptionId,
        targetMessageId: messageId,
        supersededDecisionId: null,
        rerunDecisionId: null,
        dietitianId: state.dietitian.id,
        status: "applied_to_pending",
        reasonCode: "wrong_word",
        explanation: "Kelime duzeltildi",
        correctedTranscript: "Duzeltilmis metin",
        conversationRevisionAtSubmit: 1,
        transcriptionRevisionAtSubmit: 1,
        resultAction: "invalidate_pending",
        createdAt: "2026-07-14T10:03:00.000Z",
        updatedAt: "2026-07-14T10:03:00.000Z",
      },
    ];

    const voice = filterStage4B4VoiceProjectionForConversation(
      buildStage4B4VoiceProjectionSourceFromState(state),
      DEMO_TENANT_ID,
      conversation.id,
    );
    const dto = projectMessageVoiceTranscriptDto(
      messageId,
      { tenantId: DEMO_TENANT_ID, dietitianId: state.dietitian.id, role: "dietitian" },
      voice,
    );

    expect(dto?.status).toBe("corrected");
    expect(dto?.transcriptionId).toBe(correctedTranscriptionId);
    expect(dto?.transcriptionRevision).toBe(2);
    expect(dto?.transcriptText).toBe("Duzeltilmis metin");
    expect(dto?.latestCorrectionId).toBe(correctionId);
    for (const key of FORBIDDEN_CLIENT_AUDIO_DTO_KEYS) {
      expect(dto).not.toHaveProperty(key);
    }
  });
});
