import { describe, expect, it } from "vitest";
import { normalizeChannelEventBatch } from "./phase-85-if-c-channel-event-normalizer";
import { CHANNEL_EVENT_KINDS } from "./phase-85-if-b-provenance-model";
import {
  AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
  AUDIO_TRANSCRIPTION_STATUSES,
  PHASE_85_STAGE_4B4_VOICE_CONTRACT_VERSION,
  STAGE_4B4_AUDIO_CHANNEL_EVENT_KIND,
  STAGE_4B4_MAX_TRANSCRIPT_CODEPOINTS,
  STAGE_4B4_MIN_SEGMENT_CONFIDENCE_THRESHOLD,
  STAGE_4B4_OVERALL_CONFIDENCE_THRESHOLD,
  assertAudioTranscriptionStatusExhaustive,
  assertClientSafeAudioPayload,
  buildConversationAudioDto,
  buildConversationVoiceTranscriptDto,
  createEmptyStage4B4VoiceCollections,
  evaluateAudioIngressMetadata,
  evaluateTranscriptQualityGate,
  mapCommunicationLanguageToLocale,
  mergeVoiceRiskOverlay,
  parseAudioTranscriptionObservationV1,
  resolveVoiceTranscriptEligibility,
  Stage4B4VoiceContractError,
  type AudioTranscriptionObservationV1,
} from "./phase-85-stage-4b4-voice-contracts";

function buildSampleObservation(
  overrides: Partial<AudioTranscriptionObservationV1> = {},
): AudioTranscriptionObservationV1 {
  return {
    schemaVersion: AUDIO_TRANSCRIPTION_OBSERVATION_SCHEMA_VERSION,
    locale: "tr-TR",
    transcriptText: "Bugun ogle yemeginde mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segments: [
      {
        startMs: 0,
        endMs: 2400,
        text: "Bugun ogle yemeginde mercimek corbasi yedim.",
        confidence: 0.97,
        uncertain: false,
      },
    ],
    uncertainSpanCount: 0,
    providerId: "mock-local-stt",
    providerVersion: "mock-v1",
    ...overrides,
  };
}

describe("phase-85-stage-4b4-voice-contracts", () => {
  it("exports locked vocabulary and channel event kind", () => {
    expect(PHASE_85_STAGE_4B4_VOICE_CONTRACT_VERSION).toBe("p85-stage-4b4-voice-contracts-v1");
    expect(STAGE_4B4_AUDIO_CHANNEL_EVENT_KIND).toBe("client_message_audio");
    expect(CHANNEL_EVENT_KINDS).toContain("client_message_audio");
    expect(AUDIO_TRANSCRIPTION_STATUSES).toHaveLength(7);
    expect(createEmptyStage4B4VoiceCollections().audioTranscriptionRecords).toEqual([]);
  });

  it("covers every transcription status exhaustively", () => {
    for (const status of AUDIO_TRANSCRIPTION_STATUSES) {
      expect(assertAudioTranscriptionStatusExhaustive(status)).toBe(status);
    }
  });

  it("maps communication language to supported locale", () => {
    expect(mapCommunicationLanguageToLocale("tr")).toBe("tr-TR");
    expect(mapCommunicationLanguageToLocale("cs")).toBe("cs-CZ");
  });

  it("round-trips transcription observation schema and rejects unknown keys", () => {
    const observation = buildSampleObservation();
    expect(parseAudioTranscriptionObservationV1(observation)).toEqual(observation);
    expect(() => parseAudioTranscriptionObservationV1({ ...observation, extra: true })).toThrow(
      Stage4B4VoiceContractError,
    );
    expect(() => parseAudioTranscriptionObservationV1({ ...observation, overallConfidence: 1.2 })).toThrow(
      Stage4B4VoiceContractError,
    );
    expect(() =>
      parseAudioTranscriptionObservationV1({
        ...observation,
        segments: [{ startMs: 100, endMs: 50, text: "x", confidence: 0.9, uncertain: false }],
      }),
    ).toThrow(Stage4B4VoiceContractError);
  });

  it("rejects more than 128 segments and overlong transcript text", () => {
    const observation = buildSampleObservation({
      transcriptText: "a".repeat(STAGE_4B4_MAX_TRANSCRIPT_CODEPOINTS + 1),
    });
    expect(() => parseAudioTranscriptionObservationV1(observation)).toThrow(Stage4B4VoiceContractError);
  });

  it("never downgrades voice risk overlay", () => {
    expect(mergeVoiceRiskOverlay("green", "yellow")).toBe("yellow");
    expect(mergeVoiceRiskOverlay("yellow", "green")).toBe("yellow");
    expect(mergeVoiceRiskOverlay("yellow", "red")).toBe("red");
    expect(mergeVoiceRiskOverlay("red", "yellow")).toBe("red");
  });

  it("redacts client-safe audio DTO fields", () => {
    const dto = buildConversationAudioDto({
      assetId: "asset-1",
      durationMs: 12_000,
      streamUrl: "/api/conversations/conv-1/media/asset-1?variant=audio",
      expiresAt: "2026-08-12T00:00:00.000Z",
      assetStatus: "analysis_ready",
      transcriptionStatus: "accepted",
    });

    expect(dto).not.toHaveProperty("sanitizedAudioObjectKey");
    expect(dto).not.toHaveProperty("providerMediaId");
    assertClientSafeAudioPayload(dto);
    expect(() => assertClientSafeAudioPayload({ assetId: "asset-1", confidence: 0.9 })).toThrow(
      Stage4B4VoiceContractError,
    );
  });

  it("limits voice transcript DTO to authorized dietitian roles for non-accepted states", () => {
    const transcription = {
      id: "tx-1",
      status: "review_required" as const,
      observation: null,
      qualityDecision: { accepted: false, reasonCodes: ["overall_confidence_low"] as const },
    };

    expect(
      buildConversationVoiceTranscriptDto({
        role: "dietitian",
        transcription,
        latestCorrectionId: null,
      })?.status,
    ).toBe("review_required");
    expect(
      buildConversationVoiceTranscriptDto({
        role: "assistant",
        transcription,
        latestCorrectionId: null,
      }),
    ).toBeNull();
    expect(
      buildConversationVoiceTranscriptDto({
        role: "auditor",
        transcription,
        latestCorrectionId: null,
      }),
    ).toBeNull();
  });

  it("evaluates transcript quality gate deterministically", () => {
    const accepted = evaluateTranscriptQualityGate({
      observation: buildSampleObservation(),
      expectedLocale: "tr-TR",
    });
    expect(accepted.accepted).toBe(true);
    expect(accepted.reasonCodes).toEqual([]);

    const lowOverall = evaluateTranscriptQualityGate({
      observation: buildSampleObservation({ overallConfidence: STAGE_4B4_OVERALL_CONFIDENCE_THRESHOLD - 0.01 }),
      expectedLocale: "tr-TR",
    });
    expect(lowOverall.accepted).toBe(false);
    expect(lowOverall.reasonCodes).toContain("overall_confidence_low");

    const lowSegment = evaluateTranscriptQualityGate({
      observation: buildSampleObservation({
        segments: [
          {
            startMs: 0,
            endMs: 1000,
            text: "test",
            confidence: STAGE_4B4_MIN_SEGMENT_CONFIDENCE_THRESHOLD - 0.01,
            uncertain: false,
          },
        ],
      }),
      expectedLocale: "tr-TR",
    });
    expect(lowSegment.accepted).toBe(false);
    expect(lowSegment.reasonCodes).toContain("segment_confidence_low");

    const uncertain = evaluateTranscriptQualityGate({
      observation: buildSampleObservation({
        segments: [
          {
            startMs: 0,
            endMs: 1000,
            text: "test",
            confidence: 0.99,
            uncertain: true,
          },
        ],
        uncertainSpanCount: 1,
      }),
      expectedLocale: "tr-TR",
    });
    expect(uncertain.accepted).toBe(false);
    expect(uncertain.reasonCodes).toContain("uncertain_spans_present");

    const wrongLanguage = evaluateTranscriptQualityGate({
      observation: buildSampleObservation({ locale: "en-US" }),
      expectedLocale: "tr-TR",
    });
    expect(wrongLanguage.accepted).toBe(false);
    expect(wrongLanguage.reasonCodes).toContain("wrong_language");

    const empty = evaluateTranscriptQualityGate({
      observation: buildSampleObservation({ transcriptText: "" }),
      expectedLocale: "tr-TR",
    });
    expect(empty.accepted).toBe(false);
    expect(empty.reasonCodes).toContain("empty_transcript");
  });

  it("evaluates audio ingress metadata golden cases deterministically", () => {
    const admitted = evaluateAudioIngressMetadata({
      messageType: "audio",
      voiceFlag: true,
      mimeType: "audio/ogg; codecs=opus",
      providerMediaId: "media-1",
      fromIdentity: "905551112233",
      isGroupContext: false,
      isForwarded: false,
      isBusinessEcho: false,
      isTrustedDirectClient: true,
      byteSize: 1024,
      durationMs: 12_000,
      isDuplicateMedia: false,
    });
    expect(admitted.decision).toBe("admitted");
    expect(admitted.normalizedEventKind).toBe("client_message_audio");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: false,
        mimeType: "audio/mpeg",
        providerMediaId: "media-2",
        fromIdentity: "905551112233",
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("unsupported_media");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg; codecs=opus",
        providerMediaId: "media-3",
        fromIdentity: "905551112233",
        isGroupContext: true,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("group_context");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg; codecs=opus",
        providerMediaId: "media-4",
        fromIdentity: "905551112233",
        isGroupContext: false,
        isForwarded: true,
        isBusinessEcho: false,
        isTrustedDirectClient: false,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("untrusted_forward");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg; codecs=opus",
        providerMediaId: "media-5",
        fromIdentity: null,
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("missing_identity");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg; codecs=opus",
        providerMediaId: null,
        fromIdentity: "905551112233",
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("review_required");

    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg; codecs=opus",
        providerMediaId: "media-6",
        fromIdentity: "905551112233",
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
        byteSize: 1024,
        durationMs: 12_000,
        isDuplicateMedia: true,
      }).decision,
    ).toBe("duplicate_media");
  });

  it("routes voice-flagged OGG audio through the canonical client_message_audio path", () => {
    const result = normalizeChannelEventBatch({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "phone-1" },
                messages: [
                  {
                    id: "msg-audio-1",
                    from: "905551112233",
                    timestamp: "1710000000",
                    type: "audio",
                    audio: {
                      id: "media-audio-1",
                      mime_type: "audio/ogg; codecs=opus",
                      sha256: "abc",
                      voice: true,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected normalized batch");
    }
    expect(result.candidates[0]?.eventKind).toBe("client_message_audio");
    expect(result.candidates[0]?.voiceFlag).toBe(true);
  });

  it("resolves transcript eligibility from transcription and asset status", () => {
    expect(
      resolveVoiceTranscriptEligibility({
        transcriptionStatus: "accepted",
        assetStatus: "analysis_ready",
      }),
    ).toBe("eligible");
    expect(
      resolveVoiceTranscriptEligibility({
        transcriptionStatus: "pending",
        assetStatus: "analysis_pending",
      }),
    ).toBe("excluded_pending");
    expect(
      resolveVoiceTranscriptEligibility({
        transcriptionStatus: "accepted",
        assetStatus: "expired",
      }),
    ).toBe("excluded_expired");
  });
});
