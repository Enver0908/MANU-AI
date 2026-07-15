import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelEventRoutedOutcome } from "./phase-85-if-c-channel-event-routing";
import {
  type AudioIngressMetadataInput,
  type AudioIngressSourceAuthority,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_AUDIO_SOURCE_AUTHORITY_VERSION = "p85-stage-4b4-audio-source-authority-v1";

export function resolveAudioIngressSourceAuthority(input: {
  candidate: Pick<
    RawChannelEventCandidate,
    "isProviderEcho" | "providerGroupId" | "providerForwardedFlag" | "fromIdentity"
  >;
  routing: Pick<ChannelEventRoutedOutcome, "clientId" | "conversationId">;
}): AudioIngressSourceAuthority {
  if (input.candidate.isProviderEcho) {
    return "business_echo";
  }
  if (input.candidate.providerGroupId) {
    return "group";
  }
  if (input.candidate.providerForwardedFlag === true) {
    return "forwarded";
  }
  if (input.candidate.providerForwardedFlag === null) {
    return "unknown";
  }
  if (!input.routing.clientId || !input.routing.conversationId || !input.candidate.fromIdentity) {
    return "unknown";
  }
  return "verified_direct";
}

export function legacyIngressFlagsFromSourceAuthority(
  sourceAuthority: AudioIngressSourceAuthority,
): Pick<AudioIngressMetadataInput, "isGroupContext" | "isForwarded" | "isBusinessEcho" | "isTrustedDirectClient"> {
  switch (sourceAuthority) {
    case "business_echo":
      return {
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: true,
        isTrustedDirectClient: false,
      };
    case "group":
      return {
        isGroupContext: true,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: false,
      };
    case "forwarded":
      return {
        isGroupContext: false,
        isForwarded: true,
        isBusinessEcho: false,
        isTrustedDirectClient: false,
      };
    case "unknown":
      return {
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: false,
      };
    case "verified_direct":
    default:
      return {
        isGroupContext: false,
        isForwarded: false,
        isBusinessEcho: false,
        isTrustedDirectClient: true,
      };
  }
}

export function buildAudioIngressMetadataInput(input: {
  candidate: RawChannelEventCandidate;
  routing: ChannelEventRoutedOutcome;
  isDuplicateMedia: boolean;
}): AudioIngressMetadataInput {
  const sourceAuthority = resolveAudioIngressSourceAuthority({
    candidate: input.candidate,
    routing: input.routing,
  });
  const legacyFlags = legacyIngressFlagsFromSourceAuthority(sourceAuthority);

  return {
    messageType: input.candidate.messageType,
    voiceFlag: input.candidate.voiceFlag === true,
    mimeType: input.candidate.declaredMimeType,
    providerMediaId: input.candidate.providerMediaId,
    fromIdentity: input.candidate.fromIdentity,
    sourceAuthority,
    ...legacyFlags,
    byteSize: input.candidate.byteSize,
    durationMs: input.candidate.durationMs,
    isDuplicateMedia: input.isDuplicateMedia,
  };
}
