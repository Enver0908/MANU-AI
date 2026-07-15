"use client";

import { useState } from "react";
import type { ConversationMessageDto } from "@/lib/phase-85-stage-4b2-contracts";
import {
  AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES,
  type AudioTranscriptCorrectionReasonCode,
} from "@/lib/phase-85-stage-4b4-voice-contracts";
import {
  resolveVoiceCorrectionReasonLabel,
  resolveVoiceTranscriptStatusLabel,
} from "@/lib/phase-85-stage-4b4-voice-review-labels";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextareaInput } from "./shared";

export function ConversationVoiceTranscriptReviewPanel({
  message,
  conversationRevision,
  uiLanguage,
  disabled,
  onSubmit,
}: {
  message: ConversationMessageDto;
  conversationRevision: number;
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  onSubmit: (input: {
    transcriptionId: string;
    targetMessageId: string;
    requestId: string;
    expectedConversationRevision: number;
    expectedTranscriptionRevision: number;
    reasonCode: AudioTranscriptCorrectionReasonCode;
    explanation: string;
    correctedTranscript: string;
  }) => Promise<void>;
}) {
  const review = message.voiceTranscript;
  const [reasonCode, setReasonCode] = useState<AudioTranscriptCorrectionReasonCode>("wrong_word");
  const [explanation, setExplanation] = useState("");
  const [correctedTranscript, setCorrectedTranscript] = useState(review?.transcriptText ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!review || !review.correctionAllowed) return null;

  return (
    <section
      className="mt-3 rounded-lg border border-stone-200 bg-white p-4"
      data-testid="conversation-voice-transcript-review-panel"
      aria-label={t(uiLanguage, "conversationVoiceTranscriptReviewTitle")}
    >
      <p className="text-sm font-semibold text-stone-900">{t(uiLanguage, "conversationVoiceTranscriptReviewTitle")}</p>
      <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "conversationVoiceTranscriptReviewHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
          {resolveVoiceTranscriptStatusLabel(uiLanguage, review.status)}
        </span>
      </div>
      {review.transcriptText ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-stone-800">{review.transcriptText}</p>
      ) : review.status === "unavailable" ? (
        <p className="mt-3 text-sm text-stone-600">{t(uiLanguage, "conversationVoiceTranscriptUnavailable")}</p>
      ) : null}
      <div className="mt-4">
        <label className="text-sm font-medium text-stone-700" htmlFor={`voice-correction-reason-${message.id}`}>
          {t(uiLanguage, "conversationVoiceTranscriptReviewReason")}
        </label>
        <select
          id={`voice-correction-reason-${message.id}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
          value={reasonCode}
          disabled={disabled || isSubmitting}
          onChange={(event) => setReasonCode(event.target.value as AudioTranscriptCorrectionReasonCode)}
        >
          {AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES.map((option) => (
            <option key={option} value={option}>
              {resolveVoiceCorrectionReasonLabel(uiLanguage, option)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        <TextareaInput
          label={t(uiLanguage, "conversationVoiceTranscriptCorrectedText")}
          value={correctedTranscript}
          onChange={setCorrectedTranscript}
          rows={4}
        />
      </div>
      <div className="mt-3">
        <TextareaInput
          label={t(uiLanguage, "conversationVoiceTranscriptReviewExplanation")}
          value={explanation}
          onChange={setExplanation}
          rows={3}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || isSubmitting || !explanation.trim() || !correctedTranscript.trim()}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          setIsSubmitting(true);
          setError(null);
          void onSubmit({
            transcriptionId: review.transcriptionId,
            targetMessageId: message.id,
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversationRevision,
            expectedTranscriptionRevision: review.transcriptionRevision,
            reasonCode,
            explanation: explanation.trim(),
            correctedTranscript: correctedTranscript.trim(),
          })
            .then(() => {
              setExplanation("");
            })
            .catch((submitError) => {
              setError(submitError instanceof Error ? submitError.message : "transcript_correction_failed");
            })
            .finally(() => {
              setIsSubmitting(false);
            });
        }}
      >
        {t(uiLanguage, "conversationVoiceTranscriptReviewSubmit")}
      </button>
    </section>
  );
}
