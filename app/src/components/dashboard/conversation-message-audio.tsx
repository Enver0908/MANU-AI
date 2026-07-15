"use client";

import type { ConversationAudioDto } from "@/lib/phase-85-stage-4b4-voice-contracts";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import {
  formatVoiceDuration,
  resolveVoicePlaybackStateLabel,
} from "@/lib/phase-85-stage-4b4-voice-review-labels";

export function ConversationMessageAudio({
  audio,
  uiLanguage,
}: {
  audio: ConversationAudioDto;
  uiLanguage: SupportedLanguageCode;
}) {
  const unavailable = audio.playbackState === "expired" || audio.playbackState === "failed";
  const pending = audio.playbackState === "pending" || audio.playbackState === "review_required";
  const durationLabel = formatVoiceDuration(audio.durationMs);

  return (
    <div
      className="mt-2 w-full max-w-[320px] rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
      data-testid={`conversation-audio-${audio.assetId}`}
      aria-label={t(uiLanguage, "conversationVoicePlaybackLabel")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-700">
          {resolveVoicePlaybackStateLabel(uiLanguage, audio.playbackState)}
        </span>
        <span className="text-xs text-stone-500">{durationLabel}</span>
      </div>
      {unavailable ? (
        <p className="mt-2 text-sm text-stone-600" data-testid="conversation-audio-unavailable">
          {t(uiLanguage, "conversationVoicePlaybackUnavailable")}
        </p>
      ) : pending ? (
        <p className="mt-2 text-sm text-stone-600" data-testid="conversation-audio-pending">
          {t(uiLanguage, "conversationVoicePlaybackPendingHint")}
        </p>
      ) : (
        <audio
          className="mt-2 h-11 w-full"
          controls
          preload="none"
          src={audio.streamUrl}
          data-testid="conversation-audio-player"
        >
          {t(uiLanguage, "conversationVoicePlaybackUnsupported")}
        </audio>
      )}
    </div>
  );
}
