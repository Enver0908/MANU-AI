import type { ConversationActorContext, ConversationMessageDto, ConversationProjectionMessage } from "./phase-85-stage-4b2-contracts";
import { CONVERSATION_UNAVAILABLE_PREVIEW } from "./phase-85-stage-4b2-contracts";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  assertClientSafeAudioPayload,
  buildConversationAudioDto,
  buildConversationVoiceTranscriptDto,
  STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY,
  type AudioTranscriptCorrectionRecord,
  type AudioTranscriptionRecord,
  type Stage4B4VoiceStateSlice,
} from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B4_BOUNDED_AUDIO_VERSION = "p85-stage-4b4-bounded-audio-v1";
export const STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL = "Sesli mesaj";

export type Stage4B4ConversationVoiceProjectionSource = Pick<
  Stage4B4VoiceStateSlice,
  "audioTranscriptionRecords" | "audioTranscriptCorrections"
> & {
  mediaAssets: readonly MediaAssetRecord[];
};

export function buildStage4B4VoiceProjectionSourceFromState(state: ManuAppState): Stage4B4ConversationVoiceProjectionSource {
  return {
    mediaAssets: state.mediaAssets,
    audioTranscriptionRecords: state.audioTranscriptionRecords,
    audioTranscriptCorrections: state.audioTranscriptCorrections,
  };
}

export function filterStage4B4VoiceProjectionForConversation(
  source: Stage4B4ConversationVoiceProjectionSource,
  tenantId: string,
  conversationId: string,
): Stage4B4ConversationVoiceProjectionSource {
  return {
    mediaAssets: source.mediaAssets.filter(
      (asset) => asset.tenantId === tenantId && asset.conversationId === conversationId,
    ),
    audioTranscriptionRecords: source.audioTranscriptionRecords.filter(
      (record) => record.tenantId === tenantId && record.conversationId === conversationId,
    ),
    audioTranscriptCorrections: source.audioTranscriptCorrections.filter(
      (record) => record.tenantId === tenantId && record.conversationId === conversationId,
    ),
  };
}

export function buildConversationAudioStreamUrl(conversationId: string, assetId: string) {
  return `/api/conversations/${encodeURIComponent(conversationId)}/media/${encodeURIComponent(assetId)}?variant=audio`;
}

export function isVoiceConversationAsset(asset: Pick<MediaAssetRecord, "mediaKind" | "voiceMessage">): boolean {
  return asset.mediaKind === "audio" || asset.voiceMessage === true;
}

export function isVoiceOnlyConversationMessage(
  message: Pick<ConversationProjectionMessage, "body" | "retrievalEligibility">,
): boolean {
  const compact = message.body.trim();
  return (
    compact === STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY ||
    compact === "[client voice message]" ||
    message.retrievalEligibility === "excluded_voice_pending" ||
    message.retrievalEligibility === "excluded_voice_only"
  );
}

export function resolveConversationListVoicePreview(
  message: ConversationProjectionMessage | null,
  voice?: Stage4B4ConversationVoiceProjectionSource,
): string {
  if (!message) return "";
  if (isVoiceOnlyConversationMessage(message)) {
    return STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL;
  }
  if (voice?.mediaAssets.some((asset) => asset.messageId === message.id && isVoiceConversationAsset(asset))) {
    return STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL;
  }
  return "";
}

function findVoiceAssetForMessage(
  mediaAssets: readonly MediaAssetRecord[],
  messageId: string,
): MediaAssetRecord | null {
  return mediaAssets.find((asset) => asset.messageId === messageId && isVoiceConversationAsset(asset)) ?? null;
}

function findLatestTranscriptionForAsset(
  records: readonly AudioTranscriptionRecord[],
  assetId: string,
): AudioTranscriptionRecord | null {
  const matches = records
    .filter((record) => record.mediaAssetId === assetId && record.status !== "superseded")
    .sort((left, right) => right.transcriptionRevision - left.transcriptionRevision);
  return matches[0] ?? null;
}

function findLatestCorrectionForMessage(
  corrections: readonly AudioTranscriptCorrectionRecord[],
  messageId: string,
  transcription: AudioTranscriptionRecord,
): AudioTranscriptCorrectionRecord | null {
  const matches = corrections.filter(
    (correction) =>
      correction.targetMessageId === messageId ||
      correction.sourceTranscriptionId === transcription.id ||
      correction.correctedTranscriptionId === transcription.id ||
      correction.transcriptionId === transcription.id,
  );
  return matches.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function projectMessageAudioDto(
  messageId: string,
  conversationId: string,
  voice: Stage4B4ConversationVoiceProjectionSource | undefined,
): ConversationMessageDto["audio"] {
  if (!voice) return null;
  const asset = findVoiceAssetForMessage(voice.mediaAssets, messageId);
  if (!asset) return null;

  const transcription = findLatestTranscriptionForAsset(voice.audioTranscriptionRecords, asset.id);
  return buildConversationAudioDto({
    assetId: asset.id,
    durationMs: asset.durationMs ?? null,
    streamUrl: buildConversationAudioStreamUrl(conversationId, asset.id),
    expiresAt: asset.expiresAt,
    assetStatus: asset.status,
    transcriptionStatus: transcription?.status ?? null,
  });
}

export function projectMessageVoiceTranscriptDto(
  messageId: string,
  actor: ConversationActorContext,
  voice: Stage4B4ConversationVoiceProjectionSource | undefined,
): ConversationMessageDto["voiceTranscript"] {
  if (!voice) return null;
  const asset = findVoiceAssetForMessage(voice.mediaAssets, messageId);
  if (!asset) return null;

  const transcription = findLatestTranscriptionForAsset(voice.audioTranscriptionRecords, asset.id);
  if (!transcription) return null;

  const latestCorrection = findLatestCorrectionForMessage(
    voice.audioTranscriptCorrections,
    asset.messageId,
    transcription,
  );
  const dto = buildConversationVoiceTranscriptDto({
    role: actor.role,
    transcription,
    latestCorrectionId: latestCorrection?.id ?? null,
    correctedTranscript: latestCorrection?.correctedTranscript ?? null,
  });
  return dto;
}

export function projectConversationMessageVoiceFields(
  message: ConversationProjectionMessage,
  actor: ConversationActorContext,
  voice: Stage4B4ConversationVoiceProjectionSource | undefined,
  base: ConversationMessageDto,
): Pick<ConversationMessageDto, "audio" | "voiceTranscript"> {
  const audio = projectMessageAudioDto(message.id, message.conversationId, voice);
  const voiceTranscript = projectMessageVoiceTranscriptDto(message.id, actor, voice);
  const projected = { ...base, audio, voiceTranscript };
  assertClientSafeAudioPayload(projected);
  return { audio, voiceTranscript };
}

export function resolveConversationMessageBodyWithVoice(message: ConversationMessageDto): string {
  if (message.audio && (!message.body || message.body.trim() === STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY)) {
    if (message.voiceTranscript?.transcriptText?.trim()) {
      return message.voiceTranscript.transcriptText;
    }
    return STAGE_4B4_CONVERSATION_VOICE_PREVIEW_LABEL;
  }
  if (!message.body?.trim()) {
    return CONVERSATION_UNAVAILABLE_PREVIEW;
  }
  return message.body;
}
