"use client";

import type { ConversationVoiceTranscriptDto } from "@/lib/phase-85-stage-4b4-voice-contracts";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { resolveVoiceTranscriptStatusLabel } from "@/lib/phase-85-stage-4b4-voice-review-labels";

export function ConversationMessageVoiceTranscript({
  voiceTranscript,
  uiLanguage,
}: {
  voiceTranscript: ConversationVoiceTranscriptDto;
  uiLanguage: SupportedLanguageCode;
}) {
  const statusLabel = resolveVoiceTranscriptStatusLabel(uiLanguage, voiceTranscript.status);
  const showUnavailable = voiceTranscript.status === "unavailable" || !voiceTranscript.transcriptText?.trim();

  return (
    <div
      className="mt-2 rounded-lg border border-stone-200 bg-white px-3 py-2"
      data-testid="conversation-voice-transcript"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">{statusLabel}</span>
      </div>
      {showUnavailable ? (
        <p className="mt-2 text-sm text-stone-600" data-testid="conversation-voice-transcript-unavailable">
          {t(uiLanguage, "conversationVoiceTranscriptUnavailable")}
        </p>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-800" data-testid="conversation-voice-transcript-text">
          {voiceTranscript.transcriptText}
        </p>
      )}
    </div>
  );
}
