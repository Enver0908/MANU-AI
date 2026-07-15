import { describe, expect, it } from "vitest";
import {
  buildAudioIngressMetadataInput,
  legacyIngressFlagsFromSourceAuthority,
  resolveAudioIngressSourceAuthority,
} from "./phase-85-stage-4b4-audio-source-authority";
import { evaluateAudioIngressMetadata } from "./phase-85-stage-4b4-voice-contracts";

describe("phase-85-stage-4b4-audio-source-authority", () => {
  it("classifies verified direct, forwarded, group, echo, and unknown authorities", () => {
    expect(
      resolveAudioIngressSourceAuthority({
        candidate: {
          isProviderEcho: false,
          providerGroupId: null,
          providerForwardedFlag: false,
          fromIdentity: "905551110001",
        },
        routing: { clientId: "client-1", conversationId: "conversation-1" },
      }),
    ).toBe("verified_direct");

    expect(
      resolveAudioIngressSourceAuthority({
        candidate: {
          isProviderEcho: false,
          providerGroupId: null,
          providerForwardedFlag: true,
          fromIdentity: "905551110001",
        },
        routing: { clientId: "client-1", conversationId: "conversation-1" },
      }),
    ).toBe("forwarded");

    expect(
      resolveAudioIngressSourceAuthority({
        candidate: {
          isProviderEcho: false,
          providerGroupId: "group-1",
          providerForwardedFlag: false,
          fromIdentity: "905551110001",
        },
        routing: { clientId: "client-1", conversationId: "conversation-1" },
      }),
    ).toBe("group");

    expect(
      resolveAudioIngressSourceAuthority({
        candidate: {
          isProviderEcho: true,
          providerGroupId: null,
          providerForwardedFlag: false,
          fromIdentity: "905551110001",
        },
        routing: { clientId: "client-1", conversationId: "conversation-1" },
      }),
    ).toBe("business_echo");

    expect(
      resolveAudioIngressSourceAuthority({
        candidate: {
          isProviderEcho: false,
          providerGroupId: null,
          providerForwardedFlag: null,
          fromIdentity: "905551110001",
        },
        routing: { clientId: "client-1", conversationId: "conversation-1" },
      }),
    ).toBe("unknown");
  });

  it("maps source authority into legacy ingress flags and admission decisions", () => {
    expect(legacyIngressFlagsFromSourceAuthority("verified_direct").isTrustedDirectClient).toBe(true);
    expect(
      evaluateAudioIngressMetadata({
        messageType: "audio",
        voiceFlag: true,
        mimeType: "audio/ogg",
        providerMediaId: "media-1",
        fromIdentity: "905551110001",
        sourceAuthority: "unknown",
        ...legacyIngressFlagsFromSourceAuthority("unknown"),
        byteSize: 1024,
        durationMs: 3_000,
        isDuplicateMedia: false,
      }).decision,
    ).toBe("review_required");

    const admitted = buildAudioIngressMetadataInput({
      candidate: {
        eventKind: "client_message_audio",
        wabaId: null,
        businessPhoneNumberId: null,
        providerAccountId: null,
        providerEventId: "evt-1",
        providerMessageId: null,
        fromIdentity: "905551110001",
        toIdentity: null,
        counterpartyIdentity: "905551110001",
        body: null,
        messageType: "audio",
        providerTime: null,
        providerTimeInvalid: false,
        payloadDigest: "digest",
        malformedReason: null,
        providerMediaId: "media-1",
        declaredMimeType: "audio/ogg",
        payloadSha256: null,
        caption: null,
        replyToProviderMessageId: null,
        byteSize: 1024,
        voiceFlag: true,
        durationMs: 3_000,
        isProviderEcho: false,
        providerGroupId: null,
        providerForwardedFlag: false,
      },
      routing: {
        status: "routed",
        finalEventKind: "client_message_audio",
        accountBindingId: "binding-1",
        clientId: "client-1",
        conversationId: "conversation-1",
        actorType: "client",
        actorBindingId: null,
        authorInterface: "client_channel",
        actorResolutionBasis: "provider_counterparty",
      },
      isDuplicateMedia: false,
    });

    expect(admitted.sourceAuthority).toBe("verified_direct");
    expect(evaluateAudioIngressMetadata(admitted).decision).toBe("admitted");
  });
});
